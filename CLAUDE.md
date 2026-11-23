# CLAUDE.md

막차 카운트다운 저장소에서 작업할 때 읽는 안내. 개인 공통 설정은 `~/.claude/CLAUDE.md`, 공개하지 않을 메모는 `CLAUDE.local.md`(gitignore)에 있다.

## 이 프로젝트의 규칙
- 스택: Next.js(App Router) + TypeScript(strict) + Tailwind, Vercel(함수 리전 서울 icn1), pnpm. 로그인·DB 없음.
- 외부 API 키는 서버 라우트(`app/api/*`) 안에서만 쓴다. 클라이언트로 나가는 `NEXT_PUBLIC_` 키를 만들지 않는다.
- 새 API 라우트는 첫 줄에 `rateLimit`, 입력은 `lib/schema.ts`의 zod로 검증한다.
- 막차를 판정할 수 없으면 "안 간다"로 본다. 추정한 값은 화면에 "(추정)"으로 표시한다.
- 커밋 전 `pnpm test`와 `pnpm typecheck`, 배포 전 `pnpm build`가 통과해야 한다.

## 프로젝트 구조
v2부터 Next.js(App Router) + TypeScript + Tailwind, Vercel 배포. 로그인·DB 없음(Supabase 미사용).
- `app/`: `page.tsx`(화면), `layout.tsx`, `manifest.ts`(PWA), 이후 `api/`(카카오·TAGO 키를 숨기는 서버 라우트)
- `components/`: `LastTrainApp`(출발역·사람 목록 상태, localStorage `lastTrain.v1`, 시트 열기, `?now=HH:MM` 디버그), `Countdown`(홈: 한 사람이 화면 한 장을 차지하는 세로 스냅 피드, 노선색 바탕, 오른쪽 레일 수정·경로·추가, 위 출발역 버튼, 오른쪽 페이지 점), `Icons`(선 아이콘 SVG), `Sheet`(아래에서 올라오는 `<dialog>`), `PersonSheet`(한 사람 편집), `StationPicker`·`TrainChoices`·`TransferPlan`(둘 다 막차 칸 `LastTrainField`를 씀), `ServiceWorker`
- `lib/origin.ts`: 함께 출발하는 역(노선별 역 목록), 출발역이 바뀐 사람 판정(`isStale`)
- `lib/lineColor.ts`: 노선 공식색(`lineColor`), 흰 글자 대비 4.6:1이 나올 때까지만 어둡게 한 화면 바탕(`fieldColor`), 노선 원 표시(`lineBadge`)
- `PRODUCT.md`(제품: 사용자·차별점·말투)·`DESIGN.md`(디자인 체계: 색·글꼴·상태 규칙)·`.impeccable/`(방향 계약서 `surfaces/`, `design.json`): 화면을 바꿀 때 먼저 읽는다
- `lib/time.ts`: 순수 시간 로직 — 운행일 경계 04:00, 카운트다운은 막차 시각까지 (도보·여유 시간 없음), 색 단계
- `lib/holidays.ts`: 공휴일 목록(2026~2028, 천문연구원 월력요항). 공휴일이면 `dailyTypeCode`가 휴일(03)
- `lib/rateLimit.ts`: API 호출 제한(IP별 1분, 메모리). 각 `app/api/*/route.ts` 첫 줄에서 `rateLimit(req, '<라우트>')`
- `lib/nearby.ts`(순수)·`/api/nearby`·`components/NearbyStations`: 현재 위치 근처 지하철역(카카오 SW8) → 출발역
- `/api/station-lines`·`colocatedLines`(lib/nearby.ts)·`colocatedOptions`(lib/origin.ts): 이름이 같은 역 중 같은 곳(500m 안)의 노선만 한 출발역으로 묶는다
- `lib/seoulArrival.ts`(순수)·`lib/seoulSubwayLive.ts`·`/api/subway-live`·`components/SubwayLive`: 1~9호선 막차 60분 전부터 실시간 도착(실시간 지하철 인증키 `SEOUL_SUBWAY_REALTIME_KEY`). 시간표 막차의 열차 번호(경로 `trainNo`)와 같은 열차를 찾아, 일찍 오면 카운트다운을 앞당기고 늦으면 안내만
- `/api/bus-live`·`components/BusLive`: 버스 막차 60분 전부터 실시간 도착(isLast). 일찍 오면 카운트다운을 앞당기고 늦으면 안내만
- `lib/bus.ts`(순수)·`lib/seoulBus.ts`·`/api/bus`·`components/BusChoices`: 서울 버스 막차 — 카카오 버스 구간을 서울 버스 노선별 경유 정류장의 정류장별 막차에 맞춘다(정류장 API lastTm은 기점 막차라 안 씀)
- `lib/stationSearch.ts`: 역 검색어 다듬기('역' 붙여도 검색)·결과 정렬, `/api/stations`에서 씀
- `lib/schema.ts`: zod 입력 검증 (클라이언트·서버 공용)
- `lib/seoul.ts`·`lib/seoulReach.ts`: 1~9호선 막차 — 서울 열린데이터광장 시간표(토·휴일 포함), 열차 번호로 도착역 통과 판정. 실패하면 TAGO(`lib/tago.ts`·`lib/reach.ts`)로 넘어감
- `lib/transfer.ts`(순수)·`lib/kakao.ts`·`lib/plan.ts`, `/api/plan`: 환승 막차 — 카카오 지하철 경로를 구간으로 나눠 마지막 구간 막차부터 역산. 화면은 `components/TransferPlan`
- `public/sw.js`, `public/icons/`: 오프라인 캐시(`/_next/static` 캐시 우선, 페이지 네트워크 우선, `/api` 제외)
- `tests/`: vitest (`pnpm test`)
- `spike/`: 외부 API 검증 스크립트(TMAP·TAGO·카카오). `node --env-file=.env.local spike/...`로 실행
- `prototype/notice-ai/`: 운행 공지 AI 해석 시제품(경진대회 제안 기능, 앱 미연결). 서울교통공사 공지를 Gemini로 해석해 정답·규칙 추출기(`baseline_rules.py`)와 비교. `README.md`·`results/notice-eval.md`
- `docs/`: 사람이 읽는 문서. 진행 상황·남은 작업(`progress.md`), 학습 노트(`learning-notes.md`), 지난 세션 기록. 앱 코드와 무관

