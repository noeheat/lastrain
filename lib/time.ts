// 막차 시간 계산 (DOM 없음, 서버·클라이언트·테스트 공용)

export const DAY_START_MIN = 4 * 60; // 운행일 경계 04:00
export const BUFFER_MIN = 5;
const MIN = 60_000;

export type Level = 'calm' | 'warn' | 'urgent' | 'go' | 'missed';

export type Person = {
  name: string;
  station: string;
  train: string; // "HH:MM"
  walk: number; // 역까지 도보(분)
};

export type PlanRow = Person & {
  trainAt: Date;
  departAt: Date;
  msToDepart: number;
  msToTrain: number;
  missed: boolean;
};

/** "HH:MM" → 자정 기준 분. 잘못된 값이면 null */
export function parseHHMM(str: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** 현재 운행일의 자정(달력 날짜). 04:00 이전이면 전날이 운행일이다. */
export function serviceDay(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() * 60 + now.getMinutes() < DAY_START_MIN) d.setDate(d.getDate() - 1);
  return d;
}

/** 막차 시각을 절대 Date로. 04:00 이전 시각(예: 00:30)은 운행일 다음 날로 본다. */
export function trainTime(hhmm: string, now: Date): Date | null {
  let m = parseHHMM(hhmm);
  if (m == null) return null;
  if (m < DAY_START_MIN) m += 24 * 60;
  const d = serviceDay(now);
  // 분이 1440을 넘으면 Date가 다음 날로 넘겨준다
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m);
}

export function departTime(train: Date, walkMin: number): Date {
  return new Date(train.getTime() - (walkMin + BUFFER_MIN) * MIN);
}

/** 출발까지 남은 ms → 색 단계 */
export function levelFor(ms: number): Exclude<Level, 'missed'> {
  if (ms <= 0) return 'go';
  if (ms <= 10 * MIN) return 'urgent';
  if (ms <= 30 * MIN) return 'warn';
  return 'calm';
}

/** lead: 아직 막차가 남은 사람 중 출발이 가장 이른 사람의 index (없으면 -1) */
export function computePlan(people: Person[], now: Date): { rows: PlanRow[]; lead: number; level: Level } {
  const rows: PlanRow[] = people.map((p) => {
    // 입력은 저장 전에 검증되므로 null이 아니다
    const train = trainTime(p.train, now)!;
    const depart = departTime(train, p.walk);
    return {
      ...p,
      trainAt: train,
      departAt: depart,
      msToDepart: depart.getTime() - now.getTime(),
      msToTrain: train.getTime() - now.getTime(),
      missed: train <= now,
    };
  });

  let lead = -1;
  rows.forEach((r, i) => {
    if (r.missed) return;
    if (lead === -1 || r.departAt < rows[lead]!.departAt) lead = i;
  });

  const level: Level = lead === -1 ? 'missed' : levelFor(rows[lead]!.msToDepart);
  return { rows, lead, level };
}

/** 남은 시간 표시: 1시간 이상이면 H:MM:SS, 아니면 MM:SS */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
