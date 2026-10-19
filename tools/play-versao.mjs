// Versão nova no Play Console pela API (edits): sobe o AAB da versão do build.gradle e põe numa faixa, com as
// notas dos 8 idiomas de docs/PLAY_STORE.md ("### X.Y.Z (código N)"). Padrão: RASCUNHO (quem publica é o
// Leonardo, no Console). Com --publicar (só quando ele pedir), a versão substitui a publicada na faixa: no
// teste interno chega em minutos; no fechado (alpha) vai para a revisão do Google e depois aos testadores.
//
//   node tools/play-versao.mjs faixas                   o que está em cada faixa (só leitura)
//   node tools/play-versao.mjs subir                    AAB da versão atual → Teste fechado (alpha), rascunho
//        --faixa=internal                               outra faixa (internal · alpha · beta · production)
//        --aab=caminho                                  outro arquivo (padrão: dist/guardiao-vX.Y.Z-N-anuncios-reais.aab)
//        --publicar                                     publica em vez de rascunho (produção: só com --faixa=production)
//        --seco                                         confere tudo (arquivo, notas, faixa) sem gravar
//
// Credencial e permissões: tools/play/api.mjs e docs/PLAY_STORE.md ("Produtos pelo script").
import fs from "node:fs";
import { PKG, api, upload } from "./play/api.mjs";

const IDIOMAS = ["pt-BR", "en-US", "es-419", "es-ES", "ja-JP", "zh-CN", "zh-TW", "zh-HK"];
const ROOT = new URL("../", import.meta.url);
const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("--")) || "faixas";
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const SECO = args.includes("--seco");
const FAIXA = opt("faixa") || "alpha";
const PUBLICAR = args.includes("--publicar");
const STATUS = PUBLICAR ? "completed" : "draft";

// Versão do app (android/app/build.gradle)
function versao() {
  const g = fs.readFileSync(new URL("android/app/build.gradle", ROOT), "utf8");
  const code = Number(g.match(/versionCode\s+(\d+)/)?.[1]);
  const name = g.match(/versionName\s+"([^"]+)"/)?.[1];
  if (!code || !name) throw new Error("não achei versionCode/versionName em android/app/build.gradle");
  return { code, name };
}

// Notas da versão: o bloco ``` da seção "### X.Y.Z (código N)" de docs/PLAY_STORE.md, no formato do Console
function notas({ code, name }) {
  const md = fs.readFileSync(new URL("docs/PLAY_STORE.md", ROOT), "utf8").replace(/\r\n/g, "\n");
  const i = md.indexOf(`### ${name} (código ${code})`);
  if (i < 0) throw new Error(`docs/PLAY_STORE.md não tem a seção "### ${name} (código ${code})" com as notas`);
  const bloco = md.slice(i).match(/```\n([\s\S]*?)```/)?.[1] || "";
  const out = [];
  for (const l of IDIOMAS) {
    const t = bloco.match(new RegExp(`<${l}>\\n?([\\s\\S]*?)\\n?</${l}>`))?.[1]?.trim();
    if (!t) throw new Error(`notas da ${name}: falta o idioma ${l}`);
    if ([...t].length > 500) throw new Error(`notas da ${name} em ${l}: ${[...t].length} caracteres (o Play aceita 500)`);
    out.push({ language: l, text: t });
  }
  return out;
}

const resumoRelease = (r) => `${r.name ?? "?"} [${(r.versionCodes || []).join(",")}] ${r.status}${r.userFraction ? ` ${Math.round(r.userFraction * 100)}%` : ""}`;

async function comEdicao(fn) {
  const ed = await api("POST", "edits", {});
  let gravou = false;
  try {
    gravou = await fn(ed.id);
  } finally {
    if (!gravou) await api("DELETE", `edits/${ed.id}`).catch(() => {});
  }
}

async function faixas() {
  await comEdicao(async (id) => {
    const { tracks = [] } = await api("GET", `edits/${id}/tracks`);
    console.log(`Faixas de ${PKG}:`);
    for (const t of tracks) console.log(`  ${t.track.padEnd(12)} ${(t.releases || []).map(resumoRelease).join("  ·  ") || "(vazia)"}`);
    return false;
  });
}

