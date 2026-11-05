// 현재 위치 근처 지하철역 (DOM·네트워크 없음, 서버·테스트 공용)
// 카카오 지하철역 카테고리(SW8) 결과는 노선마다 따로 온다("강남역 2호선", "강남역 신분당선"). 역 이름별로 묶는다.

export type NearbyStation = { name: string; lines: string[]; distance: number }; // distance: m (그 역 노선 중 가장 가까운 것)

type KakaoPlace = { place_name?: string; distance?: string };

const MAX_STATIONS = 5;

/** "강남역 2호선" → { name: "강남", line: "2호선" }. 형식이 다르면 null */
export function parsePlaceName(placeName: string): { name: string; line: string } | null {
  const m = /^(.+?)역\s+(.+)$/.exec(placeName.trim());
  return m ? { name: m[1]!, line: m[2]! } : null;
}

/** 거리순 카카오 결과 → 역 이름별로 묶어 가까운 순 최대 5곳 */
export function groupNearby(places: KakaoPlace[]): NearbyStation[] {
  const byName = new Map<string, NearbyStation>();
  for (const p of places) {
    const parsed = parsePlaceName(p.place_name ?? '');
    const distance = Number(p.distance);
    if (!parsed || !Number.isFinite(distance)) continue;
    const s = byName.get(parsed.name);
    if (!s) byName.set(parsed.name, { name: parsed.name, lines: [parsed.line], distance });
    else {
      if (!s.lines.includes(parsed.line)) s.lines.push(parsed.line);
      s.distance = Math.min(s.distance, distance);
    }
  }
  return [...byName.values()].sort((a, b) => a.distance - b.distance).slice(0, MAX_STATIONS);
}
