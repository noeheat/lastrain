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

export type Place = { line: string; x: number; y: number }; // 카카오 좌표 (x 경도, y 위도)

const MAX_SAME_STATION_M = 500; // 같은 이름 역을 한 역으로 볼 거리. 신촌 2호선·경의중앙선(약 670m)은 다른 역

/** 두 좌표 사이 거리(m) */
export function distanceM(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.y - a.y) * rad, dLng = (b.x - a.x) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.y * rad) * Math.cos(b.y * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 이름이 같은 역 중 고른 노선(line)의 역과 같은 곳(500m 안)에 있는 노선들. 고른 노선을 못 찾으면 null.
 * 양평(5호선 영등포구·경의중앙선 양평군)처럼 이름만 같은 다른 역을 갈라낸다. same: 노선 이름 비교 (TAGO·카카오 표기 차이)
 */
export function colocatedLines(places: Place[], line: string, same: (a: string, b: string) => boolean): string[] | null {
  const base = places.find((p) => same(p.line, line));
  if (!base) return null;
  return places.filter((p) => distanceM(base, p) <= MAX_SAME_STATION_M).map((p) => p.line);
}
