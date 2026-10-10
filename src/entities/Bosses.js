// Chefes com GOLPES ESPECIAIS próprios (ver docs/CHEFES.md):
//  · Mula sem Cabeça (minichefe): Galope em Chamas, Coice, Chuva de Brasas
//  · Corpo-Seco (minichefe): A Seca, A Terra o Rejeita, Cipós da Podridão
//  · Mapinguari (chefe): Bocarra da Barriga, Grito, Olhar da Podridão (fúria),
//    mais Baque, Raízes, Investida, Leque e Invocação
// Cada chefe tem um "cérebro" (Brain) que escolhe o golpe pela distância e pela
// fase, roda um golpe por vez (Timeline) e respeita as regras de justiça de
// BOSS_FIGHT: aviso com forma própria, fuga só andando, ponto fraco depois.
import { GAME, BOSS, BOSS_FIGHT, ARENA } from "../config.js";
import { PAL } from "../art/Palette.js";
import { ROT } from "../art/Monsters.js";
import {
  ZoneTele, ConeTele, LaneTele, SweepTele, drawGapRing, drawSafeArc,
  shockwave, rootsBurst, summonPulse, pixelLine, D_TELE,
} from "../art/Telegraph.js";
import { Timeline, FightLog, WeakSpot, distTo, inLane, angDiff } from "../systems/BossKit.js";
import { tr } from "../i18n/i18n.js";

const TAU = Math.PI * 2;

// Encurta uma reta para não sair da arena (investidas)
export function clampLen(x, y, ang, len, m = 70) {
  const c = Math.cos(ang),
    s = Math.sin(ang);
  let L = len;
  if (c > 0.001) L = Math.min(L, (ARENA.maxX - m - x) / c);
  if (c < -0.001) L = Math.min(L, (ARENA.minX + m - x) / c);
  if (s > 0.001) L = Math.min(L, (ARENA.maxY - m - y) / s);
  if (s < -0.001) L = Math.min(L, (ARENA.minY + m - y) / s);
  return Math.max(80, L);
}
export const clampPt = (x, y, m = 60) => ({
  x: Math.max(ARENA.minX + m, Math.min(ARENA.maxX - m, x)),
  y: Math.max(ARENA.minY + m, Math.min(ARENA.maxY - m, y)),
});

// ============================================================================
// Base dos cérebros
// ============================================================================
export class Brain {
  constructor(owner, kit, weakOffsetY = 0) {
    this.o = owner;
    this.s = owner.scene;
    this.kit = kit;
    this.phase = 1;
    this.move = null;
    this.last = null;
    this.gap = 1200; // primeiro golpe pouco depois de entrar em cena
    this.log = new FightLog(this.s, owner);
    this.weak = new WeakSpot(this.s, owner, weakOffsetY);
    this._lights = [];
    // Forma do perigo da vez (o mesmo que o aviso mostra): zones/lanes/cone/gap/sweep.
    // Serve ao teste automático de "dá para desviar só andando" (e a um futuro assistente).
    this.threat = null;
    (this.s._bossBrains ||= new Set()).add(this);
  }

  get p() {
    return this.s.player;
  }
  dist() {
    return distTo(this.p, this.o.x, this.o.y);
  }
  angTo() {
    return Math.atan2(this.p.y - this.o.y, this.p.x - this.o.x);
  }
  slow() {
    let k = this.o.statuses?.ice ? 0.5 : 1;
    // amarrado pela Boleadeira: metade do efeito em chefe (nunca fica preso de vez)
    if ((this.o._bindUntil ?? 0) > this.s.time.now) k *= Math.max(0.5, this.o._bindSlow ?? 1);
    return k;
  }
  caption(text) {
    this.s.hud?.bossMove?.(text);
  }
  sfx(key, cfg = {}) {
    this.s.sound.play(key, cfg);
  }

  // Persegue o herói entre um golpe e outro
  chase(speed) {
    const a = this.angTo();
    const sp = speed * this.slow();
    this.o.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);
    this.o.setFlipX(Math.cos(a) < 0);
  }

  // Pode começar golpe? (minichefe: só dentro da tela)
  ready() {
    return this.dist() < BOSS_FIGHT.ENGAGE_DIST;
  }

  // Escolhe o 1º golpe da lista (já filtrada pela distância) que não esteja entre os
  // DOIS últimos: assim todo o repertório aparece, mesmo com o herói sempre na mesma
  // distância. Sem opção nova, ao menos não repete o anterior.
  pick(list) {
    const recent = this.hist ?? [];
    return list.find((m) => !recent.includes(m)) ?? list.find((m) => m !== this.last) ?? list[0];
  }

  // dt real → relógio do chefe (hit-stop desacelera o golpe junto com o mundo)
  update(time, dt) {
    const k = dt * (this.s.tweens.timeScale ?? 1);
    this.weak.update(time);
    this.checkPhase?.();
    if (this.move) {
      if (this.move.update(k)) {
        this.move = null;
        this.gap = this.kit.GAP_MS[this.phase - 1];
      }
      return;
    }
    this.chase(this.speed());
    this.gap -= k;
    if (this.gap <= 0 && this.ready()) {
      const name = this.choose();
      const m = name && this[`m_${name}`]?.();
      if (m) {
        this.move = m;
        this.last = name;
        this.hist = [name, ...(this.hist ?? [])].slice(0, 2);
        if (m.counts !== false) this.log.attempt();
      } else this.gap = 400;
    }
  }

  cancelMove() {
    this.move?.cancel();
    this.move = null;
  }

  lights(add) {
    for (const l of this._lights) add(l.x, l.y, l.r, l.c, l.a);
  }

  dispose() {
    this.cancelMove();
    this.weak.close();
    this.weak.destroy();
    this.s._bossBrains?.delete(this);
  }

  // Ajuda: golpe = Timeline + coisas para destruir no fim (avisos, sprites)
  timeline(steps, bag, onEnd) {
    const tl = new Timeline(steps, () => {
      for (const b of bag) b?.destroy?.();
      bag.length = 0;
      this._lights = [];
      this.threat = null;
      onEnd?.();
    });
    return tl;
  }

  // Pose parada (quadro fixo) e volta para a animação
  pose(frame) {
    this.o.anims.stop();
    this.o.setFrame(frame);
  }
}

// ============================================================================
// MULA SEM CABEÇA — veloz, de fogo. Pune quem fica parado em linha reta.
// ============================================================================
export class MulaBrain extends Brain {
  constructor(owner) {
    super(owner, BOSS_FIGHT.MULA, 0);
  }
  speed() {
    return this.phase === 2 ? 150 : 132;
  }
  checkPhase() {
    if (this.phase === 1 && this.o.hp < this.o.maxHp * 0.5) {
      this.phase = 2;
      this.s.hud?.showBossBanner(this.s.biome?.minis?.alpha?.rage ?? tr("A MULA DISPARA!"), "#ffb36b");
      this.sfx("sfx_boss_roar", { volume: 0.45, rate: 1.2 });
      shockwave(this.s, this.o.x, this.o.y, 140, PAL.org2);
      this.s.fx?.burst("ember", this.o.x, this.o.y - 20, 18);
    }
  }
  choose() {
    const d = this.dist();
    // o coice só existe de perto; galope e brasas de qualquer distância
    if (d < 175) return this.pick(["kick", "embers", "charge"]);
    return this.pick(d < 360 ? ["embers", "charge"] : ["charge", "embers"]);
  }
  restore() {
    const o = this.o;
    o.setVelocity(0, 0);
    o.anims.timeScale = 1;
    if (o.active) o.play({ key: o._moveAnim ?? "alpha_move", startFrame: 0 });
  }
  neck() {
    const o = this.o;
    return { x: o.x + (o.flipX ? -1 : 1) * o.displayWidth * 0.36, y: o.y - o.displayHeight * 0.32 };
  }

