'use client';

import { useState } from 'react';
import { hintClass, inputClass, labelClass } from './formStyles';

type Props = {
  train: string; // 지금 막차 시각 ("HH:MM", 비어 있을 수 있음)
  onChange: (time: string) => void;
  status: 'idle' | 'loading' | 'ready'; // idle: 자동으로 찾을 수 없음(도착역 없음·실패) → 직접 입력
  auto?: { time: string; detail: string }; // 자동으로 찾은 막차와 설명 (행선지·시간표)
  note?: string; // 안내·실패 이유
  noteIsError?: boolean;
  extra?: { label: string; content: React.ReactNode; open?: boolean }; // 다른 열차·환승 경로 (접어 둔다)
  invalid?: boolean;
  chosen?: { tag: string; detail: string }; // 버스 등 다른 방법으로 정해졌을 때 (자동 지하철 막차와 다른 값)
};

/**
 * 막차 시각 칸. 도착역을 고르기 전·찾는 중·찾은 뒤 모두 같은 자리에 같은 모양으로 보여서
 * 화면이 밀리지 않고, 지금 값이 자동인지 직접 고친 것인지 바로 보인다.
 */
export function LastTrainField({ train, onChange, status, auto, note, noteIsError, extra, invalid, chosen }: Props) {
  const [manualOpen, setManualOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(extra?.open ?? false);
  const isAuto = !!auto && train === auto.time;
  const input = (
    <input
      type="time"
      value={train}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      aria-label="막차 시각"
      className={inputClass}
    />
  );
  const noteEl = note && (
    <p className={`${hintClass} ${noteIsError ? 'text-[var(--error)]' : 'text-[var(--muted)]'}`}>{note}</p>
  );
  const link = 'min-h-10 text-[0.9rem] text-[var(--accent)]';

  return (
    <div className="mb-3">
      <span className={`${labelClass} mb-0`}>막차 시각</span>

      {status === 'loading' ? (
        <div className="mt-1.5 flex min-h-[76px] items-center rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-3 text-[var(--muted)]">
          막차 찾는 중…
        </div>
      ) : status === 'idle' || !auto ? (
        <>
          {input}
          {noteEl}
        </>
      ) : (
        <>
          <div
            className={`mt-1.5 min-h-[76px] rounded-[10px] border bg-[var(--bg)] px-3 py-2.5 ${
              invalid ? 'border-[var(--error)]' : 'border-[var(--border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[1.6rem] leading-tight font-bold tabular-nums">{train || '--:--'}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[0.75rem] ${
                  isAuto ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-white/10 text-[var(--muted)]'
                }`}
              >
                {isAuto ? '자동' : chosen ? chosen.tag : '직접 지정'}
              </span>
            </div>
            <p className="m-0 mt-0.5 text-[0.85rem] text-[var(--muted)]">
              {isAuto ? auto.detail : chosen ? `${chosen.detail} · 지하철 막차는 ${auto.time}` : `자동으로 찾은 막차는 ${auto.time} (${auto.detail})`}
            </p>
          </div>
          {noteEl}
          <div className="mt-1 flex flex-wrap gap-x-4">
            {extra && (
              <button type="button" className={link} aria-expanded={extraOpen} onClick={() => setExtraOpen((o) => !o)}>
                {extra.label} {extraOpen ? '▴' : '▾'}
              </button>
            )}
            <button type="button" className={link} aria-expanded={manualOpen} onClick={() => setManualOpen((o) => !o)}>
              직접 입력 {manualOpen ? '▴' : '▾'}
            </button>
            {!isAuto && (
              <button type="button" className={link} onClick={() => { onChange(auto.time); setManualOpen(false); }}>
                {chosen ? '지하철 막차로 되돌리기' : '자동 막차로 되돌리기'}
              </button>
            )}
          </div>
          {manualOpen && <div className="mt-1">{input}</div>}
        </>
      )}

      {extra && status !== 'loading' && (extraOpen || !auto) && <div className="mt-2">{extra.content}</div>}
    </div>
  );
}
