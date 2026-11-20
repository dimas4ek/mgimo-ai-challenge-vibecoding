// Вымышленные данные AI High School для заглушек API, MSW и тестов (`.claude/rules/fictional-data.md`).
// Совпадения ФИО с реальными людьми случайны. Даты — неделя 16–22.11.2026; живой сид строит их от текущей даты.
import type { Me } from "../auth";
import type { Certificate, CertificateVerification } from "../certificates";
import type { Grades } from "../grades";
import type { NotificationList } from "../notifications";
import type { Profile } from "../profile";
import type { Request, RequestListItem } from "../requests";
import type { WeekSchedule } from "../schedule";
import type { StaffRequestItem } from "../staff";

const ids = {
  student: "6f1d2c3a-4b5e-4f60-8a71-0b2c3d4e5f01",
  student2: "6f1d2c3a-4b5e-4f60-8a71-0b2c3d4e5f02",
  staff: "6f1d2c3a-4b5e-4f60-8a71-0b2c3d4e5f03",
  request1: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c01",
  request2: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c02",
  request3: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c03",
} as const;

const meStudent: Me = { id: ids.student, role: "student", displayName: "Мирослава Лебедянская" };
const meStudent2: Me = { id: ids.student2, role: "student", displayName: "Тихон Колосовский" };
const meStaff: Me = { id: ids.staff, role: "staff", displayName: "Вероника Сташевская" };

const profile: Profile = {
  lastName: "Лебедянская",
  firstName: "Мирослава",
  middleName: "Игоревна",
  recordBookNumber: "AI-2024-0142",
  faculty: "Факультет прикладного искусственного интеллекта",
  program: "09.03.01 Прикладной искусственный интеллект",
  course: 3,
  group: "ПИИ-301",
  email: "m.lebedyanskaya@student.aihs.example",
};

const weekSchedule: WeekSchedule = {
  weekStart: "2026-11-16",
  weekEnd: "2026-11-22",
  lessons: [
    {
      id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01",
      date: "2026-11-16",
      start: "09:00",
      end: "10:30",
      subject: "Машинное обучение",
      type: "lecture",
      room: "А-214",
      teacher: "Зарецкий Глеб Аркадьевич",
      change: null,
    },
    {
      id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e02",
      date: "2026-11-16",
      start: "10:45",
      end: "12:15",
      subject: "Машинное обучение",
      type: "lab",
      room: "Б-108 (компьютерный класс)",
      teacher: "Ольховская Нина Викторовна",
      change: null,
    },
    {
      id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e03",
      date: "2026-11-17",
      start: "13:00",
      end: "14:30",
      subject: "Обработка естественного языка",
      type: "seminar",
      room: "А-305",
      teacher: "Беломестнов Ростислав Ильич",
      change: {
        kind: "moved",
        note: "Перенесено с 18.11: преподаватель на конференции",
        originalDate: "2026-11-18",
        originalStart: "09:00",
      },
    },
    {
      id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e04",
      date: "2026-11-19",
      start: "09:00",
      end: "10:30",
      subject: "Этика искусственного интеллекта",
      type: "lecture",
      room: "Актовый зал",
      teacher: "Каримова Ольга Тимуровна",
      change: {
        kind: "replaced",
        note: "Замена аудитории: вместо А-101",
        originalDate: null,
        originalStart: null,
      },
    },
    {
      id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e05",
      date: "2026-11-20",
      start: "10:45",
      end: "12:15",
      subject: "Теория вероятностей и статистика",
      type: "seminar",
      room: "А-210",
      teacher: "Зарецкий Глеб Аркадьевич",
      change: {
        kind: "cancelled",
        note: "Отменено, материал на самостоятельное изучение",
        originalDate: null,
        originalStart: null,
      },
    },
  ],
};

const grades: Grades = {
  semester: "Осенний семестр 2026/27",
  session: { startDate: "2026-12-28", endDate: "2027-01-24" },
  disciplines: [
    {
      id: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f01",
      subject: "Машинное обучение",
      teacher: "Зарецкий Глеб Аркадьевич",
      controlForm: "exam",
      credits: 5,
      semesterPoints: 52,
      examPoints: null,
      totalPoints: 52,
      result: "pending",
      exam: { date: "2027-01-12", start: "10:00", room: "А-214" },
    },
    {
      id: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f02",
      subject: "Обработка естественного языка",
      teacher: "Беломестнов Ростислав Ильич",
      controlForm: "graded_credit",
      credits: 4,
      semesterPoints: 41,
      examPoints: 30,
      totalPoints: 71,
      result: "good",
      exam: { date: "2026-12-24", start: "12:00", room: "Б-108" },
    },
    {
      id: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f03",
      subject: "Этика искусственного интеллекта",
      teacher: "Каримова Ольга Тимуровна",
      controlForm: "credit",
      credits: 2,
      semesterPoints: 58,
      examPoints: 35,
      totalPoints: 93,
      result: "passed",
      exam: { date: "2026-12-22", start: "14:00", room: "Б-305" },
    },
    {
      id: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f04",
      subject: "Теория вероятностей и статистика",
      teacher: "Зарецкий Глеб Аркадьевич",
      controlForm: "exam",
      credits: 4,
      semesterPoints: 22,
      examPoints: 15,
      totalPoints: 37,
      result: "unsatisfactory",
      exam: { date: "2027-01-19", start: "09:00", room: "А-301" },
    },
  ],
  summary: { averagePoints: 63.25, disciplinesTotal: 4, disciplinesPassed: 2, debts: 1 },
};

