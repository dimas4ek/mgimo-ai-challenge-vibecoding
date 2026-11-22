import { z } from "zod";

/** Сведения о группе текущего студента. Состав содержит только отображаемые имена. */
export const MyGroupSchema = z.strictObject({
  name: z.string().min(1),
  course: z.number().int().positive(),
  program: z.string().min(1),
  curator: z.string().min(1).nullable(),
  members: z.array(z.string().min(1)),
  announcements: z.array(z.string().min(1)),
});

export type MyGroup = z.infer<typeof MyGroupSchema>;
