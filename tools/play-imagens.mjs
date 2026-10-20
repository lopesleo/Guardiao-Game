// Artes da ficha da loja pela API (edits.images): capturas do celular e gráfico de destaque, por idioma.
// As artes saem de videos/promo/store/out/<idioma>/ (01..08_*.png e feature_1024x500.png; ver o LEIA-ME de lá).
//
//   node tools/play-imagens.mjs ver                o que a ficha tem hoje, por idioma (só leitura)
//   node tools/play-imagens.mjs subir --seco       confere os arquivos e o que mudaria, sem gravar
//   node tools/play-imagens.mjs subir              troca as capturas e o gráfico de destaque de todos os idiomas
//        --idiomas=pt-BR,en-US                     só esses
//
// A troca vale para a ficha publicada assim que o Google revisar (com a publicação gerenciada desligada, a
// alteração vai sozinha para a revisão). Credencial e permissões: tools/play/api.mjs.
import fs from "node:fs";
import path from "node:path";
import { api, upload } from "./play/api.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const OUT = path.join(ROOT, "videos/promo/store/out");
// idioma da ficha → pasta das artes (zht = chinês tradicional, vale para zh-TW e zh-HK)
const LOCALES = { "pt-BR": "pt", "en-US": "en", "es-419": "es", "es-ES": "es", "ja-JP": "ja", "zh-CN": "zh", "zh-TW": "zht", "zh-HK": "zht" };

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("--")) || "ver";
const SECO = args.includes("--seco");
const only = args.find((a) => a.startsWith("--idiomas="))?.split("=")[1]?.split(",");
const locales = Object.keys(LOCALES).filter((l) => !only || only.includes(l));

function files(dir) {
  const d = path.join(OUT, dir);
  const shots = fs.readdirSync(d).filter((f) => /^\d\d_.+\.png$/.test(f)).sort();
  const feature = path.join(d, "feature_1024x500.png");
  if (shots.length < 2 || shots.length > 8) throw new Error(`${dir}: ${shots.length} capturas (o Play aceita 2 a 8)`);
  if (!fs.existsSync(feature)) throw new Error(`${dir}: falta feature_1024x500.png`);
  return { shots: shots.map((f) => path.join(d, f)), feature };
}

async function withEdit(fn) {
  const ed = await api("POST", `edits`, {});
  let keep = false;
  try {
    keep = await fn(ed.id);
  } finally {
    if (!keep) await api("DELETE", `edits/${ed.id}`).catch(() => {});
  }
}

const list = async (id, l, type) => (await api("GET", `edits/${id}/listings/${l}/${type}`))?.images || [];

if (cmd === "ver") {
  await withEdit(async (id) => {
    for (const l of locales) {
      const [p, f, t7, t10] = await Promise.all(["phoneScreenshots", "featureGraphic", "sevenInchScreenshots", "tenInchScreenshots"].map((t) => list(id, l, t)));
      console.log(`${l.padEnd(6)} celular ${p.length} · destaque ${f.length} · tablet 7" ${t7.length} · tablet 10" ${t10.length}`);
    }
    return false;
  });
} else if (cmd === "subir") {
  for (const l of locales) {
    const f = files(LOCALES[l]);
    console.log(`  ·  ${l}: ${f.shots.length} capturas + destaque (${LOCALES[l]}/)`);
  }
  if (SECO) process.exit(0);
  await withEdit(async (id) => {
    for (const l of locales) {
      const f = files(LOCALES[l]);
      await api("DELETE", `edits/${id}/listings/${l}/phoneScreenshots`);
      for (const s of f.shots) await upload(`edits/${id}/listings/${l}/phoneScreenshots?uploadType=media`, fs.readFileSync(s), "image/png");
      await api("DELETE", `edits/${id}/listings/${l}/featureGraphic`);
      await upload(`edits/${id}/listings/${l}/featureGraphic?uploadType=media`, fs.readFileSync(f.feature), "image/png");
      console.log(`  ✓  ${l}`);
    }
    await api("POST", `edits/${id}:commit`);
    console.log("  ✓  ficha gravada: vai para a revisão do Google");
    return true;
  });
} else {
  console.error(`Comando desconhecido: ${cmd} (ver · subir)`);
  process.exit(1);
}
