// 환승 경로 막차 역산 (DOM·네트워크 없음, 서버·테스트 공용)
//
// 1) 카카오 경로 응답에서 "지하철 + 역 안 환승 도보"로만 된 경로를 구간 목록으로 뽑는다.
// 2) 마지막 구간의 막차부터 거꾸로, 앞 구간은 "다음 구간 출발 − 환승 도보" 안에 도착하는 마지막 열차를 고른다.

/** 역 이름 후보. 출처마다 표기가 달라서(잠실(송파구청)·잠실, 총신대입구(이수)·이수) 괄호 앞뒤를 모두 쓴다. */
export function nameVariants(name: string): string[] {
  const raw = name.trim();
  const n = raw.replace(/역$/, '');
  if (!n && raw) return [raw]; // "역"만 있으면 떼고 남는 빈 문자열은 후보에서 뺀다
  const m = /^(.+?)\((.+)\)$/.exec(n);
  const list = m ? [n, m[1]!, m[2]!] : [n];
  // "서울역"은 '역'까지가 이름이다. 서울 시간표에서 "서울"로 찾으면 GTX-A만 나오므로 원래 이름도 마지막에 찾는다
  return raw === n ? list : [...list, raw];
}

export const sameStation = (a: string, b: string) => nameVariants(a).some((x) => nameVariants(b).includes(x));

/** 노선 이름 비교용: "신분당선"·"신분당", "공항철도"·"공항"을 같게 본다. N호선은 그대로. */
export const normLine = (line: string) => (/^\d+호선$/.test(line) ? line : line.trim().replace(/(선|철도)$/, ''));

/** 화면에 보여줄 노선 이름: TAGO "신분당"·"공항"과 카카오 "신분당선"·"공항철도"를 하나로 ("신분당선", "공항철도") */
export const lineLabel = (line: string) => {
  const t = line.trim();
  if (/(호선|선|철도)$/.test(t) || !t) return t;
  return t === '공항' ? '공항철도' : `${t}선`;
};

export type Leg = { line: string; from: string; to: string; minutes: number };
/** walks[i]: i번째 구간을 타기 전 환승 도보(분). walks[0]은 0 (출발역 도보는 사람마다 따로 입력) */
export type SubwayRoute = { legs: Leg[]; walks: number[] };

type KakaoStep = {
  properties?: {
    type?: string;
    time?: number; // 초
    guidance?: string;
    stops?: { name?: string }[];
    vehicles?: { name?: string }[];
  };
};
type KakaoBody = { routes?: { steps?: KakaoStep[] }[] };

const toMin = (sec: number | undefined) => Math.ceil((sec ?? 0) / 60);

/** 카카오 경로 응답 → 출발역에서 지하철로 시작해 도착역에서 끝나는 지하철 전용 경로 (같은 구간 조합은 하나만) */
export function subwayRoutes(body: KakaoBody, origin: string, dest: string): SubwayRoute[] {
  const out: SubwayRoute[] = [];
  const seen = new Set<string>();
  for (const route of body.routes ?? []) {
    const legs: Leg[] = [];
    const walks: number[] = [];
    let walk = 0;
    let ok = true;
    for (const s of route.steps ?? []) {
      const p = s.properties ?? {};
      if (p.type === 'SUBWAY') {
        const stops = p.stops ?? [];
        const from = stops[0]?.name;
        const to = stops.at(-1)?.name;
        const line = p.vehicles?.[0]?.name;
        if (!from || !to || !line) { ok = false; break; }
        legs.push({ line, from, to, minutes: toMin(p.time) });
        walks.push(walk);
        walk = 0;
      } else if (p.type === 'WALKING' && legs.length > 0 && p.guidance?.includes('환승')) {
        walk += toMin(p.time); // 역 안 환승만 허용
      } else {
        ok = false; // 버스, 역 밖 도보 등
        break;
      }
    }
    if (!ok || legs.length === 0) continue;
    if (!sameStation(legs[0]!.from, origin) || !sameStation(legs.at(-1)!.to, dest)) continue;
    const key = legs.map((l) => `${normLine(l.line)}:${l.from}>${l.to}`).join('|');
    if (seen.has(key)) continue; // 급행·일반만 다른 같은 경로
    seen.add(key);
    out.push({ legs, walks });
  }
  return out;
}

/** 구간 열차: 출발역에서 떠나는 시각과 내릴 역 도착 시각(운행일 기준 분) */
export type LegTrain = {
  dep: number; arr: number; endName: string; estimated: boolean;
  holidayForSaturday?: boolean; // 토요일 시간표가 없어 휴일 시간표로 계산
};

/**
 * 추정 도착 시각(출발 + 카카오 소요시간, 종착역이라 시각을 모름)에 두는 환승 여유(분).
 * 추정이 1분만 빨라도 다음 열차를 놓치므로, 추정 도착은 이만큼 늦게 도착한다고 보고 비교한다
 */
export const ESTIMATE_MARGIN_MIN = 2;

/** 구간별 "내릴 역까지 가는 열차"(출발 시각 순)로 거꾸로 계산. 이어 탈 수 없으면 null */
export function planBackward(legs: { trains: LegTrain[]; walkBefore: number }[]): LegTrain[] | null {
  const chosen: LegTrain[] = [];
  let deadline = Infinity; // 마지막 구간은 마감이 없다
  for (let i = legs.length - 1; i >= 0; i--) {
    const leg = legs[i]!;
    const t = leg.trains.filter((x) => x.arr + (x.estimated ? ESTIMATE_MARGIN_MIN : 0) <= deadline).at(-1);
    if (!t) return null;
    chosen[i] = t;
    deadline = t.dep - leg.walkBefore;
  }
  return chosen;
}

/**
 * 구간 시간표 결과를 보고 이 경로를 버려야 하는 이유. 문제가 없으면 null.
 * - null: 역이나 시간표를 찾지 못함
 * - []: 시간표는 있지만 내릴 역까지 가는 열차를 판정할 수 없음
 *   (예: 경의중앙 서울역→가좌처럼 역 ID 접두가 달라 순서를 모르면, 내릴 역이 종착인 열차만 남는다)
 */
export function legProblem(legs: Leg[], lists: (LegTrain[] | null)[]): string | null {
  for (let i = 0; i < legs.length; i++) {
    const { line, from, to } = legs[i]!;
    const list = lists[i];
    if (!list) return `${line} ${from}→${to} 시간표를 찾지 못했어요`;
    if (list.length === 0) return `${line} ${from}→${to}: 도착역까지 가는 열차를 판정할 수 없어요`;
  }
  return null;
}
