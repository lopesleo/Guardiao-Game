// Clareira da Caatinga (skin grátis do acampamento, docs/COSMETICOS.md): o mundo do sertão por cima do MESMO mapa da
// Clareira — horta, obras, lago, cozinha, fogueira, Mural, Anciã e botões continuam no lugar e funcionando. Aqui fica
// o que só existe no sertão: o chão vermelho com placas de barro rachado, a borda de caatinga (aberta ao norte para o
// horizonte), o céu pela hora com a serra, a lua grande e o sol, o juazeiro, os mandacarus com a flor que abre à
// noite, o calango, as asas-brancas, o carcará e a poeira. Arte em src/art/CampSertao.js.
// Mixin da CampScene (Object.assign). Liga com this._sertao (decidido no create).
import { GAME } from "../config.js";
import { PAL } from "../art/Palette.js";
import { mixColor } from "../art/Gradients.js";
import { BAND, PHASES, MANDACARU_TIPS, FLOWER_OPEN, FLOWER_BREATH, CALANGO, BIRD_DIRS, ASA_FLAP, CARCARA_DIRS } from "../art/CampSertao.js";
import { decorFree } from "./CampDecor.js";

const S = GAME.PIXEL_SCALE;
const CAMP_W = 1500,
  CAMP_H = 1100;
const TOP = -CAMP_H / 2;
export const HORIZON = TOP + 10; // linha do horizonte ao norte (o céu e a serra ficam acima dela)
const TRAIL_HALF = 70;
const D_NIGHT = 50000;
const D_SKY = -8.95e5; // céu: acima do chão pintado (-9,5e5) e dos decalques (-9e5), abaixo de tudo que tem altura
const D_GROUNDFX = -8.6e5; // sombras dos bichos voando e poeira rente ao chão
const D_AIR = D_NIGHT - 6; // pássaros no alto (acima do mundo, abaixo da noite e das luzes)
const TAU = Math.PI * 2;

// Céu pela hora no sertão (cor da camada de "noite" em multiply e o quanto as luzes aparecem): manhã quente, dia de
// sol a pino, poente de fogo que passa pelo vermelho e pelo roxo, noite de lua (um azul mais claro que o da mata)
const SKY_SERTAO = [
  [0, 0x58689e, 1],
  [5, 0x58689e, 1],
  [6.2, 0xd8908a, 0.6], // amanhecer rosado
  [7.4, 0xffe2c4, 0.12], // manhã quente
  [8.6, 0xffffff, 0],
  [16, 0xffffff, 0],
  [17.3, 0xf6b07a, 0.25], // fim de tarde dourado
  [18.4, 0xd0707a, 0.55], // poente vermelho
  [19.4, 0x7a62a8, 0.85], // anoitecer roxo
  [20.4, 0x58689e, 1],
  [24, 0x58689e, 1],
];
export function sertaoSkyAt(hour) {
  for (let i = 0; i < SKY_SERTAO.length - 1; i++) {
    const [h0, c0, k0] = SKY_SERTAO[i],
      [h1, c1, k1] = SKY_SERTAO[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = (hour - h0) / (h1 - h0 || 1);
      return { color: mixColor(c0, c1, t), k: k0 + (k1 - k0) * t };
    }
  }
  return { color: SKY_SERTAO[0][1], k: 1 };
}
// Fase do horizonte pela hora: [hora, fase]; entre duas marcas a cena mistura as duas
const BAND_KEYS = [[0, "night"], [4.8, "night"], [6.2, "dawn"], [7.4, "dawn"], [8.8, "day"], [15.8, "day"], [17.4, "dusk"], [18.6, "dusk"], [19.9, "night"], [24, "night"]];
function bandMix(hour) {
  for (let i = 0; i < BAND_KEYS.length - 1; i++) {
    const [h0, a] = BAND_KEYS[i],
      [h1, b] = BAND_KEYS[i + 1];
    if (hour >= h0 && hour <= h1) return { a, b, t: a === b ? 0 : (hour - h0) / (h1 - h0) };
  }
  return { a: "night", b: "night", t: 0 };
}
// Peso da noite (0 dia, 1 noite) para estrelas, lua e flores
const nightW = (hour) => (hour >= 20 || hour < 4.8 ? 1 : hour < 6.4 ? 1 - (hour - 4.8) / 1.6 : hour > 18.4 ? (hour - 18.4) / 1.6 : 0);
// Rumo (0 = leste, sentido horário) → índice do quadro (16 rumos)
const dirOf = (vx, vy, n) => ((Math.round(Math.atan2(vy / 0.8, vx) / (TAU / n)) % n) + n) % n;

