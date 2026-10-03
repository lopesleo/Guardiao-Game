// CABOCLO D'ÁGUA — chefe da Caatinga (ver docs/CHEFES.md e docs/BIOMAS.md).
// Guardião do Rio São Francisco, corrompido pela Podridão: trouxe o rio para o
// sertão seco. Golpes de ÁGUA: Cheia (faixas), Rebojo (redemoinhos que puxam),
// Arrastão (investida), Pedras do Rio e, na fúria, a Tromba d'Água.
// A marca da lenda: as CARRANCAS. Os barqueiros punham figuras de proa para
// espantá-lo — aqui elas estão fincadas na arena. Atraia o Arrastão para uma
// carranca: ele se espanta e fica muito tempo exposto (o jogo recompensa a leitura).
import { GAME, BOSS_FIGHT } from "../config.js";
import { PAL } from "../art/Palette.js";
import { ZoneTele, LaneTele, shockwave, summonPulse, pixelArc, D_TELE } from "../art/Telegraph.js";
import { distTo, inLane } from "../systems/BossKit.js";
import { Brain, registerBoss, clampLen, clampPt } from "./Bosses.js";

const TAU = Math.PI * 2;
const S = GAME.PIXEL_SCALE;
const WATER = [0x1c4a5a, 0x2e7488, 0x4aa2b0, 0x86d0d4, 0xffffff];

// ----------------------------------------------------------------------------
// Carrancas: figuras de proa fincadas no chão. Ficam perto do herói (renascem
// perto dele se forem quebradas ou ficarem longe demais).
// ----------------------------------------------------------------------------
class Carrancas {
  constructor(brain) {
    this.b = brain;
    this.s = brain.s;
    this.K = brain.kit.CARRANCAS;
    this.list = [];
    this.respawnAt = [];
  }

  _make(x, y) {
    const s = this.s;
    const p = clampPt(x, y, 90);
    const img = s.add.image(p.x, p.y, "obj_carranca", 0).setOrigin(0.5, 1).setScale(S).setDepth(p.y + 10000);
    const shadow = s.add.image(p.x, p.y + 2, "px_shadow").setScale(3.2, S).setAlpha(0.6).setDepth(4);
    const ring = s.add.graphics().setDepth(D_TELE - 1);
    img.setScale(S, 0);
    s.tweens.add({ targets: img, scaleY: S, duration: 380, ease: "Back.easeOut" });
    summonPulse(s, p.x, p.y);
    const c = { x: p.x, y: p.y, img, shadow, ring, mark: 0 };
    this.list.push(c);
    return c;
  }

