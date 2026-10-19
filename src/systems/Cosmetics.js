// Cosméticos da partida — PROTÓTIPO do Kit Ipê-rosa (docs/COSMETICOS.md). Só no modo de teste
// (?debug=1): nada disto está à venda nem no build da loja.
//
// Cada PEÇA se equipa à parte no Guarda-roupa (Clareira, botão de teste) — dá para usar só o rastro, só
// a libertação, etc. — e a QUANTIDADE de pétalas é do jogador (discreta, normal, cheia):
//   kill    Libertação: o corrompido libertado solta pétalas que sobem e caem girando, e uma flor de ipê
//           brota no chão onde ele estava, com um brilho rosa fraco (aparece à noite), e murcha em ~2 s.
//           SOMA ao efeito de morte do elemento (que mostra quem matou); nunca o substitui. A pétala que
//           termina a queda pousa no chão: o "tapete de ipê" marca onde se lutou.
//   trail   Rastro: uma pétala cai atrás dos pés ao andar; no dash, um punhado.
//   awaken  Despertar (R): ao despertar, explosão de pétalas e um anel de ipês florescendo em volta do
//           herói; enquanto dura, pétalas sobem de um anel EM VOLTA dele e se afastam (no protótipo, saindo
//           de perto e vivendo muito, elas cobriam o próprio herói). A aura dourada continua (mostra o estado).
// ?kit=ipe equipa tudo de uma vez enquanto nada foi escolhido no Guarda-roupa (atalho para ver o kit).
//
// Custo fixo para aparelho fraco: um emissor reaproveitado, pool de flores e teto de efeitos por
// intervalo (matança em massa vira só algumas pétalas, nunca uma nuvem rosa que esconde o combate).
import { DEBUG } from "./Platform.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { PAL } from "../art/Palette.js";
import { tr } from "../i18n/i18n.js";

const PX = 3; // = GAME.PIXEL_SCALE
const DEG = 180 / Math.PI;
const D_PETAL = 48600; // como as folhas do WeaponFX (acima do mapa de luz)
const D_BLOOM = -60; // chão (acima das marcas de queimado e geada, abaixo de tudo)
const BLOOMS = 20; // flores no chão ao mesmo tempo
const FALLEN = 48; // pétalas caídas no chão ao mesmo tempo (as mais velhas somem primeiro)
const BLOOM_GAP_MS = 90; // no máximo uma flor nova a cada 90 ms
const PETAL_BUDGET = 14; // pétalas de libertação por janela de 120 ms, somando todas as mortes
const TRAIL_MS = 170;
const AWAKE_MS = 140; // pétala subindo enquanto desperto (a quantidade não acelera: o herói não pode sumir)

// ---------------------------------------------------------------- guarda-roupa
const KEY = "guardiao_cosmetics_v1";
export const COSM_SLOTS = [
  { id: "kill", name: tr("Libertação"), hint: tr("Quando um corrompido é libertado"), none: tr("Padrão") },
  { id: "trail", name: tr("Rastro"), hint: tr("Atrás dos pés ao andar e no dash"), none: tr("Nenhum") },
  { id: "awaken", name: tr("Despertar"), hint: tr("Ao despertar e enquanto dura"), none: tr("Padrão") },
];
export const COSM_KITS = { ipe: { name: tr("Ipê-rosa") } };
export const COSM_AMOUNTS = [
  { k: 0.5, name: tr("Discreta") },
  { k: 1, name: tr("Normal") },
  { k: 1.6, name: tr("Cheia") },
];

const KIT = new URLSearchParams(location.search).get("kit");
let worn = null;
function load() {
  if (worn) return worn;
  try {
    worn = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {}
  if (worn) return worn; // o que o jogador escolheu no Guarda-roupa vence o atalho da URL
  worn = { kill: null, trail: null, awaken: null, amount: 1 };
  if (KIT && COSM_KITS[KIT]) for (const s of COSM_SLOTS) worn[s.id] = KIT; // atalho: o kit inteiro
  return worn;
}

export const Wardrobe = {
  get: (slot) => load()[slot] ?? null,
  set(slot, v) {
    load()[slot] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(worn));
    } catch {}
  },
  get amount() {
    return load().amount ?? 1;
  },
  any: () => COSM_SLOTS.some((s) => load()[s.id]),
};

// ---------------------------------------------------------------- efeitos
export class Cosmetics {
  // Uma instância por partida, ou null se nenhuma peça está equipada (ou fora do modo de teste)
  static forScene(scene) {
    return DEBUG && Wardrobe.any() ? new Cosmetics(scene) : null;
  }

