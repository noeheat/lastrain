'use client';

import { useEffect, useState } from 'react';
import { parseHHMM, type Person } from '@/lib/time';
import { SavedSchema } from '@/lib/schema';
import { EMPTY_ORIGIN, originFromPeople, type Origin } from '@/lib/origin';
import { Countdown } from './Countdown';
import { Sheet } from './Sheet';
import { PersonSheet } from './PersonSheet';
import { StationPicker } from './StationPicker';
import { NearbyStations } from './NearbyStations';

const KEY = 'lastTrain.v1';

type State = { origin: Origin; people: Person[] };

function load(): State {
  try {
    const parsed = SavedSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    if (parsed.success) {
      const { origin, people } = parsed.data;
      return { origin: origin ?? originFromPeople(people), people };
    }
  } catch { /* 손상된 값이나 저장소 접근 불가 */ }
  return { origin: EMPTY_ORIGIN, people: [] };
}

function save(data: State) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 사생활 모드 등 */ }
}

/** 디버그: ?now=23:40 → 오늘 23:40부터 시계가 흐르는 것처럼 동작 */
function readNowOffset(): number {
  const m = parseHHMM(new URLSearchParams(location.search).get('now'));
  if (m == null) return 0;
  const real = new Date();
  const fake = new Date(real.getFullYear(), real.getMonth(), real.getDate(), 0, m);
  return fake.getTime() - real.getTime();
}

// 열린 시트: 출발역, 사람 편집(index: null이면 새 사람)
type Open = { kind: 'origin' } | { kind: 'person'; index: number | null } | null;

export function LastTrainApp() {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [nowOffset, setNowOffset] = useState(0);

  // localStorage·URL은 브라우저에서만 읽을 수 있어 마운트 후 불러온다
  useEffect(() => {
    setNowOffset(readNowOffset());
    setState(load());
  }, []);

  if (!state) return null;
  const { origin, people } = state;

  const commit = (next: State) => {
    save(next);
    setState(next);
    setOpen(null);
  };
  const editing = open?.kind === 'person' ? open.index : null;

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <Countdown
        origin={origin}
        people={people}
        nowOffset={nowOffset}
        onEditOrigin={() => setOpen({ kind: 'origin' })}
        onEditPerson={(index) => setOpen({ kind: 'person', index })}
        onAdd={() => setOpen({ kind: 'person', index: null })}
      />
      <Sheet open={open?.kind === 'origin'} title="함께 출발하는 역" onClose={() => setOpen(null)}>
        <OriginForm initial={origin} onSave={(o) => commit({ origin: o, people })} />
      </Sheet>
      <Sheet
        open={open?.kind === 'person'}
        title={editing == null ? '사람 추가' : `${people[editing]?.name ?? ''} 수정`}
        onClose={() => setOpen(null)}
      >
        <PersonSheet
          origin={origin}
          person={editing == null ? null : people[editing] ?? null}
          onSave={(p) => commit({
            origin,
            people: editing == null ? [...people, p] : people.map((x, i) => (i === editing ? p : x)),
          })}
          onDelete={editing == null ? undefined : () => commit({ origin, people: people.filter((_, i) => i !== editing) })}
        />
      </Sheet>
    </main>
  );
}

/** 출발역 시트: 현재 위치 근처 역을 고르거나(바로 저장), 검색해서 고르거나, 검색이 안 되면 입력한 이름 그대로 쓴다 */
function OriginForm({ initial, onSave }: { initial: Origin; onSave: (o: Origin) => void }) {
  const [o, setO] = useState<Origin>(initial);
  const [error, setError] = useState('');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const text = o.text.trim();
        if (!text) return setError('역 이름을 입력해 주세요.');
        onSave({ ...o, text });
      }}
    >
      <NearbyStations onPick={onSave} />
      <StationPicker
        label="또는 역 이름으로 검색"
        text={o.text}
        picked={o.options[0] ?? null}
        badge={o.options.map((s) => s.line).join(' · ')}
        invalid={!!error}
        onText={(text) => { setO({ text, options: [] }); setError(''); }}
        onPick={(s, results) => setO({ text: s.name, options: results.filter((r) => r.name === s.name) })}
      />
      <p role="alert" className="mb-3 min-h-[1.2em] text-[0.9rem] text-[var(--error)]">{error}</p>
      <button type="submit" className="block min-h-[52px] w-full rounded-xl bg-[var(--accent)] text-[1.05rem] font-semibold text-[#06121f]">
        저장
      </button>
    </form>
  );
}
