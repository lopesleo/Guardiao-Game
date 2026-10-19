// Produtos únicos do Play Console pela API (Google Play Developer API v3, monetization.oneTimeProducts):
// o catálogo vive em tools/play/produtos.json (IDs, preços, nomes e descrições nos 8 idiomas da ficha) e
// este script cria, confere, ativa e desativa — em vez de cadastrar à mão no site (8 idiomas × produto).
//
//   node tools/play-produtos.mjs conferir          o catálogo sozinho (tamanhos, idiomas, IDs do config.js); sem rede
//   node tools/play-produtos.mjs listar            o que está no Console (só leitura; testa a credencial)
//   node tools/play-produtos.mjs enviar [ids]      cria o que falta e ativa (o que já existe só é conferido)
//        --atualizar                               reescreve também os que já existem (textos e preços do catálogo)
//        --seco                                    mostra o que faria, sem gravar nada
//   node tools/play-produtos.mjs desativar <ids>   tira da venda (quem comprou continua com o produto)
//   node tools/play-produtos.mjs ativar <ids>      volta à venda
//
// Preço: o base em US$ é convertido pela própria Play Store para cada país (igual ao "Editar preços em massa"
// do Console, impostos incluídos) e o Brasil fica com o valor exato do catálogo (a conversão arredonda: R$ 4,99).
// Produto com "desde" no futuro (Pacote Apoiador) só vai se for pedido pelo ID.
//
// Credencial (👤, uma vez; passo a passo em docs/PLAY_STORE.md): chave JSON de uma conta de serviço com a API
// "Google Play Android Developer" ativada e convidada no Play Console. Fica FORA do git, em
// ~/chaves-android/play-api.json (ou no caminho de PLAY_KEY).
import fs from "node:fs";
import { STORE } from "../src/config.js";
import { PKG, api } from "./play/api.mjs";

const CAT = JSON.parse(fs.readFileSync(new URL("./play/produtos.json", import.meta.url), "utf8"));
const IDIOMAS = ["pt-BR", "en-US", "es-419", "es-ES", "ja-JP", "zh-CN", "zh-TW", "zh-HK"];
const OPCAO = CAT.opcaoDeCompra;

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("--")) || "conferir";
const ids = args.filter((a) => !a.startsWith("--") && a !== cmd);
const SECO = args.includes("--seco");
const ATUALIZAR = args.includes("--atualizar");

const len = (s) => [...s].length;
const money = (v, currencyCode) => ({ currencyCode, units: String(Math.floor(v)), nanos: Math.round((v - Math.floor(v)) * 1e9) });
const num = (m) => (m ? Number(m.units || 0) + (m.nanos || 0) / 1e9 : NaN);
const fmt = (m) => (m ? `${m.currencyCode} ${num(m).toFixed(2).replace(".", ",")}` : "—");
const hoje = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ catálogo (sem rede)
function textos(p) {
  const t = { ...p.textos };
  for (const [l, de] of Object.entries(CAT.copiasDeIdioma || {})) t[l] ??= t[de];
  return IDIOMAS.map((l) => ({ languageCode: l, title: t[l]?.nome, description: t[l]?.descricao }));
}

function conferir() {
  const erros = [];
  if (CAT.pacote !== PKG) erros.push(`o catálogo é de ${CAT.pacote}, a API está em ${PKG}`);
  const noCodigo = [...Object.values(STORE.KITS), ...Object.values(STORE.PACKS).map((p) => p.product)];
  const noCat = CAT.produtos.map((p) => p.id);
  for (const id of noCodigo) if (!noCat.includes(id)) erros.push(`${id}: está no config.js (STORE) e falta no catálogo`);
  for (const id of noCat) if (!noCodigo.includes(id)) erros.push(`${id}: está no catálogo e não no config.js (o jogo não o vende)`);
  for (const p of CAT.produtos) {
    if (!/^[a-z0-9][a-z0-9_.]*$/.test(p.id)) erros.push(`${p.id}: ID inválido`);
    if (!(p.brl >= 0.99 && p.usd >= 0.1)) erros.push(`${p.id}: preço inválido (brl ${p.brl}, usd ${p.usd})`);
    for (const l of textos(p)) {
      if (!l.title || !l.description) erros.push(`${p.id} ${l.languageCode}: falta nome ou descrição`);
      else {
        if (len(l.title) > 55) erros.push(`${p.id} ${l.languageCode}: nome com ${len(l.title)} > 55`);
        if (len(l.description) > 200) erros.push(`${p.id} ${l.languageCode}: descrição com ${len(l.description)} > 200`);
      }
    }
  }
  return erros;
}