  constructor(scene) {
    this.scene = scene;
    this.on = Object.fromEntries(COSM_SLOTS.map((s) => [s.id, Wardrobe.get(s.id) === "ipe"]));
    this.k = COSM_AMOUNTS[Wardrobe.amount]?.k ?? 1;
    registerCosmeticFX(scene);
    this.petals = scene.add.particles(0, 0, "cos_petal", {
      emitting: false,
      speed: { min: 50, max: 120 },
      gravityY: 55,
      lifespan: { min: 1300, max: 2000 },
      rotate: { min: 0, max: 360 },
      scaleY: PX * 0.8,
      // "Bater" da pétala: o lado visível encolhe e volta enquanto ela cai girando
      scaleX: { onEmit: () => PX * 0.8, onUpdate: (p, k, t) => PX * 0.8 * Math.abs(Math.cos(t * 9 + (p._ph ??= Math.random() * 6))) + 0.6 },
      maxAliveParticles: 90, // teto: com 160 virava nuvem em volta do herói no Despertar com "Cheia"
      // Acabou a queda: a pétala pousa no chão
      deathCallback: (p) => this._land(p.x, p.y, p.angle),
    });
    this.petals.setDepth(D_PETAL);
    // Despertar: pétalas curtas que sobem e se afastam (não pousam e não se acumulam sobre o herói)
    this.rise = scene.add.particles(0, 0, "cos_petal", {
      emitting: false,
      speed: { min: 70, max: 120 },
      gravityY: -30,
      lifespan: { min: 550, max: 800 },
      rotate: { min: 0, max: 360 },
      scale: { start: PX * 0.75, end: PX * 0.4 },
      alpha: { start: 1, end: 0 },
      maxAliveParticles: 24,
    });
    this.rise.setDepth(D_PETAL);
    this._defSpeed = { min: 50, max: 120 };
    this.blooms = [];
    this.fallen = [];
    this._bloomAt = 0;
    this._win = 0;
    this._budget = PETAL_BUDGET;
    this._trailAt = 0;
    this._awakeAt = 0;
    this._wasDashing = false;
  }

  // Aparelho fraco (iluminação desligada) → metade, como o WeaponFX; e a quantidade escolhida
  get q() {
    return (this.scene.lighting?.enabled === false ? 0.5 : 1) * this.k;
  }

  // Pétalas num cone (dir em radianos, spread em graus) — mesma volta do WeaponFX.burst no Phaser 4
  _burst(x, y, n, dir = -Math.PI / 2, spread = 120, speed = null) {
    const e = this.petals;
    const count = Math.max(1, Math.round(n * this.q));
    const a = dir * DEG;
    e.ops.angle.loadConfig({ angle: { min: a - spread / 2, max: a + spread / 2 } });
    e.ops.speedX.loadConfig({ speed: speed ?? this._defSpeed }, "speed");
    e.ops.speedY.active = false;
    e.radial = true;
    e.emitParticleAt(x, y, count);
  }

  // Corrompido libertado (chamado logo depois do WeaponFX.kill)
  kill(x, y, big = false) {
    if (!this.on.kill || !this.scene.cameras.main.worldView.contains(x, y)) return;
    const now = this.scene.time.now;
    if (now - this._win > 120) {
      this._win = now;
      this._budget = PETAL_BUDGET;
    }
    // Orçamento TOTAL de pétalas por janela: com 40 mortes de uma vez virava nuvem rosa por cima das
    // gemas e do baú (visto no protótipo). Esgotado, a morte fica só com o efeito do elemento
    let n = Math.min(big ? 14 : 7, this._budget);
    if (n <= 0) return;
    this._budget -= n;
    // Colado no herói: metade das pétalas e jogadas para LONGE dele (o herói nunca some na nuvem)
    const p = this.scene.player,
      dx = x - (p?.x ?? -1e9),
      dy = y - (p?.y ?? -1e9);
    if (dx * dx + dy * dy < 80 * 80) {
      n = Math.ceil(n / 2);
      this._burst(x, y - 6, n, Math.atan2(dy, dx), 90, { min: 80, max: 150 });
    } else this._burst(x, y - 6, n, -Math.PI / 2, big ? 200 : 140);
    if (now - this._bloomAt >= BLOOM_GAP_MS) {
      this._bloomAt = now;
      this._bloom(x, y + 4, big ? 1.4 : 1);
    }
  }

