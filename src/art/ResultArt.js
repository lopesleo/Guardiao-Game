// Arte da tela de resultado (GameOverScene) por cima das camadas da tela de título (TitleArt.js): o sol nascendo
// atrás da serra na vitória, os raios de luz, pássaros cruzando o amanhecer, a aurora da Noite Eterna e os
// mandacarus da Caatinga no horizonte. Pixel de arte em TITLE_PX, só com a paleta (Palette.js).
import { PAL } from "./Palette.js";
import { Pix, rng, bayer } from "./PixelArt.js";

// Sol nascendo: disco em faixas (centro claro, borda dourada), sem contorno — é luz
export function makeSun(r = 13) {
  const n = Math.ceil(r * 2) + 2;
  const p = new Pix(n, n);
  const c = n / 2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / r;
      if (d > 1) continue;
      const tone = d < 0.62 ? PAL.sun1 : d < 0.86 ? (bayer(x, y) < (d - 0.62) / 0.24 ? PAL.sun0 : PAL.sun1) : PAL.sun0;
      p.set(x, y, tone);
    }
  return p;
}

// Raio de sol: cunha fina que abre e some na ponta (soma por cima do céu, ADD)
export function makeRay(len = 120, w = 9) {
  const p = new Pix(w, len);
  for (let y = 0; y < len; y++) {
    const t = y / (len - 1); // 0 = no sol, 1 = a ponta
    const half = 0.5 + t * (w / 2 - 0.5);
    const a = Math.round(255 * Math.pow(1 - t, 1.6) * 0.9);
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - w / 2) / half;
      if (d > 1) continue;
      p.set(x, y, PAL.sun0, Math.round(a * (1 - d * d)));
    }
  }
  return p;
}

// Pássaro ao longe (7×4), 2 quadros: asas para cima / para baixo
export function makeBird(down) {
  const p = new Pix(7, 4);
  const c = PAL.dawnNear0;
  p.set(3, 2, c);
  p.set(3, 1, c);
  if (down) {
    p.set(2, 2, c);
    p.set(1, 3, c);
    p.set(4, 2, c);
    p.set(5, 3, c);
  } else {
    p.set(2, 1, c);
    p.set(1, 0, c);
    p.set(0, 0, c);
    p.set(4, 1, c);
    p.set(5, 0, c);
    p.set(6, 0, c);
  }
  return p;
}

// Aurora da Noite Eterna: cortinas que descem do alto, mais fortes na borda de baixo e sumindo para cima
export function makeAurora(w, h, seed, color) {
  const r = rng(seed);
  const p = new Pix(w, h);
  const ph = [r() * 6, r() * 6, r() * 6];
  for (let x = 0; x < w; x++) {
    const bottom = h * (0.62 + 0.22 * Math.sin(x * 0.045 + ph[0]) + 0.1 * Math.sin(x * 0.13 + ph[1]));
    const fold = 0.55 + 0.45 * Math.sin(x * 0.21 + ph[2]); // dobras da cortina: faixas mais e menos acesas
    for (let y = 0; y < bottom; y++) {
      const t = y / bottom; // 0 = alto, 1 = borda de baixo
      const a = Math.pow(t, 2.2) * fold * (t > 0.94 ? 1.25 : 1);
      if (a < 0.04) continue;
      p.set(x, y, color, Math.round(Math.min(1, a) * 150));
    }
  }
  return p;
}

// Pedestal do pódio do ranking (RankingModal.js): bloco de pedra em fiadas, laje clara no alto com tufos de musgo
// e a faixa na cor da medalha (trim = [tom, brilho]). h = altura do bloco; os tufos ficam nas 3 linhas de cima
export function makePedestal(h, trim, w = 40) {
  const T = 3;
  const p = new Pix(w, h + T);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const course = Math.floor((y - 4) / 7);
      let c = x < 3 ? PAL.s3 : x > w - 4 ? PAL.s1 : PAL.s2; // luz da esquerda
      if (y > 4 && (y - 4) % 7 === 0) c = PAL.s1; // juntas das fiadas
      else if (y > 4 && (x + (course % 2 ? 9 : 0)) % 18 === 0) c = PAL.s1; // juntas desencontradas
      p.set(x, y + T, c);
    }
  for (let x = 0; x < w; x++) {
    p.set(x, T, PAL.s4);
    p.set(x, T + 1, PAL.s3);
    p.set(x, T + 2, PAL.s3);
    p.set(x, T + 3, PAL.s1);
  }
  // faixa da medalha logo abaixo da laje
  for (let x = 3; x < w - 3; x++) {
    p.set(x, T + 5, trim[1]);
    p.set(x, T + 6, trim[0]);
    p.set(x, T + 7, trim[0]);
  }
  // tufos de musgo na laje (2 a 3 folhas)
  const r = rng(h * 31 + w);
  for (let x = 2; x < w - 2; x += 3 + Math.floor(r() * 4)) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) p.set(x + k - 1, T - (k === 1 ? 2 : 1), k === 1 ? PAL.g5 : PAL.g4);
    p.set(x, T, PAL.g3);
  }
  p.outline(PAL.ink);
  return p;
}

