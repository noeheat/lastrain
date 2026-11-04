'use client';

import { useEffect, useRef, useState } from 'react';
import { serviceDay } from '@/lib/time';
import { dailyTypeCode } from '@/lib/reach';
import type { PlanResult } from '@/lib/plan';
import { hintClass } from './formStyles';

const DAY_LABEL = { '01': '평일', '02': '토요일', '03': '일요일·공휴일' } as const;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; plan: PlanResult | null };

type Props = {
  origin: string; // 역 이름
  dest: string;
  train: string;
  autoFill: boolean; // 역을 새로 골랐을 때만 자동 막차로 덮어쓴다 (TrainChoices와 같음)
  onChoose: (time: string) => void;
  manualField: React.ReactNode;
};

/** 노선이 달라 환승이 필요할 때: /api/plan으로 환승 막차를 받아 출발 시각을 채운다. 못 구하면 직접 입력. */
export function TransferPlan({ origin, dest, train, autoFill, onChoose, manualField }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [manualOpen, setManualOpen] = useState(false);
  const daily = dailyTypeCode(serviceDay(new Date()));

  // onChoose는 렌더마다 새 함수라, 최신 값을 ref로 들고 있다가 응답이 오면 부른다
  const onChooseRef = useRef(onChoose);
  useEffect(() => {
    onChooseRef.current = onChoose;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    setManualOpen(false);
    (async () => {
      try {
        const res = await fetch(`/api/plan?${new URLSearchParams({ origin, dest, daily })}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error ?? '환승 경로를 불러오지 못했어요.');
        const plan = (body as { plan: PlanResult | null }).plan;
        setState({ status: 'done', plan });
        if (autoFill && plan) onChooseRef.current(plan.depart);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const offline = e instanceof TypeError; // fetch 자체 실패 = 네트워크 문제
        setState({ status: 'error', message: offline ? '네트워크에 연결할 수 없어요.' : (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [origin, dest, daily, autoFill]);

  if (state.status === 'loading') return <p className={`${hintClass} mb-3 text-[var(--muted)]`}>환승 막차 찾는 중…</p>;
  if (state.status === 'error' || !state.plan) {
    return (
      <>
        <p className={`${hintClass} mb-3 ${state.status === 'error' ? 'text-[var(--error)]' : 'text-[var(--muted)]'}`}>
          {state.status === 'error'
            ? state.message
            : `${origin}에서 ${dest}까지 지하철 환승 막차를 계산하지 못했어요 (${DAY_LABEL[daily]} 시간표).`}{' '}
          막차 시각을 직접 입력해 주세요.
        </p>
        {manualField}
      </>
    );
  }

  const { plan } = state;
  const estimated = plan.legs.some((l) => l.estimated);
  // 지금 값이 자동 결과와 다르면(직접 고친 값, 이전 역의 값) 입력칸을 숨기지 않는다
  const mustShowManual = train !== plan.depart;

  return (
    <div className="mb-3">
      <p className={`${hintClass} text-[var(--muted)]`}>
        {dest}까지 환승 막차는 {origin} <strong className="text-[var(--text)]">{plan.depart}</strong> 출발이에요 ({DAY_LABEL[daily]} 시간표).
      </p>
      <ol className="mt-2 space-y-1 text-[0.85rem] text-[var(--text)]">
        {plan.legs.map((l, i) => (
          <li key={i} className="rounded-lg border border-[var(--border)] px-3 py-2">
            {l.line} {l.from} {l.dep} → {l.to} {l.arr}
            {l.estimated ? ' (추정)' : ''} <span className="text-[var(--muted)]">· {l.endName}행</span>
          </li>
        ))}
      </ol>
      {estimated && (
        <p className={`${hintClass} text-[var(--muted)]`}>(추정): 도착 시각을 시간표 대신 경로 소요시간으로 계산했어요.</p>
      )}
      {!mustShowManual && (
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          aria-expanded={manualOpen}
          className="mt-2 min-h-9 text-[0.85rem] text-[var(--muted)] underline"
        >
          {manualOpen ? '직접 입력 닫기' : '시각 직접 입력'}
        </button>
      )}
      {(mustShowManual || manualOpen) && <div className="mt-3">{manualField}</div>}
    </div>
  );
}
