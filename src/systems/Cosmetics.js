// Cosméticos (docs/COSMETICOS.md): só aparência — nenhuma peça muda dano, vida, moedas ou o jogo.
//
//   Catálogo  COSM_SLOTS (libertação, rastro, Despertar) · COSM_KITS (kits pagos: 1 compra = 3 peças) ·
//             COSM_PIECES (4 grátis + 12 pagas). Os efeitos de cada peça estão em CosmeticPieces.js.
//   Wardrobe  o que está equipado em cada parte, a quantidade de pétalas e o que o jogador tem.
//   Cosmetics o motor: liga as peças equipadas num "palco" — a partida (GameHost) ou a prévia do
//             Guarda-roupa (ui/CosmeticStage.js) — e repassa libertação, rastro e Despertar.
//
// Ligado no build da loja só com COSMETICS.ENABLED (config.js); no modo de teste (?debug=1), sempre.
// Peça paga sem a compra (ou estornada) nunca liga, mesmo que esteja salva como equipada.
import { DEBUG } from "./Platform.js";
import { COSMETICS, STORE } from "../config.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { PIECE_FX } from "./CosmeticPieces.js";
import { Billing } from "./Billing.js";
import { tr } from "../i18n/i18n.js";

// ---------------------------------------------------------------- catálogo
export const COSM_SLOTS = [
  { id: "kill", name: tr("Libertação"), hint: tr("Quando um corrompido é libertado"), none: tr("Padrão") },
  { id: "trail", name: tr("Rastro"), hint: tr("Atrás dos pés ao andar e no dash"), none: tr("Nenhum") },
  { id: "awaken", name: tr("Despertar"), hint: tr("Ao despertar e enquanto dura"), none: tr("Padrão") },
];

export const COSM_KITS = {
  ipe: { name: tr("Ipê-rosa"), product: STORE.KITS.ipe, icon: "cos_bloom" },
  paina: { name: tr("Paineira"), product: STORE.KITS.paina, icon: "cos_pod", frame: 2 },
  coruja: { name: tr("Coruja-buraqueira"), product: STORE.KITS.coruja, icon: "cos_owl", frame: 1 },
  junina: { name: tr("Festa Junina"), product: STORE.KITS.junina, icon: "cos_bunting" },
};
for (const [id, k] of Object.entries(COSM_KITS)) k.id = id;

// icon/frame = desenho do cartão; tint = cor do ícone (a bandeirinha é branca e tingida)
export const COSM_PIECES = {
  // Grátis: simples, de todo mundo desde o começo
  sementes: { slot: "kill", name: tr("Sementes"), desc: tr("Sementinhas pulam de quem foi libertado."), icon: "cos_seed" },
  pegadas: { slot: "trail", name: tr("Pegadas"), desc: tr("As marcas dos seus pés ficam no chão."), icon: "cos_print" },
  folhas: { slot: "trail", name: tr("Folhas secas"), desc: tr("Uma folha seca cai a cada passo."), icon: "cos_dryleaf" },
  luar: { slot: "awaken", name: tr("Luar"), desc: tr("O Despertar em prata."), icon: "fx_awaken_aura_luar" },
  // Kit Ipê-rosa
  ipe_kill: { slot: "kill", kit: "ipe", name: tr("Pétalas de ipê"), desc: tr("Pétalas sobem e uma flor de ipê brota no chão."), icon: "cos_bloom" },
  ipe_trail: { slot: "trail", kit: "ipe", name: tr("Rastro de ipê"), desc: tr("Pétalas caem atrás de você e forram o chão."), icon: "cos_petal" },
  ipe_awaken: { slot: "awaken", kit: "ipe", name: tr("Despertar de ipê"), desc: tr("O Despertar em rosa, com um anel de ipês florescendo."), icon: "fx_awaken_aura_ipe" },
  // Kit Paineira (a barriguda solta a paina, o "algodão" que voa com a semente)
  paina_kill: { slot: "kill", kit: "paina", name: tr("Fruto da paineira"), desc: tr("O fruto estala e solta painas que sobem devagar."), icon: "cos_pod", frame: 2 },
  paina_trail: { slot: "trail", kit: "paina", name: tr("Rastro de paina"), desc: tr("Painas se soltam dos seus pés e voam."), icon: "cos_paina" },
  paina_awaken: { slot: "awaken", kit: "paina", name: tr("Despertar de algodão"), desc: tr("O Despertar branco como paina, numa nuvem que sobe."), icon: "fx_awaken_aura_paina" },
  // Kit Coruja-buraqueira
  coruja_kill: { slot: "kill", kit: "coruja", name: tr("Corujinha"), desc: tr("Uma corujinha sai voando de quem foi libertado."), icon: "cos_owl", frame: 1 },
  coruja_trail: { slot: "trail", kit: "coruja", name: tr("Rastro de penas"), desc: tr("Penas descem balançando atrás de você."), icon: "cos_feather" },
  coruja_awaken: { slot: "awaken", kit: "coruja", name: tr("Asas da coruja"), desc: tr("Asas de coruja se abrem atrás de você no Despertar."), icon: "cos_wings" },
  // Kit Festa Junina (bandeirinhas de chita nos tons livres do combate)
  junina_kill: { slot: "kill", kit: "junina", name: tr("Bandeirinhas"), desc: tr("Bandeirinhas de chita caem de quem foi libertado."), icon: "cos_flag", tint: 0xff7eb6 },
  junina_trail: { slot: "trail", kit: "junina", name: tr("Rastro de bandeirinhas"), desc: tr("Uma bandeirinha voa atrás de você."), icon: "cos_flag", frame: 1, tint: 0xe3c37e },
  junina_awaken: { slot: "awaken", kit: "junina", name: tr("Arraiá"), desc: tr("O Despertar de chita, com um varal de bandeirinhas na cabeça."), icon: "cos_bunting" },
};
for (const [id, p] of Object.entries(COSM_PIECES)) p.id = id;
export const piecesOf = (slot) => Object.values(COSM_PIECES).filter((p) => p.slot === slot);
export const kitPieces = (kit) => Object.values(COSM_PIECES).filter((p) => p.kit === kit);
export const COSM_AMOUNTS = [
  { k: COSMETICS.AMOUNTS[0], name: tr("Discreta") },
  { k: COSMETICS.AMOUNTS[1], name: tr("Normal") },
  { k: COSMETICS.AMOUNTS[2], name: tr("Cheia") },
];

