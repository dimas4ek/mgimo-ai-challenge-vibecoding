import {
  ControlFormSchema,
  GradeResultSchema,
  LessonChangeKindSchema,
  LessonTypeSchema,
  NotificationTypeSchema,
  RequestStatusSchema,
  RequestTypeSchema,
  RoleSchema,
} from "@aihs/contract";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

// Строки enum уходят из БД в DTO как есть, поэтому значения обязаны совпадать с контрактом.
describe("enum в БД совпадают с контрактом", () => {
  it.each([
    ["role", schema.roleEnum, RoleSchema],
    ["lesson_type", schema.lessonTypeEnum, LessonTypeSchema],
    ["lesson_change_kind", schema.lessonChangeKindEnum, LessonChangeKindSchema],
    ["control_form", schema.controlFormEnum, ControlFormSchema],
    ["grade_result", schema.gradeResultEnum, GradeResultSchema],
    ["request_type", schema.requestTypeEnum, RequestTypeSchema],
    ["request_status", schema.requestStatusEnum, RequestStatusSchema],
    ["notification_type", schema.notificationTypeEnum, NotificationTypeSchema],
  ])("%s", (_name, dbEnum, contractEnum) => {
    expect([...dbEnum.enumValues].sort()).toEqual([...contractEnum.options].sort());
  });
});
