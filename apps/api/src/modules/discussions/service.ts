import type {
  CreateDiscussionCommentInput,
  CreateDiscussionInput,
  DiscussionComment,
  DiscussionScope,
  DiscussionTopic,
  DiscussionTopicSummary,
} from "@aihs/contract";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { discussionComments, discussionTopics, groups, students, users } from "../../db/schema";
import type { SessionUser } from "../../env";

function departmentOf(db: Db, studentId: string | null) {
  return db
    .select({ id: groups.departmentId })
    .from(students)
    .innerJoin(groups, eq(students.groupId, groups.id))
    .where(studentId ? eq(students.id, studentId) : sql`false`);
}

/** Проверка видимости темы для запросов студента, включая запись по прямому id. */
export function visibleDiscussion(db: Db, studentId: string | null) {
  return or(
    isNull(discussionTopics.departmentId),
    eq(discussionTopics.departmentId, departmentOf(db, studentId)),
  );
}

const topicColumns = {
  id: discussionTopics.id,
  departmentId: discussionTopics.departmentId,
  title: discussionTopics.title,
  createdAt: discussionTopics.createdAt,
  displayName: users.displayName,
};

function topicSummary(
  row: Pick<typeof discussionTopics.$inferSelect, "id" | "departmentId" | "title" | "createdAt"> & {
    displayName: string;
  },
): DiscussionTopicSummary {
  return {
    id: row.id,
    scope: row.departmentId ? "department" : "university",
    title: row.title,
    author: { displayName: row.displayName },
    createdAt: row.createdAt.toISOString(),
  };
}

function commentDto(
  row: Pick<typeof discussionComments.$inferSelect, "id" | "body" | "createdAt"> & {
    displayName: string;
  },
): DiscussionComment {
  return {
    id: row.id,
    body: row.body,
    author: { displayName: row.displayName },
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDiscussions(db: Db, studentId: string | null, scope: DiscussionScope) {
  const topics = await db
    .select(topicColumns)
    .from(discussionTopics)
    .innerJoin(users, eq(discussionTopics.authorId, users.id))
    .where(
      scope === "university"
        ? isNull(discussionTopics.departmentId)
        : eq(discussionTopics.departmentId, departmentOf(db, studentId)),
    )
    .orderBy(desc(discussionTopics.createdAt), desc(discussionTopics.id));
  return topics.map(topicSummary);
}

export async function getDiscussion(
  db: Db,
  studentId: string | null,
  id: string,
): Promise<DiscussionTopic | null> {
  const [topic] = await db
    .select({ ...topicColumns, body: discussionTopics.body })
    .from(discussionTopics)
    .innerJoin(users, eq(discussionTopics.authorId, users.id))
    .where(and(eq(discussionTopics.id, id), visibleDiscussion(db, studentId)));
  if (!topic) return null;

  const comments = await db
    .select({
      id: discussionComments.id,
      body: discussionComments.body,
      createdAt: discussionComments.createdAt,
      displayName: users.displayName,
    })
    .from(discussionComments)
    .innerJoin(users, eq(discussionComments.authorId, users.id))
    .where(eq(discussionComments.topicId, topic.id))
    .orderBy(asc(discussionComments.createdAt), asc(discussionComments.id));
  return { ...topicSummary(topic), body: topic.body, comments: comments.map(commentDto) };
}

export async function createDiscussion(
  db: Db,
  user: SessionUser,
  input: CreateDiscussionInput,
  now: Date,
): Promise<DiscussionTopic | null> {
  let departmentId: string | null = null;
  if (input.scope === "department") {
    const [department] = await departmentOf(db, user.studentId);
    if (!department?.id) return null;
    departmentId = department.id;
  }

  const [topic] = await db
    .insert(discussionTopics)
    .values({
      title: input.title,
      body: input.body,
      departmentId,
      authorId: user.id,
      createdAt: now,
    })
    .returning();
  if (!topic) throw new Error("Тема не сохранилась");
  return {
    ...topicSummary({ ...topic, displayName: user.displayName }),
    body: topic.body,
    comments: [],
  };
}

export async function addDiscussionComment(
  db: Db,
  user: SessionUser,
  topicId: string,
  input: CreateDiscussionCommentInput,
  now: Date,
): Promise<DiscussionComment | null> {
  return db.transaction(async (tx) => {
    const [topic] = await tx
      .select({ id: discussionTopics.id })
      .from(discussionTopics)
      .where(and(eq(discussionTopics.id, topicId), visibleDiscussion(tx, user.studentId)))
      .for("key share");
    if (!topic) return null;

    const [comment] = await tx
      .insert(discussionComments)
      .values({ topicId: topic.id, authorId: user.id, body: input.body, createdAt: now })
      .returning();
    if (!comment) throw new Error("Ответ не сохранился");
    return commentDto({ ...comment, displayName: user.displayName });
  });
}