// Guarda-roupa disponível? (loja: COSMETICS.ENABLED; modo de teste: sempre)
export const cosmeticsOn = () => COSMETICS.ENABLED || DEBUG;

// ---------------------------------------------------------------- guarda-roupa
const KEY = "guardiao_cosmetics_v1";
const DEV_KEY = "guardiao_cosmetics_dev_v1"; // modo de teste: kits "comprados" na loja simulada
const KIT_PARAM = new URLSearchParams(location.search).get("kit");
let worn = null,
  devOwned = new Set();

function load() {
  if (worn) return worn;
  try {
    worn = JSON.parse(localStorage.getItem(KEY) || "null");
    devOwned = new Set(JSON.parse(localStorage.getItem(DEV_KEY) || "[]"));
  } catch {}
  if (worn) {
    // O protótipo de 19/10 guardava o KIT por parte ("ipe"): vira a peça daquele kit
    let migrated = false;
    for (const s of COSM_SLOTS)
      if (worn[s.id] && !COSM_PIECES[worn[s.id]] && COSM_KITS[worn[s.id]]) {
        if (DEBUG) devOwned.add(worn[s.id]);
        worn[s.id] = `${worn[s.id]}_${s.id}`;
        migrated = true;
      }
    if (migrated) save();
    return worn;
  }
  worn = { kill: null, trail: null, awaken: null, amount: 1 };
  // ?kit=<kit> (modo de teste): equipa o kit inteiro enquanto nada foi escolhido no Guarda-roupa
  if (DEBUG && COSM_KITS[KIT_PARAM]) {
    devOwned.add(KIT_PARAM);
    for (const p of kitPieces(KIT_PARAM)) worn[p.slot] = p.id;
  }
  return worn;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(worn));
    localStorage.setItem(DEV_KEY, JSON.stringify([...devOwned]));
  } catch {}
}

export const Wardrobe = {
  // Peça equipada na parte (id do catálogo) ou null = o padrão do jogo
  get: (slot) => load()[slot] ?? null,
  equip(slot, id) {
    load()[slot] = id;
    save();
  },
  get amount() {
    return load().amount ?? 1;
  },
  setAmount(i) {
    load().amount = i;
    save();
  },
  // O jogador tem o kit? A loja (Billing; estorno tira) ou, no modo de teste, a loja simulada
  ownsKit(kit) {
    load();
    return Billing.ownsKit(kit) || (DEBUG && devOwned.has(kit));
  },
  owns(id) {
    const p = COSM_PIECES[id];
    return !!p && (!p.kit || this.ownsKit(p.kit));
  },
  // Modo de teste: "compra" na loja simulada (sem COSMETICS.SHOP ou fora do app)
  devBuy(kit) {
    load();
    devOwned.add(kit);
    save();
  },
  // O que a partida liga: equipado E que o jogador tem
  active() {
    const out = {};
    for (const s of COSM_SLOTS) {
      const id = this.get(s.id);
      out[s.id] = id && this.owns(id) ? id : null;
    }
    return out;
  },
};

