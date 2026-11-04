// GET /api/last-train?origin=<역ID>&dest=<역ID>&daily=01|02|03 → LastTrainResult
// daily(요일)는 클라이언트가 자기 시계로 운행일을 계산해 보낸다 (서버는 UTC라서)

import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { LastTrainQuerySchema } from '@/lib/schema';
import { DIRS, findLastTrain, toTrains, type LastTrainResult } from '@/lib/reach';
import { stationTimetables, tagoFailure, type TimetableRow } from '@/lib/tago';
import { seoulLastTrain } from '@/lib/seoul';

const CANDIDATES = 6;

const endIds = (rows: TimetableRow[]) =>
  new Set(rows.flatMap((r) => (r.endSubwayStationId ? [r.endSubwayStationId] : [])));

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = LastTrainQuerySchema.safeParse({
    origin: sp.get('origin'), dest: sp.get('dest'), daily: sp.get('daily'),
    originName: sp.get('originName') ?? undefined, destName: sp.get('destName') ?? undefined, line: sp.get('line') ?? undefined,
  });
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? '잘못된 요청이에요' }, 400);
  }
  const { origin, dest, daily, originName, destName, line } = parsed.data;

  // 1~9호선은 서울 시간표 먼저 (토요일·휴일이 있고 열차 번호로 판정). 안 되면 TAGO로.
  if (originName && destName && line) {
    const seoul = await seoulLastTrain({ name: originName, line }, { name: destName, line }, daily)
      .catch((e) => (console.error(e), null));
    if (seoul) return json(seoul);
  }

  try {
    const { oU, oD, dU, dD, daily: used } = await stationTimetables(origin, dest, daily);
    const routeId = [...oU, ...oD].find((r) => r.subwayRouteId)?.subwayRouteId;
    if (!routeId) return json({ error: '출발역 시간표가 없어요' }, 404);

    const trains = { U: toTrains(oU, origin), D: toTrains(oD, origin) };
    const found = findLastTrain({
      routeId, originId: origin, destId: dest, origin: trains, destEnds: { U: endIds(dU), D: endIds(dD) },
    });
    const body: LastTrainResult = {
      last: found && { ...found.last, dir: found.dir },
      candidates: Object.fromEntries(DIRS.map((d) => [d, trains[d].slice(-CANDIDATES)])) as LastTrainResult['candidates'],
      daily: used as LastTrainResult['daily'],
    };
    return json(body);
  } catch (e) {
    return tagoFailure(e);
  }
}
