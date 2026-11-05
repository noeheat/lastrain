// 역 검색어 다듬기와 결과 정렬 (DOM·네트워크 없음, 서버·테스트 공용)
// TAGO는 이름을 '역' 없이 저장해서 "강남역"으로는 못 찾는다. 반대로 "서울역"·"하남검단산역"은 '역'까지가 이름이다.

import type { StationRef } from './time';

/** TAGO에 보낼 검색어: '역'으로 끝나면 원래 검색어와 '역'을 뗀 검색어 둘 다 */
export function searchTerms(q: string): string[] {
  const t = q.trim();
  const bare = t.replace(/역$/, '');
  return bare && bare !== t ? [t, bare] : [t];
}

/**
 * 여러 검색 결과를 합쳐 같은 역(ID)은 한 번만, 이름이 검색어와 같은 역 → 검색어로 시작하는 역 → 나머지 순으로.
 * 같은 순위 안에서는 TAGO가 준 순서를 지킨다.
 */
export function rankStations(lists: StationRef[][], q: string): StationRef[] {
  const terms = searchTerms(q);
  const seen = new Set<string>();
  const all = lists.flat().filter((s) => !seen.has(s.id) && seen.add(s.id));
  const rank = (s: StationRef) => {
    const name = s.name.replace(/\(.*\)$/, ''); // "잠실(송파구청)" → "잠실"
    if (terms.some((t) => name === t || s.name === t)) return 0;
    if (terms.some((t) => s.name.startsWith(t))) return 1;
    return 2;
  };
  return all.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}
