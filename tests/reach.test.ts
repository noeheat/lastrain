import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseTagoTime, toTrains, dailyTypeCode, position, findLastTrain, type RawRow, type RouteInput } from '../lib/reach';

// 실제 TAGO 응답(2026-10 평일)에서 막차 쪽만 옮겨 적은 값
const row = (depTime: string, endSubwayStationId: string, endSubwayStationNm = ''): RawRow =>
  ({ depTime, endSubwayStationId, endSubwayStationNm });

const route = (
  routeId: string, originId: string, destId: string,
  origin: Record<'U' | 'D', RawRow[]>, destEnds: Record<'U' | 'D', string[]>,
): RouteInput => ({
  routeId, originId, destId,
  origin: { U: toTrains(origin.U, originId), D: toTrains(origin.D, originId) },
  destEnds: { U: new Set(destEnds.U), D: new Set(destEnds.D) },
});

test('parseTagoTime: 초는 버리고 04:00 이전은 +24h', () => {
  assert.equal(parseTagoTime('235330'), 23 * 60 + 53);
  assert.equal(parseTagoTime('002130'), 24 * 60 + 21);
  assert.equal(parseTagoTime('040000'), 4 * 60);
  assert.equal(parseTagoTime(''), null);
  assert.equal(parseTagoTime(undefined), null);
  assert.equal(parseTagoTime('2530'), null);
});

test('toTrains: 시각 순 정렬, 빠진 필드·이 역 종착 열차 제외, 출발 시각 없으면 도착 시각', () => {
  const trains = toTrains([
    row('002130', 'B', '비'),
    row('235330', 'A', '에이'),
    { arrTime: '001000', endSubwayStationId: 'C' },
    { depTime: '230000' }, // 종착역 없음
    row('231000', 'ORIGIN'), // 이 역에서 끝남
  ], 'ORIGIN');
  assert.deepEqual(trains.map((t) => `${t.time} ${t.endId}`), ['23:53 A', '00:10 C', '00:21 B']);
});

test('dailyTypeCode: 운행일 요일', () => {
  assert.equal(dailyTypeCode(new Date(2026, 9, 30)), '01'); // 금
  assert.equal(dailyTypeCode(new Date(2026, 9, 31)), '02'); // 토
  assert.equal(dailyTypeCode(new Date(2026, 10, 1)), '03'); // 일
});

test('position: 접두 문자, 지선 표기, 다른 노선', () => {
  assert.deepEqual(position('MTRS12222', 'MTRS12'), { prefix: '', n: 222 });
  assert.deepEqual(position('MTRKRK1K210', 'MTRKRK1'), { prefix: 'K', n: 210 });
  assert.equal(position('MTRS12234-4', 'MTRS12'), null);
  assert.equal(position('MTRKR1141', 'MTRS11'), null);
});

// 2호선 강남(222) 평일 상행·하행 막차 쪽
const gangnam = {
  U: [
    row('235330', 'MTRS12211', '성수'), row('000930', 'MTRS12202', '을지로입구'),
    row('002130', 'MTRS12239', '홍대입구'), row('003330', 'MTRS12234', '신도림'),
    row('004630', 'MTRS12228', '서울대입구'),
  ],
  D: [row('002300', 'MTRS12211', '성수'), row('003800', 'MTRS12211', '성수'), row('005430', 'MTRS12219', '삼성')],
};
// 순환선 본선 역에는 대부분의 종착역 열차가 선다
const loopEnds = ['MTRS12211', 'MTRS12202', 'MTRS12239', 'MTRS12234', 'MTRS12228', 'MTRS12219'];

test('2호선 강남→홍대입구: 신도림·서울대입구행은 홍대 전에 끝나므로 00:21', () => {
  const r = findLastTrain(route('MTRS12', 'MTRS12222', 'MTRS12239', gangnam, { U: loopEnds, D: loopEnds }));
  assert.equal(r?.dir, 'U');
  assert.equal(r?.last.time, '00:21');
});

