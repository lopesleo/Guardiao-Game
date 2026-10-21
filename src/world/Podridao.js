// A PODRIDÃO NA BORDA DA TELA: o vilão do jogo cercando o guardião. Uma camada só, presa na tela,
// que faz três papéis que antes eram três vinhetas soltas:
//   · clima: a Podridão avança das bordas com o relógio da partida, fecha quando o chefe nasce
//     e recua quando ele é libertado (na Noite Eterna volta devagar);
//   · vida baixa: a MESMA camada pulsa num ritmo de coração (aperta e avermelha);
//   · vinheta: o escurecimento dos cantos (Gradient radial fixo, por baixo).
// Como é feita (Phaser 4, tudo gerado por código, cores da Podridão = ROT):
//   campo = dois Gradients "bilineares" (distância à borda esquerda/direita e de cima/baixo, em px:
//           a faixa tem a MESMA grossura nas quatro bordas, e os cantos arredondam sozinhos na soma)
//           + ruído NoiseSimplex2D somado, que vira tentáculos andando devagar na frente;
//   cor   = filtro GradientMap: campo → nada / fio aceso (hot) / carne escura (mid → dark);
//   tudo numa DynamicTexture de 1/8 da tela, redesenhada a ~10 Hz e ampliada na tela (1 quad).
//   (Um radial puro virava uma escotilha oval que comia os cantos: testado e descartado.)
// Aparelho fraco (Iluminação desligada, à mão ou pelo QualityWatchdog): só os Gradients já
// coloridos, sem ruído nem filtro, redesenhados só quando a borda anda. Sem WebGL ou sem `highp`
// no fragmento (o shader do Gradient exige): o mesmo desenho em Canvas 2D, no mesmo tamanho pequeno.
import { PODRIDAO as P } from "../config.js";
import { PAL } from "../art/Palette.js";
import { ROT } from "../art/Monsters.js";
import { Settings } from "../systems/Settings.js";
import { vw, vh } from "../ui/Theme.js";

// Acima do mapa de luz (48500: a Podridão não é "iluminada" nem apagada pela noite) e ABAIXO dos
// avisos de golpe (D_TELE 48540) e dos golpes acesos: um aviso na borda nunca some sob ela.
export const D_PODRIDAO = 48530;

const SQ = Math.SQRT1_2; // centro → canto em UV: o radial da vinheta vale 1 no canto
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const gl4 = (c, a) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, a];
const css = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

// Rampa da Podridão: campo (0 = longe da borda … 1 = na borda) → cor. Antes da frente (F0) nada; na
// frente um fio aceso de 1 pixel de arte (as rachaduras acesas dos corrompidos), atrás a carne
// escura com um veio aceso seguindo o contorno. O alfa para em ~0,84 na borda e o forte (≥ 0,5)
// fica nos ~8–10% de fora: inimigo entrando pela borda continua visível.
const F0 = 0.5;
const ramp = (rim, hot, mid, dark) => [
  [0, rim, 0],
  [F0, rim, 0],
  [F0 + 0.025, rim, 0.55],
  [F0 + 0.06, hot, 0.4],
  [F0 + 0.14, mid, 0.48],
  [F0 + 0.26, mid, 0.6],
  [F0 + 0.28, hot, 0.6],
  [F0 + 0.3, mid, 0.66],
  [1, dark, 0.84],
];
const STOPS = ramp(ROT.glow, ROT.hot, ROT.mid, ROT.dark);
// Vida baixa: a mesma Podridão "faminta", em vermelho (entra por cima no ritmo do coração)
const STOPS_RED = ramp(PAL.red3, PAL.red2, PAL.red1, PAL.red0);
const bandsOf = (stops) =>
  stops.slice(1).map(([end, c1, a1], i) => {
    const [start, c0, a0] = stops[i];
    return { start, end, colorStart: gl4(c0, a0), colorEnd: gl4(c1, a1) };
  });
