export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { pool, ensureSchema } from '@/lib/db'

export async function GET() {
  try {
    await ensureSchema()
    const { rows: pending }: { rows: any[] } = await pool.query(
      `select * from faces where approved = false and banned = false order by created_at desc limit 100`
    )
    const { rows: recent }: { rows: any[] } = await pool.query(
      `select * from faces where approved = true and banned = false order by created_at desc limit 50`
    )
    return NextResponse.json({ pending, recent })
  } catch (e:any) {
    // Пустой ответ вместо падения билдов/функций
    return NextResponse.json({ pending: [], recent: [], error: e?.message }, { status: 200 })
  }
}