// ------------------------------------------------------------------ API (login e chamadas: tools/play/api.mjs)
const listarTodos = async () => {
  const out = [];
  let page = "";
  do {
    const j = await api("GET", `oneTimeProducts?pageSize=200${page ? `&pageToken=${page}` : ""}`);
    out.push(...(j?.oneTimeProducts || []));
    page = j?.nextPageToken || "";
  } while (page);
  return out;
};

// Preço de cada país a partir do base em US$ (a Play Store converte e põe os impostos), Brasil exato
const conversoes = new Map();
async function precos(p) {
  if (!conversoes.has(p.usd)) conversoes.set(p.usd, await api("POST", "pricing:convertRegionPrices", { price: money(p.usd, "USD") }));
  const c = conversoes.get(p.usd);
  const regioes = Object.values(c.convertedRegionPrices || {}).map((r) => ({
    regionCode: r.regionCode,
    price: r.regionCode === "BR" ? money(p.brl, "BRL") : r.price,
    availability: "AVAILABLE",
  }));
  if (!regioes.some((r) => r.regionCode === "BR")) throw new Error("a conversão não trouxe o Brasil");
  return { regioes, outras: c.convertedOtherRegionsPrice, versao: c.regionVersion?.version };
}

const opcao = (prod) => prod?.purchaseOptions?.find((o) => o.purchaseOptionId === OPCAO);
const precoEm = (prod, region) => opcao(prod)?.regionalPricingAndAvailabilityConfigs?.find((r) => r.regionCode === region)?.price;

function resumo(prod) {
  const o = opcao(prod);
  const langs = (prod.listings || []).map((l) => l.languageCode);
  const faltam = IDIOMAS.filter((l) => !langs.includes(l));
  const nome = (prod.listings || []).find((l) => l.languageCode === "pt-BR")?.title ?? "?";
  // "compat" = compatível com versões anteriores (o plugin de compras do jogo só enxerga essa opção)
  return `${prod.productId.padEnd(22)} ${nome.slice(0, 28).padEnd(28)} ${(o?.state || "sem opção").padEnd(9)} ${o?.buyOption?.legacyCompatible ? "compat" : "!compat"} BR ${fmt(precoEm(prod, "BR")).padEnd(11)} US ${fmt(precoEm(prod, "US")).padEnd(10)} ${o?.regionalPricingAndAvailabilityConfigs?.length ?? 0} países  ${langs.length} idiomas${faltam.length ? ` (faltam ${faltam.join(", ")})` : ""}`;
}

// Diferenças entre o que está no Console e o catálogo (para o "enviar" sem --atualizar avisar)
function diferencas(prod, p) {
  const d = [];
  const br = num(precoEm(prod, "BR")),
    us = num(precoEm(prod, "US"));
  if (Math.abs(br - p.brl) > 0.001) d.push(`BR ${br} ≠ ${p.brl}`);
  if (Math.abs(us - p.usd) > 0.001) d.push(`US ${us} ≠ ${p.usd}`);
  for (const l of textos(p)) {
    const n = (prod.listings || []).find((x) => x.languageCode === l.languageCode);
    if (!n) d.push(`falta ${l.languageCode}`);
    else if (n.title !== l.title || n.description !== l.description) d.push(`texto ${l.languageCode} diferente`);
  }
  if (opcao(prod)?.state !== "ACTIVE") d.push(`opção ${opcao(prod)?.state ?? "ausente"}`);
  return d;
}

async function estado(id, ativo) {
  const req = { packageName: PKG, productId: id, purchaseOptionId: OPCAO };
  return api("POST", `oneTimeProducts/${id}/purchaseOptions:batchUpdateStates`, { requests: [ativo ? { activatePurchaseOptionRequest: req } : { deactivatePurchaseOptionRequest: req }] });
}