  // GALOPE EM CHAMAS: empina, mira (faixa travada), dispara deixando fogo.
  // Fase 2: três galopes seguidos. Depois, ofegante = ponto fraco.
  m_charge() {
    const K = this.kit.CHARGE,
      T = this.kit.TRAIL;
    const o = this.o,
      s = this.s,
      bag = [];
    const n = K.chain[this.phase - 1];
    const steps = [];
    for (let i = 0; i < n; i++) {
      let ang, len, tele, run;
      steps.push({
        ms: i === 0 ? K.windupMs : K.rewindMs,
        enter: () => {
          if (i === 0) this.caption(tr("GALOPE EM CHAMAS"));
          ang = this.angTo();
          len = clampLen(o.x, o.y, ang, K.len);
          o.setVelocity(0, 0);
          o.setFlipX(Math.cos(ang) < 0);
          this.pose(4); // empinada
          tele = new LaneTele(s, o.x, o.y, ang, len, K.width, PAL.org2, 34);
          bag.push(tele);
          this.threat = { lanes: [{ x: o.x, y: o.y, ang, len, w: K.width }] };
          this.sfx("sfx_hooves", { volume: 0.5, rate: 1 + i * 0.08 });
        },
        tick: (k) => {
          tele.draw(k);
          // patas dianteiras "pedalando" no ar: brasas caindo do pescoço
          if (Math.random() < 0.3) {
            const nk = this.neck();
            s.fx?.burst("ember", nk.x, nk.y, 1);
          }
        },
        exit: () => tele.destroy(),
      });
      steps.push({
        enter: () => {
          o.play({ key: o._moveAnim ?? "alpha_move", startFrame: 0 }); // a do bioma (Cabra na Caatinga)
          o.anims.timeScale = 2.2;
          run = { x0: o.x, y0: o.y, lastX: o.x, lastY: o.y, t: 0, hit: false, minD: 1e9 };
          this.sfx("sfx_boss_roar", { volume: 0.3, rate: 1.6 });
          s.cameras.main.shake(120, 0.004);
        },
        tick: (_, dt) => {
          run.t += dt;
          o.setVelocity(Math.cos(ang) * K.speed, Math.sin(ang) * K.speed);
          // rastro de fogo
          if (Math.hypot(o.x - run.lastX, o.y - run.lastY) >= T.every) {
            run.lastX = o.x;
            run.lastY = o.y;
            s.hazards?.fire(o.x - Math.cos(ang) * 18, o.y + o.displayHeight * 0.3, T.r, T.lifeMs, T.tickMs, T.dmg, this.log);
          }
          const d = this.dist();
          run.minD = Math.min(run.minD, d);
          if (!run.hit && d < K.width / 2 + 8) { // = a faixa desenhada
            run.hit = true;
            if (this.log.hit(K.dmg)) this.p.shove?.(Math.cos(ang) * 260, Math.sin(ang) * 260, 220);
          }
        },
        until: () => Math.hypot(o.x - run.x0, o.y - run.y0) >= len || run.t > (len / K.speed) * 1600,
        exit: () => {
          o.setVelocity(0, 0);
          o.anims.timeScale = 1;
          s.fx?.burst("spark", o.x, o.y + 20, 8, null, 360, null, PAL.yel3);
          if (!run.hit && run.minD < 130) this.log.dodged();
        },
      });
    }
    steps.push({
      ms: K.exposedMs,
      enter: () => {
        this.pose(0);
        this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, tr("OFEGANTE!"));
        this.sfx("sfx_drain", { volume: 0.25, rate: 1.6 });
      },
      tick: () => {
        if (Math.random() < 0.25) s.fx?.burst("glow", this.neck().x, this.neck().y, 1, -Math.PI / 2, 40, 30, PAL.s3);
      },
    });
    return this.timeline(steps, bag, () => this.restore());
  }

  // COICE: vira o traseiro para o herói e escoiceia em cone. Sai pelos lados.
  m_kick() {
    const K = this.kit.KICK;
    const o = this.o,
      s = this.s,
      bag = [];
    let ang, tele, wasIn;
    const inCone = () => {
      const d = this.dist();
      if (d > K.range + 10) return false;
      const a = Math.atan2(this.p.y - o.y, this.p.x - o.x);
      return Math.abs(angDiff(a, ang)) <= K.halfAngle + Math.atan2(10, Math.max(1, d));
    };
    const base = o.scaleX;
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption(tr("COICE"));
            ang = this.angTo();
            o.setVelocity(0, 0);
            o.setFlipX(Math.cos(ang) >= 0); // de costas para o herói
            this.pose(0);
            tele = new ConeTele(s, o.x, o.y, ang, K.range, K.halfAngle, PAL.org2);
            bag.push(tele);
            this.threat = { cone: { x: o.x, y: o.y, ang, range: K.range, half: K.halfAngle } };
            wasIn = inCone();
            this.sfx("sfx_hooves", { volume: 0.35, rate: 0.7 });
          },
          tick: (k) => {
            tele.draw(k);
            o.setScale(base * (1 + 0.08 * k), base * (1 - 0.1 * k)); // agacha (carrega)
          },
          exit: () => tele.destroy(),
        },
        {
          ms: 360,
          enter: () => {
            o.setScale(base);
            this.pose(5); // patas traseiras no ar
            this.sfx("sfx_kick", { volume: 0.7 });
            s.cameras.main.shake(140, 0.006);
            const hx = o.x + Math.cos(ang) * 40,
              hy = o.y + Math.sin(ang) * 40;
            s.fx?.burst("spark", hx, hy, 10, ang, 90, 220, PAL.yel3);
            s.fx?.ring?.(hx, hy, PAL.org3, 10, K.range * 0.8, 260, 0.62, 0.9);
            if (inCone()) {
              // empurrão de K.push px (velocidade que decai em 240 ms)
              const v0 = K.push / 0.12;
              if (this.log.hit(K.dmg)) this.p.shove?.(Math.cos(ang) * v0, Math.sin(ang) * v0, 240);
            } else if (wasIn || this.dist() < K.range + 60) this.log.dodged();
          },
        },
        {
          ms: K.exposedMs,
          enter: () => this.weak.open(K.exposedMs),
        },
      ],
      bag,
      () => {
        o.setScale(base);
        this.restore();
      },
    );
  }

  // CHUVA DE BRASAS: a labareda do pescoço cospe brasas que caem em círculos
  // marcados (um no herói, os outros em volta). Deixam fogo no chão.
  m_embers() {
    const K = this.kit.EMBERS,
      T = this.kit.TRAIL;
    const o = this.o,
      s = this.s,
      bag = [];
    const n = K.n[this.phase - 1];
    const targets = [];
    const total = K.windupMs + (n - 1) * K.staggerMs + 60;
    return this.timeline(
      [
        {
          ms: total,
          enter: () => {
            this.caption(tr("CHUVA DE BRASAS"));
            o.setVelocity(0, 0);
            o.setFlipX(this.p.x < o.x);
            this.pose(4);
            this.sfx("sfx_ember", { volume: 0.55 });
            const p = this.p;
            for (let i = 0; i < n; i++) {
              let pt = { x: p.x, y: p.y };
              for (let tries = 0; i > 0 && tries < 24; tries++) {
                const a = Math.random() * TAU,
                  d = 50 + Math.random() * K.spread;
                pt = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
                // nunca encostam: sempre sobra caminho entre dois círculos
                if (targets.every((q) => Math.hypot(q.x - pt.x, q.y - pt.y) > K.r * K.sep)) break;
              }
              pt = clampPt(pt.x, pt.y);
              const tele = new ZoneTele(s, pt.x, pt.y, K.r, PAL.org2);
              const em = s.add.image(o.x, o.y, "px_ember").setScale(3).setDepth(D_TELE + 1).setVisible(false);
              const gl = s.add.image(o.x, o.y, "fx_glow").setScale(0.7).setTint(PAL.org2).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_TELE).setVisible(false);
              bag.push(tele, em, gl);
              targets.push({ ...pt, tele, em, gl, landed: false });
            }
            this.threat = { zones: targets.map((t) => ({ x: t.x, y: t.y, r: K.r })) };
          },
          tick: (k) => {
            const tau = k * total;
            const nk = this.neck();
            this._lights = [];
            targets.forEach((t, i) => {
              if (t.landed) return;
              const ti = (tau - i * K.staggerMs) / K.windupMs;
              if (ti < 0) return t.tele.g?.clear();
              if (ti < 1) {
                t.tele.draw(ti);
                // voo em arco: sai do pescoço na 2ª metade do aviso
                const f = (ti - 0.4) / 0.6;
                if (f > 0) {
                  const x = nk.x + (t.x - nk.x) * f,
                    y = nk.y + (t.y - nk.y) * f - Math.sin(f * Math.PI) * 220;
                  t.em.setVisible(true).setPosition(x, y).setRotation(f * 8);
                  t.gl.setVisible(true).setPosition(x, y);
                  this._lights.push({ x, y, r: 90, c: 0xff8a3c, a: 0.8 });
                }
                return;
              }
              // pousou
              t.landed = true;
              t.tele.destroy();
              t.em.setVisible(false);
              t.gl.setVisible(false);
              s.fx?.burst("ember", t.x, t.y, 10);
              s.fx?.ring?.(t.x, t.y, PAL.org2, 8, K.r, 240, 0.62, 0.9);
              s.lighting?.flash(t.x, t.y, K.r * 2.4, 0xff7a3c, 300, 1);
              this.sfx("sfx_fire_attack", { volume: 0.4, rate: 0.7 + Math.random() * 0.2 });
              const d = distTo(this.p, t.x, t.y);
              if (d < K.r + 8) this.log.hit(K.dmg);
              else if (d < K.r + 70) this.log.dodged();
              s.hazards?.fire(t.x, t.y, K.r * 0.72, K.fireMs, T.tickMs, T.dmg, this.log);
            });
          },
        },
        { ms: 300, enter: () => this.pose(0) },
      ],
      bag,
      () => this.restore(),
    );
  }
}

