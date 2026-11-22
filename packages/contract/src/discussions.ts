import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common";

/** Кафедру для области `department` сервер определяет по сессии студента. */
export const DiscussionScopeSchema = z.enum(["university", "department"]);
export type DiscussionScope = z.infer<typeof DiscussionScopeSchema>;

export const DiscussionListQuerySchema = z.object({ scope: DiscussionScopeSchema });
export type DiscussionListQuery = z.infer<typeof DiscussionListQuerySchema>;

export const DiscussionAuthorSchema = z.object({ displayName: z.string().min(1) });
export type DiscussionAuthor = z.infer<typeof DiscussionAuthorSchema>;

const title = z.string().trim().min(1).max(150);
const body = z.string().trim().min(1).max(4000);

export const CreateDiscussionInputSchema = z.strictObject({
  scope: DiscussionScopeSchema,
  title,
  body,
});
export type CreateDiscussionInput = z.infer<typeof CreateDiscussionInputSchema>;

export const CreateDiscussionCommentInputSchema = z.strictObject({ body });
export type CreateDiscussionCommentInput = z.infer<typeof CreateDiscussionCommentInputSchema>;

export const DiscussionTopicSummarySchema = z.object({
  id: IdSchema,
  scope: DiscussionScopeSchema,
  title,
  author: DiscussionAuthorSchema,
  createdAt: IsoDateTimeSchema,
});
export type DiscussionTopicSummary = z.infer<typeof DiscussionTopicSummarySchema>;

/** `id` сохраняется при чтении и используется для жалобы на комментарий. */
export const DiscussionCommentSchema = z.object({
  id: IdSchema,
  body,
  author: DiscussionAuthorSchema,
  createdAt: IsoDateTimeSchema,
});
export type DiscussionComment = z.infer<typeof DiscussionCommentSchema>;

/** Комментарии по времени создания. Чужая кафедра получает 404 на чтение и ответ. */
export const DiscussionTopicSchema = DiscussionTopicSummarySchema.extend({
  body,
  comments: z.array(DiscussionCommentSchema),
});
export type DiscussionTopic = z.infer<typeof DiscussionTopicSchema>;
