// 서울 버스 막차 (DOM·네트워크 없음, 서버·테스트 공용)
//
// 버스는 정류장마다 정해진 시간표가 없어서, 서울 버스 API의 "노선별 경유 정류장"(getStaionByRoute)이 주는
// 정류장별 막차 예정 시각(lastTm)을 쓴다. 정류장 API의 lastTm은 기점 막차라 쓰면 안 된다.
// 카카오 경로의 버스 구간(노선 번호·탈/내릴 정류장 이름)을 이 정류장 목록에 맞춘다.
// 맞출 수 없거나 이상한 값이면 버린다 ("모르면 안 간다").

import type { KakaoBody, LegTrain } from './transfer';
import { DAY_START_MIN } from './time';

/** 카카오 경로에서 버스를 한 번만 타는 구간 (앞뒤 걷기만 있고 지하철·다른 버스는 없음) */
export type BusLeg = {
  names: string[]; // 이 구간을 지나는 노선들 ("640", "N26")
  from: string; // 탈 정류장 (카카오 표기)
  to: string; // 내릴 정류장
  minutes: number; // 카카오 소요시간
};

/** 서울 버스 API 노선별 경유 정류장의 쓰는 필드 */
export type BusStop = { seq: string; stationNm: string; arsId?: string; beginTm?: string; lastTm?: string; direction?: string };

/** 막차로 볼 수 있는 가장 이른 시각. 출근·주간 노선(막차 09:45 등)을 거른다 */
const EARLIEST_LAST_MIN = 20 * 60;
const MAX_RIDE_MIN = 180;

/** "N26(심야)" → "N26". 출근·공휴일제외·새벽 노선처럼 막차 판단에 쓸 수 없는 노선이면 null */
export function busName(raw: string): string | null {
  const t = raw.trim();
  if (!t || /^새벽/.test(t) || /\((출근|퇴근|공휴일제외|공휴일|맞춤)\)$/.test(t)) return null;
  return t.replace(/\(심야\)$/, '');
}

/** 정류장 이름 비교용: 중앙차로 "(중)", 승강장 "(7번승강장)", 공백·점 차이를 없앤다 */
export function normStop(name: string): string {
  return name.replace(/\((중|\d+번승강장)\)/g, '').replace(/[\s.·]/g, '');
}

/** "23:58" → 운행일 기준 분 ("01:08"은 +24h). 비었거나(":") 형식이 다르면 null */
export function parseBusTime(t: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? '').trim());
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return min < DAY_START_MIN ? min + 24 * 60 : min;
}

