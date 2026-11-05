import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseSeoulTime, toSeoulTrains, findLastTrainByNumber, type SeoulRow } from '../lib/seoulReach';

// 실제 서울 열린데이터광장 응답(2026-11)에서 막차 쪽만 옮겨 적은 값: [열차 번호, 출발 시각, 종착역 코드, 종착역]
const rows = (list: [string, string, string, string][]): SeoulRow[] =>
  list.map(([TRAIN_NO, LEFTTIME, DESTSTATION, SUBWAYENAME]) => ({ TRAIN_NO, LEFTTIME, DESTSTATION, SUBWAYENAME }));

test('parseSeoulTime: 24시 이상 표기, 04:00 이전은 +24h, 초는 버림', () => {
  assert.equal(parseSeoulTime('24:21:30'), 24 * 60 + 21);
  assert.equal(parseSeoulTime('00:21:30'), 24 * 60 + 21);
  assert.equal(parseSeoulTime('23:53:30'), 23 * 60 + 53);
  assert.equal(parseSeoulTime('05:35:00'), 5 * 60 + 35);
  assert.equal(parseSeoulTime(''), null);
  assert.equal(parseSeoulTime('2421'), null);
});

test('toSeoulTrains: 시각 순 정렬, 이 역 종착·번호 없는 열차 제외', () => {
  const trains = toSeoulTrains([
    ...rows([['2514', '24:21:30', '0239', '홍대입구'], ['2508', '23:53:30', '0211', '성수'], ['2600', '23:00:00', '0222', '강남']]),
    { LEFTTIME: '23:10:00', DESTSTATION: '0211' },
  ], '0222');
  assert.deepEqual(trains.map((t) => `${t.time} ${t.no}`), ['23:53 2508', '00:21 2514']);
});

// 2호선 강남(0222) → 홍대입구(0239)
const weekday = {
  originCode: '0222', destCode: '0239',
  origin: {
    U: rows([
      ['2508', '23:53:30', '0211', '성수'], ['2510', '24:00:30', '0234', '신도림'],
      ['2512', '24:09:30', '0202', '을지로입구'], ['2514', '24:21:30', '0239', '홍대입구'],
      ['2516', '24:33:30', '0234', '신도림'], ['2518', '24:46:30', '0228', '서울대입구'],
    ]),
    D: rows([['2509', '24:23:00', '0211', '성수'], ['2513', '24:38:00', '0211', '성수'], ['2517', '24:54:30', '0219', '삼성']]),
  },
  // 홍대입구 시간표: 2514는 종착이라 시각이 자리 표시 값, 2509·2513·2517은 강남보다 먼저 지나간다
  dest: rows([
    ['2514', '00:00:00', '0239', '홍대입구'], ['2508', '24:33:00', '0211', '성수'], ['2512', '24:49:00', '0202', '을지로입구'],
    ['2509', '23:44:00', '0211', '성수'], ['2513', '23:59:00', '0211', '성수'], ['2517', '24:15:30', '0219', '삼성'],
  ]),
};

test('평일 강남→홍대입구: 신도림·서울대입구행은 홍대에 없고, 반대 방향은 먼저 지나가므로 00:21 홍대입구행', () => {
  const r = findLastTrainByNumber(weekday);
  assert.equal(r.last?.time, '00:21');
  assert.equal(r.last?.endName, '홍대입구');
  assert.equal(r.last?.dir, 'U');
  assert.equal(r.candidates.U.length, 6);
});

test('토요일 강남→홍대입구: 23:24 (평일보다 57분 이르다)', () => {
  const r = findLastTrainByNumber({
    originCode: '0222', destCode: '0239',
    origin: {
      U: rows([
        ['2426', '23:10:30', '0202', '을지로입구'], ['2428', '23:18:00', '0234', '신도림'],
        ['2430', '23:24:30', '0239', '홍대입구'], ['2432', '23:33:30', '0234', '신도림'],
        ['2434', '23:45:30', '0228', '서울대입구'],
      ]),
      D: rows([['2411', '23:38:30', '0211', '성수'], ['2415', '23:55:00', '0219', '삼성']]),
    },
    dest: rows([
      ['2430', '00:00:00', '0239', '홍대입구'], ['2426', '23:49:00', '0202', '을지로입구'],
      ['2411', '23:01:00', '0211', '성수'], ['2415', '23:16:00', '0219', '삼성'],
    ]),
  });
  assert.equal(r.last?.time, '23:24');
  assert.equal(r.last?.dir, 'U');
});

test('도착역 시간표에 같은 번호가 없으면(급행 미정차 등) 막차 없음', () => {
  const r = findLastTrainByNumber({ ...weekday, dest: rows([['9999', '24:30:00', '0211', '성수']]) });
  assert.equal(r.last, null);
});

test('도착역에서 출발하는 반대 방향 열차는 도착 시각 00:00:00을 24:00으로 읽지 않는다 (회현→불암산 토요일)', () => {
  const r = findLastTrainByNumber({
    originCode: '0425', destCode: '0409',
    origin: {
      U: rows([['4180', '23:20:00', '0409', '불암산'], ['4184', '23:30:00', '0411', '노원']]),
      // K4335는 불암산에서 23:07에 출발해 회현을 23:42에 지나는 산본행
      D: rows([['K4335', '23:42:00', '1751', '산본']]),
    },
    dest: [
      ...rows([['4180', '00:00:00', '0409', '불암산']]),
      { TRAIN_NO: 'K4335', ARRIVETIME: '00:00:00', LEFTTIME: '23:07:00', DESTSTATION: '1751', SUBWAYENAME: '산본' },
    ],
  });
  assert.equal(r.last?.time, '23:20');
  assert.equal(r.last?.endName, '불암산');
  assert.equal(r.last?.dir, 'U');
});