const RAMP = bandsOf(STOPS);
const RAMP_RED = bandsOf(STOPS_RED);
// Sem ruído (modo leve e Canvas) a frente é reta: fio aceso e veio virariam moldura de neon.
// Fica só a carne, entrando suave
const STOPS_LITE = [
  [0, ROT.mid, 0],
  [F0 - 0.1, ROT.mid, 0],
  [F0 + 0.14, ROT.mid, 0.52],
  [F0 + 0.3, ROT.mid, 0.64],
  [1, ROT.dark, 0.82],
];
const RAMP_LITE = bandsOf(STOPS_LITE);
const GRAY = [{ start: 0, end: 1, colorStart: [0, 0, 0, 1], colorEnd: [1, 1, 1, 1] }];
// Vinheta de base (cantos escuros, como a de antes): fixa, por baixo da Podridão
const VIG_STOPS = [
  [0, PAL.ink, 0],
  [0.62, PAL.ink, 0],
  [1, PAL.ink, 0.5],
];
const VIG = { shapeMode: 2, start: { x: 0.5, y: 0.5 }, shape: { x: SQ, y: 0 }, dither: true, bands: bandsOf(VIG_STOPS) };

// O shader do Gradient (e do GradientMap) declara `precision highp float` sem alternativa: em GPU
// sem highp no fragmento (Mali-400 e afins, comuns em celular barato com Android 7) ele não compila
let _highp = null;
function highpOK(renderer) {
  if (_highp !== null) return _highp;
  try {
    const gl = renderer.gl;
    _highp = (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ?? 0) > 0;
  } catch {
    _highp = false;
  }
  return _highp;
}

let _uid = 0;

export class PodridaoEdge {
  constructor(scene) {
    this.scene = scene;
    const r = scene.sys.game.renderer;
    this.webgl = r.type === Phaser.WEBGL && highpOK(r);
    this.L = this._target(); // nível 0..1 (suavizado)
    this.beat = 0; // fase do coração (0..1)
    this.low = 0;
    this.pulse = 0;
    this.red = 0;
    this._next = 0;
    this._clock = 0; // ms desde o começo (relógio do ruído)
    this._drawn = null; // assinatura do último desenho (modo leve/canvas só redesenha se mudou)
    this._id = ++_uid;
    this._gen = 0;
    this.mode = null;
    this._size();
    this._setMode(this._wantMode());
    this._onResize = () => this._resize();
    scene.scale.on("resize", this._onResize);
    scene.events.once("shutdown", () => this.destroy());
  }

  _wantMode() {
    if (!this.webgl) return "canvas";
    return Settings.get("lighting") === false ? "lite" : "full";
  }

  _size() {
    const s = this.scene;
    this.W = vw(s);
    this.H = vh(s);
    // par: a DynamicTexture arredonda para par (forceEven); o mesmo número em tudo
    this.w = Math.max(8, Math.ceil(this.W / P.RES / 2) * 2);
    this.h = Math.max(8, Math.ceil(this.H / P.RES / 2) * 2);
  }

  // Gradient "bilinear" = distância a um par de bordas opostas; a rampa e o alcance vêm do nível
  _edge(axis, bands) {
    const g = new Phaser.GameObjects.Gradient(
      this.scene,
      { shapeMode: 1, start: { x: 0.5, y: 0.5 }, shape: { x: axis ? 0 : 1, y: axis ? 1 : 0 }, dither: true, bands },
      0,
      0,
      this.w,
      this.h,
    ).setOrigin(0);
    g._axis = axis;
    return g;
  }

  // Alcance R (px de tela) em cada eixo: progresso = 1 na borda, 0 a R px dela (o resto, 0)
  _reach(g, R) {
    const span = g._axis ? this.H : this.W;
    if (g._axis) g.shape.set(0, R / span);
    else g.shape.set(R / span, 0);
    g.offset = span / (2 * R) - 1;
  }