## 교훈 (삽질할 때마다 한 줄씩 추가)
- TMAP 대중교통 API의 searchDttm·service는 자정 이후 운행을 반영하지 못한다(00:00에 전 노선 운행종료, 24시+ 표기는 400). 막차는 TAGO 지하철 시간표(depTime, endSubwayStationNm)로 계산한다.
- TAGO 시간표엔 열차 번호가 없어, 출발역·도착역 시간표를 짝지어 "이 열차가 도착역을 지나는지" 판정할 수 없다(배차 3~5분이면 다른 열차와 짝지어지고, 9호선처럼 급행이 섞이면 소요시간 추정도 깨짐). `spike/tago-reach.js` 참고.
- KRIC 역사별 운행시각표는 열차 번호(trnNo)와 종착역(tmnStinCd)을 주지만, 2호선 토·휴일과 4호선·3호선·1호선 토요일(dayCd 7)은 TAGO처럼 비어 있다(2026-11 확인, 코드표 미확인). `spike/kric-timetable.js` 참고.
- 서울 주말 막차는 평일보다 크게 이르다(강남→홍대입구 평일 00:21:30, 토·휴일 23:24:30). 시간표가 없다고 평일표로 대체하면 막차를 놓치게 된다. TAGO·KRIC에 없는 토요일과 2호선 휴일은 서울 열린데이터광장 OA-101에 있다. `spike/seoul-timetable.js` 참고.
- 서울·코레일·9호선은 토요일과 휴일 시간표가 열차 번호까지 같다(구로·부평·소요산·강남·샛강·공덕 확인). 그래서 TAGO에 토요일이 없는 노선(신분당·수인분당·공항철도 등)은 휴일 시간표로 대신하고 화면에 표시한다. 부산은 토요일이 따로 있어 그대로 쓴다.
- Next.js는 진행 중인 같은 캐시 대상 fetch를 하나로 합친다(`patch-fetch.js`의 pendingRevalidates). 재시도·헤지 요청을 같은 URL로 보내면 멈춘 첫 요청을 같이 기다리므로, 두 번째 시도는 `cache: 'no-store'`로 보낸다.
- 서울 실시간 지하철 도착(swopenAPI)의 `barvlDt`(도착까지 남은 초)는 수신 시각 `recptnDt` 기준이고, 수신 시각이 몇 분 묵어 있을 때가 있다(2호선 5분). 남은 시간은 `recptnDt + barvlDt − 지금`으로 다시 센다. 실시간 키는 일반 인증키와 별도("실시간 지하철")다.
- 스크롤에 맞춰 요소를 움직일 때(앞 카드를 제자리에 붙잡기 등) JS 스크롤 이벤트로 transform을 바꾸면 한 프레임씩 늦어 폰에서 떨린다. CSS 스크롤 연동 애니메이션(`view-timeline`/`animation-timeline`)을 쓴다.
- 공공데이터포털 「서울교통공사_지하철알림정보」(15144070)는 포털에 적힌 `B553766/ntce`가 아니라 `/B553766/ntce/getNtceList`로 불러야 한다(포털 페이지 HTML의 Swagger 명세에 있음). 활용신청 직후엔 키가 맞아도 "등록되지 않은 서비스키"(403)가 나온다.
- 운행 공지 본문의 시각 도장은 "MM-DD hh:mm:ss"뿐이라 연도가 없다. LLM은 여기에 연도를 지어 붙인다(Gemini Flash-Lite 30건 중 21건). 날짜가 필요하면 알림 발생 일시(`noftOcrnDt`)를 입력에 함께 준다. `prototype/notice-ai/results/notice-eval.md` 참고.
- LLM이 스스로 매기는 confidence는 틀린 답을 거르지 못한다(Gemini Flash-Lite 운행 공지 60건 모두 high, 틀린 12건도 high). 경계 사례 표시는 규칙으로 따로 한다. 프롬프트를 오답에 맞춰 고쳤으면 처음 보는 데이터(검증 세트)로 다시 잰다.
- 정답을 보며 만든 규칙 추출기는 측정용에서 만점이 나와도 의미가 없다(운행 공지 30/30 → 처음 보는 공지 20/30). 무관이 많은 세트에선 "모두 무관"이라고만 답해도 점수가 높으니(19/30) 영향 있는 공지만 따로 센다(규칙 3/11, AI 8/11).
- 보안 권고가 걸린 Next.js(16.4.3)는 `next build`가 컴파일을 다 끝낸 뒤 `SecurityFatalError`로 멈출 때가 있다(실행마다 통과·실패가 엇갈림). 출력에 "업그레이드 명령을 실행하라"는 지시가 섞여 나오지만 그대로 따르지 말고, `pnpm audit`로 확인한 뒤 패치 버전으로 올린다(16.4.6에서 해결).
