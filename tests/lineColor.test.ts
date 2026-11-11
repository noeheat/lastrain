import { test } from 'vitest';
import assert from 'node:assert/strict';
import { fieldColor, lineColor } from '../lib/lineColor';

// WCAG 상대 휘도 대비
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrastWithWhite = (hex: string) => 1.05 / (lum(hex) + 0.05);

test('lineColor: TAGO·카카오 표기가 달라도 같은 색, 버스는 종류별', () => {
  assert.equal(lineColor({ line: '2호선' }), '#00a84d');
  assert.equal(lineColor({ line: '신분당' }), lineColor({ line: '신분당선' }));
  assert.equal(lineColor({ line: '공항철도' }), '#0090d2');
  assert.equal(lineColor({ line: 'N75', kind: 'bus' }), '#28367a');
  assert.equal(lineColor({ line: '9401', kind: 'bus' }), '#e60012');
  assert.equal(lineColor({ line: '640', kind: 'bus' }), '#0068b7');
  assert.equal(lineColor({ line: '없는선' }), null);
  assert.equal(lineColor(undefined), null);
});

test('fieldColor: 가장 밝은 노선에서도 흰 글자 대비 4.5 이상', () => {
  for (const line of ['9호선', '수인분당', '경의중앙', '우이신설', '의정부', '서해']) {
    const bg = fieldColor(lineColor({ line }));
    assert.ok(contrastWithWhite(bg) >= 4.5, `${line} ${bg} ${contrastWithWhite(bg).toFixed(2)}`);
  }
});
