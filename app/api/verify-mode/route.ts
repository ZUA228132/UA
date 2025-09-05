
import { NextRequest, NextResponse } from 'next/server';
import { verifyInitData, isAllowedUser } from '@/lib/telegram';
import { pool, ensureSchema, logEvent } from '@/lib/db';
import { z } from 'zod';
export const runtime = 'nodejs';

const Schema = z.object({
  initData: z.string(),
  mode: z.enum(['verification','identification']),
  embedding: z.array(z.number()),
  subjectId: z.number().optional(),
  topK: z.number().default(5),
  minSimilarity: z.number().default(0.6),
  metrics: z.any().optional()
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { initData, mode, embedding, subjectId, topK, minSimilarity, metrics } = parsed.data;

  const { ok, userId } = verifyInitData(initData, process.env.BOT_TOKEN || '');
  if (!ok || !isAllowedUser(userId)) return NextResponse.json({ error: 'auth' }, { status: 401 });
  await ensureSchema();

  const vector = new Array(1024).fill(0).map((_, i) => Number(embedding[i] || 0));

  if (mode === 'verification') {
    if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });
    const q = `SELECT id, display_name, profile_url, image_url, 1 - (embedding <=> $1::vector) AS similarity FROM faces WHERE approved = true AND id = $2`;
    const r = await pool.query(q, [vector, subjectId]);
    await logEvent(userId || null, 'verify_1to1', { subjectId, metrics: metrics || null });
    if (r.rowCount === 0) return NextResponse.json({ ok: true, match: false });
    const sim = r.rows[0].similarity;
    return NextResponse.json({ ok: true, match: sim >= minSimilarity, similarity: sim, face: r.rows[0] });
  } else {
    const q = `SELECT id, display_name, profile_url, image_url, 1 - (embedding <=> $1::vector) AS similarity FROM faces WHERE approved = true AND 1 - (embedding <=> $1::vector) >= $2 ORDER BY embedding <=> $1::vector LIMIT $3`;
    const r = await pool.query(q, [vector, minSimilarity, Math.min(50, Math.max(1, topK))]);
    await logEvent(userId || null, 'identify_1toN', { count: r.rowCount, metrics: metrics || null });
    return NextResponse.json({ ok: true, results: r.rows });
  }
}
