// node:test 최소 대체 (브라우저용)
const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export async function run() {
  const results = [];
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, ok: true });
    } catch (e) {
      results.push({ name: t.name, ok: false, error: e.message });
    }
  }
  return results;
}
