import type { DiscussionComment } from "@aihs/contract";
import type { ReactElement, ReactNode } from "react";

export type DiscussionCommentCardProps = {
  comment: DiscussionComment;
  /** Действия для этого комментария передаёт экран темы. */
  actions?: ReactNode;
};

/** Карточка ответа с текстом, автором, датой и местом для действий. */
export function DiscussionCommentCard(_props: DiscussionCommentCardProps): ReactElement {
  throw new Error("not implemented");
}
