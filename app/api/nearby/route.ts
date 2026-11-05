// GET /api/nearby?lat=37.498&lng=127.028 → { stations: [{ name, lines, distance }] }
// 현재 위치로 출발역 찾기. 위치는 저장하지 않는다.

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { NearbyQuerySchema } from '@/lib/schema';
import { nearbyStations } from '@/lib/kakao';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'nearby');
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const parsed = NearbyQuerySchema.safeParse({ lat: sp.get('lat'), lng: sp.get('lng') });
  if (!parsed.success) return json({ error: '위치가 한국 안이 아니거나 잘못됐어요' }, 400);
  try {
    return json({ stations: await nearbyStations(parsed.data.lat, parsed.data.lng) });
  } catch (e) {
    console.error(e);
    const config = e instanceof Error && e.message.includes('설정되지 않았어요');
    return json({ error: config ? `${(e as Error).message}.` : '근처 역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, config ? 500 : 502);
  }
}
