// Vinhetas e luz do céu com o objeto Gradient do Phaser 4: um quad só, a cor sai da GPU com dither (sem faixas
// nos roxos e azuis escuros, que no canvas de 8 bits viravam degraus) e sem textura de canvas do tamanho da tela
// (~3,7 MB cada uma, uma por tamanho de tela). Acompanham a mudança de tamanho da tela.
import { vw, vh } from "../ui/Theme.js";

// [r, g, b, a] de 0 a 1 (formato das faixas do ColorRamp)
export const rgba = (c, a = 1) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, a];

// Mistura de duas cores 0xRRGGBB (t de 0 a 1)
export function mixColor(a, b, t) {
  const ch = (c, s) => (c >> s) & 255;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

// Gradiente radial: começa no meio do quad; o raio 1 da rampa = metade do lado
const radial = (scene, bands, depth) =>
  scene.add.gradient({ bands, shapeMode: 2, repeatMode: 0, start: { x: 0.5, y: 0.5 }, shape: { x: 0.5, y: 0 }, dither: true }, 0, 0, 2, 2).setDepth(depth);

// Vinheta presa na tela: transparente até r0 e escurecendo até r1 (alpha na borda). geom(W, H) devolve
// { cx, cy, r0, r1 } em pixels — redonda, não estica com a tela. Com ellipse: true, r0/r1 são frações da
// meia-largura/meia-altura e ela acompanha o formato da tela (como a textura esticada de antes).
export class ScreenVignette {
  constructor(scene, { geom, color, alpha = 0.6, depth = 0, ellipse = false, ease = 0 }) {
    Object.assign(this, { scene, geom, color, alpha, ellipse, ease });
    const clear = { colorStart: rgba(color, 0) };
    this.obj = radial(scene, [{ start: 0, end: 0.3, ...clear }, { start: 0.3, end: 0.6, ...clear }, { start: 0.6, end: 1, ...clear }], depth).setScrollFactor(0);
    this._fit = () => this.fit();
    scene.scale.on("resize", this._fit);
    scene.events.once("shutdown", () => scene.scale.off("resize", this._fit));
    this.fit();
  }

  fit() {
    const W = vw(this.scene),
      H = vh(this.scene);
    const { cx = W / 2, cy = H / 2, r0, r1 } = this.geom(W, H);
    let a, b;
    if (this.ellipse) {
      // quad do tamanho da tela: a distância da rampa é a do UV (0,5 = borda), elipse no formato da tela
      this.obj.setPosition(cx, cy).setSize(W, H).setOrigin(0.5); // (a origem é refeita: o setSize não a refaz)
      a = r0;
      b = r1;
    } else {
      // quad quadrado (círculo em pixels) que cobre a tela inteira; o que sobra fora da tela não custa nada
      const Q = Math.ceil(Math.max(r1, Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)))) + 2;
      this.obj.setPosition(cx, cy).setSize(2 * Q, 2 * Q).setOrigin(0.5);
      a = r0 / Q;
      b = r1 / Q;
    }
    const c = this.color,
      k = this.alpha;
    // sempre 3 faixas (a profundidade da árvore de faixas do shader não muda); r1 pode passar da borda
    this.obj.ramp.setBands([
      { start: 0, end: a, colorStart: rgba(c, 0), colorEnd: rgba(c, 0) },
      { start: a, end: b, colorStart: rgba(c, 0), colorEnd: rgba(c, k), interpolation: this.ease },
      { start: b, end: Math.max(1, b + 0.01), colorStart: rgba(c, k), colorEnd: rgba(c, k) },
    ]);
    return this;
  }

  // Força da vinheta (o Gradient não tem alpha próprio: vai na cor da borda)
  setAlpha(k) {
    if (Math.abs(k - this.alpha) < 0.004) return this;
    this.alpha = k;
    return this.fit();
  }

  setVisible(v) {
    this.obj.setVisible(v);
    return this;
  }
}

// Luz do céu em volta de um ponto do MUNDO (a fogueira da Clareira): um quad quadrado de raio R, em MULTIPLY.
// Perto do centro a cor "quente", no meio a do céu, na borda a "fria". As três cores mudam com a hora (setColors)
// w/h (opcional) trocam o quadrado de lado 2R por um retângulo: o degradê vira uma elipse (a Clareira da Caatinga
// usa para a camada da noite parar na linha do horizonte e deixar o céu com as cores dele)
export class SkyGlow {
  constructor(scene, { x, y, R, depth, stops = [0.06, 0.3], w = 2 * R, h = 2 * R }) {
    Object.assign(this, { scene, stops });
    this.obj = radial(scene, [{ start: 0, end: 1, colorStart: rgba(0xffffff) }], depth)
      .setPosition(x, y)
      .setSize(w, h)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.setColors(0xffffff, 0xffffff, 0xffffff); // já nasce com as 3 faixas
  }

  setColors(warm, sky, cold) {
    const [a, b] = this.stops;
    this.obj.ramp.setBands([
      { start: 0, end: a, colorStart: rgba(warm), colorEnd: rgba(warm) },
      { start: a, end: b, colorStart: rgba(warm), colorEnd: rgba(sky), interpolation: 2 },
      { start: b, end: 1, colorStart: rgba(sky), colorEnd: rgba(cold), interpolation: 2 },
    ]);
    return this;
  }

  setVisible(v) {
    this.obj.setVisible(v);
    return this;
  }
}
