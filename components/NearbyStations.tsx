'use client';

import { useState } from 'react';
import type { NearbyStation } from '@/lib/nearby';
import { colocatedOptions, type Origin } from '@/lib/origin';
import type { StationRef } from '@/lib/time';
import { nameVariants } from '@/lib/transfer';
import { hintClass } from './formStyles';

type State =
  | { status: 'idle' }
  | { status: 'locating' } // 브라우저에 위치를 묻는 중 (권한 창)
  | { status: 'loading' } // 근처 역을 찾는 중
  | { status: 'error'; message: string }
  | { status: 'done'; stations: NearbyStation[] };

const NO_LOCATION = '위치를 쓸 수 없어요. 역 이름으로 검색해 주세요.';

/** 브라우저 위치 → 근처 역 목록. 위치는 이 버튼을 누를 때만 한 번 읽고 저장하지 않는다 */
function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }),
  );
}

/**
 * 출발역 시트의 "현재 위치로 찾기". 역을 고르면 역 검색(/api/stations)으로 노선별 역을 받아
 * 검색해서 고른 것과 같은 모양(Origin)으로 넘긴다.
 */
export function NearbyStations({ onPick }: { onPick: (origin: Origin) => void }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [picking, setPicking] = useState('');

  async function find() {
    if (!('geolocation' in navigator)) return setState({ status: 'error', message: NO_LOCATION });
    setState({ status: 'locating' });
    let pos: GeolocationPosition;
    try {
      pos = await locate();
    } catch (e) {
      const denied = (e as GeolocationPositionError).code === 1; // PERMISSION_DENIED
      return setState({ status: 'error', message: denied ? '위치 권한이 없어요. 역 이름으로 검색해 주세요.' : NO_LOCATION });
    }
    setState({ status: 'loading' });
    try {
      const qs = new URLSearchParams({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
      const res = await fetch(`/api/nearby?${qs}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw new Error(body?.error ?? '근처 역을 불러오지 못했어요.');
      setState({ status: 'done', stations: body.stations as NearbyStation[] });
    } catch (e) {
      setState({ status: 'error', message: e instanceof TypeError ? '네트워크에 연결할 수 없어요.' : (e as Error).message });
    }
  }

  async function pick(name: string, lines: string[]) {
    setPicking(name);
    // 노선별 역 ID가 있어야 막차를 자동으로 찾으므로 역 검색으로 받는다. 실패하면 이름만 쓴다
    let options: StationRef[] = [];
    try {
      const res = await fetch(`/api/stations?q=${encodeURIComponent(name)}`);
      const body = await res.json().catch(() => null);
      // 이름이 같아도 카카오가 이 위치에서 알려준 노선만 (양평: 5호선·경의중앙선은 다른 역)
      if (res.ok && body) options = colocatedOptions((body.stations as StationRef[]).filter((s) => nameVariants(s.name).includes(name)), lines);
    } catch { /* 이름만 쓴다 */ }
    setPicking('');
    onPick({ text: options[0]?.name ?? name, options });
  }

  const busy = state.status === 'locating' || state.status === 'loading';
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={find}
        disabled={busy}
        className="block min-h-12 w-full rounded-[10px] border border-[var(--border)] text-[0.95rem] text-[var(--text)] disabled:text-[var(--muted)]"
      >
        {state.status === 'locating' ? '위치 확인 중…' : state.status === 'loading' ? '근처 역 찾는 중…' : '현재 위치로 찾기'}
      </button>
      {state.status === 'error' && <p className={`${hintClass} text-[var(--error)]`}>{state.message}</p>}
      {state.status === 'done' && (
        state.stations.length === 0 ? (
          <p className={`${hintClass} text-[var(--muted)]`}>1.5km 안에 지하철역이 없어요. 역 이름으로 검색해 주세요.</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-[10px] border border-[var(--border)]">
            {state.stations.map((s) => (
              <li key={s.name} className="border-t border-[var(--border)] first:border-t-0">
                <button
                  type="button"
                  onClick={() => pick(s.name, s.lines)}
                  disabled={!!picking}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left"
                >
                  <span>
                    {s.name}역 <span className="text-[0.85rem] text-[var(--muted)]">{s.lines.join(' · ')}</span>
                  </span>
                  <span className="text-[0.85rem] whitespace-nowrap text-[var(--muted)] tabular-nums">
                    {picking === s.name ? '고르는 중…' : s.distance < 1000 ? `${s.distance}m` : `${(s.distance / 1000).toFixed(1)}km`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
