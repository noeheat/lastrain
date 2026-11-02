// 국가철도공단(KRIC) 역사별 운행시각표 스파이크
// 실행: node --env-file=.env.local spike/kric-timetable.js <운영기관> <노선> <역코드> <요일코드>
const [railOprIsttCd = 'S1', lnCd = '2', stinCd = '222', dayCd = '8'] = process.argv.slice(2);
const qs = new URLSearchParams({ serviceKey: process.env.KRIC_SERVICE_KEY, format: 'json', railOprIsttCd, lnCd, stinCd, dayCd });
const res = await fetch(`https://openapi.kric.go.kr/openapi/convenientInfo/stationTimetable?${qs}`);
const text = await res.text();
console.log('HTTP', res.status);
let body;
try { body = JSON.parse(text); } catch { console.log(text.slice(0, 500)); process.exit(1); }
console.log('header', JSON.stringify(body.header ?? body.response?.header ?? null));
const rows = body.body ?? body.response?.body ?? [];
const list = Array.isArray(rows) ? rows : rows.items?.item ?? rows.item ?? [];
console.log('rows', Array.isArray(list) ? list.length : typeof list);
if (Array.isArray(list)) {
  console.log('first', JSON.stringify(list[0] ?? null));
  console.log('last', JSON.stringify(list.at(-1) ?? null));
} else console.log(JSON.stringify(rows).slice(0, 500));
