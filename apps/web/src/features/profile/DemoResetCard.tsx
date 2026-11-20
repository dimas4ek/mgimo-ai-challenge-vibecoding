import { CircleCheck, RotateCcw } from "lucide-react";
import { useState } from "react";
import { retryHint, useDemoReset } from "../../api";
import { Button, Card, CardDescription, CardTitle } from "../../ui";

/**
 * Сброс демо-данных (#23): аккаунты общие для жюри, поэтому свои заявки и уведомления можно
 * вернуть к исходным. Подтверждение в два шага, кнопка блокируется на время запроса, итог — текстом.
 */
export function DemoResetCard() {
  const reset = useDemoReset();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card>
      <CardTitle as="h2">Демо-данные</CardTitle>
      <CardDescription className="mt-1">
        Аккаунт общий для демонстрации. Сброс вернёт ваши заявки и уведомления к исходным —
        расписание, оценки и данные других студентов не изменятся.
      </CardDescription>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button
              variant="danger"
              disabled={reset.isPending}
              onClick={() => reset.mutate(undefined, { onSettled: () => setConfirming(false) })}
            >
              <RotateCcw aria-hidden />
              {reset.isPending ? "Сбрасываем…" : "Да, сбросить"}
            </Button>
            <Button variant="ghost" disabled={reset.isPending} onClick={() => setConfirming(false)}>
              Отмена
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              reset.reset();
              setConfirming(true);
            }}
          >
            <RotateCcw aria-hidden />
            Сбросить демо-данные
          </Button>
        )}
      </div>
      <div aria-live="polite">
        {reset.isSuccess && (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success">
            <CircleCheck aria-hidden className="size-4" />
            Готово: заявки и уведомления вернулись к исходным.
          </p>
        )}
        {reset.isError && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            Не получилось сбросить. {retryHint(reset.error)}
          </p>
        )}
      </div>
    </Card>
  );
}
