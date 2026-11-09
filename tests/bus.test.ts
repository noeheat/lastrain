import { test } from 'vitest';
import assert from 'node:assert/strict';
import { busName, busOnlyLegs, matchStops, normStop, parseBusTime, type BusStop } from '../lib/bus';

test('busName: 심야 표시는 떼고, 출근·공휴일제외·새벽 노선은 버린다', () => {
  assert.equal(busName('N26(심야)'), 'N26');
  assert.equal(busName('640'), '640');
  assert.equal(busName('노원08'), '노원08');
  assert.equal(busName('8561(출근)'), null);
  assert.equal(busName('8541(공휴일제외)'), null);
  assert.equal(busName('새벽A160'), null);
});

test('normStop: 중앙차로 (중)·승강장·공백·점 차이를 없앤다', () => {
  assert.equal(normStop('홍대입구역(중)'), normStop('홍대입구역'));
  assert.equal(normStop('서울역버스환승센터(7번승강장)'), '서울역버스환승센터');
  assert.equal(normStop('잠실역.잠실대교남단'), normStop('잠실역 잠실대교남단'));
  assert.notEqual(normStop('창동역1번출구(노원방면)'), normStop('창동역1번출구')); // 방면 표기는 다른 정류장일 수 있어 남긴다
});

test('parseBusTime: 자정 넘으면 +24h, 빈 값은 null', () => {
  assert.equal(parseBusTime('23:58'), 23 * 60 + 58);
  assert.equal(parseBusTime('01:08'), 25 * 60 + 8);
  assert.equal(parseBusTime(':'), null);
  assert.equal(parseBusTime(undefined), null);
});

// 카카오 경로 응답(2026-11, 종로3가→목동)에서 줄인 값
const bus = (names: string[], stops: string[], sec: number) =>
  ({ properties: { type: 'BUS', time: sec, stops: stops.map((name) => ({ name })), vehicles: names.map((name) => ({ name })) } });
const walk = (sec: number) => ({ properties: { type: 'WALKING', time: sec } });
const sub = { properties: { type: 'SUBWAY', time: 600, stops: [{ name: '종로3가' }, { name: '신길' }], vehicles: [{ name: '1호선' }] } };

test('busOnlyLegs: 버스를 한 번만 타는 경로만, 같은 조합은 하나로', () => {
  const legs = busOnlyLegs({
    routes: [
      { steps: [walk(120), bus(['N62(심야)'], ['종로3가역.탑골공원', '목동역.목동오거리'], 3000), walk(60)] },
      { steps: [walk(120), bus(['N62(심야)'], ['종로3가역.탑골공원', '목동역.목동오거리'], 3000), walk(60)] },
      { steps: [sub, walk(60), bus(['640'], ['신길역1번출구', '목동역.목동오거리'], 1200)] }, // 지하철 섞임
      { steps: [bus(['160'], ['종로3가역.탑골공원', '여의도환승센터'], 900), bus(['6628'], ['여의도환승센터', '목동역3번출구'], 900)] }, // 버스 두 번
    ],
  });
  assert.deepEqual(legs, [{ names: ['N62(심야)'], from: '종로3가역.탑골공원', to: '목동역.목동오거리', minutes: 50 }]);
});

// 서울 버스 API 640번 경유 정류장(2026-11)에서 줄인 값
const stop = (seq: number, stationNm: string, lastTm: string): BusStop => ({ seq: String(seq), stationNm, lastTm });
const s640 = [
  stop(1, '신월동우성상가', ':'), stop(2, '신월문화체육센터', '22:51'), stop(60, '신길역1번출구', '00:36'),
  stop(71, '목동역.목동오거리', '00:56'), stop(79, '신월동우성상가', '01:08'),
];

test('matchStops: 탈 곳·내릴 곳 순서대로 정류장별 막차', () => {
  const m = matchStops(s640, '신길역1번출구', '목동역.목동오거리', 20);
  assert.equal(m?.board.seq, '60');
  assert.equal(m?.dep, 24 * 60 + 36);
  assert.equal(m?.arr, 24 * 60 + 56);
  assert.equal(m?.estimated, false);
  // 내릴 곳이 탈 곳보다 앞이면(반대 방향) 못 탄다
  assert.equal(matchStops(s640, '목동역.목동오거리', '신길역1번출구', 20), null);
});

test('matchStops: 막차가 비었거나 주간 노선이면 버린다', () => {
  assert.equal(matchStops([stop(1, 'A', ':'), stop(2, 'B', '23:00')], 'A', 'B', 10), null);
  assert.equal(matchStops([stop(16, 'A', '09:45'), stop(21, 'B', '09:56')], 'A', 'B', 10), null); // 8561(출근)
});

test('matchStops: 내릴 곳 막차가 더 이르면(심야버스) 내릴 곳 막차 − 소요시간으로, 추정 표시', () => {
  // N73 실제 값: 신촌오거리 #105 02:53 → 잠실역 #141 02:44, 카카오 소요시간 25분
  const m = matchStops([stop(105, '신촌오거리.현대백화점', '02:53'), stop(141, '잠실역1번.11번출구', '02:44')],
    '신촌오거리.현대백화점', '잠실역1번.11번출구', 25);
  assert.equal(m?.dep, 26 * 60 + 44 - 25); // 02:19
  assert.equal(m?.estimated, true);
});

test('matchStops: 같은 정류장을 두 번 지나면 가장 가까운 쌍', () => {
  const loop = [stop(1, 'A', '22:00'), stop(2, 'B', '22:10'), stop(3, 'A', '22:30'), stop(4, 'B', '22:40')];
  assert.equal(matchStops(loop, 'A', 'B', 10)?.board.seq, '1');
  const r = [stop(1, 'A', '22:00'), stop(2, 'X', '22:05'), stop(3, 'A', '22:30'), stop(4, 'B', '22:40')];
  assert.equal(matchStops(r, 'A', 'B', 10)?.board.seq, '3');
});
