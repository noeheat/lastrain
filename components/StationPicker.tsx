'use client';

import { useEffect, useState } from 'react';
import type { StationRef } from '@/lib/time';
import { hintClass, inputClass, labelClass } from './formStyles';

type Props = {
  label: string;
  text: string;
  picked: StationRef | null;
  invalid?: boolean;
  onText: (text: string) => void; // 타이핑하면 고른 역은 풀린다 (부모가 처리)
  onPick: (station: StationRef, results: StationRef[]) => void; // results: 같은 검색의 다른 후보들
  badge?: string; // 고른 뒤 라벨 옆 표시 (기본: 노선 이름)
};

/** 역 이름을 치면 /api/stations로 검색해 노선별 후보를 보여준다. 검색이 안 돼도 입력한 이름은 그대로 쓸 수 있다. */
export function StationPicker({ label, text, picked, invalid, onText, onPick, badge }: Props) {
  const [results, setResults] = useState<StationRef[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState(''); // 서버가 알려준 원인 (없으면 일반 문구)
  const [searched, setSearched] = useState('');
  const q = text.trim();

  useEffect(() => {
    if (picked || !q) {
      setResults([]);
      setStatus('idle');
      return;
    }
    // 타이핑이 멈추고 300ms 뒤에 검색, 그 전 요청은 취소 (늦게 온 옛 응답이 덮어쓰지 않게)
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(`/api/stations?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error ?? '');
        setResults((body as { stations: StationRef[] }).stations);
        setSearched(q);
        setStatus('idle');
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setResults([]);
        setErrorMsg(e instanceof TypeError ? '네트워크에 연결할 수 없어요.' : (e as Error).message);
        setStatus('error');
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, picked]);

  return (
    <div className={labelClass}>
      <label>
        {label}
        {picked && <span className="ml-1.5 text-[var(--accent)]">{badge ?? picked.line}</span>}
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          aria-invalid={invalid}
          className={inputClass}
          autoComplete="off"
          maxLength={30}
        />
      </label>
      {status === 'loading' && <p className={hintClass}>검색 중…</p>}
      {status === 'error' && (
        <p className={`${hintClass} text-[var(--error)]`}>
          역 검색에 실패했어요{errorMsg ? ` (${errorMsg})` : '.'} 막차 시각을 직접 입력해도 돼요.
        </p>
      )}
      {status === 'idle' && !picked && q && searched === q && results.length === 0 && (
        <p className={hintClass}>검색 결과가 없어요.</p>
      )}
      {results.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-[10px] border border-[var(--border)]">
          {results.map((s) => (
            <li key={s.id} className="border-t border-[var(--border)] first:border-t-0">
              <button
                type="button"
                onClick={() => onPick(s, results)}
                className="flex min-h-11 w-full items-center justify-between gap-3 bg-[var(--bg)] px-3 text-left text-[1rem] text-[var(--text)]"
              >
                <span>{s.name}</span>
                <span className="text-[0.85rem] text-[var(--muted)]">{s.line}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
