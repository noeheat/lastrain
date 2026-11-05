import { z } from 'zod';
import { parseHHMM } from './time';

const StationId = z.string().regex(/^[A-Z0-9-]{4,24}$/, '역 ID 형식이 잘못됐어요');

export const StationSchema = z.object({
  id: StationId,
  name: z.string().min(1).max(30),
  line: z.string().max(20),
});

const HHMM = z.string().refine((v) => parseHHMM(v) != null, '시각 형식이 잘못됐어요');

export const RouteLegSchema = z.object({
  line: z.string().max(20),
  from: z.string().max(30),
  to: z.string().max(30),
  dep: HHMM,
  arr: HHMM.optional(),
  endName: z.string().max(30),
});

export const PersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  station: z.string().trim().min(1).max(30),
  train: z.string().refine((v) => parseHHMM(v) != null, '막차 시각 형식이 잘못됐어요'),
  walk: z.number().int().min(0).max(180).optional(), // 예전 저장값 (쓰지 않음)
  // 검색으로 고른 역 (직접 입력했거나 v2 2단계 이전 저장값이면 없음)
  origin: StationSchema.optional(),
  dest: StationSchema.optional(),
  route: z.array(RouteLegSchema).min(1).max(5).optional(),
});

export const MAX_PEOPLE = 6;

// 함께 출발하는 역: 입력한 이름과, 검색으로 골랐다면 그 이름의 노선별 역 (강남: 2호선·신분당)
export const OriginSchema = z.object({
  text: z.string().trim().max(30),
  options: z.array(StationSchema).max(10),
});

// origin이 없는 저장값(2명 고정이던 때)은 사람들의 출발역에서 다시 만든다
export const SavedSchema = z.object({
  origin: OriginSchema.optional(),
  people: z.array(PersonSchema).max(MAX_PEOPLE),
});

export type Saved = z.infer<typeof SavedSchema>;

// API 쿼리 검증 (app/api 라우트)
export const PlanQuerySchema = z
  .object({
    origin: z.string().trim().min(1).max(30),
    dest: z.string().trim().min(1).max(30),
    daily: z.enum(['01', '02', '03']),
  })
  .refine((v) => v.origin !== v.dest, '출발역과 도착역이 같아요');

export const StationQuerySchema = z.object({
  q: z.string().trim().min(1).max(20),
});

export const LastTrainQuerySchema = z
  .object({
    origin: StationId,
    dest: StationId,
    daily: z.enum(['01', '02', '03']),
    // 서울 시간표 조회용 (역코드 체계가 달라서 이름·노선으로 찾는다). 없으면 TAGO만 쓴다.
    originName: z.string().trim().min(1).max(30).optional(),
    destName: z.string().trim().min(1).max(30).optional(),
    line: z.string().trim().min(1).max(20).optional(),
  })
  .refine((v) => v.origin !== v.dest, '출발역과 도착역이 같아요');
