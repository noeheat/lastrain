'use client';

import { useEffect, useRef, useState } from 'react';
import { serviceDay, type StationRef } from '@/lib/time';
import { dailyTypeCode, type LastTrainResult, type Train } from '@/lib/reach';
import { hintClass } from './formStyles';

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
  onChoose: (time: string) => void;
};

/** 출발역→도착역 막차를 /api/last-train에서 받아 자동으로 채우고, 다른 열차도 고를 수 있게 보여준다. */
export function TrainChoices({ origin, dest, train, autoFill, onChoose }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const daily = dailyTypeCode(serviceDay(new Date()));

  // onChoose는 렌더마다 새 함수라, 최신 값을 ref로 들고 있다가 응답이 오면 부른다
  const onChooseRef = useRef(onChoose);
  useEffect(() => {
    onChooseRef.current = onChoose;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    (async () => {
      try {
        const qs = new URLSearchParams({ origin: origin.id, dest: dest.id, daily });
        const res = await fetch(`/api/last-train?${qs}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error ?? '막차를 불러오지 못했어요.');
        setState({ status: 'done', result: body as LastTrainResult });
        if (autoFill && body.last) onChooseRef.current(body.last.time);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const offline = e instanceof TypeError; // fetch 자체 실패 = 네트워크 문제
        setState({ status: 'error', message: offline ? '네트워크에 연결할 수 없어요.' : (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [origin.id, dest.id, daily, autoFill]);

  if (state.status === 'loading') return <p className={`${hintClass} mb-3 text-[var(--muted)]`}>막차 찾는 중…</p>;
  if (state.status === 'error') {
    return <p className={`${hintClass} mb-3 text-[var(--error)]`}>{state.message} 막차 시각을 직접 입력해 주세요.</p>;
  }

  const { last, candidates } = state.result;
  // 자동 막차가 있으면 그 방향에서 막차와 그 앞 열차 몇 대만 (막차 뒤 열차는 도착역에 안 간다)
  const list: Train[] = last
    ? [...candidates[last.dir].filter((t) => t.min < last.min).slice(-3), last]
    : [...candidates.U, ...candidates.D].sort((a, b) => a.min - b.min);

  return (
    <div className="mb-3">
      <p className={`${hintClass} text-[var(--muted)]`}>
        {last
          ? `${dest.name}까지 막차는 ${last.time} ${last.endName}행이에요 (${DAY_LABEL[daily]} 시간표).`
          : `${dest.name}까지 가는 막차를 자동으로 못 찾았어요. 행선지를 보고 집까지 가는 열차를 골라 주세요.`}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
    </div>
  );
}