// ============================================================================
// CORPO-SECO — lento e resistente. Seca a vida de quem fica perto, foge por
// baixo da terra (que o cospe de volta) e prende o chão com cipós.
// ============================================================================
export class SecoBrain extends Brain {
  constructor(owner) {
    super(owner, BOSS_FIGHT.SECO, 0);
  }
  speed() {
    return this.phase === 2 ? 112 : 95;
  }
  checkPhase() {
    if (this.phase === 1 && this.o.hp < this.o.maxHp * 0.5) {
      this.phase = 2;
      this.s.hud?.showBossBanner(tr("A PODRIDÃO O SEGURA DE PÉ!"), "#e8ccff");
      this.sfx("sfx_boss_roar", { volume: 0.45, rate: 0.6 });
      shockwave(this.s, this.o.x, this.o.y, 150, ROT.hot);
    }
  }
  choose() {
    const d = this.dist();
    // a Seca só de perto (de longe seria ponto fraco de graça); a terra e os cipós alcançam longe
    if (d < 240) return this.pick(["drain", "vines", "burrow"]);
    return this.pick(d < 380 ? ["vines", "burrow"] : ["burrow", "vines"]);
  }
  restore() {
    const o = this.o;
    o.setVelocity(0, 0);
    o.setAlpha(1).setVisible(true);
    o.setScale(o._baseScale ?? GAME.PIXEL_SCALE * 1.6);
    if (o._buried) {
      o._buried = false;
      o.contactRadius = this._contact ?? 62;
      o.shadow.setVisible(true);
      if (o.rimColor) o.rim.setVisible(true);
    }
    if (o.active) o.play({ key: o._moveAnim ?? "elder_move", startFrame: 0 });
  }

