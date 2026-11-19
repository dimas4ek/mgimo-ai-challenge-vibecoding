---
name: take-task
description: Выбрать и занять одну свободную задачу на доске (docs/AI-COLLAB.md §3–4). Вызывается внутри batch.
---
Доска: `-R dimas4ek/mgimo-ai-challenge-vibecoding-board`. Ты — `agent:X` из `CLAUDE.local.md`.

1. `git switch main && git pull --ff-only`.
2. `gh issue list -R dimas4ek/mgimo-ai-challenge-vibecoding-board --state open --limit 100 --json number,title,labels,body`.
3. Свободна (§3): нет `agent:*`, `blocked`, `proposal`, `needs-human`, `status`; у каждой задачи из «Зависит от» есть `contract-merged`
   (`gh issue view <dep> -R dimas4ek/mgimo-ai-challenge-vibecoding-board --json labels`).
   Задаче с неготовыми зависимостями без `blocked` — поставь `blocked` и в issue зависимости комментарий `нужен контракт для #N (agent:X)`
   (если такого комментария ещё нет).
4. Порядок (§3): `fix`+`p0` → блокеры (от них зависят другие) → `p1` → `p2` → меньший номер → свой модуль.
5. Занять: `gh issue edit N -R dimas4ek/mgimo-ai-challenge-vibecoding-board --add-label agent:X` и `gh issue comment N -R dimas4ek/mgimo-ai-challenge-vibecoding-board --body "беру (agent:X)"`.
6. Проверка гонки: `gh issue view N -R dimas4ek/mgimo-ai-challenge-vibecoding-board --json labels,comments`. Если есть «беру (agent:Y)» с более ранним `createdAt`
   или чужой `agent:*` label с более ранним «беру» — уступи: `--remove-label agent:X`, комментарий `уступаю (agent:X)`, вернись к шагу 2.
7. Верни номер задачи. Нет свободных — так и скажи.
