-- AI 루틴 추천 사용 기록 (계정당 하루 사용 횟수 제한용)
-- Supabase → SQL Editor 에 붙여넣고 Run
create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null default 'routine',
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
drop policy if exists "own ai usage read" on public.ai_usage;
drop policy if exists "own ai usage insert" on public.ai_usage;
create policy "own ai usage read" on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy "own ai usage insert" on public.ai_usage for insert to authenticated with check (user_id = auth.uid());
grant select, insert on public.ai_usage to authenticated;
revoke all on public.ai_usage from anon;
