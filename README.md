# FITTER v2 — 점진적 과부하 운동일지

Apps Script 단일 HTML 앱을 **React + TypeScript + Vite + Tailwind PWA**로 옮긴 버전입니다.
휴대폰 홈 화면에 설치하면 실제 앱처럼 전체 화면으로 열리고, 오프라인에서도 열립니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173  (?demo=1 을 붙이면 샘플 데이터)
npm run build      # dist/ 에 배포용 결과물 생성
```

## 기능
- 운동 기록(세트·드롭세트), 휴식 타이머, 점진적 과부하 코칭, 성장 분석
- **로그인**: 카카오·구글 → `닉네임-0000` 아이디 발급
- **대결**: 친구 추가, 연속 운동 순위, 1:1 볼륨 챌린지(3/7/14일)
- **오늘의 추천 루틴**: 가장 오래 쉰 부위와 지난 기록으로 목표 무게·횟수 추천(무료), 원하면 AI에게 묻기(Google Gemini)
- **MY 대시보드**: 이번 주 현황, 부위 밸런스, 최근 신기록, 인바디 몸 상태 요약 + 히스토리
- **인바디**: 결과지 사진·PDF를 올리면 휴대폰에서 바로 수치를 읽어 기록(무료, 사진이 외부로 나가지 않음), 이전 측정과 비교

서버(Supabase) 연결 방법은 **[SETUP.md](SETUP.md)** 를 보세요. 연결 전에도 기록 기능은 이 기기 저장으로 동작합니다.

## 데이터 저장 위치

| 모드 | 설정 | 특징 |
|---|---|---|
| 계정 (권장) | `VITE_SUPABASE_*` + 로그인 | 서버 저장, 기기 간 동기화, 대결·인바디 사용 가능 |
| 로컬 (기본) | `.env` 없음 / 로그인 전 | 브라우저 localStorage. 기기 간 동기화 안 됨 |
| 구글 시트 | `VITE_SHEETS_API_URL` 설정 | 기존 시트 데이터 그대로 사용 |

### 기존 구글 시트 연결하기
1. 기존 스프레드시트 → 확장 프로그램 → Apps Script
2. `Code.gs` 내용을 `apps-script/Code.gs`로 교체, `index.html` 파일은 삭제
3. 배포 → 새 배포 → 유형 **웹 앱**, 실행: **나**, 액세스: **모든 사용자**
4. 나온 URL을 `.env`에 `VITE_SHEETS_API_URL=...` 로 저장 후 다시 빌드

> 기존 시트에 `메모` 열(G열)이 자동으로 추가됩니다. 기존 데이터는 바뀌지 않습니다.

## 배포 (Vercel)
GitHub에 올린 뒤 Vercel에서 Import → Framework `Vite` → 환경변수 `VITE_SHEETS_API_URL` 입력.
이후 `git push` 할 때마다 자동 배포됩니다.

## 구조
```
src/
  App.tsx                 탭(기록/히스토리/성장) + 하단 내비
  components/             RestTimer, LogForm, HistoryList, Dashboard, AddExerciseSheet, Toast
  lib/storage.ts          저장소 인터페이스 (Local / Sheets / Cloud)
  lib/auth.tsx            로그인 상태, 닉네임 발급
  lib/social.ts           친구·스트릭·챌린지 (Supabase RPC)
  lib/inbody.ts           인바디 기록 저장·조회
  lib/recommend.ts        오늘의 추천 루틴 (규칙 기반, 기기 안에서)
  lib/aiRoutine.ts        AI 추천 요청 (요약 데이터만 전송)
  lib/inbodyScan.ts       결과지 AI 스캔 (Gemini, api/inbody-scan.ts 경유)
api/routine.ts            AI 루틴 추천 서버 함수 (Vercel, Gemini)
api/inbody-scan.ts        인바디 결과지 AI 스캔 (Gemini)
api/_gemini.ts            Gemini 호출·로그인 확인·하루 사용량 공용
supabase/migrations/      DB 스키마·권한·함수 (SQL Editor에 순서대로 붙여넣기)
  lib/analysis.ts         볼륨·1RM·코칭 팁·정체 판정 로직
  lib/useWorkout.ts       데이터 로딩/저장 훅
  data/exercises.ts       루틴별 기본 종목
apps-script/Code.gs       구글 시트 JSON API
```

## 다음 단계 로드맵
- **스토어 앱**: Capacitor로 감싸면 같은 코드로 iOS/Android 앱 빌드 가능
