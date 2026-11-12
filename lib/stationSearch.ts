// 역 검색어 다듬기와 결과 정렬 (DOM·네트워크 없음, 서버·테스트 공용)
// TAGO는 이름을 '역' 없이 저장해서 "강남역"으로는 못 찾는다. 반대로 "서울역"·"하남검단산역"은 '역'까지가 이름이다.

import type { StationRef } from './time';
import { nameVariants } from './transfer';

/**
 * TAGO에 보낼 검색어 하나: '역'(앞 공백 포함)을 뗀 검색어. TAGO는 이름에 검색어가 포함된 역을 찾으므로
 * "서울"의 결과에 "서울역"의 결과가 모두 들어 있다(2026-11-12 서울역·강남역·하남검단산역 등 7개 확인). 그래서 한 번만 부른다.
 * '역' 하나만 입력하면 그대로 보낸다.
 */
export function tagoKeyword(q: string): string {
  const t = q.trim();
  return t.replace(/\s*역$/, '') || t;
}

/** 순위를 매길 때 맞춰 볼 이름: 원래 검색어와 '역'을 뗀 검색어 ("서울역"은 '역'까지가 이름이라 둘 다 본다) */
export function searchTerms(q: string): string[] {
  const t = q.trim();
  const bare = t.replace(/\s*역$/, '');
  return bare && bare !== t ? [t, bare] : [t];
}

/**
 * 여러 검색 결과를 합쳐 같은 역(ID)은 한 번만, 이름(괄호 앞뒤 포함)이 검색어와 같은 역 → 검색어로 시작하는 역 → 나머지 순으로.
 * 같은 순위 안에서는 TAGO가 준 순서를 지킨다.
 */
export function rankStations(lists: StationRef[][], q: string): StationRef[] {
  const terms = searchTerms(q);
  const seen = new Set<string>();
  const all = lists.flat().filter((s) => !seen.has(s.id) && seen.add(s.id));
  const rank = (s: StationRef) => {
    // 이름 후보(괄호 앞뒤, '역' 뗀 이름)는 다른 곳과 같은 규칙: "총신대입구(이수)" → 총신대입구·이수
    const names = nameVariants(s.name);
    if (terms.some((t) => names.includes(t))) return 0;
    if (terms.some((t) => s.name.startsWith(t))) return 1;
    return 2;
  };
  return all.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}
