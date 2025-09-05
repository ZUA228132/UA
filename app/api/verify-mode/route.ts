export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { pool, ensureSchema } from '@/lib/db'

type Body = {
  face_id: number
  dataUrl: string
  ahash: string
  descriptor?: number[]
  tg_user_id?: number | null
  display_name?: string | null
  profile_url?: string | null
  thresholdAhash?: number
  thresholdL2?: number
}

function l2(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length)
  let s = 0; for (let i=0;i<n;i++){ const d = a[i]-b[i]; s += d*d }
  return Math.sqrt(s)
}
function ham(a: string, b: string) {
  const x = (BigInt('0x'+a) ^ BigInt('0x'+b)).toString(2)
  let c = 0; for (let i=0;i<x.length;i++) if (x[i]==='1') c++
  return c
}

export async function POST(req: Request) {
  try {
    await ensureSchema()
    const {
      face_id, dataUrl, ahash, descriptor = [],
      tg_user_id = null, display_name = null, profile_url = null,
      thresholdAhash = 10, thresholdL2 = 0.85
    } = (await req.json()) as Body

    if (!face_id)  return NextResponse.json({ error: 'face_id required' }, { status: 400 })
    if (!dataUrl)  return NextResponse.json({ error: 'dataUrl required' }, { status: 400 })
    if (!ahash)    return NextResponse.json({ error: 'ahash required' }, { status: 400 })

    const { rows }: { rows: any[] } = await pool.query(
      `select id, image_url, ahash, descriptor from faces where id = $1 and banned = false limit 1`,
      [face_id]
    )
    if (!rows.length) return NextResponse.json({ error: 'reference not found' }, { status: 404 })
    const ref = rows[0]

    let passed = false
    let dist: number | null = null
    if (descriptor?.length && Array.isArray(ref.descriptor)) {
      dist = l2(descriptor, ref.descriptor as number[])
      passed = dist <= thresholdL2
    } else if (ref.ahash) {
      dist = ham(ahash, ref.ahash)
      passed = dist <= thresholdAhash
    } else {
      return NextResponse.json({ error: 'reference has no comparable features' }, { status: 400 })
    }

    const b64 = String(dataUrl).split(',')[1]
    const buf = Buffer.from(b64, 'base64')
    const blob = await put(`verify/${Date.now()}.jpg`, buf, { access: 'public', contentType: 'image/jpeg' })

    const { rows: saved }: { rows: any[] } = await pool.query(
      `insert into faces (tg_user_id, display_name, profile_url, image_url, ahash, descriptor, approved)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, image_url, approved`,
      [tg_user_id, display_name, profile_url, blob.url, ahash, JSON.stringify(descriptor||[]), passed]
    )

    return NextResponse.json({
      passed, dist,
      saved: saved[0],
      ref: { id: ref.id, image_url: ref.image_url }
    })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 })
  }
}
