import type { DiscussionComment } from "@aihs/contract";
import type { ReactElement, ReactNode } from "react";
import { Card } from "../../ui";
import { DiscussionByline } from "./DiscussionByline";

export type DiscussionCommentCardProps = {
  comment: DiscussionComment;
  /** Действия для этого комментария передаёт экран темы. */
  actions?: ReactNode;
};

/** Карточка ответа с текстом, автором, датой и местом для действий. */
export function DiscussionCommentCard({
  comment,
  actions,
}: DiscussionCommentCardProps): ReactElement {
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <DiscussionByline author={comment.author.displayName} createdAt={comment.createdAt} />
        {actions}
      </div>
      <p className="wrap-anywhere whitespace-pre-wrap">{comment.body}</p>
    </Card>
  );
}
