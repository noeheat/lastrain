'use client';

import { useState } from 'react';
import type { Person } from '@/lib/time';
import { PersonSchema } from '@/lib/schema';

type Draft = { name: string; station: string; train: string; walk: string };

const empty: Draft = { name: '', station: '', train: '', walk: '' };
const toDraft = (p: Person): Draft => ({ ...p, walk: String(p.walk) });

const inputClass =
  'mt-1.5 block min-h-12 w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 text-[1.05rem] text-[var(--text)] ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-[var(--accent)] aria-[invalid=true]:border-[var(--error)]';
const labelClass = 'mb-3 block text-[0.85rem] text-[var(--muted)]';

export function SetupForm({ initial, onSubmit }: { initial: Person[] | null; onSubmit: (people: Person[]) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(initial ? initial.map(toDraft) : [empty, empty]);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const update = (i: number, key: keyof Draft, value: string) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [key]: value } : d)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = new Set<string>();
    const people: Person[] = [];
    drafts.forEach((d, i) => {
      const parsed = PersonSchema.safeParse({ ...d, walk: d.walk === '' ? NaN : Number(d.walk) });
      if (parsed.success) people.push(parsed.data);
      else parsed.error.issues.forEach((issue) => bad.add(`${i}.${String(issue.path[0])}`));
    });
    setInvalid(bad);
    if (bad.size) {
      setError('빈칸이나 잘못된 값이 있어요. 도보 시간은 0~180분입니다.');
      return;
    }
    setError('');
    onSubmit(people);
  }

  const field = (i: number, key: keyof Draft) => ({
    value: drafts[i]![key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => update(i, key, e.target.value),
    'aria-invalid': invalid.has(`${i}.${key}`),
    className: inputClass,
  });

  return (
    <section>
      <h1 className="mt-2 mb-1 text-2xl font-bold">막차 카운트다운</h1>
      <p className="mb-5 text-[0.9rem] text-[var(--muted)]">각자 출발 시각 = 막차 − 도보 − 5분</p>
      <form onSubmit={submit} noValidate>
        {[0, 1].map((i) => (
          <fieldset key={i} className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 pt-3 pb-1">
            <legend className="px-1.5 text-[0.85rem] text-[var(--muted)]">{i === 0 ? '첫 번째 사람' : '두 번째 사람'}</legend>
            <label className={labelClass}>이름 <input {...field(i, 'name')} autoComplete="off" maxLength={20} /></label>
            <label className={labelClass}>출발역 <input {...field(i, 'station')} autoComplete="off" maxLength={30} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>막차 시각 <input {...field(i, 'train')} type="time" /></label>
              <label className={labelClass}>
                역까지 도보(분) <input {...field(i, 'walk')} type="number" inputMode="numeric" min={0} max={180} />
              </label>
            </div>
          </fieldset>
        ))}
        <p role="alert" className="mb-3 min-h-[1.2em] text-[0.9rem] text-[var(--error)]">{error}</p>
        <button type="submit" className="block min-h-[52px] w-full rounded-xl bg-[var(--accent)] text-[1.05rem] font-semibold text-[#06121f]">
          카운트다운 시작
        </button>
      </form>
    </section>
  );
}
