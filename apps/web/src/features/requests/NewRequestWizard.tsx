import { REQUEST_CATEGORY, type RequestType } from "@aihs/contract";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useCreateRequest } from "../../api";
import { paths } from "../../app/paths";
import { cn } from "../../lib/cn";
import { Button, Card, Field, Textarea } from "../../ui";
import {
  commentField,
  requestCategoryLabel,
  requestTypeHint,
  requestTypeLabel,
  requestTypesByCategory,
  validateComment,
  type WizardStep,
} from "./model";

const steps: { key: WizardStep; title: string }[] = [
  { key: "type", title: "Что нужно" },
  { key: "details", title: "Детали" },
  { key: "confirm", title: "Проверка" },
];

/** Состояние, с которым мастер открывает созданную заявку: там видно «Заявка отправлена». */
export type CreatedState = { created: true };

/**
 * Мастер подачи: тип → детали → подтверждение. Ошибки показываются на месте, кнопка
 * «Отправить» заблокирована во время отправки; после успеха открывается карточка новой заявки.
 */
export function NewRequestWizard({
  initialType,
  onCancel,
}: {
  /** Тип, выбранный заранее (ссылка `?new=1&type=…` с главной). */
  initialType?: RequestType;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const create = useCreateRequest();
  const [step, setStep] = useState<WizardStep>("type");
  const [type, setType] = useState<RequestType | null>(initialType ?? null);
  const [comment, setComment] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // `create.isPending` обновится только после перерисовки, а второй клик двойного клика
  // приходит раньше. Флаг в ref ставится синхронно и не даёт отправить заявку дважды.
  const sending = useRef(false);

  // При смене шага переводим фокус на его заголовок: скринридер и клавиатура не теряются.
  // biome-ignore lint/correctness/useExhaustiveDependencies: срабатывает именно на смену шага
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const index = steps.findIndex((s) => s.key === step);
  const current = steps[index] ?? steps[0];

  const nextFromType = () => {
    if (!type) {
      setTypeError("Выберите, что нужно оформить");
      return;
    }
    setStep("details");
  };

  const nextFromDetails = () => {
    if (!type) return;
    const error = validateComment(type, comment);
    setCommentError(error);
    if (!error) setStep("confirm");
  };

  const submit = () => {
    if (!type || sending.current) return;
    sending.current = true;
    const text = comment.trim();
    create.mutate(
      { type, comment: text === "" ? undefined : text },
      {
        onSuccess: (created) =>
          navigate(paths.request(created.id), { state: { created: true } satisfies CreatedState }),
        onError: () => {
          sending.current = false;
        },
      },
    );
  };

  return (
    <Card aria-labelledby="wizard-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <ol aria-label="Шаги" className="grid grid-cols-3 gap-2">
          {steps.map((s, i) => (
            <li
              key={s.key}
              aria-current={i === index ? "step" : undefined}
              className="flex flex-col gap-1.5 text-xs"
            >
              <span
                aria-hidden
                className={cn("h-1 rounded-full", i <= index ? "bg-primary" : "bg-muted")}
              />
              <span
                className={cn(
                  i === index ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s.title}
              </span>
            </li>
          ))}
        </ol>
        <h2
          id="wizard-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Шаг {index + 1} из {steps.length}: {current?.title}
        </h2>
      </div>

      {step === "type" && (
        <TypeStep
          value={type}
          error={typeError}
          onChange={(t) => {
            setType(t);
            setTypeError(null);
            setCommentError(null);
          }}
        />
      )}

      {step === "details" && type && (
        <DetailsStep
          type={type}
          comment={comment}
          error={commentError}
          onChange={(text) => {
            setComment(text);
            if (commentError) setCommentError(validateComment(type, text));
          }}
        />
      )}

      {step === "confirm" && type && (
        <dl className="flex flex-col gap-3 rounded-md bg-muted p-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Что оформить</dt>
            <dd className="font-semibold">{requestTypeLabel(type)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{commentField(type).label}</dt>
            <dd className="break-words whitespace-pre-line">{comment.trim() || "Не указано"}</dd>
          </div>
        </dl>
      )}

      {create.isError && (
        <p role="alert" className="text-sm text-danger">
          Не получилось отправить заявку. Проверьте интернет и попробуйте ещё раз.
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        {step === "type" ? (
          <Button variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={create.isPending}
            onClick={() => setStep(step === "confirm" ? "details" : "type")}
          >
            Назад
          </Button>
        )}
        {step === "type" && <Button onClick={nextFromType}>Далее</Button>}
        {step === "details" && <Button onClick={nextFromDetails}>Далее</Button>}
        {step === "confirm" && (
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Отправляем…" : "Отправить"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function TypeStep({
  value,
  error,
  onChange,
}: {
  value: RequestType | null;
  error: string | null;
  onChange: (type: RequestType) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {requestTypesByCategory().map(({ category, types }) => (
        <fieldset
          key={category}
          className="flex flex-col gap-2"
          aria-describedby={error ? "type-error" : undefined}
        >
          <legend className="mb-2 text-sm font-semibold text-muted-foreground">
            {requestCategoryLabel(category)}
          </legend>
          {types.map((type) => (
            <label
              key={type}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                value === type ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="request-type"
                value={type}
                checked={value === type}
                onChange={() => onChange(type)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{requestTypeLabel(type)}</span>
                <span className="text-sm text-muted-foreground">{requestTypeHint(type)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      {error && (
        <p id="type-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function DetailsStep({
  type,
  comment,
  error,
  onChange,
}: {
  type: RequestType;
  comment: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  const field = commentField(type);
  const isCertificate = REQUEST_CATEGORY[type] === "certificate";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="font-semibold">{requestTypeLabel(type)}.</span>{" "}
        <span className="text-muted-foreground">{requestTypeHint(type)}</span>
      </p>
      <Field
        label={field.required ? field.label : `${field.label} (необязательно)`}
        hint={
          isCertificate
            ? "Если справка нужна в конкретное место, напишите куда — деканат укажет это в ней."
            : "Чем подробнее, тем быстрее решение."
        }
        error={error ?? undefined}
      >
        {(props) => (
          <Textarea
            {...props}
            value={comment}
            placeholder={field.placeholder}
            required={field.required}
            maxLength={1100}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>
      <p className="text-right text-xs text-muted-foreground tabular-nums">
        {comment.trim().length} / 1000
      </p>
    </div>
  );
}
