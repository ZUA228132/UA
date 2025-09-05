
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAdmin } from '@/lib/telegram';
import { pool } from '@/lib/db';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { initData, adminSecret, faces } = await req.json();
  const { ok, userId } = verifyInitData(initData || '', process.env.BOT_TOKEN || '');
  if (!(ok && isAdmin(userId, process.env.ADMIN_SECRET, adminSecret))) return NextResponse.json({ ok: false }, { status: 401 });
  if (!Array.isArray(faces)) return NextResponse.json({ ok: false, error: 'faces must be array' }, { status: 400 });

  let inserted = 0;
  for (const f of faces) {
    if (!Array.isArray(f.embedding) || f.embedding.length === 0) continue;
    const vector = new Array(1024).fill(0).map((_, i) => Number(f.embedding[i] || 0));
    await pool.query(
      `INSERT INTO faces (tg_user_id, display_name, profile_url, embedding, image_url, approved)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [Number(f.tg_user_id)||0, f.display_name||null, f.profile_url||null, vector, f.image_url||null, !!f.approved]
    );
    inserted++;
  }
  return NextResponse.json({ ok: true, inserted });
}
