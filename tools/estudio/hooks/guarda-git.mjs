// Guarda das regras de git do Guardião (hook PreToolUse do Claude Code, para Bash e PowerShell).
// Ideia do validate-commit.sh / validate-push.sh do Claude-Code-Game-Studios, com as NOSSAS regras
// (CLAUDE.md, "Fluxo de branches"):
//   · commit sem o trailer Co-Authored-By                                  → bloqueia
//   · nada de commit direto na main (merge em andamento pode)              → bloqueia
//   · mensagem no padrão tipo(escopo): descrição                           → bloqueia se fugir
//   · src/config.js no commit com ADS.TESTING = false                      → bloqueia
//   · merge na main sem --no-ff                                            → bloqueia
//   · push                                                                 → pergunta (só quando o Leonardo pedir)
// Entrada: JSON no stdin ({ tool_name, tool_input: { command }, cwd }). Saída: decisão em JSON.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

let raw = "";
for await (const c of process.stdin) raw += c;
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}
const cmd = String(input?.tool_input?.command || "");
if (!/\bgit\b/.test(cmd)) process.exit(0);
const cwd = input.cwd || process.cwd();

const decide = (permissionDecision, reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason: reason } }));
  process.exit(0);
};
const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};
// "git [opções globais] <sub>" em qualquer ponto do comando (encadeado com && ; | ou em outra linha)
const sub = (name) => new RegExp(String.raw`\bgit(?:\s+(?:-[cC]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+${name}\b`).test(cmd);

if (sub("push")) decide("ask", "Regra do projeto: push só quando o Leonardo pedir. Ele pediu nesta conversa?");

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const gitDir = git("rev-parse", "--git-dir");
const merging = gitDir && existsSync(join(cwd, gitDir, "MERGE_HEAD"));

if (sub("merge") && branch === "main" && !/--(no-ff|abort|continue|quit)\b/.test(cmd))
  decide("deny", "Merge na main é sempre com --no-ff (o histórico mostra cada funcionalidade como um bloco).");

if (sub("commit")) {
  if (/co-authored-by/i.test(cmd)) decide("deny", "Commits deste projeto não levam o trailer Co-Authored-By (regra do CLAUDE.md). Tire a linha e tente de novo.");
  if (branch === "main" && !merging)
    decide("deny", "Nada é desenvolvido direto na main: crie feat/<marco>-<nome>, fix/<nome>, docs/<nome> ou chore/<nome> e faça o merge --no-ff depois.");
  const m = cmd.match(/(?:^|\s)-m\s+(?:"((?:\\.|[^"\\])*)"|'([^']*)')/);
  const msg = m ? (m[1] ?? m[2]) : null;
  if (msg && !/^\s*(\$\(|@)/.test(msg)) {
    const first = msg.split(/\r?\n|\\n/)[0];
    if (!/^(feat|fix|docs|refactor|test|chore|perf|style|merge)(\([^)]+\))?!?: \S/.test(first))
      decide("deny", `Mensagem fora do padrão "tipo(escopo): descrição" em português (feat, fix, docs, refactor, test, chore): "${first}"`);
  }
  // o que vai no commit: o índice; com -a/--all, a cópia de trabalho
  const all = /\s(-a|--all|-am)\b/.test(cmd);
  const cfg = all ? git("diff", "HEAD", "--", "src/config.js") : git("diff", "--cached", "--", "src/config.js");
  if (/^\+.*\bTESTING:\s*false/m.test(cfg))
    decide("deny", "ADS.TESTING = false em src/config.js: nunca à mão. O `npm run android:aab` só inverte na cópia empacotada.");
}
process.exit(0);
