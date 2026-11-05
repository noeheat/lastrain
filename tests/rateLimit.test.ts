import { test } from 'vitest';
import assert from 'node:assert/strict';
import { clientIp, hit, type Store } from '../lib/rateLimit';

test('hit: 한도까지는 통과, 넘으면 막고 칸이 끝날 때까지 남은 초를 알려준다', () => {
  const store: Store = new Map();
  for (let i = 0; i < 3; i++) assert.equal(hit('a', 3, 1_000 + i, store).ok, true);
  const r = hit('a', 3, 21_000, store);
  assert.equal(r.ok, false);
  assert.equal(r.retryAfter, 40); // 1초에 시작한 칸은 61초에 끝난다
});

test('hit: 1분이 지나면 새 칸, 다른 키는 따로 센다', () => {
  const store: Store = new Map();
  hit('a', 1, 0, store);
  assert.equal(hit('a', 1, 30_000, store).ok, false);
  assert.equal(hit('b', 1, 30_000, store).ok, true);
  assert.equal(hit('a', 1, 60_000, store).ok, true);
});

test('clientIp: x-real-ip 우선, 없으면 x-forwarded-for 첫 번째', () => {
  const req = (h: Record<string, string>) => new Request('http://x/api', { headers: h });
  assert.equal(clientIp(req({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' })), '1.1.1.1');
  assert.equal(clientIp(req({ 'x-forwarded-for': '3.3.3.3, 10.0.0.1' })), '3.3.3.3');
  assert.equal(clientIp(req({})), 'unknown');
});
