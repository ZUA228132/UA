export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { pool, ensureSchema } from '@/lib/db'

function l2(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i=0;i<n;i++){ const d=a[i]-b[i]; s+=d*d }
  return Math.sqrt(s)
}
function ham(a: string, b: string) {
  const x = (BigInt('0x'+a) ^ BigInt('0x'+b)).toString(2)
  let c = 0; for (let i=0;i<x.length;i++) if (x[i]==='1') c++
  return c
}

type SearchBody = {
  mode?: 'identification' | 'verification'
  queryAhash?: string
  queryDescriptor?: number[]
  face_id?: number
  topK?: number
  thresholdAhash?: number
  thresholdL2?: number
  onlyApproved?: boolean
}

export async function POST(req: Request) {
  try {
    await ensureSchema()
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

    const where = onlyApproved ? 'where approved = true and banned = false' : 'where banned = false'
    const { rows }: { rows: any[] } = await pool.query(`
      select id, tg_user_id, image_url, ahash, descriptor
      from faces ${where}
      order by created_at desc
      limit 1000
    `)

    if (mode === 'verification') {
      if (!face_id) return NextResponse.json({ error: 'face_id required for verification' }, { status: 400 })
      const ref = rows.find((r:any) => r.id === face_id)
      if (!ref) return NextResponse.json({ error: 'reference face not found' }, { status: 404 })

      if (queryDescriptor && queryDescriptor.length && Array.isArray(ref.descriptor)) {
        const dist = l2(queryDescriptor, ref.descriptor as number[])
        const passed = dist <= thresholdL2
        return NextResponse.json({ passed, dist, ref: { id: ref.id, image_url: ref.image_url } })
      } else if (queryAhash && ref.ahash) {
        const dist = ham(queryAhash, ref.ahash)
        const passed = dist <= thresholdAhash
        return NextResponse.json({ passed, dist, ref: { id: ref.id, image_url: ref.image_url } })
      } else {
        return NextResponse.json({ error: 'no comparable features' }, { status: 400 })
      }
    }

    // identification
    const scored = rows.map((r:any)=>{
      if (queryDescriptor && queryDescriptor.length && Array.isArray(r.descriptor)) {
        return { id:r.id, image_url:r.image_url, tg_user_id:r.tg_user_id, dist: l2(queryDescriptor, r.descriptor as number[]) }
      } else {
        return { id:r.id, image_url:r.image_url, tg_user_id:r.tg_user_id, dist: ham(String(queryAhash), r.ahash || '0') }
      }
    }).sort((a:any,b:any)=>a.dist-b.dist).slice(0, topK)
    const filtered = scored.filter((m:any)=> (queryDescriptor?.length ? m.dist <= thresholdL2 : m.dist <= thresholdAhash))

    return NextResponse.json({ matches: filtered })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 })
  }
}