  // Um ponto livre a ~dist do herói, longe do chefe e das outras carrancas
  _spot(baseAng) {
    const p = this.b.p,
      o = this.b.o,
      K = this.K;
    for (let t = 0; t < 12; t++) {
      const a = baseAng + (t ? (Math.random() - 0.5) * 2.4 : 0);
      const pt = clampPt(p.x + Math.cos(a) * K.dist, p.y + Math.sin(a) * K.dist, 90);
      if (distTo(o, pt.x, pt.y) < K.minBoss + 60) continue;
      if (this.list.some((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < 180)) continue;
      return pt;
    }
    return clampPt(p.x + Math.cos(baseAng) * K.dist, p.y + Math.sin(baseAng) * K.dist, 90);
  }

  place() {
    const a0 = this.b.angTo() + Math.PI; // a primeira fica do lado oposto ao chefe
    for (let i = 0; i < this.K.n; i++) {
      const pt = this._spot(a0 + (i - (this.K.n - 1) / 2) * 1.6);
      this._make(pt.x, pt.y);
    }
  }

  update(time) {
    const p = this.b.p;
    const now = this.s.time.now;
    // renasce a que quebrou
    this.respawnAt = this.respawnAt.filter((t) => {
      if (now < t) return true;
      const pt = this._spot(Math.random() * TAU);
      this._make(pt.x, pt.y);
      return false;
    });
    // o herói foi para longe de todas: a mais distante vem para perto (nunca durante o golpe)
    if (this.list.length && !this.b.move && this.list.every((c) => distTo(p, c.x, c.y) > this.K.far)) {
      const far = this.list.reduce((a, c) => (distTo(p, c.x, c.y) > distTo(p, a.x, a.y) ? c : a));
      this._remove(far, false);
      const pt = this._spot(Math.random() * TAU);
      this._make(pt.x, pt.y);
    }
    // marca verde nas carrancas que o golpe da vez vai acertar
    for (const c of this.list) {
      c.ring.clear();
      if (c.mark > 0) {
        const r = this.K.r + 6 + Math.sin(time / 80) * 4;
        pixelArc(c.ring, c.x, c.y - 20, r, 0, TAU, PAL.g6, 0.95, 0, true);
        pixelArc(c.ring, c.x, c.y - 20, r + 6, 0, TAU, PAL.g6, 0.4, 3);
      }
    }
  }

  // Primeira carranca dentro da faixa (along = distância da origem até ela)
  firstIn(x, y, ang, len, width) {
    let best = null;
    for (const c of this.list) {
      const dx = c.x - x,
        dy = c.y - 20 - y;
      const along = dx * Math.cos(ang) + dy * Math.sin(ang);
      const across = -dx * Math.sin(ang) + dy * Math.cos(ang);
      if (along > 60 && along < len + this.K.r && Math.abs(across) < width / 2 + this.K.r * 0.6 && (!best || along < best.along)) best = { c, along };
    }
    return best;
  }

  // O Caboclo bateu na carranca: ela racha, cai e renasce depois
  scare(c) {
    const s = this.s;
    c.img.setFrame(1);
    s.fx?.burst("shard", c.x, c.y - 20, 12, null, 360, 160, PAL.n4);
    s.tweens.add({ targets: c.img, angle: 70, alpha: 0, y: c.y + 6, delay: 500, duration: 500, ease: "Cubic.easeIn" });
    this._remove(c, true);
    this.respawnAt.push(s.time.now + this.K.respawnMs);
  }

  _remove(c, keepImg) {
    this.list = this.list.filter((q) => q !== c);
    c.ring.destroy();
    c.shadow.destroy();
    if (keepImg) this.s.time.delayedCall(1100, () => c.img.destroy());
    else c.img.destroy();
  }

  lights(add) {
    for (const c of this.list) add(c.x, c.y - 24, 120, 0xffc86b, 0.75);
  }

  dispose() {
    for (const c of [...this.list]) this._remove(c, false);
    this.respawnAt = [];
  }
}

// ----------------------------------------------------------------------------
// Cérebro do Caboclo d'Água
// ----------------------------------------------------------------------------
export class CabocloBrain extends Brain {
  constructor(owner) {
    super(owner, BOSS_FIGHT.CABOCLO, 10);
    this.gap = 1700;
    this.r1 = ["cheia", "arrastao", "pedrada", "summon", "rebojo", "arrastao"];
    this.r2 = ["tromba", "arrastao", "cheia", "rebojo", "pedrada", "arrastao", "summon"];
    this.ri = 0;
    this.carrancas = new Carrancas(this);
    this._placed = false;
  }
  speed() {
    return this.o.speed;
  }
  ready() {
    return true;
  }
  update(time, dt) {
    if (!this._placed) {
      this._placed = true;
      this.carrancas.place();
      this.s._hint?.("carranca", "As CARRANCAS espantam o Caboclo d'Água.\nFique atrás de uma quando ele investir!", 5200);
    }
    this.carrancas.update(time);
    super.update(time, dt);
  }
  choose() {
    const rot = this.phase === 1 ? this.r1 : this.r2;
    for (let tries = 0; tries < rot.length; tries++) {
      const m = rot[this.ri++ % rot.length];
      if (m === this.last) continue;
      return m;
    }
    return "cheia";
  }
  frame(kind) {
    const fury = this.phase === 2;
    return { raise: fury ? 7 : 5, grab: fury ? 8 : 6, idle: fury ? 2 : 0 }[kind];
  }
  restore() {
    const o = this.o;
    o.setVelocity(0, 0);
    o.setScale(o._bossScale);
    o.setAngle(0);
    if (o.active) o.play(this.phase === 2 ? "caboclo_fury" : "caboclo_idle");
  }
  lights(add) {
    super.lights(add);
    this.carrancas.lights(add);
  }
  dispose() {
    super.dispose();
    this.carrancas.dispose();
  }

