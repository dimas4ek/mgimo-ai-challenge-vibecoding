import { expect, it } from "vitest";
import { DiscussionCommentSchema } from "./discussions";

it("принимает старый ответ и запрещает текст у скрытого комментария", () => {
  const comment = {
    id: "5e785af4-e7a5-4e3a-aeb4-2539b9c07b01",
    author: { displayName: "Мирослава Лебедянская" },
    createdAt: "2026-11-22T12:00:00.000Z",
    body: "Комментарий",
  };
  expect(DiscussionCommentSchema.parse(comment)).toEqual(comment);
  expect(DiscussionCommentSchema.safeParse({ ...comment, visibility: "hidden" }).success).toBe(
    false,
  );
  expect(
    DiscussionCommentSchema.parse({ ...comment, visibility: "hidden", body: null }).body,
  ).toBeNull();
});
