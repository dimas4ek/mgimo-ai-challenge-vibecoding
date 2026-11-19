import { z } from "zod";

/** Ответ `GET /api/health`: API запущен и отвечает. */
export const HealthSchema = z.object({
  status: z.literal("ok"),
});
export type Health = z.infer<typeof HealthSchema>;
