import { test } from 'vitest';
import assert from 'node:assert/strict';
import { isStale, originFor, originFromPeople, pairKey } from '../lib/origin';
import { SavedSchema } from '../lib/schema';
import type { Person } from '../lib/time';

const s2 = { id: 'MTRS12222', name: '강남', line: '2호선' };
const sb = { id: 'MTRDXD1D007', name: '강남', line: '신분당' };
const hongdae = { id: 'MTRS12239', name: '홍대입구', line: '2호선' };
const jeongja = { id: 'MTRDXD1D014', name: '정자', line: '신분당' };
const isu = { id: 'MTRS14432', name: '총신대입구(이수)', line: '4호선' };

const person = (p: Partial<Person>): Person => ({ name: '민수', station: '강남', train: '23:59', ...p });

test('originFromPeople: 2명 고정이던 저장값에서 출발역을 다시 만든다 (노선별 역 중복 제거)', () => {
  const o = originFromPeople([person({ origin: s2, dest: hongdae }), person({ origin: sb, dest: jeongja }), person({ origin: s2 })]);
  assert.equal(o.text, '강남');
  assert.deepEqual(o.options.map((s) => s.line), ['2호선', '신분당']);
  assert.deepEqual(originFromPeople([]), { text: '', options: [] });
});

test('originFor·pairKey: 같은 노선이면 그 역, 환승이면 출발역 이름으로 구분', () => {
  const o = { text: '강남', options: [s2, sb] };
  assert.equal(originFor(o, jeongja)?.id, sb.id);
  assert.equal(originFor(o, isu), null);
  assert.equal(pairKey(o, hongdae), `${s2.id}>${hongdae.id}`);
  assert.equal(pairKey(o, isu), `강남>${isu.id}`);
});

test('isStale: 저장한 뒤 출발역 이름이 바뀌면 막차를 다시 확인해야 한다', () => {
  assert.equal(isStale(person({}), { text: '강남', options: [] }), false);
  assert.equal(isStale(person({}), { text: '역삼', options: [] }), true);
});

test('SavedSchema: 예전 2명 저장값도, 1명·origin 포함 새 저장값도 읽는다. 7명은 거절', () => {
  assert.ok(SavedSchema.safeParse({ people: [person({}), person({ name: '지영' })] }).success);
  assert.ok(SavedSchema.safeParse({ origin: { text: '강남', options: [s2] }, people: [person({})] }).success);
  assert.ok(SavedSchema.safeParse({ origin: { text: '', options: [] }, people: [] }).success);
  assert.equal(SavedSchema.safeParse({ people: Array.from({ length: 7 }, () => person({})) }).success, false);
});
