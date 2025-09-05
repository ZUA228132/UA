
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAllowedUser } from '@/lib/telegram';
import { pool, ensureSchema, logEvent } from '@/lib/db';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { initData, embedding, displayName, profileUrl, imageDataUrl, metrics } = body || {};
  if (!Array.isArray(embedding)) return NextResponse.json({ error: 'embedding required' }, { status: 400 });

  const botToken = process.env.BOT_TOKEN || '';
  const { ok, userId } = verifyInitData(initData, botToken);
  if (!ok || !isAllowedUser(userId)) return NextResponse.json({ ok: false }, { status: 401 });

  await ensureSchema();
  const vector = new Array(1024).fill(0).map((_, i) => Number(embedding[i] || 0));

  let image_url: string | null = null;
  if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')) {
    const [meta, b64] = imageDataUrl.split(',');
    const ext = meta.includes('jpeg') ? 'jpg' : (meta.includes('png') ? 'png' : 'webp');
    const bytes = Buffer.from(b64, 'base64');
    const filename = `faces/${userId}-${Date.now()}.${ext}`;
    const result = await put(filename, bytes, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
    image_url = result.url;
  }

  const res = await pool.query(
    `INSERT INTO faces (tg_user_id, display_name, profile_url, embedding, image_url, approved)
     VALUES ($1,$2,$3,$4,$5,false) RETURNING id`,
    [userId, displayName || null, profileUrl || null, vector, image_url]
  );
  const faceId = res.rows[0].id;
  await pool.query('INSERT INTO reviews (face_id, status, note) VALUES ($1, $2, $3)', [faceId, 'pending', null]);
  await logEvent(userId || null, 'enroll_pending', { face_id: faceId, metrics: metrics || null });
  return NextResponse.json({ ok: true, id: faceId, image_url, approved: false });
}
