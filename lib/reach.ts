// 도착역까지 가는 막차 판정 (DOM·네트워크 없음, 서버·테스트 공용)
//
// TAGO 역 ID = 노선 ID + 역 번호 (예: MTRS12 + 222). 같은 노선·같은 접두 문자의 번호는
// 진행 순서대로 붙어 있어서, 번호 비교로 방향과 "종착역이 도착역 너머인지"를 판정한다.
// 2호선 본선(201~243)은 순환이라 따로 계산한다. 지선은 번호가 섞여 있으므로
// 도착역 시간표에 같은 종착역 열차가 서는지로 한 번 더 확인한다.
// 판정할 수 없는 열차는 "안 간다"로 본다 (틀려도 더 이른 막차를 알려주는 쪽).

import { DAY_START_MIN } from './time';

export type Dir = 'U' | 'D';
export const DIRS: readonly Dir[] = ['U', 'D'];

/** TAGO 시간표 응답 항목 중 쓰는 필드 (빠진 항목도 있다) */
export type RawRow = {
  depTime?: string;
  arrTime?: string;
  endSubwayStationId?: string;
  endSubwayStationNm?: string;
};

export type Train = {
  time: string; // "HH:MM"
  min: number; // 운행일 기준 분 (04:00 이전은 +24h)
  endId: string;
  endName: string;
};

export type RouteInput = {
  routeId: string;
  originId: string;
  destId: string;
  origin: Record<Dir, Train[]>; // 출발역 방향별 열차 (시각 순)
  destEnds: Record<Dir, Set<string>>; // 도착역에 서는 열차의 방향별 종착역 ID
};

/** "HHMMSS" → 운행일 기준 분. 초는 버린다 (더 이른 쪽이 안전). */
export function parseTagoTime(t: unknown): number | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(String(t ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  const min = h * 60 + mm;
  return min < DAY_START_MIN ? min + 24 * 60 : min;
}

const clock = (min: number) => {
  const x = min % (24 * 60);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** 응답 항목 → 시각 순 열차 목록. 시각·종착역이 없거나 이 역에서 끝나는 열차는 뺀다. */
export function toTrains(rows: RawRow[], stationId: string): Train[] {
  const trains: Train[] = [];
  for (const r of rows) {
    const min = parseTagoTime(r.depTime) ?? parseTagoTime(r.arrTime);
    if (min == null || !r.endSubwayStationId || r.endSubwayStationId === stationId) continue;
    trains.push({ time: clock(min), min, endId: r.endSubwayStationId, endName: r.endSubwayStationNm ?? '' });
  }
  return trains.sort((a, b) => a.min - b.min);
}

/** 운행일 → TAGO 요일 코드 (01 평일, 02 토, 03 일). 공휴일은 아직 반영하지 않는다. */
export function dailyTypeCode(serviceDay: Date): '01' | '02' | '03' {
  const d = serviceDay.getDay();
  return d === 6 ? '02' : d === 0 ? '03' : '01';
}

type Pos = { prefix: string; n: number };

/** 역 ID → 노선 안 번호. 다른 노선이거나 지선 표기(234-4) 등 순서를 믿을 수 없으면 null */
export function position(id: string, routeId: string): Pos | null {
  if (!id.startsWith(routeId)) return null;
  const m = /^([A-Z]?)(\d+)$/.exec(id.slice(routeId.length));
  return m ? { prefix: m[1]!, n: Number(m[2]) } : null;
}

// 순환선: 번호 범위와 상행(U)일 때 번호가 커지는지(+1) 작아지는지(-1). 시간표로 확인한 값.
const LOOPS: Record<string, { from: number; to: number; up: 1 | -1 }> = {
  MTRS12: { from: 201, to: 243, up: 1 },
};

/** a에서 b까지 sign 방향으로 몇 정거장인지. 비교할 수 없으면 null, 반대쪽이면 0 이하 */
function distance(a: Pos, b: Pos, sign: 1 | -1, routeId: string): number | null {
  if (a.prefix !== b.prefix) return null;
  const loop = LOOPS[routeId];
  if (loop) {
    const inLoop = (p: Pos) => p.prefix === '' && p.n >= loop.from && p.n <= loop.to;
    if (!inLoop(a) || !inLoop(b)) return null;
    const size = loop.to - loop.from + 1;
    return ((((b.n - a.n) * sign) % size) + size) % size;
  }
  return (b.n - a.n) * sign;
}

/** 그 방향 열차의 종착역이 모두 출발역 한쪽에 있으면 그 쪽(+1/-1), 섞였거나 모르면 null */
function directionSign(dir: Dir, origin: Pos, trains: Train[], routeId: string): 1 | -1 | null {
  const loop = LOOPS[routeId];
  if (loop) return dir === 'U' ? loop.up : (-loop.up as 1 | -1);
  const signs = new Set<number>();
  for (const t of trains) {
    const p = position(t.endId, routeId);
    if (p && p.prefix === origin.prefix && p.n !== origin.n) signs.add(Math.sign(p.n - origin.n));
  }
  return signs.size === 1 ? ([...signs][0] as 1 | -1) : null;
}

/** 그 방향에서 도착역까지 가는 열차들. 이 방향으로 도착역에 못 가면 null */
function reachingTrains(r: RouteInput, dir: Dir): { trains: Train[]; stops: number } | null {
  const all = r.origin[dir];
  const o = position(r.originId, r.routeId);
  const d = position(r.destId, r.routeId);
  const sign = o && directionSign(dir, o, all, r.routeId);
  const stops = o && d && sign != null ? distance(o, d, sign, r.routeId) : null;
  // 번호로 판정할 수 없어도 도착역이 종착인 열차는 확실히 간다
  if (stops == null) return { trains: all.filter((t) => t.endId === r.destId), stops: Infinity };
  if (stops <= 0 || !o || sign == null) return null;

  const trains = all.filter((t) => {
    if (t.endId === r.destId) return true;
    if (!r.destEnds[dir].has(t.endId)) return false; // 지선 등: 도착역에 서지 않는 종착역
    const e = position(t.endId, r.routeId);
    const toEnd = e && distance(o, e, sign, r.routeId);
    return toEnd != null && toEnd > stops;
  });
  return { trains, stops };
}

/** 도착역까지 가는 막차. 두 방향 모두 되면(순환선) 정거장 수가 적은 쪽. 판정 불가면 null */
export function findLastTrain(r: RouteInput): { dir: Dir; last: Train } | null {
  let best: { dir: Dir; last: Train; stops: number } | null = null;
  for (const dir of DIRS) {
    const res = reachingTrains(r, dir);
    const last = res?.trains.at(-1);
    if (res && last && (!best || res.stops < best.stops)) best = { dir, last, stops: res.stops };
  }
  return best && { dir: best.dir, last: best.last };
}
