-- ============================================================
--  PrepVault – Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. TOPICS
create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. QUESTIONS
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  question    text not null,
  answer      text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────
create index if not exists topics_user_id_idx      on public.topics(user_id);
create index if not exists questions_topic_id_idx  on public.questions(topic_id);
create index if not exists questions_user_id_idx   on public.questions(user_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_topics     on public.topics;
drop trigger if exists set_updated_at_questions  on public.questions;

create trigger set_updated_at_topics
  before update on public.topics
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_questions
  before update on public.questions
  for each row execute function public.handle_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────
alter table public.topics    enable row level security;
alter table public.questions enable row level security;

-- Topics: owners can do everything
create policy "topics: owner full access" on public.topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Topics: anyone can READ public topics (for share links)
create policy "topics: public read" on public.topics
  for select using (is_public = true);

-- Questions: owners can do everything
create policy "questions: owner full access" on public.questions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Questions: anyone can read questions from public topics
create policy "questions: public topic read" on public.questions
  for select using (
    exists (
      select 1 from public.topics t
      where t.id = questions.topic_id and t.is_public = true
    )
  );

-- ─── DONE ────────────────────────────────────────────────────────
-- Optionally enable Google OAuth in:
-- Supabase Dashboard → Authentication → Providers → Google
