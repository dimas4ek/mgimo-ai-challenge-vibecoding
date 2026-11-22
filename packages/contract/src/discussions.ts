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

export const DiscussionCommentVisibilitySchema = z.enum(["visible", "hidden"]);
export type DiscussionCommentVisibility = z.infer<typeof DiscussionCommentVisibilitySchema>;

const commentFields = z.object({
  id: IdSchema,
  author: DiscussionAuthorSchema,
  createdAt: IsoDateTimeSchema,
});

/** `id` остаётся прежним после модерации; скрытый текст никогда не входит в студенческий DTO. */
export const DiscussionCommentSchema = z.union([
  // Уже опубликованные ответы API без признака видимости считаются видимыми.
  commentFields.extend({ visibility: z.literal("visible").optional(), body }),
  commentFields.extend({ visibility: z.literal("hidden"), body: z.null() }),
]);
export type DiscussionComment = z.infer<typeof DiscussionCommentSchema>;

/** Комментарии по времени создания. Чужая кафедра получает 404 на чтение и ответ. */
export const DiscussionTopicSchema = DiscussionTopicSummarySchema.extend({
  body,
  comments: z.array(DiscussionCommentSchema),
});
export type DiscussionTopic = z.infer<typeof DiscussionTopicSchema>;
