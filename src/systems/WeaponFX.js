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
import { registerFireFX, WHIRL_H, IGNITE_H, JET_W, JET_X0, JET_LEN, JET_HALF, GFIRE_H } from "../art/FireFX.js";
import { registerIceFX, SPIKE_H } from "../art/IceFX.js";
import { registerReactionFX, STEAM_W } from "../art/ReactionFX.js";

const PX = 3; // escala dos quadros desenhados (= GAME.PIXEL_SCALE)

export const D_FX = 48600; // acima do mapa de luz (48500), abaixo do HUD (50000)
const D_SMOKE = 48400; // fumaça: abaixo do mapa de luz
const D_DECAL = -70; // chão (acima das sombras das árvores, abaixo de tudo)

// Paleta de cada elemento: núcleo (quase branco), meio, escuro e a cor da LUZ
export const ELEM = {
  fire: { core: PAL.yel3, mid: PAL.org2, dark: PAL.red1, light: 0xff8a3c, spark: [PAL.white, PAL.yel3, PAL.org3, PAL.org2] },
  ice: { core: PAL.white, mid: PAL.ice2, dark: PAL.ice1, light: 0x5cc8ff, spark: [PAL.white, PAL.ice3, PAL.ice3, PAL.ice2] },
  bolt: { core: PAL.white, mid: PAL.pur2, dark: PAL.pur1, light: 0xc78cff, spark: [PAL.white, PAL.pur3, PAL.pur3, PAL.pur2] },
  wind: { core: PAL.white, mid: PAL.wnd2, dark: PAL.wnd1, light: 0x7fd9bd, spark: [PAL.white, PAL.wnd3, PAL.wnd3, PAL.wnd2] },
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
  registerFireFX(scene); // redemoinho, ignição e língua de fogo (Labareda), jato do Sopro
  registerIceFX(scene); // espinho de gelo (Coração do Inverno, Cristal)
  registerReactionFX(scene); // nuvem de vapor e lufada de neve (Vapor, Geada)
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
      puff_wind: add("px_puff", { ...PUFF, color: [PAL.white, PAL.wnd3, PAL.wnd2, PAL.wnd1], blendMode: ADD }),
      // Lufada: risco claro que corre rápido e some (o vento visível)
      gust: add("fx_streak", {
        speed: { min: 140, max: 260 },
        lifespan: { min: 160, max: 280 },
        scale: { start: 1.2, end: 0.2 },
        rotate: { onEmit: () => 0, onUpdate: (p) => Math.atan2(p.velocityY, p.velocityX) * DEG },
        color: [PAL.white, PAL.wnd3, PAL.wnd2],
        blendMode: ADD,
        maxAliveParticles: 160,
      }),
      // Cauda de projétil (encolhe enquanto fica para trás)
      tail_fire: add("px_puff", { ...TAIL, color: [PAL.yel3, PAL.yel2, PAL.org2, PAL.org1], blendMode: ADD }),
      tail_ice: add("px_puff", { ...TAIL, color: [PAL.ice3, PAL.ice2, PAL.ice2], blendMode: ADD }),
      tail_bolt: add("px_puff", { ...TAIL, color: [PAL.pur3, PAL.pur2, PAL.pur2], blendMode: ADD }),
      tail_wind: add("px_puff", { ...TAIL, color: [PAL.wnd3, PAL.wnd2, PAL.wnd2], blendMode: ADD }),
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
    // Fogo desenhado (Labareda): sprites animados reaproveitados, criados sob demanda
    this.flames = { whirl: [], ignite: [], wisp: [], jet: [], icespike: [], groundfire: [], steam: [], frostgust: [] };
    this.attached = []; // sprites que seguem um dono (jato do Sopro preso à mão)
    this.whirls = []; // redemoinhos vivos (brasas em espiral, fumaça no fim)
    this.wisps = []; // línguas de fogo em voo
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
    for (const list of Object.values(this.flames)) for (const s of list) s.anims.timeScale = k;
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
    s.flick = null;
    s.hold = false;
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
      .setFlipX(false) // o fantasma do dash espelha; o próximo uso do pool não herda
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
      // FAIXA em células de 3 px (a grade do jogo no fim da animação): linha cheia,
      // aro mais escuro por fora (a tinta escurece o cinza) e brilho pontilhado por
      // dentro. O anel antigo era um traço de 2 px que parecia vetor.
      const S = R * 2 + 12,
        c = S / 2;
      const p = new Pix(S, S);
      const cell = (x, y, col) => p.rect(Math.round(x / 3) * 3 - 1, Math.round(y / 3) * 3 - 1, 3, 3, col);
      for (let a = 0; a < Math.PI * 2; a += 1.2 / R) {
        const cx = Math.cos(a),
          cy = Math.sin(a);
        cell(c + cx * (R + 3), c + cy * (R + 3), 0x8a8a8a);
      }
      for (let a = 0; a < Math.PI * 2; a += 1.2 / R) {
        const cx = Math.cos(a),
          cy = Math.sin(a);
        cell(c + cx * R, c + cy * R, PAL.white);
        const ix = c + cx * (R - 3),
          iy = c + cy * (R - 3);
        if (bayer(Math.round(ix / 3), Math.round(iy / 3)) < 0.5) cell(ix, iy, 0xd0d0d0);
      }
      p.register(this.scene, key);
    }
    return this._sprite(key, x, y, { tint, s0: r0 / R, s1: r1 / R, ms, sy: flat, a0 });
  }
  // Onda de trovão (Tambor): faixa de pixel com raios em zigue-zague correndo pelo
  // anel e galhos curtos para fora; duas versões que se alternam (a onda "chia").
  // cols = [núcleo, claro, meio, escuro] já na cor certa (sem tinta).
  thunderRing(x, y, r0, r1, ms, cols, flat = 0.7) {
    const R = Math.max(24, Math.round(r1 / 12) * 12);
    const tag = cols.join("_");
    const keys = [0, 1].map((v) => `fx_thunder_${R}_${tag}_${v}`);
    keys.forEach((key, v) => {
      if (this.scene.textures.exists(key)) return;
      const S = R * 2 + 30,
        c = S / 2;
      const p = new Pix(S, S);
      const rnd = rng(R * 7 + v * 131);
      const cell = (x, y, col) => p.rect(Math.round(x / 3) * 3 - 1, Math.round(y / 3) * 3 - 1, 3, 3, col);
      const step = 3 / R;
      let off = 0,
        off2 = 1;
      // brilho pontilhado da faixa (por baixo dos fios)
      for (let a = 0; a < Math.PI * 2; a += step)
        for (let L = -2; L <= 2; L++) {
          const x = c + Math.cos(a) * (R + L * 3),
            y = c + Math.sin(a) * (R + L * 3);
          if (bayer(Math.round(x / 3), Math.round(y / 3)) < 0.55 - Math.abs(L) * 0.18) cell(x, y, Math.abs(L) > 1 ? cols[3] : cols[2]);
        }
      for (let a = 0; a < Math.PI * 2; a += step) {
        if (rnd() < 0.28) off = Math.max(-2, Math.min(2, off + (rnd() < 0.5 ? -1 : 1))); // zigue-zague
        if (rnd() < 0.22) off2 = Math.max(-2, Math.min(2, off2 + (rnd() < 0.5 ? -1 : 1)));
        const cx = Math.cos(a),
          cy = Math.sin(a);
        const rr = R + off * 3;
        // dois fios de raio que se cruzam: um de núcleo branco, outro na cor
        cell(c + cx * (R + off2 * 3), c + cy * (R + off2 * 3), cols[1]);
        cell(c + cx * rr, c + cy * rr, rnd() < 0.35 ? cols[0] : cols[1]);
        if (rnd() < 0.05) {
          // galho curto para fora
          let bx = c + cx * rr,
            by = c + cy * rr;
          const ga = a + (rnd() - 0.5) * 1.2;
          for (let k = 0; k < 3 + Math.floor(rnd() * 3); k++) {
            bx += Math.cos(ga + (rnd() - 0.5) * 1.4) * 3;
            by += Math.sin(ga + (rnd() - 0.5) * 1.4) * 3;
            cell(bx, by, k === 0 ? cols[0] : cols[1]);
          }
        }
      }
      p.register(this.scene, key);
    });
    const s = this._sprite(keys[0], x, y, { s0: r0 / R, s1: r1 / R, ms, sy: flat, a0: 1 });
    if (s) {
      s.flick = keys;
      s.hold = true; // segura acesa até a metade e só então apaga
    }
    return s;
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
    else if (element === "wind") this.burst("gust", x, y, 4, ang, 50);
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
    else if (element === "wind") {
      this.burst("gust", x, y, 2 + 2 * pw, fwd, 90);
      if (pw >= 0.7) this.burst("puff_wind", x, y, 2, fwd, 120, { min: 20, max: 70 });
    }
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
    } else if (element === "wind") {
      this.burst("gust", x, y, 8 * k, null, 360);
      this.burst("puff_wind", x, y, 4 * k, null, 360, { min: 20, max: 90 });
      this.burst("leaf", x, y, 3 * k, null, 360, { min: 60, max: 180 });
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
    else if (element === "wind") this.burst("gust", x, y, 1, null, 360);
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

  // ------------------------------------------------------------ fogo desenhado
  // Sprite do pool de chamas (null se todos ocupados: o efeito some, o dano não)
  _flame(kind, max, x, y, originY) {
    const list = this.flames[kind];
    let s = list.find((o) => !o.visible);
    if (!s) {
      if (list.length >= max) return null;
      s = this.scene.add.sprite(-9999, -9999, `fx_${kind}`, 0).setVisible(false);
      s.anims.timeScale = this._ts;
      s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.setVisible(false));
      list.push(s);
    }
    s.setOrigin(0.5, originY).setPosition(x, y).setScale(PX).setRotation(0).setAlpha(1).setDepth(D_FX).setVisible(true);
    s.play(`fx_${kind}`);
    return s;
  }

  // LABAREDA: redemoinho de fogo que irrompe aos pés (fy) do alvo. Por baixo: chão
  // queimado, anel de vento e de fogo, lufadas girando; depois brasas sobem em
  // espiral pela coluna e ela se desfaz em fumaça no alto.
  fireWhirl(x, fy, R) {
    const s = this._flame("whirl", 4, x, fy, (WHIRL_H - 3) / WHIRL_H);
    this.decal("fx_scorch", x, fy - 4, Math.max(26, R * 0.32), 2200, 0.6);
    this.ring(x, fy, PAL.wnd2, 10, R, 380, 0.5, 0.85);
    this.scene.time.delayedCall(70, () => this.ring(x, fy, PAL.org2, 8, R * 0.62, 320, 0.5, 0.95));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      this.burst("gust", x + Math.cos(a) * 34, fy + Math.sin(a) * 12, 1, a - Math.PI / 2, 16, { min: 160, max: 230 });
    }
    this.burst("puff_fire", x, fy - 8, 5, null, 360, { min: 40, max: 120 });
    this.burst("leaf", x, fy - 10, 5, null, 360, { min: 90, max: 200 });
    this.light(x, fy - 70, 240, 0xff8a3c, 700, 1);
    if (s) this.whirls.push({ x, fy, t: 0, next: 0, smoked: false });
  }

  // Língua de fogo levada pelo vento de (x0, y0) até o alvo (segue o alvo vivo), numa
  // curva que gira no mesmo sentido do redemoinho. onArrive na chegada (o dano).
  fireWisp(x0, y0, target, delay, onArrive) {
    const go = () => {
      const tx = target.x,
        ty = target.y - 6;
      const d = Math.hypot(tx - x0, ty - y0);
      const s = this._flame("wisp", 16, x0, y0, 0.5);
      if (s) s.setScale(PX * 0.9);
      // curva: meio do caminho, deslocado para o lado (o giro) e para cima
      const nx = -(ty - y0) / (d || 1),
        ny = (tx - x0) / (d || 1);
      this.wisps.push({ s, x0, y0, cx: (x0 + tx) / 2 + nx * d * 0.45, cy: (y0 + ty) / 2 + ny * d * 0.45 - 40, target, tx, ty, t: 0, dur: 170 + d * 1.15, onArrive, px: x0, py: y0 });
    };
    if (delay > 0) this.scene.time.delayedCall(delay, go);
    else go();
  }

  // Jato do Sopro: chama desenhada presa à mão do dono, no ângulo `dir`, do tamanho do
  // alcance R e aberta no meio-ângulo `half` do cone (o quadro é desenhado em JET_HALF)
  flameJet(owner, dir, R, half) {
    const s = this._flame("jet", 6, owner.x, owner.y, 0.5);
    if (!s) return;
    const k = R / JET_LEN;
    s.setOrigin(JET_X0 / JET_W, 0.5)
      .setRotation(dir)
      .setScale(k, k * (Math.tan(half) / Math.tan(JET_HALF)));
    this.attached.push({ s, owner, ox: Math.cos(dir) * 12, oy: -8 + Math.sin(dir) * 12 });
  }

  // Onda de espinhos de gelo: brotam do chão em anéis, de dentro para fora (o atraso
  // segue a distância), e estilhaçam. Matéria: ficam no chão, ordenados por y.
  iceNova(x, y, r) {
    const rings = [[0.42, 6], [0.72, 10], [1, 16]];
    for (const [f, n] of rings)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + f * 1.7 + (Math.random() - 0.5) * 0.25;
        const sx = x + Math.cos(a) * r * f,
          sy = y + Math.sin(a) * r * f * 0.78; // chão em perspectiva
        this.scene.time.delayedCall(f * 220 + Math.random() * 40, () => {
          const s = this._flame("icespike", 40, sx, sy, (SPIKE_H - 3) / SPIKE_H);
          if (s) s.setDepth(sy + 10000).setFlipX(Math.random() < 0.5);
          if (i % 3 === 0) this.burst("frost", sx, sy - 12, 2, -Math.PI / 2, 80, { min: 20, max: 70 });
        });
      }
  }

  // Fogo baixo queimando no chão por `life` ms (rastro do Boitatá/Inferno): cresce,
  // tremula em laço e encolhe no fim. Chão queimado por baixo. Pool de 24.
  groundFire(x, y, r, life) {
    const s = this._flame("groundfire", 24, x + (Math.random() - 0.5) * r * 0.4, y + 6, (GFIRE_H - 2) / GFIRE_H);
    this.decal("fx_scorch", x, y + 2, r * 0.7, life + 900, 0.4);
    if (!s) return;
    const k = PX * Math.min(1.4, Math.max(0.7, r / 40));
    this.scene.tweens.killTweensOf(s);
    s.setDepth(y + 10006).setScale(k * 0.3).setFlipX(Math.random() < 0.5);
    this.scene.tweens.add({ targets: s, scale: k, duration: 140, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: s,
      scale: k * 0.2,
      delay: Math.max(0, life - 220),
      duration: 220,
      ease: "Quad.easeIn",
      onComplete: () => {
        s.stop();
        s.setVisible(false);
      },
    });
  }

  // VAPOR: nuvem desenhada que borbulha em laço pelo tempo da nuvem (aparece e some
  // por transparência); fica entre os bichos (ordenada por y), com luz quente por baixo
  steamCloud(x, y, radius, ms) {
    const s = this._flame("steam", 10, x, y, 0.62);
    if (!s) return;
    const k = (2.1 * radius) / STEAM_W;
    this.scene.tweens.killTweensOf(s);
    s.setScale(k * 0.6).setAlpha(0).setDepth(y + 10040).setFlipX(Math.random() < 0.5);
    this.scene.tweens.add({ targets: s, alpha: 0.94, scale: k, duration: 220, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      scale: k * 1.08,
      delay: Math.max(0, ms - 380),
      duration: 380,
      onComplete: () => {
        s.stop();
        s.setVisible(false);
      },
    });
    this.light(x, y, radius * 1.7, 0xffc8a0, ms, 0.55);
  }

  // GEADA: lufada de neve em espiral que abre até o raio R
  frostGust(x, y, R) {
    const s = this._flame("frostgust", 8, x, y, 0.5);
    if (s) s.setScale(R / 26);
  }

  // CRISTAL: um aglomerado de espinhos de gelo brota no alvo e estilhaça
  crystalBurst(x, y, big = false) {
    const n = big ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const d = i === 0 ? 0 : 10 + Math.random() * (big ? 22 : 14);
      const sx = x + Math.cos(a) * d,
        sy = y + Math.sin(a) * d * 0.6;
      const s = this._flame("icespike", 40, sx, sy, (SPIKE_H - 3) / SPIKE_H);
      if (s) s.setDepth(sy + 10000).setFlipX(i % 2 === 1).setScale(PX * (i === 0 ? 1.2 : 0.8 + Math.random() * 0.3));
    }
  }

  // Marca de raio no chão (Temporal): estalo, chão queimado e uma onda curtinha
  strikeMark(x, y, cols) {
    this.thunderRing(x, y, 6, 52, 260, cols, 0.55);
    this.decal("fx_scorch", x, y, 18, 1400, 0.5);
    this.star(x, y - 4, 0xffffff, 0.8, 2.6, 130, Math.PI / 4);
    this.burst("zap", x, y - 4, 8, -Math.PI / 2, 160);
  }

  // A chama que pega num inimigo (aos pés dele), com estalo de luz e brasas
  ignite(x, fy) {
    this._flame("ignite", 14, x, fy, (IGNITE_H - 2) / IGNITE_H);
    this._sprite("fx_burst", x, fy - 18, { tint: PAL.yel3, s0: 0.6, s1: 1.6, ms: 120, rot: Math.random() * Math.PI });
    this.burst("ember", x, fy - 16, 5, -Math.PI / 2, 120, { min: 50, max: 150 });
    this.light(x, fy - 20, 120, 0xff8a3c, 260, 1);
  }

  _updateFire(d) {
    for (let i = this.attached.length - 1; i >= 0; i--) {
      const a = this.attached[i];
      if (!a.s.visible || !a.owner.active) {
        a.s.setVisible(false);
        this.attached.splice(i, 1);
      } else a.s.setPosition(a.owner.x + a.ox, a.owner.y + a.oy);
    }
    for (let i = this.whirls.length - 1; i >= 0; i--) {
      const w = this.whirls[i];
      w.t += d;
      // brasas subindo em espiral pela coluna enquanto a chama vive
      while (w.next <= w.t && w.next < 760) {
        const th = w.next * 0.016;
        const h = 20 + (w.next / 760) * 120;
        this.burst("ember", w.x + Math.cos(th) * (10 + h * 0.08), w.fy - h, 1, th + Math.PI / 2 - 0.9, 30, { min: 50, max: 110 });
        w.next += 45 / this.q;
      }
      if (!w.smoked && w.t > 600) {
        w.smoked = true;
        this.burst("smoke", w.x, w.fy - 150, 4, -Math.PI / 2, 90, { min: 20, max: 60 });
      }
      if (w.t > 800) this.whirls.splice(i, 1);
    }
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      w.t += d;
      if (w.target.active) {
        w.tx = w.target.x;
        w.ty = w.target.y - 6;
      }
      const k = Math.min(1, w.t / w.dur);
      const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // sai rápido e assenta no fim
      const u = 1 - e;
      const x = u * u * w.x0 + 2 * u * e * w.cx + e * e * w.tx,
        y = u * u * w.y0 + 2 * u * e * w.cy + e * e * w.ty;
      if (w.s) w.s.setPosition(x, y).setRotation(Math.atan2(y - w.py, x - w.px));
      this.trail(w, x, y, "fire", 26);
      w.px = x;
      w.py = y;
      if (k >= 1) {
        if (w.s) {
          w.s.stop();
          w.s.setVisible(false);
        }
        this.wisps.splice(i, 1);
        w.onArrive?.();
      }
    }
  }

  // ------------------------------------------------------------ laço
  update(dt) {
    this._frameImpacts = 0;
    const d = dt * this._ts;
    this._updateFire(d);
    for (const s of this.pool) {
      if (!s.live) continue;
      s.t += d;
      const k = Math.min(1, s.t / s.dur);
      const e = s.ease === "out" ? 1 - (1 - k) * (1 - k) : k;
      const sc = s.s0 + (s.s1 - s.s0) * e;
      const fade = s.hold ? Math.max(0, (k - 0.55) / 0.45) : k;
      s.img.setScale(sc, sc * s.sy).setAlpha(s.a0 * (1 - fade * fade));
      if (s.flick) s.img.setTexture(s.flick[Math.floor(s.t / 55) % s.flick.length]);
      if (k >= 1) {
        s.live = false;
        s.flick = null;
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
