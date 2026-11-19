# 서버 연결 가이드 (로그인 · 대결 · 인바디)

이 설정을 하기 전에도 앱은 동작합니다(기록이 휴대폰 안에만 저장됨).
아래 순서대로 하면 로그인·친구 대결·인바디 판독이 켜집니다. 처음이면 1시간 정도 걸려요. 로그인은 카카오·구글 두 가지만 지원해요.

---

## 1. Supabase 프로젝트 만들기 (약 10분)

1. https://supabase.com 가입 → **New project**
   - Region: **Northeast Asia (Seoul)**
   - Database password는 따로 적어 두세요.
2. 왼쪽 **SQL Editor** → **New query** → 이 저장소의 `supabase/migrations/0001_init.sql` 내용을 통째로 붙여넣고 **Run**
   - 표·권한·함수와 인바디 파일 보관함(`inbody` 버킷)이 한 번에 만들어집니다.
3. 두 값을 복사해 둡니다.
   - **Project URL** (`https://xxxx.supabase.co`): 화면 위쪽 **Connect** 버튼, 또는 Project Settings → **Data API** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`): Project Settings → **API Keys** → `VITE_SUPABASE_ANON_KEY`
     (예전 화면의 `anon public` 키와 같은 역할이에요)
   - **Secret key(`sb_secret_...`)는 쓰지 않아요.** 앱이나 환경 변수에 넣지 말고 누구에게도 보여 주지 마세요.
4. **Authentication → URL Configuration**
   - Site URL: Vercel 주소 (예: `https://fitter-xxxx.vercel.app`)
   - Redirect URLs: 같은 주소 + `http://localhost:5173` 추가

> 아래 각 로그인 설정에서 쓰는 **콜백 주소**는 모두 같아요:
> `https://<프로젝트ID>.supabase.co/auth/v1/callback`
> (Supabase의 Authentication → Sign In / Providers 에서 각 항목을 열면 그대로 복사할 수 있어요)

---

## 2. 카카오 로그인 (약 15분, 무료)

1. https://developers.kakao.com → 내 애플리케이션 → **애플리케이션 추가하기**
2. **앱 키**의 **REST API 키** 복사
3. **카카오 로그인** → 활성화 ON → **Redirect URI**에 위 콜백 주소 등록
4. **카카오 로그인 → 보안** → Client Secret 코드 생성 → 활성화 → 코드 복사
5. **카카오 로그인 → 동의항목**: 닉네임·프로필 사진을 "필수" 또는 "선택"으로
   - 이메일(account_email)은 비즈 앱 전환 전엔 못 받을 수 있어요.
6. **플랫폼 → Web** 에 Vercel 주소 등록
7. Supabase → Authentication → Providers → **Kakao** 켜기
   - REST API Key(Client ID)와 Client Secret 붙여넣기
   - 이메일을 못 받는 경우 **Allow users without an email** 을 켜 주세요.

## 3. 구글 로그인 (약 15분, 무료)

1. https://console.cloud.google.com → 프로젝트 만들기
2. **API 및 서비스 → OAuth 동의 화면**: 외부(External), 앱 이름 FITTER, 지원 이메일 입력
3. **사용자 인증 정보 → OAuth 클라이언트 ID 만들기**
   - 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI에 위 콜백 주소 추가
4. 클라이언트 ID / 보안 비밀을 Supabase → Providers → **Google**에 붙여넣고 켜기
5. 동의 화면이 "테스트" 상태면 등록한 테스트 사용자만 로그인돼요. 공개하려면 **앱 게시**를 누르세요.

---

## 4. Claude API 키 (인바디 판독용)

1. https://console.anthropic.com → API Keys → **Create Key**
2. Billing에서 결제 수단 등록 (선불 크레딧 충전 방식)
3. 비용: 결과지 1장에 대략 수십 원 수준
   - 남용을 막으려고 계정당 **하루 10장**까지로 제한해 뒀어요 (`api/inbody.ts`의 `DAILY_LIMIT`).

---

## 5. Vercel 환경 변수 넣고 다시 배포

Vercel → 프로젝트 → **Settings → Environment Variables** 에 추가:

| 이름 | 값 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` | 1-3의 Project URL | 앱·서버 공용 |
| `VITE_SUPABASE_ANON_KEY` | 1-3의 Publishable key (`sb_publishable_...`) | 공개돼도 되는 키 (권한은 DB 규칙이 막음) |
| `ANTHROPIC_API_KEY` | 4의 키 | **서버 전용. 절대 `VITE_`를 붙이지 마세요** (앱에 노출됨) |

저장 후 **Deployments → 최신 배포 → Redeploy** 하면 적용됩니다.

---

## 확인 순서

1. 앱 → **나** 탭 → 카카오로 로그인 → 닉네임 정하기 → `닉네임-0000` 아이디가 생김
2. 기존에 이 기기에 쌓은 기록이 있으면 **계정으로 옮기기** 버튼이 보여요.
3. 다른 휴대폰(또는 친구)으로 로그인 → **대결** 탭에서 서로 아이디로 친구 추가
4. **도전장 보내기** → 상대가 수락하면 그날부터 볼륨 경쟁 시작
5. **나 → 결과지 올리기** → 인바디 사진/PDF → 값 확인 → 저장

## 알아둘 점

- **아이폰 홈 화면 앱에서 로그인**
  - iOS는 로그인 창을 앱 안의 작은 사파리 창으로 띄웠다가 돌아옵니다. 대부분 그대로 로그인이 유지돼요.
  - 만약 로그인 후 사파리로 빠져 버리면, 사파리에서 로그인한 뒤 홈 화면에 다시 추가해 주세요.
- **친구가 볼 수 있는 정보**
  - 보이는 것: 아이디, 연속 운동 일수, 최근 7일 운동 일수, 챌린지 기간의 볼륨 합계뿐이에요.
  - 세트 내용, 메모, 인바디는 본인만 볼 수 있어요.
- **인바디 원본 파일**
  - 비공개 보관함에 본인 폴더로 저장되고, 볼 때마다 60초짜리 임시 링크로 열려요.
