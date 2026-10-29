'use client';

import { useState } from 'react';
import type { Person, StationRef } from '@/lib/time';
import { PersonSchema } from '@/lib/schema';
import { StationPicker } from './StationPicker';
import { TrainChoices } from './TrainChoices';
import { hintClass, inputClass, labelClass } from './formStyles';

// station·destText는 입력칸 글자, origin·dest는 검색 결과에서 고른 역 (고르지 않았으면 null)
type Draft = {
  name: string; station: string; destText: string; train: string; walk: string;
  origin: StationRef | null; dest: StationRef | null;
};
type TextKey = 'name' | 'train' | 'walk';

const empty: Draft = { name: '', station: '', destText: '', train: '', walk: '', origin: null, dest: null };
const toDraft = (p: Person): Draft => ({
  ...p, walk: String(p.walk), origin: p.origin ?? null, dest: p.dest ?? null, destText: p.dest?.name ?? '',
});
const pairKey = (d: Draft) => `${d.origin?.id ?? ''}>${d.dest?.id ?? ''}`;

export function SetupForm({ initial, onSubmit }: { initial: Person[] | null; onSubmit: (people: Person[]) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(initial ? initial.map(toDraft) : [empty, empty]);
  const [initialPairs] = useState(() => drafts.map(pairKey));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = new Set<string>();
    const people: Person[] = [];
    drafts.forEach((d, i) => {
      const parsed = PersonSchema.safeParse({
        name: d.name, station: d.station, train: d.train,
        walk: d.walk === '' ? NaN : Number(d.walk),
        origin: d.origin ?? undefined, dest: d.dest ?? undefined,
      });
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

  const field = (i: number, key: TextKey) => ({
    value: drafts[i]![key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => update(i, { [key]: e.target.value }),
    'aria-invalid': invalid.has(`${i}.${key}`),
    className: inputClass,
  });

  return (
    <section>
      <h1 className="mt-2 mb-1 text-2xl font-bold">막차 카운트다운</h1>
      <p className="mb-5 text-[0.9rem] text-[var(--muted)]">각자 출발 시각 = 막차 − 도보 − 5분</p>
      <form onSubmit={submit} noValidate>
        {drafts.map((d, i) => (
          <fieldset key={i} className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 pt-3 pb-1">
            <legend className="px-1.5 text-[0.85rem] text-[var(--muted)]">{i === 0 ? '첫 번째 사람' : '두 번째 사람'}</legend>
            <label className={labelClass}>이름 <input {...field(i, 'name')} autoComplete="off" maxLength={20} /></label>
            <StationPicker
              label="출발역"
              text={d.station}
              picked={d.origin}
              invalid={invalid.has(`${i}.station`)}
              onText={(station) => update(i, { station, origin: null })}
              onPick={(origin) => update(i, { station: origin.name, origin })}
            />
            <StationPicker
              label="도착역 (집 근처 역)"
              text={d.destText}
              picked={d.dest}
              onText={(destText) => update(i, { destText, dest: null })}
              onPick={(dest) => update(i, { destText: dest.name, dest })}
            />
            {d.origin && d.dest && (
              d.origin.line === d.dest.line ? (
                <TrainChoices
                  origin={d.origin}
                  dest={d.dest}
                  train={d.train}
                  autoFill={pairKey(d) !== initialPairs[i]}
                  onChoose={(train) => update(i, { train })}
                />
              ) : (
                <p className={`${hintClass} mb-3 text-[var(--muted)]`}>
                  환승 경로는 아직 계산하지 못해요. 막차 시각을 직접 입력해 주세요.
                </p>
              )
            )}
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
