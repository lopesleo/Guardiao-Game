// Recorta a Fusion Pixel 12px (OFL, github.com/TakWolf/fusion-pixel-font) só com os caracteres
// que o jogo usa — a fonte inteira tem ~7 MB; o recorte, algumas dezenas de KB.
//   node tools/font-subset.mjs          → gera assets/fonts/FusionPixel-{ja,zh,langs}.woff2
//   node tools/font-subset.mjs --check  → só confere se os recortes cobrem os catálogos atuais
// Rodar de novo sempre que os catálogos ja/zh mudarem (`npm run check` avisa).
// Precisa de Python com fontTools e brotli (pip install fonttools brotli). A fonte original é
// baixada uma vez para tools/.cache/ (fora do git).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const VER = "2026.09.25";
const ZIP = `https://github.com/TakWolf/fusion-pixel-font/releases/download/${VER}/fusion-pixel-font-12px-proportional-ttf-v${VER}.zip`;
const CACHE = path.resolve("tools/.cache/fusion-pixel");
const OUT = path.resolve("assets/fonts");
const SRC = { ja: "fusion-pixel-12px-proportional-ja.ttf", zh: "fusion-pixel-12px-proportional-zh_hans.ttf" };

// Sempre presentes: ASCII, Latin-1 (nomes em português, ex. "Ã") e a pontuação do jogo
const BASE = (() => {
  let s = "";
  for (let c = 0x20; c < 0x7f; c++) s += String.fromCharCode(c);
  for (let c = 0xa0; c <= 0xff; c++) s += String.fromCharCode(c);
  return s + "·—–−×→←↑↓★☆…“”‘’«»•";
})();

const chars = (...strs) => [...new Set(Array.from(strs.join("")))].filter((c) => c >= " ").sort().join("");

async function catalog(lang) {
  return (await import(pathToFileURL(path.resolve(`src/i18n/${lang}.js`)).href + `?t=${Date.now()}`)).default;
}

// Caracteres que cada recorte precisa ter
export async function wanted() {
  const { sourceKeys } = await import(pathToFileURL(path.resolve("tools/i18n.mjs")).href);
  // + o index.html (aviso "gire o aparelho" fora do Phaser)
  const pt = [...sourceKeys().keys()].join("") + fs.readFileSync("index.html", "utf8");
  const { LANGS } = await import(pathToFileURL(path.resolve("src/i18n/i18n.js")).href);
  return {
    ja: chars(BASE, pt, Object.values(await catalog("ja")).join("")),
    zh: chars(BASE, pt, Object.values(await catalog("zh")).join("")),
    langs: chars(LANGS.map((l) => l.label).join("")),
  };
}

// Recortes desatualizados: [arquivo, caracteres que faltam]
export async function stale() {
  const w = await wanted();
  const out = [];
  for (const [id, need] of Object.entries(w)) {
    const f = path.join(OUT, `FusionPixel-${id}.chars.txt`);
    const have = fs.existsSync(f) ? new Set(Array.from(fs.readFileSync(f, "utf8"))) : new Set();
    const miss = Array.from(need).filter((c) => !have.has(c));
    if (miss.length) out.push([`FusionPixel-${id}.woff2`, miss.join("")]);
  }
  return out;
}

function ensureSource() {
  if (Object.values(SRC).every((f) => fs.existsSync(path.join(CACHE, f)))) return;
  fs.mkdirSync(CACHE, { recursive: true });
  const zip = path.join(CACHE, "fusion.zip");
  console.log("baixando a Fusion Pixel…");
  execFileSync("curl", ["-sL", "-o", zip, ZIP], { stdio: "inherit" });
  execFileSync("tar", ["-xf", zip, "-C", CACHE], { stdio: "inherit" });
}

async function main() {
  if (process.argv.includes("--check")) {
    const s = await stale();
    console.log(s.length ? s.map(([f, m]) => `${f}: faltam ${m.length} caracteres (${m.slice(0, 20)}) — rode node tools/font-subset.mjs`).join("\n") : "OK — recortes de fonte em dia.");
    process.exitCode = s.length ? 1 : 0;
    return;
  }
  ensureSource();
  const w = await wanted();
  // nomes dos idiomas (日本語 / 简体中文): o recorte chinês tem os dois
  for (const [id, text] of Object.entries(w)) {
    const src = path.join(CACHE, SRC[id] ?? SRC.zh);
    const txt = path.join(CACHE, `${id}.txt`);
    fs.writeFileSync(txt, text);
    const out = path.join(OUT, `FusionPixel-${id}.woff2`);
    execFileSync("python", ["-m", "fontTools.subset", src, `--text-file=${txt}`, "--flavor=woff2", `--output-file=${out}`, "--layout-features=*", "--no-hinting"], { stdio: "inherit" });
    fs.writeFileSync(path.join(OUT, `FusionPixel-${id}.chars.txt`), text);
    console.log(`${path.relative(".", out)}: ${Array.from(text).length} caracteres, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
  fs.copyFileSync(path.join(CACHE, "OFL.txt"), path.join(OUT, "OFL-FusionPixel.txt"));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