  // A SECA: ergue os braços; quem fica no círculo tem a vida sugada (ele cura).
  // Fugir do círculo a tempo deixa o Corpo-Seco RESSECADO (ponto fraco).
  m_drain() {
    const K = this.kit.DRAIN;
    const o = this.o,
      s = this.s,
      bag = [];
    const r = K.r * (this.phase === 2 ? 1.15 : 1);
    let tele, tether, everIn = false, nextTick = 0, rest = 0;
    return this.timeline(
      [
        {
          ms: K.warnMs,
          enter: () => {
            this.caption(tr("A SECA"));
            o.setVelocity(0, 0);
            this.pose(2);
            tele = new ZoneTele(s, o.x, o.y, r, PAL.straw2, 0.6);
            this.threat = { zones: [{ x: o.x, y: o.y, r }] };
            tether = s.add.graphics().setDepth(D_TELE + 1);
            bag.push(tele, tether);
            this.sfx("sfx_drain", { volume: 0.5 });
          },
          tick: (k) => tele.draw(k),
        },
        {
          ms: K.channelMs,
          enter: () => {
            nextTick = K.tickMs;
            s.cameras.main.shake(K.channelMs, 0.0015);
          },
          tick: (k, dt) => {
            tele.draw(1);
            tether.clear();
            const p = this.p;
            const inside = distTo(p, o.x, o.y) < r;
            nextTick -= dt;
            if (inside) {
              everIn = true;
              // cordão de vida: do herói até a boca seca, ondulando
              const n = 14;
              for (let i = 0; i < n; i++) {
                const f = i / n,
                  w = Math.sin(f * Math.PI * 3 + s.time.now / 60) * 6;
                const x = p.x + (o.x - p.x) * f,
                  y = p.y + (o.y - 30 - p.y) * f + w;
                tether.fillStyle(i % 2 ? PAL.red2 : ROT.glow, 0.9).fillRect(Math.round(x / 3) * 3 - 1, Math.round(y / 3) * 3 - 1, 3, 3);
              }
              if (nextTick <= 0) {
                nextTick = K.tickMs;
                if (this.log.hit(K.dmg)) {
                  const heal = Math.round(o.dmg * K.dmg * K.heal);
                  o.hp = Math.min(o.maxHp, o.hp + heal);
                  s._showDmg?.(o.x, o.y - 50, heal, "heal");
                  s.fx?.burst("glow", p.x, p.y - 10, 4, null, 360, 60, PAL.red2);
                }
              }
            } else if (nextTick <= 0) nextTick = K.tickMs;
            // poeira seca subindo na borda
            if (Math.random() < 0.4) {
              const a = Math.random() * TAU;
              s.fx?.burst("glow", o.x + Math.cos(a) * r, o.y + Math.sin(a) * r, 1, -Math.PI / 2, 30, 40, PAL.straw2);
            }
          },
        },
        {
          // fugiu do círculo o tempo todo: ele RESSECA (ponto fraco); senão, só um respiro
          enter: () => {
            tele.destroy();
            tether.destroy();
            this.pose(0);
            rest = 300;
            if (!everIn) {
              this.log.dodged();
              this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, tr("RESSECADO!"));
              rest = K.exposedMs;
            }
          },
          tick: (_, dt) => (rest -= dt),
          until: () => rest <= 0,
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // A TERRA O REJEITA: afunda, corre por baixo do chão atrás do herói (mais
  // devagar que ele), para, avisa — e a terra o CUSPE. Caído = ponto fraco.
  m_burrow() {
    const K = this.kit.BURROW;
    const o = this.o,
      s = this.s,
      bag = [];
    const base = o._baseScale ?? GAME.PIXEL_SCALE * 1.6;
    let mound, moundGlow, cracks, tele, last, wasNear;
    const footY = () => o.y + o.displayHeight * 0.4;
    return this.timeline(
      [
        {
          ms: K.sinkMs,
          enter: () => {
            this.caption(tr("A TERRA O REJEITA"));
            o.setVelocity(0, 0);
            this.pose(2);
            this.sfx("sfx_rumble", { volume: 0.55 });
          },
          tick: (k) => {
            o.setScale(base * (1 + 0.15 * k), base * (1 - 0.85 * k));
            o.setAlpha(1 - k * k);
            if (Math.random() < 0.5) s.fx?.burst("glow", o.x + (Math.random() - 0.5) * 50, footY(), 1, -Math.PI / 2, 60, 50, PAL.n3);
          },
          exit: () => {
            this._contact = o.contactRadius;
            o.contactRadius = 0;
            o._buried = true;
            o.setVisible(false);
            o.shadow.setVisible(false);
            o.rim.setVisible(false);
            mound = s.add.image(o.x, footY(), "px_mound").setScale(4).setOrigin(0.5, 1).setDepth(footY() + 10000);
            // brilho da Podridão por cima do mapa de luz: no escuro dá para ver de onde ele vem
            moundGlow = s.add.image(o.x, footY(), "fx_glow").setScale(1.6, 0.9).setTint(ROT.hot).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_TELE - 1);
            cracks = s.add.graphics().setDepth(D_TELE - 2);
            bag.push(mound, moundGlow, cracks);
            last = { x: o.x, y: footY() };
          },
        },
        {
          ms: K.travelMs,
          enter: () => (this.threat = { chase: { x: o.x, y: o.y } }),
          tick: (k, dt) => {
            const a = this.angTo();
            o.setVelocity(Math.cos(a) * K.speed, Math.sin(a) * K.speed);
            const fy = footY();
            mound.setPosition(o.x + Math.sin(s.time.now / 40) * 2, fy).setDepth(fy + 10000);
            moundGlow.setPosition(o.x, fy - 6).setAlpha(0.45 + Math.sin(s.time.now / 90) * 0.15);
            this._lights = [{ x: o.x, y: fy, r: 110, c: 0xb0308a, a: 0.6 }];
            if (Math.hypot(o.x - last.x, fy - last.y) > 18) {
              // rachadura grossa: bordas escuras + miolo aceso
              const a = Math.atan2(fy - last.y, o.x - last.x),
                nx = -Math.sin(a) * 3,
                ny = Math.cos(a) * 3;
              pixelLine(cracks, last.x + nx, last.y + ny, o.x + nx, fy + ny, ROT.mid, 0.9);
              pixelLine(cracks, last.x - nx, last.y - ny, o.x - nx, fy - ny, ROT.mid, 0.9);
              pixelLine(cracks, last.x, last.y, o.x, fy, ROT.glow, 1);
              last = { x: o.x, y: fy };
              s.fx?.burst("glow", o.x, fy, 3, -Math.PI / 2, 100, 80, PAL.n4);
            }
          },
        },
        {
          ms: K.warnMs,
          enter: () => {
            o.setVelocity(0, 0);
            tele = new ZoneTele(s, o.x, footY(), K.r, PAL.red2);
            bag.push(tele);
            this.threat = { zones: [{ x: o.x, y: footY(), r: K.r }] };
            wasNear = distTo(this.p, o.x, footY()) < K.r + 40;
            this.sfx("sfx_rumble", { volume: 0.4, rate: 1.4 });
          },
          tick: (k) => {
            tele.draw(k);
            mound.x = o.x + (Math.random() - 0.5) * 6 * k; // treme antes de estourar
            cracks.setAlpha(1 - k * 0.7);
          },
          exit: () => tele.destroy(),
        },
        {
          ms: 300,
          enter: () => {
            const fy = footY();
            mound.destroy();
            moundGlow.destroy();
            cracks.destroy();
            this._lights = [];
            o.setVisible(true).setAlpha(1);
            this.pose(2);
            o.setScale(base * 0.8, base * 1.35);
            shockwave(s, o.x, fy, K.r, PAL.n4);
            s.fx?.burst("shard", o.x, fy - 10, 14);
            s.cameras.main.shake(220, 0.01);
            this.sfx("sfx_erupt", { volume: 0.7 });
            const d = distTo(this.p, o.x, fy);
            if (d < K.r + 8) this.log.hit(K.dmg);
            else if (wasNear || d < K.r + 80) this.log.dodged();
            o.contactRadius = this._contact ?? 62;
            o._buried = false;
            o.shadow.setVisible(true);
            if (o.rimColor) o.rim.setVisible(true);
          },
          tick: (k) => o.setScale(base * (0.8 + 0.2 * k), base * (1.35 - 0.35 * k)),
        },
        {
          ms: K.exposedMs,
          enter: () => {
            o.setScale(base);
            this.pose(0);
            this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, tr("CUSPIDO PELA TERRA!"));
          },
          tick: () => o.setAngle(Math.sin(s.time.now / 50) * 4), // cambaleia
          exit: () => o.setAngle(0),
        },
      ],
      bag,
      () => {
        o.setAngle(0);
        this.restore();
      },
    );
  }

  // CIPÓS DA PODRIDÃO: bate as mãos no chão; cipós rasgam o chão em cruz,
  // mirando o herói. Fase 2: uma segunda cruz em X logo depois.
  m_vines() {
    const K = this.kit.VINES;
    const o = this.o,
      s = this.s,
      bag = [];
    const waves = [];
    const mkWave = (base) => {
      const lanes = [0, 1, 2, 3].map((i) => {
        const ang = base + (i * Math.PI) / 2;
        return { ang, len: clampLen(o.x, o.y, ang, K.len, 40) };
      });
      const w = { lanes, teles: [], hit: false, wasIn: false, front: 0, sprites: [] };
      waves.push(w);
      return w;
    };
    const inAny = (w, front = 1e9) => w.lanes.some((l) => inLane(this.p, o.x, o.y, l.ang, Math.min(l.len, front), K.width, 24));
    const showTele = (w) => {
      w.teles = w.lanes.map((l) => new LaneTele(s, o.x, o.y, l.ang, l.len, K.width, ROT.hot, 36));
      bag.push(...w.teles);
      const lanes = w.lanes.map((l) => ({ x: o.x, y: o.y, ang: l.ang, len: l.len, w: K.width }));
      this.threat = { lanes: [...(this.threat?.lanes ?? []), ...lanes] };
      w.wasIn = inAny(w);
    };
    const erupt = (w) => {
      w.teles.forEach((t) => t.destroy());
      s.cameras.main.shake(160, 0.006);
      this.sfx("sfx_vines", { volume: 0.6 });
      for (const l of w.lanes) {
        for (let d = 36; d < l.len; d += 30) {
          const x = o.x + Math.cos(l.ang) * d + (Math.random() - 0.5) * 10,
            y = o.y + Math.sin(l.ang) * d + (Math.random() - 0.5) * 10;
          const v = s.add.image(x, y + 14, "px_vine").setOrigin(0.5, 1).setScale(3, 0).setFlipX(Math.random() < 0.5).setDepth(y + 10014);
          s.tweens.add({ targets: v, scaleY: 3 + Math.random() * 1.2, delay: (d / l.len) * 200, duration: 110, ease: "Back.easeOut" });
          bag.push(v);
          w.sprites.push(v);
        }
      }
    };
    const resolve = (w) => {
      if (this.threat?.lanes) this.threat = { lanes: this.threat.lanes.filter((l) => !w.lanes.some((q) => q.ang === l.ang)) };
      w.sprites.forEach((v) => s.tweens.add({ targets: v, scaleY: 0, alpha: 0, duration: 200, onComplete: () => v.destroy() }));
      if (!w.hit && w.wasIn) this.log.dodged();
    };
    const live = (w) => ({
      ms: K.liveMs,
      enter: () => erupt(w),
      tick: (k) => {
        w.front = Math.min(1, k * (K.liveMs / 220)) * K.len;
        if (!w.hit && inAny(w, w.front)) {
          w.hit = true;
          this.log.hit(K.dmg);
        }
      },
      exit: () => resolve(w),
    });
    const base = this.angTo();
    const w1 = mkWave(base);
    const steps = [
      {
        ms: K.windupMs,
        enter: () => {
          this.caption(tr("CIPÓS DA PODRIDÃO"));
          o.setVelocity(0, 0);
          this.pose(2);
          showTele(w1);
          this.sfx("sfx_rumble", { volume: 0.35, rate: 1.8 });
        },
        tick: (k) => w1.teles.forEach((t) => t.draw(k)),
        exit: () => this.pose(0),
      },
    ];
    if (this.phase === 2) {
      // a 2ª cruz aparece enquanto a 1ª rasga o chão: ler as duas de uma vez
      const w2 = mkWave(base + Math.PI / 4);
      const lead = K.liveMs;
      const rest = Math.max(380, K.windupMs - lead);
      steps.push({
        ms: lead,
        enter: () => {
          erupt(w1);
          showTele(w2);
        },
        tick: (k) => {
          w1.front = Math.min(1, k * (lead / 220)) * K.len;
          if (!w1.hit && inAny(w1, w1.front)) {
            w1.hit = true;
            this.log.hit(K.dmg);
          }
          w2.teles.forEach((t) => t.draw((k * lead) / (lead + rest)));
        },
        exit: () => resolve(w1),
      });
      steps.push({
        ms: rest,
        enter: () => this.pose(2),
        tick: (k) => w2.teles.forEach((t) => t.draw((lead + k * rest) / (lead + rest))),
        exit: () => this.pose(0),
      });
      steps.push(live(w2));
    } else steps.push(live(w1));
    steps.push({ ms: 350 });
    return this.timeline(steps, bag, () => this.restore());
  }
}

// ============================================================================
// MAPINGUARI — o chefe. Fase 1 ensina; na FÚRIA (abaixo de 50%) o olho único
// varre a mata e os golpes ficam mais juntos. A boca na barriga é o ponto fraco
// (na lenda, só se fere o Mapinguari pelo umbigo).
// ============================================================================
export class MapiBrain extends Brain {
  constructor(owner) {
    super(owner, BOSS_FIGHT.MAPI, 13);
    this.gap = 1600;
    this.r1 = ["maw", "slam", "summon", "roots", "scream"];
    this.r2 = ["scream", "lunge", "gaze", "maw", "fan", "roots", "slam"];
    this.ri = 0;
  }
  speed() {
    return this.o.speed;
  }
  ready() {
    return true;
  }
  choose() {
    const rot = this.phase === 1 ? this.r1 : this.r2;
    const d = this.dist();
    for (let tries = 0; tries < rot.length; tries++) {
      const m = rot[this.ri++ % rot.length];
      if (m === this.last) continue;
      if (m === "slam" && d > 240) continue; // baque é golpe de perto
      if (m === "maw" && d > 420) continue; // longe demais para a sucção ser ameaça
      return m;
    }
    return "scream";
  }
  frame(kind) {
    const fury = this.phase === 2;
    return { maw: fury ? 7 : 5, scream: fury ? 8 : 6, idle: fury ? 2 : 0 }[kind];
  }
  restore() {
    const o = this.o;
    o.setVelocity(0, 0);
    o.setScale(o._bossScale);
    if (o.active) o.play(this.phase === 2 ? "boss_fury" : "boss_idle");
  }
  dmgMult() {
    return this.s.diff?.dmgMult ?? 1;
  }

