export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function POST(req: Request) {
  const { id, ban = false } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { rows } = await pool.query(`
    update faces set approved = false, banned = $2 where id = $1 returning *`, [id, ban === true]
  )
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, face: rows[0] })
}
