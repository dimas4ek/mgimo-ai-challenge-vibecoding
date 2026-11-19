import { cn } from "../lib/cn";

/**
 * Собственный логотип AI High School: щит-«книга» с узлами нейросети.
 * Рисуется цветами токенов, поэтому работает в обеих темах.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden
      className={cn("size-8 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8 10.5c2.6-1.2 5.3-1.2 8 0 2.7-1.2 5.4-1.2 8 0V22c-2.6-1.2-5.3-1.2-8 0-2.7-1.2-5.4-1.2-8 0z"
        className="fill-none stroke-primary-foreground"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 10.5V22" className="stroke-primary-foreground" strokeWidth="1.6" />
      <g className="fill-primary-foreground">
        <circle cx="11.5" cy="14" r="1.4" />
        <circle cx="20.5" cy="14" r="1.4" />
        <circle cx="11.5" cy="18.5" r="1.4" />
        <circle cx="20.5" cy="18.5" r="1.4" />
      </g>
      <path
        d="M11.5 14l4.5 2.2 4.5-2.2M11.5 18.5l4.5-2.3 4.5 2.3"
        className="fill-none stroke-primary-foreground"
        strokeWidth="1"
        opacity="0.8"
      />
    </svg>
  );
}

/** Логотип с названием: «AI High School / Цифровой деканат». */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold">AI High School</span>
        <span className="text-xs text-muted-foreground">Цифровой деканат</span>
      </span>
    </span>
  );
}

/** Обязательный дисклеймер (`.claude/rules/fictional-data.md`): на входе, в подвале и в профиле. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Концепт для конкурса, не официальный сервис. Вуз и все данные вымышлены.
    </p>
  );
}
