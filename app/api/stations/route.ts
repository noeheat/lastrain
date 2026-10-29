// GET /api/stations?q=강남 → { stations: [{ id, name, line }] }

import type { NextRequest } from 'next/server';
import { StationQuerySchema } from '@/lib/schema';
import { searchStations, tagoFailure } from '@/lib/tago';

export async function GET(req: NextRequest) {
  const parsed = StationQuerySchema.safeParse({ q: req.nextUrl.searchParams.get('q') ?? '' });
  if (!parsed.success) return Response.json({ error: '역 이름을 1~20자로 입력해 주세요' }, { status: 400 });
  try {
    return Response.json({ stations: await searchStations(parsed.data.q) });
  } catch (e) {
    return tagoFailure(e);
  }
}
