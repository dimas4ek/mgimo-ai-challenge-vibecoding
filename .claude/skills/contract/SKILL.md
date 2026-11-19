---
name: contract
description: Опубликовать контракт занятой задачи отдельным PR и смержить его (docs/AI-COLLAB.md §1, §5). Вызывается внутри batch.
---
1. Ветка от свежего main: `<agent>/<N>-<кратко>` (agent = dimas или evv), например `dimas/2-tokenize`.
2. Код контракта по разделу «Контракт» задачи (TypeScript):
   - данные API: Zod-схемы и роуты в `packages/contract/` (правила в `.claude/rules/contract.md`);
   - модули и функции: экспортируемые сигнатуры с типами и JSDoc, тела — `throw new Error("not implemented")`;
   - эндпоинт API может отдавать фейковые данные в форме схемы, UI-компонент может быть заглушкой.
   Проверки должны оставаться зелёными: `pnpm lint && pnpm typecheck && pnpm test`.
3. Перед первым пушем (§4 п.4): перечитай комментарии issue и `git ls-remote origin "*/<N>-*"`.
   Чужая ветка или более ранний чужой «беру» → уступи (как в take-task, шаг 6) и удали свою ветку.
4. Коммит `contract(#N): …`, `git push -u origin <ветка>`,
   `gh pr create --base main --title "contract(#N): …" --body "Board: dimas4ek/mgimo-ai-challenge-vibecoding-board#N — контракт"`.
5. Skill `merge-pr` (тип contract). Запомни SHA: `gh pr view <PR> --json headRefOid -q .headRefOid`.
6. `gh issue edit N -R dimas4ek/mgimo-ai-challenge-vibecoding-board --add-label contract-merged`. Для задач с `blocked`, у которых теперь все зависимости с `contract-merged`:
   `--remove-label blocked` и комментарий `контракт готов (#N)`.
