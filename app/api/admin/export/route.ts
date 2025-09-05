// Fix: add explicit types to avoid 'implicit any' and ensure Node runtime
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyInitData, isAdmin } from '@/lib/telegram'

export const runtime = 'nodejs'

type FaceRow = {
  id: number
  tg_user_id: number
  display_name: string | null
  profile_url: string | null
  image_url: string | null
  approved: boolean
  created_at: Date
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'json').toLowerCase()

  const body = await req.json().catch(() => ({} as any))
  const initData = body?.initData || null
  const adminSecret = body?.adminSecret || null

  // Verify Telegram signature (optional but recommended)
  const sig = verifyInitData(initData, process.env.BOT_TOKEN || '')
  const isOk = sig.ok && isAdmin(sig.userId, process.env.ADMIN_SECRET, adminSecret)
  if (!isOk) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const r = await pool.query(`
    SELECT id, tg_user_id, display_name, profile_url, image_url, approved, created_at
    FROM faces
    ORDER BY id ASC
  `)

  if (format === 'csv') {
    const rows = (r.rows as any[]).map((x: FaceRow) =>
      [
        x.id,
        x.tg_user_id,
        JSON.stringify(x.display_name || ''),
        JSON.stringify(x.profile_url || ''),
        JSON.stringify(x.image_url || ''),
        x.approved,
        new Date(x.created_at).toISOString(),
      ].join(',')
    )
    const header = 'id,tg_user_id,display_name,profile_url,image_url,approved,created_at\n'
    const csv = header + rows.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="faces.csv"',
      },
    })
  }

  // default: JSON
  const json = r.rows.map((x: any) => ({
    id: Number(x.id),
    tg_user_id: Number(x.tg_user_id),
    display_name: x.display_name ?? null,
    profile_url: x.profile_url ?? null,
    image_url: x.image_url ?? null,
    approved: Boolean(x.approved),
    created_at: new Date(x.created_at).toISOString(),
  }))

  return NextResponse.json({ faces: json })
}
