// 스파이크: 카카오 대중교통 경로 API가 막차 계산용 "경로 구조"를 주는지 검증
// (타는 역, 노선, 내릴 역, 중간 정류장 목록, 도보 시간)
//
//   node --env-file=.env.local spike/kakao-route.js <출발경도> <출발위도> <도착경도> <도착위도>

const KEY = process.env.KAKAO_REST_API_KEY;
if (!KEY) {
  console.error('KAKAO_REST_API_KEY가 없습니다. .env.local에 넣고 --env-file=.env.local로 실행하세요.');
  process.exit(1);
}

const [sx, sy, ex, ey] = process.argv.slice(2);
if (!ey) {
  console.error('사용법은 파일 맨 위 주석을 보세요.');
  process.exit(1);
}

const qs = new URLSearchParams({ start_x: sx, start_y: sy, end_x: ex, end_y: ey });
const res = await fetch(`https://dapi.kakao.com/v2/routing/publictraffic?${qs}`, {
  headers: { Authorization: `KakaoAK ${KEY}` },
});
const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error(`실패: HTTP ${res.status}`, JSON.stringify(body));
  process.exit(1);
}

console.log(`status=${body.status}, 경로 ${body.routes?.length ?? 0}개`, JSON.stringify(body.properties ?? {}));
(body.routes ?? []).forEach((r, i) => {
  const p = r.properties;
  console.log(`\n${i + 1}. [${p.type}] ${Math.round(p.totalTime / 60)}분, 환승 ${p.transfers}회`);
  for (const s of r.steps) {
    const sp = s.properties;
    const stops = (sp.stops ?? []).map((x) => x.name);
    const vehicles = (sp.vehicles ?? []).map((v) => `${v.name}(${v.type})`).join(', ');
    console.log(`   - ${sp.type} ${Math.round(sp.time / 60)}분 | ${sp.guidance ?? ''}${vehicles ? ` | ${vehicles}` : ''}`);
    if (stops.length) console.log(`     정류장 ${stops.length}개: ${stops.join(' > ')}`);
  }
});
