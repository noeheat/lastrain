// GET /api/bus-live?arsId=19225&routeId=100100093 → { live: BusLive | null }
// 막차 시간대에 카운트다운이 1분마다 부른다 (정류장 실시간 도착·막차 여부, 서버 30초 캐시)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { BusLiveQuerySchema } from '@/lib/schema';
import { busLive } from '@/lib/seoulBus';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'bus-live');
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const parsed = BusLiveQuerySchema.safeParse({ arsId: sp.get('arsId'), routeId: sp.get('routeId') });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? '잘못된 요청이에요' }, 400);
  try {
    return json({ live: await busLive(parsed.data.arsId, parsed.data.routeId) });
  } catch (e) {
    console.error(e);
    return json({ error: '버스 실시간 정보를 불러오지 못했어요.' }, 502);
  }
}
