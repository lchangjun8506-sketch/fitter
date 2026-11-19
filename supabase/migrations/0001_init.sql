-- FITTER 초기 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 원칙: 본인 기록은 본인만 읽고 쓴다(RLS). 친구에게는 집계 수치(스트릭, 챌린지 볼륨)만
--       security definer 함수로 노출한다. 개별 세트/메모는 공유되지 않는다.

create extension if not exists pgcrypto;

-- 한국 시간 기준 오늘
create or replace function public.kst_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- 세트 JSON → 총 볼륨 (드롭세트 포함)
create or replace function public.set_volume(sets jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum(
           coalesce((s->>'weight')::numeric, 0) * coalesce((s->>'reps')::numeric, 0)
           + coalesce((select sum(coalesce((d->>'weight')::numeric, 0) * coalesce((d->>'reps')::numeric, 0))
                       from jsonb_array_elements(coalesce(s->'drops', '[]'::jsonb)) d), 0)
         ), 0)
  from jsonb_array_elements(coalesce(sets, '[]'::jsonb)) s
$$;

-- ───────────────── 프로필: 닉네임-0000 ─────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null check (nickname ~ '^[가-힣A-Za-z0-9_]{2,12}$'),
  tag        text not null check (tag ~ '^[0-9]{4}$'),
  handle     text generated always as (nickname || '-' || tag) stored unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- 핸들은 친구 추가용 공개 정보. 로그인한 사용자는 조회 가능
create policy "profiles readable by signed-in" on public.profiles
  for select to authenticated using (true);
-- 쓰기는 claim_nickname() 으로만

-- 닉네임 설정/변경: 같은 닉네임 안에서 겹치지 않는 4자리 태그를 서버가 발급
create or replace function public.claim_nickname(nick text) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t text;
  tries int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  nick := btrim(nick);
  if nick !~ '^[가-힣A-Za-z0-9_]{2,12}$' then
    raise exception '닉네임은 한글·영문·숫자 2~12자로 정해 주세요';
  end if;
  -- 닉네임이 같으면 기존 태그 유지
  select tag into t from profiles where id = uid and nickname = nick;
  if t is null then
    loop
      t := lpad((floor(random() * 10000))::int::text, 4, '0');
      exit when not exists (select 1 from profiles where nickname = nick and tag = t);
      tries := tries + 1;
      if tries > 200 then raise exception '이 닉네임은 사용자가 너무 많아요. 다른 닉네임을 써 주세요'; end if;
    end loop;
  end if;
  insert into profiles (id, nickname, tag) values (uid, nick, t)
  on conflict (id) do update set nickname = excluded.nickname, tag = excluded.tag;
  return nick || '-' || t;
end $$;

-- ───────────────── 운동 기록 ─────────────────
create table public.workout_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  routine    text not null,
  exercise   text not null,
  sets       jsonb not null check (jsonb_typeof(sets) = 'array'),
  memo       text,
  created_at timestamptz not null default now()
);
create index workout_logs_user_date on public.workout_logs (user_id, date desc);
alter table public.workout_logs enable row level security;
create policy "own logs" on public.workout_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.custom_exercises (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine  text not null,
  exercise text not null,
  unique (user_id, routine, exercise)
);
alter table public.custom_exercises enable row level security;
create policy "own custom exercises" on public.custom_exercises
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────── 친구 ─────────────────
create table public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- 같은 두 사람 사이엔 한 줄만 (방향 무관)
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
create policy "see own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
create policy "remove own friendships" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));
-- 추가·수락은 함수로만

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships
                 where status = 'accepted'
                   and least(requester, addressee) = least(a, b)
                   and greatest(requester, addressee) = greatest(a, b))
$$;

create or replace function public.send_friend_request(target_handle text) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target uuid;
  existing friendships%rowtype;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select id into target from profiles where handle = btrim(target_handle);
  if target is null then raise exception '그 아이디를 찾을 수 없어요'; end if;
  if target = uid then raise exception '내 아이디예요'; end if;
  select * into existing from friendships
   where least(requester, addressee) = least(uid, target) and greatest(requester, addressee) = greatest(uid, target);
  if found then
    -- 상대가 먼저 신청해 둔 상태면 바로 수락
    if existing.status = 'pending' and existing.addressee = uid then
      update friendships set status = 'accepted' where id = existing.id;
      return 'accepted';
    end if;
    return existing.status;  -- 이미 신청함/이미 친구
  end if;
  insert into friendships (requester, addressee) values (uid, target);
  return 'pending';
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update friendships set status = 'accepted'
     where id = request_id and addressee = auth.uid() and status = 'pending';
  else
    delete from friendships where id = request_id and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

-- 연속 운동 일수: 오늘 또는 어제까지 이어진 날짜 수
create or replace function public.streak_of(target uuid) returns int
language sql stable security definer set search_path = public as $$
  with d as (
    select distinct date from workout_logs where user_id = target and date <= kst_today()
  ), g as (
    select date, date - (row_number() over (order by date))::int as grp from d
  ), last_run as (
    select grp, max(date) as last_day, count(*) as len from g group by grp order by max(date) desc limit 1
  )
  select coalesce((select len::int from last_run where last_day >= kst_today() - 1), 0)
$$;

-- 친구 보드: 나 + 수락된 친구들. 집계 수치만 반환
create or replace function public.friend_board()
returns table (user_id uuid, handle text, is_me boolean, streak int, last_workout date, days_7 int, friendship_id uuid)
language sql stable security definer set search_path = public as $$
  with people as (
    select auth.uid() as uid, null::uuid as fid
    union all
    select case when f.requester = auth.uid() then f.addressee else f.requester end, f.id
      from friendships f
     where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  )
  select p.uid, pr.handle, p.uid = auth.uid(), streak_of(p.uid),
         (select max(date) from workout_logs w where w.user_id = p.uid),
         (select count(distinct date)::int from workout_logs w where w.user_id = p.uid and w.date > kst_today() - 7),
         p.fid
    from people p join profiles pr on pr.id = p.uid
   where auth.uid() is not null
   order by 4 desc, 2