  // BAQUE: ergue os braços e bate no chão em volta de si
  m_slam(cx, cy, r = this.kit.SLAM.r, windup = this.kit.SLAM.windupMs, mult = this.kit.SLAM.dmg, label = tr("BAQUE")) {
    const o = this.o,
      s = this.s,
      bag = [];
    const self = cx == null;
    let tele, wasIn;
    return this.timeline(
      [
        {
          ms: windup,
          enter: () => {
            if (label) this.caption(label);
            if (self) {
              cx = o.x;
              cy = o.y;
              o.setVelocity(0, 0);
              this.pose(this.frame("scream"));
            }
            tele = new ZoneTele(s, cx, cy, r, PAL.org2, self ? 0.6 : 1);
            bag.push(tele);
            if (self) this.threat = { zones: [{ x: cx, y: cy, r }] };
            wasIn = distTo(this.p, cx, cy) < r + 40;
          },
          tick: (k) => {
            tele.draw(k);
            if (self) o.setScale(o._bossScale * (1 - 0.04 * k), o._bossScale * (1 + 0.08 * k));
          },
          exit: () => tele.destroy(),
        },
        {
          ms: 380,
          enter: () => {
            if (self) {
              o.setScale(o._bossScale * 1.1, o._bossScale * 0.9);
              this.pose(this.frame("idle"));
            }
            shockwave(s, cx, cy, r, PAL.org2);
            s.cameras.main.shake(200, 0.009);
            this.sfx("sfx_erupt", { volume: 0.6, rate: 0.8 });
            const d = distTo(this.p, cx, cy);
            if (d < r + 6) this.log.hit(mult);
            else if (wasIn || d < r + 70) this.log.dodged();
          },
          tick: (k) => self && o.setScale(o._bossScale * (1.1 - 0.1 * k), o._bossScale * (0.9 + 0.1 * k)),
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // RAÍZES: marca o chão sob o herói. Ficou? Preso, e o baque vem em cima.
  // JUSTIÇA: as raízes só "agarram" (deixam lento) quem tem o Dash pronto —
  // sem Dash, andar para fora do círculo sempre dá tempo.
  m_roots() {
    const K = this.kit.ROOTS;
    const s = this.s,
      bag = [];
    let px, py, tele, combo = null;
    return this.timeline(
      [
        {
          ms: K.warnMs,
          enter: () => {
            this.caption(tr("RAÍZES"));
            px = this.p.x;
            py = this.p.y;
            tele = new ZoneTele(s, px, py, K.r, PAL.g6);
            bag.push(tele);
            this.threat = { zones: [{ x: px, y: py, r: K.r }] };
            rootsBurst(s, px, py, K.r * 0.5, K.warnMs);
          },
          tick: (k) => {
            tele.draw(k);
            const p = this.p;
            if (distTo(p, px, py) <= K.r && p.dashReady?.()) p.grabSlow(120);
          },
          exit: () => tele.destroy(),
        },
        {
          enter: () => {
            const p = this.p;
            if (distTo(p, px, py) <= K.r) {
              p.root(K.rootMs);
              this.log.hits++; // preso conta como acerto (perdeu o "desviou de tudo")
              this.sfx("sfx_boss_roar", { volume: 0.4, rate: 1.5 });
              rootsBurst(s, p.x, p.y, 60, K.rootMs);
              combo = this.m_slam(p.x, p.y, 80, K.slamDelayMs, 0.6, null);
            } else this.log.dodged();
          },
          tick: (_, dt) => combo?.update(dt),
          until: () => !combo || combo.done,
          exit: () => combo?.cancel(),
        },
      ],
      bag,
      () => {
        combo?.cancel();
        this.restore();
      },
    );
  }

  // INVESTIDA: faixa travada na direção do herói; depois fica ATOLADO
  m_lunge() {
    const K = this.kit.LUNGE;
    const o = this.o,
      s = this.s,
      bag = [];
    let ang, len, tele, run;
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption(tr("INVESTIDA"));
            ang = this.angTo();
            len = clampLen(o.x, o.y, ang, K.len);
            o.setVelocity(0, 0);
            o.setFlipX(Math.cos(ang) < 0);
            tele = new LaneTele(s, o.x, o.y, ang, len, K.width, PAL.red2, 50);
            bag.push(tele);
            this.threat = { lanes: [{ x: o.x, y: o.y, ang, len, w: K.width }] };
          },
          tick: (k) => {
            tele.draw(k);
            o.x += (Math.random() - 0.5) * 2 * k; // treme carregando
          },
          exit: () => tele.destroy(),
        },
        {
          enter: () => {
            run = { x0: o.x, y0: o.y, t: 0, hit: false, minD: 1e9 };
            this.sfx("sfx_boss_roar", { volume: 0.5, rate: 1.1 });
          },
          tick: (_, dt) => {
            run.t += dt;
            o.setVelocity(Math.cos(ang) * K.speed, Math.sin(ang) * K.speed);
            const d = this.dist();
            run.minD = Math.min(run.minD, d);
            if (!run.hit && d < K.width / 2 + 8) { // = a faixa desenhada (+ o corpo do herói)
              run.hit = true;
              if (this.log.hit(K.dmg)) this.p.shove?.(Math.cos(ang) * 300, Math.sin(ang) * 300, 220);
            }
            if (Math.random() < 0.5) s.fx?.burst("glow", o.x, o.y + 40, 1, null, 360, 40, PAL.n3);
          },
          until: () => Math.hypot(o.x - run.x0, o.y - run.y0) >= len || run.t > (len / K.speed) * 1600,
          exit: () => {
            o.setVelocity(0, 0);
            shockwave(s, o.x, o.y + 30, 90, PAL.n4);
            s.cameras.main.shake(160, 0.007);
            if (!run.hit && run.minD < 150) this.log.dodged();
          },
        },
        {
          ms: K.exposedMs,
          enter: () => this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, tr("ATOLADO!")),
          tick: () => this.o.setAngle(Math.sin(s.time.now / 45) * 3),
          exit: () => this.o.setAngle(0),
        },
      ],
      bag,
      () => {
        o.setAngle(0);
        this.restore();
      },
    );
  }

