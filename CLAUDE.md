# CLAUDE.md

이 파일은 모든 프로젝트 루트에 복사해서 쓴다. 프로젝트가 끝날 때마다 "교훈" 섹션을 업데이트한다.

## 나에 대해
- 컴퓨터공학과 3학년. 아직 코드 리뷰 실력을 키우는 중.
- 코드를 바꿀 때 무엇을, 왜 바꿨는지 짧게 한국어로 설명해줘. 새로 등장한 개념은 한 줄로 알려줘.

## 기본 스택 (특별한 이유 없으면 바꾸지 말 것)
- Next.js (App Router) + TypeScript (strict)
- Supabase: DB, Auth, Storage — 리전은 서울(ap-northeast-2)
- Vercel 배포 — 함수 리전 서울(icn1). DB와 서버는 항상 같은 리전.
- Tailwind CSS + shadcn/ui
- 패키지 매니저: pnpm

## 작업 방식
1. 구현 전에 먼저 계획을 짧게 보여주고, 큰 결정(DB 스키마, 인증 방식, 외부 서비스 추가)은 내 확인을 받는다.
2. 기능은 작게 쪼개서 하나씩 완성하고, 하나 끝날 때마다 커밋한다.
3. 새 라이브러리는 꼭 필요할 때만 추가하고 이유를 말해준다.
4. 같은 에러로 두 번 이상 실패하면 계속 시도하지 말고 멈춰서 원인 가설을 정리해 보고한다. (토큰 낭비 방지)
5. 전체 파일을 다시 쓰지 말고 필요한 부분만 수정한다.
6. 불필요한 파일 탐색을 줄이기 위해 아래 "프로젝트 구조"를 먼저 참고한다.

## 품질 기준
- 사용자 입력은 서버에서 반드시 검증 (zod).
- Supabase 테이블은 RLS(Row Level Security)를 항상 켠다.
- 비밀 키는 .env.local에만, 절대 커밋하지 않는다.
- 엣지 케이스 체크: 빈 값, 중복 요청, 로그인 만료, 네트워크 실패, 동시 수정.
- 배포 전 `pnpm build`와 타입 체크가 통과해야 한다.

## 프로젝트 구조
v2부터 Next.js(App Router) + TypeScript + Tailwind, Vercel 배포. 로그인·DB 없음(Supabase 미사용).
- `app/`: `page.tsx`(화면), `layout.tsx`, `manifest.ts`(PWA), 이후 `api/`(카카오·TAGO 키를 숨기는 서버 라우트)
- `components/`: `LastTrainApp`(출발역·사람 목록 상태, localStorage `lastTrain.v1`, 시트 열기, `?now=HH:MM` 디버그), `Countdown`(홈: 출발역, 한 사람씩 넘겨 보는 카운트다운, 사람 칩), `Sheet`(아래에서 올라오는 `<dialog>`), `PersonSheet`(한 사람 편집), `StationPicker`·`TrainChoices`·`TransferPlan`(둘 다 막차 칸 `LastTrainField`를 씀), `ServiceWorker`
- `lib/origin.ts`: 함께 출발하는 역(노선별 역 목록), 출발역이 바뀐 사람 판정(`isStale`)
- `lib/time.ts`: 순수 시간 로직 — 운행일 경계 04:00, 출발 = 막차 − 도보 − 5분, 색 단계
- `lib/holidays.ts`: 공휴일 목록(2026~2028, 천문연구원 월력요항). 공휴일이면 `dailyTypeCode`가 휴일(03)
- `lib/rateLimit.ts`: API 호출 제한(IP별 1분, 메모리). 각 `app/api/*/route.ts` 첫 줄에서 `rateLimit(req, '<라우트>')`
- `lib/schema.ts`: zod 입력 검증 (클라이언트·서버 공용)
- `lib/seoul.ts`·`lib/seoulReach.ts`: 1~9호선 막차 — 서울 열린데이터광장 시간표(토·휴일 포함), 열차 번호로 도착역 통과 판정. 실패하면 TAGO(`lib/tago.ts`·`lib/reach.ts`)로 넘어감
- `lib/transfer.ts`(순수)·`lib/kakao.ts`·`lib/plan.ts`, `/api/plan`: 환승 막차 — 카카오 지하철 경로를 구간으로 나눠 마지막 구간 막차부터 역산. 화면은 `components/TransferPlan`
- `public/sw.js`, `public/icons/`: 오프라인 캐시(`/_next/static` 캐시 우선, 페이지 네트워크 우선, `/api` 제외)
- `tests/`: vitest (`pnpm test`)
- `spike/`: 외부 API 검증 스크립트(TMAP·TAGO·카카오). `node --env-file=.env.local spike/...`로 실행
- `docs/`: 사람이 읽는 문서. 진행 상황·남은 작업(`progress.md`), 학습 노트(`learning-notes.md`), 지난 세션 기록. 앱 코드와 무관

## 프로젝트 기록
- 서비스명:
- 시작일 / 배포일:
- 사용한 토큰(사용량 %):
- URL:
- 사용자 수 / 매출:

## 교훈 (삽질할 때마다 한 줄씩 추가)
- DB 서버와 배포 서버는 같은 리전에 둔다. (멀면 요청마다 150ms+ 지연)
- TMAP 대중교통 API의 searchDttm·service는 자정 이후 운행을 반영하지 못한다(00:00에 전 노선 운행종료, 24시+ 표기는 400). 막차는 TAGO 지하철 시간표(depTime, endSubwayStationNm)로 계산한다.
- TAGO 시간표엔 열차 번호가 없어, 출발역·도착역 시간표를 짝지어 "이 열차가 도착역을 지나는지" 판정할 수 없다(배차 3~5분이면 다른 열차와 짝지어지고, 9호선처럼 급행이 섞이면 소요시간 추정도 깨짐). `spike/tago-reach.js` 참고.
- KRIC 역사별 운행시각표는 열차 번호(trnNo)와 종착역(tmnStinCd)을 주지만, 2호선 토·휴일과 4호선·3호선·1호선 토요일(dayCd 7)은 TAGO처럼 비어 있다(2026-11 확인, 코드표 미확인). `spike/kric-timetable.js` 참고.
- 서울 주말 막차는 평일보다 크게 이르다(강남→홍대입구 평일 00:21:30, 토·휴일 23:24:30). 시간표가 없다고 평일표로 대체하면 막차를 놓치게 된다. TAGO·KRIC에 없는 토요일과 2호선 휴일은 서울 열린데이터광장 OA-101에 있다. `spike/seoul-timetable.js` 참고.
- 서울·코레일·9호선은 토요일과 휴일 시간표가 열차 번호까지 같다(구로·부평·소요산·강남·샛강·공덕 확인). 그래서 TAGO에 토요일이 없는 노선(신분당·수인분당·공항철도 등)은 휴일 시간표로 대신하고 화면에 표시한다. 부산은 토요일이 따로 있어 그대로 쓴다.
- Next.js는 진행 중인 같은 캐시 대상 fetch를 하나로 합친다(`patch-fetch.js`의 pendingRevalidates). 재시도·헤지 요청을 같은 URL로 보내면 멈춘 첫 요청을 같이 기다리므로, 두 번째 시도는 `cache: 'no-store'`로 보낸다.
