-- "예전 기록 가져오기" 메뉴를 특정 계정에만 보이게 하는 표시
-- 사용자는 profiles를 직접 수정할 수 없어서(쓰기 정책 없음) 이 값은 SQL Editor에서만 바꿀 수 있어요.
alter table public.profiles add column if not exists can_import boolean not null default false;

-- ▼ 아래 '여기에-내아이디'를 MY 탭에 보이는 내 아이디(예: 차앵-0164)로 바꿔서 함께 실행하세요
update public.profiles set can_import = true where handle = '여기에-내아이디';
