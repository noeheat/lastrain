// 서울 지하철 실시간 도착정보 조회 (서버 전용: 실시간 지하철 인증키 SEOUL_SUBWAY_REALTIME_KEY)
// 일반 인증키(SEOUL_OPENAPI_KEY)로는 ERROR-338이 난다. 키는 서울 열린데이터광장에서 "실시간 지하철"로 따로 받는다

import { nameVariants } from './transfer';
import { parseArrivals, type Arrival, type ArrivalRow } from './seoulArrival';

const TTL_MS = 30_000; // 같은 역은 30초 안에 다시 부르지 않는다 (막차 시간대에 카운트다운이 25초~1분마다 부른다)
const cache = new Map<string, { at: number; rows: ArrivalRow[] }>();

type Body = {
  errorMessage?: { code?: string; message?: string };
  code?: string; // 오류일 때는 최상위에 온다
  message?: string;
  realtimeArrivalList?: ArrivalRow[];
};

async function fetchStation(name: string): Promise<ArrivalRow[]> {
  const key = process.env.SEOUL_SUBWAY_REALTIME_KEY;
  if (!key) throw new Error('SEOUL_SUBWAY_REALTIME_KEY가 없어요');
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const url = `http://swopenAPI.seoul.go.kr/api/subway/${key}/json/realtimeStationArrival/0/40/${encodeURIComponent(name)}`;
  // 실시간이라 Next 캐시에 두지 않는다 (오류 응답이 캐시되는 것도 막는다). 같은 역은 위 메모리 캐시로 30초
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  const body = (await res.json().catch(() => null)) as Body | null;
  const code = body?.errorMessage?.code ?? body?.code;
  if (!res.ok || !body) throw new Error(`지하철 실시간 HTTP ${res.status}`);
  if (code === 'INFO-200') return remember(name, []); // 해당하는 데이터가 없음 (역 이름이 다르거나 운행 종료)
  if (code !== 'INFO-000') throw new Error(`지하철 실시간 ${code ?? '응답 없음'} ${body.errorMessage?.message ?? body.message ?? ''}`);
  return remember(name, body.realtimeArrivalList ?? []);
}

function remember(name: string, rows: ArrivalRow[]): ArrivalRow[] {
  cache.set(name, { at: Date.now(), rows });
  return rows;
}

/** 역 이름으로 실시간 도착 (1~9호선만). 이름 표기가 달라도 찾도록 후보(괄호 앞뒤, '역' 뗀 이름)를 차례로 */
export async function stationArrivals(station: string): Promise<Arrival[]> {
  for (const name of nameVariants(station)) {
    const rows = await fetchStation(name);
    if (rows.length) return parseArrivals(rows, Date.now());
  }
  return [];
}