// Mandacarus e juremas no horizonte do sertão (silhueta cheia até embaixo, borda de luz por cima): o lugar da
// mata em makeTreeline quando o bioma é a Caatinga
export function makeCactusline(w, h, base, o) {
  const r = rng(o.seed);
  const p = new Pix(w, h);
  const ph = r() * 6;
  // caatinga rala: uma faixa contínua de mato baixo e seco (galhos finos, falhas), cheia até embaixo
  for (let x = 0; x < w; x++) {
    const n = 0.5 + 0.3 * Math.sin(x * 0.09 + ph) + 0.2 * Math.sin(x * 0.23 + ph * 2);
    const top = Math.round(base - 2 - n * o.minH * 0.45);
    for (let y = Math.max(0, top); y < h; y++) p.set(x, y, o.fill);
    // galhinhos secos espetados acima do mato
    if (r() < 0.16) for (let k = 1; k <= 1 + Math.floor(r() * 3); k++) p.set(x + (k > 2 ? 1 : 0), top - k, o.fill);
  }
  // mandacarus: coluna de 2 px com a ponta arredondada e braços em "U" que sobem; árvores secas (umbuzeiro)
  // de galhos abertos entre eles
  const column = (x, y0, y1) => {
    for (let y = y0 + 1; y <= y1; y++) {
      p.set(x, y, o.fill);
      p.set(x + 1, y, o.fill);
    }
    p.set(x, y0, o.fill); // ponta arredondada: 1 px por cima
  };
  let x = 6 + r() * 14;
  while (x < w + 10) {
    const xi = Math.round(x);
    if (r() < 0.62) {
      const hh = o.minH + r() * (o.maxH - o.minH);
      const top = Math.round(base - hh);
      column(xi, top, base);
      const arms = 1 + Math.floor(r() * 2.6);
      for (let a = 0; a < arms; a++) {
        const side = a % 2 ? -1 : 1;
        const ay = Math.round(base - hh * (0.3 + r() * 0.32)); // onde o braço sai
        const out = 2 + Math.round(r() * 2);
        const ax = side > 0 ? xi + 1 + out : xi - out - 1;
        for (let k = 1; k <= out; k++) {
          p.set(side > 0 ? xi + 1 + k : xi - k, ay, o.fill);
          p.set(side > 0 ? xi + 1 + k : xi - k, ay + 1, o.fill);
        }
        column(ax, Math.round(ay - hh * (0.22 + r() * 0.24)), ay + 1);
      }
      x += 14 + r() * 26;
    } else {
      // árvore seca: tronco curto e galhos abertos em forquilha
      const hh = o.minH * (0.55 + r() * 0.5);
      const top = Math.round(base - hh);
      for (let y = top + 3; y <= base; y++) p.set(xi, y, o.fill);
      const branch = (dx, len) => {
        for (let k = 0; k <= len; k++) p.set(xi + Math.round(dx * k), top + 3 - Math.round(k * 0.8), o.fill);
      };
      branch(-1, 3 + Math.round(r() * 2));
      branch(1, 3 + Math.round(r() * 2));
      branch(0.4, 4);
      x += 10 + r() * 18;
    }
  }
  // borda de luz: o topo de tudo e, nos mandacarus, o lado virado para o astro (o.lightX)
  const lit = [];
  for (let xx = 0; xx < w; xx++)
    for (let y = 0; y < base - 1; y++) {
      if (!p.get(xx, y)) continue;
      const side = o.lightX == null ? false : o.lightX > xx ? !p.get(xx + 1, y) : !p.get(xx - 1, y);
      if (!p.get(xx, y - 1) || side) lit.push([xx, y]);
    }
  for (const [xx, y] of lit) p.set(xx, y, o.rim);
  return p;
}
