import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { departments, discussionComments, discussionTopics, groups, users } from "../schema";
import { seedId } from "./data";

/** Дополняет старый сид при первом запуске. Созданные пользователями обсуждения сохраняются. */
export async function seedDiscussions(db: Db, now: Date): Promise<void> {
  const student = seedId("user:student");
  const student2 = seedId("user:student2");
  const universityTopic = seedId("discussion:projects");
  const examples = [
    {
      group: "pii301",
      department: "Кафедра интеллектуальных систем",
      authorId: student,
      title: "Практикум по нейросетям",
      body: "Какие задачи разберём на открытом практикуме кафедры?",
    },
    {
      group: "ad201",
      department: "Кафедра анализа данных",
      authorId: student2,
      title: "Встреча клуба аналитиков",
      body: "Предлагайте темы для разбора на следующей встрече.",
    },
  ];

  await db.transaction(async (tx) => {
    const accounts = await tx
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [student, student2]));
    if (accounts.length !== 2) return;

    for (const example of examples) {
      const departmentId = seedId(`department:${example.group}`);
      await tx
        .insert(departments)
        .values({ id: departmentId, name: example.department })
        .onConflictDoNothing({ target: departments.id });
      await tx
        .update(groups)
        .set({ departmentId })
        .where(and(eq(groups.id, seedId(`group:${example.group}`)), isNull(groups.departmentId)));
      await tx
        .insert(discussionTopics)
        .values({
          id: seedId(`discussion:${example.group}`),
          departmentId,
          authorId: example.authorId,
          title: example.title,
          body: example.body,
          createdAt: now,
        })
        .onConflictDoNothing({ target: discussionTopics.id });
    }

    await tx
      .insert(discussionTopics)
      .values({
        id: universityTopic,
        authorId: student,
        title: "Идеи для недели студенческих проектов",
        body: "Чем хотите поделиться на неделе проектов? Расскажите о своей идее.",
        createdAt: now,
      })
      .onConflictDoNothing({ target: discussionTopics.id });
    await tx
      .insert(discussionComments)
      .values({
        id: seedId("discussion-comment:projects"),
        topicId: universityTopic,
        authorId: student2,
        body: "Можем показать, как визуализируем расписание.",
        createdAt: now,
      })
      .onConflictDoNothing({ target: discussionComments.id });
  });
}
