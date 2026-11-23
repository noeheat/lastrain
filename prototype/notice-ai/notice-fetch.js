// 서울교통공사 지하철 알림정보(공공데이터포털 15144070) 스파이크
// 1) 모든 공지를 받아 data/notices.json에 원문 그대로 저장
// 2) 막차·지연·연장·무정차·시간표 관련 후보를 골라 data/sample.json 생성
// 실행: node --env-file=.env notice-fetch.js            (받기 + 표본)
//       node --env-file=.env notice-fetch.js --offline  (저장된 notices.json으로 표본만)
// 명세: GET https://apis.data.go.kr/B553766/ntce/getNtceList (포털 페이지의 Swagger 명세에서 확인)
//   응답 항목: noftTtl(제목) noftCn(내용) noftSeCd(구분코드) noftOcrnDt(발생일시)
//   xcseSitnBgngDt·xcseSitnEndDt(이례상황 시작·종료) lineNmLst stnSctnCdLst nonstopYn upbdnbSe crtrYmd
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const KEY = process.env.DATA_GO_KR_KEY;
const URL_ = 'https://apis.data.go.kr/B553766/ntce/getNtceList';
const DIR = new URL('./data/', import.meta.url);
const ROWS = 1000;

async function page(pageNo) {
  const u = new URL(URL_);
  u.search = new URLSearchParams({ serviceKey: KEY, dataType: 'JSON', pageNo: String(pageNo), numOfRows: String(ROWS) });
  const res = await fetch(u, { signal: AbortSignal.timeout(30000) });
  const body = await res.json().catch(() => null);
  const b = body?.response?.body;
  if (!res.ok || body?.response?.header?.resultCode !== '00' || !b) {
    throw new Error(`HTTP ${res.status} ${JSON.stringify(body?.response?.header ?? body).slice(0, 300)}`);
  }
  const item = b.items?.item ?? [];
  return { totalCount: b.totalCount, items: Array.isArray(item) ? item : [item] };
}

async function fetchAll() {
  if (!KEY) throw new Error('환경변수 DATA_GO_KR_KEY가 없습니다 (.env.example 참고)');
  const first = await page(1);
  const items = [...first.items];
  const pages = Math.ceil(first.totalCount / ROWS);
  for (let p = 2; p <= pages; p++) {
    await new Promise((r) => setTimeout(r, 500));
    items.push(...(await page(p)).items);
  }
  console.log(`받은 공지 ${items.length}건 / totalCount ${first.totalCount}`);
  const out = { source: URL_, fetchedAt: new Date().toISOString(), totalCount: first.totalCount, items };
  await mkdir(DIR, { recursive: true });
  await writeFile(new URL('notices.json', DIR), JSON.stringify(out, null, 2));
  return out;
}

// 막차에 영향을 줄 수 있어 보이는 표현
const RELATED = /막차|연장\s*운행|연장운행|조기\s*종료|운행\s*종료|영업\s*종료|단축|무정차|통과|지연|운행\s*중단|운행중단|시간표|임시\s*열차|증회|감회|막차시간|첫차/;

