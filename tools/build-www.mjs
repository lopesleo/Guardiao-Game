// Copia só o que o jogo precisa para www/ (pasta que o Capacitor empacota no app).
// Nada de docs/, tools/, node_modules/ ou arquivos de teste dentro do APK.
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";

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
console.log(`www/ pronto (${INCLUDE.filter(existsSync).join(", ")})`);
