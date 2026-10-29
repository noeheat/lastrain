import { z } from 'zod';
import { parseHHMM } from './time';

const StationId = z.string().regex(/^[A-Z0-9-]{4,24}$/, '역 ID 형식이 잘못됐어요');

export const StationSchema = z.object({
  id: StationId,
  name: z.string().min(1).max(30),
  line: z.string().max(20),
});

export const PersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  station: z.string().trim().min(1).max(30),
  train: z.string().refine((v) => parseHHMM(v) != null, '막차 시각 형식이 잘못됐어요'),
  walk: z.number().int().min(0).max(180),
  // 검색으로 고른 역 (직접 입력했거나 v2 2단계 이전 저장값이면 없음)
  origin: StationSchema.optional(),
  dest: StationSchema.optional(),
});

export const SavedSchema = z.object({
  people: z.array(PersonSchema).length(2),
});

export type Saved = z.infer<typeof SavedSchema>;

// API 쿼리 검증 (app/api 라우트)
export const StationQuerySchema = z.object({
  q: z.string().trim().min(1).max(20),
});

export const LastTrainQuerySchema = z
  .object({
    origin: StationId,
    dest: StationId,
    daily: z.enum(['01', '02', '03']),
  })
  .refine((v) => v.origin !== v.dest, '출발역과 도착역이 같아요');
