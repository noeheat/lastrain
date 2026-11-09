'use client';

import { useEffect, useRef, useState } from 'react';
import { serviceDay, type RouteLeg } from '@/lib/time';
import { dailyTypeCode } from '@/lib/reach';
import type { PlanResult } from '@/lib/plan';
import { hintClass } from './formStyles';
import { legName, lineLabel } from '@/lib/transfer';
import { LastTrainField } from './LastTrainField';

const DAY_LABEL = { '01': '평일', '02': '토요일', '03': '일요일·공휴일' } as const;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; plan: PlanResult | null; reasons: string[] };

type Props = {
  origin: string; // 역 이름
  dest: string;
  originLine?: string; // 이름이 같은 다른 역과 구분하려고 (TAGO 노선 이름)
  destLine?: string;
  train: string;
  autoFill: boolean; // 역을 새로 골랐을 때만 자동 막차로 덮어쓴다 (TrainChoices와 같음)
  onChoose: (time: string, route?: RouteLeg[], auto?: boolean) => void; // auto: 응답이 와서 자동으로 고른 값
  chosen?: { tag: string; detail: string }; // 버스 등 다른 방법으로 정해졌을 때 칸에 보여줄 내용
  invalid?: boolean;
};

const legsOf = (plan: PlanResult): RouteLeg[] =>
  plan.legs.map(({ line, from, to, dep, arr, endName, kind, estimated }) => ({
    line: kind ? line : lineLabel(line), from, to, dep, arr, endName,
    ...(kind && { kind, estimated: estimated || undefined }), // 버스 구간 (지하철 추정은 저장하지 않는다)
  }));

/** 노선이 달라 환승이 필요할 때: /api/plan으로 환승 막차를 받아 출발 시각을 채운다. 못 구하면 직접 입력. */
export function TransferPlan({ origin, dest, originLine, destLine, train, autoFill, onChoose, invalid, chosen }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const daily = dailyTypeCode(serviceDay(new Date()));

  // onChoose는 렌더마다 새 함수라, 최신 값을 ref로 들고 있다가 응답이 오면 부른다
  const onChooseRef = useRef(onChoose);
  const trainRef = useRef(train);
  useEffect(() => {
    onChooseRef.current = onChoose;
    trainRef.current = train;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    (async () => {
      try {
        const qs = new URLSearchParams({ origin, dest, daily, ...(originLine && { originLine }), ...(destLine && { destLine }) });
        const res = await fetch(`/api/plan?${qs}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error ?? '환승 경로를 불러오지 못했어요.');
        const { plan, reasons = [] } = body as { plan: PlanResult | null; reasons?: string[] };
        setState({ status: 'done', plan, reasons });
        if (plan && (autoFill || trainRef.current === plan.depart)) onChooseRef.current(plan.depart, legsOf(plan), autoFill);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const offline = e instanceof TypeError; // fetch 자체 실패 = 네트워크 문제
        setState({ status: 'error', message: offline ? '네트워크에 연결할 수 없어요.' : (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [origin, dest, originLine, destLine, daily, autoFill]);

  const field = {
    train, invalid, chosen,
    onChange: (t: string) => onChoose(t, state.status === 'done' && state.plan?.depart === t ? legsOf(state.plan) : undefined),
  };
  if (state.status === 'loading') return <LastTrainField {...field} status="loading" />;
  if (state.status === 'error' || !state.plan) {
    const note = state.status === 'error'
      ? `${state.message} 막차 시각을 직접 입력해 주세요.`
      : `${origin}에서 ${dest}까지 지하철 환승 막차를 계산하지 못했어요 (${DAY_LABEL[daily]} 시간표${state.reasons[0] ? `, ${state.reasons[0]}` : ''}). 막차 시각을 직접 입력해 주세요.`;
    return <LastTrainField {...field} status="idle" note={note} noteIsError={state.status === 'error'} />;
  }

  const { plan } = state;
  const estimated = plan.legs.some((l) => l.estimated);
  const holidayLines = plan.legs.filter((l) => l.holidayForSaturday).map((l) => l.line);
  const route = (
    <>
      <ol className="space-y-1 text-[0.85rem] text-[var(--text)]">
        {plan.legs.map((l, i) => (
          <li key={i} className="rounded-lg border border-[var(--border)] px-3 py-2">
            {legName(l)} {l.from} {l.dep} → {l.to} {l.arr}
            {l.estimated ? ' (추정)' : ''}{l.endName && <span className="text-[var(--muted)]"> · {l.endName}행</span>}
          </li>
        ))}
      </ol>
      {holidayLines.length > 0 && (
        <p className={`${hintClass} text-[var(--muted)]`}>
          {holidayLines.join(', ')}은 토요일 시간표가 없어 일요일·공휴일 시간표로 계산했어요.
        </p>
      )}
      {estimated && (
        <p className={`${hintClass} text-[var(--muted)]`}>(추정): 도착 시각을 시간표 대신 경로 소요시간으로 계산했어요.</p>
      )}
    </>
  );
  const transfers = plan.legs.length - 1;

  return (
    <LastTrainField
      {...field}
      status="ready"
      auto={{ time: plan.depart, detail: `${plan.legs[0]?.kind ? plan.legs[0].from : origin} 출발 · 환승 ${transfers}번${plan.legs.some((l) => l.kind) ? ' · 버스 포함' : ''} · ${DAY_LABEL[daily]} 시간표` }}
      extra={{ label: '환승 경로', content: route }}
    />
  );
}
