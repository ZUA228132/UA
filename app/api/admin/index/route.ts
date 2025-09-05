export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  // pending = лица, которые ещё не одобрены и не забанены
  const { rows: pending } = await pool.query(`
    select f.*
    from faces f
    left join bans b on b.tg_user_id = f.tg_user_id
    where f.approved = false and b.tg_user_id is null
    order by f.created_at desc
    limit 100
  `)

  // recent = лица, которые одобрены и не забанены
  const { rows: recent } = await pool.query(`
    select f.*
    from faces f
    left join bans b on b.tg_user_id = f.tg_user_id
    where f.approved = true and b.tg_user_id is null
    order by f.created_at desc
    limit 50
  `)

  return NextResponse.json({ pending, recent })
}
