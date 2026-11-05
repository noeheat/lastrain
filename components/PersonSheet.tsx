'use client';

import { useState } from 'react';
import type { Person, RouteLeg, StationRef } from '@/lib/time';
import { PersonSchema } from '@/lib/schema';
import { originFor, pairKey, type Origin } from '@/lib/origin';
import { StationPicker } from './StationPicker';
import { TrainChoices } from './TrainChoices';
import { TransferPlan } from './TransferPlan';
import { LastTrainField } from './LastTrainField';
import { inputClass, labelClass } from './formStyles';

// destText는 입력칸 글자, dest는 검색 결과에서 고른 역 (고르지 않았으면 null)
type Draft = { name: string; destText: string; train: string; dest: StationRef | null; route?: RouteLeg[] };

const toDraft = (p: Person | null): Draft =>
  p
    ? { name: p.name, train: p.train, dest: p.dest ?? null, destText: p.dest?.name ?? '', route: p.route }
    : { name: '', destText: '', train: '', dest: null };

// 저장할 때의 출발역·도착역. 지금 출발역과 다르면(출발역이 바뀜) 막차를 자동으로 다시 채운다
const savedPair = (p: Person | null) => (p ? `${p.origin?.id ?? p.station}>${p.dest?.id ?? ''}` : '');

type Props = {
  origin: Origin;
  person: Person | null; // null이면 새 사람
  onSave: (person: Person) => void;
  onDelete?: () => void;
};

/** 한 사람의 이름·도착역·막차를 고치는 시트 내용. 저장할 때 검증한다 */
export function PersonSheet({ origin, person, onSave, onDelete }: Props) {
  const [d, setD] = useState<Draft>(() => toDraft(person));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const update = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const from = originFor(origin, d.dest);
  const autoFill = pairKey(origin, d.dest) !== savedPair(person);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = PersonSchema.safeParse({
      name: d.name, station: origin.text, train: d.train,
      origin: from ?? undefined, dest: d.dest ?? undefined,
      route: d.route?.[0]?.dep === d.train ? d.route : undefined, // 직접 고친 시각이면 경로를 버린다
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => String(i.path[0]))));
      setError('빈칸이나 잘못된 값이 있어요.');
      return;
    }
    onSave(parsed.data);
  }

  const onTrain = (train: string, route?: RouteLeg[]) => update({ train, route });
  const trainInvalid = invalid.has('train');

  return (
    <form onSubmit={submit} noValidate>
      <label className={labelClass}>
        이름
        <input
          value={d.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-invalid={invalid.has('name')}
          className={inputClass}
          autoComplete="off"
          maxLength={20}
        />
      </label>
      <StationPicker
        label="도착역 (집 근처 역)"
        text={d.destText}
        picked={d.dest}
        onText={(destText) => update({ destText, dest: null })}
        onPick={(dest) => update({ destText: dest.name, dest })}
      />
      {from && d.dest ? (
        <TrainChoices origin={from} dest={d.dest} train={d.train} autoFill={autoFill} onChoose={onTrain} invalid={trainInvalid} />
      ) : origin.options.length > 0 && d.dest ? (
        <TransferPlan origin={origin.options[0]!.name} dest={d.dest.name} train={d.train} autoFill={autoFill}
          onChoose={onTrain} invalid={trainInvalid} />
      ) : (
        <LastTrainField train={d.train} onChange={onTrain} status="idle" invalid={trainInvalid}
          note={d.dest || origin.options.length === 0 ? '역을 검색해서 고르지 않으면 막차 시각을 직접 입력해 주세요.' : '도착역을 검색해서 고르면 막차를 자동으로 찾아요.'} />
      )}
      <p role="alert" className="mb-3 min-h-[1.2em] text-[0.9rem] text-[var(--error)]">{error}</p>
      <button type="submit" className="block min-h-[52px] w-full rounded-xl bg-[var(--accent)] text-[1.05rem] font-semibold text-[#06121f]">
        저장
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="mt-2 block min-h-12 w-full rounded-xl text-[0.95rem] text-[var(--error)]">
          이 사람 삭제
        </button>
      )}
    </form>
  );
}
