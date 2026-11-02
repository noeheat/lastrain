// 서울시 지하철역별 열차 시간표(OA-101) 스파이크: 요일·방향별 막차 쪽 열차 출력
// 실행: node --env-file=.env.local spike/seoul-timetable.js [역코드=0222]
const code = process.argv[2] ?? '0222';
const key = process.env.SEOUL_OPENAPI_KEY;
const DAY = { 1: '평일', 2: '토요일', 3: '휴일' };
const order = (t) => (t < '04:00:00' ? `1${t}` : `0${t}`); // 04시 이전은 전날 운행의 뒤쪽

for (const week of [1, 2, 3]) {
  for (const dir of [1, 2]) {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/SearchSTNTimeTableByIDService/1/1000/${code}/${week}/${dir}/`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => null);
    const data = body?.SearchSTNTimeTableByIDService;
    if (!data) {
      console.log(DAY[week], `방향${dir}`, 'HTTP', res.status, JSON.stringify(body?.RESULT ?? body)?.slice(0, 200));
      continue;
    }
    const rows = [...data.row].sort((a, b) => order(a.LEFTTIME).localeCompare(order(b.LEFTTIME)));
    console.log(`\n${DAY[week]} 방향${dir} 총 ${data.list_total_count}건 (받은 ${rows.length}건)`);
    for (const r of rows.slice(-6)) {
      console.log(` ${r.LEFTTIME} ${r.TRAIN_NO} ${r.SUBWAYENAME}행 (${r.DESTSTATION}) 급행:${r.EXPRESS_YN}`);
    }
  }
}
