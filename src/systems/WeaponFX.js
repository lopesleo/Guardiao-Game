// Efeitos das armas — o "suco" de cada golpe: disparo, rastro, impacto, morte e
// status. Feito para celular: poucos emissores de partículas REAPROVEITADOS (um
// por material), um pool de imagens animadas à mão (clarões, anéis, rastros
// fantasmas) e marcas no chão com teto. Nada de criar/destruir objeto por golpe.
//
// Camadas: o que EMITE luz (faísca, brasa, gelo cintilante, raio) fica ACIMA do
// mapa de luz — à noite brilha em vez de escurecer junto com o chão. Fumaça fica
// abaixo (é matéria, recebe a luz da cena). Marcas no chão ficam no chão.
//
// Qualidade: com a iluminação desligada (aparelho fraco) tudo cai pela metade.
// Hit-stop: GameFeel congela também as partículas (setTimeScale).
import { PAL } from "../art/Palette.js";
import { Pix, bayer, rng } from "../art/PixelArt.js";

export const D_FX = 48600; // acima do mapa de luz (48500), abaixo do HUD (50000)
const D_SMOKE = 48400; // fumaça: abaixo do mapa de luz
const D_DECAL = -70; // chão (acima das sombras das árvores, abaixo de tudo)

// Paleta de cada elemento: núcleo (quase branco), meio, escuro e a cor da LUZ
export const ELEM = {
  fire: { core: PAL.yel3, mid: PAL.org2, dark: PAL.red1, light: 0xff8a3c, spark: [PAL.white, PAL.yel3, PAL.org3, PAL.org2] },
  ice: { core: PAL.white, mid: PAL.ice2, dark: PAL.ice1, light: 0x5cc8ff, spark: [PAL.white, PAL.ice3, PAL.ice3, PAL.ice2] },
  bolt: { core: PAL.white, mid: PAL.pur2, dark: PAL.pur1, light: 0xc78cff, spark: [PAL.white, PAL.pur3, PAL.pur3, PAL.pur2] },
  none: { core: PAL.white, mid: PAL.cream, dark: PAL.s3, light: 0xffe2b8, spark: [PAL.white, PAL.cream, PAL.yel3, PAL.cream] },
};
const el = (e) => ELEM[e] ?? ELEM.none;
const DEG = 180 / Math.PI;
// Explosão em pixel-art: bolas OPACAS que nascem grandes e encolhem (desbotar
// sobre a grama vira cor de terra). Esfriam do branco ao escuro do elemento.
const PUFF = { speed: { min: 25, max: 95 }, lifespan: { min: 180, max: 340 }, scale: { start: 1.7, end: 0.15 }, maxAliveParticles: 160 };
// Cauda: cores só CLARAS (escuro em blend aditivo sobre a grama vira "lama" oliva)
const TAIL = { speed: { min: 0, max: 16 }, lifespan: { min: 120, max: 220 }, scale: { start: 1.15, end: 0.1 }, maxAliveParticles: 220 };
const IMPACTS_PER_FRAME = 10; // golpes com efeito completo por quadro (o resto é mínimo)
const POOL = 64; // clarões/anéis/fantasmas simultâneos
const DECALS = 22;

