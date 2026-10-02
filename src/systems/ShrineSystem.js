// Santuários da Floresta: pontos de interesse espalhados pelo mapa (grande), cada um com uma
// aposta diferente. Dão motivo para EXPLORAR sem tirar o jogador da ação:
//   · Carga     — fique perto até carregar: bônus de dano e velocidade por um tempo
//   · Ganância  — toque: mais moedas e drops, mas mais inimigos por um tempo
//   · Desafio   — toque: elites surgem; derrote todos e ganhe um baú dourado
// Uma seta na borda da tela aponta o santuário não usado mais próximo.
import { SHRINE, GAME, ARENA, INTRO } from "../config.js";
import { Analytics } from "./Analytics.js";
import { Chest } from "../entities/Chest.js";
import { text, vw, vh } from "../ui/Theme.js";
import { CSS } from "../art/Palette.js";

const S = GAME.PIXEL_SCALE;

export class ShrineSystem {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.greedUntil = 0;
    this.challenge = null; // desafio em andamento: { id, shrine, enemies:Set }
    this._challengeSeq = 0;
    this._place();
    // Seta guia (espaço de tela)
    this.arrow = scene.add.graphics().setScrollFactor(0).setDepth(48500);
    this.arrowLabel = text(scene, 0, 0, "", { size: 15, origin: 0.5, stroke: true, strokeW: 4, shadow: false });
    this.arrowLabel.setScrollFactor(0).setDepth(48501);
  }

  get greedActive() {
    return this.scene.time.now < this.greedUntil;
  }

  // Quantidade proporcional à área do mapa; espaçados e longe do ponto de entrada
  _place() {
    const s = this.scene;
    const types = [];
    for (const [type, n] of Object.entries(SHRINE.COUNT)) for (let i = 0; i < n; i++) types.push(type);
    // embaralha
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    const placed = [];
    for (const type of types) {
      let spot = null;
      for (let tries = 0; tries < 80 && !spot; tries++) {
        const x = Phaser.Math.Between(ARENA.minX + 220, ARENA.maxX - 220);
        const y = Phaser.Math.Between(ARENA.minY + 220, ARENA.maxY - 420);
        if (Math.hypot(x, y) < SHRINE.MIN_FROM_CENTER) continue;
        if (Math.abs(x) < INTRO.PATH_HALF + 300 && y > ARENA.maxY - 900) continue; // trilha de entrada
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < SHRINE.MIN_SPACING)) continue;
        spot = { x, y };
      }
      if (!spot) continue;
      placed.push(spot);
      this.list.push(this._make(type, spot.x, spot.y));
    }
  }

  _make(type, x, y) {
    const s = this.scene;
    const def = SHRINE.TYPES[type];
    const root = s.add.container(x, y).setDepth(y + 10000);
    const shadow = s.add.image(0, 2, "px_shadow").setScale(3, 3).setAlpha(0.8);
    const halo = s.add.image(0, -14 * S, "fx_glow").setScale(2.4).setTint(def.color).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    const body = s.add.image(0, 0, "px_shrine").setOrigin(0.5, 1).setScale(S);
    const gem = s.add.image(0, -12 * S, "px_shrine_gem").setScale(S * 0.9).setTint(def.color);
    const ring = s.add.graphics();
    const label = text(s, 0, -26 * S, def.name, { size: 17, color: def.css, origin: 0.5, stroke: true, strokeW: 4, shadow: false }).setVisible(false);
    const hint = text(s, 0, -26 * S + 20, def.hint, { size: 13, color: CSS.muted, origin: 0.5, stroke: true, strokeW: 3, shadow: false }).setVisible(false);
    root.add([shadow, halo, body, gem, ring, label, hint]);
    return { type, def, x, y, root, halo, gem, ring, label, hint, used: false, progress: 0, near: false };
  }

  update(time, dt, player) {
    const s = this.scene;
    if (s.boss) {
      this.arrow.clear();
      this.arrowLabel.setVisible(false);
      return;
    }
    for (const sh of this.list) {
      const near = Math.hypot(player.x - sh.x, player.y - sh.y) < SHRINE.TOUCH_R * 3;
      if (near !== sh.near) {
        sh.near = near;
        sh.label.setVisible(near);
        sh.hint.setVisible(near && !sh.used);
      }
      if (sh.used) {
        sh.ring.clear();
        continue;
      }
      sh.halo.setAlpha(0.35 + Math.sin(time / 300 + sh.x) * 0.15);
      sh.gem.y = -12 * S + Math.sin(time / 500 + sh.y) * 2;
      this._interact(sh, time, dt, player);
    }
    this._updateChallenge();
    this._updateArrow(player);
  }

  _interact(sh, time, dt, player) {
    const d = Math.hypot(player.x - sh.x, player.y - sh.y);
    if (sh.type === "charge") {
      const inside = d < SHRINE.CHARGE_R;
      sh.progress = Phaser.Math.Clamp(sh.progress + (inside ? dt : -dt * 2), 0, SHRINE.CHARGE_MS);
      this._drawRing(sh, sh.progress / SHRINE.CHARGE_MS, inside);
      if (sh.progress >= SHRINE.CHARGE_MS) this._chargeBuff(sh, player);
    } else if (d < SHRINE.TOUCH_R) {
      if (sh.type === "greed") this._greed(sh);
      else if (sh.type === "challenge" && !this.challenge) this._startChallenge(sh);
    }
  }

  _drawRing(sh, pct, active) {
    const g = sh.ring;
    g.clear();
    if (pct <= 0) return;
    g.lineStyle(5, sh.def.color, active ? 0.95 : 0.5);
    g.beginPath();
    g.arc(0, -4, SHRINE.CHARGE_R * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct, false);
    g.strokePath();
  }

  _use(sh) {
    const s = this.scene;
    sh.used = true;
    sh.halo.setAlpha(0.08);
    sh.gem.setTint(0x59606f);
    sh.hint.setVisible(false);
    sh.ring.clear();
    s.lighting?.flash(sh.x, sh.y - 40, 320, sh.def.color, 700, 1);
    s.cameras.main.shake(180, 0.006);
    Analytics.track("shrine_used", { type: sh.type, t: Math.floor(s.elapsedMs / 1000) });
    s._runShrines = (s._runShrines || 0) + 1;
  }

  _chargeBuff(sh, player) {
    const s = this.scene;
    this._use(sh);
    const { DMG, SPEED, MS } = SHRINE.CHARGE_BUFF;
    player._blessingDmgMult *= DMG;
    player.speed *= SPEED;
    s.sound.play("sfx_levelup", { volume: 0.55, rate: 1.2 });
    s._toast?.(`CARGA! +${Math.round((DMG - 1) * 100)}% dano e +${Math.round((SPEED - 1) * 100)}% velocidade`, 2400, sh.def.css);
    s.time.delayedCall(MS, () => {
      player._blessingDmgMult /= DMG;
      player.speed /= SPEED;
    });
  }

  _greed(sh) {
    const s = this.scene;
    this._use(sh);
    this.greedUntil = s.time.now + SHRINE.GREED.MS;
    s.sound.play("sfx_coin_cascade", { volume: 0.6 });
    s._toast?.("GANÂNCIA! Mais moedas e drops, mas mais inimigos", 2800, sh.def.css);
  }

  _startChallenge(sh) {
    const s = this.scene;
    this._use(sh);
    const wave = s.waveIndex();
    const id = ++this._challengeSeq;
    const enemies = new Set();
    const n = SHRINE.CHALLENGE.ELITES + Math.floor(wave / 4);
    const kinds = ["wolf", "goblin", "brute"];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const e = s.enemyPool.acquire();
      e.activate(sh.x + Math.cos(a) * 240, sh.y + Math.sin(a) * 240, kinds[i % kinds.length], wave, true);
      e._challengeId = id;
      enemies.add(e);
    }
    this.challenge = { id, shrine: sh, enemies };
    s.sound.play("sfx_boss_roar", { volume: 0.55, rate: 1.1 });
    s.hud.showBossBanner("DESAFIO! DERROTE OS ELITES", CSS.goldHi);
  }

  _updateChallenge() {
    const c = this.challenge;
    if (!c) return;
    // Inimigos são reaproveitados (pool): só conta quem ainda é DESTE desafio
    for (const e of c.enemies) if (!e.active || e._challengeId !== c.id) c.enemies.delete(e);
    if (c.enemies.size > 0) return;
    const s = this.scene;
    const sh = c.shrine;
    this.challenge = null;
    const chest = new Chest(s, sh.x, sh.y + 70);
    chest.forceKind = "golden";
    s.chests.push(chest);
    s.sound.play("sfx_chest_jackpot", { volume: 0.5 });
    s._toast?.("DESAFIO CUMPRIDO! Um baú dourado surgiu", 2600, sh.def.css);
  }

  // Seta na borda da tela até o santuário não usado mais próximo (some quando já está visível)
  _updateArrow(player) {
    const s = this.scene;
    let best = null;
    let bd = Infinity;
    for (const sh of this.list) {
      if (sh.used) continue;
      const d = Math.hypot(sh.x - player.x, sh.y - player.y);
      if (d < bd) {
        bd = d;
        best = sh;
      }
    }
    this.arrow.clear();
    const view = s.cameras.main.worldView;
    if (!best || (best.x > view.x && best.x < view.right && best.y > view.y && best.y < view.bottom)) {
      this.arrowLabel.setVisible(false);
      return;
    }
    const W = vw(s),
      H = vh(s);
    const m = 60;
    const top = (s.hud?.topBand ?? 100) + 40; // em cima, abaixo do HUD (relógio, chefe)
    const ang = Math.atan2(best.y - player.y, best.x - player.x);
    // Projeta a direção até o retângulo da tela (com margem)
    const cx = W / 2,
      cy = H / 2;
    const dx = Math.cos(ang),
      dy = Math.sin(ang);
    const t = Math.min((cx - m) / Math.abs(dx || 1e-6), (dy < 0 ? cy - top : cy - m) / Math.abs(dy || 1e-6));
    const ax = cx + dx * t,
      ay = cy + dy * t;
    const c = best.def.color;
    this.arrow.fillStyle(0x1a1420, 0.85).fillTriangle(
      ax + Math.cos(ang) * 20, ay + Math.sin(ang) * 20,
      ax + Math.cos(ang + 2.5) * 17, ay + Math.sin(ang + 2.5) * 17,
      ax + Math.cos(ang - 2.5) * 17, ay + Math.sin(ang - 2.5) * 17,
    );
    this.arrow.fillStyle(c, 1).fillTriangle(
      ax + Math.cos(ang) * 15, ay + Math.sin(ang) * 15,
      ax + Math.cos(ang + 2.5) * 12, ay + Math.sin(ang + 2.5) * 12,
      ax + Math.cos(ang - 2.5) * 12, ay + Math.sin(ang - 2.5) * 12,
    );
    this.arrowLabel.setVisible(true).setText(`${best.def.short} ${bd >= 1000 ? (bd / 1000).toFixed(1) + "k" : Math.round(bd / 10) * 10}`).setColor(best.def.css);
    this.arrowLabel.setPosition(ax - dx * 34, ay - dy * 34);
  }

  destroy() {
    this.arrow?.destroy();
    this.arrowLabel?.destroy();
    for (const sh of this.list) sh.root.destroy();
    this.list = [];
  }
}
