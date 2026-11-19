# Цифровой деканат AI High School

Прототип личного кабинета студента для хакатона MGIMO AI Challenge (номинация «Вайб-кодинг»). Вуз **вымышленный**: AI High School (Высшая Школа ИИ). Сдача 22.11.2026, прототип должен работать до 28.11.

- Этапы и их состав: [ROADMAP.md](ROADMAP.md) (статус задач ведётся на доске, а не в репозитории)
- Почему так решили: [docs/process/00-analysis.md](docs/process/00-analysis.md)
- Исходное ТЗ: `TZ.pdf`

## Стек
TypeScript-монорепо (pnpm workspaces) · Node 24 LTS · Zod (контракт) · Hono (API) · Drizzle + PostgreSQL (прод) / PGlite (dev и тесты) · React 19 + Vite + React Router + TanStack Query · Tailwind + shadcn/ui · Vitest · Playwright · Biome. Деплой: Docker на одной ВМ (API + Postgres + Caddy).

## Модули (границы кода)
| Путь | Что внутри | Может импортировать |
|---|---|---|
| `packages/contract/` | Zod-схемы DTO, роуты, enum | только `zod` |
| `apps/api/` | Hono-сервер, БД, сид, тесты | `contract` |
| `apps/web/` | React SPA, дизайн-система, MSW, e2e | `contract` |
| `deploy/` | Dockerfile, compose, Caddyfile | — |
| `docs/process/` | анализ, журналы агентов, скриншоты | — |

`api` и `web` **никогда** не импортируют друг друга, они общаются только через `contract`.

## Команды
> Появятся на этапе 0. После бутстрапа здесь будут реальные команды.

```
pnpm install      # зависимости
pnpm dev          # api + web локально (PGlite, без Docker)
pnpm test         # vitest во всех пакетах
pnpm typecheck    # tsc --noEmit во всех пакетах
pnpm lint         # biome check
pnpm e2e          # playwright (360 px + десктоп)
```

## Правила
Подробности в `.claude/rules/`, модульные правила подгружаются по путям:
- `security.md`: доступ только к своим данным, пароли, секреты (**репозиторий публичный**)
- `fictional-data.md`: только вымышленные данные, без чужих логотипов, лицензии
- `cross-platform.md`: команда работает на Linux и Windows
- `process-log.md`: журнал работы с ИИ, **обязателен**
- `contract.md`, `backend-api.md`, `frontend-ui.md`: правила модулей

## Перед тем как сказать «готово»
1. `pnpm typecheck && pnpm lint && pnpm test` зелёные.
2. Для UI проверено на ширине 360 px.
3. Запись в журнале `docs/process/<агент>.md` добавлена.