  // Gotas e espuma (efeito comum da água)
  _splash(x, y, n = 10, spread = 60) {
    const s = this.s;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const im = s.add.image(x, y, i % 3 ? "px_dot2" : "px_puff").setScale(S * (0.6 + Math.random() * 0.6)).setTint(WATER[1 + (i % 4)]).setDepth(y + 10020);
      const d = spread * (0.4 + Math.random() * 0.6);
      s.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8 + 30, alpha: 0, duration: 420 + Math.random() * 260, ease: "Quad.easeOut", onComplete: () => im.destroy() });
    }
  }

  // CHEIA: braços erguidos, o rio vem em faixas paralelas. Fúria: logo depois,
  // outra cheia em CRUZ passando pelo herói (lê-se a 2ª enquanto a 1ª corre).
  m_cheia() {
    const K = this.kit.CHEIA;
    const o = this.o,
      s = this.s,
      bag = [];
    const n = K.lanes[this.phase - 1];
    const waves = [];
    const mkWave = (cx, cy, ang, back, len) => {
      // uma das faixas (sorteada) passa SEMPRE pelo herói: ficar parado nunca salva
      const k = Math.floor(Math.random() * n);
      const off = -(k - (n - 1) / 2) * K.period + (Math.random() - 0.5) * K.width * 0.4;
      const c = Math.cos(ang),
        sn = Math.sin(ang);
      const lanes = [];
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * K.period + off;
        const x = cx - sn * a - c * back,
          y = cy + c * a - sn * back;
        lanes.push({ x, y, ang, len });
      }
      const w = { lanes, teles: [], hit: false, wasIn: false, front: 0 };
      waves.push(w);
      return w;
    };
    const inAny = (w, front = 1e9) => w.lanes.some((l) => inLane(this.p, l.x, l.y, l.ang, Math.min(l.len, front), K.width, 0, 8));
    const show = (w) => {
      w.teles = w.lanes.map((l) => new LaneTele(s, l.x, l.y, l.ang, l.len, K.width, PAL.ice2));
      bag.push(...w.teles);
      this.threat = { lanes: [...(this.threat?.lanes ?? []), ...w.lanes.map((l) => ({ x: l.x, y: l.y, ang: l.ang, len: l.len, w: K.width }))] };
      w.wasIn = inAny(w);
    };
    const erupt = (w) => {
      w.teles.forEach((t) => t.destroy());
      s.cameras.main.shake(160, 0.006);
      this.sfx("sfx_wave", { volume: 0.6 });
      // a água corre pela faixa: espuma clara na frente, corpo azul atrás
      for (const l of w.lanes) {
        const c = Math.cos(l.ang),
          sn = Math.sin(l.ang);
        for (let k = 0; k < 18; k++) {
          const across = (Math.random() - 0.5) * K.width * 0.9;
          const im = s.add.image(l.x - sn * across, l.y + c * across, k % 3 ? "px_puff" : "px_dot2")
            .setScale(S * (1 + Math.random())).setTint(WATER[1 + (k % 4)]).setAlpha(0.9).setDepth(D_TELE - 2);
          bag.push(im);
          const d = l.len * (0.2 + Math.random() * 0.8);
          s.tweens.add({ targets: im, x: im.x + c * d, y: im.y + sn * d, alpha: 0, delay: k * 12, duration: K.liveMs + 120, ease: "Quad.easeOut" });
        }
      }
    };
    const resolve = (w) => {
      if (this.threat?.lanes) this.threat = { lanes: this.threat.lanes.filter((l) => !w.lanes.some((q) => q.x === l.x && q.y === l.y)) };
      if (!w.hit && w.wasIn) this.log.dodged();
    };
    const runLive = (w, k, ms) => {
      w.front = Math.min(1, k * (ms / 240)) * w.lanes[0].len;
      if (!w.hit && inAny(w, w.front)) {
        w.hit = true;
        if (this.log.hit(K.dmg)) {
          const l = w.lanes[0];
          this.p.shove?.(Math.cos(l.ang) * 260, Math.sin(l.ang) * 260, 240);
        }
      }
    };
    let w1, w2;
    const steps = [
      {
        ms: K.windupMs,
        enter: () => {
          this.caption("CHEIA DO RIO");
          o.setVelocity(0, 0);
          this.pose(this.frame("raise"));
          w1 = mkWave(o.x, o.y, this.angTo(), K.back, K.len);
          show(w1);
          this.sfx("sfx_rumble", { volume: 0.35, rate: 1.6 });
        },
        tick: (k) => {
          w1.teles.forEach((t) => t.draw(k));
          o.setScale(o._bossScale * (1 - 0.03 * k), o._bossScale * (1 + 0.05 * k));
        },
      },
    ];
    if (this.phase === 2) {
      const lead = K.liveMs;
      const rest = Math.max(380, K.crossWindupMs - lead);
      steps.push({
        ms: lead,
        enter: () => {
          this.pose(this.frame("idle"));
          o.setScale(o._bossScale);
          erupt(w1);
          // a cruz é centrada no herói (o rio vem dos dois lados)
          const a = w1.lanes[0].ang + Math.PI / 2;
          w2 = mkWave(this.p.x, this.p.y, a, K.len / 2, K.len);
          show(w2);
        },
        tick: (k) => {
          runLive(w1, k, lead);
          w2.teles.forEach((t) => t.draw((k * lead) / (lead + rest)));
        },
        exit: () => resolve(w1),
      });
      steps.push({
        ms: rest,
        enter: () => this.pose(this.frame("raise")),
        tick: (k) => w2.teles.forEach((t) => t.draw((lead + k * rest) / (lead + rest))),
      });
      steps.push({
        ms: K.liveMs,
        enter: () => {
          this.pose(this.frame("idle"));
          erupt(w2);
        },
        tick: (k) => runLive(w2, k, K.liveMs),
        exit: () => resolve(w2),
      });
    } else {
      steps.push({
        ms: K.liveMs,
        enter: () => {
          this.pose(this.frame("idle"));
          o.setScale(o._bossScale);
          erupt(w1);
        },
        tick: (k) => runLive(w1, k, K.liveMs),
        exit: () => resolve(w1),
      });
    }
    steps.push({ ms: 320 });
    return this.timeline(steps, bag, () => this.restore());
  }

  // REBOJO: redemoinhos no chão. PUXAM devagar (andar sempre vence) e, no fim,
  // engolem quem estiver dentro. Um nasce no herói; os outros, em volta.
  m_rebojo() {
    const K = this.kit.REBOJO;
    const s = this.s,
      bag = [];
    const n = K.n[this.phase - 1];
    let pools;
    return this.timeline(
      [
        {
          ms: K.warnMs,
          enter: () => {
            this.caption("REBOJO");
            this.o.setVelocity(0, 0);
            this.pose(this.frame("raise"));
            const p = this.p;
            const a0 = Math.random() * TAU;
            const pts = [clampPt(p.x, p.y, 60)];
            for (let i = 1; i < n; i++) pts.push(clampPt(p.x + Math.cos(a0 + (i * TAU) / (n - 1)) * K.sep, p.y + Math.sin(a0 + (i * TAU) / (n - 1)) * K.sep, 60));
            pools = pts.map((pt) => {
              const tele = new ZoneTele(s, pt.x, pt.y, K.r, PAL.ice2, 0.8);
              const g = s.add.graphics().setDepth(D_TELE - 1);
              bag.push(tele, g);
              return { ...pt, tele, g, wasIn: distTo(p, pt.x, pt.y) < K.r + 30 };
            });
            this.threat = { zones: pools.map((q) => ({ x: q.x, y: q.y, r: K.r })) };
            this.sfx("sfx_inhale", { volume: 0.4, rate: 0.7 });
          },
          tick: (k) => {
            const p = this.p,
              now = s.time.now;
            for (const q of pools) {
              q.tele.draw(k);
              // espiral de água girando para o centro
              q.g.clear();
              for (let j = 0; j < 3; j++) {
                const a = now / 160 + (j * TAU) / 3;
                pixelArc(q.g, q.x, q.y, K.r * (0.3 + 0.2 * j), a, a + 1.6, WATER[2 + (j % 2)], 0.8);
              }
              // puxa (fraco) quem está por perto e não está no Dash
              const d = distTo(p, q.x, q.y);
              if (d < K.pullR && d > 4 && !p.isDashing?.()) {
                const f = K.pull * (1 - d / K.pullR) * Math.min(1, k * 3);
                p.addPull?.(((q.x - p.x) / d) * f, ((q.y - p.y) / d) * f);
              }
            }
            this._lights = pools.map((q) => ({ x: q.x, y: q.y, r: K.r * 1.6, c: 0x5cc8ff, a: 0.5 }));
          },
          exit: () => pools.forEach((q) => q.tele.destroy()),
        },
        {
          ms: 420,
          enter: () => {
            this.pose(this.frame("idle"));
            s.cameras.main.shake(160, 0.007);
            this.sfx("sfx_splash", { volume: 0.7 });
            let hit = false,
              near = false;
            for (const q of pools) {
              q.g.clear();
              shockwave(s, q.x, q.y, K.r, PAL.ice2);
              this._splash(q.x, q.y, 12, K.r);
              const d = distTo(this.p, q.x, q.y);
              if (d < K.r + 4) hit = true;
              else if (q.wasIn || d < K.r + 60) near = true;
            }
            if (hit) this.log.hit(K.dmg);
            else if (near) this.log.dodged();
          },
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // ARRASTÃO: agacha, trava a faixa na direção do herói e passa arrastando tudo.
  // Se houver CARRANCA no caminho, a faixa para nela (marca verde): ele bate,
  // se ESPANTA e fica muito tempo exposto. Atrás da carranca, o herói está a salvo.
  m_arrastao() {
    const K = this.kit.ARRASTAO;
    const o = this.o,
      s = this.s,
      bag = [];
    let ang, len, tele, run, target;
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption("ARRASTÃO");
            ang = this.angTo();
            len = clampLen(o.x, o.y, ang, K.len);
            target = this.carrancas.firstIn(o.x, o.y, ang, len, K.width);
            if (target) {
              len = Math.max(80, target.along - 46); // para na carranca
              target.c.mark = 1;
            }
            o.setVelocity(0, 0);
            o.setFlipX(Math.cos(ang) < 0);
            this.pose(this.frame("grab"));
            tele = new LaneTele(s, o.x, o.y, ang, len, K.width, PAL.ice2, 50);
            bag.push(tele);
            this.threat = { lanes: [{ x: o.x, y: o.y, ang, len, w: K.width }] };
            this.sfx("sfx_rumble", { volume: 0.4, rate: 1.2 });
          },
          tick: (k) => {
            tele.draw(k);
            o.x += (Math.random() - 0.5) * 2 * k;
          },
          exit: () => tele.destroy(),
        },
        {
          enter: () => {
            run = { x0: o.x, y0: o.y, t: 0, hit: false, minD: 1e9 };
            this.sfx("sfx_wave", { volume: 0.5, rate: 1.3 });
          },
          tick: (_, dt) => {
            run.t += dt;
            o.setVelocity(Math.cos(ang) * K.speed, Math.sin(ang) * K.speed);
            const d = this.dist();
            run.minD = Math.min(run.minD, d);
            // só acerta quem está NA faixa (atrás da carranca, não)
            const pAlong = (this.p.x - run.x0) * Math.cos(ang) + (this.p.y - run.y0) * Math.sin(ang);
            if (!run.hit && d < K.width / 2 + 8 && pAlong < len + 30) {
              run.hit = true;
              if (this.log.hit(K.dmg)) this.p.shove?.(Math.cos(ang) * 300, Math.sin(ang) * 300, 220);
            }
            if (Math.random() < 0.6) this._splash(o.x, o.y + 40, 1, 40);
          },
          until: () => Math.hypot(o.x - run.x0, o.y - run.y0) >= len || run.t > (len / K.speed) * 1600,
          exit: () => {
            o.setVelocity(0, 0);
            s.cameras.main.shake(160, 0.007);
            if (!run.hit && run.minD < 160) this.log.dodged();
            if (target) {
              target.c.mark = 0;
              this.carrancas.scare(target.c);
              this.sfx("sfx_carranca", { volume: 0.8 });
              shockwave(s, target.c.x, target.c.y - 20, 110, PAL.yel2);
              s.lighting?.flash(target.c.x, target.c.y - 30, 260, 0xffc86b, 500, 1);
            } else {
              shockwave(s, o.x, o.y + 30, 90, PAL.ice2);
              this._splash(o.x, o.y + 30, 10, 70);
            }
          },
        },
        {
          // espantado pela carranca: recua tremendo, muito exposto. Sem carranca: encalha.
          enter: () => {
            run.t = 0;
            this.pose(this.frame("idle"));
            if (target) {
              this.weak.open(K.scaredMs, K.scaredMult, "A CARRANCA O ESPANTOU!");
              s.meta?.recordStat?.("carrancas");
            } else this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, "ENCALHADO!");
          },
          tick: (_, dt) => {
            run.t += dt;
            o.setAngle(Math.sin(s.time.now / (target ? 30 : 45)) * (target ? 6 : 3));
            const back = target && run.t < 500;
            o.setVelocity(back ? -Math.cos(ang) * 90 : 0, back ? -Math.sin(ang) * 90 : 0);
          },
          until: () => run.t >= (target ? K.scaredMs : K.exposedMs),
          exit: () => {
            o.setVelocity(0, 0);
            o.setAngle(0);
          },
        },
      ],
      bag,
      () => {
        if (target) target.c.mark = 0;
        o.setAngle(0);
        this.restore();
      },
    );
  }

  // PEDRAS DO RIO: arremessa pedras que caem onde o herói ESTÁ, uma atrás da outra.
  // Não ficar parado: cada sombra no chão avisa onde a pedra vai cair.
  m_pedrada() {
    const K = this.kit.PEDRADA;
    const o = this.o,
      s = this.s,
      bag = [];
    const n = K.n[this.phase - 1];
    const stones = [];
    let t = 0,
      thrown = 0;
    const rockFrame = (i) => `lajedo${i % 2}`;
    const atlas = s.world?.atlas === "env_caatinga" ? "env_caatinga" : null;
    return this.timeline(
      [
        {
          ms: 380,
          enter: () => {
            this.caption("PEDRAS DO RIO");
            o.setVelocity(0, 0);
            this.pose(this.frame("raise"));
          },
        },
        {
          enter: () => (t = 0),
          tick: (_, dt) => {
            t += dt;
            while (thrown < n && t >= thrown * K.everyMs) {
              const pt = clampPt(this.p.x, this.p.y, 60);
              const tele = new ZoneTele(s, pt.x, pt.y, K.r, PAL.red2);
              const rock = atlas
                ? s.add.image(o.x, o.y - 80, atlas, rockFrame(thrown)).setScale(S)
                : s.add.image(o.x, o.y - 80, "px_dot2").setScale(S * 4).setTint(PAL.s3);
              rock.setDepth(D_TELE + 2);
              bag.push(tele, rock);
              stones.push({ ...pt, t0: t, tele, rock, done: false, wasIn: distTo(this.p, pt.x, pt.y) < K.r + 30, sx: o.x, sy: o.y - 80 });
              thrown++;
              this.sfx("sfx_whoosh", { volume: 0.4, rate: 0.8 });
              this.pose(this.frame(thrown % 2 ? "raise" : "idle"));
            }
            for (const st of stones) {
              if (st.done) continue;
              const k = Math.min(1, (t - st.t0) / K.warnMs);
              st.tele.draw(k);
              // a pedra faz um arco alto até o alvo
              st.rock.setPosition(st.sx + (st.x - st.sx) * k, st.sy + (st.y - st.sy) * k - Math.sin(k * Math.PI) * 260);
              st.rock.setRotation(k * 6);
              if (k >= 1) {
                st.done = true;
                st.tele.destroy();
                st.rock.destroy();
                shockwave(s, st.x, st.y, K.r, PAL.s4);
                s.fx?.burst("shard", st.x, st.y, 8, null, 360, 140, PAL.s3);
                s.cameras.main.shake(100, 0.005);
                this.sfx("sfx_erupt", { volume: 0.4, rate: 1.3 });
                const d = distTo(this.p, st.x, st.y);
                if (d < K.r + 4) this.log.hit(K.dmg);
                else if (st.wasIn || d < K.r + 60) this.log.dodged();
              }
            }
            const live = stones.filter((q) => !q.done);
            this.threat = live.length ? { zones: live.map((q) => ({ x: q.x, y: q.y, r: K.r })) } : null;
          },
          until: () => thrown >= n && stones.every((q) => q.done),
        },
        { ms: 300 },
      ],
      bag,
      () => this.restore(),
    );
  }

  // TROMBA D'ÁGUA (fúria): uma coluna d'água nasce nele e PERSEGUE o herói
  // (mais devagar que ele). No fim desaba: o círculo avisa onde. Depois, cansado.
  m_tromba() {
    const K = this.kit.TROMBA;
    const o = this.o,
      s = this.s,
      bag = [];
    let sp, zone, splashTele, hitOnce = false, wasNear = false;
    return this.timeline(
      [
        {
          ms: K.windupMs,
          enter: () => {
            this.caption("TROMBA D'ÁGUA");
            o.setVelocity(0, 0);
            this.pose(this.frame("raise"));
            sp = { x: o.x, y: o.y + 20 };
            const img = s.add.sprite(sp.x, sp.y, "px_spout", 0).setOrigin(0.5, 1).setScale(S, 0).setDepth(sp.y + 10000).play("spout_spin");
            sp.img = img;
            zone = new ZoneTele(s, sp.x, sp.y, K.r, PAL.ice2, 0.7);
            bag.push(img, zone);
            this.sfx("sfx_wave", { volume: 0.5, rate: 0.7 });
          },
          tick: (k) => {
            sp.img.setScale(S, S * k);
            zone.draw(k);
            this.threat = { zones: [{ id: "tromba", x: sp.x, y: sp.y, r: K.r }] }; // id: a mesma coluna, andando
          },
        },
        {
          ms: K.chaseMs,
          tick: (k, dt) => {
            const p = this.p;
            const a = Math.atan2(p.y - sp.y, p.x - sp.x);
            const v = (K.speed * this.slow() * dt) / 1000;
            sp.x += Math.cos(a) * v;
            sp.y += Math.sin(a) * v;
            sp.img.setPosition(sp.x, sp.y).setDepth(sp.y + 10000);
            zone.x = sp.x;
            zone.y = sp.y;
            zone.draw(1);
            this.threat = { zones: [{ id: "tromba", x: sp.x, y: sp.y, r: K.r }] }; // id: a mesma coluna, andando
            this._lights = [{ x: sp.x, y: sp.y - 40, r: 150, c: 0x5cc8ff, a: 0.7 }];
            if (Math.random() < 0.4) this._splash(sp.x, sp.y, 1, 30);
            const d = distTo(p, sp.x, sp.y);
            if (d < K.r + 60) wasNear = true;
            if (!hitOnce && d < K.r + 6) {
              hitOnce = true;
              if (this.log.hit(K.dmg)) p.shove?.(Math.cos(a) * 280, Math.sin(a) * 280, 220);
            }
          },
          exit: () => zone.destroy(),
        },
        {
          ms: K.splashWarnMs,
          enter: () => {
            splashTele = new ZoneTele(s, sp.x, sp.y, K.splashR, PAL.ice2);
            bag.push(splashTele);
            this.threat = { zones: [{ x: sp.x, y: sp.y, r: K.splashR }] };
            wasNear = wasNear || distTo(this.p, sp.x, sp.y) < K.splashR + 40;
          },
          tick: (k) => {
            splashTele.draw(k);
            sp.img.setScale(S * (1 + 0.3 * k), S * (1 + 0.2 * k));
          },
          exit: () => splashTele.destroy(),
        },
        {
          ms: 380,
          enter: () => {
            sp.img.destroy();
            shockwave(s, sp.x, sp.y, K.splashR, PAL.ice2);
            this._splash(sp.x, sp.y, 22, K.splashR);
            s.cameras.main.shake(220, 0.01);
            this.sfx("sfx_splash", { volume: 0.85, rate: 0.8 });
            const d = distTo(this.p, sp.x, sp.y);
            if (d < K.splashR + 4) this.log.hit(K.splashDmg);
            else if (!hitOnce && wasNear) this.log.dodged();
            this._lights = [];
            this.threat = null;
          },
        },
        {
          ms: K.exposedMs,
          enter: () => {
            this.pose(this.frame("idle"));
            this.weak.open(K.exposedMs, BOSS_FIGHT.EXPOSED_MULT, "CANSADO!");
          },
          tick: () => o.setAngle(Math.sin(s.time.now / 60) * 2),
          exit: () => o.setAngle(0),
        },
      ],
      bag,
      () => this.restore(),
    );
  }

  // CHAMADO DO SERTÃO: calangos e carcarás (não conta para o "desviou de tudo")
  m_summon() {
    const tl = this.timeline(
      [
        {
          ms: 600,
          enter: () => {
            this.caption("CHAMADO DO SERTÃO");
            this.o.setVelocity(0, 0);
            this.pose(this.frame("raise"));
            this.sfx("sfx_boss_roar", { volume: 0.5, rate: 1.15 });
          },
          exit: () => {
            this._summon("wolf", 3);
            if (this.phase === 2) this._summon("crow", 2);
          },
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

registerBoss("caboclo", { tex: "mon_caboclo", idle: "caboclo_idle", fury: "caboclo_fury", scale: 1.15, body: [10, 14, 32], furySpeed: 92, Brain: CabocloBrain });
