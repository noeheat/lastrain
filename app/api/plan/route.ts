// GET /api/plan?origin=<역 이름>&dest=<역 이름>&daily=01|02|03[&originLine=&destLine=] → { plan: PlanResult | null, routes }
// 노선이 달라 환승이 필요할 때 쓴다. daily는 클라이언트가 운행일 기준으로 보낸다 (/api/last-train과 같음)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { rateLimit } from '@/lib/rateLimit';
import { PlanQuerySchema } from '@/lib/schema';
import { planTransfer } from '@/lib/plan';

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 'plan');
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const parsed = PlanQuerySchema.safeParse({
    origin: sp.get('origin'), dest: sp.get('dest'), daily: sp.get('daily'),
    originLine: sp.get('originLine') ?? undefined, destLine: sp.get('destLine') ?? undefined,
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? '잘못된 요청이에요' }, 400);
  const { origin, dest, daily, originLine, destLine } = parsed.data;
  try {
    return json(await planTransfer(origin, dest, daily, originLine, destLine));
  } catch (e) {
    console.error(e);
    const config = e instanceof Error && e.message.includes('설정되지 않았어요');
    return json({ error: config ? `${(e as Error).message}.` : '경로를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, config ? 500 : 502);
  }
}
