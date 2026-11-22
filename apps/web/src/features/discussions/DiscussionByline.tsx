const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export function DiscussionByline({ author, createdAt }: { author: string; createdAt: string }) {
  return (
    <p className="wrap-anywhere text-sm text-muted-foreground">
      {author} · <time dateTime={createdAt}>{dateTime.format(new Date(createdAt))}</time>
    </p>
  );
}
