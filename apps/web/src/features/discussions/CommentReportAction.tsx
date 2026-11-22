import type { ReactElement } from "react";

export type CommentReportActionProps = {
  /** Стабильный ID видимого комментария для `routes.me.discussions.report`. */
  commentId: string;
};

/** Действие в карточке комментария. Подтверждение показывается после ответа API. */
export function CommentReportAction(_props: CommentReportActionProps): ReactElement {
  throw new Error("not implemented");
}
