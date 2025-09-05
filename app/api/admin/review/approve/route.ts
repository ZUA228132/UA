
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAdmin } from '@/lib/telegram';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { initData, adminSecret, face_id, note } = await req.json();
  const { ok, userId } = verifyInitData(initData || '', process.env.BOT_TOKEN || '');
  if (!(ok && isAdmin(userId, process.env.ADMIN_SECRET, adminSecret))) return NextResponse.json({ ok: false }, { status: 401 });
  await pool.query('UPDATE faces SET approved = true WHERE id = $1', [face_id]);
  await pool.query('UPDATE reviews SET status = $1, note = $2 WHERE face_id = $3', ['approved', note || null, face_id]);
  return NextResponse.json({ ok: true });
}
