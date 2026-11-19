import { type ComponentProps, useId } from "react";
import { cn } from "../lib/cn";

const fieldClass =
  "w-full min-h-11 rounded-md border border-input bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground aria-invalid:border-danger disabled:opacity-55";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "pr-8", className)} {...props} />;
}

type FieldProps = {
  label: string;
  /** Подсказка под полем. */
  hint?: string;
  /** Ошибка валидации: показывается вместо подсказки, поле получает `aria-invalid`. */
  error?: string;
  className?: string;
  /** Поле получает `id`, `aria-describedby`, `aria-invalid` — передай их в `Input`/`Select`/`Textarea`. */
  children: (field: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => React.ReactNode;
};

/** Поле формы с подписью, подсказкой и ошибкой на месте. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": note ? noteId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {note && (
        <p
          id={noteId}
          className={cn("text-sm", error ? "text-danger" : "text-muted-foreground")}
          role={error ? "alert" : undefined}
        >
          {note}
        </p>
      )}
    </div>
  );
}
