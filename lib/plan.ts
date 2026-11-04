// 환승 경로 막차 계획 (서버 전용): 카카오 경로 → 구간별 시간표(서울 우선, 안 되면 TAGO) → 역산

import { stationCoord, transitRoutes } from './kakao';
import { seoulLegTrains } from './seoul';
import { tagoLegTrains } from './tago';
import { planBackward, subwayRoutes, type Leg, type LegTrain } from './transfer';

const MAX_ROUTES = 3; // 시간표 호출 수 제한 (카카오 추천 순서 앞쪽만)

export type PlanLeg = {
  line: string; from: string; to: string;
  dep: string; arr: string; // "HH:MM"
  endName: string;
  estimated: boolean; // 도착 시각이 시간표가 아니라 카카오 소요시간 추정
};
export type PlanResult = { depart: string; departMin: number; legs: PlanLeg[] };

const clock = (min: number) => {
  const x = min % (24 * 60);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

type Daily = '01' | '02' | '03';

async function legTrains(leg: Leg, daily: Daily): Promise<LegTrain[] | null> {
  const seoul = await seoulLegTrains(leg.from, leg.to, leg.line, daily, leg.minutes).catch((e) => (console.error(e), null));
  if (seoul?.length) return seoul;
  return tagoLegTrains(leg.from, leg.to, leg.line, daily, leg.minutes);
}

/** 가장 늦게 출발해도 되는 지하철 경로. 경로가 없거나 이어 탈 수 없으면 plan: null */
export async function planTransfer(origin: string, dest: string, daily: Daily): Promise<{ plan: PlanResult | null; routes: number }> {
  const [a, b] = await Promise.all([stationCoord(origin), stationCoord(dest)]);
  if (!a || !b) return { plan: null, routes: 0 };
  const routes = subwayRoutes(await transitRoutes(a, b), origin, dest).slice(0, MAX_ROUTES);

  const plans = await Promise.all(routes.map(async (route): Promise<PlanResult | null> => {
    try {
      const lists = await Promise.all(route.legs.map((leg) => legTrains(leg, daily)));
      if (lists.some((l) => !l)) return null; // 시간표를 못 찾은 구간이 있으면 이 경로는 버린다
      const chosen = planBackward(lists.map((trains, i) => ({ trains: trains!, walkBefore: route.walks[i] ?? 0 })));
      if (!chosen) return null;
      return {
        depart: clock(chosen[0]!.dep),
        departMin: chosen[0]!.dep,
        legs: chosen.map((t, i) => ({
          line: route.legs[i]!.line, from: route.legs[i]!.from, to: route.legs[i]!.to,
          dep: clock(t.dep), arr: clock(t.arr), endName: t.endName, estimated: t.estimated,
        })),
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  }));
  const best = plans.reduce<PlanResult | null>((acc, p) => (p && (!acc || p.departMin > acc.departMin) ? p : acc), null);
  return { plan: best, routes: routes.length };
}
