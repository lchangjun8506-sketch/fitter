# 서버 연결 가이드 (로그인 · 대결 · 인바디 저장)

이 설정을 하기 전에도 앱은 동작합니다(기록이 휴대폰 안에만 저장됨).
아래 순서대로 하면 로그인·친구 대결·인바디 판독이 켜집니다. 처음이면 1시간 정도 걸려요. 로그인은 카카오·구글 두 가지만 지원해요.

---

## 1. Supabase 프로젝트 만들기 (약 10분)

1. https://supabase.com 가입 → **New project**
   - Region: **Northeast Asia (Seoul)**
   - Database password는 따로 적어 두세요.
2. 왼쪽 **SQL Editor** → **New query** → 아래 두 파일을 **순서대로** 각각 통째로 붙여넣고 **Run**
   - `supabase/migrations/0001_init.sql`: 표·보안 규칙·함수, 인바디 파일 보관함(`inbody` 버킷)
   - `supabase/migrations/0002_grants.sql`: 앱이 표에 접근할 권한
     (빠뜨리면 로그인 후 "permission denied for table ..." 오류가 나요)
   - `supabase/migrations/0003_ai_usage.sql`: AI 루틴 추천 하루 사용 횟수 기록용 표
   - `supabase/migrations/0004_import_flag.sql`: "예전 기록 가져오기" 메뉴를 쓸 계정 지정 (파일 안의 `여기에-내아이디`를 내 아이디로 바꿔서 실행)
3. 두 값을 복사해 둡니다.
   - **Project URL** (`https://xxxx.supabase.co`): 화면 위쪽 **Connect** 버튼, 또는 Project Settings → **Data API** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`): Project Settings → **API Keys** → `VITE_SUPABASE_ANON_KEY`
     (예전 화면의 `anon public` 키와 같은 역할이에요)
   - **Secret key(`sb_secret_...`)는 쓰지 않아요.** 앱이나 환경 변수에 넣지 말고 누구에게도 보여 주지 마세요.
4. **Authentication → URL Configuration** (Vercel에 fitter를 Import해서 주소가 생긴 뒤에)
   - **Site URL**: Vercel 주소를 그대로 (예: `https://fitter-xxxx.vercel.app`) → Save
   - **Redirect URLs** → Add URL 로 두 줄 추가 → Save
     - `https://fitter-xxxx.vercel.app/**`
     - `http://localhost:5173/**` (내 컴퓨터에서 개발할 때용, 선택)

> 아래 각 로그인 설정에서 쓰는 **콜백 주소**는 모두 같아요:
> `https://<프로젝트ID>.supabase.co/auth/v1/callback`
> (Supabase의 Authentication → Sign In / Providers 에서 각 항목을 열면 그대로 복사할 수 있어요)

---

## 2. 카카오 로그인 (약 15분, 무료)

**먼저 Supabase에서 콜백 주소 복사**
- Supabase → Authentication → Sign In / Providers → **Kakao**를 열면 **Callback URL**이 보여요.
- 형태는 `https://<프로젝트ID>.supabase.co/auth/v1/callback` 이에요.

