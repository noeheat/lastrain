'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { computePlan, formatClock, formatRemaining, levelFor, trainTime, type Level, type Person, type PlanRow } from '@/lib/time';
import { isStale, type Origin } from '@/lib/origin';
import { MAX_PEOPLE } from '@/lib/schema';
import { legName, lineLabel } from '@/lib/transfer';
import { fieldColor, lineBadge, lineColor } from '@/lib/lineColor';
import { BusLive } from './BusLive';
import { ChevronDownIcon, PencilIcon, PlusIcon, RouteIcon } from './Icons';

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

const MISSED_FIELD = '#15171b';

/** 저장한 막차 경로 (직접 입력한 시각이거나 예전 저장값이면 없음) */
const routeOf = (p: Person) => (p.route?.[0]?.dep === p.train ? p.route : undefined);

/** 처음 탈 노선 (경로가 없으면 도착역 노선) */
const firstLeg = (p: Person) => routeOf(p)?.[0] ?? (p.dest ? { line: p.dest.line } : undefined);

/** 그 사람 화면의 바탕색: 처음 탈 노선의 색. 막차를 놓치면 노선색이 빠진다 (다시 확인은 색을 유지) */
function fieldOf(it: Item): string {
  if (it.row?.missed) return MISSED_FIELD;
  return fieldColor(lineColor(firstLeg(it.person)));
}

/**
 * 홈 화면: 한 사람이 화면 전체를 차지하는 세로 피드. 위로 넘기면 다음 사람.
 * 처음엔 가장 급한 사람에서 시작한다. 사람 순서는 바꾸지 않는다(넘기는 중에 자리가 움직이지 않게).
 */