// ---------------------------------------------------------------- palcos
const D_GROUND = -60; // chão (acima das marcas de queimado e geada, abaixo de tudo)
const D_AIR = 48600; // acima do mapa de luz, como as folhas do WeaponFX

// Palco da partida: profundidades do mundo, câmera, mapa de luz e o herói de verdade
export class GameHost {
  constructor(scene) {
    this.scene = scene;
  }
  put(obj, layer) {
    obj.setDepth(layer === "ground" ? D_GROUND : D_AIR);
    return obj;
  }
  behind(obj, p) {
    obj.setDepth(p.depth - 0.4); // atrás do herói e NA FRENTE da aura (-0.5): asas
  }
  hero() {
    return this.scene.player;
  }
  inView(x, y) {
    return this.scene.cameras.main.worldView.contains(x, y);
  }
  light(x, y, r, color, ms, power) {
    this.scene.lighting?.flash(x, y, r, color, ms, power);
  }
  // Aparelho fraco (iluminação desligada) → metade, como o WeaponFX
  get q() {
    return this.scene.lighting?.enabled === false ? 0.5 : 1;
  }
  get now() {
    return this.scene.time.now;
  }
  delay(ms, fn) {
    return this.scene.time.delayedCall(ms, fn);
  }
}

// ---------------------------------------------------------------- motor
function makeCtx(host, k) {
  const cache = new Map();
  let win = -1e9,
    budget = COSMETICS.PETAL_BUDGET;
  return {
    host,
    scene: host.scene,
    k,
    get q() {
      return host.q * k;
    },
    // Orçamento TOTAL de partículas de libertação por janela de 120 ms, somando todas as mortes: com 40
    // mortes de uma vez virava nuvem por cima das gemas e do baú (visto no protótipo do ipê)
    take(n) {
      const now = host.now;
      if (now - win > 120) {
        win = now;
        budget = COSMETICS.PETAL_BUDGET;
      }
      const g = Math.min(n, budget);
      budget -= g;
      return g;
    },
    // Recursos repartidos entre as peças do mesmo kit (o emissor de pétalas da libertação e do rastro)
    shared(key, make) {
      if (!cache.has(key)) cache.set(key, make());
      return cache.get(key);
    },
  };
}

export class Cosmetics {
  // Uma instância por partida, ou null se nada está equipado (ou o Guarda-roupa está desligado)
  static forScene(scene) {
    if (!cosmeticsOn()) return null;
    const eq = Wardrobe.active();
    if (!Object.values(eq).some(Boolean)) return null;
    return new Cosmetics(new GameHost(scene), eq);
  }

  // eq = { kill, trail, awaken } com ids do catálogo (ou null)
  constructor(host, eq, k = COSM_AMOUNTS[Wardrobe.amount]?.k ?? 1) {
    this.host = host;
    registerCosmeticFX(host.scene);
    const ctx = makeCtx(host, k);
    this.pieces = Object.values(eq)
      .filter((id) => id && PIECE_FX[id])
      .map((id) => PIECE_FX[id](ctx));
  }

  // Corrompido libertado (chamado logo depois do WeaponFX.kill)
  kill(x, y, big = false) {
    if (!this.host.inView(x, y)) return;
    for (const p of this.pieces) p.kill?.(x, y, big);
  }
  // Todo quadro, com a partida andando: rastro, dash e o Despertar em curso
  update(time) {
    const h = this.host.hero();
    if (!h?.active || !h.visible) return;
    for (const p of this.pieces) p.update?.(time, h);
  }
  // Despertar (R) acabou de ativar
  awaken(x, y) {
    for (const p of this.pieces) p.awaken?.(x, y);
  }
  // Visual do Despertar (Player.tryActivateAwaken e o laço do Player); null = o dourado do jogo
  get awakenLook() {
    for (const p of this.pieces) if (p.look) return p.look;
    return null;
  }
}