  // BOCARRA DA BARRIGA: a boca abre e PUXA. Ao fechar, morde quem estiver no
  // círculo. Enquanto aberta é o PONTO FRACO (a lenda: só se fere pelo umbigo).
  m_maw() {
    const K = this.kit.MAW;
    const o = this.o,
      s = this.s,
      bag = [];
    let tele, motes;
    const mouth = () => ({ x: o.x, y: o.y + 13 * (o.scaleY / 3) });
    return this.timeline(
      [
        {
          ms: K.openMs,
          enter: () => {
            this.caption(tr("BOCARRA DA BARRIGA"));
            o.setVelocity(0, 0);
            this.pose(this.frame("maw"));
            tele = new ZoneTele(s, o.x, o.y, K.r, PAL.red2, 0.35);
            this.threat = { zones: [{ x: o.x, y: o.y, r: K.r }] };
            motes = [];
            bag.push(tele);
            this.weak.open(K.openMs + K.inhaleMs, K.exposedMult, tr("A BOCA É O PONTO FRACO!"));
            this.sfx("sfx_inhale", { volume: 0.55 });
          },
          tick: (k) => {
            tele.draw(k * 0.2);
            o.setScale(o._bossScale * (1 + 0.06 * k));
          },
        },
        {
          ms: K.inhaleMs,
          tick: (k, dt) => {
            tele.draw(0.2 + k * 0.8);
            const p = this.p,
              m = mouth();
            const a = Math.atan2(m.y - p.y, m.x - p.x);
            if (!p.isDashing?.()) p.addPull?.(Math.cos(a) * K.pull, Math.sin(a) * K.pull);
            // folhas e poeira sendo sugadas (de fora para a boca)
            if (motes.length < 26 && Math.random() < 0.7) {
              const ma = Math.random() * TAU,
                md = 220 + Math.random() * 160;
              const im = s.add.image(m.x + Math.cos(ma) * md, m.y + Math.sin(ma) * md, "px_puff")
                .setScale(1.5).setTint(Math.random() < 0.5 ? PAL.g5 : PAL.cream).setAlpha(0.85).setDepth(D_TELE + 1);
              motes.push(im);
              bag.push(im);
            }
            for (const im of motes) {
              if (!im.active) continue;
              const dx = m.x - im.x,
                dy = m.y - im.y,
                L = Math.hypot(dx, dy);
              if (L < 14) {
                im.setVisible(false);
                im.active = false;
                continue;
              }
              const v = (Math.min(520, 120 + 60000 / L) * dt) / 1000;
              im.x += (dx / L) * v;
              im.y += (dy / L) * v;
              im.rotation += 0.2;
            }
            this._lights = [{ x: m.x, y: m.y, r: 140, c: 0xff3050, a: 0.8 }];
            o.setScale(o._bossScale * (1.06 + Math.sin(s.time.now / 60) * 0.015));
          },
          exit: () => tele.destroy(),
        },
        {
          ms: 420,
          enter: () => {
            this.weak.close();
            this.pose(this.frame("idle"));
            o.setScale(o._bossScale * 1.12, o._bossScale * 0.9);
            this.sfx("sfx_chomp", { volume: 0.8 });
            s.cameras.main.shake(180, 0.01);
            const m = mouth();
            s.fx?.burst("spark", m.x, m.y, 12, null, 360, 200, PAL.cream);
            const d = this.dist();
            if (d < K.r + 4) this.log.hit(K.dmg);
            else if (d < K.r + 160) this.log.dodged();
          },
          tick: (k) => o.setScale(o._bossScale * (1.12 - 0.12 * k), o._bossScale * (0.9 + 0.1 * k)),
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // GRITO DO MAPINGUARI: anéis de som com uma BRECHA cada (a saída). A brecha
  // da vez aparece em verde na distância do herói antes do anel chegar.
  m_scream() {
    const K = this.kit.SCREAM;
    const o = this.o,
      s = this.s,
      bag = [];
    const n = K.rings[this.phase - 1];
    const half = K.gap / 2;
    const gaps = [];
    let g, rings, emitted, t;
    const side = Math.random() < 0.5 ? 1 : -1; // lado da 1ª brecha; as outras seguem para lá
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption(tr("GRITO DO MAPINGUARI"));
            o.setVelocity(0, 0);
            this.pose(this.frame("scream"));
            // a 1ª brecha nunca fica em cima do herói: ficar parado não salva
            const a0 = this.angTo() + side * (half + 0.15 + Math.random() * 0.2);
            gaps.push(a0); // as próximas brechas nascem um anel adiantado (ver emissão)
            g = s.add.graphics().setDepth(D_TELE);
            bag.push(g);
            this.threat = { gap: { x: o.x, y: o.y, ang: gaps[0], half } };
            this.sfx("sfx_inhale", { volume: 0.35, rate: 1.5 });
          },
          tick: (k) => {
            g.clear();
            const d = this.dist();
            // prévia: anel tracejado na distância do herói + a brecha em verde
            drawGapRing(g, o.x, o.y, d, 6, gaps[0], half, PAL.red2, 0.25 + 0.35 * k);
            drawSafeArc(g, o.x, o.y, d, gaps[0], half, 0.5 + 0.5 * k);
            o.setScale(o._bossScale * (1 + 0.05 * k));
          },
        },
        {
          enter: () => {
            rings = [];
            emitted = 0;
            t = 0;
            o.setScale(o._bossScale);
          },
          tick: (_, dt) => {
            t += dt;
            while (emitted < n && t >= emitted * K.everyMs) {
              rings.push({ R: 30, gap: gaps[emitted], hit: false, passed: false });
              // a brecha do PRÓXIMO anel já fica decidida (e visível como guia) — ela "anda"
              // sempre no mesmo sentido, com passo limitado em PIXELS na distância atual do
              // herói (longe, o mesmo ângulo viraria um arco impossível de percorrer)
              const step = Math.min(K.shift, K.shiftPx / Math.max(60, this.dist()));
              gaps.push(gaps[emitted] + side * step);
              emitted++;
              this.sfx("sfx_scream", { volume: 0.6, rate: 1 + emitted * 0.06 });
              s.cameras.main.shake(160, 0.006);
              s.lighting?.flash(o.x, o.y - 40, 300, 0xff5ec8, 300, 1);
            }
            g.clear();
            const p = this.p;
            const d = this.dist();
            const pa = this.angTo();
            let guide = null;
            for (const r of rings) {
              r.R += (K.speed * dt) / 1000;
              if (r.R > K.maxR) continue;
              drawGapRing(g, o.x, o.y, r.R, K.band, r.gap, half, ROT.glow, 1 - r.R / K.maxR * 0.5);
              const inGap = Math.abs(angDiff(pa, r.gap)) <= half - Math.atan2(8, Math.max(1, d));
              if (!r.hit && !r.passed && Math.abs(r.R - d) <= K.band / 2 + 10 && !inGap) {
                r.hit = true;
                this.log.hit(K.dmg);
              }
              if (!r.passed && r.R - K.band > d) {
                r.passed = true;
                if (!r.hit) this.log.dodged();
              }
              // guia = o anel que ainda vai passar (ou está passando) pelo herói
              if (!r.passed && (!guide || r.R > guide.R)) guide = r;
            }
            // guia do próximo anel: a brecha dele, em verde, onde o herói está
            const next = guide ?? (emitted < n ? { gap: gaps[emitted] } : null);
            if (next && d < K.maxR) drawSafeArc(g, o.x, o.y, d, next.gap, half, 0.85);
            // e, apagada, a brecha do anel seguinte: dá para se posicionar na sobreposição
            if (guide && emitted < n && d < K.maxR) drawSafeArc(g, o.x, o.y, d + 14, gaps[emitted], half, 0.3);
            this.threat = next ? { gap: { x: o.x, y: o.y, ang: next.gap, half } } : null;
          },
          until: () => emitted >= n && rings.every((r) => r.R > K.maxR || r.passed),
        },
        { ms: 250 },
      ],
      bag,
      () => this.restore(),
    );
  }

