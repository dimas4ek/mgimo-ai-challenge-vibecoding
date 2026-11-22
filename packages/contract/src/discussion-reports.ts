import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common";
import { DiscussionAuthorSchema, DiscussionCommentVisibilitySchema } from "./discussions";

const reason = z.string().trim().min(1).max(500);

export const CreateDiscussionReportInputSchema = z.strictObject({ reason });
export type CreateDiscussionReportInput = z.infer<typeof CreateDiscussionReportInputSchema>;

/** Повтор от того же студента на тот же комментарий возвращает 409. */
export const DiscussionReportReceiptSchema = z.object({
  id: IdSchema,
  status: z.literal("pending"),
  createdAt: IsoDateTimeSchema,
});
export type DiscussionReportReceipt = z.infer<typeof DiscussionReportReceiptSchema>;

export const DiscussionReportStatusSchema = z.enum(["pending", "hidden", "dismissed"]);
export type DiscussionReportStatus = z.infer<typeof DiscussionReportStatusSchema>;

export const ResolveDiscussionReportInputSchema = z.strictObject({
  decision: z.enum(["hide", "dismiss"]),
});
export type ResolveDiscussionReportInput = z.infer<typeof ResolveDiscussionReportInputSchema>;

export const StaffDiscussionReportSummarySchema = z.object({
  id: IdSchema,
  reason,
  status: DiscussionReportStatusSchema,
  createdAt: IsoDateTimeSchema,
  resolvedAt: IsoDateTimeSchema.nullable(),
  topic: z.object({ id: IdSchema, title: z.string() }),
  commentId: IdSchema,
});
export type StaffDiscussionReportSummary = z.infer<typeof StaffDiscussionReportSummarySchema>;

/** Оригинал текста нужен сотруднику для рассмотрения, в студенческий ответ он не попадает. */
export const StaffDiscussionReportSchema = StaffDiscussionReportSummarySchema.extend({
  comment: z.object({
    body: z.string(),
    author: DiscussionAuthorSchema,
    createdAt: IsoDateTimeSchema,
    visibility: DiscussionCommentVisibilitySchema,
  }),
});
export type StaffDiscussionReport = z.infer<typeof StaffDiscussionReportSchema>;