export function Countdown({ origin, people, nowOffset, onEditOrigin, onEditPerson, onAdd }: Props) {
  const [now, setNow] = useState(() => new Date(Date.now() + nowOffset));
  const [current, setCurrent] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

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

  // 처음 열 때 가장 급한 사람 화면으로 (한 번만. 그 뒤로는 사용자가 넘긴 자리를 지킨다)
  useLayoutEffect(() => {
    const el = scroller.current;
    if (started.current || !el || people.length === 0) return;
    started.current = true;
    const slide = el.children[leadIdx] as HTMLElement | undefined;
    if (slide) el.scrollTop = slide.offsetTop;
    setCurrent(leadIdx);
  }, [leadIdx, people.length]);

  const onScroll = () => {
    const el = scroller.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const i = Math.min(people.length - 1, Math.round(el.scrollTop / first.offsetHeight));
    if (i !== current) setCurrent(i);
  };
  const jump = (i: number) => {
    const slide = scroller.current?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // 상태 표시줄(iOS·안드로이드) 색도 보고 있는 사람 화면색에 맞춘다
  const shown = items[Math.min(current, items.length - 1)];
  const top = shown ? fieldOf(shown) : '#0b0d10';
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
  }, [top]);

  const originLabel = origin.text ? (origin.text.endsWith('역') ? origin.text : `${origin.text}역`) : '';

  return (
    // 넓은 화면에서도 휴대폰 폭 한 장으로 (피드는 가운데 세로 한 줄)
    <div className="fixed inset-0 bg-[#0b0d10] text-white">
    <div className="relative mx-auto h-full max-w-[520px] overflow-hidden">
      {!origin.text ? (
        <Empty
          title="어디서 헤어지나요?"
          body="지금 같이 있는 곳에서 가까운 역을 고르면, 각자 막차까지 남은 시간을 세어 드려요."
          action="출발역"
          onAction={onEditOrigin}
        />
      ) : people.length === 0 ? (
        <Empty
          title="누구 막차부터 볼까요?"
          body="사람마다 집 근처 역을 넣으면 막차를 알아서 찾아요. 여섯 명까지 돼요."
          action="추가"
          onAction={onAdd}
        />
      ) : (
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((it, i) => (
            <Slide
              key={i}
              item={it}
              now={now}
              field={fieldOf(it)}
              first={i === 0}
              next={items[i + 1]}
              canAdd={people.length < MAX_PEOPLE}
              onEdit={() => onEditPerson(i)}
              onAdd={onAdd}
            />
          ))}
        </div>
      )}

      {origin.text && (
        <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onEditOrigin}
            className="pointer-events-auto flex min-h-11 items-center gap-1.5 px-3 text-[0.95rem] font-semibold [text-shadow:0_1px_8px_rgba(0,0,0,.25)]"
          >
            {originLabel}에서{people.length > 0 && <span className="font-normal text-white/80">· {people.length}명</span>}
            <ChevronDownIcon className="text-white/80" />
          </button>
        </header>
      )}

      {people.length > 1 && (
        <nav aria-label="사람 넘기기" className="absolute top-1/2 right-0.5 flex -translate-y-1/2 flex-col">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${it.person.name} 보기`}
              aria-current={i === current}
              onClick={() => jump(i)}
              className="flex h-7 w-6 items-center justify-center"
            >
              <span className={`w-1 rounded-full transition-[height,background-color] duration-300 ${i === current ? 'h-6 bg-white' : 'h-3 bg-white/40'}`} />
            </button>
          ))}
        </nav>
      )}
    </div>
    </div>
  );
}

type SlideProps = {
  item: Item;
  now: Date;
  field: string;
  first: boolean;
  next: Item | undefined;
  canAdd: boolean;
  onEdit: () => void;
  onAdd: () => void;
};

/** 한 사람 화면: 가운데 큰 남은 시간, 왼쪽 아래 캡션, 오른쪽 버튼 레일 */
function Slide({ item, now, field, first, next, canAdd, onEdit, onAdd }: SlideProps) {
  const { person, row, level } = item;
  const [routeOpen, setRouteOpen] = useState(false);
  const dest = person.dest?.name ?? '';
  const route = routeOf(person);
  const one = route?.length === 1 ? route[0]! : null;
  // 첫 구간이 버스면 실시간 막차 도착을 받아, 예정보다 일찍 오면 카운트다운을 앞당긴다 (늦어지면 안내만)
  const firstBus = route?.[0]?.kind === 'bus' && route[0].arsId && route[0].routeId ? route[0] : null;
  // 한 번 본 실시간 막차 시각은 기억한다. 막차가 지나가면 실시간 응답에서 사라지는데, 그때 시간표로 되돌아가면 안 된다
  const [liveFirst, setLiveFirst] = useState<Date | null>(null);
  const [liveEnded, setLiveEnded] = useState(false);
  const onFirstLive = ({ lastAt, ended }: { lastAt: Date | null; ended: boolean }) => {
    if (lastAt) setLiveFirst(lastAt);
    setLiveEnded(ended);
  };
  const earlier = row && !row.missed && liveFirst && liveFirst < row.trainAt ? liveFirst : null;
  // 실시간 막차가 1분 넘게 지났거나(곧 도착은 아직 탈 수 있다), 오늘 운행이 끝났으면 놓침
  const livePassed = !!row && !row.missed && (liveEnded || (!!earlier && earlier.getTime() < now.getTime() - 60_000));

  let clock: string;
  let status: string;
  let sub: string;
  if (!row) {
    clock = '--:--'; // 예전 출발역 기준 막차는 맞지 않는다. 남은 시간으로 읽히지 않게 숫자를 비운다
    status = '출발역이 바뀌었어요';
    sub = '다시 확인을 누르면 새 출발역 기준으로 막차를 찾아요';
  } else if (row.missed) {
    clock = formatClock(row.trainAt);
    status = '막차가 떠났어요';
    sub = '택시나 심야버스를 찾아볼 시간이에요';
  } else if (livePassed) {
    clock = formatClock(earlier ?? row.trainAt);
    status = earlier ? '실시간 막차가 지나갔어요' : '실시간으로 보니 오늘 운행이 끝났어요';
    sub = earlier ? `예정 ${formatClock(row.trainAt)}보다 일찍 왔어요 · 택시나 심야버스를 찾아보세요` : '택시나 심야버스를 찾아보세요';
  } else {
    clock = formatRemaining(earlier ? earlier.getTime() - now.getTime() : row.msToTrain);
    status = level === 'urgent' ? '남았어요 · 이제 역으로' : level === 'warn' ? '남았어요 · 슬슬 일어날 시간' : '남았어요';
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
  const running = !!row && !row.missed && !livePassed;
  const gone = !!row && !running; // 막차가 떠남: 떠난 시각을 줄을 그어 남긴다
  const multi = !!route && route.length > 1;
  // 숫자 길이에 맞춰 한 줄에 들어가게 (MM:SS·HH:MM은 5자, H:MM:SS는 7자)
  const size = clock.length > 5 ? 'text-[min(28vw,7.5rem)]' : 'text-[min(36vw,9rem)]';
  // 10분 안이면 아래에서 붉은 그늘이 차오른다. 남은 시간이 줄수록 높아지되(30→45%), 숫자·상태 줄에는 닿지 않는다
  const msLeft = running && row ? (earlier ? earlier.getTime() - now.getTime() : row.msToTrain) : 0;
  const rise = running && level === 'urgent' ? 30 + 15 * (1 - Math.max(0, Math.min(1, msLeft / 600_000))) : 0;
  const leg = firstLeg(person);
  // 노선 원도 바탕과 같은 규칙: 흰 글자 대비가 나올 때까지만 어둡게 (9호선 베이지·수인분당 노랑)
  const badgeColor = fieldColor(lineColor(leg));
  const bottom = 'calc(max(20px, env(safe-area-inset-bottom)) + 28px)';

  return (
    <section
      aria-label={`${person.name}${dest ? ` → ${dest}` : ''}`}
      data-lv={level}
      className={`relative snap-start overflow-hidden ${first ? '' : 'rounded-t-[22px]'}`}
      style={{
        // 한 장 = 화면 전체. 다음 사람을 아래에 살짝 보이게 했더니 주소창이 아래에 있는 브라우저(삼성 인터넷·엣지)에서
        // 화면이 잘린 것처럼 보였다. 넘길 수 있다는 표시는 오른쪽 점과 '다음 · 이름' 태그가 맡는다
        height: '100dvh',
        backgroundColor: field,
        // 색 바탕 위 보조 글자는 회색이 아니라 흰색을 덜어 쓴다 (BusLive 등 하위 컴포넌트도 이 값을 쓴다)
        ['--muted' as string]: 'rgba(255,255,255,.85)',
        ['--state' as string]: '#ffffff',
        ['--error' as string]: '#ffe1e1',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-[#8f1020] transition-[height] duration-1000 ease-linear"
        style={{ height: `${rise}%` }}
      />

      <div className="absolute inset-x-0 top-[29%] px-5 text-center">
        <p
          className={`m-0 font-[family-name:var(--font-num)] leading-[0.92] font-semibold tracking-[-0.01em] tabular-nums ${size} ${
            running ? '' : 'text-white/45'
          } ${gone ? 'line-through decoration-[0.06em]' : ''}`}
          aria-live="off"
        >
          {clock}
        </p>
        <p className="mt-3 text-[0.95rem] font-semibold">{status}</p>
        {earlier && running && (
          <p className="mx-auto mt-3 w-fit rounded-full border border-white/80 px-3 py-1 text-[0.8rem] font-semibold">
            실시간 막차가 일찍 와서 앞당겼어요
          </p>
        )}
      </div>

      <div className="absolute left-5 right-[84px]" style={{ bottom }}>
        <h2 className="m-0 flex items-center gap-2.5 text-[1.15rem] font-bold">
          {leg && (
            <span
              aria-label={legName(leg)}
              className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border-2 border-white px-1.5 text-[0.8rem] leading-none font-bold"
              style={{ backgroundColor: badgeColor ?? 'transparent' }}
            >
              {lineBadge(leg)}
            </span>
          )}
          <span>{person.name}{dest && <span className="font-semibold"> → {dest}</span>}</span>
        </h2>
        <p className="mt-1.5 text-[0.92rem] leading-snug text-white/90">{sub}</p>
        {running && multi && !routeOpen && (
          <p className="mt-1 text-[0.85rem] text-white/85">{route.map((l) => legName(l)).join(' → ')}</p>
        )}
        {running && one && firstBus && (
          <BusLive arsId={firstBus.arsId!} routeId={firstBus.routeId!} line={firstBus.line} due={row.trainAt} now={now} onLive={onFirstLive} />
        )}
        {running && multi && routeOpen && (
          <ol className="mt-2.5 space-y-1.5 text-[0.85rem]">
            {route.map((l, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ backgroundColor: lineColor(l) ?? 'transparent' }} />
                <span>
                  <span className="font-semibold">{legName(l)}</span> {l.from} {l.dep} → {l.to}{l.arr ? ` ${l.arr}` : ''}
                  {l.estimated ? ' (추정)' : ''}{l.endName && <span className="text-white/85"> · {l.endName}행</span>}
                  {l.kind === 'bus' && l.arsId && l.routeId && (() => {
                    const due = trainTime(l.dep, now);
                    return due && (
                      <BusLive arsId={l.arsId} routeId={l.routeId} line={l.line} due={due} now={now}
                        onLive={i === 0 ? onFirstLive : undefined} />
                    );
                  })()}
                </span>
              </li>
            ))}
          </ol>
        )}
        {next && (
          <p className="mt-3 w-fit rounded-md bg-black/25 px-2 py-1 text-[0.78rem] font-semibold tabular-nums">
            다음 · {next.person.name} {shortStatus(next)}
          </p>
        )}
      </div>

      <div className="absolute right-3 flex flex-col items-center gap-4" style={{ bottom }}>
        <RailButton label={row ? '수정' : '다시 확인'} strong={!row} onClick={onEdit}><PencilIcon /></RailButton>
        {running && multi && (
          <RailButton label="경로" pressed={routeOpen} onClick={() => setRouteOpen((v) => !v)}><RouteIcon /></RailButton>
        )}
        {canAdd && <RailButton label="추가" onClick={onAdd}><PlusIcon /></RailButton>}
      </div>
    </section>
  );
}

/** 다음 사람 태그·점 버튼에 들어가는 짧은 상태 */
function shortStatus({ row }: Item): string {
  if (!row) return '확인 필요';
  if (row.missed) return '놓침';
  return formatRemaining(row.msToTrain);
}

type RailProps = { label: string; onClick: () => void; pressed?: boolean; strong?: boolean; children: React.ReactNode };

function RailButton({ label, onClick, pressed, strong, children }: RailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="group flex w-14 flex-col items-center gap-1 text-[0.75rem] font-semibold"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-white transition-[background-color,color,transform] duration-200 group-active:scale-95 ${
          pressed || strong ? 'bg-white text-[#0b0d10]' : 'bg-black/15 group-hover:bg-white/15'
        }`}
      >
        {children}
      </span>
      {label}
    </button>
  );
}

/** 빈 상태도 피드 한 장: 숫자 자리는 비워 두고, 할 일은 오른쪽 레일 버튼 하나 */
function Empty({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  const bottom = 'calc(max(20px, env(safe-area-inset-bottom)) + 28px)';
  return (
    <section className="relative h-dvh bg-[#1b1e24]">
      <p className="absolute inset-x-0 top-0 m-0 pt-[max(24px,env(safe-area-inset-top))] text-center text-[0.95rem] font-semibold text-white/85">막차 카운트다운</p>
      <div aria-hidden className="absolute inset-x-0 top-[29%] text-center font-[family-name:var(--font-num)] text-[min(36vw,9rem)] leading-[0.92] font-semibold text-white/15 tabular-nums">
        --:--
      </div>
      <div className="absolute left-5 right-[84px]" style={{ bottom }}>
        <h1 className="m-0 text-[1.45rem] leading-tight font-bold">{title}</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-white/85">{body}</p>
      </div>
      <div className="absolute right-3" style={{ bottom }}>
        <RailButton label={action} strong onClick={onAction}><PlusIcon /></RailButton>
      </div>
    </section>
  );
}
