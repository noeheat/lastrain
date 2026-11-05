import { test } from 'vitest';
import assert from 'node:assert/strict';
import { fulfilledLists, rankStations, searchTerms } from '../lib/stationSearch';

const st = (id: string, name: string, line = '2호선') => ({ id, name, line });

test("searchTerms: '역'으로 끝나면 뗀 검색어도 함께", () => {
  assert.deepEqual(searchTerms('강남역'), ['강남역', '강남']);
  assert.deepEqual(searchTerms(' 서울역 '), ['서울역', '서울']);
  assert.deepEqual(searchTerms('강남'), ['강남']);
  assert.deepEqual(searchTerms('역'), ['역']); // 떼면 빈 문자열
  assert.deepEqual(searchTerms('강남 역'), ['강남 역', '강남']); // '역' 앞 공백도 뗀다
  assert.deepEqual(searchTerms(' 역'), ['역']);
});

test('rankStations: 같은 이름 → 시작하는 이름 → 나머지, 중복 ID는 한 번', () => {
  const fromBare = [
    st('D007', '강남', '신분당'), st('E1', '강남대', '에버라인'), st('K213', '강남구청', '수인분당'), st('S222', '강남'),
  ];
  const r = rankStations([[], fromBare, [st('S222', '강남')]], '강남역');
  assert.deepEqual(r.map((s) => `${s.name}/${s.line}`), ['강남/신분당', '강남/2호선', '강남대/에버라인', '강남구청/수인분당']);
});

test("rankStations: '역'까지가 이름인 역(서울역)이 위로, 괄호 표기도 같은 이름으로 본다", () => {
  const r = rankStations([[st('A01', '서울역', '공항'), st('D013', '미금(분당서울대병원)', '신분당')]], '서울역');
  assert.equal(r[0]?.name, '서울역');
  const j = rankStations([[st('S1', '잠실나루'), st('S2', '잠실(송파구청)')]], '잠실역');
  assert.equal(j[0]?.name, '잠실(송파구청)');
});

test('rankStations: 괄호 안 이름으로 검색해도 0순위 ("이수" → 총신대입구(이수))', () => {
  const r = rankStations([[st('S1', '이수역사거리', '버스'), st('S4', '총신대입구(이수)', '4호선'), st('S7', '총신대입구(이수)', '7호선')]], '이수');
  assert.deepEqual(r.map((s) => s.id), ['S4', 'S7', 'S1']);
});

test('fulfilledLists: 일부 실패면 성공한 목록만, 모두 실패면 첫 번째 오류를 던진다', () => {
  const a = [st('S222', '강남')];
  const ok = (value: typeof a): PromiseSettledResult<typeof a> => ({ status: 'fulfilled', value });
  const bad = (msg: string): PromiseSettledResult<typeof a> => ({ status: 'rejected', reason: new Error(msg) });
  assert.deepEqual(fulfilledLists([bad('강남역 타임아웃'), ok(a)]), [a]);
  assert.deepEqual(fulfilledLists([ok(a), ok([])]), [a, []]);
  assert.throws(() => fulfilledLists([bad('첫 번째'), bad('두 번째')]), /첫 번째/);
  assert.deepEqual(fulfilledLists([]), []);
});
