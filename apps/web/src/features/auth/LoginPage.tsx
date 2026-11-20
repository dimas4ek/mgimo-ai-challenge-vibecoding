import { LoginInputSchema } from "@aihs/contract";
import { type FormEvent, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { isApiError, retryHint } from "../../api/client";
import { useLogin, useMe } from "../../api/hooks";
import { Disclaimer, Logo } from "../../app/brand";
import { homeOf, safeNext } from "../../app/guards";
import { Button, Card, CardDescription, CardTitle, Field, Input } from "../../ui";

type FieldErrors = { login?: string; password?: string };

/** Текст ошибки входа. Неверный логин и неверный пароль сервер не различает — и мы тоже. */
export function loginErrorText(error: unknown): string {
  if (isApiError(error, 401)) return "Неверный логин или пароль.";
  if (isApiError(error, 429)) return "Слишком много попыток. Подождите минуту и попробуйте снова.";
  return `Не удалось войти. ${retryHint(error)}`;
}

/** Экран входа: логин и пароль, ошибки на месте, кнопка блокируется на время запроса. */
export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [errors, setErrors] = useState<FieldErrors>({});

  if (me.data) return <Navigate to={next ?? homeOf(me.data.role)} replace />;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = {
      login: String(form.get("login") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const fieldErrors: FieldErrors = {
      login: raw.login.trim() ? undefined : "Введите логин.",
      password: raw.password ? undefined : "Введите пароль.",
    };
    setErrors(fieldErrors);
    const input = LoginInputSchema.safeParse(raw);
    if (fieldErrors.login || fieldErrors.password || !input.success) return;
    login.mutate(input.data, {
      onSuccess: (user) => navigate(next ?? homeOf(user.role), { replace: true }),
    });
  }

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10"
    >
      <Logo className="self-center" />
      <Card>
        <h1 className="sr-only">Вход</h1>
        <CardTitle as="h2">Вход в кабинет</CardTitle>
        <CardDescription className="mt-1">
          Студенты и сотрудники деканата входят по своему логину.
        </CardDescription>
        <form noValidate onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          <Field label="Логин" error={errors.login}>
            {(field) => (
              <Input
                {...field}
                name="login"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
                disabled={login.isPending}
              />
            )}
          </Field>
          <Field label="Пароль" error={errors.password}>
            {(field) => (
              <Input
                {...field}
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                disabled={login.isPending}
              />
            )}
          </Field>
          {login.isError && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {loginErrorText(login.error)}
            </p>
          )}
          <Button type="submit" block disabled={login.isPending}>
            {login.isPending ? "Входим…" : "Войти"}
          </Button>
        </form>
      </Card>
      <Disclaimer className="text-center" />
    </main>
  );
}
