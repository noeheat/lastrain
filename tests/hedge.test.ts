import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { hedge } from '../lib/hedge';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** ms 뒤에 value로 끝나는 (error면 실패하는) 가짜 요청 */
const after = <T>(ms: number, value: T, error = false) =>
  new Promise<T>((resolve, reject) => setTimeout(() => (error ? reject(new Error(String(value))) : resolve(value)), ms));

test('hedge: 첫 시도가 빨리 끝나면 두 번째는 보내지 않는다', async () => {
  const calls: number[] = [];
  const p = hedge((n) => (calls.push(n), after(100, `a${n}`)), 1000);
  await vi.advanceTimersByTimeAsync(2000);
  assert.equal(await p, 'a1');
  assert.deepEqual(calls, [1]);
});

test('hedge: 첫 시도가 멈추면 delay 뒤 두 번째 결과를 쓴다', async () => {
  const p = hedge((n) => (n === 1 ? after(8000, 'slow') : after(300, 'fast')), 1000);
  await vi.advanceTimersByTimeAsync(1300);
  assert.equal(await p, 'fast');
});

test('hedge: 첫 시도가 일찍 실패하면 바로 다시 보낸다', async () => {
  const starts: number[] = [];
  const p = hedge((n) => (starts.push(Date.now()), n === 1 ? after(50, 'x', true) : after(100, 'ok')), 1000);
  await vi.advanceTimersByTimeAsync(150);
  assert.equal(await p, 'ok');
  assert.equal(starts[1]! - starts[0]!, 50);
});

test('hedge: 둘 다 실패하면 오류', async () => {
  const p = hedge((n) => after(100 * n, `e${n}`, true), 50);
  const check = assert.rejects(p, /e2/);
  await vi.advanceTimersByTimeAsync(500);
  await check;
});
