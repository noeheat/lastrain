import { test } from 'vitest';
import assert from 'node:assert/strict';
import { findTrain, lineOfSubwayId, parseArrivals, parseRecptn } from '../lib/seoulArrival';

// 2026-11-12 강남역 실제 응답 일부 (spike/seoul-arrival.js)
const rows = [
  { subwayId: '1077', updnLine: '상행', btrainNo: '12', bstatnNm: '신사', lstcarAt: '0', barvlDt: '0', arvlCd: '5', arvlMsg2: '전역 도착', recptnDt: '2026-11-12 13:41:37' },
  { subwayId: '1002', updnLine: '외선', btrainNo: '2241', bstatnNm: '성수', lstcarAt: '0', barvlDt: '260', arvlCd: '99', arvlMsg2: '4분 20초 후', recptnDt: '2026-11-12 13:36:32' },
  { subwayId: '1002', updnLine: '내선', btrainNo: '3240', bstatnNm: '성수', lstcarAt: '1', barvlDt: '0', arvlCd: '1', arvlMsg2: '강남 도착', recptnDt: '2026-11-12 13:41:50' },
  { subwayId: '1002', updnLine: '외선', btrainNo: '2243', bstatnNm: '성수', lstcarAt: '0', barvlDt: '0', arvlCd: '2', arvlMsg2: '강남 출발', recptnDt: '2026-11-12 13:41:55' },
];
const now = Date.parse('2026-11-12T13:42:00+09:00');

test('parseRecptn: 서울 시각 문자열 → ms', () => {
  assert.equal(parseRecptn('2026-11-12 13:42:00'), now);
  assert.equal(parseRecptn(''), null);
  assert.equal(parseRecptn(undefined), null);
});

test('lineOfSubwayId: 1~9호선만', () => {
  assert.equal(lineOfSubwayId('1002'), '2호선');
  assert.equal(lineOfSubwayId('1009'), '9호선');
  assert.equal(lineOfSubwayId('1077'), null); // 신분당
  assert.equal(lineOfSubwayId(undefined), null);
});

test('parseArrivals: 1~9호선만, 남은 초는 수신 시각 기준으로 다시 센다', () => {
  const a = parseArrivals(rows, now);
  assert.deepEqual(a.map((x) => x.trainNo), ['2241', '3240', '2243']); // 신분당은 버린다
  // 13:36:32 + 260초 = 13:40:52 → 지금(13:42:00)보다 68초 전 (수신이 묵어서, 받은 순간 기준이면 260초 뒤로 착각)
  assert.equal(a[0]!.sec, -68);
  assert.equal(a[1]!.sec, -10); // 도착(1): 수신 시각이 곧 도착
  assert.equal(a[1]!.last, true);
  assert.equal(a[2]!.departed, true);
});

test('parseArrivals: 남은 초를 모르면 null', () => {
  const [x] = parseArrivals([{ subwayId: '1004', btrainNo: '4512', barvlDt: '0', arvlCd: '99', recptnDt: '2026-11-12 13:41:00' }], now);
  assert.equal(x!.sec, null);
});

test('findTrain: 노선과 열차 번호(앞 0 무시)가 같은 열차', () => {
  const a = parseArrivals(rows, now);
  assert.equal(findTrain(a, '2호선', '02241')?.trainNo, '2241');
  assert.equal(findTrain(a, '3호선', '2241'), null);
  assert.equal(findTrain(a, '2호선', '9999'), null);
});
