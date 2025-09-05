-- Neon / Postgres DDL
create table if not exists faces (
  id bigserial primary key,
  tg_user_id bigint,
  display_name text,
  profile_url text,
  image_url text,
  ahash text not null,
  descriptor jsonb,
  approved boolean not null default true,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists faces_created_idx on faces (created_at desc);
create index if not exists faces_tg_idx on faces (tg_user_id);
create index if not exists faces_approved_idx on faces (approved);
