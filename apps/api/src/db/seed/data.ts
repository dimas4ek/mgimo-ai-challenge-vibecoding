// Демо-данные вымышленного вуза AI High School (.claude/rules/fictional-data.md).
// Совпадения ФИО с реальными людьми случайны. Все даты считаются от `now` по Москве.
import { createHash } from "node:crypto";
import { addDays, mondayOf, moscowDate } from "../../lib/moscow-time";
import type * as schema from "../schema";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

/** Детерминированный UUID (версия 8, «свой формат») из ключа: повторный сид даёт те же id. */
export function seedId(key: string): string {
  const h = createHash("sha256").update(`aihs-seed:${key}`).digest("hex");
  const variant = ((Number.parseInt(h.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Время пар по номеру. */
export const PAIRS = {
  1: { start: "09:00", end: "10:30" },
  2: { start: "10:45", end: "12:15" },
  3: { start: "13:00", end: "14:30" },
  4: { start: "14:45", end: "16:15" },
  5: { start: "16:30", end: "18:00" },
} as const;
type Pair = keyof typeof PAIRS;
/** День недели: 1 — понедельник … 6 — суббота. */
type Weekday = 1 | 2 | 3 | 4 | 5 | 6;

/** Пары строятся на недели от −2 до +4 относительно текущей. */
const WEEKS = [-2, -1, 0, 1, 2, 3, 4];

const ddmm = (isoDate: string) => `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;
const hoursBefore = (now: Date, hours: number) => new Date(now.getTime() - hours * 3_600_000);

const faculties = {
  ai: "Факультет прикладного искусственного интеллекта",
  data: "Факультет науки о данных",
} as const;

const teachers = {
  zaretsky: "Зарецкий Глеб Аркадьевич",
  olkhovskaya: "Ольховская Нина Викторовна",
  belomestnov: "Беломестнов Ростислав Ильич",
  karimova: "Каримова Ольга Тимуровна",
  lapteva: "Лаптева Дарина Сергеевна",
  sviridova: "Свиридова Алиса Романовна",
  prokhorenko: "Прохоренко Лев Матвеевич",
  vengerova: "Венгерова Элина Павловна",
} as const;
type TeacherKey = keyof typeof teachers;

const subjects = {
  ml: "Машинное обучение",
  nlp: "Обработка естественного языка",
  ethics: "Этика искусственного интеллекта",
  prob: "Теория вероятностей и статистика",
  cv: "Компьютерное зрение",
  calculus: "Математический анализ",
  linalg: "Линейная алгебра",
  python: "Python для анализа данных",
  databases: "Базы данных",
  english: "Английский язык в профессиональной сфере",
} as const;
type SubjectKey = keyof typeof subjects;

interface Slot {
  day: Weekday;
  pair: Pair;
  subject: SubjectKey;
  teacher: TeacherKey;
  type: Insert<typeof schema.lessons>["type"];
  room: string;
}

/** Изменение пары на конкретной неделе. `note` получает исходную дату пары. */
type Override = {
  week: number;
  day: Weekday;
  pair: Pair;
  note: (originalDate: string) => string;
} & (
  | { kind: "moved"; to: { day: Weekday; pair: Pair } }
  | { kind: "replaced"; room?: string; teacher?: TeacherKey }
  | { kind: "cancelled" }
);

interface GroupDef {
  name: string;
  faculty: keyof typeof faculties;
  program: string;
  course: number;
  timetable: Slot[];
  overrides: Override[];
}

const groups = {
  pii301: {
    name: "ПИИ-301",
    faculty: "ai",
    program: "09.03.01 Прикладной искусственный интеллект",
    course: 3,
    timetable: [
      { day: 1, pair: 1, subject: "ml", teacher: "zaretsky", type: "lecture", room: "А-214" },
      {
        day: 1,
        pair: 2,
        subject: "ml",
        teacher: "olkhovskaya",
        type: "lab",
        room: "Б-108 (компьютерный класс)",
      },
      { day: 2, pair: 1, subject: "cv", teacher: "lapteva", type: "lecture", room: "А-214" },
      {
        day: 2,
        pair: 2,
        subject: "cv",
        teacher: "lapteva",
        type: "lab",
        room: "Б-110 (компьютерный класс)",
      },
      { day: 3, pair: 1, subject: "nlp", teacher: "belomestnov", type: "seminar", room: "А-305" },
      { day: 3, pair: 2, subject: "nlp", teacher: "belomestnov", type: "lecture", room: "А-214" },
      { day: 4, pair: 1, subject: "ethics", teacher: "karimova", type: "lecture", room: "А-101" },
      { day: 4, pair: 3, subject: "prob", teacher: "zaretsky", type: "lecture", room: "А-210" },
      { day: 5, pair: 2, subject: "prob", teacher: "zaretsky", type: "seminar", room: "А-210" },
      { day: 5, pair: 3, subject: "cv", teacher: "lapteva", type: "seminar", room: "А-307" },
      {
        day: 6,
        pair: 2,
        subject: "ml",
        teacher: "olkhovskaya",
        type: "lab",
        room: "Б-108 (компьютерный класс)",
      },
    ],
    overrides: [
      {
        week: 0,
        day: 3,
        pair: 1,
        kind: "moved",
        to: { day: 2, pair: 3 },
        note: (d) => `Перенесено с ${ddmm(d)}: преподаватель на конференции`,
      },
      {
        week: 0,
        day: 4,
        pair: 1,
        kind: "replaced",
        room: "Актовый зал",
        note: () => "Замена аудитории: вместо А-101",
      },
      {
        week: 0,
        day: 5,
        pair: 2,
        kind: "cancelled",
        note: () => "Отменено, материал на самостоятельное изучение",
      },
      {
        week: 1,
        day: 6,
        pair: 2,
        kind: "replaced",
        teacher: "zaretsky",
        note: () => "Замена преподавателя: Ольховская Н. В. в командировке",
      },
    ],
  },
  ad201: {
    name: "АД-201",
    faculty: "data",
    program: "01.03.02 Анализ данных и машинное обучение",
    course: 2,
    timetable: [
      {
        day: 1,
        pair: 1,
        subject: "calculus",
        teacher: "sviridova",
        type: "lecture",
        room: "В-101",
      },
      {
        day: 1,
        pair: 3,
        subject: "databases",
        teacher: "prokhorenko",
        type: "lab",
        room: "В-012 (компьютерный класс)",
      },
      {
        day: 2,
        pair: 2,
        subject: "python",
        teacher: "prokhorenko",
        type: "lecture",
        room: "В-201",
      },
      {
        day: 2,
        pair: 3,
        subject: "python",
        teacher: "prokhorenko",
        type: "lab",
        room: "В-012 (компьютерный класс)",
      },
      { day: 3, pair: 1, subject: "linalg", teacher: "sviridova", type: "seminar", room: "В-105" },
      { day: 3, pair: 4, subject: "english", teacher: "vengerova", type: "seminar", room: "В-310" },
      {
        day: 4,
        pair: 2,
        subject: "calculus",
        teacher: "sviridova",
        type: "seminar",
        room: "В-105",
      },
      {
        day: 4,
        pair: 3,
        subject: "databases",
        teacher: "prokhorenko",
        type: "lecture",
        room: "В-201",
      },
      { day: 5, pair: 1, subject: "linalg", teacher: "sviridova", type: "lecture", room: "В-101" },
      {
        day: 6,
        pair: 2,
        subject: "python",
        teacher: "prokhorenko",
        type: "seminar",
        room: "В-201",
      },
    ],
    overrides: [
      {
        week: 0,
        day: 1,
        pair: 3,
        kind: "moved",
        to: { day: 6, pair: 1 },
        note: (d) => `Перенесено с ${ddmm(d)}: компьютерный класс на ремонте`,
      },
      {
        week: 0,
        day: 3,
        pair: 4,
        kind: "cancelled",
        note: () => "Отменено: преподаватель заболел",
      },
      {
        week: 1,
        day: 4,
        pair: 2,
        kind: "replaced",
        room: "В-210",
        note: () => "Замена аудитории: вместо В-105",
      },
    ],
  },
} as const satisfies Record<string, GroupDef>;
type GroupKey = keyof typeof groups;

interface PersonDef {
  key: "student" | "student2" | "staff";
  login: string;
  displayName: string;
}

interface StudentDef {
  user: PersonDef["key"];
  group: GroupKey;
  lastName: string;
  firstName: string;
  middleName: string | null;
  recordBookNumber: string;
  email: string;
}

const students: StudentDef[] = [
  {
    user: "student",
    group: "pii301",
    lastName: "Лебедянская",
    firstName: "Мирослава",
    middleName: "Игоревна",
    recordBookNumber: "AI-2024-0142",
    email: "m.lebedyanskaya@student.aihs.example",
  },
  {
    user: "student2",
    group: "ad201",
    lastName: "Колосовский",
    firstName: "Тихон",
    middleName: "Андреевич",
    recordBookNumber: "AI-2025-0217",
    email: "t.kolosovsky@student.aihs.example",
  },
];

type GradeDef = Pick<
  Insert<typeof schema.grades>,
  "controlForm" | "credits" | "semesterPoints" | "examPoints" | "result"
> & { subject: SubjectKey; teacher: TeacherKey };

const grades: Record<StudentDef["user"], GradeDef[]> = {
  student: [
    {
      subject: "ml",
      teacher: "zaretsky",
      controlForm: "exam",
      credits: 5,
      semesterPoints: 52,
      examPoints: null,
      result: "pending",
    },
    {
      subject: "nlp",
      teacher: "belomestnov",
      controlForm: "graded_credit",
      credits: 4,
      semesterPoints: 41,
      examPoints: 30,
      result: "good",
    },
    {
      subject: "ethics",
      teacher: "karimova",
      controlForm: "credit",
      credits: 2,
      semesterPoints: 58,
      examPoints: 35,
      result: "passed",
    },
    {
      subject: "prob",
      teacher: "zaretsky",
      controlForm: "exam",
      credits: 4,
      semesterPoints: 22,
      examPoints: 15,
      result: "unsatisfactory",
    },
    {
      subject: "cv",
      teacher: "lapteva",
      controlForm: "exam",
      credits: 4,
      semesterPoints: 47,
      examPoints: null,
      result: "pending",
    },
  ],
  student2: [
    {
      subject: "calculus",
      teacher: "sviridova",
      controlForm: "exam",
      credits: 5,
      semesterPoints: 38,
      examPoints: null,
      result: "pending",
    },
    {
      subject: "linalg",
      teacher: "sviridova",
      controlForm: "exam",
      credits: 4,
      semesterPoints: 44,
      examPoints: null,
      result: "pending",
    },
    {
      subject: "python",
      teacher: "prokhorenko",
      controlForm: "graded_credit",
      credits: 3,
      semesterPoints: 55,
      examPoints: 33,
      result: "excellent",
    },
    {
      subject: "databases",
      teacher: "prokhorenko",
      controlForm: "credit",
      credits: 3,
      semesterPoints: 30,
      examPoints: null,
      result: "pending",
    },
    {
      subject: "english",
      teacher: "vengerova",
      controlForm: "credit",
      credits: 2,
      semesterPoints: 51,
      examPoints: 30,
      result: "passed",
    },
  ],
  staff: [],
};

/** Текущий семестр по московской дате: сентябрь–январь — осенний, февраль–август — весенний. */
function currentSemester(today: string): Insert<typeof schema.semesters> {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const yy = (y: number) => String(y % 100).padStart(2, "0");
  if (month >= 9 || month === 1) {
    const start = month === 1 ? year - 1 : year;
    return {
      id: seedId(`semester:autumn:${start}`),
      name: `Осенний семестр ${start}/${yy(start + 1)}`,
      sessionStart: `${start}-12-28`,
      sessionEnd: `${start + 1}-01-24`,
      isCurrent: true,
    };
  }
  return {
    id: seedId(`semester:spring:${year}`),
    name: `Весенний семестр ${year - 1}/${yy(year)}`,
    sessionStart: `${year}-06-08`,
    sessionEnd: `${year}-06-30`,
    isCurrent: true,
  };
}

/** Пользователь сида с открытым паролем: хеш считает `seed()`, здесь его нет. */
export type SeedUser = Omit<Insert<typeof schema.users>, "passwordHash"> & {
  id: string;
  password: string;
};

export interface SeedData {
  users: SeedUser[];
  faculties: Insert<typeof schema.faculties>[];
  groups: Insert<typeof schema.groups>[];
  students: Insert<typeof schema.students>[];
  teachers: Insert<typeof schema.teachers>[];
  subjects: Insert<typeof schema.subjects>[];
  lessons: Insert<typeof schema.lessons>[];
  lessonChanges: Insert<typeof schema.lessonChanges>[];
  semesters: Insert<typeof schema.semesters>[];
  grades: Insert<typeof schema.grades>[];
  requests: Insert<typeof schema.requests>[];
  requestHistory: Insert<typeof schema.requestHistory>[];
  notifications: Insert<typeof schema.notifications>[];
}

/** Все строки сида для момента `now`. Чистая функция: тот же `now` → те же строки. */
export function buildSeedData(
  now: Date,
  accounts: Record<PersonDef["key"], { login: string; password: string }>,
): SeedData {
  const today = moscowDate(now);
  const monday = mondayOf(today);
  const id = {
    user: (k: PersonDef["key"]) => seedId(`user:${k}`),
    student: (k: PersonDef["key"]) => seedId(`student:${k}`),
    faculty: (k: keyof typeof faculties) => seedId(`faculty:${k}`),
    group: (k: GroupKey) => seedId(`group:${k}`),
    teacher: (k: TeacherKey) => seedId(`teacher:${k}`),
    subject: (k: SubjectKey) => seedId(`subject:${k}`),
    request: (k: string) => seedId(`request:${k}`),
  };

  const people: PersonDef[] = [
    { key: "student", login: accounts.student.login, displayName: "Мирослава Лебедянская" },
    { key: "student2", login: accounts.student2.login, displayName: "Тихон Колосовский" },
    { key: "staff", login: accounts.staff.login, displayName: "Вероника Сташевская" },
  ];
  const users: SeedUser[] = people.map((p) => ({
    id: id.user(p.key),
    login: p.login,
    password: accounts[p.key].password,
    role: p.key === "staff" ? "staff" : "student",
    displayName: p.displayName,
    createdAt: now,
  }));

  const lessons: SeedData["lessons"] = [];
  const lessonChanges: SeedData["lessonChanges"] = [];
  for (const [groupKey, group] of Object.entries(groups) as [GroupKey, GroupDef][]) {
    for (const week of WEEKS) {
      const weekMonday = addDays(monday, 7 * week);
      for (const slot of group.timetable) {
        const lessonId = seedId(`lesson:${groupKey}:${week}:${slot.day}:${slot.pair}`);
        const date = addDays(weekMonday, slot.day - 1);
        const ov = group.overrides.find(
          (o) => o.week === week && o.day === slot.day && o.pair === slot.pair,
        );
        let lessonDate = date;
        let pair = slot.pair;
        let room = slot.room;
        let teacher = slot.teacher;
        if (ov?.kind === "moved") {
          lessonDate = addDays(weekMonday, ov.to.day - 1);
          pair = ov.to.pair;
        } else if (ov?.kind === "replaced") {
          room = ov.room ?? room;
          teacher = ov.teacher ?? teacher;
        }
        lessons.push({
          id: lessonId,
          groupId: id.group(groupKey),
          subjectId: id.subject(slot.subject),
          teacherId: id.teacher(teacher),
          type: slot.type,
          date: lessonDate,
          start: PAIRS[pair].start,
          end: PAIRS[pair].end,
          room,
        });
        if (ov) {
          lessonChanges.push({
            lessonId,
            kind: ov.kind,
            note: ov.note(date),
            originalDate: ov.kind === "moved" ? date : null,
            originalStart: ov.kind === "moved" ? PAIRS[slot.pair].start : null,
          });
        }
      }
    }
  }

  const semester = currentSemester(today);
  const semesterId = semester.id as string;

  const studentRows: SeedData["students"] = students.map((s) => ({
    id: id.student(s.user),
    userId: id.user(s.user),
    groupId: id.group(s.group),
    lastName: s.lastName,
    firstName: s.firstName,
    middleName: s.middleName,
    recordBookNumber: s.recordBookNumber,
    email: s.email,
  }));

  const gradeRows: SeedData["grades"] = students.flatMap((s) =>
    grades[s.user].map((g) => ({
      id: seedId(`grade:${s.user}:${semesterId}:${g.subject}`),
      studentId: id.student(s.user),
      semesterId,
      subjectId: id.subject(g.subject),
      teacherId: id.teacher(g.teacher),
      controlForm: g.controlForm,
      credits: g.credits,
      semesterPoints: g.semesterPoints,
      examPoints: g.examPoints,
      result: g.result,
    })),
  );

  // Заявки: у каждой история статусов, время — «сколько часов назад» от now.
  type HistoryStep = {
    status: Insert<typeof schema.requests>["status"] & string;
    hoursAgo: number;
    comment?: string;
  };
  const requestDefs: {
    key: string;
    student: StudentDef["user"];
    type: Insert<typeof schema.requests>["type"];
    comment: string | null;
    history: HistoryStep[];
  }[] = [
    {
      key: "s1-enrollment",
      student: "student",
      type: "enrollment_certificate",
      comment: "Для предоставления по месту работы родителей",
      history: [
        { status: "submitted", hoursAgo: 170 },
        { status: "in_review", hoursAgo: 165 },
        { status: "ready", hoursAgo: 146, comment: "Можно забрать в деканате, каб. 112" },
      ],
    },
    {
      key: "s1-retake",
      student: "student",
      type: "retake_application",
      comment: "Пересдача: Теория вероятностей и статистика",
      history: [
        { status: "submitted", hoursAgo: 26 },
        { status: "in_review", hoursAgo: 12 },
      ],
    },
    {
      key: "s1-scholarship",
      student: "student",
      type: "scholarship_certificate",
      comment: null,
      history: [{ status: "submitted", hoursAgo: 2 }],
    },
    {
      key: "s2-military",
      student: "student2",
      type: "military_registration_certificate",
      comment: "Для военкомата",
      history: [
        { status: "submitted", hoursAgo: 240 },
        { status: "in_review", hoursAgo: 220 },
        { status: "ready", hoursAgo: 200, comment: "Готово, каб. 112, с 10:00 до 17:00" },
      ],
    },
    {
      key: "s2-transcript",
      student: "student2",
      type: "transcript",
      comment: "Для стажировки",
      history: [
        { status: "submitted", hoursAgo: 72 },
        { status: "in_review", hoursAgo: 70 },
        {
          status: "rejected",
          hoursAgo: 48,
          comment: "Выписка с оценками за семестр выдаётся после сессии. Подайте заявку в январе.",
        },
      ],
    },
  ];
  const requestRows: SeedData["requests"] = [];
  const requestHistory: SeedData["requestHistory"] = [];
  for (const r of requestDefs) {
    const first = r.history[0];
    const last = r.history.at(-1);
    if (!first || !last) continue;
    requestRows.push({
      id: id.request(r.key),
      studentId: id.student(r.student),
      type: r.type,
      status: last.status,
      comment: r.comment,
      createdAt: hoursBefore(now, first.hoursAgo),
      updatedAt: hoursBefore(now, last.hoursAgo),
    });
    r.history.forEach((h, i) => {
      requestHistory.push({
        id: seedId(`request-history:${r.key}:${i}`),
        requestId: id.request(r.key),
        status: h.status,
        comment: h.comment ?? null,
        at: hoursBefore(now, h.hoursAgo),
      });
    });
  }

  const scheduleLink = `/schedule?week=${monday}`;
  const notificationDefs: (Omit<
    Insert<typeof schema.notifications>,
    "id" | "userId" | "createdAt"
  > & {
    key: string;
    user: PersonDef["key"];
    hoursAgo: number;
  })[] = [
    {
      key: "s1-retake-review",
      user: "student",
      type: "request",
      title: "Заявление на пересдачу на рассмотрении",
      body: "Деканат начал рассматривать ваше заявление.",
      link: `/requests/${id.request("s1-retake")}`,
      read: false,
      hoursAgo: 12,
    },
    {
      key: "s1-nlp-moved",
      user: "student",
      type: "schedule_change",
      title: "Семинар по NLP перенесён",
      body: `Семинар ${ddmm(addDays(monday, 2))} в 09:00 перенесён на ${ddmm(addDays(monday, 1))} в 13:00, ауд. А-305.`,
      link: scheduleLink,
      read: false,
      hoursAgo: 60,
    },
    {
      key: "s1-coursework",
      user: "student",
      type: "deadline",
      title: `До ${ddmm(addDays(monday, 14))} сдать курсовую по машинному обучению`,
      body: "Загрузите отчёт и код в систему курсовых работ.",
      link: null,
      read: true,
      hoursAgo: 200,
    },
    {
      key: "s1-hackathon",
      user: "student",
      type: "news",
      title: "Внутренний хакатон AI High School",
      body: `Регистрация команд открыта до ${ddmm(addDays(monday, 9))}.`,
      link: null,
      read: true,
      hoursAgo: 230,
    },
    {
      key: "s2-transcript-rejected",
      user: "student2",
      type: "request",
      title: "Заявка на выписку оценок отклонена",
      body: "Деканат оставил комментарий в карточке заявки.",
      link: `/requests/${id.request("s2-transcript")}`,
      read: false,
      hoursAgo: 48,
    },
    {
      key: "s2-db-moved",
      user: "student2",
      type: "schedule_change",
      title: "Лабораторная по базам данных перенесена",
      body: `Пара ${ddmm(monday)} в 13:00 перенесена на субботу ${ddmm(addDays(monday, 5))} в 09:00.`,
      link: scheduleLink,
      read: false,
      hoursAgo: 80,
    },
    {
      key: "s2-library",
      user: "student2",
      type: "news",
      title: "Библиотека работает в субботу",
      body: "Читальный зал открыт по субботам с 10:00 до 16:00.",
      link: null,
      read: true,
      hoursAgo: 150,
    },
    {
      key: "staff-new-request",
      user: "staff",
      type: "request",
      title: "Новая заявка: справка для стипендии",
      body: "Мирослава Лебедянская, ПИИ-301.",
      link: "/staff",
      read: false,
      hoursAgo: 2,
    },
  ];
  const notifications: SeedData["notifications"] = notificationDefs.map(
    ({ key, user, hoursAgo, ...n }) => ({
      ...n,
      id: seedId(`notification:${key}`),
      userId: id.user(user),
      createdAt: hoursBefore(now, hoursAgo),
    }),
  );

  return {
    users,
    faculties: (Object.entries(faculties) as [keyof typeof faculties, string][]).map(
      ([k, name]) => ({
        id: id.faculty(k),
        name,
      }),
    ),
    groups: (Object.entries(groups) as [GroupKey, GroupDef][]).map(([k, g]) => ({
      id: id.group(k),
      name: g.name,
      facultyId: id.faculty(g.faculty),
      program: g.program,
      course: g.course,
    })),
    students: studentRows,
    teachers: (Object.entries(teachers) as [TeacherKey, string][]).map(([k, fullName]) => ({
      id: id.teacher(k),
      fullName,
    })),
    subjects: (Object.entries(subjects) as [SubjectKey, string][]).map(([k, name]) => ({
      id: id.subject(k),
      name,
    })),
    lessons,
    lessonChanges,
    semesters: [semester],
    grades: gradeRows,
    requests: requestRows,
    requestHistory,
    notifications,
  };
}
