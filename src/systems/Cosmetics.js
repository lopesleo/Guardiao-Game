// Cosméticos da partida — PROTÓTIPO do Kit Ipê-rosa (docs/COSMETICOS.md). Só liga com
// ?debug=1&kit=ipe: nada disto está à venda nem no build da loja.
//
//   Libertação: o corrompido libertado solta pétalas que sobem e caem girando, e uma flor de ipê
//               brota no chão onde ele estava, com um brilho rosa fraco (aparece à noite), e murcha
//               em ~2 s. SOMA ao efeito de morte do elemento (que mostra quem matou); nunca o substitui.
//   Chão:       a pétala que cai fica um pouco no chão — o "tapete de ipê" marca onde se lutou.
//   Rastro:     uma pétala cai atrás dos pés ao andar; no dash, um punhado.
//
// Custo fixo para aparelho fraco: um emissor reaproveitado, pool de flores e teto de efeitos por
// intervalo (matança em massa vira só algumas pétalas, nunca uma nuvem rosa que esconde o combate).
import { DEBUG } from "./Platform.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { PAL } from "../art/Palette.js";

const PX = 3; // = GAME.PIXEL_SCALE
const DEG = 180 / Math.PI;
const D_PETAL = 48600; // como as folhas do WeaponFX (acima do mapa de luz)
const D_BLOOM = -60; // chão (acima das marcas de queimado e geada, abaixo de tudo)
const BLOOMS = 16; // flores no chão ao mesmo tempo
const FALLEN = 48; // pétalas caídas no chão ao mesmo tempo (as mais velhas somem primeiro)
const BLOOM_GAP_MS = 90; // no máximo uma flor nova a cada 90 ms
const PETAL_BUDGET = 14; // pétalas de libertação por janela de 120 ms, somando todas as mortes
const TRAIL_MS = 170;

const KIT = new URLSearchParams(location.search).get("kit");

export class Cosmetics {
  // Uma instância por partida, ou null se não há kit equipado
  static forScene(scene) {
    return DEBUG && KIT === "ipe" ? new Cosmetics(scene) : null;
  }

  constructor(scene) {
    this.scene = scene;
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
      maxAliveParticles: 140,
      // Acabou a queda: a pétala pousa no chão
      deathCallback: (p) => this._land(p.x, p.y, p.angle),
    });
    this.petals.setDepth(D_PETAL);
    this._defSpeed = { min: 50, max: 120 };
    this.blooms = [];
    this.fallen = [];
    this._bloomAt = 0;
    this._win = 0;
    this._budget = PETAL_BUDGET;
    this._trailAt = 0;
    this._wasDashing = false;
  }

  // Aparelho fraco (iluminação desligada) → metade, como o WeaponFX
  get q() {
    return this.scene.lighting?.enabled === false ? 0.5 : 1;
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
    if (!this.scene.cameras.main.worldView.contains(x, y)) return;
    const now = this.scene.time.now;
    if (now - this._win > 120) {
      this._win = now;
      this._budget = PETAL_BUDGET;
    }
    // Orçamento TOTAL de pétalas por janela: com 40 mortes de uma vez virava nuvem rosa por cima das
    // gemas e do baú (visto no protótipo). Esgotado, a morte fica só com o efeito do elemento
    const n = Math.min(big ? 14 : 7, this._budget);
    if (n <= 0) return;
    this._budget -= n;
    this._burst(x, y - 6, n, -Math.PI / 2, big ? 200 : 140);
    if (now - this._bloomAt >= BLOOM_GAP_MS) {
      this._bloomAt = now;
      this._bloom(x, y + 4, big);
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
  _bloom(x, y, big) {
    let b = this.blooms.find((o) => !o.visible);
    if (!b) {
      if (this.blooms.length >= BLOOMS) b = this.blooms.reduce((a, o) => (o._bornAt < a._bornAt ? o : a));
      else {
        b = this.scene.add.image(0, 0, "cos_bloom").setVisible(false).setDepth(D_BLOOM);
        this.blooms.push(b);
      }
    }
    this.scene.tweens.killTweensOf(b);
    const s = PX * (big ? 1.4 : 1) * (0.85 + Math.random() * 0.3);
    b._bornAt = this.scene.time.now;
    b.setPosition(x, y).setScale(0).setAlpha(1).setAngle(Math.random() * 72).setVisible(true);
    // Brilho rosa fraco (o espírito libertado): a flor fica no chão, abaixo do mapa de luz, e sem
    // isto sumiria à noite
    this.scene.lighting?.flash(x, y, big ? 110 : 70, PAL.pink, 2200, 0.5);
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

  // Rastro do guardião (todo quadro, com a partida andando)
  update(time) {
    const p = this.scene.player;
    if (!p?.active || !p.visible) return;
    const feet = p.y + p.displayHeight * 0.4;
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
