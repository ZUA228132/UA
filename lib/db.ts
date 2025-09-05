
import { Pool } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS faces (
      id BIGSERIAL PRIMARY KEY,
      tg_user_id BIGINT NOT NULL,
      display_name TEXT, profile_url TEXT,
      embedding VECTOR(1024) NOT NULL,
      image_url TEXT,
      approved BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS logs (
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ DEFAULT now(),
      tg_user_id BIGINT,
      event TEXT,
      meta JSONB
    );
    CREATE TABLE IF NOT EXISTS bans (
      tg_user_id BIGINT PRIMARY KEY,
      reason TEXT,
      banned_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      face_id BIGINT REFERENCES faces(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending', -- pending/approved/rejected
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_faces_embedding_cos') THEN
        CREATE INDEX idx_faces_embedding_cos ON faces USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      END IF;
    EXCEPTION WHEN others THEN
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_faces_embedding_l2') THEN
          CREATE INDEX idx_faces_embedding_l2 ON faces USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
        END IF;
      EXCEPTION WHEN others THEN NULL; END;
    END $$;
  `);
}

export async function logEvent(tg_user_id: number | null, event: string, meta: any) {
  try { await pool.query('INSERT INTO logs (tg_user_id, event, meta) VALUES ($1,$2,$3)', [tg_user_id, event, meta]); } catch {}
}
