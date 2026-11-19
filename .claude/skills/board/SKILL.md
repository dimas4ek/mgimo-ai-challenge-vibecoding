---
name: board
description: Показать состояние доски, ничего не меняя (docs/AI-COLLAB.md §9). Запускает человек; merge-pr использует тот же формат для Статуса.
---
`gh issue list -R dimas4ek/mgimo-ai-challenge-vibecoding-board --state all --limit 100 --json number,title,state,labels`. Ничего не меняй.
Выведи кратко:
- Готово: закрытые с `done`.
- В работе: открытые с `agent:*` (у кого).
- Свободно: по правилам §3.
- Заблокировано: `blocked` — чего ждут.
- Ждёт людей: `needs-human`, `proposal`.
