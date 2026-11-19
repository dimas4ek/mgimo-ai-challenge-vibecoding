// PreToolUse guard (docs/AI-COLLAB.md §13 п.7). Exit 2 = block, stderr goes to Claude.
// Node instead of Python: Node is the project runtime, so it is guaranteed on both Linux and Windows.
//
// - git push: blocks --force/-f/+refspec, any 'main' target, and a bare push from branch main.
// - gh pr merge: blocks unless `gh pr checks` reports all checks passed.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function block(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(2);
}

// Minimal shell-like tokenizer: whitespace splits, single/double quotes group.
function tokenize(part) {
  const tokens = [];
  let cur = "";
  let quote = null;
  let has = false;
  for (const ch of part) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) tokens.push(cur);
      cur = "";
      has = false;
    } else {
      cur += ch;
    }
  }
  if (has || cur) tokens.push(cur);
  return tokens;
}

function segments(command) {
  return command.split(/&&|\|\||;|\||\n/).map((p) => tokenize(p.trim()));
}

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8" });
}

function checkPush(args, cwd) {
  const opts = args.filter((a) => a.startsWith("-"));
  const refs = args.filter((a) => !a.startsWith("-"));
  if (opts.some((o) => o === "-f" || o.startsWith("--force"))) {
    block("Запрещено: force-push (docs/AI-COLLAB.md §11).");
  }
  if (refs.some((r) => r.startsWith("+"))) {
    block("Запрещено: force-push через +refspec (docs/AI-COLLAB.md §11).");
  }
  const targets = refs.slice(1); // refs[0] — remote
  if (targets.some((t) => t === "main" || t.endsWith(":main") || t.endsWith("/main"))) {
    block("Запрещено: прямой пуш в main. Только через PR (docs/AI-COLLAB.md §5).");
  }
  if (targets.length === 0) {
    const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd).stdout?.trim();
    if (branch === "main") {
      block("Запрещено: git push с ветки main. Создай ветку задачи (docs/AI-COLLAB.md §5).");
    }
  }
}

function checkMerge(args, cwd) {
  const pr = args.find((a) => !a.startsWith("-"));
  const res = run("gh", ["pr", "checks", ...(pr ? [pr] : [])], cwd);
  if (res.status !== 0) {
    const out = `${res.stdout ?? ""}${res.stderr ?? ""}${res.error ? String(res.error) : ""}`;
    block(
      `Мерж заблокирован: CI не зелёный или ещё идёт (gh pr checks, код ${res.status}). ` +
        `Дождись \`gh pr checks <PR> --watch\` и исправь падения (docs/AI-COLLAB.md §7).\n${out.slice(-800)}`,
    );
  }
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }
  const command = data.tool_input?.command ?? "";
  const cwd = data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  for (const argv of segments(command)) {
    if (argv[0] === "git") {
      // Skip git global options so `git -C dir push …` is checked too.
      let i = 1;
      let gitCwd = cwd;
      while (i < argv.length && argv[i].startsWith("-")) {
        if (argv[i] === "-C") gitCwd = resolve(gitCwd, argv[i + 1] ?? ".");
        i += argv[i] === "-C" || argv[i] === "-c" ? 2 : 1;
      }
      if (argv[i] === "push") checkPush(argv.slice(i + 1), gitCwd);
    } else if (argv[0] === "gh" && argv[1] === "pr" && argv[2] === "merge") {
      checkMerge(argv.slice(3), cwd);
    }
  }
  process.exit(0);
});
