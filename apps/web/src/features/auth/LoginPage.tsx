import { Disclaimer, Logo } from "../../app/brand";
import { Card, CardDescription, CardTitle } from "../../ui";

/** Экран входа. Заглушка каркаса; форму входа делает задача #13. */
export function LoginPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10"
    >
      <Logo className="self-center" />
      <Card>
        <h1 className="sr-only">Вход</h1>
        <CardTitle as="h2">Вход в кабинет</CardTitle>
        <CardDescription className="mt-1">Форма входа появится в задаче #13.</CardDescription>
      </Card>
      <Disclaimer className="text-center" />
    </main>
  );
}
