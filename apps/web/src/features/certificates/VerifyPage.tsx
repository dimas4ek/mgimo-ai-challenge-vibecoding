import { Disclaimer, Logo } from "../../app/brand";
import { Card, CardDescription } from "../../ui";

/**
 * Публичная проверка справки по QR, `/verify/:token`. Без входа и без AppShell.
 * Показывает минимум (`.claude/rules/security.md`): тип, дата, «действительна», инициалы. Наполняет #26.
 */
export function VerifyPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10"
    >
      <Logo className="self-center" />
      <Card>
        <h1 className="text-base font-semibold">Проверка справки</h1>
        <CardDescription className="mt-1">Страница появится в задаче #26.</CardDescription>
      </Card>
      <Disclaimer className="text-center" />
    </main>
  );
}
