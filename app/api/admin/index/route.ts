
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAdmin } from '@/lib/telegram';
import { pool, ensureSchema } from '@/lib/db';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { initData, adminSecret } = await req.json();
  const { ok, userId } = verifyInitData(initData || '', process.env.BOT_TOKEN || '');
  const allowed = ok && isAdmin(userId, process.env.ADMIN_SECRET, adminSecret);
  if (!allowed) return NextResponse.json({ ok: false }, { status: 401 });

  await ensureSchema();
  const faces = await pool.query('SELECT id, tg_user_id, display_name, profile_url, image_url, approved, created_at FROM faces ORDER BY id DESC LIMIT 500');
  const logs = await pool.query('SELECT id, at, tg_user_id, event, meta FROM logs ORDER BY id DESC LIMIT 500');
  const bans = await pool.query('SELECT tg_user_id, reason, banned_at FROM bans ORDER BY banned_at DESC LIMIT 200');
  const reviews = await pool.query('SELECT r.id, r.status, r.note, r.created_at, f.id as face_id, f.display_name, f.image_url FROM reviews r LEFT JOIN faces f ON f.id = r.face_id ORDER BY r.id DESC LIMIT 500');
  return NextResponse.json({ ok: true, faces: faces.rows, logs: logs.rows, bans: bans.rows, reviews: reviews.rows });
}
