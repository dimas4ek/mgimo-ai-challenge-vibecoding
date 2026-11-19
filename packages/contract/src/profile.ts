import { z } from "zod";

/** Профиль студента, `GET /api/me/profile`. Все данные вымышленные. */
export const ProfileSchema = z.object({
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().nullable(),
  /** Номер зачётной книжки, формат вымышленный: `AI-2025-0142`. */
  recordBookNumber: z.string().min(1),
  faculty: z.string().min(1),
  /** Направление подготовки: «09.03.01 Прикладной искусственный интеллект». */
  program: z.string().min(1),
  course: z.number().int().min(1).max(6),
  group: z.string().min(1),
  email: z.email(),
});
export type Profile = z.infer<typeof ProfileSchema>;
