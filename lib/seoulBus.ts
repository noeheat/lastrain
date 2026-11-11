// 서울 버스 API 호출과 버스 막차 계산 (서버 전용: data.go.kr 키를 쓰므로 app/api에서만 import한다)
// data.go.kr "서울특별시_노선정보조회 서비스" (TAGO와 같은 키, 활용신청 2026-11)

import { busName, busOnlyLegs, busTrains, matchStops, parseBusLive, type BusLive, type BusStop, type LiveItem } from './bus';
import { stationCoord, transitRoutes } from './kakao';
import type { Leg, LegTrain } from './transfer';

const BASE = 'http://ws.bus.go.kr/api/rest';
const DAY = 60 * 60 * 24;

async function get<T>(path: string, params: Record<string, string>, revalidate = DAY): Promise<T[]> {
  const key = process.env.TAGO_SERVICE_KEY;
  if (!key) throw new Error('서버에 TAGO_SERVICE_KEY가 설정되지 않았어요');
  // 노선·정류장 목록과 정류장별 막차는 거의 안 바뀌므로 하루 캐시 (실시간 도착은 30초).
  // 오류 응답(호출 한도 초과 등)도 HTTP 200이라 Next가 그대로 캐시하므로, 오류면 캐시를 건너뛰고 한 번 더 받는다
  const url = `${BASE}/${path}?${new URLSearchParams({ serviceKey: key, resultType: 'json', ...params })}`;
  let res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
  let body = await res.json().catch(() => null);
  if (!['0', '4'].includes(body?.msgHeader?.headerCd)) {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    body = await res.json().catch(() => null);
  }
  const code = body?.msgHeader?.headerCd;
  if (!res.ok || code == null) throw new Error(`서울 버스 응답 오류 (HTTP ${res.status})`);
  if (code === '4') return []; // 결과 없음
  if (code !== '0') throw new Error(`서울 버스 오류 ${code} ${body.msgHeader.headerMsg ?? ''}`);
  return body.msgBody?.itemList ?? [];
}

/** 실시간 조회에 쓸 수 있는 정류장 고유번호만 (미정차 정류장은 "0") */
const validArs = (ars?: string) => (ars && /^\d{5}$/.test(ars) ? ars : undefined);

/** 노선 번호 → 서울 노선 ID. 서울 노선이 아니면(경기 직행 등) null */
async function routeId(name: string): Promise<string | null> {
  const list = await get<{ busRouteId?: string; busRouteNm?: string }>('busRouteInfo/getBusRouteList', { strSrch: name });
  return list.find((r) => r.busRouteNm === name)?.busRouteId ?? null;
}

const routeStops = (id: string) => get<BusStop>('busRouteInfo/getStaionByRoute', { busRouteId: id });

/** 노선 배차 간격(분). 모르면 NaN */
async function routeTerm(id: string): Promise<number> {
  const [info] = await get<{ term?: string }>('busRouteInfo/getRouteInfo', { busRouteId: id });
  return Number(info?.term);
}

/**
 * 환승 경로의 버스 구간 열차 목록: 구간을 지나는 노선마다 정류장별 막차와 배차 간격으로 만든 버스들 (출발 순).
 * 어느 노선도 맞추지 못하면 null (막차를 모름)
 */
export async function busLegTrains(leg: Leg): Promise<LegTrain[] | null> {
  const results = await Promise.allSettled((leg.names ?? [leg.line]).map(async (name) => {
    const id = await routeId(name);
    if (!id) return [];
    const [stops, term] = await Promise.all([routeStops(id), routeTerm(id)]);
    const m = matchStops(stops, leg.from, leg.to, leg.minutes);
    return m ? busTrains(m, term, name, { arsId: validArs(m.board.arsId), routeId: id }) : [];
  }));
  results.forEach((r) => { if (r.status === 'rejected') console.error(r.reason); });
  const trains = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).sort((a, b) => a.dep - b.dep);
  return trains.length ? trains : null;
}

/** 버스 막차 하나: 탈 정류장을 떠나는 막차 예정 시각(dep)과 내릴 정류장 도착 예정(arr) */
export type BusOption = {
  route: string; from: string; to: string;
  dep: string; arr: string; depMin: number; // "HH:MM", 운행일 기준 분
  estimated: boolean; // 정류장별 막차 값이 서로 맞지 않아 내릴 곳 기준으로 추정
  arsId?: string; routeId: string; // 탈 정류장 고유번호·노선 ID (실시간 도착 조회용)
};

const clock = (min: number) => {
  const x = min % (24 * 60);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/**
 * 출발역 → 도착역을 버스 한 번으로 가는 막차들 (늦게 떠나는 순). 서울 버스만.
 * reasons: 결과가 없을 때 이유
 */
export async function busOptions(
  origin: string, dest: string, originLine?: string, destLine?: string,
): Promise<{ options: BusOption[]; reasons: string[] }> {
  const [a, b] = await Promise.all([stationCoord(origin, originLine), stationCoord(dest, destLine)]);
  if (!a || !b) return { options: [], reasons: ['역 위치를 찾지 못했어요'] };
  const legs = busOnlyLegs(await transitRoutes(a, b));
  if (legs.length === 0) return { options: [], reasons: ['버스 한 번으로 가는 경로가 없어요'] };

  const tries = legs.flatMap((leg) => leg.names.map((raw) => ({ leg, name: busName(raw) })))
    .filter((x): x is { leg: typeof legs[number]; name: string } => !!x.name);
  const results = await Promise.allSettled(tries.map(async ({ leg, name }): Promise<BusOption | null> => {
    const id = await routeId(name);
    if (!id) return null;
    const m = matchStops(await routeStops(id), leg.from, leg.to, leg.minutes);
    return m && {
      route: name, from: leg.from, to: leg.to, dep: clock(m.dep), arr: clock(m.arr), depMin: m.dep, estimated: m.estimated,
      arsId: validArs(m.board.arsId), routeId: id,
    };
  }));
  results.forEach((r) => { if (r.status === 'rejected') console.error(r.reason); });

  // 같은 노선·탈 곳은 하나만 (카카오가 여러 경로에 같은 버스를 준다)
  const seen = new Set<string>();
  const options = results
    .flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
    .sort((x, y) => y.depMin - x.depMin)
    .filter((o) => !seen.has(`${o.route}|${o.from}`) && seen.add(`${o.route}|${o.from}`));
  return { options, reasons: options.length ? [] : ['서울 버스 막차를 찾지 못했어요 (서울 밖 노선이거나 정류장을 맞추지 못함)'] };
}

/**
 * 정류장(arsId)에서 그 노선의 실시간 도착. 같은 정류장을 보는 사람이 여럿이어도 호출이 한 번만 나가게 30초 캐시.
 * 그 노선이 정류장 응답에 없으면 null
 */
export async function busLive(arsId: string, routeId: string): Promise<BusLive | null> {
  const items = await get<LiveItem & { busRouteId?: string }>('stationinfo/getStationByUid', { arsId }, 30);
  return parseBusLive(items.find((i) => i.busRouteId === routeId));
}
