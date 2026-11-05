// 카카오 로컬(역 좌표)·대중교통 경로 호출 (서버 전용: REST 키를 쓰므로 app/api에서만 import한다)

import { groupNearby, type NearbyStation } from './nearby';
import { nameVariants } from './transfer';

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

/** 역 이름 → 좌표 (지하철역 카테고리). 못 찾으면 null */
export async function stationCoord(name: string): Promise<{ x: string; y: string } | null> {
  for (const n of nameVariants(name)) {
    const body = await get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      query: `${n}역`, category_group_code: 'SW8', size: '5',
    });
    // place_name 예: "강남역 2호선"
    const hit = (body.documents ?? []).find((d: { place_name?: string }) => d.place_name?.startsWith(`${n}역`));
    if (hit) return { x: hit.x, y: hit.y };
  }
  return null;
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
