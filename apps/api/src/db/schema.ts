// Схема БД. Меняется только через миграцию: `pnpm db:generate` (drizzle-kit), SQL руками не правим.
// Значения enum совпадают с enum из `@aihs/contract`, чтобы строки уходили в DTO как есть.
import type { CertificateGrade } from "@aihs/contract";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["student", "staff"]);
export const lessonTypeEnum = pgEnum("lesson_type", [
  "lecture",
  "seminar",
  "lab",
  "consultation",
  "exam",
]);
export const lessonChangeKindEnum = pgEnum("lesson_change_kind", [
  "moved",
  "replaced",
  "cancelled",
]);
export const controlFormEnum = pgEnum("control_form", ["exam", "credit", "graded_credit"]);
export const gradeResultEnum = pgEnum("grade_result", [
  "excellent",
  "good",
  "satisfactory",
  "unsatisfactory",
  "passed",
  "failed",
  "pending",
]);
export const requestTypeEnum = pgEnum("request_type", [
  "enrollment_certificate",
  "scholarship_certificate",
  "military_registration_certificate",
  "transcript",
  "retake_application",
  "academic_leave_application",
  "individual_schedule_application",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "submitted",
  "in_review",
  "ready",
  "rejected",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "news",
  "deadline",
  "schedule_change",
  "request",
]);
export const discussionReportStatusEnum = pgEnum("discussion_report_status", [
  "pending",
  "hidden",
  "dismissed",
]);

/** Учётная запись: студент или сотрудник деканата. */
export const users = pgTable("users", {
  id: id(),
  login: text("login").notNull().unique(),
  /** argon2id, открытый пароль нигде не хранится. */
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  /** Как показывать в шапке: «Мирослава Лебедянская». */
  displayName: text("display_name").notNull(),
  createdAt: createdAt(),
});

/** Сессия входа. В cookie уходит токен, здесь хранится только его хеш. */
export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 токена из cookie (hex). */
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const faculties = pgTable("faculties", {
  id: id(),
  name: text("name").notNull().unique(),
});

export const departments = pgTable("departments", {
  id: id(),
  name: text("name").notNull().unique(),
});

/** Учебная группа. Направление и курс — свойства группы. */
export const groups = pgTable("groups", {
  id: id(),
  name: text("name").notNull().unique(),
  facultyId: uuid("faculty_id")
    .notNull()
    .references(() => faculties.id),
  /** «09.03.01 Прикладной искусственный интеллект». */
  program: text("program").notNull(),
  course: integer("course").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
});

export const students = pgTable("students", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  /** Вымышленный формат: `AI-2024-0142`. */
  recordBookNumber: text("record_book_number").notNull().unique(),
  email: text("email").notNull(),
});

/** Отсутствие кафедры у темы означает, что тема общая для вуза. */
export const discussionTopics = pgTable(
  "discussion_topics",
  {
    id: id(),
    departmentId: uuid("department_id").references(() => departments.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("discussion_topics_department_date_idx").on(t.departmentId, t.createdAt)],
);

export const discussionComments = pgTable(
  "discussion_comments",
  {
    id: id(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => discussionTopics.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("discussion_comments_topic_date_idx").on(t.topicId, t.createdAt)],
);

export const discussionReports = pgTable(
  "discussion_reports",
  {
    id: id(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => discussionComments.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: discussionReportStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("discussion_reports_comment_reporter_idx").on(t.commentId, t.reporterId),
    index("discussion_reports_queue_idx").on(t.status, t.createdAt),
  ],
);

export const teachers = pgTable("teachers", {
  id: id(),
  /** «Зарецкий Глеб Аркадьевич». */
  fullName: text("full_name").notNull(),
});

export const subjects = pgTable("subjects", {
  id: id(),
  name: text("name").notNull().unique(),
});

/** Пара группы в конкретный день. Дата — календарная по Москве, время — `HH:MM` по Москве. */
export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id),
    type: lessonTypeEnum("type").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    room: text("room").notNull(),
  },
  (t) => [index("lessons_group_date_idx").on(t.groupId, t.date)],
);

