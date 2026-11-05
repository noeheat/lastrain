'use client';

import { useEffect, useState } from 'react';
import { computePlan, formatClock, formatRemaining, type Person } from '@/lib/time';
import { isStale, type Origin } from '@/lib/origin';
import { MAX_PEOPLE } from '@/lib/schema';

type Props = {
  origin: Origin;
  people: Person[];
  nowOffset: number;
  onEditOrigin: () => void;
  onEditPerson: (index: number) => void;
  onAdd: () => void;
};

/** 홈 화면: 출발역, 가장 급한 사람의 카운트다운, 사람 카드(누르면 편집), 사람 추가 */
export function Countdown({ origin, people, nowOffset, onEditOrigin, onEditPerson, onAdd }: Props) {
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

  // 출발역이 바뀌어 막차가 맞지 않는 사람은 카운트다운에서 뺀다 (카드를 눌러 다시 확인)
  const activeIdx = people.flatMap((p, i) => (isStale(p, origin) ? [] : [i]));
  const { rows, lead, level } = computePlan(activeIdx.map((i) => people[i]!), now);
  const counting = rows.length > 0;

  useEffect(() => {
    document.body.classList.toggle('counting', counting);
    document.body.dataset.level = counting ? level : 'calm';
  }, [counting, level]);

  const onRed = counting && level === 'go';
  const muted = onRed ? 'text-white/75' : 'text-[var(--muted)]';

  return (
    <section className="flex flex-col items-center text-center">
      {origin.text && <button
        type="button"
        onClick={onEditOrigin}
        className={`mb-2 min-h-11 rounded-full border px-4 text-[0.95rem] ${onRed ? 'border-white/50 text-white' : 'border-[var(--border)] text-[var(--text)]'}`}
      >
        {origin.text}에서 출발 <span className={muted}>· 바꾸기</span>
      </button>}

      {!origin.text ? (
        <Empty title="어디서 출발하나요?" body="함께 있는 곳에서 가까운 역을 고르면, 각자 막차에 맞춰 언제 일어나야 하는지 알려줘요.">
          <button type="button" onClick={onEditOrigin} className="mt-6 block min-h-[52px] w-full rounded-xl bg-[var(--accent)] text-[1.05rem] font-semibold text-[#06121f]">
            출발역 고르기
          </button>
        </Empty>
      ) : people.length === 0 ? (
        <Empty title="누구의 막차를 볼까요?" body="사람마다 집 근처 역을 넣으면 막차를 자동으로 찾아요." />
      ) : (
        <Clock rows={rows} lead={lead} level={level} onRed={onRed} />
      )}

      {people.length > 0 && (
        <ul className="grid w-full gap-2.5">
          {people.map((p, i) => {
            const k = activeIdx.indexOf(i);
            const r = k >= 0 ? rows[k]! : null;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onEditPerson(i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white/5 px-4 py-3.5 text-left ${
                    r && k === lead ? 'border-[var(--state)]' : 'border-white/10'
                  } ${r?.missed ? 'opacity-55' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{p.name}</div>
                    <div className={`mt-0.5 text-[0.85rem] ${muted}`}>
                      {r
                        ? `${p.dest?.name ?? p.station} · 막차 ${formatClock(r.trainAt)} · 도보 ${p.walk}분 · ${formatClock(r.departAt)} 출발`
                        : '출발역이 바뀌었어요 · 눌러서 막차 다시 확인'}
                    </div>
                  </div>
                  <div className="font-semibold whitespace-nowrap tabular-nums">
                    {!r ? '확인' : r.missed ? '놓침' : r.msToDepart <= 0 ? '출발!' : formatRemaining(r.msToDepart)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {origin.text && people.length < MAX_PEOPLE && (
        <button
          type="button"
          onClick={onAdd}
          className={`mt-3 block min-h-[52px] w-full rounded-xl border border-dashed text-[1.05rem] font-semibold ${
            onRed ? 'border-white/50 text-white' : 'border-[var(--border)] text-[var(--muted)]'
          }`}
        >
          + 사람 추가
        </button>
      )}
    </section>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="my-10 w-full px-2">
      <p className="m-0 text-[1.3rem] font-bold">{title}</p>
      <p className="mt-2 text-[0.95rem] text-[var(--muted)]">{body}</p>
      {children}
    </div>
  );
}

type ClockProps = { rows: ReturnType<typeof computePlan>['rows']; lead: number; level: string; onRed: boolean };

function Clock({ rows, lead, level, onRed }: ClockProps) {
  const r = rows[lead];
  let label: string;
  let clock: string;
  let sub: string;
  if (rows.length === 0) {
    label = '막차를 다시 확인해 주세요';
    clock = '--:--';
    sub = '출발역이 바뀐 사람의 카드를 눌러 주세요';
  } else if (!r) {
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
  const isText = !r;
  return (
    <div className="pt-[5vh]">
      <p className={`m-0 text-[1.1rem] opacity-90 ${onRed ? 'text-white' : 'text-[var(--state)]'}`}>{label}</p>
      <p
        className={`clock my-2 leading-none font-bold tracking-[-0.02em] tabular-nums text-[var(--state)] transition-colors duration-500 ${
          isText || level === 'go' ? 'text-[clamp(3rem,16vw,6rem)]' : 'text-[clamp(4rem,24vw,9rem)]'
        }`}
      >
        {clock}
      </p>
      <p className={`mb-8 text-[0.95rem] ${onRed ? 'text-white' : 'text-[var(--muted)]'}`}>{sub}</p>
    </div>
  );
}
