'use client';

import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * 화면 아래에서 올라오는 편집 시트. 브라우저 기본 <dialog>(showModal)라서
 * 뒤 화면을 막고, Esc로 닫히고, 포커스가 시트 안에서만 움직인다.
 */
export function Sheet({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal은 처음 누를 수 있는 요소(닫기 버튼)에 포커스를 둔다. 바로 입력할 수 있게 첫 입력칸으로 옮긴다
      d.querySelector<HTMLInputElement>('input')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose} // Esc로 닫혀도 부모 상태를 맞춘다
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} // 바깥(배경) 누르면 닫기
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 text-[var(--text)] backdrop:bg-black/60 sm:mx-auto sm:max-w-[480px]"
    >
      <div className="max-h-[85dvh] overflow-y-auto rounded-t-[20px] border border-b-0 border-[var(--border)] bg-[var(--surface)] px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[1.1rem] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-10 px-2 text-[0.95rem] text-[var(--muted)]">
            닫기
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
