// GET /api/bus?origin=<역 이름>&dest=<역 이름>[&originLine=&destLine=] → { options: BusOption[], reasons }
// 출발역에서 도착역까지 버스 한 번으로 가는 서울 버스 막차 (정류장별 막차 예정 시각, 늦게 떠나는 순)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { BusQuerySchema } from '@/lib/schema';
import { busOptions } from '@/lib/seoulBus';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'bus');
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const parsed = BusQuerySchema.safeParse({
    origin: sp.get('origin'), dest: sp.get('dest'),
    originLine: sp.get('originLine') ?? undefined, destLine: sp.get('destLine') ?? undefined,
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? '잘못된 요청이에요' }, 400);
  const { origin, dest, originLine, destLine } = parsed.data;
  try {
    return json(await busOptions(origin, dest, originLine, destLine));
  } catch (e) {
    console.error(e);
    const config = e instanceof Error && e.message.includes('설정되지 않았어요');
    return json({ error: config ? `${(e as Error).message}.` : '버스 막차를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, config ? 500 : 502);
  }
}
