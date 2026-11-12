// 실시간 지하철 도착정보(OA-12764) 응답 구조 확인: 막차 여부(lstcarAt), 열차 번호, 종착역, 도착 예정 초
// 실행: node --env-file=.env.local spike/seoul-arrival.js [역이름=강남]
const station = process.argv[2] ?? '강남';
const key = process.env.SEOUL_SUBWAY_REALTIME_KEY;
if (!key) throw new Error('SEOUL_SUBWAY_REALTIME_KEY가 .env.local에 없어요');
const url = `http://swopenAPI.seoul.go.kr/api/subway/${key}/json/realtimeStationArrival/0/40/${encodeURIComponent(station)}`;
const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
const body = await res.json().catch(() => null);
console.log('HTTP', res.status, '결과', body?.errorMessage?.code, body?.errorMessage?.message, '전체', body?.errorMessage?.total);
const rows = body?.realtimeArrivalList ?? [];
if (rows[0]) console.log('필드:', Object.keys(rows[0]).join(', '));
for (const r of rows) {
  console.log([
    r.subwayId, r.updnLine, r.trainLineNm, `번호 ${r.btrainNo}`, `종착 ${r.bstatnNm}`, `급행 ${r.btrainSttus}`,
    `막차 ${r.lstcarAt}`, `도착 ${r.barvlDt}초`, `코드 ${r.arvlCd}`, r.arvlMsg2, `수신 ${r.recptnDt}`,
  ].join(' | '));
}
