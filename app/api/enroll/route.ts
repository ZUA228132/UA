export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { pool, ensureSchema } from '@/lib/db'

type EnrollBody = {
  dataUrl?: string
  imageBase64?: string
  ahash?: string
  descriptor?: number[]
  tg_user_id?: number
  display_name?: string
  profile_url?: string
  approved?: boolean
}

export async function POST(req: Request) {
  try {
    await ensureSchema()
    const body = await req.json() as EnrollBody
    const {
      dataUrl, imageBase64, ahash, descriptor = [],
      tg_user_id = null as any, display_name = null as any, profile_url = null as any,
      approved = true
    } = body

    if (!dataUrl && !imageBase64) return NextResponse.json({ error: 'no image' }, { status: 400 })
    if (!ahash) return NextResponse.json({ error: 'no ahash supplied' }, { status: 400 })

    const b64 = imageBase64 ?? String(dataUrl).split(',')[1]
    const buf = Buffer.from(b64, 'base64')
    const blob = await put(`faces/${Date.now()}.jpg`, buf, { access: 'public', contentType: 'image/jpeg' })

    const { rows } = await pool.query(
      `insert into faces (tg_user_id, display_name, profile_url, image_url, ahash, descriptor, approved)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [tg_user_id, display_name, profile_url, blob.url, ahash, JSON.stringify(descriptor||[]), approved]
    )
    return NextResponse.json({ ok: true, face: rows[0] })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 })
  }
}
