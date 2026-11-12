// 서울 지하철 실시간 도착정보(OA-12764, swopenAPI realtimeStationArrival) 다듬기 (DOM·네트워크 없음, 서버·테스트 공용)
// 한 역에서 방향마다 다음 열차 두 대까지만 준다. 막차 여부(lstcarAt)와 열차 번호(btrainNo)가 있어서,
// 서울 시간표(OA-101)로 계산한 막차의 열차 번호와 이어 "그 막차가 지금 몇 초 뒤에 오는지"를 안다 (spike/seoul-arrival.js)

export type ArrivalRow = {
  subwayId?: string; // 1002 = 2호선
  updnLine?: string; // 상행·하행·내선·외선
  btrainNo?: string;
  bstatnNm?: string; // 종착역
  lstcarAt?: string; // '1'이면 막차
  barvlDt?: string; // 도착까지 남은 초 (모르면 '0')
  arvlCd?: string; // 0 진입, 1 도착, 2 출발, 3 전역출발, 4 전역진입, 5 전역도착, 99 운행중
  arvlMsg2?: string; // "4분 20초 후", "전역 도착"
  recptnDt?: string; // "2026-11-12 13:36:32" (서울 시각). 이 시각 기준으로 barvlDt가 계산돼 있다
};

export type Arrival = {
  line: string; // "2호선"
  trainNo: string;
  endName: string;
  last: boolean;
  msg: string;
  departed: boolean; // 이 역을 이미 떠남
  sec: number | null; // 지금(서버 시각)부터 도착까지 남은 초. 모르면 null
};

/** 1~9호선 subwayId (1001~1009) → "N호선". 그 외(신분당 등)는 이 앱에서 열차 번호를 이을 수 없어 버린다 */
export const lineOfSubwayId = (id: string | undefined) => (id && /^100[1-9]$/.test(id) ? `${id.slice(-1)}호선` : null);

const sameNo = (a: string, b: string) => a.replace(/^0+/, '') === b.replace(/^0+/, '');

/** "2026-11-12 13:36:32"(서울 시각) → ms */
export function parseRecptn(s: string | undefined): number | null {
  const m = s?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}+09:00`);
  return Number.isNaN(t) ? null : t;
}

/**
 * 응답 → 화면용. now는 서버 시각(ms). 남은 초는 "수신 시각 + barvlDt − 지금"으로 다시 센다
 * (수신 시각이 몇 분 묵은 값일 때가 있어서, 받은 순간 기준으로 세면 늦게 온다고 착각한다)
 */
export function parseArrivals(rows: ArrivalRow[], now: number): Arrival[] {
  const out: Arrival[] = [];
  for (const r of rows) {
    const line = lineOfSubwayId(r.subwayId);
    if (!line || !r.btrainNo) continue;
    const code = r.arvlCd ?? '';
    const recptn = parseRecptn(r.recptnDt);
    const barvl = Number(r.barvlDt);
    let sec: number | null = null;
    if (recptn != null && code === '0') sec = Math.round((recptn - now) / 1000); // 진입 중: 곧
    else if (recptn != null && code === '1') sec = Math.round((recptn - now) / 1000); // 도착
    else if (recptn != null && barvl > 0) sec = Math.round((recptn + barvl * 1000 - now) / 1000);
    out.push({
      line, trainNo: r.btrainNo, endName: r.bstatnNm ?? '', last: r.lstcarAt === '1',
      msg: (r.arvlMsg2 ?? '').trim(), departed: code === '2', sec,
    });
  }
  return out;
}

/** 저장한 막차(노선·열차 번호)에 해당하는 실시간 열차. 다음 두 대 안에 없으면 null */
export function findTrain(arrivals: Arrival[], line: string, trainNo: string): Arrival | null {
  return arrivals.find((a) => a.line === line && sameNo(a.trainNo, trainNo)) ?? null;
}