async function subir() {
  const v = versao();
  const aab = opt("aab") || `dist/guardiao-v${v.name}-${v.code}-anuncios-reais.aab`;
  const arq = new URL(aab, ROOT);
  if (!fs.existsSync(arq)) throw new Error(`${aab} não existe (gere com npm run android:aab)`);
  const buf = fs.readFileSync(arq);
  const releaseNotes = notas(v);
  if (PUBLICAR && FAIXA === "production" && !args.includes("--faixa=production")) throw new Error("publicar em produção exige --faixa=production por extenso");
  if (FAIXA === "production") console.log(`  !  faixa de PRODUÇÃO${PUBLICAR ? ": vai para TODOS os jogadores depois da revisão" : " (rascunho)"}`);
  console.log(`  ·  ${aab} (${(buf.length / 1048576).toFixed(1)} MB) → ${v.name} (código ${v.code}), faixa "${FAIXA}", ${PUBLICAR ? "PUBLICAR" : "rascunho"}, notas em ${releaseNotes.length} idiomas`);
  await comEdicao(async (id) => {
    const { bundles = [] } = (await api("GET", `edits/${id}/bundles`)) || {};
    const ja = bundles.some((b) => b.versionCode === v.code);
    const maior = Math.max(0, ...bundles.map((b) => b.versionCode));
    if (!ja && v.code <= maior) throw new Error(`o código ${v.code} é menor que o último enviado (${maior}): aumente o versionCode`);
    const t = (await api("GET", `edits/${id}/tracks/${FAIXA}`)) || { track: FAIXA, releases: [] };
    // fica na faixa o que não é rascunho; publicando, a versão nova também substitui a publicada
    const outras = (t.releases || []).filter((r) => r.status !== "draft" && !(PUBLICAR && r.status === "completed") && !(r.versionCodes || []).includes(String(v.code)));
    for (const r of outras) console.log(`  ·  na faixa continua: ${resumoRelease(r)}`);
    if (SECO) {
      console.log(`  (seco) ${ja ? "o AAB já está no Play (não sobe de novo)" : "subiria o AAB"}; faixa "${FAIXA}" ficaria: ${[...outras.map(resumoRelease), `${v.name} [${v.code}] ${STATUS}`].join("  ·  ")}`);
      return false;
    }
    if (ja) console.log(`  ✓  o código ${v.code} já estava no Play: não sobe o arquivo de novo`);
    else {
      console.log("  …  enviando o AAB (o Play processa por 1–3 min)");
      const b = await upload(`edits/${id}/bundles?uploadType=media`, buf);
      console.log(`  ✓  AAB recebido: código ${b.versionCode}`);
    }
    await api("PUT", `edits/${id}/tracks/${FAIXA}`, { track: FAIXA, releases: [...outras, { name: v.name, versionCodes: [String(v.code)], status: STATUS, releaseNotes }] });
    // Grava sem mandar para revisão quando o app deixa. Apps com "enviar para revisão automaticamente" recusam o
    // parâmetro: aí grava sem ele — rascunho não vai para revisão nem para ninguém; publicada vai para a revisão
    try {
      await api("POST", `edits/${id}:commit?changesNotSentForReview=true`);
    } catch (e) {
      if (!/changesNotSentForReview must not be set/.test(e.message)) throw e;
      await api("POST", `edits/${id}:commit`);
    }
    if (PUBLICAR) console.log(`  ✓  ${v.name} (código ${v.code}) PUBLICADA na faixa "${FAIXA}"${FAIXA === "internal" ? ": chega aos testadores internos em minutos" : ": vai para a revisão do Google e depois aos testadores"}`);
    else {
      console.log(`  ✓  ${v.name} (código ${v.code}) é rascunho na faixa "${FAIXA}"`);
      console.log("\n👤 No Play Console: Testar e lançar → a faixa → abrir o rascunho → Avançar → conferir avisos → Salvar e publicar;");
      console.log("   depois Visão geral da publicação → Enviar mudanças para revisão.");
    }
    return true;
  });
}

try {
  if (cmd === "faixas") await faixas();
  else if (cmd === "subir") await subir();
  else {
    console.error(`Comando desconhecido: ${cmd} (faixas · subir)`);
    process.exit(1);
  }
} catch (e) {
  console.error("ERRO: " + e.message);
  process.exit(1);
}
