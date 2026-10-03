// Codemod (uso único, guardado para futuras levas): envolve os textos visíveis em tr().
//   node tools/i18n-wrap.mjs [--dry]
// "Texto visível" = literal com cara de frase/palavra exibida (ver looksText) fora de
// comparações, chaves de objeto, ids de arma, sons, analytics e console. Template strings
// viram tr("Texto {0}", expr). Depois de rodar, revise o diff: o que for id deve sair do tr().
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const ts = createRequire(import.meta.url)("typescript");

const DRY = process.argv.includes("--dry");
const ROOT = path.resolve("src");
const SKIP_DIRS = ["art", "audio", "i18n"];
const SKIP_FILES = ["config.js", "ui/VirtualJoystick.js", "systems/Daily.js"];
// ids que parecem texto (chaves de arma/reação, status do SDK)
const IDS = new Set([
  "STAFF", "AURA", "BOOMER", "CHAIN", "ORB", "FLAME", "FIREFLY", "HAIL", "WHIRL", "LASH", "GOLDBALL", "MIRAGE",
  "BONFIRE", "BOLAS", "DRUM", "ASSOBIO", "FOLHAS", "CATAVENTO", "VAPOR", "CRYSTAL", "OVERLOAD", "LABAREDA",
  "GEADA", "TEMPORAL", "OBTAINED", "REQUIRED", "NOT_REQUIRED", "UNKNOWN",
]);

export const looksText = (s) => {
  if (!/[A-Za-zÀ-ú]/.test(s)) return false;
  if (IDS.has(s)) return false;
  if (/^(#|0x|\.\/|\.\.\/|\/|https?:|data:|sfx_|music_|ico_|px_|mon_|ui_|hero_|obj_|env|bg_|fx_|go_)/.test(s)) return false;
  if (/^[a-z_][A-Za-z0-9_.\-:]*$/.test(s)) return false;
  if (/^[A-Z][A-Za-z0-9]*Scene$/.test(s)) return false;
  if (/^[A-Z0-9_]+$/.test(s) && s.length < 3) return false;
  if (/^[A-Z][A-Z0-9_]*$/.test(s) && s.includes("_")) return false;
  if (/^\d/.test(s) && !/[a-zà-ú]{3}/i.test(s)) return false;
  if (/^(Sine|Back|Quad|Cubic|Linear|Power|Expo|Bounce|Elastic)\./.test(s)) return false;
  if (/px$|^bold|monospace|sans-serif|^keydown|^keyup|^pointer|^touch/.test(s)) return false;
  return /[ À-ú…!?·:]/.test(s) || /^[A-ZÀ-Ú][A-ZÀ-Ú]{2,}$/.test(s) || /^[A-ZÀ-Ú][a-zà-ú]{2,}$/.test(s);
};

// texto estático de um template (sem os ${}) tem palavra?
const staticText = (n) => (ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ") : n.text);

function skipByContext(n) {
  const p = n.parent;
  if (ts.isPropertyAssignment(p) && p.name === n) return true;
  if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(ts.tokenToString(p.operatorToken.kind))) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isParameter(p) && IDS.has(n.text)) return true;
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isCallExpression(p)) {
    const callee = p.expression.getText();
    if (/^console\.|Analytics\.track|\.track$|\.play$|\.add$|addEventListener|getItem|setItem|\.load$|\.start$|\.launch$|\.get$|\.has$|\.includes$|\.on$|\.off$|\.once$|\.emit$|^tr$/.test(callee)) return true;
  }
  // status internos do SDK de anúncios (mostrados só no painel de debug)
  if (n.getSourceFile().fileName.endsWith("AdMobBridge.js") && !/indisponível/.test(staticText(n))) return true;
  return false;
}

const files = [];
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const full = path.join(d, e.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (e.isDirectory()) return SKIP_DIRS.includes(rel) ? null : walk(full);
    if (e.name.endsWith(".js") && !SKIP_FILES.includes(rel)) files.push(full);
  });
walk(ROOT);

let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits = []; // [start, end, text]
  const conv = (n) => {
    // devolve o texto de substituição de um nó (recursivo nas expressões de template)
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return `tr(${JSON.stringify(n.text)})`;
    let s = n.head.text;
    const args = [];
    n.templateSpans.forEach((sp, i) => {
      s += `{${i}}` + sp.literal.text;
      args.push(rewrite(sp.expression));
    });
    return `tr(${JSON.stringify(s)}, ${args.join(", ")})`;
  };
  // reescreve uma expressão aplicando t() nos textos de dentro
  const rewrite = (expr) => {
    const inner = [];
    const v = (n) => {
      if (isTarget(n)) {
        inner.push([n.getStart(), n.getEnd(), conv(n)]);
        return;
      }
      ts.forEachChild(n, v);
    };
    v(expr);
    let out = expr.getText();
    const base = expr.getStart();
    for (const [a, b, r] of inner.sort((x, y) => y[0] - x[0])) out = out.slice(0, a - base) + r + out.slice(b - base);
    return out;
  };
  const isTarget = (n) =>
    (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) &&
    !ts.isImportDeclaration(n.parent) &&
    looksText(ts.isTemplateExpression(n) ? n.getText().slice(1, -1) : n.text) &&
    /[A-Za-zÀ-ú]{2,}/.test(staticText(n)) &&
    !skipByContext(n);
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (isTarget(n)) {
      edits.push([n.getStart(), n.getEnd(), conv(n)]);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  let out = src;
  for (const [a, b, r] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + r + out.slice(b);
  // import do tr (caminho relativo à pasta do arquivo)
  if (!/import \{[^}]*\btr\b[^}]*\} from "[./]+i18n\/i18n\.js"/.test(out)) {
    let rel = path.relative(path.dirname(f), path.join(ROOT, "i18n", "i18n.js")).split(path.sep).join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    const imp = `import { tr } from "${rel}";\n`;
    const m = [...out.matchAll(/^import [^;]+;\s*$/gm)].pop();
    out = m ? out.slice(0, m.index + m[0].length) + "\n" + imp.trimEnd() + out.slice(m.index + m[0].length) : imp + out;
  }
  total += edits.length;
  console.log(String(edits.length).padStart(4), path.relative(ROOT, f));
  if (!DRY) fs.writeFileSync(f, out);
}
console.log("total", total);