const request1: Request = {
  id: ids.request1,
  type: "enrollment_certificate",
  status: "ready",
  comment: "Для предоставления по месту работы родителей",
  createdAt: "2026-11-12T08:15:00.000Z",
  updatedAt: "2026-11-13T11:40:00.000Z",
  history: [
    { status: "submitted", at: "2026-11-12T08:15:00.000Z", comment: null },
    { status: "in_review", at: "2026-11-12T13:02:00.000Z", comment: null },
    {
      status: "ready",
      at: "2026-11-13T11:40:00.000Z",
      comment: "Можно забрать в деканате, каб. 112",
    },
  ],
};

const request2: Request = {
  id: ids.request2,
  type: "retake_application",
  status: "in_review",
  comment: "Пересдача: Теория вероятностей и статистика",
  createdAt: "2026-11-18T16:20:00.000Z",
  updatedAt: "2026-11-19T07:05:00.000Z",
  history: [
    { status: "submitted", at: "2026-11-18T16:20:00.000Z", comment: null },
    { status: "in_review", at: "2026-11-19T07:05:00.000Z", comment: null },
  ],
};

const request3: Request = {
  id: ids.request3,
  type: "scholarship_certificate",
  status: "submitted",
  comment: null,
  createdAt: "2026-11-19T09:30:00.000Z",
  updatedAt: "2026-11-19T09:30:00.000Z",
  history: [{ status: "submitted", at: "2026-11-19T09:30:00.000Z", comment: null }],
};

const certificateToken = "Q9tVb2kXo7TfL3mNcR8sWy1Hd4GpJ6ZaE0uKiYxBvQw";

/** Справка по готовой заявке request1 (справка об обучении). */
const certificate: Certificate = {
  requestId: ids.request1,
  type: "enrollment_certificate",
  number: "AIHS-2026-4F7A1C",
  issuedAt: "2026-11-13T11:40:00.000Z",
  token: certificateToken,
  verifyPath: `/verify/${certificateToken}`,
  student: {
    fullName: "Лебедянская Мирослава Игоревна",
    recordBookNumber: profile.recordBookNumber,
    faculty: profile.faculty,
    program: profile.program,
    course: profile.course,
    group: profile.group,
  },
  purpose: "Для предоставления по месту работы родителей",
};

/** Что видит любой, кто отсканировал QR этой справки. */
const certificateVerification: CertificateVerification = {
  type: certificate.type,
  number: certificate.number,
  issuedOn: "2026-11-13",
  valid: true,
  holderInitials: "Л. М. И.",
};

const toListItem = ({ history: _history, ...item }: Request): RequestListItem => item;

const notifications: NotificationList = {
  unreadCount: 2,
  items: [
    {
      id: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a01",
      type: "request",
      title: "Заявка на пересдачу на рассмотрении",
      body: "Деканат начал рассматривать ваше заявление.",
      createdAt: "2026-11-19T07:05:00.000Z",
      read: false,
      link: `/requests/${ids.request2}`,
    },
    {
      id: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a02",
      type: "schedule_change",
      title: "Семинар по NLP перенесён",
      body: "Семинар 18.11 в 09:00 перенесён на 17.11 в 13:00, ауд. А-305.",
      createdAt: "2026-11-15T10:00:00.000Z",
      read: false,
      link: "/schedule?week=2026-11-16",
    },
    {
      id: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a03",
      type: "deadline",
      title: "До 1 декабря сдать курсовую по ML",
      body: "Загрузите отчёт и код в систему курсовых работ.",
      createdAt: "2026-11-10T09:00:00.000Z",
      read: true,
      link: null,
    },
    {
      id: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a04",
      type: "news",
      title: "Хакатон AI High School",
      body: "Регистрация команд открыта до 25 ноября.",
      createdAt: "2026-11-09T12:00:00.000Z",
      read: true,
      link: null,
    },
  ],
};

const staffRequests: StaffRequestItem[] = [
  { ...request3, student: { fullName: "Лебедянская Мирослава Игоревна", group: "ПИИ-301" } },
  { ...request2, student: { fullName: "Лебедянская Мирослава Игоревна", group: "ПИИ-301" } },
  { ...request1, student: { fullName: "Лебедянская Мирослава Игоревна", group: "ПИИ-301" } },
];

/** Набор фикстур. Каждая проходит свою схему (тест в `fixtures.test.ts`). */
export const fixtures = {
  ids,
  me: { student: meStudent, student2: meStudent2, staff: meStaff },
  profile,
  weekSchedule,
  grades,
  requests: [request3, request2, request1].map(toListItem),
  /** Поиск карточки по id из URL; неизвестный id → `undefined` (API отвечает 404). */
  requestById: {
    [ids.request1]: request1,
    [ids.request2]: request2,
    [ids.request3]: request3,
  } as Record<string, Request | undefined>,
  notifications,
  staffRequests,
  /** Справки по id заявки; заявка не справка или не готова → `undefined` (API отвечает 404). */
  certificateByRequestId: { [ids.request1]: certificate } as Record<
    string,
    Certificate | undefined
  >,
  /** Проверка по токену; неизвестный токен → `undefined` (API отвечает 404). */
  verificationByToken: { [certificateToken]: certificateVerification } as Record<
    string,
    CertificateVerification | undefined
  >,
} as const;