  // OLHAR DA PODRIDÃO (fúria): o olho único varre um setor com um feixe.
  // A seta mostra de onde ele começa: corra para lá (ou saia do alcance).
  m_gaze() {
    const K = this.kit.GAZE;
    const o = this.o,
      s = this.s,
      bag = [];
    const dir = Math.random() < 0.5 ? 1 : -1;
    let a0, tele, beam, hit = false, wasIn = false;
    const eye = () => ({ x: o.x, y: o.y - o.displayHeight * 0.33 });
    const inSector = () => {
      const d = this.dist();
      if (d > K.len + 10) return false;
      const rel = angDiff(this.angTo(), a0) * dir;
      return rel >= -0.1 && rel <= K.arc + 0.1;
    };
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption(tr("OLHAR DA PODRIDÃO"));
            o.setVelocity(0, 0);
            this.pose(this.frame("scream"));
            // a borda de partida fica a ~startPx do herói (perto ou longe, o mesmo passo)
            a0 = this.angTo() - dir * Math.min(0.55, K.startPx / Math.max(60, this.dist()));
            tele = new SweepTele(s, o.x, o.y, a0, K.arc, dir, K.len, PAL.red2, K.blind);
            this.threat = { sweep: { x: o.x, y: o.y, a0, dir, arc: K.arc, len: K.len, blind: K.blind } };
            beam = s.add.graphics().setDepth(D_TELE + 1);
            bag.push(tele, beam);
            wasIn = inSector();
            this.sfx("sfx_beam", { volume: 0.3, rate: 0.6 });
          },
          tick: (k) => {
            tele.draw(k);
            const e = eye();
            this._lights = [{ x: e.x, y: e.y, r: 60 + 80 * k, c: 0xff3050, a: 0.9 }];
          },
        },
        {
          ms: K.sweepMs,
          enter: () => this.sfx("sfx_beam", { volume: 0.6 }),
          tick: (k) => {
            const a = a0 + dir * K.arc * k;
            tele.draw(1);
            beam.clear();
            const e = eye();
            const ex = o.x + Math.cos(a) * K.len,
              ey = o.y + Math.sin(a) * K.len;
            // feixe: núcleo branco, bordas vermelhas, faíscas no chão
            for (let w = -2; w <= 2; w++) {
              const nx = -Math.sin(a) * w * 3,
                ny = Math.cos(a) * w * 3;
              pixelLine(beam, e.x + nx, e.y + ny, ex + nx, ey + ny, Math.abs(w) < 1 ? 0xffffff : Math.abs(w) < 2 ? PAL.red3 : PAL.red2, Math.abs(w) < 2 ? 1 : 0.7);
            }
            s.fx?.burst("spark", ex, ey, 1, null, 360, 120, PAL.red3);
            this._lights = [
              { x: e.x, y: e.y, r: 140, c: 0xff3050, a: 1 },
              { x: (e.x + ex) / 2, y: (e.y + ey) / 2, r: 220, c: 0xff3050, a: 0.7 },
              { x: ex, y: ey, r: 120, c: 0xff6a2a, a: 0.9 },
            ];
            const d = this.dist();
            if (!hit && d > K.blind && d < K.len + 8) { // aos pés dele o olho não alcança
              const off = Math.abs(angDiff(this.angTo(), a));
              if (off <= K.halfWidth + Math.atan2(12, d)) {
                hit = true;
                this.log.hit(K.dmg);
              }
            }
          },
          exit: () => {
            tele.destroy();
            beam.destroy();
            if (!hit && wasIn) this.log.dodged();
          },
        },
        {
          ms: K.exposedMs,
          enter: () => {
            this.pose(this.frame("idle"));
            this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, tr("OLHO CANSADO!"), -60);
          },
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // LEQUE: arco de projéteis mirado + corvos (fase 2)
  m_fan() {
    const K = this.kit.FAN;
    const o = this.o,
      s = this.s,
      bag = [];
    let ang, tele;
    const half = (K.spread * (K.n - 1)) / 2 + 0.06;
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption(tr("LEQUE DE ESPINHOS"));
            ang = this.angTo();
            o.setVelocity(0, 0);
            tele = new ConeTele(s, o.x, o.y, ang, 300, half, PAL.red2);
            bag.push(tele);
            this.threat = { cone: { x: o.x, y: o.y, ang, range: 900, half } };
          },
          tick: (k) => tele.draw(k),
          exit: () => tele.destroy(),
        },
        {
          ms: 300,
          enter: () => {
            const dmg = BOSS.DMG_PROJECTILE * this.dmgMult();
            for (let i = 0; i < K.n; i++) {
              const a = ang + (i - (K.n - 1) / 2) * K.spread;
              s.enemyProjPool.acquire().fire(o.x, o.y, Math.cos(a) * K.speed, Math.sin(a) * K.speed, dmg);
            }
            this.sfx("sfx_fire_attack", { volume: 0.4, rate: 0.6 });
            this._summon("crow", 3);
          },
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // INVOCAÇÃO: lobos corrompidos (não conta como golpe para o "desviou de tudo")
  m_summon() {
    const tl = this.timeline(
      [
        {
          ms: 600,
          enter: () => {
            this.caption(tr("CHAMADO DA PODRIDÃO"));
            this.o.setVelocity(0, 0);
            this.pose(this.frame("scream"));
            this.sfx("sfx_boss_roar", { volume: 0.5, rate: 0.9 });
          },
          exit: () => this._summon("wolf", 3),
        },
      ],
      [],
      () => this.restore(),
    );
    tl.counts = false;
    return tl;
  }

  _summon(kind, count) {
    const s = this.s,
      o = this.o;
    const wave = s.waveIndex();
    summonPulse(s, o.x, o.y);
    for (let i = 0; i < count; i++) {
      if (s.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) break;
      const ang = (i / count) * TAU + Math.random() * 0.5;
      const sx = o.x + Math.cos(ang) * 90,
        sy = o.y + Math.sin(ang) * 90;
      summonPulse(s, sx, sy);
      s.enemyPool.acquire().activate(sx, sy, kind, wave);
    }
  }
}

