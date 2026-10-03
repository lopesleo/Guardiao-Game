// Peças comuns das lutas de chefe (Mula, Corpo-Seco, Mapinguari):
//  · Timeline — um golpe em etapas, no relógio do PRÓPRIO chefe (para junto
//    quando ele congela, no hit-stop e na pausa; aviso e acerto nunca se separam);
//  · FightLog — quem acertou quem: dano no herói, "DESVIOU!", e o placar do
//    "desviou de tudo" (bônus no fim da luta);
//  · Hazards — fogo no chão que fica depois do golpe (vive na cena, não no chefe);
//  · WeakSpot — o anel dourado do ponto fraco (chefe EXPOSTO leva mais dano).
// Regras de justiça: ver BOSS_FIGHT em config.js e docs/CHEFES.md.
import { BOSS_FIGHT, PLAYER } from "../config.js";
import { PAL } from "../art/Palette.js";
import { D_TELE, pixelArc } from "../art/Telegraph.js";
import { tr } from "../i18n/i18n.js";

// ---------------------------------------------------------------------------
// Timeline: etapas { ms, enter(), tick(k, dt), exit() } em sequência.
// update(dt) devolve true quando acabou. cancel() roda os cleanups.
// ---------------------------------------------------------------------------
export class Timeline {
  constructor(steps, cleanup) {
    this.steps = steps.filter(Boolean);
    this.i = -1;
    this.t = 0;
    this.cleanup = cleanup;
    this.done = false;
    this._next();
  }
  _next() {
    this.steps[this.i]?.exit?.();
    this.i++;
    this.t = 0;
    if (this.i >= this.steps.length) {
      this.done = true;
      this.cleanup?.();
      return;
    }
    this.steps[this.i].enter?.();
  }
  update(dt) {
    while (!this.done) {
      const st = this.steps[this.i];
      if (st.until) {
        // etapa aberta: dura até until() dizer que acabou (ex.: investida até parar)
        st.tick?.(0, dt);
        if (st.until()) this._next();
        return this.done;
      }
      const left = st.ms - this.t;
      const step = Math.min(dt, left);
      this.t += step;
      st.tick?.(st.ms > 0 ? this.t / st.ms : 1, step);
      if (this.t < st.ms) return false;
      dt -= step;
      this._next();
      if (dt <= 0) return this.done;
    }
    return true;
  }
  cancel() {
    if (this.done) return;
    this.done = true;
    this.cleanup?.();
  }
}

// ---------------------------------------------------------------------------
// FightLog: um por luta. hit() fere o herói; dodged() comemora o desvio.
// ---------------------------------------------------------------------------
export class FightLog {
  constructor(scene, owner) {
    this.scene = scene;
    this.owner = owner;
    this.specials = 0; // golpes tentados
    this.hits = 0; // golpes que acertaram
    this.dodges = 0;
  }

  attempt() {
    this.specials++;
  }

  // Dano de golpe (mult × dano de contato do chefe). Devolve true se acertou.
  // quiet = fogo no chão: passar por ele no Dash não é "esquiva" para comemorar.
  hit(mult, quiet = false) {
    const s = this.scene,
      p = s.player;
    if (!p?.active || s.gameOver) return false;
    const landed = p.takeDamage(this.owner.dmg * mult);
    if (landed) {
      this.hits++;
      if (p.isDead()) s._onGameOver(false);
    } else if (!quiet && this._dashIframes()) this.dodged(true);
    return landed;
  }

  _dashIframes() {
    const p = this.scene.player;
    const now = this.scene.time.now;
    return now < p.dashUntil - PLAYER.DASH_DURATION_MS + PLAYER.DASH_INVULN_MS;
  }

  // Desvio: texto + som + um pouco de Despertar (com folga entre um e outro)
  dodged(viaDash = false) {
    const s = this.scene,
      p = s.player;
    const now = s.time.now;
    if (s._god || now - (this._lastDodge ?? -1e9) < BOSS_FIGHT.DODGE_FEEDBACK_GAP_MS) return;
    this._lastDodge = now;
    this.dodges++;
    p.addAwakenMeter(BOSS_FIGHT.DODGE_AWAKEN);
    const n = s.dmgNumberPool?.acquire();
    n?.show(p.x, p.y - 44, viaDash ? tr("ESQUIVOU!") : tr("DESVIOU!"), "#c8f08c", false);
    s.sound.play("sfx_dodge", { volume: 0.45 });
    s.fx?.ring?.(p.x, p.y, PAL.g6, 10, 46, 260, 1, 0.8);
  }

  get flawless() {
    return this.specials >= BOSS_FIGHT.FLAWLESS_MIN_SPECIALS && this.hits === 0;
  }
}

