import { type KeyboardEvent, type ReactNode, useState } from "react";
import { cn } from "../lib/cn";

export interface TabsProps<T extends string> {
  /** Основа уникальных идентификаторов вкладок и панелей. */
  id: string;
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Содержимое выбранной панели. */
  children: ReactNode;
}

/** Горизонтальные вкладки: стрелки перемещают фокус, Enter и пробел выбирают вкладку. */
export function Tabs<T extends string>({
  id,
  label,
  tabs,
  value,
  onChange,
  children,
}: TabsProps<T>): ReactNode {
  const [focused, setFocused] = useState<T | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft":
        nextIndex = (index + tabs.length - 1) % tabs.length;
        break;
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="mb-4 inline-grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.value}`}
            aria-selected={tab.value === value}
            aria-controls={`${id}-panel-${tab.value}`}
            tabIndex={(focused ?? value) === tab.value ? 0 : -1}
            onFocus={() => setFocused(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(tab.value)}
            className={cn(
              "min-h-11 cursor-pointer rounded-md px-5 text-sm font-semibold transition-colors",
              tab.value === value
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          id={`${id}-panel-${tab.value}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.value}`}
          hidden={tab.value !== value}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA APG включает панель без фокусируемого содержимого в порядок Tab.
          tabIndex={0}
        >
          {tab.value === value ? children : null}
        </div>
      ))}
    </>
  );
}