  // Despertar (R): explosão de pétalas e um anel de ipês florescendo em volta do herói
  awaken(x, y) {
    if (!this.on.awaken) return;
    this._burst(x, y - 10, 30, -Math.PI / 2, 360, { min: 140, max: 320 });
    this._bloom(x, y + 2, 2.2, 0);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      // nascem em sequência, como uma onda que sai do herói
      this.scene.time.delayedCall(60 + i * 45, () => this._bloom(x + Math.cos(a) * 92, y + 2 + Math.sin(a) * 60, 1.1));
    }
  }

  // Pétala pousada: fica no chão um pouco e desbota (pool fixo; a mais velha é reaproveitada)
  _land(x, y, angle) {
    if (!this.scene.cameras.main.worldView.contains(x, y)) return;
    let o = this.fallen.find((f) => !f.visible);
    if (!o) {
      if (this.fallen.length >= FALLEN) o = this.fallen.reduce((a, f) => (f._bornAt < a._bornAt ? f : a));
      else {
        o = this.scene.add.image(0, 0, "cos_petal").setVisible(false).setDepth(D_BLOOM - 1);
        this.fallen.push(o);
      }
    }
    this.scene.tweens.killTweensOf(o);
    o._bornAt = this.scene.time.now;
    o.setPosition(x, y).setScale(PX * 0.8, PX * 0.55).setAngle(angle).setAlpha(0.95).setVisible(true);
    this.scene.tweens.add({ targets: o, alpha: 0, delay: 1600 + Math.random() * 1000, duration: 600, onComplete: () => o.setVisible(false) });
  }

  // Flor que brota onde a Podridão saiu: cresce com um pulo, fica um pouco e murcha
  _bloom(x, y, size = 1, jitter = 0.3) {
    let b = this.blooms.find((o) => !o.visible);
    if (!b) {
      if (this.blooms.length >= BLOOMS) b = this.blooms.reduce((a, o) => (o._bornAt < a._bornAt ? o : a));
      else {
        b = this.scene.add.image(0, 0, "cos_bloom").setVisible(false).setDepth(D_BLOOM);
        this.blooms.push(b);
      }
    }
    this.scene.tweens.killTweensOf(b);
    const s = PX * size * (1 - jitter / 2 + Math.random() * jitter);
    b._bornAt = this.scene.time.now;
    b.setPosition(x, y).setScale(0).setAlpha(1).setAngle(Math.random() * 72).setVisible(true);
    // Brilho rosa fraco (o espírito libertado): a flor fica no chão, abaixo do mapa de luz, e sem
    // isto sumiria à noite
    this.scene.lighting?.flash(x, y, 70 * size, PAL.pink, 2200, 0.5);
    this.scene.tweens.add({ targets: b, scale: s, angle: b.angle + 25, duration: 260, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: b,
      scale: s * 0.6,
      alpha: 0,
      delay: 1500 + Math.random() * 500,
      duration: 500,
      ease: "Quad.easeIn",
      onComplete: () => b.setVisible(false),
    });
  }

  // Todo quadro, com a partida andando: rastro, dash e o Despertar em curso
  update(time) {
    const p = this.scene.player;
    if (!p?.active || !p.visible) return;
    const feet = p.y + p.displayHeight * 0.4;
    // Desperto: pétalas sobem em espiral em volta do herói
    if (this.on.awaken && p.isAwakened?.() && time >= this._awakeAt) {
      this._awakeAt = time + AWAKE_MS / Math.min(1, this.q);
      // anel em volta do herói (largo como a aura), girando; cada pétala sai para fora e para cima
      const a = (time / 300) % (Math.PI * 2);
      const out = Math.atan2(Math.sin(a) * 0.6 - 0.8, Math.cos(a));
      this.rise.ops.angle.loadConfig({ angle: { min: out * DEG - 15, max: out * DEG + 15 } });
      this.rise.emitParticleAt(p.x + Math.cos(a) * 44, feet - 6 + Math.sin(a) * 18, 1);
    }
    if (!this.on.trail) return;
    const dashing = p.isDashing?.();
    if (dashing && !this._wasDashing) {
      // Dash: punhado de pétalas jogadas para trás
      this._burst(p.x, feet - 8, 7, Math.atan2(-p.dashDirY, -p.dashDirX), 70, { min: 60, max: 170 });
    }
    this._wasDashing = dashing;
    const v = p.body?.velocity;
    if (!v || Math.hypot(v.x, v.y) < 40 || time < this._trailAt) return;
    this._trailAt = time + TRAIL_MS / this.q;
    const back = Math.atan2(-v.y, -v.x);
    this._burst(p.x + Math.cos(back) * 6, feet, 1, back - Math.PI / 4, 60, { min: 10, max: 35 });
  }
}
