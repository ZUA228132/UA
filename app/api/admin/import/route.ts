export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool, ensureSchema } from '@/lib/db'

export async function POST(req: Request) {
  await ensureSchema()
  const body = await req.json()
  const faces = Array.isArray(body) ? body : body.faces
  if (!Array.isArray(faces)) return NextResponse.json({ error: 'array required' }, { status: 400 })
  let ok = 0
  for (const f of faces) {
    await pool.query(
      `insert into faces (id, tg_user_id, display_name, profile_url, image_url, ahash, descriptor, approved, banned, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do nothing`,
      [f.id, f.tg_user_id||null, f.display_name||null, f.profile_url||null, f.image_url||null, f.ahash||'', JSON.stringify(f.descriptor||[]), !!f.approved, !!f.banned, f.created_at || new Date().toISOString()]
    ).catch(()=>{})
    ok++
  }
  return NextResponse.json({ ok })
}
