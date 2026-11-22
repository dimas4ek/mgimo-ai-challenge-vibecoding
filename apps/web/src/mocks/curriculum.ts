import {
  CurriculumSchema,
  type DisciplineGrade,
  fixtures,
  type WeekSchedule,
} from "@aihs/contract";

const currentId = "26000000-0000-4000-8000-000000000001";
const pastId = "26000000-0000-4000-8000-000000000002";

function asCurriculum({
  id: subjectId,
  subject,
  teacher,
  controlForm,
  credits,
  semesterPoints,
  examPoints,
  totalPoints,
  result,
  exam,
}: DisciplineGrade) {
  return {
    subjectId,
    subject,
    teacher,
    controlForm,
    credits,
    hours: { lectures: 18, practice: 18, independent: credits * 36 - 36 },
    grade: { semesterPoints, examPoints, totalPoints, result, exam },
  };
}

export const mockStudentCurriculum = CurriculumSchema.parse({
  currentSemesterId: currentId,
  semesters: [
    {
      id: currentId,
      name: fixtures.grades.semester,
      disciplines: fixtures.grades.disciplines.map(asCurriculum),
    },
    ...fixtures.grades.pastDebts.map((row) => ({
      id: pastId,
      name: row.semester,
      disciplines: [asCurriculum(row)],
    })),
  ],
});

export const mockStudent2Curriculum = CurriculumSchema.parse({
  currentSemesterId: currentId,
  semesters: [
    {
      id: currentId,
      name: fixtures.grades.semester,
      disciplines: [
        {
          subjectId: "26000000-0000-4000-8000-000000000003",
          subject: "Математический анализ",
          teacher: "Свиридова Алиса Романовна",
          controlForm: "exam",
          credits: 5,
          hours: { lectures: 36, practice: 54, independent: 90 },
          grade: {
            semesterPoints: 38,
            examPoints: null,
            totalPoints: 38,
            result: "pending",
            exam: null,
          },
        },
      ],
    },
  ],
});

export function mockCurriculumSchedule(isStudent2: boolean): WeekSchedule {
  const schedule = fixtures.weekSchedule;
  if (isStudent2) {
    const lesson = schedule.lessons[0];
    const entry = mockStudent2Curriculum.semesters[0]?.disciplines[0];
    return {
      ...schedule,
      lessons:
        lesson && entry
          ? [
              {
                ...lesson,
                subjectId: entry.subjectId,
                subject: entry.subject,
                teacher: entry.teacher,
                change: null,
              },
            ]
          : [],
    };
  }

  const current = mockStudentCurriculum.semesters[0]?.disciplines ?? [];
  return {
    ...schedule,
    lessons: schedule.lessons.map((lesson) => {
      const planName =
        lesson.subject === "Теория вероятностей и статистика"
          ? "Теория вероятностей и статистика, ч. 2"
          : lesson.subject;
      return {
        ...lesson,
        subjectId: current.find((entry) => entry.subject === planName)?.subjectId,
      };
    }),
  };
}
