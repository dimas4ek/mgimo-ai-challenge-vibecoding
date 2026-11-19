/**
 * Счётчик неудачных входов в памяти процесса, скользящее окно. Для одной ВМ этого хватает.
 * Ключ — адрес клиента, а не логин: иначе один человек мог бы заблокировать общий демо-аккаунт.
 */
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string, now: Date): number[] {
    const since = now.getTime() - this.windowMs;
    const list = (this.failures.get(key) ?? []).filter((t) => t > since);
    if (list.length > 0) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** Лимит исчерпан: вход не проверяем, отвечаем 429. */
  isBlocked(key: string, now: Date): boolean {
    return this.recent(key, now).length >= this.max;
  }

  /** Запомнить неудачную попытку. */
  fail(key: string, now: Date): void {
    this.failures.set(key, [...this.recent(key, now), now.getTime()]);
  }
}
