// 역 번호가 운행 순서와 다른 노선(경의중앙선 등)의 실제 정차 순서를 뽑는다
// 카카오 대중교통 경로의 정차역 목록(가장 정차역이 많은 = 일반열차 경로)을 TAGO 역 ID로 바꾼다
// 실행: node --env-file=.env.local spike/line-order.js <노선 이름(TAGO)> <출발역> <도착역>
//   예: node --env-file=.env.local spike/line-order.js 경의중앙 문산 지평
const [line = '경의중앙', from = '문산', to = '지평'] = process.argv.slice(2);
const H = { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` };
const TAGO = 'https://apis.data.go.kr/1613000/SubwayInfo';

const coord = async (name) => {
  const n = name.replace(/역$/, ''); // "서울역" → "서울" + "역"
  const qs = new URLSearchParams({ query: `${n}역`, category_group_code: 'SW8', size: '15' });
  const b = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, { headers: H })).json();
  const d = (b.documents ?? []).find((x) => x.place_name.startsWith(`${n}역`) && x.place_name.includes(line));
  return d && { x: d.x, y: d.y };
};
const tago = async (name) => {
  for (let i = 0; i < 3; i++) {
    try {
      const qs = new URLSearchParams({ serviceKey: process.env.TAGO_SERVICE_KEY, _type: 'json', numOfRows: '100', pageNo: '1', subwayStationName: name.replace(/\(.*\)$/, '') });
      const b = await (await fetch(`${TAGO}/GetKwrdFndSubwaySttnList?${qs}`, { signal: AbortSignal.timeout(8000) })).json();
      const it = b.response?.body?.items?.item ?? [];
      const hit = (Array.isArray(it) ? it : [it]).find((s) => s.subwayRouteName?.includes(line) && s.subwayStationName.replace(/\(.*\)$/, '') === name.replace(/\(.*\)$/, ''));
      return hit?.subwayStationId ?? null;
    } catch {}
  }
  return null;
};

const [a, b] = await Promise.all([coord(from), coord(to)]);
if (!a || !b) throw new Error(`카카오에서 역 좌표를 못 찾음: ${!a ? from : to}`);
const qs = new URLSearchParams({ start_x: a.x, start_y: a.y, end_x: b.x, end_y: b.y });
const body = await (await fetch(`https://dapi.kakao.com/v2/routing/publictraffic?${qs}`, { headers: H })).json();
// 이 노선 한 번만 타는 경로 중 정차역이 가장 많은 것 (급행이 아닌 일반열차)
let best = [];
for (const r of body.routes ?? []) {
  const subs = (r.steps ?? []).filter((s) => s.properties?.type === 'SUBWAY');
  if (subs.length !== 1 || !subs[0].properties.vehicles?.some((v) => v.name.includes(line))) continue;
  const stops = subs[0].properties.stops.map((s) => s.name);
  if (stops.length > best.length) best = stops;
}
console.log(`${line} ${from}→${to}: ${best.length}역`);
const ids = [];
for (const name of best) ids.push([name, await tago(name)]);
console.log(ids.map(([n, id]) => `${n}=${id ?? '?'}`).join(' '));
console.log(JSON.stringify(ids.map(([, id]) => id?.replace(/^MTRKRK4/, '') ?? null)));
