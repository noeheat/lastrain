import { test } from 'vitest';
import assert from 'node:assert/strict';
import { rankStations, searchTerms } from '../lib/stationSearch';

const st = (id: string, name: string, line = '2호선') => ({ id, name, line });

test("searchTerms: '역'으로 끝나면 뗀 검색어도 함께", () => {
  assert.deepEqual(searchTerms('강남역'), ['강남역', '강남']);
  assert.deepEqual(searchTerms(' 서울역 '), ['서울역', '서울']);
  assert.deepEqual(searchTerms('강남'), ['강남']);
  assert.deepEqual(searchTerms('역'), ['역']); // 떼면 빈 문자열
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
