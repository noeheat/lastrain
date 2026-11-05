// 막차 계산 검증용 사례: 틀리기 쉬운 경우(노선 끝·지선·순환·급행·자정 이후·TAGO 노선·환승)를 앱 API로 계산해 출력한다.
// 결과는 공식 시간표(서울교통공사 사이버스테이션 등)와 손으로 대조한다. docs/progress.md 5번 참고.
// 실행: 앱 서버를 띄운 뒤 node spike/last-train-cases.js [BASE=http://localhost:3001] [요일=01,02]
const BASE = process.argv[2] ?? 'http://localhost:3001';
const DAYS = (process.argv[3] ?? '01,02').split(',');
const LABEL = { '01': '평일', '02': '토', '03': '휴일' };

// [분류, 노선(TAGO 표기), 출발역, 도착역]
const SAME_LINE = [
  ['노선 끝(차고지)', '4호선', '회현', '불암산'],
  ['노선 끝', '3호선', '교대', '대화'],
  ['노선 끝(중간 회차)', '7호선', '강남구청', '장암'],
  ['순환', '2호선', '강남', '시청'],
  ['순환(반대쪽)', '2호선', '홍대입구', '잠실'],
  ['지선(신정)', '2호선', '신도림', '까치산'],
  ['지선(성수)', '2호선', '성수', '신설동'],
  ['분기(마천)', '5호선', '군자', '마천'],
  ['분기(하남)', '5호선', '군자', '하남검단산'],
  ['분기(인천)', '1호선', '구로', '인천'],
  ['분기(경부)', '1호선', '구로', '병점'],
  ['급행 혼합(일반역)', '9호선', '신논현', '신목동'],
  ['급행 혼합(급행역)', '9호선', '신논현', '김포공항'],
  ['TAGO', '신분당', '강남', '광교'],
  ['TAGO', '수인분당', '왕십리', '죽전'],
  ['TAGO', '공항', '서울역', '인천공항2터미널'],
];
// [분류, 출발역, 도착역] (환승)
const TRANSFER = [
  ['4→2호선', '서울역', '잠실'],
  ['9→신분당', '김포공항', '정자'],
  ['2→신분당', '역삼', '정자'],
];

const get = async (path, params) => {
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(30000) });
  return res.json();
};
const norm = (s) => s.replace(/(선|철도)$/, '');
const station = async (name, line) => {
  const { stations = [] } = await get('/api/stations', { q: name });
  return stations.find((s) => (s.name === name || s.name === `${name}역` || s.name.startsWith(`${name}(`)) && norm(s.line) === norm(line));
};

for (const daily of DAYS) {
  console.log(`\n=== ${LABEL[daily]} (${daily}) ===`);
  for (const [kind, line, from, to] of SAME_LINE) {
    const [o, d] = await Promise.all([station(from, line), station(to, line)]);
    if (!o || !d) { console.log(`${kind.padEnd(12)} ${line} ${from}→${to}: 역을 못 찾음`); continue; }
    const r = await get('/api/last-train', {
      origin: o.id, dest: d.id, daily, originName: o.name, destName: d.name, line: o.line,
    });
    const src = r.last ? (/^\d+$/.test(r.last.endId) ? '서울' : 'TAGO') : '';
    const used = r.daily && r.daily !== daily ? ` (${LABEL[r.daily]}표)` : '';
    console.log(`${kind.padEnd(12)} ${line} ${from}→${to}: ${r.last ? `${r.last.time} ${r.last.endName}행 ${r.last.dir} [${src}]${used}` : `없음 ${r.error ?? ''}`}`);
  }
  for (const [kind, from, to] of TRANSFER) {
    const r = await get('/api/plan', { origin: from, dest: to, daily });
    const legs = r.plan?.legs.map((l) => `${l.line} ${l.from} ${l.dep}→${l.to} ${l.arr}${l.estimated ? '(추정)' : ''} ${l.endName}행`).join(' / ');
    console.log(`환승 ${kind.padEnd(8)} ${from}→${to}: ${r.plan ? `${r.plan.depart} 출발 | ${legs}` : `없음 ${JSON.stringify(r.reasons ?? r.error)}`}`);
  }
}
