'use client';

import { useEffect, useState } from 'react';
import { parseHHMM, type Person } from '@/lib/time';
import { SavedSchema, type Saved } from '@/lib/schema';
import { SetupForm } from './SetupForm';
import { Countdown } from './Countdown';

const KEY = 'lastTrain.v1';

function load(): Saved | null {
  try {
    const parsed = SavedSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // 손상된 값이나 저장소 접근 불가
  }
}

function save(data: Saved) {
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

type View = 'loading' | 'setup' | 'countdown';

export function LastTrainApp() {
  const [view, setView] = useState<View>('loading');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [nowOffset, setNowOffset] = useState(0);

  // localStorage·URL은 브라우저에서만 읽을 수 있어 마운트 후 불러온다
  useEffect(() => {
    setNowOffset(readNowOffset());
    const saved = load();
    setPeople(saved?.people ?? null);
    setView(saved ? 'countdown' : 'setup');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('counting', view === 'countdown');
    if (view !== 'countdown') document.body.dataset.level = 'calm';
  }, [view]);

  if (view === 'loading') return null;

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      {view === 'setup' ? (
        <SetupForm
          initial={people}
          onSubmit={(next) => {
            save({ people: next });
            setPeople(next);
            setView('countdown');
          }}
        />
      ) : (
        <Countdown people={people!} nowOffset={nowOffset} onEdit={() => setView('setup')} />
      )}
    </main>
  );
}
