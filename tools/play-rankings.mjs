// Rankings do Google Play Games pela API de configuração (Play Games Services Publishing API), como os produtos:
// a fonte é tools/play/rankings.json e os IDs criados vão para RANKING.IDS no src/config.js.
//
//   npm run play:rankings -- listar            o que já existe no projeto do Play Games
//   npm run play:rankings -- criar [--seco]    cria os que ainda não têm ID e grava os IDs no config.js
//
// Precisa do ID do projeto do Play Games em android/app/src/main/res/values/games-ids.xml (o mesmo do progresso
// na nuvem; docs/PLAY_STORE.md). O que a API cria fica em RASCUNHO: os testadores do Play Games já veem; para
// todos, 👤 publicar em Play Games Services → Configuração → Publicar. Credencial: a dos outros scripts.
import fs from "node:fs";
import { auth } from "./play/api.mjs";
import { RANKING } from "../src/config.js";

const ROOT = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), "utf8");
const cmd = process.argv[2];
const SECO = process.argv.includes("--seco");
if (!["listar", "criar"].includes(cmd)) {
  console.log("Uso: npm run play:rankings -- listar | criar [--seco]");
  process.exit(2);
}

const appId = read("android/app/src/main/res/values/games-ids.xml").match(/game_services_project_id"[^>]*>\s*(\d*)\s*</)?.[1];
if (!appId) {
  console.error("Sem o ID do projeto do Play Games em android/app/src/main/res/values/games-ids.xml.\nCrie o projeto (docs/PLAY_STORE.md, \"Progresso na nuvem\") e ponha o número lá.");
  process.exit(2);
}
const defs = JSON.parse(read("tools/play/rankings.json")).rankings;
const BASE = `https://www.googleapis.com/games/v1configuration/applications/${appId}/leaderboards`;

async function call(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${await auth()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const dica = r.status === 403 ? "\n  → a conta de serviço precisa de acesso ao Play Games Services deste app na Play Console (Usuários e permissões)" : "";
    throw new Error(`${method} ${r.status} ${j.error?.message ?? r.statusText}${dica}`);
  }
  return j;
}

// Põe o ID na linha "IDS: { score: "", perigo: "" }" do config.js
function setId(src, key, id) {
  return src.replace(/^(\s*IDS: \{.*)$/m, (line) => line.replace(`${key}: ""`, `${key}: "${id}"`));
}

const config = (key, d) => ({
  kind: "gamesConfiguration#leaderboardConfiguration",
  token: `guardiao_${key}`,
  scoreOrder: d.ordem,
  scoreMin: String(d.min ?? 0),
  scoreMax: String(d.max ?? RANKING.SCORE_MAX),
  draft: {
    kind: "gamesConfiguration#leaderboardConfigurationDetail",
    name: {
      kind: "gamesConfiguration#localizedStringBundle",
      translations: Object.entries(d.nomes).map(([locale, value]) => ({ kind: "gamesConfiguration#localizedString", locale, value })),
    },
    scoreFormat: { numberFormatType: "NUMERIC", numDecimalPlaces: 0 },
  },
});

const existing = [];
try {
  for (let page = null; ; ) {
    const j = await call("GET", BASE + (page ? `?pageToken=${page}` : ""));
    existing.push(...(j.items || []));
    if (!(page = j.nextPageToken)) break;
  }
} catch (e) {
  console.error("✗ " + e.message);
  process.exit(1);
}
const nameOf = (l) => l.draft?.name?.translations?.find((t) => t.locale === "pt-BR")?.value ?? l.draft?.name?.translations?.[0]?.value;
if (cmd === "listar") {
  if (!existing.length) console.log("Nenhum ranking no projeto do Play Games ainda.");
  for (const l of existing) console.log(`  ${l.id}  ${nameOf(l)}  (${l.token ?? "sem token"}, ${l.scoreMin}–${l.scoreMax}, ${l.published ? "publicado" : "rascunho"})`);
  for (const [k, id] of Object.entries(RANKING.IDS)) console.log(`  config.js ${k}: ${id || "(vazio)"}`);
  process.exit(0);
}

let cfg = read("src/config.js");
for (const [key, d] of Object.entries(defs)) {
  const same = existing.find((l) => l.token === `guardiao_${key}`);
  let id = RANKING.IDS[key] || same?.id;
  if (id) {
    console.log(`  ·  ${key}: já existe (${id})`);
  } else if (SECO) {
    console.log(`  (seco) criaria ${key}: "${d.nomes["pt-BR"]}", ${d.min ?? 0}–${d.max ?? RANKING.SCORE_MAX}`);
    continue;
  } else {
    const made = await call("POST", BASE, config(key, d)).catch((e) => {
      console.error(`✗ ${key}: ${e.message}`);
      process.exit(1);
    });
    console.log(`  ✓  ${key}: criado (${made.id})`);
    id = made.id;
  }
  // grava o ID em RANKING.IDS (só na linha "IDS: {…}"; o resto do config.js fica como está)
  if (id && !RANKING.IDS[key]) cfg = setId(cfg, key, id);
}
if (!SECO && cfg !== read("src/config.js")) {
  fs.writeFileSync(new URL("src/config.js", ROOT), cfg);
  console.log("\nIDs gravados em RANKING.IDS (src/config.js): faça o commit e gere uma versão nova.");
}
console.log("Rankings criados ficam em rascunho: os testadores do Play Games já veem; para todos, publicar no Console.");
