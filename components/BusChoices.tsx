'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouteLeg, StationRef } from '@/lib/time';
import type { BusOption } from '@/lib/seoulBus';
import { hintClass, labelClass } from './formStyles';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; options: BusOption[] };

/** 버스 막차 → 저장할 경로 (한 구간) */
export const busRoute = (o: BusOption): RouteLeg[] => [{
  kind: 'bus', line: o.route, from: o.from, to: o.to, dep: o.dep, arr: o.arr, endName: '', estimated: o.estimated || undefined,
  arsId: o.arsId, routeId: o.routeId,
}];

type Props = {
  origin: StationRef; // 출발역 (이름·노선으로 카카오 좌표를 찾는다)
  dest: StationRef;
  train: string;
  route?: RouteLeg[];
  onChoose: (time: string, route: RouteLeg[]) => void;
  onLoaded: (best: RouteLeg[] | null) => void; // 가장 늦게 떠나는 버스 (자동 선택용, 없으면 null)
};

/** "버스로 가면": 출발역에서 도착역까지 서울 버스 한 번으로 가는 막차들. 고르면 그 버스 막차로 정한다 */
export function BusChoices({ origin, dest, train, route, onChoose, onLoaded }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    onLoadedRef.current(null);
    (async () => {
      try {
        const qs = new URLSearchParams({ origin: origin.name, originLine: origin.line, dest: dest.name, destLine: dest.line });
        const res = await fetch(`/api/bus?${qs}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error ?? '버스 막차를 불러오지 못했어요.');
        const options = (body.options ?? []) as BusOption[];
        setState({ status: 'done', options });
        onLoadedRef.current(options[0] ? busRoute(options[0]) : null);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', message: e instanceof TypeError ? '네트워크에 연결할 수 없어요.' : (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [origin.name, origin.line, dest.name, dest.line]);

  const chosenBus = route?.[0]?.kind === 'bus' && route[0].dep === train ? route[0] : null;
  return (
    <div className="mb-3">
      <span className={`${labelClass} mb-1.5`}>버스로 가면 (서울 버스)</span>
      {state.status === 'loading' && <p className={`${hintClass} mt-0 text-[var(--muted)]`}>버스 막차 찾는 중…</p>}
      {state.status === 'error' && <p className={`${hintClass} mt-0 text-[var(--muted)]`}>{state.message}</p>}
      {state.status === 'done' && (state.options.length === 0 ? (
        <p className={`${hintClass} mt-0 text-[var(--muted)]`}>버스 한 번으로 가는 서울 버스 막차가 없어요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {state.options.slice(0, 4).map((o) => (
            <button
              key={`${o.route}|${o.from}`}
              type="button"
              onClick={() => onChoose(o.dep, busRoute(o))}
              aria-pressed={chosenBus?.line === o.route && chosenBus.from === o.from}
              className="min-h-9 rounded-full border border-[var(--border)] px-3 text-left text-[0.85rem] text-[var(--text)] aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]"
            >
              {o.dep}{o.estimated ? '(추정)' : ''} {o.route}번 <span className="text-[var(--muted)]">{o.from}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
