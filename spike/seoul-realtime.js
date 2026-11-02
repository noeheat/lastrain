// 실시간 열차 위치(sample 키, 앞 5건)의 열차 번호가 시간표(OA-101)에 있는지 검증
// 실행: node --env-file=.env.local spike/seoul-realtime.js [호선=2호선]
const line = process.argv[2] ?? '2호선';
const key = process.env.SEOUL_OPENAPI_KEY;
const rt = await (await fetch(`http://swopenAPI.seoul.go.kr/api/subway/sample/json/realtimePosition/0/5/${encodeURIComponent(line)}`, { signal: AbortSignal.timeout(15000) })).json();
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const week = now.getDay() === 0 ? 3 : now.getDay() === 6 ? 2 : 1;
console.log(`지금 ${pad(now.getHours())}:${pad(now.getMinutes())}, 전체 운행 ${rt.errorMessage?.total}대, 요일코드 ${week}`);
for (const t of rt.realtimePositionList ?? []) {
  const stin = `0${t.statnId.slice(-3)}`;
  console.log(`\n실시간 ${t.trainNo} ${t.statnNm} ${t.statnTnm} 상하행:${t.updnLine} 상태:${t.trainSttus} 급행:${t.directAt} 막차:${t.lstcarAt} 수신:${t.recptnDt}`);
  const found = [];
  for (const dir of [1, 2]) {
    const b = await (await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/SearchSTNTimeTableByIDService/1/1000/${stin}/${week}/${dir}/`, { signal: AbortSignal.timeout(20000) })).json().catch(() => null);
    const rows = b?.SearchSTNTimeTableByIDService?.row ?? [];
    const norm = (s) => String(s).replace(/^0+/, '');
    const same = rows.filter((r) => norm(r.TRAIN_NO) === norm(t.trainNo) || norm(r.TRAIN_NO).slice(-3) === norm(t.trainNo).slice(-3));
    found.push(`방향${dir} ${rows.length}건: ${same.map((r) => `${r.TRAIN_NO} ${r.LEFTTIME} ${r.SUBWAYENAME}`).join(', ') || '일치 없음'}`);
    const near = rows.filter((r) => r.LEFTTIME.slice(0, 5) >= `${pad(now.getHours())}:${pad(Math.max(0, now.getMinutes() - 4))}` && r.LEFTTIME.slice(0, 5) <= `${pad(now.getHours())}:${pad(Math.min(59, now.getMinutes() + 4))}`);
    found.push(`  근처 열차: ${near.map((r) => `${r.TRAIN_NO} ${r.LEFTTIME}`).join(', ') || '없음'}`);
  }
  console.log(` 시간표(${stin}) ${found.join('\n ')}`);
}
