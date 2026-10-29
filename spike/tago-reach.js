// 스파이크: 역 순서 데이터 없이, 출발역·도착역 시간표 두 개만으로
// "도착역까지 가는 막차"를 계산할 수 있는지 검증
//
//   node --env-file=.env.local spike/tago-reach.js <출발역ID> <도착역ID> [요일 01평일|02토|03일]
//
// 방법: 같은 방향·같은 종착역 열차가 출발역 t분, 도착역 t+R분에 찍히면 그 열차는 도착역을 지난다.
// 소요시간 R은 (같은 종착역, 바로 다음 도착역 시각) 시간차의 최빈값으로 추정한다.

const KEY = process.env.TAGO_SERVICE_KEY;
if (!KEY) {
  console.error('TAGO_SERVICE_KEY가 없습니다. .env.local에 Decoding 키를 넣고 --env-file=.env.local로 실행하세요.');
  process.exit(1);
}

const BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
let calls = 0;

async function timetable(id, daily, updown) {
  calls += 1;
  const qs = new URLSearchParams({
    serviceKey: KEY, _type: 'json', numOfRows: '1000', pageNo: '1',
    subwayStationId: id, dailyTypeCode: daily, upDownTypeCode: updown,
  });
  const body = await (await fetch(`${BASE}/GetSubwaySttnAcctoSchdulList?${qs}`)).json();
  const header = body?.response?.header;
  if (header && header.resultCode !== '00') throw new Error(`${header.resultCode} ${header.resultMsg}`);
  const items = body?.response?.body?.items?.item ?? [];
  return (Array.isArray(items) ? items : [items])
    .map((it) => ({ t: toMin(it.depTime || it.arrTime), end: it.endSubwayStationId, endNm: it.endSubwayStationNm, raw: it }))
    .filter((x) => x.t != null)
    .sort((a, b) => a.t - b.t);
}

/** "HHMMSS" → 운행일 기준 분(소수, 04:00 이전은 +24h) */
function toMin(t) {
  const s = String(t ?? '');
  if (!/^\d{6}$/.test(s)) return null;
  let m = +s.slice(0, 2) * 60 + +s.slice(2, 4) + +s.slice(4, 6) / 60;
  if (m < 4 * 60) m += 24 * 60;
  return m;
}

const hhmm = (m) => {
  const x = Math.floor(m) % (24 * 60);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

function analyze(origin, dest, destId) {
  // 1) 소요시간 추정: 같은 종착역의 모든 (출발역, 도착역) 쌍의 시간차.
  //    "바로 다음" 열차만 보면 배차 간격(3~5분)에 걸려 앞차와 짝지어진다.
  //    진짜 소요시간은 열차마다 반복되고, 나머지는 배차 간격이 바뀌며 흩어진다.
  const counts = new Map();
  for (const o of origin) {
    for (const d of dest) {
      if (d.end !== o.end) continue;
      const r = Math.round(d.t - o.t);
      if (r > 0 && r < 180) counts.set(r, (counts.get(r) ?? 0) + 1);
    }
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [R, votes] = ranked[0];

  // 2) 도착역을 지나는 열차 판정 (±2분), 도착역이 종착인 열차는 바로 인정
  const TOL = 2;
  const reach = origin.filter(
    (o) => o.end === destId || dest.some((d) => d.end === o.end && Math.abs(d.t - o.t - R) <= TOL),
  );
  return { R, votes, total: origin.length, reach, ranked: ranked.slice(0, 4) };
}

const [originId, destId, daily = '01'] = process.argv.slice(2);
if (!destId) {
  console.error('사용법은 파일 맨 위 주석을 보세요.');
  process.exit(1);
}

try {
  for (const ud of ['U', 'D']) {
    const [o, d] = await Promise.all([timetable(originId, daily, ud), timetable(destId, daily, ud)]);
    const a = analyze(o, d, destId);
    console.log(`\n[${ud}] 출발역 ${o.length}건, 도착역 ${d.length}건`);
    if (!a) { console.log('  일치하는 열차 없음 → 이 방향으로는 못 감'); continue; }
    console.log(`  소요시간 추정 ${a.R}분 (득표 ${a.votes}/${a.total}, 상위 ${JSON.stringify(a.ranked)})`);
    console.log(`  도착역까지 가는 열차 ${a.reach.length}/${a.total}`);
    console.log('  마지막 4대:', a.reach.slice(-4).map((x) => `${hhmm(x.t)} ${x.endNm}행`).join(' · '));
    const lastAll = o.at(-1);
    console.log(`  (참고: 이 방향 전체 막차 ${hhmm(lastAll.t)} ${lastAll.endNm}행)`);
  }
  console.log(`\n(API 호출 ${calls}회)`);
} catch (e) {
  console.error('실패:', e.message, `(API 호출 ${calls}회)`);
  process.exit(1);
}
