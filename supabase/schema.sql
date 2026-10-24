-- ============================================================
--  PrepVault – Supabase Schema  (fixed version)
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Run each section separately if you hit any errors.
-- ============================================================

-- ─── STEP 1: TABLES ──────────────────────────────────────────────

create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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

-- ─── STEP 2: INDEXES ─────────────────────────────────────────────

create index if not exists topics_user_id_idx     on public.topics(user_id);
create index if not exists questions_topic_id_idx on public.questions(topic_id);
create index if not exists questions_user_id_idx  on public.questions(user_id);

-- ─── STEP 3: UPDATED_AT FUNCTION ─────────────────────────────────
-- Note: written without OR REPLACE to avoid the parser error.
-- If you re-run this script, the DO block drops it first safely.

do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_updated_at'
  ) then
    drop function public.handle_updated_at() cascade;
  end if;
end $$;

create function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── STEP 4: TRIGGERS ────────────────────────────────────────────

drop trigger if exists set_updated_at_topics    on public.topics;
drop trigger if exists set_updated_at_questions on public.questions;

create trigger set_updated_at_topics
  before update on public.topics
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at_questions
  before update on public.questions
  for each row execute procedure public.handle_updated_at();

-- ─── STEP 5: ROW LEVEL SECURITY ──────────────────────────────────

alter table public.topics    enable row level security;
alter table public.questions enable row level security;

-- Drop old policies first so re-runs don't fail
drop policy if exists "topics: owner full access" on public.topics;
drop policy if exists "topics: public read"       on public.topics;
drop policy if exists "questions: owner full access" on public.questions;
drop policy if exists "questions: public topic read" on public.questions;

-- Topics: owner can read / insert / update / delete their own rows
create policy "topics: owner full access" on public.topics
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Topics: anyone (even unauthenticated) can read public topics
create policy "topics: public read" on public.topics
  for select
  using (is_public = true);

-- Questions: owner can do everything
create policy "questions: owner full access" on public.questions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Questions: unauthenticated users can read questions from public topics
create policy "questions: public topic read" on public.questions
  for select
  using (
    exists (
      select 1 from public.topics t
      where t.id = questions.topic_id
        and t.is_public = true
    )
  );

-- ─── DONE ────────────────────────────────────────────────────────