
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAdmin } from '@/lib/telegram';
import { pool } from '@/lib/db';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { initData, adminSecret, format = 'json' } = await req.json();
  const { ok, userId } = verifyInitData(initData || '', process.env.BOT_TOKEN || '');
  if (!(ok && isAdmin(userId, process.env.ADMIN_SECRET, adminSecret))) return NextResponse.json({ ok: false }, { status: 401 });

  const r = await pool.query('SELECT id, tg_user_id, display_name, profile_url, image_url, approved, created_at FROM faces ORDER BY id');
  if (format === 'csv') {
    const header = 'id,tg_user_id,display_name,profile_url,image_url,approved,created_at\n';
    const rows = r.rows.map(x => [x.id, x.tg_user_id, JSON.stringify(x.display_name||''), JSON.stringify(x.profile_url||''), JSON.stringify(x.image_url||''), x.approved, x.created_at.toISOString()].join(','));
    const csv = header + rows.join('\n');
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="faces.csv"' } });
  } else {
    return NextResponse.json({ faces: r.rows });
  }
}
