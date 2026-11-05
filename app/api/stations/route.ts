// GET /api/stations?q=강남 → { stations: [{ id, name, line }] }
// "강남역"처럼 '역'을 붙여도 찾는다 (lib/stationSearch.ts)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { StationQuerySchema } from '@/lib/schema';
import { fulfilledLists, rankStations, searchTerms } from '@/lib/stationSearch';
import { searchStations, tagoFailure } from '@/lib/tago';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'stations');
  if (limited) return limited;
  const parsed = StationQuerySchema.safeParse({ q: req.nextUrl.searchParams.get('q') ?? '' });
  if (!parsed.success) return json({ error: '역 이름을 1~20자로 입력해 주세요' }, 400);
  try {
    const { q } = parsed.data;
    // 검색어 하나가 실패해도(TAGO 타임아웃 등) 나머지 결과는 보여준다. 모두 실패하면 아래 catch로
    const settled = await Promise.allSettled(searchTerms(q).map((term) => searchStations(term)));
    return json({ stations: rankStations(fulfilledLists(settled), q) });
  } catch (e) {
    return tagoFailure(e);
  }
}
