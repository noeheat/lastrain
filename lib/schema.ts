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
