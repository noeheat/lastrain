// 스파이크: 역 ID 끝의 역 번호가 노선 안에서 순서대로인지 검증
// (그렇다면 출발역·도착역·종착역 번호 비교만으로 "이 열차가 도착역을 지나는지" 판정 가능)
//
//   node --env-file=.env.local spike/tago-order.js
//
// 역마다 평일 상행·하행 시간표의 종착역 번호를 모아, 한 방향의 종착역이 전부
// 출발역 번호보다 크거나(전부 작거나) 한지 본다. 섞여 있으면 순환·지선·번호 불규칙.

const KEY = process.env.TAGO_SERVICE_KEY;
if (!KEY) {
  console.error('TAGO_SERVICE_KEY가 없습니다. .env.local에 Decoding 키를 넣고 --env-file=.env.local로 실행하세요.');
  process.exit(1);
}

const BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
let calls = 0;

async function get(op, params) {
  calls += 1;
  const qs = new URLSearchParams({ serviceKey: KEY, _type: 'json', numOfRows: '1000', pageNo: '1', ...params });
  const body = await (await fetch(`${BASE}/${op}?${qs}`)).json();
  const header = body?.response?.header;
  if (header && header.resultCode !== '00') throw new Error(`${header.resultCode} ${header.resultMsg}`);
  const items = body?.response?.body?.items?.item ?? [];
  return Array.isArray(items) ? items : [items];
}

// [검색어, 노선 이름에 들어간 글자]
const SAMPLES = [
  ['서울역', '1호선'], ['구로', '1호선'], ['성수', '2호선'], ['신도림', '2호선'],
  ['교대', '3호선'], ['사당', '4호선'], ['강동', '5호선'], ['합정', '6호선'],
  ['건대입구', '7호선'], ['잠실', '8호선'], ['신논현', '9호선'], ['왕십리', '경의'],
  ['왕십리', '수인'], ['판교', '신분당'], ['홍대입구', '공항'],
];

const num = (code) => Number(String(code).replace(/\D/g, ''));

for (const [kw, route] of SAMPLES) {
  try {
    const st = (await get('GetKwrdFndSubwaySttnList', { subwayStationName: kw }))
      .find((s) => s.subwayStationName.startsWith(kw) && String(s.subwayRouteName).includes(route));
    if (!st) { console.log(`\n${kw} ${route}: 역 못 찾음`); continue; }
    console.log(`\n${st.subwayStationName} (${st.subwayRouteName}) ${st.subwayStationId}`);
    for (const ud of ['U', 'D']) {
      const items = await get('GetSubwaySttnAcctoSchdulList', {
        subwayStationId: st.subwayStationId, dailyTypeCode: '01', upDownTypeCode: ud,
      });
      if (!items.length) { console.log(`  ${ud}: 시간표 없음`); continue; }
      const routeId = items[0].subwayRouteId;
      const code = st.subwayStationId.slice(routeId.length);
      const ends = new Map();
      for (const it of items) ends.set(it.endSubwayStationId, it.endSubwayStationNm);
      const rows = [...ends].map(([id, nm]) => {
        const c = id.startsWith(routeId) ? id.slice(routeId.length) : `?${id}`;
        const side = c.startsWith('?') ? '다른노선' : num(c) > num(code) ? '>' : num(c) < num(code) ? '<' : '=';
        return { c, nm, side };
      });
      const sides = new Set(rows.map((r) => r.side).filter((s) => s !== '='));
      const verdict = sides.size <= 1 ? `일관 ${[...sides][0] ?? ''}` : `섞임 ${[...sides].join('')}`;
      console.log(`  ${ud} [${verdict}] route=${routeId} 출발 ${code}: ${rows.map((r) => `${r.nm}(${r.c}${r.side})`).join(' ')}`);
    }
  } catch (e) {
    console.log(`\n${kw} ${route}: 실패 ${e.message}`);
  }
}
console.log(`\n(API 호출 ${calls}회)`);
