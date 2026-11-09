// 서울 버스 API 스파이크: 정류장 검색 → 정류장별 노선의 첫차·막차·막차 여부 → 노선 정보
// data.go.kr "서울특별시_정류소정보조회/버스도착정보조회/노선정보조회 서비스" (TAGO와 같은 data.go.kr 키)
// 실행: node --env-file=.env.local spike/seoul-bus.js [정류장 이름=강남역]
const name = process.argv[2] ?? '강남역';
const key = process.env.TAGO_SERVICE_KEY;
const BASE = 'http://ws.bus.go.kr/api/rest';

async function call(path, params) {
  const qs = new URLSearchParams({ serviceKey: key, resultType: 'json', ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`, { signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  try {
    const b = JSON.parse(text);
    const h = b.msgHeader ?? {};
    return { status: res.status, code: h.headerCd, msg: h.headerMsg, items: b.msgBody?.itemList ?? [] };
  } catch { return { status: res.status, raw: text.slice(0, 300) }; }
}

// 1) 정류장 이름 검색
const st = await call('stationinfo/getStationByName', { stSrch: name });
console.log('1) getStationByName', st.status, st.code, st.msg, st.raw ?? '');
console.log('   ', (st.items ?? []).slice(0, 5).map((s) => `${s.stNm}(ars ${s.arsId}, id ${s.stId})`).join(' | '));
const ars = st.items?.[0]?.arsId;
if (ars) {
  // 2) 정류장 고유번호(ars)로 그 정류장을 지나는 노선별 도착·첫차·막차
  const by = await call('stationinfo/getStationByUid', { arsId: ars });
  console.log(`2) getStationByUid ars=${ars}`, by.status, by.code, by.msg);
  if (by.items?.[0]) console.log('    fields:', Object.keys(by.items[0]).join(','));
  for (const r of (by.items ?? []).slice(0, 6)) {
    console.log(`    ${r.rtNm}(${r.routeType}) 첫차=${r.firstTm} 막차=${r.lastTm} 막차여부1=${r.isLast1} 도착1="${r.arrmsg1}" 배차=${r.term}분 방향=${r.adirection}`);
  }
  // 3) 노선 정보 (기점 첫차·막차)
  const rid = by.items?.[0]?.busRouteId;
  if (rid) {
    const ri = await call('busRouteInfo/getRouteInfo', { busRouteId: rid });
    console.log(`3) getRouteInfo ${rid}`, ri.status, ri.code, ri.msg);
    if (ri.items?.[0]) {
      const x = ri.items[0];
      console.log('    fields:', Object.keys(x).join(','));
      console.log(`    ${x.busRouteNm} ${x.stStationNm}→${x.edStationNm} 첫차=${x.firstBusTm} 막차=${x.lastBusTm} 배차=${x.term}`);
    }
  }
}