/** Изменение пары (перенос, замена, отмена). Не больше одного на пару. */
export const lessonChanges = pgTable("lesson_changes", {
  lessonId: uuid("lesson_id")
    .primaryKey()
    .references(() => lessons.id, { onDelete: "cascade" }),
  kind: lessonChangeKindEnum("kind").notNull(),
  /** Пояснение для студента: «Перенесено с 18.11 из-за конференции». */
  note: text("note").notNull(),
  /** Для `moved`: где пара стояла раньше. */
  originalDate: date("original_date", { mode: "string" }),
  originalStart: text("original_start"),
});

/** Семестр и его экзаменационная сессия. */
export const semesters = pgTable("semesters", {
  id: id(),
  /** «Осенний семестр 2026/27». */
  name: text("name").notNull().unique(),
  sessionStart: date("session_start", { mode: "string" }),
  sessionEnd: date("session_end", { mode: "string" }),
  /** Текущий семестр ровно один. */
  isCurrent: boolean("is_current").notNull().default(false),
});

/** Баллы БРС студента по дисциплине в семестре. Итоговая сумма считается, а не хранится. */
export const grades = pgTable(
  "grades",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id),
    controlForm: controlFormEnum("control_form").notNull(),
    /** Трудоёмкость, з. е. */
    credits: integer("credits").notNull(),
    /** 0–60. */
    semesterPoints: integer("semester_points").notNull(),
    /** 0–40; `null` — ещё не сдавал. */
    examPoints: integer("exam_points"),
    result: gradeResultEnum("result").notNull(),
    /** Экзамен или зачёт: дата, время начала по Москве (`HH:MM`) и аудитория; `null` — не назначен. */
    examDate: date("exam_date", { mode: "string" }),
    examStart: text("exam_start"),
    examRoom: text("exam_room"),
  },
  (t) => [
    uniqueIndex("grades_student_semester_subject_idx").on(t.studentId, t.semesterId, t.subjectId),
  ],
);

/** Заявка студента: справка или заявление. */
export const requests = pgTable(
  "requests",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    type: requestTypeEnum("type").notNull(),
    status: requestStatusEnum("status").notNull().default("submitted"),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("requests_student_idx").on(t.studentId)],
);

/** История статусов заявки. Первая запись — `submitted`. */
export const requestHistory = pgTable(
  "request_history",
  {
    id: id(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    status: requestStatusEnum("status").notNull(),
    /** Комментарий деканата. */
    comment: text("comment"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_history_request_idx").on(t.requestId)],
);

/**
 * Выданная справка. Строка появляется при первом открытии готовой заявки-справки и дальше не меняется:
 * по токену из QR любой может проверить подлинность без входа.
 */
export const certificates = pgTable("certificates", {
  requestId: uuid("request_id")
    .primaryKey()
    .references(() => requests.id, { onDelete: "cascade" }),
  /** 32 случайных байта в base64url. Секрет, напечатанный в QR, поэтому подобрать его нельзя. */
  token: text("token").notNull().unique(),
  /** Номер для печати, вымышленный формат: `AIHS-2026-4F7A1C9B`. */
  number: text("number").notNull().unique(),
  /** Снимок оценок на момент выдачи: только у выписки (`transcript`), у остальных `null`. */
  grades: jsonb("grades").$type<CertificateGrade[]>(),
  createdAt: createdAt(),
});

/** Уведомление пользователю. */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Путь внутри приложения (`/requests/<id>`) или `null`. */
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

/**
 * Служебные отметки сида: одна строка (`id = 1`). `seededAt` — момент последнего засева,
 * от него сброс демо-данных строит заявки и уведомления, чтобы они совпадали с расписанием.
 */
export const seedMeta = pgTable("seed_meta", {
  id: integer("id").primaryKey(),
  seededAt: timestamp("seeded_at", { withTimezone: true }).notNull(),
  scheduleVersion: integer("schedule_version").notNull().default(1),
});
