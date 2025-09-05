export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { pool, ensureSchema } from '@/lib/db'

export async function POST(req: Request) {
  await ensureSchema()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { rows }: { rows: any[] } = await pool.query(`update faces set approved = true where id = $1 returning *`, [id])
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, face: rows[0] })
}
