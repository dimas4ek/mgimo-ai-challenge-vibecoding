import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { Button, buttonVariants, Card, CardTitle } from "../ui";
import { paths } from "./paths";
import type { StudentTip } from "./student-tip";

const tips: [StudentTip, ...StudentTip[]] = [
  {
    title: "Проверьте изменения в парах",
    text: "Переносы, замены и отмены отмечены в расписании.",
    action: { label: "Открыть расписание", to: paths.schedule },
  },
  {
    title: "Закажите справку онлайн",
    text: "Статус заявки и готовая справка появятся в кабинете.",
    action: { label: "Заказать справку", to: `${paths.requests}?new=1` },
  },
  {
    title: "Сохраните расписание в телефоне",
    text: "Откройте расписание на телефоне с интернетом, чтобы затем посмотреть загруженную неделю офлайн.",
  },
];

const ROTATE_MS = 8_000;

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  const matches = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, matches, () => false);
}

export function StudentTips() {
  const wide = useMediaQuery("(min-width: 90rem)");
  return wide ? <TipsCarousel /> : null;
}

function TipsCarousel() {
  const canRotate = useMediaQuery("(prefers-reduced-motion: no-preference)");
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const rotating = canRotate && !paused && !hovered && !focused;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setIndex((index + 1) % tips.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index]);

  const tip = tips[index] ?? tips[0];
  return (
    <aside
      aria-labelledby="student-tips-title"
      aria-roledescription="карусель"
      className="sticky top-8 mt-8 self-start"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <CardTitle id="student-tips-title">Подсказки</CardTitle>
          {canRotate && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={paused ? "Возобновить автолистание" : "Приостановить автолистание"}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            </Button>
          )}
        </div>

        <div aria-live={rotating ? "off" : "polite"} aria-atomic="true" className="min-h-36">
          <h3 className="text-sm font-semibold">{tip.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{tip.text}</p>
          {tip.action && (
            <Link
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}
              to={tip.action.to}
            >
              {tip.action.label}
            </Link>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Предыдущая подсказка"
            onClick={() => setIndex((current) => (current + tips.length - 1) % tips.length)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1} из {tips.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Следующая подсказка"
            onClick={() => setIndex((current) => (current + 1) % tips.length)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </Card>
    </aside>
  );
}
