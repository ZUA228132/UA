
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAllowedUser } from '@/lib/telegram';
import { pool, ensureSchema, logEvent } from '@/lib/db';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { initData, embedding, topK = 5, minSimilarity = 0.6, metrics } = body || {};
  if (!Array.isArray(embedding)) return NextResponse.json({ error: 'embedding required' }, { status: 400 });

  const { ok, userId } = verifyInitData(initData, process.env.BOT_TOKEN || '');
  if (!ok || !isAllowedUser(userId)) return NextResponse.json({ ok: false }, { status: 401 });

  await ensureSchema();
  const vector = new Array(1024).fill(0).map((_, i) => Number(embedding[i] || 0));

  const q = `SELECT id, tg_user_id, display_name, profile_url, image_url,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM faces
             WHERE approved = true AND 1 - (embedding <=> $1::vector) >= $2
             ORDER BY embedding <=> $1::vector
             LIMIT $3`;
  const res = await pool.query(q, [vector, Math.max(0, Math.min(0.9999, Number(minSimilarity))), Math.min(50, Math.max(1, Number(topK)))]);
  await logEvent(userId || null, 'search', { count: res.rowCount, metrics: metrics || null });
  return NextResponse.json({ ok: true, results: res.rows });
}
