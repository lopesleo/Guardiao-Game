// Novidades por notificação (FCM HTTP v1) para quem aceitou no jogo (src/systems/News.js): uma mensagem por
// idioma, no tópico novidades_<idioma>. Cada aviso é um JSON em tools/play/avisos/ com o título e o texto nos 6
// idiomas do jogo; o que já saiu fica em tools/play/avisos/enviados.json (para respeitar o intervalo).
//
//   npm run aviso -- conferir <aviso.json>               confere textos e tamanhos (sem rede)
//   npm run aviso -- validar  <aviso.json>               o Google valida as 6 mensagens sem entregar nada
//   npm run aviso -- enviar   <aviso.json> [--forcar]    envia de verdade para os 6 tópicos
//   npm run aviso -- enviar   <aviso.json> --token=… [--idioma=pt]   só para um aparelho (teste; não registra)
//
// Regras (docs/PLAY_STORE.md, "Novidades por notificação"): no máximo 1 aviso a cada 7 dias, nunca o mesmo
// aviso duas vezes (--forcar passa por cima, só com motivo), e só novidade de verdade (versão, evento,
// conteúdo novo) — nada de "volte a jogar", contagem regressiva ou urgência falsa.
// Credencial: a mesma conta de serviço dos outros scripts (~/chaves-android/play-api.json), com o papel
// "Administrador da API Firebase Cloud Messaging" no projeto do Firebase.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth, keyProject } from "./play/api.mjs";

const LANGS = ["pt", "en", "es", "ja", "zh", "zht"];
const MAX_TITLE = 45; // a barra de notificações corta por volta disso
const MAX_BODY = 160; // recolhida mostra 1 linha; aberta, o texto inteiro
const MIN_DAYS = 7;
const DIR = fileURLToPath(new URL("./play/avisos/", import.meta.url));
const LOG = path.join(DIR, "enviados.json");
// Igual ao AndroidManifest e ao News.js: canal, ícone pequeno e cor
const ANDROID = { channel_id: "novidades", icon: "ic_stat_guardiao", color: "#6AAB4A", tag: "novidades" };

const [cmd, file, ...rest] = process.argv.slice(2);
const flag = (k) => rest.find((a) => a === `--${k}` || a.startsWith(`--${k}=`))?.split("=")[1] ?? (rest.includes(`--${k}`) ? true : null);
if (!["conferir", "validar", "enviar"].includes(cmd) || !file) {
  console.log("Uso: npm run aviso -- conferir|validar|enviar <tools/play/avisos/arquivo.json> [--forcar] [--token=… --idioma=pt]");
  process.exit(2);
}

const len = (s) => [...s].length;
const aviso = JSON.parse(fs.readFileSync(file, "utf8"));
const erros = [];
if (!/^[\w.-]{3,60}$/.test(aviso.id ?? "")) erros.push("id ausente ou com caracteres fora de [A-Za-z0-9_.-]");
for (const l of LANGS) {
  const t = aviso.titulo?.[l],
    b = aviso.texto?.[l];
  if (!t || !b) erros.push(`${l}: falta ${!t ? "título" : "texto"}`);
  else {
    if (len(t) > MAX_TITLE) erros.push(`${l}: título com ${len(t)} caracteres (máx. ${MAX_TITLE})`);
    if (len(b) > MAX_BODY) erros.push(`${l}: texto com ${len(b)} caracteres (máx. ${MAX_BODY})`);
  }
}
const dias = Number(aviso.validade_dias ?? 3);
if (!(dias >= 1 && dias <= 28)) erros.push("validade_dias entre 1 e 28");
for (const l of LANGS) if (aviso.titulo?.[l]) console.log(`  ${l.padEnd(3)} ${aviso.titulo[l]} — ${aviso.texto[l]}`);
if (erros.length) {
  console.error("\nNão dá para enviar:\n  · " + erros.join("\n  · "));
  process.exit(1);
}
console.log(`\n✓ aviso "${aviso.id}": 6 idiomas, tamanhos ok, vale ${dias} dia(s) para quem estiver sem internet`);
if (cmd === "conferir") process.exit(0);

const enviados = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : [];
const token = flag("token");
if (cmd === "enviar" && !token && !flag("forcar")) {
  if (enviados.some((e) => e.id === aviso.id)) {
    console.error(`O aviso "${aviso.id}" já saiu (${enviados.find((e) => e.id === aviso.id).em}). --forcar só com motivo.`);
    process.exit(1);
  }
  const last = enviados.at(-1);
  const gap = last ? (Date.now() - Date.parse(last.em)) / 86400000 : Infinity;
  if (gap < MIN_DAYS) {
    console.error(`O último aviso ("${last.id}") saiu há ${gap.toFixed(1)} dia(s); o mínimo é ${MIN_DAYS}. --forcar só com motivo.`);
    process.exit(1);
  }
}

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${keyProject()}/messages:send`;
const message = (l, target) => ({
  ...target,
  notification: { title: aviso.titulo[l], body: aviso.texto[l] },
  data: { id: aviso.id },
  android: { ttl: `${dias * 86400}s`, collapse_key: "novidades", notification: ANDROID },
});
async function send(l, target, validate) {
  const r = await fetch(FCM_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${await auth(SCOPE)}`, "content-type": "application/json" },
    body: JSON.stringify({ validate_only: validate, message: message(l, target) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const dica = r.status === 403 ? "\n  → a conta de serviço precisa do papel \"Administrador da API Firebase Cloud Messaging\" no projeto (docs/PLAY_STORE.md)" : "";
    throw new Error(`${l}: ${r.status} ${j.error?.message ?? r.statusText}${dica}`);
  }
  return j.name;
}

const validate = cmd === "validar";
const alvos = token ? [[flag("idioma") || "pt", { token }]] : LANGS.map((l) => [l, { topic: `novidades_${l}` }]);
const sent = [];
let falha = null;
for (const [l, target] of alvos) {
  try {
    const name = await send(l, target, validate);
    sent.push(target.topic);
    console.log(`  ${validate ? "✓ válida" : "✓ enviada"}  ${target.topic ?? "aparelho de teste"} (${l})${validate ? "" : "  " + name}`);
  } catch (e) {
    falha = e.message.replace(/ Remediate access.*?\s\./, "");
    break;
  }
}
// O que saiu fica registrado mesmo se um idioma falhou no meio (o intervalo vale a partir daí)
if (cmd === "enviar" && !token && sent.length) {
  enviados.push({ id: aviso.id, em: new Date().toISOString(), topicos: sent, ...(falha ? { incompleto: true } : {}) });
  fs.writeFileSync(LOG, JSON.stringify(enviados, null, 2) + "\n");
  console.log(`\nRegistrado em ${path.relative(process.cwd(), LOG)} (faça o commit).`);
}
if (falha) {
  console.error(`\n✗ ${falha}`);
  process.exit(1);
}