// ---------------------------------------------------------------- texturas
function textures(scene) {
  if (scene.textures.exists("fx_star")) return;
  // Estrela de 4 pontas (clarão de impacto): miolo 3×3 e braços afinando
  const st = new Pix(13, 13);
  for (let i = -6; i <= 6; i++) {
    const w = Math.abs(i) <= 1 ? 1 : 0;
    for (let k = -w; k <= w; k++) {
      st.set(6 + i, 6 + k, PAL.white);
      st.set(6 + k, 6 + i, PAL.white);
    }
  }
  st.rect(5, 5, 3, 3, PAL.white);
  st.register(scene, "fx_star");
  // Anel fino de pixel (escala bem: o traço engrossa junto, fica "pixel-art")
  const R = 16;
  const rg = new Pix(R * 2, R * 2);
  for (let y = 0; y < R * 2; y++)
    for (let x = 0; x < R * 2; x++) {
      const d = Math.hypot(x + 0.5 - R, y + 0.5 - R);
      if (d <= R - 0.2 && d >= R - 1.6) rg.set(x, y, PAL.white);
    }
  rg.register(scene, "fx_ring");
  // Risco de velocidade (fantasma de golpe / faísca alongada)
  const sk = new Pix(10, 3);
  sk.rect(0, 1, 10, 1, PAL.white);
  sk.rect(3, 0, 5, 3, PAL.white);
  sk.register(scene, "fx_streak");
  // Estouro "POW": 8 pontas cheias (longas e curtas alternadas) — lê como pancada
  const B = 17,
    bc = (B - 1) / 2;
  const bu = new Pix(B, B);
  for (let y = 0; y < B; y++)
    for (let x = 0; x < B; x++) {
      const dx = x - bc,
        dy = y - bc;
      const a = Math.atan2(dy, dx);
      const spike = Math.pow(Math.abs(Math.cos(a * 4)), 6); // 8 pontas
      const long = Math.cos(a * 4) > 0 ? 1 : 0.62; // alterna longa/curta
      const r = 3.2 + spike * 5.3 * long;
      if (Math.hypot(dx, dy) <= r) bu.set(x, y, PAL.white);
    }
  bu.register(scene, "fx_burst");
  // Disco cheio (clarão do quadro do golpe)
  const dc = new Pix(16, 16);
  dc.disc(8, 8, 8, PAL.white);
  dc.register(scene, "fx_disc");
  // Marcas no chão (pixel-art com pontilhado Bayer): queimado e geada
  const decal = (key, seed, inner, outer, speck) => {
    const W = 30,
      H = 16,
      r = rng(seed);
    const p = new Pix(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5 - W / 2) / (W / 2),
          v = (y + 0.5 - H / 2) / (H / 2);
        const d = Math.sqrt(u * u + v * v) + (r() - 0.5) * 0.22;
        if (d > 1) continue;
        const t = 1 - d; // 1 no centro
        if (t > 0.45 || bayer(x, y) < t * 1.9) p.set(x, y, t > 0.55 ? inner : outer);
      }
    for (let i = 0; i < 9; i++) p.set(4 + r() * (W - 8), 3 + r() * (H - 6), speck);
    p.register(scene, key);
  };
  decal("fx_scorch", 7, PAL.ink, PAL.n1, PAL.org1);
  decal("fx_frost", 11, PAL.ice3, PAL.ice2, PAL.white);
}

