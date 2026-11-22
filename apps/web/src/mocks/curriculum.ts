import { CurriculumSchema, type DisciplineGrade, fixtures } from "@aihs/contract";

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
