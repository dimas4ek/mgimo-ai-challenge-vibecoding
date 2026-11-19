// Ждёт, пока на доске освободится задача (docs/AI-COLLAB.md §8). Запускается из skill batch в фоне,
// опрашивает доску сам, поэтому ожидание не тратит лимит Claude.
//
// Код выхода: 0 — есть свободная задача; 2 — ждать нечего (задач нет или они ждут людей);
// 3 — вышел таймаут; 1 — gh не отвечает.
// Аргументы: --interval-sec N (по умолчанию 60), --timeout-min N (по умолчанию 90).
import { execFileSync } from "node:child_process";

const BOARD = "dimas4ek/mgimo-ai-challenge-vibecoding-board";
const DEAD = ["proposal", "needs-human"];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  const n = i === -1 ? Number.NaN : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const intervalMs = arg("--interval-sec", 60) * 1000;
const deadline = Date.now() + arg("--timeout-min", 90) * 60_000;

function loadBoard() {
  const out = execFileSync(
    "gh",
    ["issue", "list", "-R", BOARD, "--state", "open", "--limit", "200", "--json", "number,labels,body"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }, // 200 issue с body не влезают в дефолтный 1 МБ
  );
  return JSON.parse(out).map((i) => {
    const deps = (i.body ?? "").split(/\n(?=## )/).find((s) => s.startsWith("## Зависит от")) ?? "";
    return {
      number: i.number,
      labels: i.labels.map((l) => l.name),
      deps: [...deps.matchAll(/#(\d+)/g)].map((m) => Number(m[1])),
    };
  });
}

// Свободна (§3), но по зависимостям, а не по label `blocked`: забытый `blocked` не должен вешать ожидание.
// Закрытая зависимость (её нет среди открытых) считается готовой.
function classify(issues) {
  const byNum = new Map(issues.map((i) => [i.number, i]));
  const has = (i, l) => i.labels.includes(l);
  const busy = (i) => i.labels.some((l) => l.startsWith("agent:"));
  const unmet = (i) => i.deps.map((d) => byNum.get(d)).filter((d) => d && !has(d, "contract-merged"));

  // Задача «движется», если её не ждут люди и все её неготовые зависимости тоже движутся.
  const moving = new Map();
  const isMoving = (i) => {
    if (moving.has(i.number)) return moving.get(i.number);
    moving.set(i.number, false); // защита от циклов в «Зависит от»
    const ok = !DEAD.some((l) => has(i, l)) && unmet(i).every(isMoving);
    moving.set(i.number, ok);
    return ok;
  };

  const tasks = issues.filter((i) => !has(i, "status"));
  const open = tasks.filter((i) => !busy(i) && !DEAD.some((l) => has(i, l)));
  return {
    free: open.filter((i) => unmet(i).length === 0),
    waiting: open.filter((i) => unmet(i).length > 0 && isMoving(i)),
    inWork: tasks.filter(busy),
  };
}

const nums = (list) => list.map((i) => `#${i.number}`).join(", ");
let failures = 0;

for (;;) {
  let board;
  try {
    board = classify(loadBoard());
    failures = 0;
  } catch (e) {
    failures += 1;
    if (failures >= 3) {
      process.stderr.write(`gh не отвечает 3 раза подряд: ${e.message}\n`);
      process.exit(1);
    }
  }
  if (board) {
    if (board.free.length > 0) {
      process.stdout.write(`Свободны: ${nums(board.free)}\n`);
      process.exit(0);
    }
    if (board.waiting.length === 0 || board.inWork.length === 0) {
      process.stdout.write(
        board.waiting.length === 0
          ? "Задач нет: открытые задачи либо в работе, либо ждут людей.\n"
          : `Ждать некого: ${nums(board.waiting)} ждут контрактов, но никто их не делает.\n`,
      );
      process.exit(2);
    }
  }
  if (Date.now() + intervalMs > deadline) {
    process.stdout.write(`Не дождался: ${board ? nums(board.waiting) : "?"} всё ещё ждут контрактов.\n`);
    process.exit(3);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