export const CampSertao = {
  // ---------------------------------------------------------------------------
  // CHÃO: decalques de barro rachado e de terra clara (fora das trilhas e dos lugares)
  // ---------------------------------------------------------------------------
  _sertaoGround() {
    const rnd = new Phaser.Math.RandomDataGenerator(["sertao"]);
    const put = (key, n, frames, pad) => {
      for (let i = 0, tries = 0; i < n && tries < n * 12; tries++) {
        const x = rnd.between(-CAMP_W / 2 + 40, CAMP_W / 2 - 40),
          y = rnd.between(HORIZON + 40, CAMP_H / 2 - 20);
        if (Math.hypot(x, (y - 70) * 1.3) < 210 || this.groundPaint.onPath(x, y, pad) || !decorFree(x, y)) continue;
        this.add.image(x, y, key, rnd.between(0, frames - 1)).setScale(S).setFlipX(rnd.frac() < 0.5).setDepth(-9e5);
        i++;
      }
    };
    put("camp_sertao_crack", 26, 3, 60);
    put("camp_sertao_sand", 14, 2, 40);
  },

  // ---------------------------------------------------------------------------
  // BORDA: caatinga em volta (juazeiros, árvores secas, mandacarus, xique-xique). Ao norte o sertão é aberto: só
  // mato baixo e a cerca de varas na linha do horizonte (tingidos pela hora: ficam fora da camada da noite)
  // ---------------------------------------------------------------------------
  _sertaoBorder() {
    const env = this.registry.get("envKeysCaatinga");
    const tex = this.textures.get("env_caatinga");
    const rnd = new Phaser.Math.RandomDataGenerator(["caatinga"]);
    const tall = [...env.trees, ...env.trees, ...env.pines];
    const low = [...env.bushes, ...env.flowers];
    this._skyline = [];
    // nada que fique abaixo do horizonte pode passar dele (a parte de cima ficaria fora da noite)
    const fits = (y, frame) => y - tex.get(frame).height * S >= HORIZON - 2;
    const put = (x, y, list, shadow = true) => {
      let f = rnd.pick(list);
      if (!fits(y, f)) f = rnd.pick(low);
      if (!fits(y, f)) return;
      if (shadow) this.add.image(x, y + 4, "px_shadow").setScale(6, 2.6).setAlpha(0.45).setDepth(y - 1);
      this.add.image(x, y, "env_caatinga", f).setOrigin(0.5, 1).setScale(S).setDepth(y).setFlipX(rnd.frac() < 0.5);
    };
    for (let row = 0; row < 3; row++) {
      const off = row * 70;
      for (let x = -CAMP_W / 2 - 120; x <= CAMP_W / 2 + 120; x += 64 + rnd.between(0, 30)) put(x, CAMP_H / 2 + 240 + off + rnd.between(-10, 10), tall); // sul
      for (let y = TOP + 60; y <= CAMP_H / 2 + 60; y += 60 + rnd.between(0, 20)) {
        put(-CAMP_W / 2 - 30 - off + rnd.between(-10, 10), y, tall); // oeste
        put(CAMP_W / 2 + 30 + off + rnd.between(-10, 10), y, tall); // leste
      }
    }
    // norte: mato baixo esparso entre o horizonte e o fim do terreiro (a trilha livre)
    for (let x = -CAMP_W / 2 - 60; x <= CAMP_W / 2 + 60; x += 70 + rnd.between(0, 60)) {
      if (Math.abs(x) < TRAIL_HALF + 40) continue;
      put(x, HORIZON + 46 + rnd.between(0, 40), low, false);
    }
    // na linha do horizonte: a cerca de varas (dos dois lados da trilha), xique-xique e um mandacaru aqui e ali
    const sky = (o) => (this._skyline.push(o), o);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -CAMP_W / 2 - 80 : TRAIL_HALF + 60,
        x1 = side < 0 ? -TRAIL_HALF - 60 : CAMP_W / 2 + 80;
      sky(this.add.tileSprite(x0, HORIZON + 2, Math.round((x1 - x0) / S), 14, "garden_sertao_fence").setOrigin(0, 1).setScale(S).setDepth(HORIZON + 2));
      sky(this.add.image(side < 0 ? x1 : x0, HORIZON + 3, "garden_sertao_fence_post").setOrigin(0.5, 1).setScale(S).setDepth(HORIZON + 3));
    }
    for (let x = -CAMP_W / 2 - 40; x <= CAMP_W / 2 + 40; x += 110 + rnd.between(0, 90)) {
      if (Math.abs(x) < TRAIL_HALF + 50) continue;
      const big = rnd.frac() < 0.35;
      const f = big ? rnd.pick(env.pines) : rnd.pick(env.bushes);
      sky(this.add.image(x, HORIZON + 3, "env_caatinga", f).setOrigin(0.5, 1).setScale(big ? S * 0.7 : S).setDepth(HORIZON + 4).setFlipX(rnd.frac() < 0.5));
    }
  },

  // ---------------------------------------------------------------------------
  // HORIZONTE: céu e silhuetas (duas fases misturadas pela hora), estrelas, lua, sol, nuvens e pássaros ao longe
  // ---------------------------------------------------------------------------
  _sertaoSky() {
    const bw = BAND.w * S,
      bh = BAND.h * S;
    const x0 = -bw / 2,
      y0 = HORIZON - bh;
    this.band = { sky: {}, land: {}, stars: [], y0, bw, bh };
    const b = this.band;
    for (const ph of PHASES) {
      b.sky[ph] = this.add.image(x0, y0, `camp_sertao_sky_${ph}`).setOrigin(0).setScale(S).setDepth(D_SKY).setVisible(false);
      b.land[ph] = this.add.image(x0, y0, `camp_sertao_land_${ph}`).setOrigin(0).setScale(S).setDepth(D_SKY + 4).setVisible(false);
    }
    // estrelas (cintilam; somem com o dia)
    const rnd = new Phaser.Math.RandomDataGenerator(["estrelas"]);
    for (let i = 0; i < 70; i++) {
      const s = this.add.image(rnd.between(-bw / 2, bw / 2), y0 + rnd.frac() * bh * 0.82, i % 7 ? "px_dot1" : "px_dot2").setScale(S).setTint(i % 9 ? PAL.white : PAL.yel3).setDepth(D_SKY + 1);
      b.stars.push({ s, base: 0.25 + rnd.frac() * 0.7, ph: rnd.frac() * TAU, sp: 600 + rnd.frac() * 1600 });
    }
    // lua (com halo) e sol (com halo): atrás da serra, na frente do céu
    b.moonHalo = [
      this.add.image(0, 0, "fx_glow").setScale(9).setTint(PAL.ice3).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_SKY + 2),
      this.add.image(0, 0, "fx_glow").setScale(4).setTint(PAL.moon2).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_SKY + 2),
    ];
    b.moon = this.add.image(0, 0, "camp_sertao_lua").setScale(S).setDepth(D_SKY + 2.5);
    b.sunHalo = [
      this.add.image(0, 0, "fx_glow").setScale(14, 8).setTint(PAL.poente4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_SKY + 2),
      this.add.image(0, 0, "fx_glow").setScale(5).setTint(PAL.sun0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_SKY + 2),
    ];
    b.sun = this.add.image(0, 0, "camp_sertao_sol").setScale(S).setDepth(D_SKY + 2.5);
    // nuvens finas e compridas (tingidas pela hora), devagar para leste
    b.clouds = [];
    for (let i = 0; i < 3; i++) {
      const c = this.add.image(-bw / 2 + rnd.frac() * bw, y0 + bh * (0.2 + i * 0.17), `camp_sertao_cloud${i}`).setScale(S).setDepth(D_SKY + 3).setAlpha(0.5);
      b.clouds.push({ c, v: 4 + i * 2.5 });
    }
    // pássaros ao longe: um bando cruza o céu de vez em quando (amanhecer e fim de tarde)
    b.far = [];
    b.nextFar = 4000;
    // tick próprio: estrelas cintilando, nuvens andando, bando ao longe
    const tick = (time, dt) => this._sertaoSkyTick(time, dt);
    this.events.on("update", tick);
    this.events.once("shutdown", () => this.events.off("update", tick));
  },

  _sertaoSkyTick(time, dt) {
    const b = this.band;
    if (!b) return;
    const nw = this._nightW ?? 0;
    for (const st of b.stars) st.s.setAlpha(nw * st.base * (0.55 + 0.45 * Math.sin(time / st.sp + st.ph)));
    for (const cl of b.clouds) {
      cl.c.x += (cl.v * dt) / 1000;
      if (cl.c.x > b.bw / 2 + 200) cl.c.x = -b.bw / 2 - 200;
    }
    // bando de pássaros ao longe (só com luz de dia ou de poente)
    b.nextFar -= dt;
    if (b.nextFar <= 0) {
      b.nextFar = 14000 + Math.random() * 16000;
      if (nw < 0.6) this._farFlock();
    }
    for (const f of b.far) {
      f.t += dt;
      const u = f.t / f.dur;
      f.s.setPosition(f.x0 + (f.x1 - f.x0) * u, f.y0 + Math.sin(u * Math.PI) * -18 + Math.sin(f.t / 400 + f.ph) * 2);
      f.s.setFrame([0, 1, 2, 3][Math.floor((f.t + f.ph * 100) / 110) % 4]);
      if (u >= 1) f.s.destroy();
    }
    b.far = b.far.filter((f) => f.t < f.dur);
    // estrela cadente de vez em quando, à noite
    if (nw > 0.8 && Math.random() < dt / 22000) this._shootingStar();
  },

  _farFlock() {
    const b = this.band;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = b.y0 + b.bh * (0.35 + Math.random() * 0.35);
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const s = this.add.sprite(0, 0, "camp_sertao_ave", 0).setScale(S).setDepth(D_SKY + 3.5).setTint(this._landTint ?? 0xffffff);
      const lag = i * 26 + Math.random() * 14;
      b.far.push({ s, x0: -dir * (b.bw / 2 + 40 + lag), x1: dir * (b.bw / 2 + 40 - lag), y0: y + (i % 2 ? 10 : -6) + Math.random() * 8, t: 0, dur: 26000 + Math.random() * 3000, ph: Math.random() * 10 });
    }
  },

  _shootingStar() {
    const b = this.band;
    const x = (Math.random() - 0.5) * b.bw * 0.8,
      y = b.y0 + b.bh * (0.1 + Math.random() * 0.35);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const s = this.add.image(x, y, "camp_sertao_streak").setScale(S).setFlipX(dir < 0).setRotation(dir * 0.32).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_SKY + 1.5);
    this.tweens.add({ targets: s, x: x + dir * 220, y: y + 75, duration: 700, ease: "Sine.easeIn" });
    this.tweens.add({ targets: s, alpha: { from: 0, to: 0.9 }, duration: 160, yoyo: true, hold: 300, onComplete: () => s.destroy() });
  },

  // Aplica a hora no horizonte, na luz das flores e na cor do que fica fora da camada da noite
  _sertaoTime(hour, sky, cold) {
    const b = this.band;
    const nw = (this._nightW = nightW(hour));
    if (b) {
      const m = bandMix(hour);
      for (const ph of PHASES) {
        const on = ph === m.a || (ph === m.b && m.t > 0);
        const a = ph === m.a ? 1 : m.t;
        b.sky[ph].setVisible(on).setAlpha(a);
        b.land[ph].setVisible(on).setAlpha(a);
      }
      // nuvens: brancas de dia, rosadas no poente e no amanhecer, azul-escuro à noite
      const cloudTint = hour < 5 || hour > 20 ? PAL.luar3 : hour < 8 ? PAL.dawn5 : hour < 16 ? PAL.white : hour < 18.8 ? PAL.poente4 : PAL.poente1;
      for (const cl of b.clouds) cl.c.setTint(cloudTint).setAlpha(hour < 5 || hour > 20 ? 0.3 : hour > 8 && hour < 16 ? 0.75 : 0.6);
      // lua: nasce a leste no fim da tarde, cruza a noite e se põe a oeste; grande e dourada perto do horizonte
      const mu = ((hour - 18 + 24) % 24) / 12.4;
      const moonUp = mu >= 0 && mu <= 1;
      const mx = 720 - mu * 1440,
        my = HORIZON - 18 - Math.sin(mu * Math.PI) * 150;
      const low = Math.min(1, Math.sin(mu * Math.PI) * 2.2);
      const mt = mixColor(0xffc27a, 0xffffff, Math.max(0, low));
      b.moon.setVisible(moonUp).setPosition(Math.round(mx / S) * S, Math.round(my / S) * S).setTint(mt);
      b.moonHalo.forEach((g, i) => g.setVisible(moonUp).setPosition(mx, my).setAlpha((i ? 0.32 : 0.16) * Math.max(0.35, nw)).setTint(i ? mt : mixColor(0xffb070, PAL.ice3, Math.max(0, low))));
      // sol: só aparece baixo (amanhecer a leste, poente a oeste); de dia ele está alto demais para a faixa
      let sun = null;
      if (hour >= 5.2 && hour <= 8.4) {
        const u = (hour - 5.2) / 3.2;
        sun = { x: 640 - u * 160, y: HORIZON + 30 - u * 190, tint: mixColor(0xff8a4a, 0xfff3cc, u) };
      } else if (hour >= 15.8 && hour <= 19) {
        const u = (hour - 15.8) / 3.2;
        sun = { x: -500 - u * 180, y: HORIZON - 160 + u * 190, tint: mixColor(0xfff3cc, 0xff6a3a, u) };
      }
      b.sun.setVisible(!!sun);
      b.sunHalo.forEach((g) => g.setVisible(!!sun));
      if (sun) {
        b.sun.setPosition(Math.round(sun.x / S) * S, Math.round(sun.y / S) * S).setTint(sun.tint);
        b.sunHalo[0].setPosition(sun.x, sun.y).setAlpha(0.3).setTint(mixColor(sun.tint, PAL.poente4, 0.5));
        b.sunHalo[1].setPosition(sun.x, sun.y).setAlpha(0.5).setTint(sun.tint);
      }
    }
    // o que fica no horizonte (fora da camada da noite) escurece pela mesma cor da borda dela
    this._landTint = cold;
    for (const o of this._skyline ?? []) o.setTint(cold);
    // flores do mandacaru: abrem quando escurece, fecham com o dia
    const open = nw > 0.45;
    for (const fl of this._flowers ?? []) this._flowerState(fl, open);
  },

  // ---------------------------------------------------------------------------
  // PLANTAS do terreiro: o juazeiro (no lugar da samaúma), mandacarus com flor, coroa-de-frade, xique-xique,
  // macambira e lajedos (no lugar das helicônias e das pedras com samambaia), pote de barro
  // ---------------------------------------------------------------------------
  _sertaoTree(kx, ky) {
    this.add.image(kx + 10, ky + 8, "px_shadow").setScale(24, 7).setAlpha(0.55).setDepth(ky - 1);
    const tree = this.add.sprite(kx, ky, "camp_sertao_juazeiro", 0).setOrigin(0.5, 1).setScale(S).setDepth(ky);
    this._solid(kx, ky - 14, 70, 26);
    // a copa mexe em onda (8 quadros); a mesma onda do vento da Clareira, de oeste para leste
    let f = 0;
    this.time.delayedCall(this._wind(kx) % 900, () =>
      this.time.addEvent({ delay: 130, loop: true, callback: () => tree.active && tree.setFrame((f = (f + 1) % 8)) }),
    );
    // pote de barro na sombra do juazeiro e duas toras de sentar
    this.add.image(kx + 96, ky + 26, "px_shadow").setScale(3, 1.6).setAlpha(0.5).setDepth(ky + 25);
    this.add.image(kx + 96, ky + 28, "camp_sertao_pote").setOrigin(0.5, 1).setScale(S).setDepth(ky + 28);
    this._solid(kx + 96, ky + 22, 30, 10);
    // juás e folhas que caem da copa de vez em quando
    this.time.addEvent({
      delay: 1700,
      loop: true,
      callback: () => {
        if (Math.random() < 0.5) return;
        const x = kx + (Math.random() - 0.5) * 240,
          y = ky - 200 + Math.random() * 60;
        const leaf = this.add.sprite(x, y, "px_leaf_tumble", 0).setScale(S).setTint(Math.random() < 0.3 ? PAL.yel2 : PAL.g4).setDepth(ky + 40).play("leaf_tumble");
        this.tweens.add({ targets: leaf, y: ky - 10 + Math.random() * 50, x: x + 30 + Math.random() * 40, duration: 2600, ease: "Sine.easeIn", onComplete: () => this.tweens.add({ targets: leaf, alpha: 0, delay: 1200, duration: 600, onComplete: () => leaf.destroy() }) });
      },
    });
    return tree;
  },

  // Mandacaru grande com as flores nas pontas (i = qual dos três desenhos)
  _sertaoMandacaru(x, y, i) {
    const tex = this.textures.get(`camp_sertao_mandacaru${i}`).getSourceImage();
    this.add.image(x + 4, y + 4, "px_shadow").setScale(4, 2).setAlpha(0.5).setDepth(y - 1);
    this.add.image(x, y, `camp_sertao_mandacaru${i}`).setOrigin(0.5, 1).setScale(S).setDepth(y);
    this._solid(x, y - 6, 26, 12);
    this._flowers ||= [];
    for (const t of MANDACARU_TIPS[i] ?? []) {
      const fx = x + (t.x + 0.5 - tex.width / 2) * S,
        fy = y - (tex.height - t.y) * S + S;
      const s = this.add.sprite(fx, fy, "camp_sertao_flower", 0).setOrigin(0.5, 1).setScale(S).setDepth(y + 1);
      const glow = this.add.image(fx, fy - 12, "fx_glow").setScale(0.7).setTint(PAL.cream).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D_NIGHT + 1);
      glow._ownAlpha = true; // abre e fecha com a flor (o laço das luzes da hora não mexe)
      this._flowers.push({ s, glow, open: null, ph: Math.random() * 4, busy: null });
    }
  },

  // Abre/fecha uma flor (quadros intermediários, com um atraso diferente para cada flor: elas não abrem juntas)
  _flowerState(fl, open, instant = false) {
    if (fl.open === open) return;
    const first = fl.open === null;
    fl.open = open;
    fl.busy?.remove(false);
    fl.busy = null;
    const seq = open ? FLOWER_OPEN : [...FLOWER_OPEN].reverse();
    if (first || instant) {
      fl.s.setFrame(seq.at(-1));
      fl.glow.setAlpha(open ? 0.35 : 0);
      return;
    }
    let k = 0;
    // cada flor no seu tempo (não abrem juntas), depois os quadros um a um
    fl.busy = this.time.delayedCall(Math.random() * 2400, () => {
      fl.busy = this.time.addEvent({
        delay: 260,
        repeat: seq.length - 1,
        callback: () => {
          if (!fl.s.active) return;
          fl.s.setFrame(seq[k++]);
          if (k >= seq.length) {
            fl.busy = null;
            this.tweens.add({ targets: fl.glow, alpha: open ? 0.35 : 0, duration: 700 });
          }
        },
      });
    });
  },

  // Tudo o que é planta e coisa do sertão em volta dos lugares (as posições das helicônias e das pedras de sempre)
  _sertaoPlants() {
    const env = this.registry.get("envKeysCaatinga");
    this._sertaoMandacaru(-360, -50, 0); // ao lado do Santuário
    this._sertaoMandacaru(575, -40, 1); // entre a Forja e o açude
    this._sertaoMandacaru(-560, 300, 2); // perto do Mural
    this._sertaoMandacaru(130, -250, 2); // na subida da trilha
    // lajedo grande com xique-xique (no lugar das pedras com samambaia) — o calango mora aqui
    this.add.image(230, -300, "env_caatinga", "lajedo3").setOrigin(0.5, 1).setScale(S).setDepth(-300);
    this.add.image(262, -296, "env_caatinga", "xique0").setOrigin(0.5, 1).setScale(S).setDepth(-296);
    this._solid(225, -310, 70, 20);
    // coroas-de-frade, xique-xiques e macambiras perto das construções
    const spots = [[-500, -150, "frade"], [520, -60, "xique1"], [360, -150, "macambira1"], [-330, 330, "frade"], [200, 470, "xique0"], [-175, 530, "macambira0"], [560, 250, "frade"], [-650, 220, "xique1"], [120, -250, "macambira2"], [-640, -60, "lajedo1"], [640, 380, "lajedo2"]];
    spots.forEach(([x, y, f], i) => {
      if (f === "frade") this.add.image(x, y, "camp_sertao_frade", i % 2).setOrigin(0.5, 1).setScale(S).setDepth(y);
      else this.add.image(x, y, "env_caatinga", f).setOrigin(0.5, 1).setScale(S).setDepth(y);
    });
    void env;
  },

  // ---------------------------------------------------------------------------
  // VIDA: calangos, asas-brancas, carcará e a poeira levantando (e um redemoinho passando de vez em quando)
  // ---------------------------------------------------------------------------
  _sertaoLife() {
    this._lizards = [];
    for (const [x, y, home] of [[226, -322, [[180, -280], [300, -260], [226, -322]]], [-120, 300, [[-170, 300], [-60, 330], [-140, 360]]], [-470, 40, [[-420, 0], [-520, 70], [-470, 40]]]])
      this._lizards.push(this._calango(x, y, home));
    this._flock = null;
    this._nextFlock = 5000 + Math.random() * 6000;
    this._carcara = this._makeCarcara();
    this._nextDevil = 15000 + Math.random() * 10000;
    this._devils = [];
    const tick = (time, dt) => this._sertaoLifeTick(time, dt);
    this.events.on("update", tick);
    this.events.once("shutdown", () => this.events.off("update", tick));
    // poeira: o vento levanta um pouco de terra aqui e ali (rente ao chão, vai para leste)
    this.time.addEvent({
      delay: 380,
      loop: true,
      callback: () => {
        if (Math.random() > 0.45 || (this._nightW ?? 0) > 0.8) return;
        const wv = this.cameras.main.worldView;
        const x = wv.x + Math.random() * wv.width,
          y = Math.max(HORIZON + 30, wv.y + Math.random() * wv.height);
        this._dust(x, y, 0.3);
      },
    });
  },

  // Um sopro de poeira no chão (x, y), força a (0..1)
  _dust(x, y, a = 0.3, dx = 40) {
    const p = this.add.image(x, y, "px_puff").setScale(1.4 + Math.random()).setTint([PAL.batida2, PAL.batida1, PAL.terra4][Math.floor(Math.random() * 3)]).setAlpha(0).setDepth(y + 2);
    this.tweens.add({ targets: p, alpha: { from: 0, to: a }, duration: 260, yoyo: true, hold: 300 });
    this.tweens.add({ targets: p, x: x + dx + Math.random() * 20, y: y - 10 - Math.random() * 12, scale: p.scale * 2.2, duration: 1100, ease: "Sine.easeOut", onComplete: () => p.destroy() });
  },

  // Calango: mora em volta de uma pedra, faz flexões, olha em volta, corre para outro canto e foge do herói
  _calango(x, y, spots) {
    const shadow = this.add.image(x, y + 2, "px_shadow").setScale(2.6, 1.2).setAlpha(0.45);
    const s = this.add.sprite(x, y, "camp_sertao_calango", 0).setOrigin(0.5, 1).setScale(S);
    const L = { s, shadow, spots, state: "idle", until: 0, target: null, f: 0, ft: 0, seq: null, flip: Math.random() < 0.5 };
    s.setFlipX(L.flip);
    return L;
  },

  _calangoTick(L, time, dt) {
    const s = L.s;
    if (!s.active) return;
    const p = this.player;
    // foge do herói
    if (L.state !== "run" && p && Math.hypot(p.x - s.x, p.y + 20 - s.y) < 95) {
      const a = Math.atan2(s.y - p.y, s.x - p.x) + (Math.random() - 0.5) * 0.8;
      L.target = { x: s.x + Math.cos(a) * 150, y: s.y + Math.sin(a) * 90 };
      L.state = "run";
    }
    if (L.state === "run") {
      const dx = L.target.x - s.x,
        dy = L.target.y - s.y,
        d = Math.hypot(dx, dy);
      const sp = 300 * (dt / 1000);
      if (d <= sp) {
        s.setPosition(L.target.x, L.target.y);
        L.state = "idle";
        L.until = time + 600 + Math.random() * 900;
        s.setFrame(0);
        this._dust(s.x, s.y, 0.35, (s.flipX ? 1 : -1) * 10);
      } else {
        s.x += (dx / d) * sp;
        s.y += (dy / d) * sp;
        if (Math.abs(dx) > 2) s.setFlipX(dx > 0); // o desenho olha para a esquerda
        L.ft += dt;
        if (L.ft > 55) {
          L.ft = 0;
          L.f = (L.f + 1) % 4;
          s.setFrame(CALANGO.run[L.f]);
          if (L.f === 0 && Math.random() < 0.6) this._dust(s.x + (s.flipX ? -14 : 14), s.y, 0.22, (s.flipX ? -1 : 1) * 12);
        }
      }
    } else if (L.seq) {
      // sequência de quadros em andamento (flexões, olhar)
      L.ft += dt;
      if (L.ft >= L.seq[0][1]) {
        L.ft = 0;
        L.seq.shift();
        if (L.seq.length) s.setFrame(L.seq[0][0]);
        else {
          L.seq = null;
          s.setFrame(0);
          L.until = time + 900 + Math.random() * 1800;
        }
      }
    } else if (time > L.until) {
      const r = Math.random();
      if (r < 0.38) {
        // flexões (a exibição do calango): desce, sobe, desce, sobe... e para de peito erguido
        const n = 2 + Math.floor(Math.random() * 3);
        L.seq = [[0, 90]];
        for (let i = 0; i < n; i++) L.seq.push([2, 110], [3, 150]);
        L.seq.push([0, 200]);
      } else if (r < 0.6) L.seq = [[8, 700 + Math.random() * 600], [0, 120]];
      else if (r < 0.75) L.seq = [[1, 500], [0, 500], [1, 500], [0, 200]];
      else {
        const t = L.spots[Math.floor(Math.random() * L.spots.length)];
        L.target = { x: t[0] + (Math.random() - 0.5) * 30, y: t[1] + (Math.random() - 0.5) * 20 };
        L.state = "run";
        L.f = 0;
      }
      if (L.seq) {
        L.ft = 0;
        s.setFrame(L.seq[0][0]);
      }
    }
    s.setDepth(s.y);
    L.shadow.setPosition(s.x + (s.flipX ? 4 : -4), s.y + 2).setDepth(s.y - 1);
  },

  // Asas-brancas: um bando atravessa a Clareira em curva (sombras no chão); às vezes pousa no terreiro e cisca até o
  // herói chegar perto
  _startFlock() {
    const cam = this.cameras.main.worldView;
    const fromLeft = Math.random() < 0.5;
    const n = 3 + Math.floor(Math.random() * 3);
    const land = Math.random() < 0.55;
    // pouso: um canto aberto do chão, longe do herói, dentro da tela
    let spot = null;
    if (land)
      for (let k = 0; k < 20 && !spot; k++) {
        const x = cam.x + cam.width * (0.2 + Math.random() * 0.6),
          y = Math.max(HORIZON + 80, cam.y + cam.height * (0.3 + Math.random() * 0.55));
        if (Math.hypot(x - this.player.x, y - this.player.y) > 260 && decorFree(x, y) && Math.hypot(x, (y - 70) * 1.2) > 150) spot = { x, y };
      }
    const sx = fromLeft ? cam.x - 120 : cam.x + cam.width + 120,
      sy = cam.y + cam.height * (0.15 + Math.random() * 0.5);
    const ex = fromLeft ? cam.x + cam.width + 160 : cam.x - 160,
      ey = cam.y + cam.height * (0.2 + Math.random() * 0.6);
    const birds = [];
    for (let i = 0; i < n; i++) {
      const shadow = this.add.sprite(0, 0, "camp_sertao_asa_sombra", 0).setScale(S).setAlpha(0.22).setDepth(D_GROUNDFX);
      const s = this.add.sprite(0, 0, "camp_sertao_asa", 0).setScale(S).setDepth(D_AIR);
      birds.push({ s, shadow, off: { x: (i % 2 ? -1 : 1) * (18 + i * 14) + Math.random() * 10, y: i * 22 + Math.random() * 10 }, ph: Math.random() * 8, flapT: Math.random() * 400, f: 0, alt: 70, mode: "fly", walkT: 0, x: sx, y: sy, vx: 0, vy: 0 });
    }
    this._flock = { birds, t: 0, sx, sy, ex, ey, cx: (sx + ex) / 2 + (Math.random() - 0.5) * 200, cy: Math.min(sy, ey) - 80 - Math.random() * 120, spot, phase: spot ? "in" : "pass", dur: 7000 + Math.random() * 2500, groundUntil: 0 };
  },

  _flockTick(time, dt) {
    const F = this._flock;
    if (!F) return;
    F.t += dt;
    const p = this.player;
    // trajeto: curva de Bézier (entrada → pouso ou → saída)
    const bez = (a, c, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;
    let alive = false;
    for (const B of F.birds) {
      if (!B.s.active) continue;
      alive = true;
      let tx, ty;
      if (F.phase === "in" || F.phase === "pass") {
        const end = F.phase === "in" ? F.spot : { x: F.ex, y: F.ey };
        const u = Math.min(1, F.t / (F.phase === "in" ? 4200 : F.dur));
        tx = bez(F.sx, F.cx, end.x, u) + B.off.x * (1 - (F.phase === "in" ? u : 0) * 0.6);
        ty = bez(F.sy, F.cy, end.y, u) + B.off.y * (1 - (F.phase === "in" ? u : 0) * 0.6);
        B.alt = F.phase === "in" ? Math.max(0, 70 * (1 - u * u)) : 70 + Math.sin(F.t / 900 + B.ph) * 8;
      } else if (F.phase === "out") {
        const u = Math.min(1, (F.t - F.outAt) / 3600);
        tx = bez(B.gx, B.gx + (F.ex - B.gx) * 0.4, F.ex + B.off.x, u);
        ty = bez(B.gy, B.gy - 160, F.ey + B.off.y, u);
        B.alt = Math.min(80, u * 220);
      }
      if (F.phase === "ground") {
        // no chão: cisca, anda um passinho, levanta a cabeça
        B.walkT -= dt;
        if (B.walkT <= 0) {
          const r = Math.random();
          B.walkT = 300 + Math.random() * 700;
          if (r < 0.45) B.s.setFrame(2);
          else if (r < 0.75) {
            B.s.setFrame(1);
            B.gx += (B.s.flipX ? -1 : 1) * 6;
          } else B.s.setFrame(r < 0.88 ? 3 : 0);
          if (Math.random() < 0.15) B.s.setFlipX(!B.s.flipX);
        }
        B.s.setPosition(B.gx, B.gy).setDepth(B.gy);
        B.shadow.setVisible(false);
        continue;
      }
      // voo: a velocidade dá o rumo (16 desenhos) e a batida acelera na subida, plana na descida do pouso
      const vx = tx - B.x,
        vy = ty - B.y;
      B.x = tx;
      B.y = ty;
      const dir = Math.hypot(vx, vy) > 0.05 ? dirOf(vx, vy, BIRD_DIRS) : B.dir ?? 0;
      B.dir = dir;
      B.flapT += dt;
      const gliding = F.phase === "in" && F.t > 2600 && F.t < 3700;
      const fi = gliding ? 2 : ASA_FLAP[Math.floor((B.flapT + B.ph * 50) / 55) % 8];
      B.s.setFrame(dir * 8 + fi).setPosition(Math.round(B.x), Math.round(B.y - B.alt)).setDepth(B.alt > 6 ? D_AIR : B.y + 4);
      B.shadow.setFrame(dir).setVisible(true).setPosition(B.x + 10 + B.alt * 0.25, B.y + 6).setAlpha(0.2 * (1 - Math.min(0.6, B.alt / 200)));
    }
    if (F.phase === "in" && F.t >= 4200) {
      // pousou: vira o desenho do chão
      F.phase = "ground";
      F.groundUntil = F.t + 7000 + Math.random() * 6000;
      for (const B of F.birds) {
        B.gx = B.x;
        B.gy = B.y;
        B.s.setTexture("camp_sertao_asa_chao", 0).setFlipX(F.ex < F.sx);
        B.shadow.setVisible(false);
        B.foot = this.add.image(B.gx, B.gy + 1, "px_shadow").setScale(1.6, 0.8).setAlpha(0.35).setDepth(B.gy - 1);
      }
    }
    if (F.phase === "ground") {
      for (const B of F.birds) B.foot?.setPosition(B.gx, B.gy + 1);
      const scared = F.birds.some((B) => Math.hypot(p.x - B.gx, p.y + 20 - B.gy) < 150);
      if (scared || F.t > F.groundUntil) {
        // levanta voo (com um sopro de poeira)
        F.phase = "out";
        F.outAt = F.t;
        F.ex = F.birds[0].gx + (Math.random() < 0.5 ? -1 : 1) * 900;
        F.ey = F.birds[0].gy - 300;
        for (const B of F.birds) {
          B.s.setTexture("camp_sertao_asa", 0);
          B.foot?.destroy();
          B.x = B.gx;
          B.y = B.gy;
          this._dust(B.gx, B.gy, 0.3, 0);
        }
        if (scared) this.sound.play("sfx_whoosh", { volume: 0.12, rate: 1.6 });
      }
    }
    const doneOut = F.phase === "out" && F.t - F.outAt > 3600;
    const donePass = F.phase === "pass" && F.t > F.dur;
    if (!alive || doneOut || donePass) {
      for (const B of F.birds) {
        B.s.destroy();
        B.shadow.destroy();
        B.foot?.destroy();
      }
      this._flock = null;
    }
  },

  // Carcará: plana em círculos largos bem alto (de dia), a sombra correndo no chão
  _makeCarcara() {
    const shadow = this.add.sprite(0, 0, "camp_sertao_carcara_sombra", 0).setScale(S).setAlpha(0.16).setDepth(D_GROUNDFX);
    const s = this.add.sprite(0, 0, "camp_sertao_carcara", 0).setScale(S).setDepth(D_AIR + 1);
    return { s, shadow, a: Math.random() * TAU, cx: -100, cy: 0, R: 230, w: 0.32, t: 0, flap: 0 };
  },

  _carcaraTick(C, time, dt) {
    const day = (this._nightW ?? 0) < 0.5;
    C.s.setVisible(day);
    C.shadow.setVisible(day);
    if (!day) return;
    C.t += dt;
    C.a += (C.w * dt) / 1000;
    // o centro do círculo passeia devagar pela Clareira
    C.cx = Math.sin(C.t / 23000) * 380;
    C.cy = -40 + Math.sin(C.t / 31000 + 1) * 200;
    const x = C.cx + Math.cos(C.a) * C.R,
      y = C.cy + Math.sin(C.a) * C.R * 0.62;
    const vx = -Math.sin(C.a),
      vy = Math.cos(C.a) * 0.62;
    const dir = dirOf(vx, vy, CARCARA_DIRS);
    // planando: as pontas das asas "respiram"; de vez em quando bate as asas três vezes
    if (C.flap <= 0 && Math.random() < dt / 9000) C.flap = 6;
    let f = [0, 1, 0, 2][Math.floor(C.t / 420) % 4];
    if (C.flap > 0) {
      f = C.flap % 2 ? 1 : 2;
      if (Math.floor((C.t - dt) / 130) !== Math.floor(C.t / 130)) C.flap--;
    }
    const alt = 260;
    C.s.setFrame(dir * 3 + f).setPosition(Math.round(x / S) * S, Math.round((y - alt) / S) * S);
    C.shadow.setFrame(dir).setPosition(x + 70, y + 30);
  },

  // Redemoinho de poeira atravessando a Clareira (cosmético; o da partida empurra — este só passa)
  _startDevil() {
    const cam = this.cameras.main.worldView;
    const fromLeft = Math.random() < 0.5;
    const y = Math.max(HORIZON + 120, cam.y + cam.height * (0.25 + Math.random() * 0.5));
    const motes = [];
    for (let i = 0; i < 22; i++) {
      const im = this.add.image(0, 0, i % 5 ? "px_puff" : "px_dot2").setTint([PAL.batida2, PAL.batida1, PAL.terra4][i % 3]).setAlpha(0);
      motes.push({ im, h: (i % 11) / 10, ph: Math.random() * TAU, skirt: i >= 18 });
    }
    const leaves = [];
    for (let i = 0; i < 3; i++) leaves.push({ im: this.add.sprite(0, 0, "px_leaf_tumble", i).setScale(S).setTint(i % 2 ? PAL.straw2 : PAL.straw1).play("leaf_tumble"), ph: Math.random() * TAU, h: 0.3 + i * 0.25 });
    const shadow = this.add.image(0, 0, "px_shadow").setScale(4, 2).setAlpha(0).setDepth(D_GROUNDFX);
    this._devils.push({ x: fromLeft ? cam.x - 60 : cam.x + cam.width + 60, y, vx: (fromLeft ? 1 : -1) * (70 + Math.random() * 30), age: 0, life: (cam.width + 120) / 85 * 1000, motes, leaves, shadow });
  },

  _devilTick(d, time, dt) {
    d.age += dt;
    d.x += (d.vx * dt) / 1000;
    d.y += Math.sin(d.age / 700) * 0.4;
    const life = Math.max(0, Math.min(1, d.age / 600, (d.life - d.age) / 600));
    const H = 96;
    d.shadow.setPosition(d.x, d.y + 2).setAlpha(0.3 * life);
    for (const m of d.motes) {
      const ang = time / (m.skirt ? 200 : 130) + m.ph + m.h * 4;
      const rad = m.skirt ? 30 + Math.sin(time / 300 + m.ph) * 5 : 6 + m.h * 28;
      const x = d.x + Math.cos(ang) * rad,
        y = (m.skirt ? d.y - 3 : d.y - m.h * H) + Math.sin(ang) * rad * (m.skirt ? 0.35 : 0.28);
      const front = Math.sin(ang) > 0;
      m.im.setPosition(x, y).setScale(S * (m.skirt ? 1 : 0.7 + m.h * 0.8)).setAlpha((front ? 0.7 : 0.4) * life).setDepth(front ? d.y + 12 : d.y - 12);
    }
    for (const l of d.leaves) {
      const ang = time / 160 + l.ph;
      l.im.setPosition(d.x + Math.cos(ang) * (10 + l.h * 26), d.y - l.h * H + Math.sin(ang) * 6).setAlpha(life).setDepth(Math.sin(ang) > 0 ? d.y + 13 : d.y - 13);
    }
    if (d.age >= d.life) {
      d.motes.forEach((m) => m.im.destroy());
      d.leaves.forEach((l) => l.im.destroy());
      d.shadow.destroy();
      d.dead = true;
    }
  },

  _sertaoLifeTick(time, dt) {
    if (!this.player) return;
    const day = (this._nightW ?? 0) < 0.5;
    for (const L of this._lizards ?? []) this._calangoTick(L, time, dt);
    if (this._carcara) this._carcaraTick(this._carcara, time, dt);
    this._nextFlock -= dt;
    if (!this._flock && this._nextFlock <= 0) {
      this._nextFlock = 16000 + Math.random() * 18000;
      if (day) this._startFlock();
    }
    this._flockTick(time, dt);
    this._nextDevil -= dt;
    if (this._nextDevil <= 0) {
      this._nextDevil = 30000 + Math.random() * 25000;
      if (day) this._startDevil();
    }
    for (const d of this._devils) this._devilTick(d, time, dt);
    this._devils = this._devils.filter((d) => !d.dead);
  },
};
