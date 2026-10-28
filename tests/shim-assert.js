// node:assert/strict 최소 대체 (브라우저용)
const show = (v) => (v instanceof Date ? v.toString() : JSON.stringify(v));

function same(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return JSON.stringify(a) === JSON.stringify(b);
}

const assert = {
  equal(actual, expected) {
    if (!Object.is(actual, expected)) throw new Error(`${show(actual)} !== ${show(expected)}`);
  },
  deepEqual(actual, expected) {
    if (!same(actual, expected)) throw new Error(`${show(actual)} ≠ ${show(expected)}`);
  },
};

export default assert;
