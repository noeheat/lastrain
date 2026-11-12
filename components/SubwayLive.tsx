'use client';

import { useEffect, useRef, useState } from 'react';
import { findTrain, type Arrival } from '@/lib/seoulArrival';
import { LIVE_WINDOW_MS } from './BusLive';

const MIN = 60_000;

type Props = {
  station: string; // 탈 역 (서울 시간표 이름)
  line: string; // "2호선"
  trainNo: string; // 시간표로 계산한 막차의 열차 번호
  due: Date; // 시간표상 막차 시각
  now: Date;
  // 실시간 상태: lastAt은 지금 보이는 그 열차의 도착 시각(안 보이면 null). 지하철은 운행 종료 신호가 없어 ended는 늘 false
  onLive?: (s: { lastAt: Date | null; ended: boolean }) => void;
};

/**
 * 지하철 막차 실시간 줄 (1~9호선). 예정 막차 60분 전부터 탈 역의 실시간 도착을 보고,
 * 시간표 막차와 열차 번호가 같은 열차를 찾는다. 역마다 방향별 다음 두 대까지만 보여서, 막차가 그 안에 들어온 뒤부터 잡힌다.
 * 15분 넘게 남으면 1분, 그 안이면 25초마다, 화면이 꺼져 있으면 멈춤 (BusLive와 같다)
 */
export function SubwayLive({ station, line, trainNo, due, now, onLive }: Props) {
  const [live, setLive] = useState<{ arrivals: Arrival[]; at: number } | null>(null);
  const [error, setError] = useState(false);
  const onLiveRef = useRef(onLive);
  const nowRef = useRef(now); // 화면과 같은 시계 (디버그 ?now= 포함)로 도착 시각을 계산한다
  useEffect(() => {
    onLiveRef.current = onLive;
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
          const res = await fetch(`/api/subway-live?${new URLSearchParams({ station })}`, { signal: ctrl.signal });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body?.arrivals) throw new Error();
          setLive({ arrivals: body.arrivals as Arrival[], at: nowRef.current.getTime() });
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
  }, [active, fast, station]);

  // 시간표 막차와 같은 열차. 도착 시각을 알면 부모에 알린다 (일찍 오면 카운트다운을 앞당긴다)
  const train = live ? findTrain(live.arrivals, line, trainNo) : null;
  // 이미 떠났으면 "1분 넘게 지난 시각"으로 알려 놓침으로 판정되게 한다 (시간표보다 일찍 떠난 경우)
  const lastAt = !train || !live ? null : train.departed ? live.at - 61_000 : train.sec != null ? live.at + train.sec * 1000 : null;
  useEffect(() => {
    onLiveRef.current?.({ lastAt: lastAt != null ? new Date(lastAt) : null, ended: false });
  }, [lastAt]);

  if (!active || (!live && !error)) return null;
  const cls = 'm-0 mt-1 text-[0.85rem]';
  if (error && !live) return <p className={`${cls} text-[var(--muted)]`}>실시간 정보를 불러오지 못했어요. 시간표 기준이에요.</p>;
  if (!train) return <p className={`${cls} text-[var(--muted)]`}>실시간: {line} 막차는 아직 다음 두 대 안에 없어요</p>;
  if (train.departed) return <p className={`${cls} font-semibold text-[var(--state)]`}>실시간: {line} 막차가 방금 떠났어요</p>;
  const diff = lastAt != null ? Math.round((lastAt - due.getTime()) / MIN) : 0;
  const note = diff <= -2 ? ` · 예정보다 ${-diff}분 일찍` : diff >= 2 ? ` · 예정보다 ${diff}분 늦게` : '';
  // API 문구("2분 30초 후")는 수신 시각 기준이라 묵어 있다. 남은 초를 알면 다시 센 값으로 말한다
  const sec = lastAt != null ? (lastAt - now.getTime()) / 1000 : null;
  const when = sec == null ? train.msg || '위치 확인 중' : sec <= 30 ? '곧 도착' : `약 ${Math.ceil(sec / 60)}분 뒤 도착`;
  return (
    <p className={`${cls} font-semibold text-[var(--state)]`}>
      실시간: {line} 막차 {when}{note}{train.last ? ' · 막차 표시 확인' : ''}
    </p>
  );
}
