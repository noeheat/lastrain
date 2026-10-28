'use client';

import { useEffect, useState } from 'react';
import { computePlan, formatClock, formatRemaining, type Person } from '@/lib/time';

export function Countdown({ people, nowOffset, onEdit }: { people: Person[]; nowOffset: number; onEdit: () => void }) {
  const [now, setNow] = useState(() => new Date(Date.now() + nowOffset));

  // 초 경계에 맞춰 갱신하고, 탭이 숨겨지면 멈췄다가 돌아오면 즉시 다시 계산
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const t = new Date(Date.now() + nowOffset);
      setNow(t);
      timer = setTimeout(tick, 1000 - (t.getMilliseconds() % 1000) + 5);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) tick();
    };
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [nowOffset]);

  const { rows, lead, level } = computePlan(people, now);

  useEffect(() => {
    document.body.dataset.level = level;
  }, [level]);

  let label: string;
  let clock: string;
  let sub: string;
  const r = rows[lead];
  if (!r) {
    label = '오늘 막차는 모두 지났어요';
    clock = '막차 끝';
    sub = '택시나 심야버스를 찾아보세요';
  } else if (level === 'go') {
    label = `${r.name} 출발 시각이 지났어요`;
    clock = '지금 출발!';
    sub = `${r.station} 막차 ${formatClock(r.trainAt)}까지 ${formatRemaining(r.msToTrain)}`;
  } else {
    label = `${r.name} 출발까지`;
    clock = formatRemaining(r.msToDepart);
    sub = `${formatClock(r.departAt)}에 출발 · ${r.station} 막차 ${formatClock(r.trainAt)}`;
  }
  const isText = !r || level === 'go';
  const onRed = level === 'go';

  return (
    <section className="flex flex-col items-center pt-[8vh] text-center">
      <p className={`m-0 text-[1.1rem] opacity-90 ${onRed ? 'text-white' : 'text-[var(--state)]'}`}>{label}</p>
      <p
        className={`clock my-2 leading-none font-bold tracking-[-0.02em] tabular-nums text-[var(--state)] transition-colors duration-500 ${
          isText ? 'text-[clamp(3rem,16vw,6rem)]' : 'text-[clamp(4rem,24vw,9rem)]'
        }`}
      >
        {clock}
      </p>
      <p className={`mb-8 text-[0.95rem] ${onRed ? 'text-white' : 'text-[var(--muted)]'}`}>{sub}</p>

      <ul className="grid w-full gap-2.5">
        {rows.map((p, i) => (
          <li
            key={i}
            className={`flex items-center justify-between gap-3 rounded-xl border bg-white/5 px-4 py-3.5 text-left ${
              i === lead ? 'border-[var(--state)]' : 'border-white/10'
            } ${p.missed ? 'opacity-55' : ''}`}
          >
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className={`mt-0.5 text-[0.85rem] ${onRed ? 'text-white/75' : 'text-[var(--muted)]'}`}>
                {p.station} · 막차 {formatClock(p.trainAt)} · 도보 {p.walk}분 · {formatClock(p.departAt)} 출발
              </div>
            </div>
            <div className="font-semibold whitespace-nowrap tabular-nums">
              {p.missed ? '놓침' : p.msToDepart <= 0 ? '출발!' : formatRemaining(p.msToDepart)}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onEdit}
        className={`mt-7 block min-h-[52px] w-full rounded-xl border bg-transparent text-[1.05rem] font-semibold ${
          onRed ? 'border-white/50 text-white' : 'border-[var(--border)] text-[var(--muted)]'
        }`}
      >
        수정
      </button>
    </section>
  );
}