async function enviar() {
  const alvo = CAT.produtos.filter((p) => (ids.length ? ids.includes(p.id) : !p.desde || p.desde <= hoje()));
  for (const id of ids) if (!CAT.produtos.some((p) => p.id === id)) throw new Error(`${id} não está no catálogo`);
  const pulados = CAT.produtos.filter((p) => !ids.length && p.desde && p.desde > hoje());
  for (const p of pulados) console.log(`  ·  ${p.id}: só a partir de ${p.desde} (peça pelo ID para enviar antes)`);
  for (const p of alvo) {
    const atual = await api("GET", `oneTimeProducts/${p.id}`);
    if (atual && !ATUALIZAR) {
      const d = diferencas(atual, p);
      console.log(`  ${d.length ? "≠ " : "✓ "} ${p.id}: já existe${d.length ? ` — difere do catálogo: ${d.join("; ")} (use --atualizar)` : ", igual ao catálogo"}`);
      continue;
    }
    const pr = await precos(p);
    const corpo = {
      packageName: PKG,
      productId: p.id,
      listings: textos(p),
      purchaseOptions: [
        {
          purchaseOptionId: OPCAO,
          buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
          regionalPricingAndAvailabilityConfigs: pr.regioes,
          newRegionsConfig: { usdPrice: pr.outras.usdPrice, eurPrice: pr.outras.eurPrice, availability: "AVAILABLE" },
        },
      ],
    };
    const br = pr.regioes.find((r) => r.regionCode === "BR").price,
      us = pr.regioes.find((r) => r.regionCode === "US")?.price;
    const oque = `${atual ? "atualiza" : "cria"} ${p.id} — BR ${fmt(br)}, US ${fmt(us)}, ${pr.regioes.length} países, ${corpo.listings.length} idiomas`;
    if (SECO) {
      console.log(`  (seco) ${oque}`);
      continue;
    }
    const q = new URLSearchParams({ allowMissing: "true", updateMask: "listings,purchaseOptions", "regionsVersion.version": pr.versao || "2022/02" });
    // (a rota de gravar é em minúsculas, "onetimeproducts"; a de ler aceita "oneTimeProducts")
    const salvo = await api("PATCH", `onetimeproducts/${p.id}?${q}`, corpo);
    if (opcao(salvo)?.state !== "ACTIVE" && p.ativo !== false) await estado(p.id, true);
    console.log(`  ✓  ${oque} · ativo`);
  }
}

// ------------------------------------------------------------------ comandos
const erros = conferir();
if (erros.length) {
  console.error("Catálogo com problemas:\n  " + erros.join("\n  "));
  process.exit(1);
}
try {
  if (cmd === "conferir") {
    console.log(`Catálogo OK: ${CAT.produtos.length} produtos × ${IDIOMAS.length} idiomas, IDs iguais aos do config.js.`);
    for (const p of CAT.produtos) console.log(`  ${p.id.padEnd(22)} R$ ${p.brl.toFixed(2).replace(".", ",").padEnd(6)} US$ ${p.usd.toFixed(2).replace(".", ",")}${p.desde ? `  (a partir de ${p.desde})` : ""}`);
  } else if (cmd === "listar") {
    const todos = await listarTodos();
    console.log(`${todos.length} produtos no Console (${PKG}):`);
    for (const prod of todos) console.log("  " + resumo(prod));
  } else if (cmd === "enviar") {
    await enviar();
  } else if (cmd === "ativar" || cmd === "desativar") {
    if (!ids.length) throw new Error(`diga quais: node tools/play-produtos.mjs ${cmd} <id> [id…]`);
    for (const id of ids) {
      if (SECO) console.log(`  (seco) ${cmd} ${id}`);
      else {
        await estado(id, cmd === "ativar");
        console.log(`  ✓  ${id}: ${cmd === "ativar" ? "à venda" : "fora da venda (quem comprou continua com ele)"}`);
      }
    }
  } else {
    console.error(`Comando desconhecido: ${cmd} (conferir · listar · enviar · ativar · desativar)`);
    process.exit(1);
  }
} catch (e) {
  console.error("ERRO: " + e.message);
  process.exit(1);
}
