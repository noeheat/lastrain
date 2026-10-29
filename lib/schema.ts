import { z } from 'zod';
import { parseHHMM } from './time';

export const PersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  station: z.string().trim().min(1).max(30),
  train: z.string().refine((v) => parseHHMM(v) != null, '막차 시각 형식이 잘못됐어요'),
  walk: z.number().int().min(0).max(180),
});

export const SavedSchema = z.object({
  people: z.array(PersonSchema).length(2),
});

export type Saved = z.infer<typeof SavedSchema>;

// API 쿼리 검증 (app/api 라우트)
const StationId = z.string().regex(/^[A-Z0-9-]{4,24}$/, '역 ID 형식이 잘못됐어요');

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
