// 카카오 로컬(역 좌표)·대중교통 경로 호출 (서버 전용: REST 키를 쓰므로 app/api에서만 import한다)

import { colocatedLines, groupNearby, parsePlaceName, type NearbyStation, type Place } from './nearby';
import { nameVariants, normLine } from './transfer';

const DAY = 60 * 60 * 24;

async function get(url: string, params: Record<string, string>) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error('서버에 KAKAO_REST_API_KEY가 설정되지 않았어요');
  // 역 좌표와 경로 구조는 거의 안 바뀌므로 하루 캐시 (경로 API는 시각을 받지 않는다)
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: DAY },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`카카오 응답 오류 (HTTP ${res.status})`);
  return body;
}

/** 역 이름 → 노선별 카카오 좌표 ("강남역 2호선", "강남역 신분당선"). 이름 후보 중 처음 찾은 것 */
async function stationPlaces(name: string): Promise<Place[]> {
  for (const n of nameVariants(name)) {
    const body = await get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      query: `${n}역`, category_group_code: 'SW8', size: '15',
    });
    const places = (body.documents ?? []).flatMap((d: { place_name?: string; x?: string; y?: string }) => {
      const p = parsePlaceName(d.place_name ?? '');
      return p && p.name === n ? [{ line: p.line, x: Number(d.x), y: Number(d.y) }] : [];
    });
    if (places.length) return places;
  }
  return [];
}

const sameLine = (a: string, b: string) => normLine(a) === normLine(b);

/**
 * 역 이름(과 노선) → 좌표. 노선을 주면 그 노선의 역을 쓴다 (양평: 5호선은 영등포구, 경의중앙선은 양평군).
 * 노선이 없거나 못 찾으면 처음 찾은 역. 없으면 null
 */
export async function stationCoord(name: string, line?: string): Promise<{ x: string; y: string } | null> {
  const places = await stationPlaces(name);
  const hit = (line && places.find((p) => sameLine(p.line, line))) || places[0];
  return hit ? { x: String(hit.x), y: String(hit.y) } : null;
}

/** 이름이 같은 역 중 고른 노선의 역과 같은 곳(500m 안)에 있는 노선들. 못 찾으면 null */
export async function colocated(name: string, line: string): Promise<string[] | null> {
  return colocatedLines(await stationPlaces(name), line, sameLine);
}

/** 두 좌표 사이 대중교통 경로 (응답 그대로, 해석은 lib/transfer.ts) */
export function transitRoutes(a: { x: string; y: string }, b: { x: string; y: string }) {
  return get('https://dapi.kakao.com/v2/routing/publictraffic', { start_x: a.x, start_y: a.y, end_x: b.x, end_y: b.y });
}

/**
 * 좌표 근처(1.5km) 지하철역을 거리순으로. 좌표는 소수점 셋째 자리(약 100m)로 줄여 보낸다
 * (위치를 덜 정확하게 넘기고, 같은 동네 요청끼리 캐시를 함께 쓴다)
 */
export async function nearbyStations(lat: number, lng: number): Promise<NearbyStation[]> {
  const body = await get('https://dapi.kakao.com/v2/local/search/category.json', {
    category_group_code: 'SW8', x: lng.toFixed(3), y: lat.toFixed(3), radius: '1500', sort: 'distance', size: '15',
  });
  return groupNearby(body.documents ?? []);
}
