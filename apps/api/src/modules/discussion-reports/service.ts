import type {
  CreateDiscussionReportInput,
  DiscussionReportReceipt,
  ResolveDiscussionReportInput,
  StaffDiscussionReport,
  StaffDiscussionReportSummary,
} from "@aihs/contract";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/client";
import { discussionComments, discussionReports, discussionTopics, users } from "../../db/schema";
import type { SessionUser } from "../../env";
import { visibleDiscussion } from "../discussions/service";

export async function createDiscussionReport(
  db: Db,
  user: SessionUser,
  commentId: string,
  input: CreateDiscussionReportInput,
  now: Date,
): Promise<
  { kind: "created"; receipt: DiscussionReportReceipt } | { kind: "not_found" | "duplicate" }
> {
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .select({ id: discussionComments.id })
      .from(discussionComments)
      .innerJoin(discussionTopics, eq(discussionComments.topicId, discussionTopics.id))
      .where(
        and(
          eq(discussionComments.id, commentId),
          isNull(discussionComments.hiddenAt),
          visibleDiscussion(tx, user.studentId),
        ),
      )
      .for("update", { of: discussionComments });
    if (!comment) return { kind: "not_found" };

    const [report] = await tx
      .insert(discussionReports)
      .values({
        commentId: comment.id,
        reporterId: user.id,
        reason: input.reason,
        createdAt: now,
      })
      .onConflictDoNothing({ target: [discussionReports.commentId, discussionReports.reporterId] })
      .returning({ id: discussionReports.id, createdAt: discussionReports.createdAt });
    if (!report) return { kind: "duplicate" };
    return {
      kind: "created",
      receipt: { id: report.id, status: "pending", createdAt: report.createdAt.toISOString() },
    };
  });
}

const queueColumns = {
  id: discussionReports.id,
  reason: discussionReports.reason,
  status: discussionReports.status,
  createdAt: discussionReports.createdAt,
  resolvedAt: discussionReports.resolvedAt,
  topic: { id: discussionTopics.id, title: discussionTopics.title },
  commentId: discussionReports.commentId,
};

function reportSummary(
  row: Omit<StaffDiscussionReportSummary, "createdAt" | "resolvedAt"> & {
    createdAt: Date;
    resolvedAt: Date | null;
  },
): StaffDiscussionReportSummary {
  return {
    id: row.id,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    topic: row.topic,
    commentId: row.commentId,
  };
}

export async function listDiscussionReports(db: Db) {
  const rows = await db
    .select(queueColumns)
    .from(discussionReports)
    .innerJoin(discussionComments, eq(discussionReports.commentId, discussionComments.id))
    .innerJoin(discussionTopics, eq(discussionComments.topicId, discussionTopics.id))
    .orderBy(
      asc(discussionReports.status),
      desc(discussionReports.createdAt),
      desc(discussionReports.id),
    );
  return rows.map(reportSummary);
}

export async function getDiscussionReport(
  db: Db,
  id: string,
): Promise<StaffDiscussionReport | null> {
  const [row] = await db
    .select({
      ...queueColumns,
      body: discussionComments.body,
      commentCreatedAt: discussionComments.createdAt,
      hiddenAt: discussionComments.hiddenAt,
      displayName: users.displayName,
    })
    .from(discussionReports)
    .innerJoin(discussionComments, eq(discussionReports.commentId, discussionComments.id))
    .innerJoin(discussionTopics, eq(discussionComments.topicId, discussionTopics.id))
    .innerJoin(users, eq(discussionComments.authorId, users.id))
    .where(eq(discussionReports.id, id));
  if (!row) return null;
  return {
    ...reportSummary(row),
    comment: {
      body: row.body,
      author: { displayName: row.displayName },
      createdAt: row.commentCreatedAt.toISOString(),
      visibility: row.hiddenAt ? "hidden" : "visible",
    },
  };
}

export async function resolveDiscussionReport(
  db: Db,
  staffId: string,
  id: string,
  input: ResolveDiscussionReportInput,
  now: Date,
): Promise<
  { kind: "resolved"; report: StaffDiscussionReport } | { kind: "not_found" | "already_resolved" }
> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ commentId: discussionReports.commentId })
      .from(discussionReports)
      .where(eq(discussionReports.id, id));
    if (!target) return { kind: "not_found" };

    // И подача жалобы, и решение блокируют сначала комментарий. Это сериализует скрытие и новые жалобы.
    const [comment] = await tx
      .select({ id: discussionComments.id })
      .from(discussionComments)
      .where(eq(discussionComments.id, target.commentId))
      .for("update");
    if (!comment) return { kind: "not_found" };
    const decision = {
      status: input.decision === "hide" ? ("hidden" as const) : ("dismissed" as const),
      resolvedAt: now,
      resolvedBy: staffId,
    };
    const [updated] = await tx
      .update(discussionReports)
      .set(decision)
      .where(and(eq(discussionReports.id, id), eq(discussionReports.status, "pending")))
      .returning({ id: discussionReports.id });
    if (!updated) return { kind: "already_resolved" };

    if (input.decision === "hide") {
      await tx
        .update(discussionComments)
        .set({ hiddenAt: now })
        .where(eq(discussionComments.id, comment.id));
      await tx
        .update(discussionReports)
        .set(decision)
        .where(
          and(eq(discussionReports.commentId, comment.id), eq(discussionReports.status, "pending")),
        );
    }
    const report = await getDiscussionReport(tx, id);
    if (!report) throw new Error("Решение по жалобе не сохранилось");
    return { kind: "resolved", report };
  });
}
