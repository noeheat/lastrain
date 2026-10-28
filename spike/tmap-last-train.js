// 스파이크: TMAP 대중교통 API로 "막차 출발 시각"을 구할 수 있는지 검증
//
// 단일 조회(응답 구조 확인):
//   node --env-file=.env.local spike/tmap-last-train.js at 2330 <출발경도> <출발위도> <도착경도> <도착위도>
// 막차 탐색(이분 탐색):
//   node --env-file=.env.local spike/tmap-last-train.js last <출발경도> <출발위도> <도착경도> <도착위도>
//
// 날짜는 SPIKE_DATE=yyyymmdd 로 지정(기본: 오늘). 00:00~03:59는 다음 날로 계산한다.
// 그 밖의 옵션(SPIKE_LO, SPIKE_HI, SPIKE_MAX_CALLS, SPIKE_SUBWAY_ONLY)은 아래 last() 근처 주석 참고.

const KEY = process.env.TMAP_APP_KEY;
if (!KEY) {
  console.error('TMAP_APP_KEY가 없습니다. .env.local에 넣고 --env-file=.env.local로 실행하세요.');
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
const BASE = process.env.SPIKE_DATE ?? `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
let calls = 0;

/** 운행일 기준 분(22:00 = 1320, 다음 날 01:00 = 1500) → yyyymmddhhmi */
function dttm(min) {
  const d = new Date(+BASE.slice(0, 4), +BASE.slice(4, 6) - 1, +BASE.slice(6, 8), 0, min);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}
const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

async function search(min, [sx, sy, ex, ey]) {
  calls += 1;
  const res = await fetch('https://apis.openapi.sk.com/transit/routes', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', appKey: KEY },
    body: JSON.stringify({ startX: sx, startY: sy, endX: ex, endY: ey, count: 10, lang: 0, format: 'json', searchDttm: dttm(min) }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// SPIKE_SUBWAY_ONLY=1: 지하철만 쓰는 경로로 한정 (심야버스는 밤새 다녀서 막차 검증을 흐림)
const SUBWAY_ONLY = process.env.SPIKE_SUBWAY_ONLY === '1';

/** 모든 대중교통 구간이 운행 중(service === 1)인 경로만 */
function liveItineraries(body) {
  const list = body?.metaData?.plan?.itineraries ?? [];
  return list.filter((it) => it.legs.every((leg) =>
    leg.mode === 'WALK' || (leg.service === 1 && (!SUBWAY_ONLY || leg.mode === 'SUBWAY'))));
}

function describe(it) {
  return it.legs
    .filter((l) => l.mode !== 'WALK')
    .map((l) => `${l.route ?? l.mode}(service=${l.service})`)
    .join(' → ') + ` / ${Math.round(it.totalTime / 60)}분`;
}

async function at(min, coords) {
  const body = await search(min, coords);
  const all = body?.metaData?.plan?.itineraries ?? [];
  console.log(`[${hhmm(min)} 출발] 경로 ${all.length}개, 운행 중 ${liveItineraries(body).length}개`);
  if (!all.length) console.log('  응답:', JSON.stringify(body).slice(0, 300));
  all.forEach((it, i) => console.log(`  ${i + 1}. ${describe(it)}`));
  return liveItineraries(body);
}

// 경로(노선 조합)별로 운행 중이었던 가장 늦은 조회 시각
const lastSeen = new Map();
function record(min, live) {
  for (const it of live) {
    const sig = it.legs.filter((l) => l.mode !== 'WALK').map((l) => l.route ?? l.mode).join(' → ');
    if (!lastSeen.has(sig) || lastSeen.get(sig) < min) lastSeen.set(sig, min);
  }
}

// SPIKE_LO/SPIKE_HI(HHMM): 이미 "갈 수 있음/못 감"을 아는 시각이면 경계 확인 호출을 생략
// SPIKE_MAX_CALLS: 무료 한도 보호용 호출 상한
const toMin = (s) => { let m = +s.slice(0, 2) * 60 + +s.slice(2, 4); if (m < 4 * 60) m += 24 * 60; return m; };

async function last(coords) {
  const trusted = Boolean(process.env.SPIKE_LO && process.env.SPIKE_HI);
  let lo = process.env.SPIKE_LO ? toMin(process.env.SPIKE_LO) : 22 * 60; // 갈 수 있어야 함
  let hi = process.env.SPIKE_HI ? toMin(process.env.SPIKE_HI) : 26 * 60; // 못 가야 함
  const max = Number(process.env.SPIKE_MAX_CALLS ?? Infinity);

  if (!trusted) {
    if (!(await at(lo, coords)).length) return console.log(`${hhmm(lo)}에도 운행 중 경로가 없어 탐색 중단`);
    if ((await at(hi, coords)).length) return console.log(`${hhmm(hi)}에도 운행 중 경로가 있어 service 값이 기대와 다름`);
  }

  while (hi - lo > 1 && calls < max) {
    const mid = Math.floor((lo + hi) / 2);
    const live = await at(mid, coords);
    record(mid, live);
    if (live.length) lo = mid;
    else hi = mid;
  }
  console.log(`\n▶ 마지막 출발 가능 시각: ${hhmm(lo)} ~ ${hhmm(hi - 1)} 사이 (API 호출 ${calls}회)`);
  console.log('경로별 운행 중으로 확인된 가장 늦은 조회 시각:');
  [...lastSeen].sort((a, b) => b[1] - a[1]).forEach(([sig, m]) => console.log(`  ${hhmm(m)}  ${sig}`));
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'at' && rest.length === 5) {
    const [t, ...coords] = rest;
    let min = +t.slice(0, 2) * 60 + +t.slice(2, 4);
    if (min < 4 * 60) min += 24 * 60;
    await at(min, coords);
    console.log(`(API 호출 ${calls}회)`);
  } else if (mode === 'last' && rest.length === 4) {
    await last(rest);
  } else {
    console.error('사용법은 파일 맨 위 주석을 보세요.');
    process.exit(1);
  }
} catch (e) {
  console.error('실패:', e.message, `(API 호출 ${calls}회)`);
  process.exit(1);
}
