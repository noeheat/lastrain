// 스파이크: 국토교통부 TAGO 지하철 시간표로 막차(자정 이후 포함)를 확인할 수 있는지 검증
//
// 역 검색:
//   node --env-file=.env.local spike/tago-timetable.js find 강남
// 시간표 끝부분(막차 쪽) 보기:
//   node --env-file=.env.local spike/tago-timetable.js tt <역ID> [요일 01평일|02토|03일] [U상행|D하행]
//
// 응답 필드 이름을 아직 모르므로, 원본 항목을 그대로 출력해 눈으로 확인한다.

const KEY = process.env.TAGO_SERVICE_KEY;
if (!KEY) {
  console.error('TAGO_SERVICE_KEY가 없습니다. .env.local에 Decoding 키를 넣고 --env-file=.env.local로 실행하세요.');
  process.exit(1);
}

const BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
let calls = 0;

async function get(op, params) {
  calls += 1;
  // URLSearchParams가 인코딩하므로 Decoding 키를 그대로 넣는다
  const qs = new URLSearchParams({ serviceKey: KEY, _type: 'json', numOfRows: '1000', pageNo: '1', ...params });
  const res = await fetch(`${BASE}/${op}?${qs}`);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`JSON 아님 (HTTP ${res.status}): ${text.slice(0, 300)}`); }
  const header = body?.response?.header;
  if (header && header.resultCode !== '00') throw new Error(`${header.resultCode} ${header.resultMsg}`);
  const items = body?.response?.body?.items?.item ?? [];
  return { items: Array.isArray(items) ? items : [items], total: body?.response?.body?.totalCount };
}

/** "HHMMSS" 또는 "HHMM" → 운행일 기준 분 (04:00 이전은 +24h) */
function toMin(t) {
  const s = String(t ?? '').padStart(4, '0');
  let m = +s.slice(0, 2) * 60 + +s.slice(2, 4);
  if (Number.isNaN(m)) return null;
  if (m < 4 * 60) m += 24 * 60;
  return m;
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'find' && rest[0]) {
    const { items } = await get('GetKwrdFndSubwaySttnList', { subwayStationName: rest[0] });
    console.log(`역 ${items.length}개`);
    items.forEach((it) => console.log(' ', JSON.stringify(it)));
  } else if (mode === 'tt' && rest[0]) {
    const [id, daily = '01', updown = 'U'] = rest;
    const { items, total } = await get('GetSubwaySttnAcctoSchdulList', {
      subwayStationId: id, dailyTypeCode: daily, upDownTypeCode: updown,
    });
    console.log(`시간표 ${items.length}건 (totalCount ${total})`);
    if (items[0]) console.log('필드:', Object.keys(items[0]).join(', '));
    // 출발 시각 후보 필드 중 있는 것으로 정렬
    const timeKey = ['depTime', 'arrTime'].find((k) => items[0] && k in items[0]);
    if (timeKey) {
      items.sort((a, b) => toMin(a[timeKey]) - toMin(b[timeKey]));
      console.log(`\n${timeKey} 기준 마지막 6건 (자정 이후는 24시+로 정렬):`);
      items.slice(-6).forEach((it) => console.log(' ', JSON.stringify(it)));
    } else {
      console.log('\n시각 필드를 못 찾아 앞 3건만 출력:');
      items.slice(0, 3).forEach((it) => console.log(' ', JSON.stringify(it)));
    }
  } else {
    console.error('사용법은 파일 맨 위 주석을 보세요.');
    process.exit(1);
  }
  console.log(`(API 호출 ${calls}회)`);
} catch (e) {
  console.error('실패:', e.message, `(API 호출 ${calls}회)`);
  process.exit(1);
}
