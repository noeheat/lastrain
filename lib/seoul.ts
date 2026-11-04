// 서울 열린데이터광장 지하철 시간표 호출 (서버 전용: 인증키를 쓰므로 app/api에서만 import한다)
// 1~9호선은 토요일·휴일 시간표가 TAGO에 없어서 이쪽을 먼저 쓴다. 실패하면 null을 돌려 TAGO로 넘어간다.

import type { Dir, LastTrainResult } from './reach';
import { findLastTrainByNumber, type SeoulRow } from './seoulReach';

const BASE = 'http://openapi.seoul.go.kr:8088';
const DAY = 60 * 60 * 24;
const WEEK = { '01': '1', '02': '2', '03': '3' } as const; // TAGO 요일 코드 → 서울 WEEK_TAG
const INOUT: Record<Dir, string> = { U: '1', D: '2' };

/** 서울 시간표를 쓰는 노선 (TAGO 노선 이름 기준). 다른 노선은 아직 검증하지 않았다. */
export const isSeoulLine = (line: string) => /^[1-9]호선$/.test(line);

async function get<T>(service: string, path: string): Promise<T[]> {
  const key = process.env.SEOUL_OPENAPI_KEY;
  if (!key) throw new Error('서버에 SEOUL_OPENAPI_KEY가 설정되지 않았어요');
  // 역 정보·시간표는 거의 안 바뀌므로 하루 캐시
  const res = await fetch(`${BASE}/${key}/json/${service}/1/1000/${path}/`, { next: { revalidate: DAY } });
  const body = await res.json().catch(() => null);
  const data = body?.[service];
  if (data) return data.row ?? [];
  const code = body?.RESULT?.CODE;
  if (code === 'INFO-200') return []; // 해당하는 데이터 없음
  throw new Error(`서울 열린데이터광장 오류 (HTTP ${res.status} ${code ?? ''})`);
}

/** 역 이름·노선 → 서울 역코드 (예: 강남, 2호선 → 0222). 못 찾으면 null */
async function stationCode(name: string, line: string): Promise<string | null> {
  const rows = await get<{ STATION_CD?: string; STATION_NM?: string; LINE_NUM?: string }>(
    'SearchInfoBySubwayNameService', encodeURIComponent(name),
  );
  // 서울은 "02호선", TAGO는 "2호선"
  const hit = rows.find((r) => r.STATION_NM === name && r.LINE_NUM?.replace(/^0/, '') === line);
  return hit?.STATION_CD ?? null;
}

const timetable = (code: string, week: string, dir: Dir) =>
  get<SeoulRow>('SearchSTNTimeTableByIDService', `${code}/${week}/${INOUT[dir]}`);

type Station = { name: string; line: string };

/** 서울 시간표로 막차 계산. 지원 노선이 아니거나 역·시간표를 못 찾으면 null */
export async function seoulLastTrain(
  origin: Station, dest: Station, daily: keyof typeof WEEK,
): Promise<LastTrainResult | null> {
  if (!isSeoulLine(origin.line) || origin.line !== dest.line) return null;
  const [originCode, destCode] = await Promise.all([
    stationCode(origin.name, origin.line), stationCode(dest.name, dest.line),
  ]);
  if (!originCode || !destCode) return null;

  const week = WEEK[daily];
  const [oU, oD, dU, dD] = await Promise.all([
    timetable(originCode, week, 'U'), timetable(originCode, week, 'D'),
    timetable(destCode, week, 'U'), timetable(destCode, week, 'D'),
  ]);
  if (!oU.length && !oD.length) return null;
  return findLastTrainByNumber({ originCode, destCode, origin: { U: oU, D: oD }, dest: [...dU, ...dD] });
}