// ---------------------------------------------------------------- módulo
export class WeaponFX {
  constructor(scene) {
    this.scene = scene;
    textures(scene);
    const add = (tex, cfg, depth = D_FX) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      e._defSpeed = cfg.speed; // burst() troca a velocidade por chamada e devolve esta
      return e;
    };
    // Partículas OPACAS: em blend aditivo a cor puxa para a do chão (amarelo na
    // grama vira lima). Ficam acima do mapa de luz, então seguem "acesas".
    const ADD = Phaser.BlendModes.NORMAL;
    this.em = {
      // Faísca: rápida, curta, tingida por chamada
      spark: add("px_dot2", { speed: { min: 90, max: 260 }, lifespan: { min: 140, max: 300 }, scale: { start: 1.7, end: 0.2 }, blendMode: ADD, maxAliveParticles: 260 }),
      // Brasa: sobe, esfria (branco → amarelo → laranja → vinho)
      ember: add("px_dot2", {
        speed: { min: 20, max: 110 },
        gravityY: -110,
        lifespan: { min: 380, max: 820 },
        scale: { start: 1.8, end: 0.3 },
        color: [PAL.white, PAL.yel3, PAL.org2, PAL.red1],
        colorEase: "quad.out",
        blendMode: ADD,
        maxAliveParticles: 260,
      }),
      // Geada cintilante: leve, flutua e some
      frost: add("px_dot2", {
        speed: { min: 10, max: 70 },
        gravityY: -25,
        lifespan: { min: 420, max: 900 },
        scale: { start: 1.6, end: 0 },
        color: [PAL.white, PAL.ice3, PAL.ice2, PAL.ice1],
        blendMode: ADD,
        maxAliveParticles: 220,
      }),
      // Centelha de raio: muito rápida e curtíssima
      zap: add("px_dot2", {
        speed: { min: 160, max: 380 },
        lifespan: { min: 90, max: 200 },
        scale: { start: 1.6, end: 0.4 },
        color: [PAL.white, PAL.pur3, PAL.pur2],
        blendMode: ADD,
        maxAliveParticles: 200,
      }),
      // Luz de vaga-lume: rastro que fica para trás e se apaga
      glow: add("px_dot2", {
        speed: { min: 0, max: 14 },
        lifespan: { min: 260, max: 520 },
        scale: { start: 1.5, end: 0 },
        color: [PAL.white, 0xf4ff9a, PAL.g6, PAL.g4],
        blendMode: ADD,
        maxAliveParticles: 220,
      }),
      // Lascas de gelo: matéria (caem com gravidade e giram)
      shard: add("px_shard", {
        speed: { min: 90, max: 240 },
        gravityY: 560,
        lifespan: { min: 320, max: 560 },
        rotate: { min: 0, max: 360 },
        scale: { start: 2.6, end: 1.4 },
        alpha: { start: 1, end: 0 },
        maxAliveParticles: 120,
      }),
      // Folhas (redemoinho e morte na mata)
      leaf: add("px_leaf", {
        speed: { min: 40, max: 140 },
        gravityY: 60,
        lifespan: { min: 420, max: 760 },
        rotate: { min: 0, max: 360 },
        scale: { start: 2.6, end: 1.6 },
        alpha: { start: 1, end: 0 },
        maxAliveParticles: 90,
      }),
      // Risco de faísca: alinhado ao voo (gira junto com a velocidade)
      streak: add("fx_streak", {
        speed: { min: 150, max: 360 },
        lifespan: { min: 110, max: 230 },
        scale: { start: 1.5, end: 0.3 },
        rotate: { onEmit: () => 0, onUpdate: (p) => Math.atan2(p.velocityY, p.velocityX) * DEG },
        blendMode: ADD,
        maxAliveParticles: 200,
      }),
      // Volume do golpe (baforada que incha e some), uma por elemento
      puff_fire: add("px_puff", { ...PUFF, color: [PAL.white, PAL.yel2, PAL.org2, PAL.org1, PAL.red1], blendMode: ADD }),
      puff_ice: add("px_puff", { ...PUFF, color: [PAL.white, PAL.ice3, PAL.ice2, PAL.ice1], blendMode: ADD }),
      puff_bolt: add("px_puff", { ...PUFF, color: [PAL.white, PAL.pur3, PAL.pur2, PAL.pur1], blendMode: ADD }),
      // Cauda de projétil (encolhe enquanto fica para trás)
      tail_fire: add("px_puff", { ...TAIL, color: [PAL.yel3, PAL.yel2, PAL.org2, PAL.org1], blendMode: ADD }),
      tail_ice: add("px_puff", { ...TAIL, color: [PAL.ice3, PAL.ice2, PAL.ice2], blendMode: ADD }),
      tail_bolt: add("px_puff", { ...TAIL, color: [PAL.pur3, PAL.pur2, PAL.pur2], blendMode: ADD }),
      // Jato de chamas (Sopro): nasce pequeno e branco, cresce e esfria
      jet_fire: add("px_puff", {
        speed: { min: 300, max: 600 },
        lifespan: { min: 190, max: 290 },
        scale: { start: 0.45, end: 2.4 },
        color: [PAL.white, PAL.yel3, PAL.yel2, PAL.org2, PAL.org1, PAL.red1],
        blendMode: ADD,
        maxAliveParticles: 260,
      }),
      // Fumaça / poeira: abaixo do mapa de luz
      smoke: add(
        "px_puff",
        {
          speed: { min: 8, max: 44 },
          gravityY: -26,
          lifespan: { min: 420, max: 780 },
          scale: { start: 0.9, end: 2.8 },
          alpha: { start: 0.5, end: 0 },
          maxAliveParticles: 110,
        },
        D_SMOKE,
      ),
    };
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const img = scene.add.image(-9999, -9999, "fx_star").setVisible(false).setDepth(D_FX + 10);
      this.pool.push({ img, live: false });
    }
    this.decals = [];
    for (let i = 0; i < DECALS; i++) {
      const img = scene.add.image(-9999, -9999, "fx_scorch").setVisible(false).setDepth(D_DECAL);
      this.decals.push({ img, live: false, t: 0, dur: 1 });
    }
    this._frameImpacts = 0;
    this._ts = 1;
  }

  get q() {
    return this.scene.lighting?.enabled === false ? 0.5 : 1;
  }
  _n(k) {
    return Math.max(1, Math.round(k * this.q));
  }

  // Hit-stop: as partículas congelam junto com o mundo
  setTimeScale(k) {
    this._ts = k;
    for (const e of Object.values(this.em)) e.timeScale = k;
  }

  // ------------------------------------------------------------ primitivas
  // Explosão de partículas num cone (graus) — dir em radianos, spread em graus
  burst(kind, x, y, n, dir = null, spread = 360, speed = null, tint = null) {
    const e = this.em[kind];
    if (!e || n <= 0) return;
    // Phaser 4: setEmitterAngle/setParticleSpeed (onChange) só trocam valor FIXO e
    // ignoram faixas {min,max}; recarregar o operador é o que muda cone e velocidade.
    const a = dir == null ? null : dir * DEG;
    e.ops.angle.loadConfig({ angle: a == null ? { min: 0, max: 360 } : { min: a - spread / 2, max: a + spread / 2 } });
    e.ops.speedX.loadConfig({ speed: speed ?? e._defSpeed }, "speed"); // a chave é a do config ("speed")
    e.ops.speedY.active = false;
    e.radial = true; // velocidade = rapidez × direção do ângulo
    // setParticleTint só aceita UMA cor (lista ou callback viram tinta PRETA):
    // com lista, emite uma a uma sorteando a cor
    const count = this._n(n);
    if (Array.isArray(tint)) {
      for (let i = 0; i < count; i++) {
        e.setParticleTint(tint[(Math.random() * tint.length) | 0]);
        e.emitParticleAt(x, y, 1);
      }
      return;
    }
    if (tint != null) e.setParticleTint(tint);
    e.emitParticleAt(x, y, count);
  }

  // Imagem do pool animada à mão: kind = star | ring | ghost | glow
  _sprite(tex, x, y, o) {
    const s = this.pool.find((p) => !p.live);
    if (!s) return null;
    s.live = true;
    s.t = 0;
    s.dur = o.ms ?? 140;
    s.s0 = o.s0 ?? 1;
    s.s1 = o.s1 ?? s.s0;
    s.a0 = o.a0 ?? 1;
    s.sy = o.sy ?? 1; // achatamento (anel no chão)
    s.ease = o.ease ?? "out";
    s.img
      .setTexture(tex)
      .setPosition(x, y)
      .setRotation(o.rot ?? 0)
      .setTint(o.tint ?? 0xffffff)
      .setBlendMode(o.blend ?? Phaser.BlendModes.NORMAL)
      .setDepth(o.depth ?? D_FX + 10)
      .setScale(s.s0, s.s0 * s.sy)
      .setAlpha(s.a0)
      .setVisible(true);
    return s;
  }
  star(x, y, tint, s0, s1, ms = 120, rot = 0) {
    return this._sprite("fx_star", x, y, { tint, s0, s1, ms, rot });
  }
  // Anel: textura POR FAIXA DE RAIO (traço fino de 2px). Esticar um anel pequeno
  // engrossava o traço junto e virava escada serrilhada nos anéis grandes.
  ring(x, y, tint, r0, r1, ms = 220, flat = 0.62, a0 = 0.9) {
    const R = Math.max(8, Math.round(r1 / 6) * 6);
    const key = `fx_ring_${R}`;
    if (!this.scene.textures.exists(key)) {
      const S = R * 2 + 4,
        c = S / 2;
      const p = new Pix(S, S);
      for (let a = 0; a < Math.PI * 2; a += 0.7 / R) {
        const px = Math.round(c + Math.cos(a) * R),
          py = Math.round(c + Math.sin(a) * R);
        p.rect(px - 1, py - 1, 2, 2, PAL.white);
      }
      p.register(this.scene, key);
    }
    return this._sprite(key, x, y, { tint, s0: r0 / R, s1: r1 / R, ms, sy: flat, a0 });
  }
  // Fantasma (rastro de uma arma que gira/voa)
  ghost(tex, x, y, rot, scale, tint, ms = 150, a0 = 0.5, frame) {
    const s = this._sprite(tex, x, y, { tint, s0: scale, s1: scale * 0.9, ms, rot, a0, blend: Phaser.BlendModes.ADD, depth: D_FX - 20 });
    if (s && frame != null) s.img.setFrame(frame);
    return s;
  }

  // Marca no chão que esmaece (queimado / geada)
  decal(tex, x, y, r, ms = 1600, alpha = 0.55) {
    let d = this.decals.find((p) => !p.live);
    if (!d) d = this.decals.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b)); // recicla a mais velha
    d.live = true;
    d.t = 0;
    d.dur = ms;
    d.a0 = alpha;
    d.img
      .setTexture(tex)
      .setPosition(x, y + 4)
      .setScale((r * 2) / 30, (r * 1.15) / 16)
      .setRotation((Math.random() - 0.5) * 0.4)
      .setAlpha(alpha)
      .setVisible(true);
  }

  light(x, y, r, color, ms = 140, power = 1) {
    this.scene.lighting?.flash(x, y, r, color, ms, power);
  }

  // ------------------------------------------------------------ vocabulário
  // Saída do disparo (boca da arma): clarão pequeno + faíscas para a frente
  muzzle(x, y, ang, element) {
    const c = el(element);
    this._sprite("fx_disc", x, y, { tint: c.core, s0: 1.1, s1: 0.4, ms: 70 });
    this._sprite("fx_burst", x, y, { tint: c.core, s0: 0.5, s1: 1.2, ms: 90, rot: ang });
    if (element === "bolt") this.burst("zap", x, y, 5, ang, 70);
    else this.burst(`puff_${element}`, x, y, 2, ang, 60, { min: 20, max: 70 });
    this.burst("streak", x, y, 3, ang, 45, { min: 160, max: 300 }, c.spark);
    this.light(x, y, 120, c.light, 120, 1);
  }

  // Golpe num inimigo. power ~0.4 (tique) · 1 (golpe) · 1.5 (pesado); dir = sentido do golpe
  impact(x, y, element, o = {}) {
    const c = el(element);
    const pw = o.power ?? 1;
    const full = this._frameImpacts++ < IMPACTS_PER_FRAME;
    const fwd = o.dir ?? null;
    const cone = fwd == null ? 360 : 100;
    // Riscos espirram PARA FRENTE (continuam o golpe)
    this.burst("streak", x, y, full ? 2 + 4 * pw : 1, fwd, cone, null, c.spark);
    if (!full) return;
    this.burst("spark", x, y, 2 + 2 * pw, fwd, cone + 60, null, c.spark);
    if (element === "fire" || element === "ice") this.burst(`puff_${element}`, x, y, 1 + 3 * pw, fwd, 140, { min: 10, max: 30 + 50 * pw });
    if (pw >= 0.7 || o.crit) {
      // Quadro do golpe: disco branco que some em ~2 quadros + estrela
      this._sprite("fx_disc", x, y, { tint: 0xffffff, s0: 0.95 * pw, s1: 0.5 * pw, ms: 40 });
      this._sprite("fx_burst", x, y, { tint: c.core, s0: 0.7 * pw, s1: (o.crit ? 2.4 : 1.7) * pw, ms: o.crit ? 150 : 110, rot: Math.random() * Math.PI });
      if (o.crit) this.star(x, y, PAL.yel3, 1, 3.2, 170, Math.PI / 4);
      this.light(x, y, 90 + 70 * pw, c.light, 150, 1);
    }
    if (o.crit) this.ring(x, y, PAL.yel3, 8, 46, 220, 0.62, 1);
    if (element === "fire") this.burst("ember", x, y - 4, 2 + 2 * pw);
    else if (element === "ice") {
      this.burst("frost", x, y, 2 + 2 * pw);
      if (pw >= 0.8) this.burst("shard", x, y, 2, fwd, 120);
    } else if (element === "bolt") this.burst("zap", x, y, 2 + 3 * pw, fwd, 160);
  }

  // Morte: estalo branco + a "matéria" do elemento que matou
  kill(x, y, element, big = false) {
    const k = big ? 1.8 : 1;
    const c = el(element);
    // Sem disco cheio na morte: em mortes em massa virava mancha branca de tinta
    this.ring(x, y + 6, c.core, 8, 36 * k, 200, 0.6, 0.6);
    this._sprite("fx_burst", x, y, { tint: c.core, s0: 0.9 * k, s1: 2.3 * k, ms: 160, rot: Math.random() * Math.PI });
    this.burst("streak", x, y, 6 * k, null, 360, { min: 120, max: 320 }, c.spark);
    if (element === "fire" || element === "ice") this.burst(`puff_${element}`, x, y, 5 * k, null, 360, { min: 20, max: 90 });
    this.light(x, y, 140 * k, c.light, 260, 1);
    if (element === "fire") {
      this.burst("ember", x, y, 9 * k, -Math.PI / 2, 150, { min: 40, max: 170 });
      this.burst("smoke", x, y, 3 * k, -Math.PI / 2, 120);
      this.decal("fx_scorch", x, y + 6, 16 * k, 1400, 0.45);
    } else if (element === "ice") {
      this.burst("shard", x, y, 7 * k, -Math.PI / 2, 220, { min: 100, max: 260 });
      this.burst("frost", x, y, 7 * k);
      this.decal("fx_frost", x, y + 6, 15 * k, 1500, 0.5);
    } else if (element === "bolt") {
      this.burst("zap", x, y, 10 * k);
      this.star(x, y, c.mid, 0.8 * k, 2.6 * k, 120, 0);
      this.burst("smoke", x, y, 2 * k, -Math.PI / 2, 120);
    } else {
      this.burst("spark", x, y, 6 * k, null, 360, { min: 60, max: 180 }, c.spark);
    }
    this.burst("leaf", x, y, big ? 4 : 1, -Math.PI / 2, 200);
  }

  // Rastro: chamado todo quadro, emite no ritmo `everyMs` (estado guardado em obj)
  trail(obj, x, y, element, everyMs = 34) {
    const now = this.scene.time.now;
    if (now < (obj._fxNext ?? 0)) return;
    obj._fxNext = now + everyMs / this.q;
    if (element === "firefly") return this.burst("glow", x, y, 1);
    // Cauda contínua (volume) + de vez em quando a "matéria" do elemento
    if (ELEM[element]) this.burst(`tail_${element}`, x, y, 1);
    obj._fxK = (obj._fxK ?? 0) + 1;
    if (obj._fxK % 3) return;
    if (element === "fire") this.burst("ember", x, y, 1, null, 360, { min: 5, max: 35 });
    else if (element === "ice") this.burst("frost", x, y, 1, null, 360, { min: 0, max: 20 });
    else if (element === "bolt") this.burst("zap", x, y, 1, null, 360, { min: 20, max: 80 });
  }

  // Raio em PIXEL (quadrados de 3px), com halo, núcleo e galhos — some piscando
  bolt(x1, y1, x2, y2, color, width = 3, branches = 2) {
    const scene = this.scene;
    // Cor opaca (em blend aditivo o lilás sobre a grama estourava para branco)
    const g = scene.add.graphics().setDepth(D_FX + 5);
    const C = 3;
    const pts = [[x1, y1]];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const segs = Math.max(3, Math.round(len / 34));
    const nx = -(y2 - y1) / (len || 1),
      ny = (x2 - x1) / (len || 1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const j = (Math.random() - 0.5) * Math.min(26, len * 0.18);
      pts.push([x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j]);
    }
    pts.push([x2, y2]);
    const seg = (ax, ay, bx, by, size, col, a) => {
      g.fillStyle(col, a);
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / C));
      for (let i = 0; i <= n; i++) {
        const px = Math.round((ax + ((bx - ax) * i) / n) / C) * C,
          py = Math.round((ay + ((by - ay) * i) / n) / C) * C;
        g.fillRect(px - (size >> 1), py - (size >> 1), size, size);
      }
    };
    const path = (p, size, col, a) => {
      for (let i = 1; i < p.length; i++) seg(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], size, col, a);
    };
    // Traço fino em 3 camadas de pixel: halo escuro, corpo da cor, núcleo branco
    const dark = color === 0xd98cff ? PAL.pur1 : color === 0xffe24c ? PAL.org1 : PAL.pur1;
    path(pts, C * (width >= 4 ? 3 : 2) + 2, dark, 0.55);
    path(pts, C * (width >= 4 ? 2 : 1) + 1, color, 1);
    path(pts, C, 0xffffff, 1); // núcleo
    // Galhos: saem de um vértice do meio e morrem logo
    for (let b = 0; b < branches; b++) {
      const i = 1 + Math.floor(Math.random() * (pts.length - 2));
      const [bx, by] = pts[i];
      const ang = Math.atan2(y2 - y1, x2 - x1) + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
      const l = 18 + Math.random() * 26;
      const mx = bx + Math.cos(ang) * l * 0.5 + (Math.random() - 0.5) * 10,
        my = by + Math.sin(ang) * l * 0.5 + (Math.random() - 0.5) * 10;
      path([[bx, by], [mx, my], [bx + Math.cos(ang) * l, by + Math.sin(ang) * l]], C, color, 0.9);
    }
    this.light(x2, y2, 200 + width * 14, color, 170, 1);
    this.light((x1 + x2) / 2, (y1 + y2) / 2, 150, color, 120, 0.6);
    // Pisca (aceso → quase apaga → reacende → some): leitura de "eletricidade"
    const flick = { t: 0 };
    scene.tweens.add({
      targets: flick,
      t: 1,
      duration: 260,
      onUpdate: () => {
        const t = flick.t;
        g.setAlpha(t < 0.3 ? 1 : t < 0.42 ? 0.2 : t < 0.6 ? 0.9 : 0.9 * (1 - (t - 0.6) / 0.4));
      },
      onComplete: () => g.destroy(),
    });
    return g;
  }

  // ------------------------------------------------------------ laço
  update(dt) {
    this._frameImpacts = 0;
    const d = dt * this._ts;
    for (const s of this.pool) {
      if (!s.live) continue;
      s.t += d;
      const k = Math.min(1, s.t / s.dur);
      const e = s.ease === "out" ? 1 - (1 - k) * (1 - k) : k;
      const sc = s.s0 + (s.s1 - s.s0) * e;
      s.img.setScale(sc, sc * s.sy).setAlpha(s.a0 * (1 - k * k));
      if (k >= 1) {
        s.live = false;
        s.img.setVisible(false);
      }
    }
    for (const dcl of this.decals) {
      if (!dcl.live) continue;
      dcl.t += d;
      const k = dcl.t / dcl.dur;
      if (k >= 1) {
        dcl.live = false;
        dcl.img.setVisible(false);
      } else if (k > 0.55) dcl.img.setAlpha(dcl.a0 * (1 - (k - 0.55) / 0.45));
    }
  }
}