/** 카카오 경로 → 버스 한 번만 타는 구간 (같은 노선 묶음·정류장 조합은 하나만) */
export function busOnlyLegs(body: KakaoBody): BusLeg[] {
  const out: BusLeg[] = [];
  const seen = new Set<string>();
  for (const route of body.routes ?? []) {
    const steps = route.steps ?? [];
    const buses = steps.filter((s) => s.properties?.type === 'BUS');
    if (buses.length !== 1 || steps.some((s) => !['BUS', 'WALKING'].includes(s.properties?.type ?? ''))) continue;
    const p = buses[0]!.properties!;
    const from = p.stops?.[0]?.name;
    const to = p.stops?.at(-1)?.name;
    const names = (p.vehicles ?? []).flatMap((v) => (v.name ? [v.name] : []));
    if (!from || !to || names.length === 0) continue;
    const key = `${names.join(',')}|${from}>${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ names, from, to, minutes: Math.ceil((p.time ?? 0) / 60) });
  }
  return out;
}

/**
 * 노선 정류장 목록에서 탈 곳·내릴 곳 (내릴 곳은 탈 곳보다 뒤). 같은 정류장을 두 번 지나는 노선은 가장 가까운 쌍.
 * 막차 시각이 없거나 주간 노선이면 null.
 * 정류장별 막차는 정류장마다 따로 계산된 값이라, 심야버스처럼 오가는 노선은 내릴 곳 막차가 탈 곳보다 이른 경우가 있다
 * (N73 신촌 02:53 → 잠실 02:44). 그때는 "내릴 곳 막차 − 소요시간"을 탈 곳 막차로 보고 estimated로 표시한다 (이른 쪽이 안전).
 */
export function matchStops(
  stops: BusStop[], from: string, to: string, legMinutes: number,
): { board: BusStop; alight: BusStop; dep: number; arr: number; estimated: boolean; first: number | null } | null {
  const f = normStop(from);
  const t = normStop(to);
  let best: { i: number; j: number } | null = null;
  stops.forEach((s, i) => {
    if (normStop(s.stationNm) !== f) return;
    const j = stops.findIndex((x, k) => k > i && normStop(x.stationNm) === t);
    if (j > i && (!best || j - i < best.j - best.i)) best = { i, j };
  });
  if (!best) return null;
  const { i, j } = best;
  const board = stops[i]!;
  const alight = stops[j]!;
  const boardLast = parseBusTime(board.lastTm);
  const arr = parseBusTime(alight.lastTm);
  if (boardLast == null || arr == null) return null;
  const estimated = arr < boardLast;
  const dep = estimated ? arr - legMinutes : boardLast;
  if (dep < EARLIEST_LAST_MIN || arr - dep > MAX_RIDE_MIN) return null;
  return { board, alight, dep, arr, estimated, first: parseBusTime(board.beginTm) }; // first: 탈 정류장 첫차
}

const BUS_WINDOW_MIN = 120; // 막차 전 몇 분 안의 버스까지 만들지 (환승 역산에 쓰는 범위)

/**
 * 버스 구간 열차 목록(환승 역산용). 버스는 시간표가 없어서 정류장별 막차와 배차 간격으로 그 전 버스들을 만든다 (첫차 전은 빼고).
 * 도착 시각은 막차의 소요시간을 그대로 쓰는 추정이라 estimated(환승 여유가 붙는다). 배차를 모르면 막차만.
 */
export function busTrains(
  last: { dep: number; arr: number; first?: number | null }, termMin: number, line: string,
  ids: { arsId?: string; routeId?: string } = {},
): LegTrain[] {
  const ride = last.arr - last.dep;
  const step = Number.isFinite(termMin) && termMin > 0 ? termMin : Infinity;
  // 탈 정류장 첫차보다 이른 버스는 만들지 않는다 (23:58에 시작하는 심야버스에 22시대 버스가 생기지 않게)
  const from = Math.max(last.dep - BUS_WINDOW_MIN, last.first != null && last.first <= last.dep ? last.first : -Infinity);
  const out: LegTrain[] = [];
  for (let dep = last.dep; dep >= from; dep -= step) {
    out.unshift({ dep, arr: dep + ride, endName: '', estimated: true, line, ...ids });
    if (step === Infinity) break;
  }
  return out;
}

/** 정류장 실시간 도착 (서울 버스 getStationByUid의 한 노선) */
export type BusLive =
  | { status: 'ended' } // 오늘 운행이 끝남
  | { status: 'waiting' } // 차고지 출발 대기
  | { status: 'running'; buses: { msg: string; sec: number; last: boolean }[] }; // 다가오는 버스 (최대 2대)

export type LiveItem = {
  arrmsg1?: string; arrmsg2?: string; traTime1?: string; traTime2?: string; isLast1?: string; isLast2?: string;
};

/** 실시간 도착 응답 → 화면용. arrmsg "운행종료"·"출발대기"는 상태로, 나머지는 메시지·남은 초·막차 여부 */
export function parseBusLive(item: LiveItem | undefined): BusLive | null {
  if (!item) return null;
  const pairs = [
    { msg: item.arrmsg1, sec: item.traTime1, last: item.isLast1 },
    { msg: item.arrmsg2, sec: item.traTime2, last: item.isLast2 },
  ];
  const first = pairs[0]!.msg?.trim() ?? '';
  if (first.includes('운행종료')) return { status: 'ended' };
  if (first.includes('출발대기')) return { status: 'waiting' };
  const buses = pairs
    .filter((p) => p.msg && !/운행종료|출발대기/.test(p.msg))
    .map((p) => ({ msg: p.msg!.trim(), sec: Number(p.sec) || 0, last: p.last === '1' }));
  return { status: 'running', buses };
}
