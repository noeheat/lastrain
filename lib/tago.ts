// TAGO 지하철정보 API 호출 (서버 전용: 서비스 키를 쓰므로 app/api에서만 import한다)

import { hedge } from './hedge';
import { json } from './http';
import { reachingTrainList, toTrains, type Dir, type RawRow } from './reach';
import { nameVariants, normLine, sameStation, type LegTrain } from './transfer';
import type { StationRef } from './time';

const BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
const DAY = 60 * 60 * 24;
const HEDGE_MS = 2500; // 캐시 없는 정상 응답은 대부분 0.1~3초 (2026-11 측정)

export class TagoError extends Error {
  /** 잠시 후 다시 하면 나아질 수 있는 오류인지 (키 누락 같은 설정 오류는 false) */
  readonly retry: boolean;
  constructor(message: string, retry = true) {
    super(message);
    this.retry = retry;
  }
}

async function get<T>(op: string, params: Record<string, string>): Promise<T[]> {
  const key = process.env.TAGO_SERVICE_KEY;
  if (!key) throw new TagoError('서버에 TAGO_SERVICE_KEY가 설정되지 않았어요', false);
  // URLSearchParams가 인코딩하므로 Decoding 키를 그대로 넣는다
  const qs = new URLSearchParams({ serviceKey: key, _type: 'json', numOfRows: '1000', pageNo: '1', ...params });
  // 역 목록·시간표는 거의 안 바뀌므로 하루 캐시 (TAGO 일일 호출 한도 절약)
  // TAGO는 가끔 한 요청만 응답 없이 멈춘다. 2.5초 안에 답이 없으면 하나 더 보내고, 각 시도는 8초에 끊는다
  // Next는 진행 중인 같은 캐시 요청을 하나로 합치므로, 두 번째 시도는 no-store로 보내야 실제로 다시 나간다
  const res = await hedge(
    (attempt) => fetch(`${BASE}/${op}?${qs}`, {
      ...(attempt === 1 ? { next: { revalidate: DAY } } : { cache: 'no-store' as const }),
      signal: AbortSignal.timeout(8000),
    })
      .catch((e) => { console.error(`TAGO ${op} 연결 실패 (${attempt}회)`, e); throw e; }),
    HEDGE_MS,
  ).catch(() => null);
  if (!res) throw new TagoError('TAGO 시간표 서버에 연결하지 못했어요');
  const body = await res.json().catch(() => null);
  const header = body?.response?.header;
  if (!res.ok || !header) throw new TagoError(`TAGO 응답 오류 (HTTP ${res.status})`);
  if (header.resultCode !== '00') throw new TagoError(`TAGO 오류 ${header.resultCode} ${header.resultMsg}`);
  const items = body.response.body?.items?.item ?? [];
  return Array.isArray(items) ? items : [items];
}


export async function searchStations(keyword: string): Promise<StationRef[]> {
  const items = await get<{ subwayStationId?: string; subwayStationName?: string; subwayRouteName?: string }>(
    'GetKwrdFndSubwaySttnList', { subwayStationName: keyword },
  );
  return items
    .filter((s) => s.subwayStationId && s.subwayStationName)
    .map((s) => ({ id: s.subwayStationId!, name: s.subwayStationName!, line: s.subwayRouteName ?? '' }));
}

export type TimetableRow = RawRow & { subwayRouteId?: string };

export function timetable(stationId: string, daily: string, dir: Dir): Promise<TimetableRow[]> {
  return get<TimetableRow>('GetSubwaySttnAcctoSchdulList', {
    subwayStationId: stationId, dailyTypeCode: daily, upDownTypeCode: dir,
  });
}

/**
 * 출발·도착역 방향별 시간표. TAGO는 부산 말고는 토요일(02)이 비어 있어서, 그럴 땐 휴일(03) 시간표를 쓴다.
 * 서울 시간표로 서울교통공사·코레일·9호선은 토요일과 휴일 시간표가 열차까지 같음을 확인했다 (2026-11).
 * daily: 실제로 쓴 요일 코드
 */
export async function stationTimetables(originId: string, destId: string, daily: string) {
  const load = (d: string) => Promise.all([
    timetable(originId, d, 'U'), timetable(originId, d, 'D'), timetable(destId, d, 'U'), timetable(destId, d, 'D'),
  ]);
  if (daily !== '02') {
    const [oU, oD, dU, dD] = await load(daily);
    return { oU, oD, dU, dD, daily };
  }
  // 토요일이 비어 있는지 알고 나서 휴일표를 부르면 두 번 기다리므로 동시에 부른다
  const [sat, holiday] = await Promise.all([load('02'), load('03')]);
  const hasSat = sat[0].length > 0 || sat[1].length > 0;
  const [oU, oD, dU, dD] = hasSat ? sat : holiday;
  return { oU, oD, dU, dD, daily: hasSat ? '02' : '03' };
}

/** 라우트 공용: TAGO 일시 오류는 502, 설정 오류·그 밖의 예외는 500 */
export function tagoFailure(e: unknown): Response {
  console.error(e);
  if (!(e instanceof TagoError)) return json({ error: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, 500);
  return e.retry
    ? json({ error: `${e.message}. 잠시 후 다시 시도해 주세요.` }, 502)
    : json({ error: `${e.message}.` }, 500);
}

/** 환승 구간용 (1~9호선 밖 노선): 내릴 역까지 가는 열차. 도착 시각은 출발 + 카카오 소요시간으로 추정 */
export async function tagoLegTrains(
  from: string, to: string, line: string, daily: string, legMinutes: number,
): Promise<LegTrain[] | null> {
  const find = async (name: string) => {
    for (const n of nameVariants(name)) {
      const hit = (await searchStations(n)).find((s) => sameStation(s.name, name) && normLine(s.line) === normLine(line));
      if (hit) return hit.id;
    }
    return null;
  };
  const [originId, destId] = await Promise.all([find(from), find(to)]);
  if (!originId || !destId) return null;
  const { oU, oD, dU, dD, daily: used } = await stationTimetables(originId, destId, daily);
  const routeId = [...oU, ...oD].find((r) => r.subwayRouteId)?.subwayRouteId;
  if (!routeId) return null;
  const ends = (rows: TimetableRow[]) => new Set(rows.flatMap((r) => (r.endSubwayStationId ? [r.endSubwayStationId] : [])));
  const trains = reachingTrainList({
    routeId, originId, destId,
    origin: { U: toTrains(oU, originId), D: toTrains(oD, originId) },
    destEnds: { U: ends(dU), D: ends(dD) },
  });
  return trains.map((t) => ({
    dep: t.min, arr: t.min + legMinutes, endName: t.endName, estimated: true, holidayForSaturday: used !== daily,
  }));
}