// ---------------------------------------------------------------------------
// Hazards: fogo no chão. Vive na cena (continua mesmo se o chefe morrer).
// ---------------------------------------------------------------------------
export class Hazards {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  // Labareda: dano por tique a quem pisar. log = FightLog do dono (pode ser null)
  fire(x, y, r, lifeMs, tickMs, dmg, log = null) {
    const s = this.scene;
    const now = s.time.now;
    const flames = [];
    const n = r > 36 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const d = i === 0 ? 0 : r * 0.45;
      const fx = x + Math.cos(a) * d,
        fy = y + Math.sin(a) * d * 0.6;
      const f = s.add.image(fx, fy, i % 2 ? "px_flame1" : "px_flame0").setOrigin(0.5, 1).setScale(3, 0).setDepth(fy + 10000);
      s.tweens.add({ targets: f, scaleY: 3 + Math.random() * 0.8, duration: 120, ease: "Back.easeOut" });
      flames.push(f);
    }
    const glow = s.add.image(x, y, "fx_glow").setScale((r * 2.2) / 64).setTint(PAL.org2).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_TELE - 1);
    this.list.push({ x, y, r, until: now + lifeMs, born: now, lifeMs, tickMs, dmg, next: now + 120, log, flames, glow });
  }

  update(time) {
    if (!this.list.length) return;
    const p = this.scene.player;
    for (const h of this.list) {
      const left = (h.until - time) / h.lifeMs;
      // tremula trocando o quadro; no fim, as chamas abaixam
      const flick = Math.floor(time / 110) % 2;
      h.flames.forEach((f, i) => {
        f.setTexture((i + flick) % 2 ? "px_flame1" : "px_flame0");
        if (left < 0.25) f.scaleY = 3 * Math.max(0, left / 0.25);
      });
      h.glow.setAlpha(0.3 + 0.15 * Math.sin(time / 70 + h.x) * Math.min(1, left * 4));
      if (time >= h.next && p?.active) {
        h.next = time + h.tickMs;
        const dx = p.x - h.x,
          dy = p.y - h.y;
        if (dx * dx + dy * dy < h.r * h.r) {
          if (h.log) h.log.hit(h.dmg, true);
          else if (p.takeDamage(h.dmg) && p.isDead()) this.scene._onGameOver(false);
        }
      }
    }
    const dead = this.list.filter((h) => time >= h.until);
    if (dead.length) {
      for (const h of dead) {
        h.flames.forEach((f) => f.destroy());
        h.glow.destroy();
      }
      this.list = this.list.filter((h) => time < h.until);
    }
  }

  // Luzes do fogo no mapa de luz (Lighting chama)
  lights(add) {
    let n = 0;
    for (const h of this.list) if (n++ < 14) add(h.x, h.y, h.r * 2.6, 0xff7a3c, 0.75);
  }

  clear() {
    for (const h of this.list) {
      h.flames.forEach((f) => f.destroy());
      h.glow.destroy();
    }
    this.list = [];
  }
}

// ---------------------------------------------------------------------------
// WeakSpot: anel dourado girando onde está o ponto fraco + "PONTO FRACO"
// na primeira vez de cada luta. O dano extra fica em owner._exposedUntil.
// ---------------------------------------------------------------------------
export class WeakSpot {
  constructor(scene, owner, offsetY = 0) {
    this.scene = scene;
    this.owner = owner;
    this.offsetY = offsetY;
    this.g = scene.add.graphics().setDepth(D_TELE + 2);
    this._shown = false;
  }

  // offsetY (opcional): onde fica o ponto fraco desta vez (ex.: o olho)
  open(ms, mult = BOSS_FIGHT.EXPOSED_MULT, label = tr("PONTO FRACO!"), offsetY = null) {
    const o = this.owner,
      s = this.scene;
    this.curOffset = offsetY ?? this.offsetY;
    o._exposedUntil = s.time.now + ms;
    o._exposedMult = mult;
    o._exposedMs = ms;
    s.sound.play("sfx_weak", { volume: 0.5 });
    const n = s.dmgNumberPool?.acquire();
    n?.show(o.x, o.y - o.displayHeight * 0.6, label, "#ffe58f", true);
  }

  close() {
    this.owner._exposedUntil = 0;
  }

  update(time) {
    const o = this.owner,
      g = this.g;
    g.clear();
    if (!o.active || !(time < (o._exposedUntil ?? 0))) return;
    const left = (o._exposedUntil - time) / (o._exposedMs || 1);
    const x = o.x,
      y = o.y + (this.curOffset ?? this.offsetY) * (o.scaleY / 3);
    const r = 26 + Math.sin(time / 90) * 3;
    const rot = time / 300;
    // mira de 4 cantos girando + anel que encolhe com o tempo que resta
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      pixelArc(g, x, y, r, a - 0.35, a + 0.35, PAL.yel3, 1);
      pixelArc(g, x, y, r + 4, a - 0.25, a + 0.25, PAL.yel1, 0.9);
    }
    pixelArc(g, x, y, r - 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, 0xffffff, 0.8);
  }

  destroy() {
    this.g?.destroy();
  }
}

// Distância entre o herói e um ponto
export const distTo = (p, x, y) => Math.hypot(p.x - x, p.y - y);

// O herói está dentro da faixa (x,y,ang,len,width)? margem = "raio" do herói
export function inLane(p, x, y, ang, len, width, from = 0, margin = 10) {
  const dx = p.x - x,
    dy = p.y - y;
  const along = dx * Math.cos(ang) + dy * Math.sin(ang);
  const across = -dx * Math.sin(ang) + dy * Math.cos(ang);
  return along >= from - margin && along <= len + margin && Math.abs(across) <= width / 2 + margin;
}

// Diferença angular em (-π, π]
export function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
