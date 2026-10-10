// Configura o servidor oficial do Discord a partir de servidor.mjs, pela API REST (sem dependências).
// Idempotente: procura tudo por nome e só cria/ajusta o que falta ou mudou.
//   node tools/discord/setup.mjs --ver     mostra o que faria, sem mudar nada
//   node tools/discord/setup.mjs           aplica
// Precisa de tools/discord/.env com DISCORD_TOKEN=<token do bot> (fora do git) e do bot no servidor.
import fs from "node:fs";
import path from "node:path";
import { SERVIDOR, CARGOS, CATEGORIAS, MENSAGENS, BOAS_VINDAS, INTEGRACAO } from "./servidor.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const ROOT = path.resolve(HERE, "../..");
const VER = process.argv.includes("--ver");
const ESTADO_F = path.join(HERE, "estado.json");
const estado = fs.existsSync(ESTADO_F) ? JSON.parse(fs.readFileSync(ESTADO_F, "utf8")) : { mensagens: {} };

const env = Object.fromEntries(fs.readFileSync(path.join(HERE, ".env"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const TOKEN = env.DISCORD_TOKEN;
if (!TOKEN) throw new Error("DISCORD_TOKEN ausente em tools/discord/.env");

// ---------------------------------------------------------------- API
const BASE = "https://discord.com/api/v10";
let falso = 0;
async function api(metodo, rota, corpo, { arquivos } = {}) {
  if (VER && metodo !== "GET") {
    console.log(`  [ver] ${metodo} ${rota}${corpo ? " " + JSON.stringify(corpo).slice(0, 160) : ""}`);
    return { id: `VER${++falso}`, features: [], permission_overwrites: [] };
  }
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const opt = { method: metodo, headers: { Authorization: `Bot ${TOKEN}`, "User-Agent": "GuardiaoSetup (lopesleo.github.io, 1.0)", "X-Audit-Log-Reason": "configuracao inicial (tools/discord/setup.mjs)" } };
    if (arquivos) {
      const fd = new FormData();
      fd.append("payload_json", JSON.stringify(corpo));
      arquivos.forEach((f, i) => fd.append(`files[${i}]`, new Blob([fs.readFileSync(f)]), path.basename(f)));
      opt.body = fd;
    } else if (corpo !== undefined) {
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(corpo);
    }
    const r = await fetch(BASE + rota, opt);
    if (r.status === 429) {
      const j = await r.json();
      await new Promise((ok) => setTimeout(ok, (j.retry_after ?? 1) * 1000 + 100));
      continue;
    }
    if (r.status === 204) return null;
    const txt = await r.text();
    const j = txt ? JSON.parse(txt) : null;
    if (!r.ok) {
      const e = new Error(`${metodo} ${rota} → ${r.status}: ${txt.slice(0, 400)}`);
      e.status = r.status;
      throw e;
    }
    return j;
  }
  throw new Error(`${metodo} ${rota}: limite de taxa`);
}

// ---------------------------------------------------------------- permissões
const P = {
  VER: 1n << 10n, ENVIAR: 1n << 11n, REACOES: 1n << 6n, CONECTAR: 1n << 20n,
  ENVIAR_TOPICOS: 1n << 38n, TOPICOS_PUB: 1n << 35n, TOPICOS_PRIV: 1n << 36n,
};
const TIPO = { texto: 0, voz: 2, categoria: 4, anuncios: 5, forum: 15 };

function sobrescritas(cat, guildId, cargo) {
  const ow = [];
  if (cat.privado) {
    ow.push({ id: guildId, type: 0, allow: "0", deny: String(P.VER) });
    for (const nome of cat.privado) ow.push({ id: cargo[nome].id, type: 0, allow: String(P.VER | P.CONECTAR), deny: "0" });
  }
  if (cat.leitura) {
    ow.push({ id: guildId, type: 0, allow: String(P.REACOES), deny: String(P.ENVIAR | P.ENVIAR_TOPICOS | P.TOPICOS_PUB | P.TOPICOS_PRIV) });
    ow.push({ id: cargo["Guardião"].id, type: 0, allow: String(P.ENVIAR | P.ENVIAR_TOPICOS), deny: "0" });
  }
  return ow;
}
const chaveOw = (ow) => JSON.stringify([...(ow || [])].map((o) => [o.id, o.type, String(o.allow), String(o.deny)]).sort());

// ---------------------------------------------------------------- passos
async function main() {
  const guilds = await api("GET", "/users/@me/guilds");
  const g0 = guilds.find((g) => g.name === SERVIDOR);
  if (!g0) {
    const me = await api("GET", "/users/@me");
    console.log(`O bot (${me.username}) não está no servidor "${SERVIDOR}". Adicione pelo link:`);
    console.log(`https://discord.com/oauth2/authorize?client_id=${me.id}&scope=bot&permissions=8`);
    process.exit(1);
  }
  const gid = g0.id;
  let guild = await api("GET", `/guilds/${gid}`);
  console.log(`Servidor: ${guild.name} (${gid}) ${VER ? "— MODO VER (nada é alterado)" : ""}`);

  // 1) cargos
  console.log("\n1. Cargos");
  const roles = await api("GET", `/guilds/${gid}/roles`);
  const cargo = {};
  for (const [nome, c] of Object.entries(CARGOS)) {
    let r = roles.find((x) => x.name === nome);
    if (!r) {
      r = await api("POST", `/guilds/${gid}/roles`, { name: nome, color: c.cor, hoist: c.separado, mentionable: false, permissions: "0" });
      console.log(`  + ${nome}`);
    } else if (r.color !== c.cor || r.hoist !== c.separado) {
      r = await api("PATCH", `/guilds/${gid}/roles/${r.id}`, { color: c.cor, hoist: c.separado });
      console.log(`  ~ ${nome} (cor/separado)`);
    } else console.log(`  = ${nome}`);
    cargo[nome] = r;
  }

  // 2) categorias e canais
  console.log("\n2. Categorias e canais");
  let canais = await api("GET", `/guilds/${gid}/channels`);
  const comunidade = () => (guild.features || []).includes("COMMUNITY");
  const canal = {};
  const ordem = [];
  for (const [ci, cat] of CATEGORIAS.entries()) {
    const ow = sobrescritas(cat, gid, cargo);
    let c = canais.find((x) => x.type === TIPO.categoria && x.name === cat.nome);
    if (!c) {
      c = await api("POST", `/guilds/${gid}/channels`, { name: cat.nome, type: TIPO.categoria, permission_overwrites: ow });
      console.log(`  + categoria ${cat.nome}`);
    } else if (chaveOw(c.permission_overwrites) !== chaveOw(ow)) {
      c = await api("PATCH", `/channels/${c.id}`, { permission_overwrites: ow });
      console.log(`  ~ categoria ${cat.nome} (permissões)`);
    } else console.log(`  = categoria ${cat.nome}`);
    ordem.push({ id: c.id, position: ci });
    for (const [i, ch] of cat.canais.entries()) {
      // anúncios só existem com a Comunidade ligada: até lá, nasce como texto e é convertido depois
      const tipo = ch.tipo === "anuncios" && !comunidade() ? TIPO.texto : TIPO[ch.tipo];
      let x = canais.find((y) => y.name === ch.nome && y.type !== TIPO.categoria);
      const quer = { parent_id: c.id, permission_overwrites: ow };
      if (ch.topico && ch.tipo !== "voz") quer.topic = ch.topico;
      if (!x) {
        x = await api("POST", `/guilds/${gid}/channels`, { name: ch.nome, type: tipo, ...quer });
        console.log(`    + ${ch.tipo} ${ch.nome}`);
      } else {
        const muda = {};
        if (x.parent_id !== c.id) muda.parent_id = c.id;
        if (chaveOw(x.permission_overwrites) !== chaveOw(ow)) muda.permission_overwrites = ow;
        if (quer.topic && x.topic !== quer.topic) muda.topic = quer.topic;
        if (ch.tipo === "anuncios" && comunidade() && x.type !== TIPO.anuncios) muda.type = TIPO.anuncios;
        if (Object.keys(muda).length) {
          x = await api("PATCH", `/channels/${x.id}`, muda);
          console.log(`    ~ ${ch.nome} (${Object.keys(muda).join(", ")})`);
        } else console.log(`    = ${ch.nome}`);
      }
      canal[ch.nome] = x;
      ordem.push({ id: x.id, position: i }); // a categoria já foi ajustada acima (a API só move 1 por vez)
    }
  }
  await api("PATCH", `/guilds/${gid}/channels`, ordem);
  console.log("  ordem dos canais aplicada");

  // 3) Comunidade e configurações do servidor
  console.log("\n3. Comunidade");
  const cfg = {
    verification_level: 2, explicit_content_filter: 2, default_message_notifications: 1, preferred_locale: "pt-BR",
    rules_channel_id: canal["regras"].id, public_updates_channel_id: canal["moderação"].id, system_channel_id: canal["geral"].id,
  };
  if (!comunidade()) {
    guild = await api("PATCH", `/guilds/${gid}`, { ...cfg, features: [...(guild.features || []), "COMMUNITY"] });
    console.log("  + Comunidade ligada (verificação média, filtro de conteúdo para todos, notificações só de menções)");
    if (!VER) {
      const x = await api("PATCH", `/channels/${canal["avisos"].id}`, { type: TIPO.anuncios });
      canal["avisos"] = x;
      console.log("  ~ #avisos virou canal de anúncios");
    }
  } else {
    guild = await api("PATCH", `/guilds/${gid}`, cfg);
    console.log("  = Comunidade já ligada (configurações conferidas)");
  }

  // 4) mensagens fixas
  console.log("\n4. Mensagens");
  const ref = (s) => s.replace(/<#([^>]+)>/g, (m, n) => (canal[n] ? `<#${canal[n].id}>` : m));
  const montar = (m) => ({
    embeds: m.embeds.map((e) => ({
      title: e.title, color: e.color, description: e.description && ref(e.description),
      fields: e.fields?.map((f) => ({ name: f.name, value: ref(f.value) })),
      image: e.image ? { url: `attachment://${e.image}` } : undefined,
      footer: { text: "Guardião da Floresta · roguelite com as lendas do folclore brasileiro" },
    })),
    components: m.botoes ? [{ type: 1, components: m.botoes.map((b) => ({ type: 2, style: 5, label: b.texto, url: b.url })) }] : undefined,
    allowed_mentions: { parse: [] },
  });
  for (const [nome, m] of Object.entries(MENSAGENS)) {
    const ch = canal[nome];
    const corpo = montar(m);
    const arquivos = m.imagem ? [path.join(ROOT, m.imagem)] : undefined;
    let id = estado.mensagens[nome];
    let existe = null;
    if (id) existe = await api("GET", `/channels/${ch.id}/messages/${id}`).catch(() => null);
    if (existe) {
      await api("PATCH", `/channels/${ch.id}/messages/${id}`, { ...corpo, attachments: existe.attachments.map((a) => ({ id: a.id })) });
      console.log(`  ~ #${nome} (editada)`);
    } else {
      const msg = await api("POST", `/channels/${ch.id}/messages`, arquivos ? { ...corpo, attachments: arquivos.map((f, i) => ({ id: i, filename: path.basename(f) })) } : corpo, { arquivos });
      if (!VER) {
        await api("PUT", `/channels/${ch.id}/pins/${msg.id}`);
        estado.mensagens[nome] = msg.id;
      }
      console.log(`  + #${nome} (publicada e fixada)`);
    }
  }

  // 5) tela de boas-vindas
  console.log("\n5. Tela de boas-vindas");
  await api("PATCH", `/guilds/${gid}/welcome-screen`, {
    enabled: true, description: BOAS_VINDAS.descricao,
    welcome_channels: BOAS_VINDAS.canais.map((w) => ({ channel_id: canal[w.canal].id, description: w.texto, emoji_name: w.emoji })),
  });
  console.log("  = configurada");

  // 6) integração (perguntas na entrada)
  console.log("\n6. Integração");
  let seq = 0n;
  const flocos = () => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + seq++);
  const atual = await api("GET", `/guilds/${gid}/onboarding`).catch(() => ({ prompts: [] }));
  const prompts = INTEGRACAO.perguntas.map((q) => {
    const velho = atual.prompts?.find((p) => p.title === q.titulo);
    return {
      id: velho?.id ?? flocos(), type: 0, title: q.titulo, single_select: !q.multipla, required: q.obrigatoria, in_onboarding: true,
      options: q.opcoes.map((o) => ({
        id: velho?.options?.find((v) => v.title === o.titulo)?.id ?? flocos(), title: o.titulo, description: o.descricao ?? null, emoji_name: o.emoji,
        channel_ids: (o.canais || []).map((n) => canal[n].id), role_ids: (o.cargos || []).map((n) => cargo[n].id),
      })),
    };
  });
  try {
    await api("PUT", `/guilds/${gid}/onboarding`, {
      prompts, enabled: true, mode: 0,
      default_channel_ids: INTEGRACAO.padrao.map((n) => canal[n].id),
    });
    console.log(`  = ${prompts.length} perguntas, ${INTEGRACAO.padrao.length} canais padrão`);
  } catch (e) {
    console.log(`  ! não aplicada: ${e.message}`);
  }

  // 7) AutoMod
  console.log("\n7. AutoMod");
  const regras = await api("GET", `/guilds/${gid}/auto-moderation/rules`);
  const alerta = { type: 2, metadata: { channel_id: canal["moderação"].id } };
  const bloquear = (msg) => ({ type: 1, metadata: msg ? { custom_message: msg } : {} });
  const AM = [
    { name: "Palavrões e ofensas", event_type: 1, trigger_type: 4, trigger_metadata: { presets: [1, 2, 3] }, actions: [bloquear("Mensagem bloqueada pelas regras da Clareira."), alerta] },
    { name: "Spam", event_type: 1, trigger_type: 3, actions: [bloquear(), alerta] },
    { name: "Menções em massa", event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: [bloquear(), alerta, { type: 3, metadata: { duration_seconds: 600 } }] },
    { name: "Convites de outros servidores", event_type: 1, trigger_type: 1, trigger_metadata: { regex_patterns: ["discord(app)?\\.(gg|com/invite)/"] }, actions: [bloquear("Divulgação de outros servidores só combinando com a equipe."), alerta] },
  ];
  for (const r of AM) {
    const velho = regras.find((x) => x.name === r.name);
    const corpo = { ...r, enabled: true, exempt_roles: [cargo["Guardião"].id] };
    if (velho) {
      await api("PATCH", `/guilds/${gid}/auto-moderation/rules/${velho.id}`, corpo);
      console.log(`  ~ ${r.name}`);
    } else {
      await api("POST", `/guilds/${gid}/auto-moderation/rules`, corpo);
      console.log(`  + ${r.name}`);
    }
  }

  // 8) convite permanente
  console.log("\n8. Convite");
  const convites = await api("GET", `/guilds/${gid}/invites`);
  let conv = convites.find((i) => i.max_age === 0 && i.max_uses === 0 && i.channel?.id === canal["boas-vindas"].id);
  if (!conv) conv = await api("POST", `/channels/${canal["boas-vindas"].id}/invites`, { max_age: 0, max_uses: 0, unique: false });
  console.log(`  https://discord.gg/${conv.code ?? "(gerado ao aplicar)"}`);
  if (!VER) {
    estado.convite = conv.code;
    fs.writeFileSync(ESTADO_F, JSON.stringify(estado, null, 2));
  }
  console.log("\nPronto.");
}

main().catch((e) => {
  console.error("\nERRO:", e.message);
  process.exit(1);
});
