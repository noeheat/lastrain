'use client';

import { useEffect, useRef, useState } from 'react';
import type { BusLive as Live } from '@/lib/bus';

const MIN = 60_000;
export const LIVE_WINDOW_MS = 60 * MIN; // 예정 막차 60분 전부터 실시간을 본다 (그 전에는 시간표)

type Props = {
  arsId: string;
  routeId: string;
  line: string; // 노선 번호 (화면 문구용)
  due: Date; // 시간표상 막차 시각
  now: Date;
  onLastAt?: (at: Date | null) => void; // 실시간으로 본 막차 도착 시각 (막차가 안 보이면 null)
};

/**
 * 버스 막차 실시간 줄. 예정 막차 60분 전부터 정류장 실시간 도착을 확인한다
 * (15분 넘게 남으면 1분, 그 안이면 25초마다, 화면이 꺼져 있으면 멈춤).
 */
export function BusLive({ arsId, routeId, line, due, now, onLastAt }: Props) {
  const [live, setLive] = useState<{ data: Live | null; at: number } | null>(null);
  const [error, setError] = useState(false);
  const onLastAtRef = useRef(onLastAt);
  const nowRef = useRef(now); // 화면과 같은 시계 (디버그 ?now= 포함)로 도착 시각을 계산한다
  useEffect(() => {
    onLastAtRef.current = onLastAt;
    nowRef.current = now;
  });

  const left = due.getTime() - now.getTime();
  const active = left <= LIVE_WINDOW_MS && left > -10 * MIN;
  const fast = left <= 15 * MIN;

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();
    const poll = async () => {
      if (!document.hidden) {
        try {
          const res = await fetch(`/api/bus-live?${new URLSearchParams({ arsId, routeId })}`, { signal: ctrl.signal });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body) throw new Error();
          setLive({ data: body.live as Live | null, at: nowRef.current.getTime() });
          setError(false);
        } catch {
          if (ctrl.signal.aborted) return;
          setError(true);
        }
      }
      timer = setTimeout(poll, fast ? 25_000 : 60_000);
    };
    poll();
    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); poll(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, fast, arsId, routeId]);

  // 실시간으로 본 막차 도착 시각을 부모에 알린다 (앞당기기용)
  const lastBus = live?.data?.status === 'running' ? live.data.buses.find((b) => b.last) : undefined;
  const lastAt = lastBus && live ? live.at + lastBus.sec * 1000 : null;
  useEffect(() => {
    onLastAtRef.current?.(lastAt != null ? new Date(lastAt) : null);
  }, [lastAt]);

  if (!active || (!live && !error)) return null;
  const cls = 'm-0 mt-1 text-[0.85rem]';
  if (error && !live) return <p className={`${cls} text-[var(--muted)]`}>실시간 정보를 불러오지 못했어요. 시간표 기준이에요.</p>;
  const d = live?.data;
  if (!d) return <p className={`${cls} text-[var(--muted)]`}>{line}번 실시간 정보가 없어요. 시간표 기준이에요.</p>;
  if (d.status === 'ended') return <p className={`${cls} text-[var(--error)]`}>실시간: {line}번 오늘 운행이 끝났어요.</p>;
  if (d.status === 'waiting') return <p className={`${cls} text-[var(--muted)]`}>실시간: {line}번 차고지 출발 대기 중</p>;
  if (lastBus && lastAt != null) {
    const diff = Math.round((lastAt - due.getTime()) / MIN);
    const note = diff <= -2 ? ` · 예정보다 ${-diff}분 일찍` : diff >= 2 ? ` · 예정보다 ${diff}분 늦게` : '';
    return <p className={`${cls} font-semibold text-[var(--state)]`}>실시간: {line}번 막차 {lastBus.msg}{note}</p>;
  }
  const next = d.buses[0];
  return (
    <p className={`${cls} text-[var(--muted)]`}>
      실시간: {next ? `${line}번 다음 버스 ${next.msg} (막차 아님)` : `${line}번 다가오는 버스가 없어요`}
    </p>
  );
}
