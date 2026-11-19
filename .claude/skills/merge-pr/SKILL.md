---
name: merge-pr
description: Довести PR до мержа — CI, ревью субагентом, squash-мерж, обновление доски и Статуса (docs/AI-COLLAB.md §7, §9). Вызывается внутри batch.
---
Вход: номер PR, номер задачи N, тип (contract или impl).

1. CI: `gh pr checks <PR> --watch --interval 10`. Сразу после пуша CI может ещё не появиться ("no checks reported") —
   тогда повтори эту же команду через полминуты (не `sleep`, а просто повторный вызов). Красный → исправь, запушь, снова жди. После 2 неудачных исправлений → skill `stuck`.
2. Ревью: субагент `pr-reviewer` с PR, N и типом. `CHANGES` → исправь, запушь, дождись CI, повтори ревью.
   Максимум 2 круга, потом skill `stuck`.
3. `gh pr merge <PR> --squash --delete-branch` (хук не пустит при красном CI).
4. Тип impl: `gh issue edit N -R dimas4ek/mgimo-ai-challenge-vibecoding-board --add-label done` и
   `gh issue close N -R dimas4ek/mgimo-ai-challenge-vibecoding-board --comment "готово: <ссылка на PR> (agent:X)"`.
5. Статус (§9): собери тело целиком из текущей доски (как в skill `board`) и `gh issue edit 1 -R dimas4ek/mgimo-ai-challenge-vibecoding-board --body "<тело>"`. Не дописывай — перезаписывай.
