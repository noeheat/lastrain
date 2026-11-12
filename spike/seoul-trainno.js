// 실시간 도착(OA-12764)의 열차 번호가 시간표(OA-101) 어느 방향·어느 번호와 이어지는지 비교 (2호선 내선 번호 규칙 찾기)
// 실행: node --env-file=.env.local spike/seoul-trainno.js [역이름=강남] [호선 subwayId=1002]
const station = process.argv[2] ?? '강남';
const subwayId = process.argv[3] ?? '1002';
const rtKey = process.env.SEOUL_SUBWAY_REALTIME_KEY;
const key = process.env.SEOUL_OPENAPI_KEY;
const pad = (n) => String(n).padStart(2, '0');
const hms = (ms) => { const d = new Date(ms + 9 * 3600e3); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
const toSec = (t) => { const [h, m, s] = t.split(':').map(Number); return (h < 4 ? h + 24 : h) * 3600 + m * 60 + (s || 0); };

const rt = await (await fetch(`http://swopenAPI.seoul.go.kr/api/subway/${rtKey}/json/realtimeStationArrival/0/40/${encodeURIComponent(station)}`, { signal: AbortSignal.timeout(15000) })).json();
const rows = (rt.realtimeArrivalList ?? []).filter((r) => r.subwayId === subwayId);
if (!rows.length) throw new Error(`${station} ${subwayId} 실시간 없음`);
const stin = `0${rows[0].statnId.slice(-3)}`;
const now = new Date();
const day = new Date(now.getTime() + 9 * 3600e3).getUTCDay();
const week = day === 0 ? 3 : day === 6 ? 2 : 1;
const table = {};
for (const dir of [1, 2]) {
  const b = await (await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/SearchSTNTimeTableByIDService/1/1000/${stin}/${week}/${dir}/`, { signal: AbortSignal.timeout(20000) })).json();
  table[dir] = b?.SearchSTNTimeTableByIDService?.row ?? [];
}
console.log(`${station}(${stin}) 요일코드 ${week}, 지금 ${hms(now.getTime())}, 시간표 방향1 ${table[1].length}건 방향2 ${table[2].length}건`);
console.log('방향별 시간표 번호 예:', [1, 2].map((d) => `방향${d}: ${table[d].slice(100, 104).map((r) => `${r.TRAIN_NO}→${r.SUBWAYENAME}`).join(' ')}`).join(' / '));
const norm = (s) => String(s).replace(/^0+/, '');
for (const r of rows) {
  const recptn = Date.parse(`${r.recptnDt.replace(' ', 'T')}+09:00`);
  const eta = recptn + Number(r.barvlDt || 0) * 1000;
  console.log(`\n실시간 ${r.updnLine} ${r.btrainNo} →${r.bstatnNm} 코드${r.arvlCd} ${r.arvlMsg2} 예상 ${hms(eta)} (수신 ${r.recptnDt.slice(11)})`);
  for (const dir of [1, 2]) {
    const same = table[dir].filter((t) => norm(t.TRAIN_NO) === norm(r.btrainNo));
    const tail = table[dir].filter((t) => norm(t.TRAIN_NO) !== norm(r.btrainNo) && norm(t.TRAIN_NO).slice(-3) === norm(r.btrainNo).slice(-3));
    const near = table[dir].filter((t) => Math.abs(toSec(t.ARRIVETIME === '00:00:00' ? t.LEFTTIME : t.ARRIVETIME) - toSec(hms(eta))) <= 8 * 60);
    console.log(`  방향${dir} 같은 번호: ${same.map((t) => `${t.TRAIN_NO} ${t.LEFTTIME}→${t.SUBWAYENAME}`).join(', ') || '없음'}`);
    console.log(`         뒤 3자리 같음: ${tail.map((t) => `${t.TRAIN_NO} ${t.LEFTTIME}→${t.SUBWAYENAME}`).join(', ') || '없음'}`);
    console.log(`         예상 ±8분: ${near.map((t) => `${t.TRAIN_NO} ${t.LEFTTIME}→${t.SUBWAYENAME}`).join(', ') || '없음'}`);
  }
}
