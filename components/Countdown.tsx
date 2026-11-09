'use client';

import { useEffect, useRef, useState } from 'react';
import { computePlan, formatClock, formatRemaining, levelFor, type Level, type Person, type PlanRow } from '@/lib/time';
import { isStale, type Origin } from '@/lib/origin';
import { MAX_PEOPLE } from '@/lib/schema';
import { legName, lineLabel } from '@/lib/transfer';

type Props = {
  origin: Origin;
  people: Person[];
  nowOffset: number;
  onEditOrigin: () => void;
  onEditPerson: (index: number) => void;
  onAdd: () => void;
};

// 한 사람의 상태. row가 없으면 출발역이 바뀌어 막차를 다시 확인해야 하는 사람
type Item = { person: Person; row: PlanRow | null; level: Level };

const levelOf = (row: PlanRow | null): Level =>
  !row ? 'missed' : row.missed ? 'missed' : levelFor(row.msToTrain);

/**
 * 홈 화면: 출발역, 한 사람씩 넘겨 보는 큰 카운트다운, 사람 칩(각자 남은 시간·색), 사람 추가.
 * 직접 넘기기 전에는 가장 급한 사람을 보여주고, 그 사람이 바뀌면(막차를 놓침 등) 따라간다.
 */
export function Countdown({ origin, people, nowOffset, onEditOrigin, onEditPerson, onAdd }: Props) {
  const [now, setNow] = useState(() => new Date(Date.now() + nowOffset));
  const [picked, setPicked] = useState<number | null>(null); // 직접 고른 사람 (null이면 가장 급한 사람)

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

  // 출발역이 바뀌어 막차가 맞지 않는 사람은 계산에서 뺀다 (수정해서 다시 확인)
  const activeIdx = people.flatMap((p, i) => (isStale(p, origin) ? [] : [i]));
  const { rows, lead } = computePlan(activeIdx.map((i) => people[i]!), now);
  const items: Item[] = people.map((person, i) => {
    const k = activeIdx.indexOf(i);
    const row = k >= 0 ? rows[k]! : null;
    return { person, row, level: levelOf(row) };
  });

  const leadIdx = lead >= 0 ? activeIdx[lead]! : 0;
  const current = picked != null && picked < people.length ? picked : leadIdx;
  const item = items[current];
  const level: Level = item ? item.level : 'calm';

  useEffect(() => {
    document.body.classList.toggle('counting', !!item);
    document.body.dataset.level = level;
  }, [item, level]);

  const go = (step: number) => setPicked((current + step + people.length) % people.length);

  return (
    <section className="flex flex-col items-center text-center">
      {origin.text && (
        <button
          type="button"
          onClick={onEditOrigin}
          className="mb-2 min-h-11 rounded-full border px-4 text-[0.95rem] border-[var(--border)] text-[var(--text)]"
        >
          {origin.text}에서 출발 <span className="text-[var(--muted)]">· 바꾸기</span>
        </button>
      )}

      {!origin.text ? (
        <Empty title="어디서 출발하나요?" body="함께 있는 곳에서 가까운 역을 고르면, 각자 막차에 맞춰 언제 일어나야 하는지 알려줘요.">
          <button type="button" onClick={onEditOrigin} className="mt-6 block min-h-[52px] w-full rounded-xl bg-[var(--accent)] text-[1.05rem] font-semibold text-[#06121f]">
            출발역 고르기
          </button>
        </Empty>
      ) : !item ? (
        <Empty title="누구의 막차를 볼까요?" body="사람마다 집 근처 역을 넣으면 막차를 자동으로 찾아요." />
      ) : (
        <Focus
          item={item}
          count={people.length}
          index={current}
          onStep={go}
          onEdit={() => onEditPerson(current)}
        />
      )}

      {origin.text && (
        <div className="mt-2 flex w-full flex-wrap justify-center gap-2">
          {people.length > 1 && items.map((it, i) => (
            <button
              key={i}
              type="button"
              data-lv={it.level}
              aria-pressed={i === current}
              onClick={() => setPicked(i)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[0.95rem] tabular-nums ${
                i === current
                  ? 'border-[var(--lv)] text-[var(--text)]'
                  : 'border-white/10 text-[var(--muted)]'
              }`}
            >
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--lv)]" />
              {it.person.name} <span className="font-semibold">{shortStatus(it)}</span>
            </button>
          ))}
          {people.length < MAX_PEOPLE && (
            <button
              type="button"
              onClick={onAdd}
              className={`min-h-11 rounded-full border border-dashed border-[var(--border)] px-3.5 text-[0.95rem] text-[var(--muted)] ${
                people.length === 0 ? 'w-full min-h-[52px] rounded-xl text-[1.05rem] font-semibold' : ''
              }`}
            >
              + 사람 추가
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** 칩에 들어가는 짧은 상태 */
function shortStatus({ row }: Item): string {
  if (!row) return '확인';
  if (row.missed) return '놓침';
  return formatRemaining(row.msToTrain);
}

type FocusProps = { item: Item; count: number; index: number; onStep: (step: number) => void; onEdit: () => void };

/** 한 사람의 큰 카운트다운. 좌우로 밀거나 ‹ › 로 다음 사람 */
function Focus({ item, count, index, onStep, onEdit }: FocusProps) {
  const { person, row } = item;
  const startX = useRef<number | null>(null);
  const dest = person.dest?.name ?? '';
  // 저장한 막차 경로 (직접 입력한 시각이거나 예전 저장값이면 없음)
  const route = person.route?.[0]?.dep === person.train ? person.route : undefined;
  const one = route?.length === 1 ? route[0]! : null;

  let clock: string;
  let sub: string;
  if (!row) {
    clock = '--:--';
    sub = '출발역이 바뀌었어요. 막차를 다시 확인해 주세요';
  } else if (row.missed) {
    clock = '놓침';
    sub = `막차 ${formatClock(row.trainAt)}가 지났어요 · 택시나 심야버스를 찾아보세요`;
  } else {
    clock = formatRemaining(row.msToTrain);
    if (one?.kind === 'bus') {
      // 버스는 역이 아니라 정류장에서 탄다. 정류장별 막차는 시간표상 예정 시각
      sub = `${one.from}에서 ${formatClock(row.trainAt)}에 떠나는 ${one.line}번 버스 막차${one.estimated ? ' (추정)' : ''}`;
    } else {
      const what = one ? `${lineLabel(one.line)} ${one.endName}행 막차` : route ? `막차 · 환승 ${route.length - 1}번` : '막차';
      // 버스로 시작하는 환승 경로는 역이 아니라 첫 정류장에서 탄다
      const where = route?.[0]?.kind === 'bus' ? `${route[0].from}(${route[0].line}번 버스)` : row.station;
      sub = `${where}에서 ${formatClock(row.trainAt)}에 떠나는 ${what}`;
    }
  }
  const isText = !row || row.missed;
  const arrow = 'min-h-11 min-w-11 text-[1.6rem] leading-none text-[var(--muted)]';

  return (
    <div
      className="w-full touch-pan-y pt-[4vh] pb-4 select-none"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        const dx = startX.current == null ? 0 : e.clientX - startX.current;
        startX.current = null;
        if (count > 1 && Math.abs(dx) > 50) onStep(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between">
        {count > 1 ? <button type="button" aria-label="이전 사람" onClick={() => onStep(-1)} className={arrow}>‹</button> : <span />}
        <p className="m-0 text-[1.1rem] text-[var(--state)]">
          {person.name}{dest && <span className="text-[var(--muted)]"> → {dest}</span>}
        </p>
        {count > 1 ? <button type="button" aria-label="다음 사람" onClick={() => onStep(1)} className={arrow}>›</button> : <span />}
      </div>
      <p
        aria-live="off"
        className={`clock my-2 leading-none font-bold tracking-[-0.02em] tabular-nums text-[var(--state)] transition-colors duration-500 ${
          isText ? 'text-[clamp(3rem,16vw,6rem)]' : 'text-[clamp(4rem,24vw,9rem)]'
        }`}
      >
        {clock}
      </p>
      <p className="m-0 text-[0.95rem] text-[var(--muted)]">{sub}</p>
      {row && !row.missed && route && route.length > 1 && (
        <ol className="mx-auto mt-3 max-w-[340px] space-y-1 text-left text-[0.85rem]">
          {route.map((l, i) => (
            <li key={i} className="rounded-lg border border-white/10 px-3 py-2">
              <span className="font-semibold">{legName(l)}</span> {l.from} {l.dep} → {l.to}{l.arr ? ` ${l.arr}` : ''}
              {l.estimated ? ' (추정)' : ''}{l.endName && <span className="text-[var(--muted)]"> · {l.endName}행</span>}
            </li>
          ))}
        </ol>
      )}
      {count > 1 && (
        <div aria-hidden className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-[var(--state)]' : 'bg-white/25'}`} />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        className={`mt-3 min-h-11 px-3 text-[0.95rem] underline ${!row ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted)]'}`}
      >
        {!row ? '막차 다시 확인' : `${person.name} 수정`}
      </button>
    </div>
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
