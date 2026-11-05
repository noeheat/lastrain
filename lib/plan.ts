// 환승 경로 막차 계획 (서버 전용): 카카오 경로 → 구간별 시간표(서울 우선, 안 되면 TAGO) → 역산

import { stationCoord, transitRoutes } from './kakao';
import { seoulLegTrains } from './seoul';
import { tagoLegTrains } from './tago';
import { legProblem, planBackward, subwayRoutes, type Leg, type LegTrain } from './transfer';

const MAX_ROUTES = 3; // 시간표 호출 수 제한 (카카오 추천 순서 앞쪽만)

export type PlanLeg = {
  line: string; from: string; to: string;
  dep: string; arr: string; // "HH:MM"
  endName: string;
  estimated: boolean; // 도착 시각이 시간표가 아니라 카카오 소요시간 추정
  holidayForSaturday: boolean; // 토요일 시간표가 없어 휴일 시간표로 계산
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

/**
 * 가장 늦게 출발해도 되는 지하철 경로. 경로가 없거나 이어 탈 수 없으면 plan: null.
 * reasons: 경로를 버린 이유 (plan이 null일 때 화면에 원인을 보여주려고)
 */
export async function planTransfer(
  origin: string, dest: string, daily: Daily, originLine?: string, destLine?: string,
): Promise<{ plan: PlanResult | null; routes: number; reasons: string[] }> {
  // 노선도 넘겨 이름이 같은 다른 역(양평: 5호선·경의중앙선)과 헷갈리지 않게 한다
  const [a, b] = await Promise.all([stationCoord(origin, originLine), stationCoord(dest, destLine)]);
  if (!a || !b) return { plan: null, routes: 0, reasons: ['역 위치를 찾지 못했어요'] };
  const routes = subwayRoutes(await transitRoutes(a, b), origin, dest).slice(0, MAX_ROUTES);
  const reasons = new Set<string>();
  if (routes.length === 0) reasons.add('지하철로만 가는 경로가 없어요');

  const plans = await Promise.all(routes.map(async (route): Promise<PlanResult | null> => {
    try {
      const lists = await Promise.all(route.legs.map((leg) => legTrains(leg, daily)));
      const problem = legProblem(route.legs, lists);
      if (problem) { // 시간표를 못 찾았거나 열차를 판정할 수 없는 구간이 있으면 이 경로는 버린다
        reasons.add(problem);
        return null;
      }
      const chosen = planBackward(lists.map((trains, i) => ({ trains: trains!, walkBefore: route.walks[i] ?? 0 })));
      if (!chosen) {
        reasons.add('환승해서 이어 탈 수 있는 열차가 없어요');
        return null;
      }
      return {
        depart: clock(chosen[0]!.dep),
        departMin: chosen[0]!.dep,
        legs: chosen.map((t, i) => ({
          line: route.legs[i]!.line, from: route.legs[i]!.from, to: route.legs[i]!.to,
          dep: clock(t.dep), arr: clock(t.arr), endName: t.endName, estimated: t.estimated,
          holidayForSaturday: !!t.holidayForSaturday,
        })),
      };
    } catch (e) {
      console.error(e);
      reasons.add(e instanceof Error ? e.message : '시간표를 불러오지 못했어요');
      return null;
    }
  }));
  const best = plans.reduce<PlanResult | null>((acc, p) => (p && (!acc || p.departMin > acc.departMin) ? p : acc), null);
  return { plan: best, routes: routes.length, reasons: best ? [] : [...reasons] };
}
