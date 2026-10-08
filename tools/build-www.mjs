// Copia só o que o jogo precisa para www/ (pasta que o Capacitor empacota no app).
// Nada de docs/, tools/, node_modules/ ou arquivos de teste dentro do APK.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "www";
const INCLUDE = ["index.html", "favicon.png", "manifest.webmanifest", "sw.js", "icons", "assets", "src", "vendor"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const p of INCLUDE) {
  if (!existsSync(p)) continue;
  cpSync(p, `${OUT}/${p}`, {
    recursive: true,
    // prévias/scratch dos packs de sprite não vão pro app
    // (.chars.txt: lista de conferência dos recortes de fonte, ver tools/font-subset.mjs)
    filter: (src) => !/_preview|\.md$|\.chars\.txt$/i.test(src),
  });
}

// Anúncios: GUARDIAO_ADS=real (build de loja, `npm run android:aab`) liga os anúncios de VERDADE
// só nesta cópia; qualquer outro build sai com os de TESTE. O src/ do projeto não muda.
const real = process.env.GUARDIAO_ADS === "real";
const cfg = `${OUT}/src/config.js`;
const src = readFileSync(cfg, "utf8");
const at = src.indexOf("export const ADS = {");
const m = at >= 0 && /TESTING:\s*(true|false)/.exec(src.slice(at));
if (!m) throw new Error("ADS.TESTING não encontrado em src/config.js");
const i = at + m.index;
writeFileSync(cfg, src.slice(0, i) + `TESTING: ${!real}` + src.slice(i + m[0].length));
console.log(`www/ pronto (${INCLUDE.filter(existsSync).join(", ")}) · anúncios de ${real ? "VERDADE (loja)" : "TESTE"}`);
