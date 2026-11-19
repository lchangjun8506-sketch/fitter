# FITTER v2 — 점진적 과부하 운동일지

Apps Script 단일 HTML 앱을 **React + TypeScript + Vite + Tailwind PWA**로 옮긴 버전입니다.
휴대폰 홈 화면에 설치하면 실제 앱처럼 전체 화면으로 열리고, 오프라인에서도 열립니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173  (?demo=1 을 붙이면 샘플 데이터)
npm run build      # dist/ 에 배포용 결과물 생성
```

## 데이터 저장 위치

| 모드 | 설정 | 특징 |
|---|---|---|
| 로컬 (기본) | `.env` 없음 | 브라우저 localStorage. 기기 간 동기화 안 됨 |
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
  lib/storage.ts          저장소 인터페이스 (Local / Sheets) ← 백엔드 교체 지점
  lib/analysis.ts         볼륨·1RM·코칭 팁·정체 판정 로직
  lib/useWorkout.ts       데이터 로딩/저장 훅
  data/exercises.ts       루틴별 기본 종목
apps-script/Code.gs       구글 시트 JSON API
```

## 다음 단계 로드맵
- **Supabase 연동**: 로그인 + 실시간 동기화. `lib/storage.ts`에 `SupabaseRepo`만 추가하면 UI 수정 없음
- **스토어 앱**: Capacitor로 감싸면 같은 코드로 iOS/Android 앱 빌드 가능
