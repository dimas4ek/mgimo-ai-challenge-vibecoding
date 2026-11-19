import { z } from "zod";
import { IdSchema } from "./common";

export const RoleSchema = z.enum(["student", "staff"]);
export type Role = z.infer<typeof RoleSchema>;

/** Вход `POST /api/auth/login`. */
export const LoginInputSchema = z.object({
  login: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Текущий пользователь: ответ `POST /api/auth/login` и `GET /api/auth/me`. */
export const MeSchema = z.object({
  id: IdSchema,
  role: RoleSchema,
  /** Как показывать в шапке: «Мирослава Лебедянская». */
  displayName: z.string().min(1),
});
export type Me = z.infer<typeof MeSchema>;
