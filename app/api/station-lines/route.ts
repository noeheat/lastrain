// GET /api/station-lines?name=양평&line=경의중앙 → { lines: ["경의중앙선"] | null }
// 이름이 같은 역 중 고른 노선의 역과 같은 곳(500m 안)에 있는 노선들. 출발역을 노선별로 묶을 때 쓴다
// (강남: 2호선·신분당선은 한 역, 양평: 5호선·경의중앙선은 다른 역)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { StationLinesQuerySchema } from '@/lib/schema';
import { colocated } from '@/lib/kakao';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'station-lines');
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const parsed = StationLinesQuerySchema.safeParse({ name: sp.get('name'), line: sp.get('line') });
  if (!parsed.success) return json({ error: '역 이름과 노선을 확인해 주세요' }, 400);
  try {
    return json({ lines: await colocated(parsed.data.name, parsed.data.line) });
  } catch (e) {
    console.error(e);
    return json({ error: '역 위치를 불러오지 못했어요.' }, 502);
  }
}