// ============================================================================
// Registro de CHEFES de bioma (BIOMES[id].boss em config.js): textura, animações,
// corpo e o cérebro. Um chefe novo = um arquivo que chama registerBoss (como as
// armas com registerWeapon) e é importado pela GameScene.
// ============================================================================
export const BOSS_DEFS = {
  mapinguari: { tex: "mon_boss", idle: "boss_idle", fury: "boss_fury", scale: 1.1, body: [10, 15, 34], furySpeed: 90, Brain: MapiBrain },
};
export function registerBoss(id, def) {
  BOSS_DEFS[id] = def;
}

// ============================================================================
// BOSS — corpo de 2 fases (o Mapinguari por padrão; quem decide é o Brain do def)
// ============================================================================
export class BossEnt extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, id = "mapinguari") {
    const def = BOSS_DEFS[id] ?? BOSS_DEFS.mapinguari;
    super(scene, x, y, def.tex, 0);
    this.def = def;
    this.bossId = id;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this._bossScale = GAME.PIXEL_SCALE * def.scale; // arte de ~50×56 → ~165px: chefe tem que impor
    this.setScale(this._bossScale);
    this.body.setCircle(...def.body);
    this.play(def.idle);
    this.shadow = scene.add
      .image(x, y, "px_shadow")
      .setScale((GAME.PIXEL_SCALE * this.displayWidth) / 48)
      .setDepth(4)
      .setVisible(false);
    this.maxHp = 0;
    this.hp = 0;
    this.dmg = BOSS.DMG_MELEE; // a escala do Perigo é aplicada na GameScene
    this.speed = BOSS.SPEED;
    this.statuses = {};
    this.phase = 1;
    this.lastTouchAt = 0;
    this.contactCooldownMs = 450;
    this._kind = "boss";
    this._exposedUntil = 0;
    // Transição de fase ("êxtase"): boss invulnerável e parado enquanto a barra recarrega
    this._transitioning = false;
    this._transitionEnd = 0;
    this._displayFill = 1;
    this._furyPulse = null;
    this.brain = null;
  }

  activate(maxHp) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.statuses = {};
    this.phase = 1;
    this.speed = BOSS.SPEED;
    this.lastTouchAt = 0;
    this._exposedUntil = 0;
    this._transitioning = false;
    this._transitionEnd = 0;
    this._displayFill = 1;
    this._armorAcc = 0; // couraça: dano recente (decai com BOSS.ARMOR.TAU_S)
    this._armorAt = 0;
    this._furyPulse?.stop();
    this._furyPulse = null;
    this.clearTint();
    this.play(this.def.idle);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46).setVisible(true);
    this.brain?.dispose();
    this.brain = new this.def.Brain(this);
  }

  deactivate() {
    this.shadow.setVisible(false);
    this.brain?.dispose();
    this.brain = null;
  }

  takeDamage(dmg) {
    // Livro de dano (balanceamento): consome a fonte marcada por quem bateu
    const src = this.scene._dmgSrc;
    this.scene._dmgSrc = null;
    // Invulnerável durante o êxtase da virada de fase (a barra está recarregando)
    if (this._transitioning) return false;
    const before = this.hp;
    this.scene.feel?.hit(this, false, true);
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    const now = this.scene.time.now;
    const amp = now < this._exposedUntil ? this._exposedMult ?? BOSS_FIGHT.EXPOSED_MULT : 1;
    const raw = dmg * iceAmp;
    const eff = this._armor(raw, now);
    const lost = eff * amp;
    this.hp -= lost;
    this.scene._recordDmg?.(src, Math.min(Math.max(before, 0), lost));
    // A Couraça segurou boa parte do golpe: o jogador precisa VER isso (senão parece que a
    // build "não presta" contra o chefe). O número na tela mostra o que o chefe PERDEU.
    const resisted = eff < raw * BOSS.ARMOR.SHOW_BELOW;
    this.scene._markHit?.(this, dmg > 0 ? lost / dmg : 1, { weak: amp > 1, resisted });
    if (resisted) this._armorFeedback(now);
    this.setTint(amp > 1 ? 0xffe58f : resisted ? PAL.s3 : 0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(50, () => {
      if (!this.active) return;
      this.scene.elemental?._updateTint(this);
    });
    if (this.hp <= 0) return true;
    if (this.phase === 1 && this.hp <= this.maxHp * BOSS.PHASE2_AT_HP_PCT) this._enterFury();
    return false;
  }

  // Couraça resistindo: lascas e anel na cor da Podridão (no máximo a cada FX_MS) e, na
  // primeira vez da vida do jogador, a dica que ensina a saída: o ponto fraco
  _armorFeedback(now) {
    const scene = this.scene;
    if (now - (this._armorFxAt || 0) < BOSS.ARMOR.FX_MS) return;
    this._armorFxAt = now;
    const y = this.y - this.displayHeight * 0.3;
    scene.fx?.ring(this.x, y, PAL.s4, this.displayWidth * 0.3, this.displayWidth * 0.55, 260, 0.62, 0.7);
    scene.fx?.burst("shard", this.x, y, 5, null, 360, null, ROT.hot);
    scene._hint?.("boss_armor", tr("COURAÇA DA PODRIDÃO: o chefe segura o dano em excesso.\nAcerte o ponto fraco depois dos golpes grandes!"));
  }

  // Couraça da Podridão (ver BOSS.ARMOR): acima do ritmo de referência, o excesso é resistido
  _armor(raw, now) {
    const A = BOSS.ARMOR;
    this._armorAcc = this._armorAcc * Math.exp(-(now - this._armorAt) / (A.TAU_S * 1000)) + raw;
    this._armorAt = now;
    const rate = this._armorAcc / A.TAU_S;
    const ref = this.maxHp / A.TARGET_S;
    return rate > ref ? raw * Math.pow(ref / rate, 1 - A.KEEP) : raw;
  }

  // Êxtase da virada: boss parado e invulnerável ~1.3s, pulsando, enquanto a
  // barra de vida recarrega de 0 a 100% (ver HUD lê _transitioning/_displayFill).
  _enterFury() {
    const scene = this.scene;
    const DURATION = 1300;
    this.phase = 2;
    this.speed = this.def.furySpeed ?? 90;
    this.brain?.cancelMove();
    if (this.brain) {
      this.brain.phase = 2;
      this.brain.gap = 900;
      this.brain.ri = 0;
      this.brain.weak.close();
    }
    this._transitioning = true;
    this._transitionEnd = scene.time.now + DURATION;
    this._displayFill = 0;
    this.setVelocity(0, 0);
    scene.cameras.main.shake(500, 0.014);
    scene.sound.play("sfx_boss_roar", { volume: 0.85 });
    scene.hud?.showBossBanner(tr("FÚRIA!"));
    const base = this._bossScale;
    this.play(this.def.fury);
    this._furyPulse = scene.tweens.add({
      targets: this,
      scaleX: base * 1.14,
      scaleY: base * 1.14,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    scene.tweens.add({ targets: this, _displayFill: 1, duration: DURATION, ease: "Cubic.easeOut" });
    shockwave(scene, this.x, this.y, 240, 0xff8a1e);
    scene.time.delayedCall(250, () => this.active && shockwave(scene, this.x, this.y, 180, 0xffb24c));
  }

  _endFury() {
    this._transitioning = false;
    this._displayFill = 1;
    this._furyPulse?.stop();
    this._furyPulse = null;
    this.setScale(this._bossScale);
    this.scene.elemental?._updateTint(this);
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46);
    this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
    if (this._transitioning) {
      if (time >= this._transitionEnd) this._endFury();
      else {
        this.setVelocity(0, 0);
        this.setFlipX(target.x - this.x < 0);
        return;
      }
    }
    this.brain?.update(time, dt);
  }
}

