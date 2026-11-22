import {
  CreateDiscussionInputSchema,
  type DiscussionScope,
  DiscussionScopeSchema,
} from "@aihs/contract";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { retryHint } from "../../api/client";
import { paths } from "../../app/paths";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  Tabs,
  Textarea,
} from "../../ui";
import { DiscussionByline } from "./DiscussionByline";
import { useCreateDiscussion, useDiscussions } from "./queries";

const discussionScopes = [
  { value: "university", label: "Весь вуз" },
  { value: "department", label: "Моя кафедра" },
] as const;

function TopicForm({ scope, onClose }: { scope: DiscussionScope; onClose: () => void }) {
  const create = useCreateDiscussion();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = CreateDiscussionInputSchema.safeParse({
      scope,
      title: form.get("title"),
      body: form.get("body"),
    });
    if (!result.success) {
      setErrors({
        title: result.error.issues.some((issue) => issue.path[0] === "title")
          ? "Введите заголовок до 150 символов."
          : undefined,
        body: result.error.issues.some((issue) => issue.path[0] === "body")
          ? "Введите текст до 4000 символов."
          : undefined,
      });
      return;
    }
    setErrors({});
    create.mutate(result.data, { onSuccess: (topic) => navigate(paths.discussion(topic.id)) });
  }

  return (
    <Card className="mb-4">
      <h2 className="mb-3 font-semibold">Новая тема</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Заголовок" error={errors.title}>
          {(field) => <Input {...field} name="title" maxLength={150} disabled={create.isPending} />}
        </Field>
        <Field label="Текст темы" error={errors.body}>
          {(field) => (
            <Textarea {...field} name="body" maxLength={4000} disabled={create.isPending} />
          )}
        </Field>
        {create.isError && (
          <p className="text-sm text-danger" role="alert">
            {retryHint(create.error)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Публикуем…" : "Опубликовать"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TopicList({ scope }: { scope: DiscussionScope }) {
  const list = useDiscussions(scope);
  if (list.isPending) return <ListSkeleton label="Загружаем обсуждения…" />;
  if (list.isError)
    return (
      <ErrorState
        title="Не удалось загрузить обсуждения"
        description={retryHint(list.error)}
        onRetry={() => void list.refetch()}
      />
    );
  if (!list.data.length)
    return <EmptyState title="Тем пока нет" description="Создайте первую тему." />;

  return (
    <ul className="flex flex-col gap-3">
      {list.data.map((topic) => (
        <li key={topic.id}>
          <Card className="p-0 sm:p-0">
            <Link
              to={paths.discussion(topic.id)}
              className="block min-h-11 rounded-lg p-4 hover:bg-muted sm:p-5"
            >
              <h2 className="wrap-anywhere font-semibold">{topic.title}</h2>
              <DiscussionByline author={topic.author.displayName} createdAt={topic.createdAt} />
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function DiscussionsPage() {
  const [params, setParams] = useSearchParams();
  const scope = DiscussionScopeSchema.safeParse(params.get("scope")).data ?? "university";
  const [formScope, setFormScope] = useState<DiscussionScope | null>(null);
  const showForm = formScope === scope;

  return (
    <>
      <PageHeader
        title="Обсуждения"
        actions={!showForm && <Button onClick={() => setFormScope(scope)}>Новая тема</Button>}
      />
      <Tabs
        id="discussion-scope"
        label="Область обсуждений"
        tabs={discussionScopes}
        value={scope}
        onChange={(next) => {
          setFormScope(null);
          setParams({ scope: next }, { replace: true });
        }}
      >
        {showForm && <TopicForm scope={scope} onClose={() => setFormScope(null)} />}
        <TopicList scope={scope} />
      </Tabs>
    </>
  );
}
