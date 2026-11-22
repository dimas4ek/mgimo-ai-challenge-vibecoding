import { CreateDiscussionCommentInputSchema } from "@aihs/contract";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";
import { isApiError, retryHint } from "../../api/client";
import { paths } from "../../app/paths";
import {
  Button,
  buttonVariants,
  Card,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  PageHeader,
  Textarea,
} from "../../ui";
import { CommentReportAction } from "./CommentReportAction";
import { DiscussionByline } from "./DiscussionByline";
import { DiscussionCommentCard } from "./DiscussionCommentCard";
import { useAddDiscussionComment, useDiscussion } from "./queries";

function ReplyForm({ id }: { id: string }) {
  const send = useAddDiscussionComment(id);
  const [error, setError] = useState<string>();
  const [body, setBody] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = CreateDiscussionCommentInputSchema.safeParse({ body });
    if (!result.success) {
      setError("Введите ответ до 4000 символов.");
      return;
    }
    setError(undefined);
    send.mutate(result.data, { onSuccess: () => setBody("") });
  }

  return (
    <Card>
      <form className="flex flex-col items-start gap-3" onSubmit={submit}>
        <Field label="Ответ" error={error} className="w-full">
          {(field) => (
            <Textarea
              {...field}
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              disabled={send.isPending}
            />
          )}
        </Field>
        {send.isError && (
          <p className="text-sm text-danger" role="alert">
            {retryHint(send.error)}
          </p>
        )}
        <Button type="submit" disabled={send.isPending}>
          {send.isPending ? "Отправляем…" : "Отправить ответ"}
        </Button>
      </form>
    </Card>
  );
}

export function DiscussionPage() {
  const { id = "" } = useParams();
  const query = useDiscussion(id);
  const back = (
    <Link
      to={query.data ? `${paths.discussions}?scope=${query.data.scope}` : paths.discussions}
      className={buttonVariants({ variant: "ghost" })}
    >
      <ArrowLeft aria-hidden /> К обсуждениям
    </Link>
  );

  if (query.isPending) return <ListSkeleton label="Загружаем тему…" />;
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error, 404) ? (
          <EmptyState title="Тема недоступна" description="Вернитесь к списку обсуждений." />
        ) : (
          <ErrorState
            title="Не удалось загрузить тему"
            description={retryHint(query.error)}
            onRetry={() => void query.refetch()}
          />
        )}
      </>
    );
  }

  const topic = query.data;
  return (
    <div className="wrap-anywhere">
      <div className="mb-3">{back}</div>
      <PageHeader title={topic.title} />
      <Card>
        <DiscussionByline author={topic.author.displayName} createdAt={topic.createdAt} />
        <p className="mt-3 whitespace-pre-wrap">{topic.body}</p>
      </Card>
      <section className="mt-5 flex flex-col gap-3" aria-labelledby="discussion-replies">
        <h2 id="discussion-replies" className="text-lg font-semibold">
          Ответы
        </h2>
        {topic.comments.length ? (
          <ul className="flex flex-col gap-3">
            {topic.comments.map((comment) => (
              <li key={comment.id}>
                <DiscussionCommentCard
                  comment={comment}
                  actions={
                    comment.visibility !== "hidden" && (
                      <CommentReportAction commentId={comment.id} />
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ответов пока нет.</p>
        )}
        <ReplyForm key={id} id={id} />
      </section>
    </div>
  );
}
