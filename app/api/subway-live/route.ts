// GET /api/subway-live?station=강남 → { arrivals: Arrival[] }
// 막차 시간대에 카운트다운이 부른다 (1~9호선 실시간 도착·막차 여부·열차 번호, 같은 역 30초 캐시)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { SubwayLiveQuerySchema } from '@/lib/schema';
import { stationArrivals } from '@/lib/seoulSubwayLive';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'subway-live');
  if (limited) return limited;
  const parsed = SubwayLiveQuerySchema.safeParse({ station: req.nextUrl.searchParams.get('station') ?? '' });
  if (!parsed.success) return json({ error: '역 이름을 1~30자로 보내 주세요' }, 400);
  try {
    return json({ arrivals: await stationArrivals(parsed.data.station) });
  } catch (e) {
    console.error(e);
    return json({ error: '지하철 실시간 정보를 불러오지 못했어요.' }, 502);
  }
}
