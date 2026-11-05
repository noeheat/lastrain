// API 호출 제한 (서버 전용, 메모리): IP마다 1분에 정해진 횟수까지, 넘으면 429
// Vercel 인스턴스마다 따로 세므로 완전한 제한은 아니다. 한 사람이 반복 호출로 TAGO 하루 한도를 다 쓰는 것을 막는 용도
// 더 엄격하게 하려면 Upstash Redis 같은 공유 저장소가 필요하다 (외부 서비스 추가라 아직 안 함)

import { json } from './http';

const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000; // 메모리가 계속 늘지 않게 이보다 많아지면 끝난 칸을 지운다

/** 1분당 IP별 한도. 환승은 외부 API를 가장 많이 부르므로 가장 낮다 */
export const LIMITS = { stations: 60, 'last-train': 30, plan: 15, nearby: 30 } as const;
export type LimitedRoute = keyof typeof LIMITS;

type Bucket = { start: number; count: number };
export type Store = Map<string, Bucket>;
const buckets: Store = new Map();

/** 고정 윈도: 칸이 끝났으면 새로 시작. retryAfter는 칸이 끝날 때까지 남은 초 */
export function hit(key: string, limit: number, now: number, store: Store): { ok: boolean; retryAfter: number } {
  let b = store.get(key);
  if (!b || now - b.start >= WINDOW_MS) {
    if (store.size >= MAX_KEYS) {
      for (const [k, v] of store) if (now - v.start >= WINDOW_MS) store.delete(k);
    }
    b = { start: now, count: 0 };
    store.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.start + WINDOW_MS - now) / 1000) };
}

/** Vercel은 x-real-ip·x-forwarded-for를 직접 채운다. 로컬처럼 없으면 모두 한 칸으로 센다 */
export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** 라우트 첫 줄에서 부른다. 한도를 넘었으면 429 응답, 아니면 null */
export function rateLimit(req: Request, route: LimitedRoute, now = Date.now()): Response | null {
  const { ok, retryAfter } = hit(`${route}:${clientIp(req)}`, LIMITS[route], now, buckets);
  if (ok) return null;
  const res = json({ error: `요청이 너무 많아요. ${retryAfter}초 뒤에 다시 시도해 주세요.` }, 429);
  res.headers.set('retry-after', String(retryAfter));
  return res;
}
