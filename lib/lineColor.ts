import { normLine } from './transfer';

/**
 * 노선 색. 홈 화면은 그 사람이 탈 막차의 노선색으로 화면 전체를 칠한다.
 * 색은 각 운영사 공식 노선색. 모르는 노선은 null (화면은 중립색을 쓴다).
 */
const SUBWAY: Record<string, string> = {
  '1호선': '#0052a4', '2호선': '#00a84d', '3호선': '#ef7c1c', '4호선': '#00a5de', '5호선': '#996cac',
  '6호선': '#cd7c2f', '7호선': '#747f00', '8호선': '#e6186c', '9호선': '#bdb092',
  신분당: '#d4003b', 수인분당: '#f5a200', 경의중앙: '#77c4a3', 공항: '#0090d2', 경춘: '#0c8e72',
  우이신설: '#b0ce18', 신림: '#6789ca', 서해: '#8fc31f', 김포골드: '#a17800', 경강: '#0054a6',
  의정부: '#fda600', 에버라인: '#509f22', 'GTX-A': '#9a6292', 인천1호: '#7ca8d5', 인천2호: '#ed8b00',
};

// 서울 버스: 심야(N)·광역(9xxx)·순환(2자리)·지선(4자리)·간선(3자리)
function busColor(line: string): string {
  const n = line.trim();
  if (/^N/i.test(n)) return '#28367a';
  if (/^9\d{3}$/.test(n)) return '#e60012';
  if (/^\d{2}$/.test(n)) return '#f2b70a';
  if (/^\d{4}/.test(n)) return '#53b332';
  return '#0068b7';
}

/** 노선 원 안에 쓰는 짧은 표시: "2호선" → "2", "신분당" → "신분당", 버스 "N75" → "N75" */
export function lineBadge(leg: { line: string; kind?: 'bus' }): string {
  const n = leg.line.trim().match(/^(\d)호선$/);
  return n ? n[1]! : normLine(leg.line);
}

export function lineColor(leg: { line: string; kind?: 'bus' } | undefined): string | null {
  if (!leg?.line) return null;
  if (leg.kind === 'bus') return busColor(leg.line);
  return SUBWAY[normLine(leg.line)] ?? SUBWAY[leg.line.trim()] ?? null;
}

const NIGHT = [11, 13, 16]; // #0b0d10 — 밤 바닥

/**
 * 화면 바탕: 공식 노선색을 그대로 쓰되, 흰 글자 대비(4.6:1)가 안 나오면 그만큼만 밤 바닥 쪽으로 섞는다.
 * (1호선은 그대로, 2호선·9호선 베이지·수인분당 노랑은 대비가 나올 때까지만 어둡게). t는 노선색 비율의 시작값.
 */
export function fieldColor(hex: string | null, t = 1): string {
  if (!hex) return '#1b1e24';
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // 밝은 노선은 대비가 나올 때까지 노선색을 조금씩 줄인다 (어두운 노선은 그대로)
  for (let k = t; ; k -= 0.04) {
    const mixed = c.map((v, i) => Math.round(v * k + NIGHT[i]! * (1 - k)));
    if (k <= 0.2 || contrastWithWhite(mixed) >= 4.6) return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
}

// WCAG 대비 (흰 글자 기준)
function contrastWithWhite(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r! + 0.7152 * g! + 0.0722 * b! + 0.05);
}