test('2호선 강남→서울대입구: 00:46', () => {
  const r = findLastTrain(route('MTRS12', 'MTRS12222', 'MTRS12228', gangnam, { U: loopEnds, D: loopEnds }));
  assert.equal(r?.dir, 'U');
  assert.equal(r?.last.time, '00:46');
});

test('2호선 강남→잠실(216): 하행이 더 가깝고, 삼성행은 잠실 전에 끝나므로 00:38', () => {
  const r = findLastTrain(route('MTRS12', 'MTRS12222', 'MTRS12216', gangnam, { U: loopEnds, D: loopEnds }));
  assert.equal(r?.dir, 'D');
  assert.equal(r?.last.time, '00:38');
});

test('2호선 지선 도착역(234-4)은 판정 불가', () => {
  assert.equal(findLastTrain(route('MTRS12', 'MTRS12222', 'MTRS12234-4', gangnam, { U: loopEnds, D: loopEnds })), null);
});

// 9호선 신논현(0925): 상행은 번호가 커지는 쪽, 하행은 작아지는 쪽
const sinnonhyeon = {
  U: [row('002310', 'MTRS99938', '중앙보훈병원'), row('004640', 'MTRS99931', '삼전')],
  D: [
    row('000600', 'MTRS990901', '개화'), row('001100', 'MTRS990902', '김포공항'),
    row('003300', 'MTRS990902', '김포공항'), row('004900', 'MTRS990920', '동작'),
  ],
};

test('9호선 신논현→김포공항: 반대 방향 열차는 무시, 동작행은 못 감 → 하행 00:33', () => {
  const r = findLastTrain(route('MTRS99', 'MTRS990925', 'MTRS990902', sinnonhyeon, {
    U: ['MTRS99938', 'MTRS99931'], D: ['MTRS990901', 'MTRS990902'],
  }));
  assert.equal(r?.dir, 'D');
  assert.equal(r?.last.time, '00:33');
});

test('5호선 강동→거여(마천 지선): 번호상 너머인 하남검단산행도 도착역 시간표에 없으면 제외', () => {
  const r = findLastTrain(route('MTRS15', 'MTRS152549', 'MTRS152560', {
    U: [row('003000', 'MTRS152511', '방화')],
    D: [row('002000', 'MTRS152561', '마천'), row('004000', 'MTRS152566', '하남검단산')],
  }, { U: ['MTRS152511'], D: ['MTRS152561'] }));
  assert.equal(r?.dir, 'D');
  assert.equal(r?.last.time, '00:20');
});

test('1호선 구로→천안: 번호 체계가 달라도(P169) 천안행은 인정, 인천행은 제외', () => {
  const r = findLastTrain(route('MTRKR1', 'MTRKR1141', 'MTRKR1P169', {
    U: [row('003000', 'MTRKR1110', '의정부')],
    D: [row('002000', 'MTRKR1P169', '천안'), row('003000', 'MTRKR1161', '인천')],
  }, { U: [], D: ['MTRKR1P169'] }));
  assert.equal(r?.dir, 'D');
  assert.equal(r?.last.time, '00:20');
});

test('1호선 구로→병점(P157): 종착이 병점인 열차가 없으면 판정 불가', () => {
  const r = findLastTrain(route('MTRKR1', 'MTRKR1141', 'MTRKR1P157', {
    U: [row('003000', 'MTRKR1110', '의정부')],
    D: [row('002000', 'MTRKR1P169', '천안')],
  }, { U: [], D: ['MTRKR1P169'] }));
  assert.equal(r, null);
});

test('종착역 방향이 섞인 방향은 쓰지 않는다 (구로→창동, 의정부행이 지나가도 판정 불가)', () => {
  const r = findLastTrain(route('MTRKR1', 'MTRKR1141', 'MTRKR1116', {
    U: [row('003000', 'MTRKR1110', '의정부'), row('003500', 'MTRKR1159', '도원')],
    D: [],
  }, { U: ['MTRKR1110', 'MTRKR1159'], D: [] }));
  assert.equal(r, null);
});
