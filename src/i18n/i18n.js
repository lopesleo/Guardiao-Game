// Idiomas (ver docs/IDIOMAS.md). O texto-fonte é o PORTUGUÊS escrito no código: t("Jogar")
// procura a tradução no catálogo do idioma e, se não houver, devolve o próprio português
// (nada quebra; `npm run check` aponta o que falta). Parâmetros posicionais: tr("Nível {0}", n).
// Os textos das fichas do config.js são traduzidos uma vez, no carregamento (localize).
import { Settings } from "../systems/Settings.js";
import en from "./en.js";
import es from "./es.js";
import ja from "./ja.js";
import zh from "./zh.js";

export const LANGS = [
  { id: "pt", label: "Português", locale: "pt-BR" },
  { id: "en", label: "English", locale: "en-US" },
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "ja", label: "日本語", locale: "ja-JP" },
  { id: "zh", label: "简体中文", locale: "zh-CN" },
];
const CATALOGS = { en, es, ja, zh };

// 1ª abertura: idioma do aparelho (português do Brasil é a casa; o resto cai no inglês)
function detect() {
  if (typeof window === "undefined") return "pt"; // ferramentas no Node (npm run check) leem o português
  const list = (typeof navigator !== "undefined" && (navigator.languages?.length ? navigator.languages : [navigator.language])) || [];
  for (const l of list) {
    const base = String(l || "").toLowerCase().split("-")[0];
    if (LANGS.some((x) => x.id === base)) return base;
  }
  return "en";
}

export const lang = (() => {
  const saved = Settings.get("lang");
  return LANGS.some((x) => x.id === saved) ? saved : detect();
})();
export const locale = LANGS.find((x) => x.id === lang).locale;
// Japonês e chinês: fonte própria e quebra de linha por caractere (não há espaços)
export const isCJK = lang === "ja" || lang === "zh";
const cat = CATALOGS[lang] ?? null;

export function tr(src, ...args) {
  let s = (cat && cat[src]) || src;
  if (args.length) s = s.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? args[i] : m));
  return s;
}

// Número com separador do idioma (1.234 / 1,234) e decimal com vírgula onde se usa vírgula
export const fmt = (n) => Number(n).toLocaleString(locale);
export const dec = (x, digits = 1) => Number(x).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Troca o idioma: os textos do Phaser são desenhados uma vez, então o jogo recarrega
export function setLang(id) {
  Settings.set("lang", id);
  location.reload();
}

// Campos de TEXTO das fichas (config.js). Ids e chaves ficam como estão: só traduz o que
// está num destes campos E tem entrada no catálogo.
const TEXT_FIELDS = new Set([
  "name", "desc", "label", "text", "plus", "role", "origin", "short", "title", "perk", "hint",
  "wake", "freed", "bossName", "msg", "again", "rage", "water", "weed", "pest", "stat", "QUALITY",
]);

// Traduz no lugar, recursivamente, as fichas passadas (antes de qualquer cena ler)
export function localize(tables) {
  if (!cat) return;
  const seen = new Set();
  const walk = (o, field) => {
    if (!o || typeof o !== "object" || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      const v = o[k];
      const f = Array.isArray(o) ? field : k;
      if (typeof v === "string") {
        // `stat` também é id de contador ("kills", "VAPOR"): só traduz se for frase
        if (f === "stat" && /^[A-Za-z0-9_]+$/.test(v)) continue;
        if (TEXT_FIELDS.has(f) && cat[v]) o[k] = cat[v];
      } else if (v && typeof v === "object") walk(v, f);
    }
  };
  for (const tbl of tables) walk(tbl, null);
}

// Quebra de linha por caractere (wordWrap.callback do Phaser) para japonês e chinês.
// Pontuação de fechamento não começa linha (regra básica de kinsoku).
const NO_START = "、。，．,.！？!?）)」』】〕〉》・ー…：:；;%";
export function cjkWrap(text, obj) {
  const ctx = obj.context;
  const max = obj.style.wordWrapWidth;
  if (!max) return text;
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const ch of Array.from(para)) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > max && !NO_START.includes(ch)) {
        out.push(line);
        line = ch === " " ? "" : ch;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}
