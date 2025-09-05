export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'json'
  const { rows } = await pool.query(`select * from faces order by id asc`)
  if (format === 'csv') {
    const header = 'id,tg_user_id,display_name,profile_url,image_url,ahash,approved,banned,created_at\n'
    const csv = header + rows.map((x:any)=>[
      x.id, x.tg_user_id, JSON.stringify(x.display_name||''), JSON.stringify(x.profile_url||''),
      JSON.stringify(x.image_url||''), x.ahash, x.approved, x.banned, x.created_at.toISOString()
    ].join(',')).join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="faces.csv"' } })
  }
  return NextResponse.json({ faces: rows })
}
