// 서울 열린데이터광장 지하철 시간표(OA-101)로 도착역까지 가는 막차 판정 (DOM·네트워크 없음)
//
// TAGO와 달리 열차 번호(TRAIN_NO)가 있어서, 출발역 열차가 도착역 시간표에 "나중 시각으로" 다시
// 나오면 도착역까지 간다고 본다. 급행이 서지 않는 역, 지선, 순환선도 번호로 판정된다.
// 종착역 행은 도착 시각이 "25:00:00"/"00:00:00" 같은 자리 표시 값이라, 종착역이 도착역이면 시각을 보지 않는다.

import { DAY_START_MIN } from './time';
import type { Dir, LastTrainResult, Train } from './reach';

/** 시간표 응답 항목 중 쓰는 필드 */
export type SeoulRow = {
  TRAIN_NO?: string;
  LEFTTIME?: string; // "HH:MM:SS", 자정 이후는 "24:21:30"처럼 24 이상
  DESTSTATION?: string; // 종착역 역코드
  SUBWAYENAME?: string; // 종착역 이름
};

export type SeoulInput = {
  originCode: string;
  destCode: string;
  origin: Record<Dir, SeoulRow[]>; // 출발역 방향별 시간표 (U = 방향 1, D = 방향 2)
  dest: SeoulRow[]; // 도착역 시간표 (두 방향 합친 것)
};

const MAX_RIDE_MIN = 4 * 60; // 같은 번호가 이보다 뒤에 나오면 다음 운행으로 본다

/** "HH:MM:SS" → 운행일 기준 분. 초는 버린다 (더 이른 쪽이 안전). */
export function parseSeoulTime(t: unknown): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(t ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 27 || mm > 59) return null;
  const min = h * 60 + mm;
  return min < DAY_START_MIN ? min + 24 * 60 : min;
}

const clock = (min: number) => {
  const x = min % (24 * 60);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

type NumberedTrain = Train & { no: string };

/** 응답 항목 → 시각 순 열차 목록. 번호·시각·종착역이 없거나 이 역에서 끝나는 열차는 뺀다. */
export function toSeoulTrains(rows: SeoulRow[], stationCode: string): NumberedTrain[] {
  const trains: NumberedTrain[] = [];
  for (const r of rows) {
    const min = parseSeoulTime(r.LEFTTIME);
    if (min == null || !r.TRAIN_NO || !r.DESTSTATION || r.DESTSTATION === stationCode) continue;
    trains.push({ time: clock(min), min, endId: r.DESTSTATION, endName: r.SUBWAYENAME ?? '', no: r.TRAIN_NO });
  }
  return trains.sort((a, b) => a.min - b.min);
}

/** 도착역 시간표에 같은 번호가 출발 뒤에 나오는지 (도착역이 종착이면 시각은 보지 않는다) */
function reaches(t: NumberedTrain, destByNo: Map<string, SeoulRow[]>, destCode: string): boolean {
  return (destByNo.get(t.no) ?? []).some((r) => {
    if (r.DESTSTATION === destCode) return true;
    const min = parseSeoulTime(r.LEFTTIME);
    return min != null && min > t.min && min - t.min <= MAX_RIDE_MIN;
  });
}

/** 도착역까지 가는 막차와 방향별 마지막 몇 대 */
export function findLastTrainByNumber(input: SeoulInput, candidates = 6): LastTrainResult {
  const destByNo = new Map<string, SeoulRow[]>();
  for (const r of input.dest) {
    if (!r.TRAIN_NO) continue;
    destByNo.set(r.TRAIN_NO, [...(destByNo.get(r.TRAIN_NO) ?? []), r]);
  }

  const trains = {
    U: toSeoulTrains(input.origin.U, input.originCode),
    D: toSeoulTrains(input.origin.D, input.originCode),
  };
  let last: LastTrainResult['last'] = null;
  for (const dir of ['U', 'D'] as const) {
    const t = trains[dir].filter((x) => reaches(x, destByNo, input.destCode)).at(-1);
    if (t && (!last || t.min > last.min)) last = { time: t.time, min: t.min, endId: t.endId, endName: t.endName, dir };
  }
  const strip = (list: NumberedTrain[]): Train[] => list.map(({ no: _no, ...t }) => t);
  return {
    last,
    candidates: { U: strip(trains.U.slice(-candidates)), D: strip(trains.D.slice(-candidates)) },
  };
}
