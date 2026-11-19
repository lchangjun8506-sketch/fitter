-- 앱(로그인 사용자)이 표에 접근할 수 있게 권한 부여.
-- 새 Supabase 프로젝트는 "새 표를 API에 자동 공개"가 꺼져 있어서 이 권한이 따로 필요합니다.
-- 행 단위 보안(RLS)은 그대로라, 여전히 본인 기록만 보이고 고칠 수 있어요.
-- Supabase → SQL Editor 에 붙여넣고 Run (여러 번 실행해도 안전).

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.workout_logs     to authenticated;
grant select, insert, update, delete on public.custom_exercises to authenticated;
grant select, insert, update, delete on public.inbody_records   to authenticated;
grant select                         on public.profiles         to authenticated;
grant select, delete                 on public.friendships      to authenticated;
grant select, delete                 on public.challenges       to authenticated;

-- 로그인 전(anon)에는 어떤 표도 직접 읽지 못하게
revoke all on public.profiles, public.workout_logs, public.custom_exercises,
  public.friendships, public.challenges, public.inbody_records from anon;
