'use client';

import { useEffect, useRef, useState } from 'react';
import { serviceDay, type RouteLeg, type StationRef } from '@/lib/time';
import { dailyTypeCode, type LastTrainResult, type Train } from '@/lib/reach';
import { lineLabel } from '@/lib/transfer';
import { LastTrainField } from './LastTrainField';

const DAY_LABEL = { '01': '평일', '02': '토요일', '03': '일요일·공휴일' } as const;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: LastTrainResult };

type Props = {
  origin: StationRef;
  dest: StationRef;
  train: string; // 지금 입력된 막차 시각 (선택 표시용)
  autoFill: boolean; // 역을 새로 골랐을 때만 자동 막차로 덮어쓴다 (수정 화면에서 직접 고친 값 보호)
  onChoose: (time: string, route?: RouteLeg[], auto?: boolean) => void; // auto: 응답이 와서 자동으로 고른 값
  chosen?: { tag: string; detail: string }; // 버스 등 다른 방법으로 정해졌을 때 칸에 보여줄 내용
  invalid?: boolean;
};

/** 출발역→도착역 막차를 /api/last-train에서 받아 자동으로 채우고, 다른 열차도 고를 수 있게 보여준다. */
export function TrainChoices({ origin, dest, train, autoFill, onChoose, invalid, chosen }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const daily = dailyTypeCode(serviceDay(new Date()));

  // onChoose는 렌더마다 새 함수라, 최신 값을 ref로 들고 있다가 응답이 오면 부른다
  const onChooseRef = useRef(onChoose);
  const trainRef = useRef(train);
  useEffect(() => {
    onChooseRef.current = onChoose;
    trainRef.current = train;
  });

  const legOf = (t: Train): RouteLeg[] => [{ line: lineLabel(origin.line), from: origin.name, to: dest.name, dep: t.time, endName: t.endName }];
  // 시각 → 그 시각에 떠나는 열차의 경로. 막차와 같은 시각이면 막차를 고른다
  const routeFor = (r: LastTrainResult, time: string): RouteLeg[] | undefined => {
    const t = r.last?.time === time ? r.last : [...r.candidates.U, ...r.candidates.D].find((c) => c.time === time);
    return t ? legOf(t) : undefined;
  };

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    (async () => {
      try {
        const qs = new URLSearchParams({
          origin: origin.id, dest: dest.id, daily, originName: origin.name, destName: dest.name, line: origin.line,
        });
        const res = await fetch(`/api/last-train?${qs}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error ?? '막차를 불러오지 못했어요.');
        setState({ status: 'done', result: body as LastTrainResult });
        const result = body as LastTrainResult;
        if (autoFill && result.last) onChooseRef.current(result.last.time, legOf(result.last), true);
        else {
          // 예전 저장값처럼 경로가 없으면, 지금 시각과 같은 열차의 경로만 채운다 (시각은 그대로)
          const route = routeFor(result, trainRef.current);
          if (route) onChooseRef.current(trainRef.current, route);
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const offline = e instanceof TypeError; // fetch 자체 실패 = 네트워크 문제
        setState({ status: 'error', message: offline ? '네트워크에 연결할 수 없어요.' : (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [origin.id, dest.id, daily, autoFill]);

  const field = {
    train, invalid, chosen,
    onChange: (t: string) => onChoose(t, state.status === 'done' ? routeFor(state.result, t) : undefined),
  };
  if (state.status === 'loading') return <LastTrainField {...field} status="loading" />;
  if (state.status === 'error') {
    return <LastTrainField {...field} status="idle" note={`${state.message} 막차 시각을 직접 입력해 주세요.`} noteIsError />;
  }

  const { last, candidates } = state.result;
  const dayNote = state.result.daily && state.result.daily !== daily
    ? `${DAY_LABEL[daily]} 시간표가 없어 ${DAY_LABEL[state.result.daily]} 시간표 기준`
    : `${DAY_LABEL[daily]} 시간표`;
  // 자동 막차가 있으면 그 방향에서 막차와 그 앞 열차 몇 대만 (막차 뒤 열차는 도착역에 안 간다)
  const list: Train[] = last
    ? [...candidates[last.dir].filter((t) => t.min < last.min).slice(-3), last]
    : [...candidates.U, ...candidates.D].sort((a, b) => a.min - b.min);

  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {list.map((t) => (
        <button
          key={`${t.min}-${t.endId}`}
          type="button"
          onClick={() => onChoose(t.time)}
          aria-pressed={t.time === train}
          className="min-h-9 rounded-full border border-[var(--border)] px-3 text-[0.85rem] text-[var(--text)] aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]"
        >
          {t.time} {t.endName}행{t === last ? ' · 막차' : ''}
        </button>
      ))}
    </div>
  );

  return (
    <LastTrainField
      {...field}
      status="ready"
      auto={last ? { time: last.time, detail: `${last.endName}행 · ${dayNote}` } : undefined}
      note={last ? undefined : `${dest.name}까지 가는 막차를 자동으로 못 찾았어요. 아래에서 집까지 가는 열차를 고르거나 직접 입력해 주세요.`}
      extra={list.length ? { label: '다른 열차', content: chips } : undefined}
    />
  );
}
