---
name: fix
description: Завести правку от людей на доске с fix и p0 (docs/AI-COLLAB.md §10).
argument-hint: "<что не так и как должно быть>"
---
Создай issue по шаблону задачи (§2) из текста: $ARGUMENTS
`gh issue create -R dimas4ek/mgimo-ai-challenge-vibecoding-board --label fix --label p0 --title "fix: <кратко>" --body "<шаблон>"`.
Если для правки нужен новый контракт — опиши его в разделе «Контракт». Задачу не бери, только заведи и покажи ссылку.
