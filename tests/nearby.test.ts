import { test } from 'vitest';
import assert from 'node:assert/strict';
import { colocatedLines, distanceM, groupNearby, parsePlaceName } from '../lib/nearby';

test('parsePlaceName: "강남역 2호선" → 이름·노선, 형식이 다르면 null', () => {
  assert.deepEqual(parsePlaceName('강남역 2호선'), { name: '강남', line: '2호선' });
  assert.deepEqual(parsePlaceName('서울역 공항철도'), { name: '서울', line: '공항철도' });
  assert.equal(parsePlaceName('강남역'), null);
  assert.equal(parsePlaceName(''), null);
});

// 강남역 근처 좌표에서 받은 실제 응답(2026-11)을 줄인 값
test('groupNearby: 역 이름별로 묶고 가까운 순 최대 5곳, 거리는 가장 가까운 노선 기준', () => {
  const r = groupNearby([
    { place_name: '강남역 2호선', distance: '40' }, { place_name: '강남역 신분당선', distance: '135' },
    { place_name: '신논현역 신분당선', distance: '677' }, { place_name: '신논현역 9호선', distance: '789' },
    { place_name: '역삼역 2호선', distance: '842' }, { place_name: '언주역 9호선', distance: '1188' },
    { place_name: '교대역 2호선', distance: '1250' }, { place_name: '사평역 9호선', distance: '1297' },
    { place_name: '이상한 이름', distance: '10' }, { place_name: '교대역 3호선', distance: 'x' },
  ]);
  assert.deepEqual(r.map((s) => `${s.name}:${s.lines.join('·')}:${s.distance}`), [
    '강남:2호선·신분당선:40', '신논현:신분당선·9호선:677', '역삼:2호선:842', '언주:9호선:1188', '교대:2호선:1250',
  ]);
});

// 카카오 "역" 검색 결과 좌표 (2026-11)
test('colocatedLines: 이름이 같아도 500m 넘게 떨어진 역은 다른 역', () => {
  const same = (a: string, b: string) => a.replace(/(선|철도)$/, '') === b.replace(/(선|철도)$/, '');
  const yangpyeong = [{ line: '5호선', x: 126.8864, y: 37.5256 }, { line: '경의중앙선', x: 127.4922, y: 37.4927 }];
  assert.deepEqual(colocatedLines(yangpyeong, '경의중앙', same), ['경의중앙선']);
  assert.deepEqual(colocatedLines(yangpyeong, '5호선', same), ['5호선']);
  const gangnam = [{ line: '2호선', x: 127.028, y: 37.4981 }, { line: '신분당선', x: 127.0282, y: 37.4968 }];
  assert.deepEqual(colocatedLines(gangnam, '신분당', same), ['2호선', '신분당선']);
  const sinchon = [{ line: '2호선', x: 126.937, y: 37.5552 }, { line: '경의중앙선', x: 126.9421, y: 37.5597 }];
  assert.deepEqual(colocatedLines(sinchon, '2호선', same), ['2호선']);
  assert.equal(colocatedLines(gangnam, '9호선', same), null);
});

test('distanceM: 강남 2호선↔신분당선 약 145m', () => {
  const d = distanceM({ x: 127.028, y: 37.4981 }, { x: 127.0282, y: 37.4968 });
  assert.ok(d > 130 && d < 160, String(d));
});
