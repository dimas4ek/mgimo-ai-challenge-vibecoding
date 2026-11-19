# Цифровой деканат AI High School

Прототип личного кабинета студента для хакатона MGIMO AI Challenge (номинация «Вайб-кодинг»). Вуз **вымышленный**: AI High School (Высшая Школа ИИ). Сдача 22.11.2026, прототип должен работать до 28.11.

- Этапы и их состав: [ROADMAP.md](ROADMAP.md) (статус задач ведётся на доске `dimas4ek/mgimo-ai-challenge-vibecoding-board`)
- Почему так решили: [docs/process/00-analysis.md](docs/process/00-analysis.md)
- Исходное ТЗ: `TZ.pdf`

## Стек

TypeScript-монорепо (pnpm workspaces) · Node 24 LTS · Zod (контракт) · Hono (API) · Drizzle + PostgreSQL (прод) / PGlite (dev и тесты) · React 19 + Vite + React Router + TanStack Query · Tailwind + shadcn/ui · Vitest · Playwright · Biome. Деплой: Docker на одной ВМ (API + Postgres + Caddy).

## Модули (границы кода)

| Путь                 | Что внутри                          | Может импортировать |
| -------------------- | ----------------------------------- | ------------------- |
| `packages/contract/` | Zod-схемы DTO, роуты, enum          | только `zod`        |
| `apps/api/`          | Hono-сервер, БД, сид, тесты         | `contract`          |
| `apps/web/`          | React SPA, дизайн-система, MSW, e2e | `contract`          |
| `deploy/`            | Dockerfile, compose, Caddyfile      | —                   |
| `docs/process/`      | анализ, журналы агентов, скриншоты  | —                   |

`api` и `web` **никогда** не импортируют друг друга, они общаются только через `contract`.

## Команды

Нужны Node 24+ и pnpm 10 (`npm i -g pnpm@10.34.9`; в Node 25+ corepack убран). Настройки: скопировать `.env.example` в `.env` (необязательно, есть дефолты).

```
pnpm install      # зависимости
pnpm dev          # api (:3000, tsx watch) + web (:5173, Vite проксирует /api в api)
pnpm test         # vitest во всех пакетах
pnpm typecheck    # tsc во всех пакетах
pnpm lint         # biome check (pnpm format — то же с автоисправлением)
pnpm build        # contract: tsc; api: esbuild → apps/api/dist; web: vite → apps/web/dist
pnpm e2e          # playwright (360 px + десктоп), появится вместе с e2e-тестами
```

Версии зависимостей закреплены точно (`.npmrc`: `save-exact`). Новую зависимость ставь в нужный пакет: `pnpm --filter @aihs/api add <pkg>`.
Прод-стек (Postgres + API со статикой SPA + Caddy) поднимается так: `docker compose --env-file .env -f deploy/compose.yml up -d --build`. В `.env` нужны `DOMAIN` и `POSTGRES_PASSWORD`. Для разработки Docker не нужен.
CI (`.github/workflows/ci.yml`, Ubuntu + Windows) запускает `pnpm install --frozen-lockfile`, затем `lint`, `typecheck`, `test`, `build`. Отдельный джоб `docker` (только Ubuntu) поднимает прод-стек и проверяет `/` и `/api/health`. Если CI и локальная сборка расходятся, прав CI.

## Правила

Подробности в `.claude/rules/`, модульные правила подгружаются по путям:

- `security.md`: доступ только к своим данным, пароли, секреты (**репозиторий публичный**)
- `fictional-data.md`: только вымышленные данные, без чужих логотипов, лицензии
- `cross-platform.md`: команда работает на Linux и Windows
- `process-log.md`: журнал работы с ИИ, **обязателен**
- `contract.md`, `backend-api.md`, `frontend-ui.md`: правила модулей

## Совместная работа

Работаем вдвоём (`agent:dimas`, `agent:evv`) по доске задач, главный принцип — «сначала контракт».
Правила: [docs/AI-COLLAB.md](docs/AI-COLLAB.md), фразы для людей: [docs/PHRASES.md](docs/PHRASES.md).
Кто ты, указано в `CLAUDE.local.md` (он не в git). Процедуры оформлены в skills: `/batch`, `/board`, `/fix`, `/proposal`,
внутри пачки — `take-task`, `contract`, `merge-pr`, `stuck`. `main` защищён: только PR и зелёный CI, хук `.claude/hooks/guard.mjs`.

## Как писать команды Bash (иначе allowlist их отклонит)

- Без переменных оболочки (`B=…`, `$B`) и без многострочных скриптов: адрес доски всегда полностью, `-R dimas4ek/mgimo-ai-challenge-vibecoding-board`.
- Одна команда на вызов или цепочка через `&&`. Не используй `;`, `|`, `$( … )`, перенаправления.
- Длинный текст для `gh` (тело issue/PR/комментария) передавай через `--body "…"`, не через heredoc.

## Перед тем как сказать «готово»

1. `pnpm typecheck && pnpm lint && pnpm test` зелёные.
2. Для UI проверено на ширине 360 px.
3. Запись в журнале `docs/process/<агент>.md` добавлена.