  // Monta os objetos do modo (fora da lista de exibição: só são desenhados na textura)
  _setMode(mode) {
    this._teardown();
    this.mode = mode;
    const s = this.scene;
    const { w, h } = this;
    const key = `podridao_${this._id}_${++this._gen}`;
    if (mode === "canvas") {
      this.canvas = s.textures.createCanvas(key, w, h);
      this.tex = this.canvas;
    } else {
      this.out = s.textures.addDynamicTexture(key, w, h);
      this.tex = this.out;
      this.vig = new Phaser.GameObjects.Gradient(s, VIG, 0, 0, w, h).setOrigin(0);
      if (mode === "lite") {
        // sem soma nem filtro: cada borda já sai colorida (os cantos somam por sobreposição)
        this.ex = this._edge(0, RAMP_LITE);
        this.ey = this._edge(1, RAMP_LITE);
      } else {
        // campo em cinza: borda esquerda/direita + cima/baixo + ruído, tudo somado
        this.ex = this._edge(0, GRAY);
        this.ey = this._edge(1, GRAY).setBlendMode(Phaser.BlendModes.ADD);
        this.ex.dither = this.ey.dither = false; // o pontilhado vem no fim (GradientMap)
        this.noise = new Phaser.GameObjects.NoiseSimplex2D(
          s,
          {
            noiseCells: [this.W / P.NOISE_PX, this.H / P.NOISE_PX],
            noiseIterations: 3,
            noiseWarpAmount: 0.6,
            noiseValuePower: P.NOISE_POW,
            noiseSeed: [Math.random() * 100, Math.random() * 100],
            noiseColorStart: [1, 1, 1, 0],
            noiseColorEnd: [1, 1, 1, P.NOISE],
          },
          0,
          0,
          w,
          h,
        )
          .setOrigin(0)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.fieldTex = s.textures.addDynamicTexture(`${key}_campo`, w, h);
        this.fieldImg = new Phaser.GameObjects.Image(s, 0, 0, `${key}_campo`).setOrigin(0);
        this.fieldImg.enableFilters();
        this.fieldImg.filters.internal.addGradientMap({ ramp: RAMP, dither: true });
        // a mesma Podridão em vermelho, por cima, só na vida baixa (alfa = o pulso)
        this.redImg = new Phaser.GameObjects.Image(s, 0, 0, `${key}_campo`).setOrigin(0);
        this.redImg.enableFilters();
        this.redImg.filters.internal.addGradientMap({ ramp: RAMP_RED, dither: true });
      }
    }
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST); // pixel de arte, como o resto do jogo
    if (!this.img) this.img = s.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(D_PODRIDAO);
    else this.img.setTexture(key);
    this.img.setDisplaySize(this.W, this.H);
    this._drawn = null;
    this._next = 0;
  }

  _teardown() {
    for (const k of ["vig", "ex", "ey", "noise", "fieldImg", "redImg"]) {
      this[k]?.destroy();
      this[k] = null;
    }
    this.fieldTex?.destroy();
    this.fieldTex = null;
    // a textura exibida sai depois que a imagem já trocou de textura (em _setMode)
    if (this.tex) (this._old ||= []).push(this.tex);
    this.out = this.canvas = this.tex = null;
  }

  _dropOld() {
    if (!this._old) return;
    for (const t of this._old) t.destroy();
    this._old = null;
  }

  _resize() {
    if (!this.img) return;
    if (vw(this.scene) === this.W && vh(this.scene) === this.H) return;
    this._size();
    this._setMode(this.mode); // recria no tamanho novo (raro: girar a tela, janela)
    this._dropOld();
  }

  // Alvo do nível pela situação da partida
  _target() {
    const s = this.scene;
    if (s.endless) return Math.min(1, (s.endlessSeconds ?? 0) / P.ENDLESS_S);
    // vivo: fechada; libertado: recua para além da borda (some de vez: a floresta respira)
    if (s.boss) return s.boss.active ? 1 : P.FREED;
    const T = (s.runDurationS ?? 420) * 1000;
    const t = clamp01((s.elapsedMs ?? 0) / T);
    return P.START + (1 - P.START) * Math.pow(t, P.CURVE);
  }

  update(time, dt, player) {
    if (!this.img) return;
    const s = this.scene;
    dt = Math.min(dt ?? 16, 100);
    this._clock += dt;
    // nível: segue o alvo com suavização (o chefe nascer/ser libertado nunca é um salto)
    this.L += (this._target() - this.L) * (1 - Math.exp(-dt / P.EASE_MS));

    // vida baixa: o coração (tum-tum) num período que encurta com a vida
    let low = 0,
      beat = 0;
    if (player && player.maxHp > 0 && !s.gameOver) {
      const f = player.hp / player.maxHp;
      if (f < P.LOW_HP) low = (P.LOW_HP - Math.max(0, f)) / P.LOW_HP;
    }
    if (low > 0) {
      this.beat = (this.beat + dt / lerp(P.BEAT_MS[0], P.BEAT_MS[1], low)) % 1;
      const b = (c) => Math.exp(-(((this.beat - c) / 0.07) ** 2));
      beat = b(0.08) + 0.6 * b(0.28);
    } else this.beat = 0;
    this.low = low;
    this.pulse = beat;

    // quanto da Podridão fica vermelha: um fundo pela vida que falta + o "tum" do coração
    this.red = low > 0 ? Math.min(1, 0.2 + 0.3 * low + beat * (0.35 + 0.25 * low)) : 0;
    // modos sem filtro: o vermelho vem do tingimento da imagem (todo quadro, de graça)
    const tint = this.mode !== "full" && this.red > 0.002 ? lerpColor(0xffffff, PAL.red3, this.red) : 0xffffff;
    if (tint !== this._tint) this.img.setTint((this._tint = tint));

    const want = this._wantMode();
    if (this.mode !== want) this._setMode(want);
    else this._dropOld();
    if (time < this._next) return;
    this._next = time + 1000 / (low > 0 ? P.HZ_PULSE : P.HZ);
    // vida baixa: a Podridão aperta em volta do guardião (mais forte no "tum")
    const lvl = Math.min(1.35, this.L + low * (0.4 + 0.35 * beat));
    this._draw(time, lvl);
  }

  // Distância da frente até a borda (px) e o alcance R do campo que a põe lá
  _front(lvl) {
    return lerp(P.FRONT[0], P.FRONT[1], lvl) * this.H;
  }

  _draw(time, lvl) {
    const D = this._front(lvl);
    const none = D < 1; // frente além da borda: só a vinheta
    if (this.mode === "full") {
      if (none) {
        this.out.clear().draw(this.vig).render();
        return;
      }
      // o ruído soma em média NOISE × NOISE_MEAN ao campo: o alcance compensa (frente MÉDIA em D)
      const R = D / (1 - F0 + P.NOISE * P.NOISE_MEAN);
      this._reach(this.ex, R);
      this._reach(this.ey, R);
      // ruído anda devagar: flui (a forma muda) e escorre (desloca). Relógio próprio, desde o começo
      // da partida: o da cena cresce sem parar e números grandes estragam a precisão do shader. O
      // fluxo é um ângulo (período 2π em todas as oitavas): dá para dar a volta sem salto
      const t = this._clock / 1000;
      this.noise.noiseFlow = (t * P.NOISE_FLOW) % (Math.PI * 2);
      this.noise.noiseOffset[0] = t * 0.05;
      this.noise.noiseOffset[1] = -t * 0.035;
      this.fieldTex.clear().draw(this.ex).draw(this.ey).draw(this.noise).render();
      // no começo da partida a Podridão é só um indício na borda (o fio aceso não vira moldura)
      this.out.clear().draw(this.vig).draw(this.fieldImg.setAlpha(clamp01(lvl / 0.3)));
      if (this.red > 0.01) this.out.draw(this.redImg.setAlpha(this.red));
      this.out.render();
      return;
    }
    const sig = none ? -1 : Math.round(D * 4);
    if (sig === this._drawn) return; // nada mudou (sem ruído, só redesenha quando a borda anda)
    this._drawn = sig;
    const R = Math.max(1, D) / (1 - F0);
    if (this.mode === "lite") {
      this.out.clear().draw(this.vig);
      if (!none) {
        this._reach(this.ex, R);
        this._reach(this.ey, R);
        this.out.draw(this.ex).draw(this.ey);
      }
      this.out.render();
      return;
    }
    this._drawCanvas(none ? 0 : R);
  }

  // Sem WebGL/highp: o mesmo desenho (sem ruído) em degradês de Canvas 2D
  _drawCanvas(R) {
    const c = this.canvas;
    const ctx = c.getContext();
    const { w, h } = this;
    const k = w / this.W; // px de tela → px da textura
    ctx.clearRect(0, 0, w, h);
    // vinheta: radial elíptico (raio SQ em UV chega ao canto)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(w, h);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, SQ);
    for (const [p, col, a] of VIG_STOPS) rg.addColorStop(p, css(col, a));
    ctx.fillStyle = rg;
    ctx.fillRect(-0.5, -0.5, 1, 1);
    ctx.restore();
    // as quatro bordas: campo 1 na borda → 0 a R px dela, pela mesma rampa
    const r = Math.min(R * k, Math.min(w, h) / 2);
    const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (const [f, col, a] of STOPS_LITE) g.addColorStop(clamp01(1 - f), css(col, a));
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    };
    if (r >= 1) {
      band(0, 0, r, 0, 0, 0, r, h);
      band(w, 0, w - r, 0, w - r, 0, r, h);
      band(0, 0, 0, r, 0, 0, w, r);
      band(0, h, 0, h - r, 0, h - r, w, r);
    }
    c.refresh();
  }

  destroy() {
    this.scene.scale.off("resize", this._onResize);
    this._teardown();
    this._dropOld();
    this.img?.destroy();
    this.img = null;
  }
}

function lerpColor(a, b, t) {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)),
    g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)),
    bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}
