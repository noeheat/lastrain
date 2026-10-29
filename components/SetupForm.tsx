'use client';

import { useState } from 'react';
import type { Person, StationRef } from '@/lib/time';
import { PersonSchema } from '@/lib/schema';
import { StationPicker } from './StationPicker';
import { TrainChoices } from './TrainChoices';
import { hintClass, inputClass, labelClass } from './formStyles';

// 출발역은 두 사람이 함께 쓴다. 같은 이름의 역도 노선마다 ID가 달라서(강남: 2호선·신분당),
// 고른 이름의 노선별 역을 모두 들고 있다가 사람마다 도착역 노선에 맞는 역을 쓴다.
type Origin = { text: string; options: StationRef[] }; // options: 고르지 않았으면 빈 배열

// destText는 입력칸 글자, dest는 검색 결과에서 고른 역 (고르지 않았으면 null)
type Draft = { name: string; destText: string; train: string; walk: string; dest: StationRef | null };
type TextKey = 'name' | 'train' | 'walk';

const empty: Draft = { name: '', destText: '', train: '', walk: '', dest: null };
const toDraft = (p: Person): Draft => ({
  name: p.name, train: p.train, walk: String(p.walk), dest: p.dest ?? null, destText: p.dest?.name ?? '',
});
const toOrigin = (people: Person[] | null): Origin => {
  const options = new Map((people ?? []).flatMap((p) => (p.origin ? [[p.origin.id, p.origin] as const] : [])));
  return { text: people?.[0]?.station ?? '', options: [...options.values()] };
};
const originFor = (o: Origin, d: Draft) => (d.dest && o.options.find((s) => s.line === d.dest!.line)) || null;
const pairKey = (o: Origin, d: Draft) => `${originFor(o, d)?.id ?? ''}>${d.dest?.id ?? ''}`;

export function SetupForm({ initial, onSubmit }: { initial: Person[] | null; onSubmit: (people: Person[]) => void }) {
  const [origin, setOrigin] = useState<Origin>(() => toOrigin(initial));
  const [drafts, setDrafts] = useState<Draft[]>(initial ? initial.map(toDraft) : [empty, empty]);
  const [initialPairs] = useState(() => drafts.map((d) => pairKey(origin, d)));
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
        name: d.name, station: origin.text, train: d.train,
        walk: d.walk === '' ? NaN : Number(d.walk),
        origin: originFor(origin, d) ?? undefined, dest: d.dest ?? undefined,
      });
      if (parsed.success) people.push(parsed.data);
      else parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0]);
        bad.add(key === 'station' ? 'station' : `${i}.${key}`); // 출발역 칸은 하나
      });
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
        <div className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 pt-3 pb-1">
          <StationPicker
            label="함께 출발하는 역"
            text={origin.text}
            picked={origin.options[0] ?? null}
            badge={origin.options.map((s) => s.line).join(' · ')}
            invalid={invalid.has('station')}
            onText={(text) => setOrigin({ text, options: [] })}
            onPick={(s, results) => setOrigin({ text: s.name, options: results.filter((r) => r.name === s.name) })}
          />
        </div>
        {drafts.map((d, i) => {
          const from = originFor(origin, d);
          return (
            <fieldset key={i} className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 pt-3 pb-1">
              <legend className="px-1.5 text-[0.85rem] text-[var(--muted)]">{i === 0 ? '첫 번째 사람' : '두 번째 사람'}</legend>
              <label className={labelClass}>이름 <input {...field(i, 'name')} autoComplete="off" maxLength={20} /></label>
              <StationPicker
                label="도착역 (집 근처 역)"
                text={d.destText}
                picked={d.dest}
                onText={(destText) => update(i, { destText, dest: null })}
                onPick={(dest) => update(i, { destText: dest.name, dest })}
              />
              {from && d.dest ? (
                <TrainChoices
                  origin={from}
                  dest={d.dest}
                  train={d.train}
                  autoFill={pairKey(origin, d) !== initialPairs[i]}
                  onChoose={(train) => update(i, { train })}
                />
              ) : origin.options.length > 0 && d.dest ? (
                <p className={`${hintClass} mb-3 text-[var(--muted)]`}>
                  {origin.text}역에는 {d.dest.line}이 없어요. 환승 경로는 아직 계산하지 못해서 막차 시각을 직접 입력해 주세요.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>막차 시각 <input {...field(i, 'train')} type="time" /></label>
                <label className={labelClass}>
                  역까지 도보(분) <input {...field(i, 'walk')} type="number" inputMode="numeric" min={0} max={180} />
                </label>
              </div>
            </fieldset>
          );
        })}
        <p role="alert" className="mb-3 min-h-[1.2em] text-[0.9rem] text-[var(--error)]">{error}</p>
        <button type="submit" className="block min-h-[52px] w-full rounded-xl bg-[var(--accent)] text-[1.05rem] font-semibold text-[#06121f]">
          카운트다운 시작
        </button>
      </form>
    </section>
  );
}