**카카오 개발자 사이트 (https://developers.kakao.com, 카카오 계정으로 로그인)**
1. **내 애플리케이션 → 애플리케이션 추가하기**
   - 앱 이름 `FITTER`, 회사명은 본인 이름
2. **앱 키**에서 **REST API 키** 복사
   - Supabase의 *Client ID* 칸에 들어가요.
3. **카카오 로그인** 메뉴
   - 사용 설정 **ON**
   - **Redirect URI**에 Supabase에서 복사한 콜백 주소 등록
4. **카카오 로그인 → 보안**
   - Client Secret **코드 생성** → 상태 **사용함**
   - 코드 복사 → Supabase의 *Client Secret* 칸에 들어가요.
5. **비즈 앱 전환 (개인도 무료로 가능)**
   - Supabase는 로그인할 때 카카오에 이메일을 항상 요청해요.
   - 이메일 항목은 비즈 앱에서만 열려서, 전환하지 않으면 로그인 시 `KOE205` 오류가 나요.
   - 앱 설정 → **비즈니스** → **개인 개발자 비즈 앱 전환** (사업자 등록 필요 없음. 앱 아이콘 등록을 요구하면 `public/pwa-512.png`를 올리세요)
6. **카카오 로그인 → 동의항목**
   - 닉네임: **필수 동의**
   - 프로필 사진: **선택 동의**
   - 카카오계정(이메일): **선택 동의**
7. **플랫폼 → Web → 사이트 도메인**에 Vercel 주소 등록 (예: `https://fitter-xxxx.vercel.app`)

**다시 Supabase → Kakao**
- *Enable* 켜기 → Client ID(REST API 키)·Client Secret 붙여넣기
- **Allow users without an email** 켜기 (이메일 제공을 거부한 사람도 로그인되게)
- **Save**

## 3. 구글 로그인 (약 15분, 무료)

1. https://console.cloud.google.com → 프로젝트 만들기
2. **API 및 서비스 → OAuth 동의 화면**: 외부(External), 앱 이름 FITTER, 지원 이메일 입력
3. **사용자 인증 정보 → OAuth 클라이언트 ID 만들기**
   - 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI에 위 콜백 주소 추가
4. 클라이언트 ID / 보안 비밀을 Supabase → Providers → **Google**에 붙여넣고 켜기
5. 동의 화면이 "테스트" 상태면 등록한 테스트 사용자만 로그인돼요. 공개하려면 **앱 게시**를 누르세요.

---

---

## 4. Vercel 환경 변수 넣고 다시 배포

Vercel → 프로젝트 → **Settings → Environment Variables** 에 추가:

| 이름 | 값 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` | 1-3의 Project URL | 앱·서버 공용 |
| `VITE_SUPABASE_ANON_KEY` | 1-3의 Publishable key (`sb_publishable_...`) | 공개돼도 되는 키 (권한은 DB 규칙이 막음) |
| `GEMINI_API_KEY` | Google AI Studio API 키 | **AI 루틴 추천·인바디 스캔용, 서버 전용. `VITE_`를 붙이지 마세요.** 없으면 기본 추천·직접 입력만 동작 |

저장 후 **Deployments → 최신 배포 → Redeploy** 하면 적용됩니다.

---

## 인바디 AI 스캔 (Gemini) 설정

1. https://aistudio.google.com 에 구글 계정으로 로그인 → **Get API key** → **Create API key**
2. Vercel → 프로젝트 → Settings → Environment Variables → `GEMINI_API_KEY`에 붙여넣기 (Production, **Sensitive** 권장, `VITE_`를 붙이지 마세요)
3. (선택) 모델을 바꾸려면 `GEMINI_MODEL` (기본은 `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-flash-lite-latest` → `gemini-3.6-flash` 순서로, 붐비거나 15초 안에 답이 없으면 다음 모델)
4. Redeploy
- 무료 등급은 보낸 데이터가 구글 서비스 개선에 쓰일 수 있어요. 결제를 등록한 유료 등급은 보통 그렇지 않아요. 정확한 조건은 Gemini API 가격 페이지의 "Used to improve our products" 줄에서 확인하세요.

## AI 루틴 추천 (Gemini)

- 기록 탭의 **추천 루틴**은 휴대폰에서 계산돼요. 설정이 필요 없어요.
- **AI에게 묻기**는 인바디 스캔과 같은 `GEMINI_API_KEY`를 써요 (위 "인바디 AI 스캔" 설정과 동일).
- 계정당 하루 5번까지예요 (`api/routine.ts`의 `DAILY_LIMIT`, 사용 기록은 0003의 ai_usage 표. 표가 없으면 제한 없이 동작).
- AI에는 최근 45일 종목별 핵심 수치와 최근 인바디 2회만 보내요. 메모·사진은 보내지 않아요.

## 확인 순서

1. 앱 → **나** 탭 → 카카오로 로그인 → 닉네임 정하기 → `닉네임-0000` 아이디가 생김
2. 기존에 이 기기에 쌓은 기록이 있으면 **계정으로 옮기기** 버튼이 보여요.
3. 다른 휴대폰(또는 친구)으로 로그인 → **대결** 탭에서 서로 아이디로 친구 추가
4. **도전장 보내기** → 상대가 수락하면 그날부터 볼륨 경쟁 시작
5. **나 → 결과지 올리기** → 인바디 사진/PDF → 휴대폰에서 바로 읽음(무료) → 값 확인 → 저장

## 알아둘 점

- **아이폰 홈 화면 앱에서 로그인**
  - iOS는 로그인 창을 앱 안의 작은 사파리 창으로 띄웠다가 돌아옵니다. 대부분 그대로 로그인이 유지돼요.
  - 만약 로그인 후 사파리로 빠져 버리면, 사파리에서 로그인한 뒤 홈 화면에 다시 추가해 주세요.
- **친구가 볼 수 있는 정보**
  - 보이는 것: 아이디, 연속 운동 일수, 최근 7일 운동 일수, 챌린지 기간의 볼륨 합계뿐이에요.
  - 세트 내용, 메모, 인바디는 본인만 볼 수 있어요.
- **인바디 판독은 AI(Google Gemini)**
  - 올린 결과지(사진·PDF)를 Gemini가 읽어 수치를 채워요. 사진은 긴 변 1600px로 줄여서 보내요.
  - 계정당 하루 10번까지예요 (`api/inbody-scan.ts`의 `DAILY_LIMIT`, 사용 기록은 0003의 ai_usage 표).
  - 못 읽으면 직접 입력 화면으로 넘어가요. 저장 전 확인 화면에서 결과지와 비교해 주세요.
- **인바디 원본 파일**
  - 비공개 보관함에 본인 폴더로 저장되고, 볼 때마다 60초짜리 임시 링크로 열려요.
