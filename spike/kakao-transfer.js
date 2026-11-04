// 스파이크: 역 이름 → 좌표(카카오 로컬 키워드 검색, 지하철역 SW8) → 대중교통 경로의 지하철 구간 형식 확인
//   node --env-file=.env.local spike/kakao-transfer.js <출발역 검색어> <도착역 검색어> [raw]
const KEY = process.env.KAKAO_REST_API_KEY;
const headers = { Authorization: `KakaoAK ${KEY}` };
const [from, to, raw] = process.argv.slice(2);

async function place(query) {
  const qs = new URLSearchParams({ query, category_group_code: 'SW8', size: '3' });
  const body = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, { headers })).json();
  const d = body.documents?.[0];
  console.log(`검색 "${query}" → ${body.documents?.map((x) => x.place_name).join(' / ')}`);
  return d;
}

const a = await place(from);
const b = await place(to);
const qs = new URLSearchParams({ start_x: a.x, start_y: a.y, end_x: b.x, end_y: b.y });
const body = await (await fetch(`https://dapi.kakao.com/v2/routing/publictraffic?${qs}`, { headers })).json();
console.log(`경로 ${body.routes?.length ?? 0}개`);
(body.routes ?? []).forEach((r, i) => {
  const p = r.properties;
  console.log(`\n${i + 1}. [${p.type}] ${Math.round(p.totalTime / 60)}분, 환승 ${p.transfers}회`);
  for (const s of r.steps) {
    const sp = s.properties;
    const stops = (sp.stops ?? []).map((x) => x.name);
    const v = (sp.vehicles ?? []).map((x) => `${x.name}/${x.type}`).join(', ');
    console.log(`  - ${sp.type} ${sp.time}초 | ${sp.guidance ?? ''} | ${v} | ${stops[0] ?? ''}→${stops.at(-1) ?? ''} (${stops.length})`);
  }
  if (raw && i === 0) {
    const sub = r.steps.find((s) => s.properties.type === 'SUBWAY');
    const { stops, ...rest } = sub.properties;
    console.log('  [raw SUBWAY]', JSON.stringify({ ...rest, stops: stops?.slice(0, 2) }).slice(0, 900));
    console.log('  [raw keys]', Object.keys(r), Object.keys(r.properties));
  }
});
