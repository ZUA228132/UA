export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { topKByAhash, topKByDescriptor } from '@/lib/match'

type SearchBody = {
  mode?: 'identification' | 'verification'
  queryAhash?: string
  queryDescriptor?: number[]
  face_id?: number  // for verification when comparing with a specific face
  topK?: number
  thresholdAhash?: number   // max Hamming distance
  thresholdL2?: number      // max L2 distance
  onlyApproved?: boolean
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as SearchBody
    const {
      mode = 'identification',
      queryAhash,
      queryDescriptor = [],
      face_id,
      topK = 5,
      thresholdAhash = 10,
      thresholdL2 = 0.85,
      onlyApproved = true,
    } = body

    if (!queryAhash && (!queryDescriptor || queryDescriptor.length === 0)) {
      return NextResponse.json({ error: 'no query features provided' }, { status: 400 })
    }

    // fetch candidates (prune by approved, not banned)
    const where = onlyApproved ? 'where approved = true and banned = false' : 'where banned = false'
    // For demo: limit to 1000 latest
   const { rows }: { rows: any[] } = await pool.query(
  `select id, tg_user_id, image_url, ahash, descriptor
   from faces ${where}
   order by created_at desc
   limit 1000`
  )
    let matches
    if (queryDescriptor && queryDescriptor.length > 0) {
      matches = topKByDescriptor(queryDescriptor, rows, topK).filter(m => m.dist <= thresholdL2)
    } else {
      matches = topKByAhash(queryAhash as string, rows, topK).filter(m => m.dist <= thresholdAhash)
    }

    if (mode === 'verification') {
      if (!face_id) return NextResponse.json({ error: 'face_id required for verification' }, { status: 400 })
      const ref = rows.find(r => r.id === face_id)
      if (!ref) return NextResponse.json({ error: 'reference face not found' }, { status: 404 })

      let dist = 1e9
      if (queryDescriptor && queryDescriptor.length && Array.isArray(ref.descriptor)) {
        // @ts-ignore
        const q = queryDescriptor, d = ref.descriptor as number[]
        const n = Math.min(q.length, d.length); let s=0; for(let i=0;i<n;i++){const dd=q[i]-d[i]; s+=dd*dd} dist = Math.sqrt(s)
        const passed = dist <= thresholdL2
        return NextResponse.json({ passed, dist, ref: { id: ref.id, image_url: ref.image_url } })
      } else if (queryAhash && ref.ahash) {
        const x = (BigInt('0x'+queryAhash) ^ BigInt('0x'+ref.ahash)).toString(2)
        dist = x.split('1').length - 1
        const passed = dist <= thresholdAhash
        return NextResponse.json({ passed, dist, ref: { id: ref.id, image_url: ref.image_url } })
      } else {
        return NextResponse.json({ error: 'no comparable features' }, { status: 400 })
      }
    }

    // identification
    return NextResponse.json({ matches })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 })
  }
}
