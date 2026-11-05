import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  parseHHMM, serviceDay, trainTime, levelFor, computePlan, formatRemaining,
} from '../lib/time';

const at = (d: number, h: number, m: number, s = 0) => new Date(2026, 9, d, h, m, s); // 2026-10-d
const MIN = 60_000;

test('parseHHMM', () => {
  assert.equal(parseHHMM('00:30'), 30);
  assert.equal(parseHHMM('23:59'), 1439);
  assert.equal(parseHHMM('24:00'), null);
  assert.equal(parseHHMM('12:60'), null);
  assert.equal(parseHHMM(''), null);
});

test('운행일 경계는 04:00', () => {
  assert.deepEqual(serviceDay(at(28, 3, 59)), at(27, 0, 0));
  assert.deepEqual(serviceDay(at(28, 4, 0)), at(28, 0, 0));
});

test('23:00에 00:30 막차 → 다음 날 00:30', () => {
  assert.deepEqual(trainTime('00:30', at(28, 23, 0)), at(29, 0, 30));
});

test('00:10에 00:30 막차 → 같은 달력 날 00:30', () => {
  assert.deepEqual(trainTime('00:30', at(29, 0, 10)), at(29, 0, 30));
});

test('00:10에 23:50 막차 → 전날 23:50, 놓침', () => {
  const now = at(29, 0, 10);
  assert.deepEqual(trainTime('23:50', now), at(28, 23, 50));
  const plan = computePlan([{ name: 'A', station: 'x', train: '23:50' }], now);
  assert.equal(plan.rows[0]?.missed, true);
  assert.equal(plan.level, 'missed');
});

test('03:59와 04:00의 23:30 막차', () => {
  assert.deepEqual(trainTime('23:30', at(29, 3, 59)), at(28, 23, 30));
  assert.deepEqual(trainTime('23:30', at(29, 4, 0)), at(29, 23, 30));
});

test('색 단계 경계', () => {
  assert.equal(levelFor(30 * MIN + 1000), 'calm');
  assert.equal(levelFor(30 * MIN), 'warn');
  assert.equal(levelFor(10 * MIN + 1000), 'warn');
  assert.equal(levelFor(10 * MIN), 'urgent');
  assert.equal(levelFor(1000), 'urgent');
  assert.equal(levelFor(0), 'urgent'); // 막차 시각이 되면 놓침(missed)으로 따로 판정한다
});

test('막차가 더 이른 사람이 기준, 놓친 사람은 제외', () => {
  const now = at(28, 23, 0);
  const plan = computePlan([
    { name: 'A', station: 'a', train: '00:30' },
    { name: 'B', station: 'b', train: '23:25', walk: 20 }, // 예전 저장값의 도보 시간은 무시한다
  ], now);
  assert.equal(plan.lead, 1);
  assert.equal(plan.level, 'warn'); // 막차까지 25분
  assert.equal(plan.rows[1]?.msToTrain, 25 * MIN);

  const later = computePlan(plan.rows, at(28, 23, 30)); // B 막차 지남
  assert.equal(later.rows[1]?.missed, true);
  assert.equal(later.lead, 0);
});

test('막차 10분 전부터 urgent, 막차 시각이 되면 놓침', () => {
  assert.equal(computePlan([{ name: 'A', station: 'a', train: '00:30' }], at(29, 0, 20)).level, 'urgent');
  const at30 = computePlan([{ name: 'A', station: 'a', train: '00:30' }], at(29, 0, 30));
  assert.equal(at30.rows[0]?.missed, true);
  assert.equal(at30.level, 'missed');
});

test('formatRemaining', () => {
  assert.equal(formatRemaining(65 * 1000), '01:05');
  assert.equal(formatRemaining(3600 * 1000 + 61 * 1000), '1:01:01');
  assert.equal(formatRemaining(-5000), '00:00');
  assert.equal(formatRemaining(500), '00:01');
});
