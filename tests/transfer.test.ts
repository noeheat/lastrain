import { test } from 'vitest';
import assert from 'node:assert/strict';
import { nameVariants, sameStation, normLine, lineLabel, subwayRoutes, planBackward, type LegTrain } from '../lib/transfer';

test('nameVariants·sameStation: 괄호 표기와 "역" 접미사', () => {
  assert.deepEqual(nameVariants('잠실(송파구청)'), ['잠실(송파구청)', '잠실', '송파구청']);
  assert.deepEqual(nameVariants('강남역'), ['강남', '강남역']);
  assert.deepEqual(nameVariants('서울역'), ['서울', '서울역']); // 서울 시간표 표기는 "서울역"
  assert.deepEqual(nameVariants('불암산(당고개)'), ['불암산(당고개)', '불암산', '당고개']);
  assert.ok(!nameVariants('역').includes('')); // '역'을 떼서 빈 문자열이 되면 후보에서 뺀다
  assert.deepEqual(nameVariants('역'), ['역']);
  assert.ok(sameStation('총신대입구(이수)', '이수'));
  assert.ok(sameStation('잠실', '잠실(송파구청)'));
  assert.ok(!sameStation('잠실', '잠실새내'));
});

test('normLine: 카카오·TAGO 노선 이름 맞추기', () => {
  assert.equal(normLine('신분당선'), normLine('신분당'));
  assert.equal(normLine('공항철도'), normLine('공항'));
  assert.equal(normLine('2호선'), '2호선');
});

// 카카오 응답(2026-11, 신논현→잠실)에서 필요한 부분만 옮긴 값
const sub = (line: string, stops: string[], time: number) =>
  ({ properties: { type: 'SUBWAY', time, stops: stops.map((name) => ({ name })), vehicles: [{ name: line }] } });
const walk = (guidance: string, time: number) => ({ properties: { type: 'WALKING', time, guidance } });
const bus = { properties: { type: 'BUS', time: 255 } };

test('subwayRoutes: 지하철+역 안 환승만, 급행·일반 중복 제거, 버스·역 밖 도보 경로 제외', () => {
  const routes = subwayRoutes({
    routes: [
      { steps: [sub('9호선', ['신논현', '선정릉', '종합운동장'], 490), walk('종합운동장종합운동장역 환승', 309), sub('2호선', ['종합운동장', '신천', '잠실(송파구청)'], 240)] },
      { steps: [sub('9호선', ['신논현', '언주', '종합운동장'], 630), walk('종합운동장종합운동장역 환승', 309), sub('2호선', ['종합운동장', '잠실(송파구청)'], 240)] },
      { steps: [bus, walk('강남강남역까지 도보로 이동 (1번 출구)', 196), sub('2호선', ['강남', '잠실(송파구청)'], 720)] },
      { steps: [sub('9호선', ['신논현', '석촌'], 755), walk('석촌석촌역 환승', 156), sub('8호선', ['석촌', '잠실(송파구청)'], 140)] },
    ],
  }, '신논현', '잠실');
  assert.equal(routes.length, 2);
  assert.deepEqual(routes[0], {
    legs: [
      { line: '9호선', from: '신논현', to: '종합운동장', minutes: 9 },
      { line: '2호선', from: '종합운동장', to: '잠실(송파구청)', minutes: 4 },
    ],
    walks: [0, 6],
  });
  assert.equal(routes[1]?.legs[1]?.line, '8호선');
});

test('subwayRoutes: 다른 역에서 타는 경로는 제외 (사당→건대입구 중 이수에서 타는 7호선)', () => {
  const routes = subwayRoutes({ routes: [{ steps: [sub('7호선', ['이수', '건대입구'], 1150)] }] }, '사당', '건대입구');
  assert.equal(routes.length, 0);
});

const t = (dep: number, arr: number): LegTrain => ({ dep, arr, endName: '', estimated: false });

test('planBackward: 마지막 구간 막차에 맞춰 앞 구간은 환승 도보 전에 도착하는 열차', () => {
  const r = planBackward([
    { trains: [t(1380, 1390), t(1395, 1405), t(1400, 1412)], walkBefore: 0 },
    { trains: [t(1400, 1410), t(1415, 1425)], walkBefore: 6 }, // 1415 - 6 = 1409까지 도착해야 함
  ]);
  assert.deepEqual(r?.map((x) => x.dep), [1395, 1415]);
});

test('planBackward: 앞 구간에 맞는 열차가 없으면 null', () => {
  assert.equal(planBackward([{ trains: [t(1400, 1430)], walkBefore: 0 }, { trains: [t(1420, 1440)], walkBefore: 3 }]), null);
  assert.equal(planBackward([{ trains: [], walkBefore: 0 }]), null);
});

test('lineLabel: 화면용 노선 이름을 하나로', () => {
  assert.equal(lineLabel('신분당'), '신분당선');
  assert.equal(lineLabel('신분당선'), '신분당선');
  assert.equal(lineLabel('수인분당'), '수인분당선');
  assert.equal(lineLabel('공항'), '공항철도');
  assert.equal(lineLabel('공항철도'), '공항철도');
  assert.equal(lineLabel('2호선'), '2호선');
});
