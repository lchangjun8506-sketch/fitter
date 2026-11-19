-- 휴식 끝 알림(잠금화면·애플워치)용 알림 구독
-- Supabase → SQL Editor 에 붙여넣고 Run
-- 계정당 1개(마지막으로 알림을 켠 기기). token = 지금 기다리는 휴식의 번호 (멈추면 비움)
create table if not exists public.rest_push (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  subscription jsonb not null,
  token        text,
  updated_at   timestamptz not null default now()
);
alter table public.rest_push enable row level security;
drop policy if exists "own rest push" on public.rest_push;
create policy "own rest push" on public.rest_push for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.rest_push to authenticated;
revoke all on public.rest_push from anon;