// 표현이 서로 다르게 고른 30건 (noftOcrnDt + 제목 앞부분으로 찾음). 비어 있으면 후보만 출력
// 연장 6 · 조기 종료 2 · 무정차 5 · 지연 6 · 시간표 2 · 막차와 무관 9 (무관은 낮 시간 연장·연장 취소·무정차 종료 등 헷갈리는 것)
const PICK = [
  ['2022-08-08T22:34:51', '막차 시간 연장운행'], // "막차시간 30분 연장" (시각 없음)
  ['2026-01-13T06:48:13', '버스업계 파업에 따른'], // "마지막 열차는 종착역 기준 02:00까지"
  ['2024-03-28T06:51:31', '서울시내버스 파업 관련 연장운행'], // "02시까지 열차 운행을 연장"
  ['2026-09-15T20:15:42', '서울시내버스파업 대비 연장운행계획'], // 내용 없이 기간만
  ['2025-12-30T15:00:00', '2025 제야의 종'], // "익일 02시까지" 임시열차
  ['2026-03-19T10:44:22', '7호선 자양역 BTS'], // "20:11 ~ 24:46" (24시 넘는 표기)
  ['2019-10-12T08:56:51', '10/12(토) 철도노조파업'], // 막차 운휴 열차 목록
  ['2026-05-28T21:33:26', '서소문 고가 철거공사'], // "오늘밤 12시부터" 구간 운행 중단
  ['2026-10-31T23:49:13', '6호선 이태원역 무정차'], // "23:47경부터 영업종료 시 까지"
  ['2025-11-01T00:44:34', '6호선 이태원역 무정차통과 안내'], // "지하철 운행 종료시까지"
  ['2025-12-31T22:30:00', '1호선 종각역 무정차 통과'], // "23:00경부터" (끝 시각 없음)
  ['2022-08-08T23:06:26', '신대방역 무정차 통과'], // "22시 50분로"
  ['2025-04-12T22:12:29', '4호선 동대문역 무정차통과'], // 시각 없이 "현재"
  ['2019-11-06T22:27:15', '8호선 열차지연'], // 응급환자
  ['2017-08-12T22:59:54', '5호선 전차선 장애'], // 방향만 ("방화방면")
  ['2017-09-10T22:22:48', '안산선 한대앞역 사상사고'], // "제8687열차가 오이도행 막차"
  ['2017-09-10T23:21:11', '안산행 마지막열차'], // "상계역(23:21)에 진입"
  ['2022-11-06T22:01:40', '1호선 하선 열차지연'], // 탈선 여파
  ['2026-04-10T22:29:08', '4호선(과천선) 선바위역'], // "운행중지되어 구원연결 준비 중"
  ['2026-09-03T11:06:29', '1호선 열차시간표 업데이트'], // 한 줄짜리
  ['2026-02-13T16:47:00', '2026년 설 명절'], // 감축운행, 휴일 운행계획
  ['2025-05-28T06:13:33', '서울시 시내버스 파업 유보'], // 연장 "미시행", 평상시 01시
  ['2025-04-30T08:50:21', '시내버스 준법투쟁 관련 열차 이용'], // "02까지 연장운행 실시하지 않음"
  ['2024-03-28T15:39:35', '서울 시내버스 파업 종료'], // 연장운행 취소
  ['2026-01-14T06:27:51', '서울 시내버스 파업에 따른'], // 퇴근 18:00~22:00 연장 (막차 아님)
  ['2023-11-15T10:55:18', '대학수학능력시험'], // 오전 증편
  ['2026-09-05T22:07:46', '5호선 여의나루역 무정차 통과 종료'], // 22:05 정상운행
  ['2026-03-19T10:39:31', '「BTS 광화문 공연」'], // 긴 표, "21시부터 막차시간까지 임시열차"
  ['2024-07-01T05:21:59', '3호선 압구정~수서역'], // 새벽 운행 중지
  ['2017-09-10T21:18:07', '코레일 열차 한대앞역'], // "약 4~5분 지연"
];

const notices = process.argv.includes('--offline')
  ? JSON.parse(await readFile(new URL('notices.json', DIR), 'utf8'))
  : await fetchAll();

const candidates = notices.items.filter((n) => RELATED.test(`${n.noftTtl} ${n.noftCn}`));
console.log(`관련 후보 ${candidates.length}건`);

if (PICK.length === 0) {
  for (const [i, n] of candidates.entries()) {
    console.log(`${i}\t${n.noftOcrnDt}\t[${n.noftSeCd}]\t${n.noftTtl}`);
  }
} else {
  const sample = PICK.map(([dt, title]) => {
    const n = notices.items.find((x) => x.noftOcrnDt === dt && x.noftTtl.startsWith(title));
    if (!n) throw new Error(`표본을 찾지 못함: ${dt} ${title}`);
    return n;
  }).map((n, i) => ({ id: `n${String(i + 1).padStart(2, '0')}`, ...n }));
  await writeFile(new URL('sample.json', DIR), JSON.stringify(sample, null, 2));
  console.log(`sample.json ${sample.length}건 저장`);
}
