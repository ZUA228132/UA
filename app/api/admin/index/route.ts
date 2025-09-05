export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  const { rows: pending } = await pool.query(`select * from faces where approved = false and banned = false order by created_at desc limit 100`)
  const { rows: recent }  = await pool.query(`select * from faces where approved = true and banned = false order by created_at desc limit 50`)
  return NextResponse.json({ pending, recent })
}
