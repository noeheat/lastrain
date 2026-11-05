// 함께 출발하는 역 (DOM 없음, 화면·테스트 공용)
// 같은 이름의 역도 노선마다 ID가 달라서(강남: 2호선·신분당), 고른 이름의 노선별 역을 모두 들고 있다가
// 사람마다 도착역 노선에 맞는 역을 쓴다.

import type { Person, StationRef } from './time';

export type Origin = { text: string; options: StationRef[] }; // options: 검색으로 고르지 않았으면 빈 배열

export const EMPTY_ORIGIN: Origin = { text: '', options: [] };

/** 출발역 칸이 따로 없던 저장값: 사람들의 출발역 이름과 고른 역에서 다시 만든다 */
export function originFromPeople(people: Person[]): Origin {
  const options = new Map(people.flatMap((p) => (p.origin ? [[p.origin.id, p.origin] as const] : [])));
  return { text: people[0]?.station ?? '', options: [...options.values()] };
}

/** 도착역과 같은 노선의 출발역. 없으면(환승이 필요하거나 직접 입력) null */
export const originFor = (o: Origin, dest: StationRef | null): StationRef | null =>
  (dest && o.options.find((s) => s.line === dest.line)) || null;

/** 막차를 다시 받아야 하는지 판단하는 키. 환승 경로(같은 노선 역이 없음)는 출발역 이름으로 구분한다 */
export const pairKey = (o: Origin, dest: StationRef | null) => `${originFor(o, dest)?.id ?? o.text}>${dest?.id ?? ''}`;

/** 저장한 뒤 출발역이 바뀌어 막차가 맞지 않는 사람 */
export const isStale = (p: Person, o: Origin) => p.station !== o.text;
