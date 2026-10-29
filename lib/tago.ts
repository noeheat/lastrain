// TAGO 지하철정보 API 호출 (서버 전용: 서비스 키를 쓰므로 app/api에서만 import한다)

import type { Dir, RawRow } from './reach';

const BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
const DAY = 60 * 60 * 24;

export class TagoError extends Error {}

async function get<T>(op: string, params: Record<string, string>): Promise<T[]> {
  const key = process.env.TAGO_SERVICE_KEY;
  if (!key) throw new TagoError('TAGO_SERVICE_KEY가 설정되지 않았어요');
  // URLSearchParams가 인코딩하므로 Decoding 키를 그대로 넣는다
  const qs = new URLSearchParams({ serviceKey: key, _type: 'json', numOfRows: '1000', pageNo: '1', ...params });
  // 역 목록·시간표는 거의 안 바뀌므로 하루 캐시 (TAGO 일일 호출 한도 절약)
  const res = await fetch(`${BASE}/${op}?${qs}`, { next: { revalidate: DAY } });
  const body = await res.json().catch(() => null);
  const header = body?.response?.header;
  if (!res.ok || !header) throw new TagoError(`TAGO 응답 오류 (HTTP ${res.status})`);
  if (header.resultCode !== '00') throw new TagoError(`TAGO 오류 ${header.resultCode} ${header.resultMsg}`);
  const items = body.response.body?.items?.item ?? [];
  return Array.isArray(items) ? items : [items];
}

export type Station = { id: string; name: string; line: string };

export async function searchStations(keyword: string): Promise<Station[]> {
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

/** 라우트 공용: TAGO 실패를 502로, 그 밖의 예외는 500으로 */
export function tagoFailure(e: unknown): Response {
  console.error(e);
  const message = e instanceof TagoError ? e.message : '서버 오류가 났어요';
  return Response.json({ error: `${message}. 잠시 후 다시 시도해 주세요.` }, { status: e instanceof TagoError ? 502 : 500 });
}
