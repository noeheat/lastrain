// 막차 시간대 실시간 도착(OA-12764) 기록: 막차 표시(lstcarAt)·열차 번호·수신 시각·남은 초를 1분마다 JSONL로 남긴다
// 다음 날 시간표 막차와 비교해 ① 막차가 lstcarAt=1을 달고 오는지 ② 열차 번호가 이어지는지 ③ 수신 시각 보정이 맞는지 본다
// 실행: node --env-file=.env.local spike/subway-night-log.js [끝 시각=01:10] [역,역,...=강남,사당,고속터미널,여의도]
// 결과: spike/out/night-YYYY-MM-DD.jsonl (커밋하지 않음). 한 줄 = 한 번 받은 열차 한 대
import { appendFileSync, mkdirSync } from 'node:fs';

const until = process.argv[2] ?? '01:10';
const stations = (process.argv[3] ?? '강남,사당,고속터미널,여의도').split(',');
const key = process.env.SEOUL_SUBWAY_REALTIME_KEY;
if (!key) throw new Error('SEOUL_SUBWAY_REALTIME_KEY가 .env.local에 없어요');

const pad = (n) => String(n).padStart(2, '0');
const seoul = (ms = Date.now()) => new Date(ms + 9 * 3600e3); // UTC 메서드로 읽으면 서울 시각
const hm = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
// 운행일 경계 04:00: 04시 전은 전날 24시 이후로 센다
const minOfDay = (h, m) => (h < 4 ? h + 24 : h) * 60 + m;
const [uh, um] = until.split(':').map(Number);
const endMin = minOfDay(uh, um);
const nowMin = () => { const d = seoul(); return minOfDay(d.getUTCHours(), d.getUTCMinutes()); };

const start = seoul();
const serviceDay = seoul(Date.now() - (start.getUTCHours() < 4 ? 86400e3 : 0)).toISOString().slice(0, 10);
mkdirSync('spike/out', { recursive: true });
const file = `spike/out/night-${serviceDay}.jsonl`;
console.log(`${hm(start)} 시작, ${until}까지 1분마다 ${stations.join('·')} → ${file}`);

const seenLast = new Set();
while (nowMin() <= endMin) {
  const at = new Date().toISOString();
  for (const st of stations) {
    try {
      const url = `http://swopenAPI.seoul.go.kr/api/subway/${key}/json/realtimeStationArrival/0/40/${encodeURIComponent(st)}`;
      const body = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
      const rows = body?.realtimeArrivalList ?? [];
      if (!rows.length) console.log(`${hm(seoul())} ${st}: 없음 (${body?.errorMessage?.code ?? body?.code} ${body?.errorMessage?.message ?? body?.message ?? ''})`);
      for (const r of rows) {
        appendFileSync(file, `${JSON.stringify({
          at, station: st, subwayId: r.subwayId, updnLine: r.updnLine, trainLineNm: r.trainLineNm,
          btrainNo: r.btrainNo, bstatnNm: r.bstatnNm, btrainSttus: r.btrainSttus, lstcarAt: r.lstcarAt,
          barvlDt: r.barvlDt, arvlCd: r.arvlCd, arvlMsg2: r.arvlMsg2, recptnDt: r.recptnDt, statnId: r.statnId,
        })}\n`);
        const id = `${st} ${r.subwayId} ${r.updnLine} ${r.btrainNo}`;
        if (r.lstcarAt === '1' && !seenLast.has(id)) {
          seenLast.add(id);
          console.log(`${hm(seoul())} 막차 표시: ${id} →${r.bstatnNm} ${r.arvlMsg2} (수신 ${r.recptnDt?.slice(11)})`);
        }
      }
    } catch (e) {
      console.log(`${hm(seoul())} ${st} 실패: ${e.message}`);
    }
  }
  await new Promise((r) => setTimeout(r, 60_000));
}
console.log(`${hm(seoul())} 끝. 막차 표시 ${seenLast.size}대`);