$$;

-- 받은/보낸 친구 신청
create or replace function public.friend_requests()
returns table (id uuid, handle text, incoming boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, pr.handle, f.addressee = auth.uid(), f.created_at
    from friendships f
    join profiles pr on pr.id = case when f.addressee = auth.uid() then f.requester else f.addressee end
   where f.status = 'pending' and auth.uid() in (f.requester, f.addressee)
   order by f.created_at desc
$$;

-- ───────────────── 1:1 챌린지 ─────────────────
create table public.challenges (
  id         uuid primary key default gen_random_uuid(),
  creator    uuid not null references auth.users (id) on delete cascade,
  opponent   uuid not null references auth.users (id) on delete cascade,
  exercise   text,                       -- null = 모든 종목 총 볼륨
  days       int  not null check (days between 1 and 30),
  status     text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  start_date date,
  end_date   date,
  created_at timestamptz not null default now(),
  check (creator <> opponent)
);
alter table public.challenges enable row level security;
create policy "participants read" on public.challenges
  for select to authenticated using (auth.uid() in (creator, opponent));
create policy "creator cancels" on public.challenges
  for delete to authenticated using (creator = auth.uid() and status = 'pending');

create or replace function public.create_challenge(opponent_id uuid, exercise_name text, period_days int) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not are_friends(auth.uid(), opponent_id) then raise exception '친구에게만 도전할 수 있어요'; end if;
  insert into challenges (creator, opponent, exercise, days)
  values (auth.uid(), opponent_id, nullif(btrim(exercise_name), ''), period_days)
  returning id into cid;
  return cid;
end $$;

-- 수락하면 오늘부터 시작
create or replace function public.respond_challenge(challenge_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update challenges
     set status = case when accept then 'active' else 'declined' end,
         start_date = case when accept then kst_today() end,
         end_date   = case when accept then kst_today() + days - 1 end
   where id = challenge_id and opponent = auth.uid() and status = 'pending';
end $$;

-- 내 챌린지 목록 + 양쪽 점수(기간 내 볼륨). 참가자에게만 보임
create or replace function public.my_challenges()
returns table (
  id uuid, i_am_creator boolean, opponent_handle text, exercise text, days int, status text,
  start_date date, end_date date, my_score numeric, their_score numeric, finished boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.creator = auth.uid(), pr.handle, c.exercise, c.days, c.status, c.start_date, c.end_date,
         case when c.status = 'active' then (
           select coalesce(sum(set_volume(w.sets)), 0) from workout_logs w
            where w.user_id = auth.uid() and w.date between c.start_date and c.end_date
              and (c.exercise is null or w.exercise = c.exercise)) else 0 end,
         case when c.status = 'active' then (
           select coalesce(sum(set_volume(w.sets)), 0) from workout_logs w
            where w.user_id = case when c.creator = auth.uid() then c.opponent else c.creator end
              and w.date between c.start_date and c.end_date
              and (c.exercise is null or w.exercise = c.exercise)) else 0 end,
         c.status = 'active' and c.end_date < kst_today()
    from challenges c
    join profiles pr on pr.id = case when c.creator = auth.uid() then c.opponent else c.creator end
   where auth.uid() in (c.creator, c.opponent) and c.status <> 'declined'
   order by (c.status = 'pending' and c.opponent = auth.uid()) desc, c.created_at desc
$$;

-- ───────────────── 인바디 ─────────────────
create table public.inbody_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at        date not null,
  weight             numeric,   -- kg
  skeletal_muscle    numeric,   -- 골격근량 kg
  body_fat_mass      numeric,   -- 체지방량 kg
  body_fat_pct       numeric,   -- 체지방률 %
  bmi                numeric,
  bmr                numeric,   -- 기초대사량 kcal
  visceral_fat_level numeric,
  inbody_score       numeric,
  raw                jsonb,     -- AI가 읽은 원본 값 전체
  file_path          text,      -- storage: inbody/{user_id}/...
  created_at         timestamptz not null default now()
);
create index inbody_user_date on public.inbody_records (user_id, measured_at desc);
alter table public.inbody_records enable row level security;
create policy "own inbody" on public.inbody_records
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 결과지 원본 파일: 비공개 버킷, 본인 폴더만
insert into storage.buckets (id, name, public) values ('inbody', 'inbody', false)
on conflict (id) do nothing;
create policy "inbody own folder read" on storage.objects
  for select to authenticated using (bucket_id = 'inbody' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "inbody own folder write" on storage.objects
  for insert to authenticated with check (bucket_id = 'inbody' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "inbody own folder delete" on storage.objects
  for delete to authenticated using (bucket_id = 'inbody' and (storage.foldername(name))[1] = auth.uid()::text);

-- 함수 실행 권한: 로그인 사용자만
revoke execute on function public.claim_nickname(text), public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean), public.friend_board(), public.friend_requests(),
  public.create_challenge(uuid, text, int), public.respond_challenge(uuid, boolean), public.my_challenges(),
  public.streak_of(uuid), public.are_friends(uuid, uuid)
  from public, anon;
grant execute on function public.claim_nickname(text), public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean), public.friend_board(), public.friend_requests(),
  public.create_challenge(uuid, text, int), public.respond_challenge(uuid, boolean), public.my_challenges()
  to authenticated;
