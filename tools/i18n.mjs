// Idiomas: extrai os textos do jogo e confere os catálogos (ver docs/IDIOMAS.md).
//   node tools/i18n.mjs keys            → lista os textos-fonte (português) numerados: "N|texto"
//   node tools/i18n.mjs check           → falta/sobra/parâmetros trocados em cada catálogo
//   node tools/i18n.mjs missing <lang>  → só o que falta traduzir nesse idioma, numerado
//   node tools/i18n.mjs build <lang> <textos.txt> <traducao.txt>
//        junta ao src/i18n/<lang>.js as linhas "N|tradução" do 2º arquivo, casando o N com o
//        "N|texto" do 1º (saída de keys/missing); \n = quebra de linha. Sem a linha = português.
// Textos-fonte: o 1º argumento literal de cada tr("…") em src/ e os campos de texto das
// fichas do config.js (os mesmos de TEXT_FIELDS em src/i18n/i18n.js).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ts = createRequire(import.meta.url)("typescript");

const ROOT = path.resolve("src");
export const LANG_IDS = ["en", "es", "ja", "zh", "zht"];
const TEXT_FIELDS = new Set(
  fs.readFileSync(path.join(ROOT, "i18n", "i18n.js"), "utf8").match(/const TEXT_FIELDS = new Set\(\[([\s\S]*?)\]\)/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1)),
);

function files() {
  const out = [];
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const f = path.join(d, e.name);
      if (e.isDirectory()) return e.name === "i18n" ? null : walk(f);
      if (f.endsWith(".js")) out.push(f);
    });
  walk(ROOT);
  return out;
}

// Textos-fonte, na ordem em que aparecem (estável entre execuções)
export function sourceKeys() {
  const keys = new Map(); // texto → onde
  const add = (s, where) => {
    if (!keys.has(s)) keys.set(s, where);
  };
  for (const f of files()) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const isConfig = rel === "config.js";
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText() === "tr" && n.arguments.length) {
        const a = n.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) add(a.text, `${rel}:${sf.getLineAndCharacterOfPosition(a.getStart()).line + 1}`);
      }
      if (isConfig && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) {
        // campo de texto: "name: '…'" ou item de lista dentro de um campo de texto
        let p = n.parent,
          field = null;
        if (ts.isPropertyAssignment(p) && p.initializer === n) field = p.name.getText().replace(/["']/g, "");
        else if (ts.isArrayLiteralExpression(p) && ts.isPropertyAssignment(p.parent)) field = p.parent.name.getText();
        const isId = field === "stat" && /^[A-Za-z0-9_]+$/.test(n.text);
        if (field && TEXT_FIELDS.has(field) && !isId && /[A-Za-zÀ-ú]/.test(n.text))
          add(n.text, `config.js:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return keys;
}

// {s} (plural em português) pode sumir na tradução: japonês e chinês não têm plural
const params = (s) => (s.match(/\{[0-9a-z]+\}/g) || []).filter((p) => p !== "{s}").sort().join(",");

async function loadCatalog(lang) {
  const url = pathToFileURL(path.join(ROOT, "i18n", `${lang}.js`)).href + `?t=${Date.now()}`;
  return (await import(url)).default;
}

export async function check({ quiet = false } = {}) {
  const keys = sourceKeys();
  const problems = [];
  for (const lang of LANG_IDS) {
    const cat = await loadCatalog(lang);
    const missing = [...keys.keys()].filter((k) => !cat[k]);
    const extra = Object.keys(cat).filter((k) => !keys.has(k));
    const bad = Object.entries(cat).filter(([k, v]) => keys.has(k) && params(k) !== params(v));
    if (missing.length) problems.push(`${lang}: ${missing.length} sem tradução (ex.: ${JSON.stringify(missing[0])} em ${keys.get(missing[0])})`);
    if (extra.length) problems.push(`${lang}: ${extra.length} traduções sobrando (texto mudou no código?) ex.: ${JSON.stringify(extra[0])}`);
    for (const [k, v] of bad.slice(0, 5)) problems.push(`${lang}: parâmetros diferentes em ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
  }
  if (!quiet) console.log(`${keys.size} textos-fonte · idiomas: ${LANG_IDS.join(", ")}`);
  return problems;
}

const esc = (s) => JSON.stringify(s);

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "keys") {
    let i = 0;
    for (const k of sourceKeys().keys()) console.log(`${++i}|${k.replace(/\n/g, "\\n")}`);
  } else if (cmd === "check") {
    const p = await check();
    console.log(p.length ? p.join("\n") : "OK — todos os idiomas completos.");
    process.exitCode = p.length ? 1 : 0;
  } else if (cmd === "build") {
    // build <lang> <textos.txt> <traducao.txt>: os dois arquivos têm linhas "N|…" com o mesmo N
    // (o 1º saiu de `keys`/`missing`). Junta ao catálogo atual e tira o que o código não usa mais.
    const [, lang, keysFile, trFile] = process.argv.slice(2);
    const readN = (file) => {
      const m = new Map();
      for (const line of fs.readFileSync(file, "utf8").replace(/\r/g, "").split("\n")) {
        const r = line.match(/^(\d+)\|(.*)$/);
        if (!r) continue;
        if (m.has(+r[1])) throw new Error(`${file}: número repetido: ${r[1]}`);
        m.set(+r[1], r[2].replace(/\\n/g, "\n"));
      }
      return m;
    };
    const src = readN(keysFile);
    const got = readN(trFile);
    for (const n of got.keys()) if (!src.has(n)) throw new Error(`${trFile}: número ${n} não existe em ${keysFile}`);
    const cat = { ...(await loadCatalog(lang)) };
    for (const [n, v] of got) if (v.trim()) cat[src.get(n)] = v;
    const keys = [...sourceKeys().keys()];
    const body = keys
      .filter((k) => cat[k])
      .map((k) => `  ${esc(k)}: ${esc(cat[k])},`)
      .join("\n");
    const out = `// Catálogo ${lang}: texto em português do código → tradução. Gerado por tools/i18n.mjs (ver docs/IDIOMAS.md)\nexport default {\n${body}\n};\n`;
    fs.writeFileSync(path.join(ROOT, "i18n", `${lang}.js`), out);
    console.log(`src/i18n/${lang}.js: ${keys.filter((k) => cat[k]).length}/${keys.length} textos`);
  } else if (cmd === "missing") {
    // missing <lang>: só os textos ainda sem tradução nesse idioma, numerados
    const cat = await loadCatalog(a);
    let i = 0;
    for (const k of sourceKeys().keys()) if (!cat[k]) console.log(`${++i}|${k.replace(/\n/g, "\\n")}`);
  } else console.log("uso: node tools/i18n.mjs keys | missing <lang> | check | build <lang> <textos.txt> <traducao.txt>");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
