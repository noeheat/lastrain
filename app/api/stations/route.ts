// GET /api/stations?q=강남 → { stations: [{ id, name, line }] }
// "강남역"처럼 '역'을 붙여도 찾는다 (lib/stationSearch.ts)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { StationQuerySchema } from '@/lib/schema';
import { rankStations, searchTerms } from '@/lib/stationSearch';
import { searchStations, tagoFailure } from '@/lib/tago';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'stations');
  if (limited) return limited;
  const parsed = StationQuerySchema.safeParse({ q: req.nextUrl.searchParams.get('q') ?? '' });
  if (!parsed.success) return json({ error: '역 이름을 1~20자로 입력해 주세요' }, 400);
  try {
    const { q } = parsed.data;
    const lists = await Promise.all(searchTerms(q).map(searchStations));
    return json({ stations: rankStations(lists, q) });
  } catch (e) {
    return tagoFailure(e);
  }
}
