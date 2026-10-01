// Animação "de verdade" dos guardiões caindo e acordando. Em vez de girar o sprite de
// caminhada, cada quadro é DESENHADO numa pose, com um esqueleto simples (quadril, tronco,
// cabeça, 2 braços, 2 pernas) e as mesmas primitivas/paleta de Hero.js. Os quatro heróis
// compartilham as poses (keyframes) e mudam só o figurino.
//
// Ângulos em graus. Tronco/cabeça: 0 = em pé, negativo = inclinado para trás (esquerda),
// -90 = deitado de costas com a cabeça à esquerda. Braços/pernas: 0 = para baixo,
// positivo = para a frente (direita), 90 = horizontal para a direita, 180 = para cima.
// Os personagens olham para a DIREITA (como em Hero.js).
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";

export const RIG_W = 52;
export const RIG_H = 32;
export const GROUND = 28; // linha do chão (y do pé em pé)

const SKIN = { base: 0x9a6a4a, shade: 0x7a4e36, light: 0xb8805a };
const SKIN_DARK = { base: 0x7a4a32, shade: 0x5e3826, light: 0x9a6446 };

const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const down = (a) => [Math.sin(rad(a)), Math.cos(rad(a))]; // ângulo de membro
const up = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))]; // ângulo de tronco/cabeça
const LIGHT = [-0.55, -0.83]; // luz vem da esquerda/cima (como nos sprites em pé)

// Segmento "cônico" (cápsula de largura variável) sombreado por 3 tons
function taper(p, x0, y0, x1, y1, w0, w1, cols, colorFn = null) {
  const dx = x1 - x0,
    dy = y1 - y0,
    len = Math.hypot(dx, dy) || 1;
  const pad = Math.max(w0, w1) / 2 + 1;
  const xa = Math.floor(Math.min(x0, x1) - pad),
    xb = Math.ceil(Math.max(x0, x1) + pad),
    ya = Math.floor(Math.min(y0, y1) - pad),
    yb = Math.ceil(Math.max(y0, y1) + pad);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0,
        py = y + 0.5 - y0;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (len * len)));
      const cx = x0 + dx * t,
        cy = y0 + dy * t;
      const ox = x + 0.5 - cx,
        oy = y + 0.5 - cy;
      const half = lerp(w0, w1, t) / 2;
      const d = Math.hypot(ox, oy);
      if (d > half) continue;
      const b = d < 0.01 ? 0 : (ox * LIGHT[0] + oy * LIGHT[1]) / half / Math.hypot(LIGHT[0], LIGHT[1]);
      const c = colorFn ? colorFn(t, b) : b > 0.3 ? cols[1] : b < -0.3 ? cols[2] : cols[0];
      if (c != null) p.set(x, y, c);
    }
}

// Cabeça oval sombreada (mesma regra de Hero.js)
function headBall(p, cx, cy, rx, ry, sk) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, -dx * 0.5 - dy * 0.4 > 0.35 ? sk.light : dx > 0.55 || dy > 0.6 ? sk.shade : sk.base);
    }
}

// Pose → pontos do esqueleto
function solve(pose) {
  const [hx, hy] = pose.hip;
  const tu = up(pose.torso);
  const LT = pose.torsoLen ?? 7;
  const sh = [hx + tu[0] * LT, hy + tu[1] * LT];
  const hu = up(pose.head);
  const hf = [Math.cos(rad(pose.head)), Math.sin(rad(pose.head))]; // "para a frente" da cabeça
  const hc = [sh[0] + hu[0] * 4.6, sh[1] + hu[1] * 4.6];
  const limb = (root, a1, a2, l1, l2) => {
    const d1 = down(a1),
      d2 = down(a2);
    const mid = [root[0] + d1[0] * l1, root[1] + d1[1] * l1];
    return { root, mid, end: [mid[0] + d2[0] * l2, mid[1] + d2[1] * l2], d2 };
  };
  const armRoot = [sh[0] - tu[0] * 0.8, sh[1] - tu[1] * 0.8];
  return {
    hip: [hx, hy],
    sh,
    hc,
    hu,
    hf,
    tu,
    armF: limb(armRoot, pose.armF[0], pose.armF[1], 3.6, 3.4),
    armB: limb(armRoot, pose.armB[0], pose.armB[1], 3.6, 3.4),
    legF: limb([hx + 0.6, hy], pose.legF[0], pose.legF[1], 4.6, 4.4),
    legB: limb([hx - 0.6, hy], pose.legB[0], pose.legB[1], 4.6, 4.4),
  };
}

// Rosto: olho e boca no referencial da cabeça (f = frente, u = cima)
function face(p, k, pose, sk) {
  const [cx, cy] = k.hc;
  const { hf, hu } = k;
  const at = (f, u) => [Math.round(cx + hf[0] * f + hu[0] * u - 0.5), Math.round(cy + hf[1] * f + hu[1] * u - 0.5)];
  const eyes = pose.eyes ?? "open";
  const [ex, ey] = at(2.2, 0.8);
  const [bx, by] = at(1.2, 0.8);
  if (eyes === "open") {
    p.set(bx, by, PAL.white);
    p.set(ex, ey, PAL.ink);
  } else if (eyes === "wide") {
    p.set(bx, by, PAL.white);
    p.set(ex, ey, PAL.ink);
    const [wx, wy] = at(1.8, 1.9);
    p.set(wx, wy, PAL.white); // sobrancelha/brilho arregalado
  } else if (eyes === "half") {
    p.set(bx, by, sk.shade);
    p.set(ex, ey, PAL.ink);
  } else if (eyes === "squint") {
    p.set(bx, by, PAL.ink);
    p.set(ex, ey, PAL.ink);
    const [qx, qy] = at(2.8, 1.8);
    p.set(qx, qy, sk.shade);
  } else {
    // fechado: um risquinho escuro
    p.set(bx, by, PAL.ink);
    p.set(ex, ey, PAL.ink);
  }
  const mouth = pose.mouth ?? "calm";
  if (mouth === "open") {
    const [mx, my] = at(2.3, -1.8);
    p.set(mx, my, PAL.ink);
    const [m2x, m2y] = at(1.5, -1.8);
    p.set(m2x, m2y, PAL.red1);
  } else if (mouth === "grit") {
    const [mx, my] = at(2.2, -1.8);
    p.set(mx, my, PAL.ink);
    const [m2x, m2y] = at(1.5, -1.8);
    p.set(m2x, m2y, PAL.white);
  } else {
    const [mx, my] = at(2.3, -1.9);
    p.set(mx, my, sk.shade);
  }
}

function foot(p, leg, back, col, dark) {
  const d = leg.d2;
  const fx = back ? -d[1] : d[1],
    fy = back ? d[0] : -d[0];
  const [x, y] = leg.end;
  p.set(Math.round(x + fx * 1 - 0.5), Math.round(y + fy * 1 - 0.5), col);
  p.set(Math.round(x + fx * 2 - 0.5), Math.round(y + fy * 2 - 0.5), dark);
}

// ---------------------------------------------------------------------------
// Figurinos
// ---------------------------------------------------------------------------
const STYLE = {
  // CURUPIRA — cabelo de fogo, tanga de folhas, pés virados para trás, cajado de fogo
  guardian(p, pose, k, t) {
    const sk = SKIN;
    const flick = Math.floor(t * 3) % 2;
    taper(p, ...k.legB.root, ...k.legB.mid, 3, 2.6, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.legB.mid, ...k.legB.end, 2.6, 2.2, [sk.shade, sk.shade, sk.shade]);
    foot(p, k.legB, true, sk.shade, sk.shade);
    taper(p, ...k.armB.root, ...k.armB.mid, 2.2, 2, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.armB.mid, ...k.armB.end, 2, 1.8, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.legF.root, ...k.legF.mid, 3.2, 2.7, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.legF.mid, ...k.legF.end, 2.7, 2.3, [sk.base, sk.light, sk.shade]);
    foot(p, k.legF, true, sk.base, sk.shade);
    taper(p, ...k.hip, ...k.sh, 5, 5.6, [sk.base, sk.light, sk.shade]);
    // tanga de folhas (serrilhada) no quadril
    const lt = [k.hip[0] + k.tu[0] * 1, k.hip[1] + k.tu[1] * 1];
    taper(p, ...k.hip, lt[0], lt[1], 6.4, 6, null, (tt, b) => (b > 0.3 ? PAL.g6 : b < -0.3 ? PAL.g4 : PAL.g5));
    const dl = down(pose.torso);
    for (let i = -2; i <= 2; i++) {
      const px = Math.round(k.hip[0] + dl[0] * 2.4 + dl[1] * i * 1.2 - 0.5),
        py = Math.round(k.hip[1] + dl[1] * 2.4 - dl[0] * i * 1.2 - 0.5);
      p.set(px, py, i % 2 ? PAL.g3 : PAL.g5);
    }
    // colar de sementes
    for (let i = -1; i <= 1; i++) p.set(Math.round(k.sh[0] - k.tu[0] * 1 + k.hf[0] * i * 1.2 - 0.5), Math.round(k.sh[1] - k.tu[1] * 1 + k.hf[1] * i * 1.2 - 0.5), i % 2 ? PAL.yel2 : PAL.red2);
    // cabeça + cabelo de chamas
    headBall(p, ...k.hc, 4, 3.8, sk);
    // cabelo de chamas: nasce no alto da cabeça e sobe em línguas (base laranja → ponta amarela)
    const flame = [PAL.org1, PAL.org2, PAL.org3, PAL.yel3];
    for (const [fo, ln] of [[-3.4, 2.4], [-2, 3.8], [-0.4, 4.8], [1.2, 4], [2.6, 2.8], [-4, 1]]) {
      const bx = k.hc[0] + k.hu[0] * 2.9 + k.hf[0] * fo,
        by = k.hc[1] + k.hu[1] * 2.9 + k.hf[1] * fo;
      const len = ln + (flick && fo > 0 ? 0.9 : 0) + (pose.fireDrop ? -1.4 : 0);
      const tx = bx + k.hu[0] * len + k.hf[0] * 0.4,
        ty = by + k.hu[1] * len + k.hf[1] * 0.4;
      taper(p, bx, by, tx, ty, 2.2, 0.5, null, (tt) => flame[Math.min(3, Math.floor(tt * 4.2))]);
    }
    // franja de brasa na testa (a cabeça continua visível por baixo)
    for (let i = -3; i <= 0; i++) p.set(Math.round(k.hc[0] + k.hu[0] * 2.7 + k.hf[0] * i * 1.1 - 0.5), Math.round(k.hc[1] + k.hu[1] * 2.7 + k.hf[1] * i * 1.1 - 0.5), i % 2 ? PAL.org1 : PAL.red1);
    face(p, k, pose, sk);
    taper(p, ...k.armF.root, ...k.armF.mid, 2.4, 2.2, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.armF.mid, ...k.armF.end, 2.2, 2, [sk.base, sk.light, sk.shade]);
    return k.armF.end;
  },
  // CAIPORA — cabeleira de folhas, túnica de palha, colar de urucum, bumerangue
  huntress(p, pose, k, t) {
    const sk = SKIN_DARK;
    const straw = [PAL.straw3, PAL.straw2, PAL.straw1];
    taper(p, ...k.legB.root, ...k.legB.mid, 3, 2.6, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.legB.mid, ...k.legB.end, 2.6, 2.2, [sk.shade, sk.shade, sk.shade]);
    foot(p, k.legB, false, sk.shade, sk.shade);
    // cabeleira longa de folhas, atrás das costas
    const back = [k.hc[0] - k.hu[0] * 0.5 - k.hf[0] * 3, k.hc[1] - k.hu[1] * 0.5 - k.hf[1] * 3];
    const hairEnd = pose.hairLie ? [k.hc[0] - 6.5, GROUND - 1] : [k.hip[0] - k.hf[0] * 3.4 + k.tu[0] * 0.6, k.hip[1] - k.hf[1] * 3.4 + k.tu[1] * 0.6];
    taper(p, ...back, ...hairEnd, 4.6, 3.6, null, (tt, b) => ((Math.round(tt * 9) + (b > 0 ? 1 : 0)) % 3 === 0 ? PAL.g6 : (Math.round(tt * 9)) % 3 === 1 ? PAL.g5 : PAL.g3));
    taper(p, ...k.armB.root, ...k.armB.mid, 2.2, 2, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.armB.mid, ...k.armB.end, 2, 1.8, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.legF.root, ...k.legF.mid, 3.2, 2.7, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.legF.mid, ...k.legF.end, 2.7, 2.3, [sk.base, sk.light, sk.shade]);
    foot(p, k.legF, false, sk.base, sk.shade);
    // túnica de fibra trançada
    taper(p, k.hip[0] - k.tu[0] * 0.2, k.hip[1] - k.tu[1] * 0.2, ...k.sh, 6.6, 6, null, (tt, b) => (Math.round(tt * 8 + (b > 0 ? 1 : 0)) % 4 === 0 ? PAL.straw0 : b > 0.3 ? straw[0] : b < -0.3 ? straw[2] : straw[1]));
    for (let i = -1; i <= 1; i++) p.set(Math.round(k.sh[0] - k.tu[0] * 0.6 + k.hf[0] * i * 1.2 - 0.5), Math.round(k.sh[1] - k.tu[1] * 0.6 + k.hf[1] * i * 1.2 - 0.5), i % 2 ? PAL.red2 : PAL.red1);
    headBall(p, ...k.hc, 4, 3.8, sk);
    // coroa de folhas
    for (let i = -3; i <= 3; i++) {
      const bx = k.hc[0] + k.hu[0] * 3.4 + k.hf[0] * i * 1.1,
        by = k.hc[1] + k.hu[1] * 3.4 + k.hf[1] * i * 1.1;
      p.set(Math.round(bx - 0.5), Math.round(by - 0.5), i % 2 ? PAL.g5 : PAL.g6);
      if (i % 2 === 0) p.set(Math.round(bx + k.hu[0] - 0.5), Math.round(by + k.hu[1] - 0.5), PAL.g6);
    }
    p.set(Math.round(k.hc[0] + k.hu[0] * 3 + k.hf[0] * 4 - 0.5), Math.round(k.hc[1] + k.hu[1] * 3 + k.hf[1] * 4 - 0.5), PAL.pink); // florzinha
    face(p, k, pose, sk);
    taper(p, ...k.armF.root, ...k.armF.mid, 2.4, 2.2, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.armF.mid, ...k.armF.end, 2.2, 2, [sk.base, sk.light, sk.shade]);
    return k.armF.end;
  },
  // IARA — cabelo longo azulado, vestido de escamas que termina em nadadeira (sem pés)
  druid(p, pose, k, t) {
    const sk = SKIN;
    const back = [k.hc[0] - k.hu[0] * 2 - k.hf[0] * 2.2, k.hc[1] - k.hu[1] * 2 - k.hf[1] * 2.2];
    const hairEnd = pose.hairLie ? [k.hc[0] - 7, GROUND - 1] : [k.hip[0] - k.hf[0] * 2.2 - k.tu[0] * 2, k.hip[1] - k.hf[1] * 2.2 - k.tu[1] * 2];
    taper(p, ...back, ...hairEnd, 5, 3.6, null, (tt, b) => (Math.round(tt * 10) % 4 === 1 ? PAL.ice1 : b > 0.2 ? PAL.pur0 : PAL.ice0));
    taper(p, ...k.armB.root, ...k.armB.mid, 2.2, 2, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.armB.mid, ...k.armB.end, 2, 1.8, [sk.shade, sk.shade, sk.shade]);
    // "cauda" de vestido: segue as pernas, afinando até a nadadeira
    const scale = (tt, b) => (b > 0.3 ? PAL.ice3 : b < -0.3 ? PAL.ice1 : PAL.ice2);
    const tail = (leg, w0, w1) => {
      taper(p, ...leg.root, ...leg.mid, w0, w1, null, scale);
      taper(p, ...leg.mid, ...leg.end, w1, 2.4, null, scale);
    };
    tail(k.legB, 4.2, 3.4);
    tail(k.legF, 5, 3.6);
    // nadadeira em duas pontas
    for (const [leg, s] of [[k.legF, 1], [k.legB, -1]]) {
      const d = leg.d2;
      const nx = d[1] * s,
        ny = -d[0] * s;
      taper(p, ...leg.end, leg.end[0] + d[0] * 2 + nx * 1.6, leg.end[1] + d[1] * 2 + ny * 1.6, 2.4, 0.6, null, (tt) => (tt > 0.6 ? PAL.ice3 : PAL.ice2));
    }
    taper(p, k.hip[0] - k.tu[0] * 0.4, k.hip[1] - k.tu[1] * 0.4, ...k.sh, 6.8, 6, null, (tt, b) => ((Math.round(tt * 7) + (b > 0 ? 1 : 0)) % 3 === 0 ? 0x4a8fd0 : scale(tt, b)));
    headBall(p, ...k.hc, 4, 3.8, sk);
    // franja e topo do cabelo
    for (let i = -3; i <= 3; i++) {
      const bx = k.hc[0] + k.hu[0] * 3 + k.hf[0] * i * 1.1,
        by = k.hc[1] + k.hu[1] * 3 + k.hf[1] * i * 1.1;
      p.set(Math.round(bx - 0.5), Math.round(by - 0.5), i > 1 ? PAL.ice0 : PAL.pur0);
      if (i < 2) p.set(Math.round(bx - k.hu[0] - 0.5), Math.round(by - k.hu[1] - 0.5), PAL.ice0);
    }
    p.set(Math.round(k.hc[0] + k.hu[0] * 3.2 - k.hf[0] * 1.5 - 0.5), Math.round(k.hc[1] + k.hu[1] * 3.2 - k.hf[1] * 1.5 - 0.5), PAL.pink); // concha
    face(p, k, pose, sk);
    taper(p, ...k.armF.root, ...k.armF.mid, 2.4, 2.2, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.armF.mid, ...k.armF.end, 2.2, 2, [sk.base, sk.light, sk.shade]);
    return k.armF.end;
  },
  // SACI — uma perna só, gorro vermelho, bermuda vermelha, faísca na mão
  shaman(p, pose, k, t) {
    const sk = SKIN_DARK;
    taper(p, ...k.armB.root, ...k.armB.mid, 2.2, 2, [sk.shade, sk.shade, sk.shade]);
    taper(p, ...k.armB.mid, ...k.armB.end, 2, 1.8, [sk.shade, sk.shade, sk.shade]);
    // a perna única (a "de trás" fica dobrada/escondida)
    taper(p, ...k.legF.root, ...k.legF.mid, 3.2, 2.7, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.legF.mid, ...k.legF.end, 2.7, 2.3, [sk.base, sk.light, sk.shade]);
    foot(p, k.legF, false, sk.base, sk.shade);
    taper(p, ...k.hip, ...k.sh, 5, 5.2, [sk.base, sk.light, sk.shade]);
    const lt = [k.hip[0] + k.tu[0] * 1.6, k.hip[1] + k.tu[1] * 1.6];
    taper(p, ...k.hip, lt[0], lt[1], 5.8, 5.4, null, (tt, b) => (b > 0.3 ? PAL.red3 : b < -0.3 ? PAL.red1 : PAL.red2));
    headBall(p, ...k.hc, 3.9, 3.7, sk);
    // gorro vermelho com a ponta caindo para trás
    const capB = [k.hc[0] + k.hu[0] * 2.7 + k.hf[0] * 0.1, k.hc[1] + k.hu[1] * 2.7 + k.hf[1] * 0.1];
    taper(p, ...capB, k.hc[0] + k.hu[0] * 4 - k.hf[0] * 1.2, k.hc[1] + k.hu[1] * 4 - k.hf[1] * 1.2, 4.4, 2.8, null, (tt, b) => (b > 0.2 ? PAL.red3 : PAL.red2));
    // aba do gorro (faixa mais escura na testa)
    taper(p, k.hc[0] + k.hu[0] * 2.5 - k.hf[0] * 2.4, k.hc[1] + k.hu[1] * 2.5 - k.hf[1] * 2.4, k.hc[0] + k.hu[0] * 2.5 + k.hf[0] * 2.8, k.hc[1] + k.hu[1] * 2.5 + k.hf[1] * 2.8, 1.4, 1.4, [PAL.red1, PAL.red1, PAL.red0]);
    const tipEnd = pose.capDrop
      ? [k.hc[0] - k.hf[0] * 4 - k.hu[0] * 2.5, k.hc[1] - k.hf[1] * 4 - k.hu[1] * 2.5]
      : [k.hc[0] - k.hf[0] * 5 + k.hu[0] * 1, k.hc[1] - k.hf[1] * 5 + k.hu[1] * 1];
    taper(p, k.hc[0] + k.hu[0] * 3.6 - k.hf[0] * 1.8, k.hc[1] + k.hu[1] * 3.6 - k.hf[1] * 1.8, ...tipEnd, 3, 1.2, null, (tt) => (tt > 0.6 ? PAL.red1 : PAL.red2));
    face(p, k, pose, sk);
    taper(p, ...k.armF.root, ...k.armF.mid, 2.4, 2.2, [sk.base, sk.light, sk.shade]);
    taper(p, ...k.armF.mid, ...k.armF.end, 2.2, 2, [sk.base, sk.light, sk.shade]);
    return k.armF.end;
  },
};

// Adereços na mão (desenhados por cima da mão, antes do contorno)
function prop(p, id, pose, hand, t) {
  if (pose.prop === "none") return;
  const [hx, hy] = hand;
  const a = pose.propAngle ?? 8; // ângulo do cabo (0 = vertical)
  const d = up(a);
  const px = pose.propPos ? pose.propPos[0] : hx,
    py = pose.propPos ? pose.propPos[1] : hy;
  if (id === "guardian") {
    // cajado de madeira com orbe de fogo
    const x1 = px + d[0] * 13,
      y1 = py + d[1] * 13,
      x0 = px - d[0] * 5,
      y0 = py - d[1] * 5;
    taper(p, x0, y0, x1, y1, 1.6, 1.6, [PAL.n3, PAL.n4, PAL.n2]);
    p.disc(x1 + d[0] * 0.5, y1 + d[1] * 0.5, 2.6, PAL.org1);
    p.disc(x1 + d[0] * 0.3, y1 + d[1] * 0.3, 1.8, PAL.org2);
    p.set(Math.round(x1 - 0.5), Math.round(y1 - 0.5), PAL.yel3);
  } else if (id === "huntress") {
    // bumerangue de madeira em brasa
    const a2 = rad(pose.propAngle ?? 8);
    const rot = (x, y) => [px + x * Math.cos(a2) - y * Math.sin(a2), py - 1 + x * Math.sin(a2) + y * Math.cos(a2)];
    const arm = (pts, col) => pts.forEach(([x, y]) => { const [rx, ry] = rot(x, y); p.rect(Math.round(rx - 1), Math.round(ry - 1), 2, 2, col); });
    arm([[0, 0], [1.6, -0.6], [3, -2], [3.6, -3.8], [4, -5.6]], PAL.n3);
    arm([[-1.6, -0.6], [-3, -2], [-3.8, -3.6]], PAL.n2);
    const [ex, ey] = rot(3, -2);
    p.set(Math.round(ex - 0.5), Math.round(ey - 0.5), PAL.org2);
    const [fx, fy] = rot(4, -5.6);
    p.set(Math.round(fx - 0.5), Math.round(fy - 0.5), PAL.org3);
  } else if (id === "druid") {
    // gotas/aura de gelo na palma
    p.set(Math.round(px + 1 - 0.5), Math.round(py - 1 - 0.5), PAL.white);
    p.set(Math.round(px + 2 - 0.5), Math.round(py - 0.5 - 0.5), PAL.ice3);
    p.set(Math.round(px + 1 - 0.5), Math.round(py + 1 - 0.5), PAL.ice2);
  } else if (id === "shaman") {
    // faísca roxa
    p.set(Math.round(px + 1 - 0.5), Math.round(py - 1 - 0.5), PAL.white);
    p.set(Math.round(px + 1 - 0.5), Math.round(py - 2 - 0.5), PAL.pur3);
    p.set(Math.round(px + 2 - 0.5), Math.round(py - 0.5), PAL.pur2);
  }
}

// ---------------------------------------------------------------------------
// Poses-chave. hip = [x, y] do quadril. Quadro a quadro, na ordem da história.
// ---------------------------------------------------------------------------
const P = (o) => ({ torso: 0, head: 0, armF: [30, 60], armB: [-8, -4], legF: [6, 0], legB: [-6, 0], eyes: "open", mouth: "calm", ...o });

const X = 22; // x do quadril: o mesmo em todos os quadros (o corpo "fica no lugar" na cena)
const LAND = { propPos: [34, 28.6], propAngle: 90 }; // cajado caído no chão, à direita

export const RIG_POSES = {
  // ---- queda ----
  idle: P({ hip: [X, 21.5], armF: [38, 78], propAngle: 8 }),
  idle2: P({ hip: [X, 21.5], armF: [38, 78], propAngle: 8 }), // mesmo quadro: só a chama treme diferente
  hit: P({ hip: [X - 1, 21.5], torso: -9, head: -14, armF: [96, 150], armB: [-34, -58], legF: [12, -4], legB: [-14, 4], eyes: "wide", mouth: "open", propPos: [X + 9, 9], propAngle: 30 }),
  recoil: P({ hip: [X - 1.5, 21.8], torso: -20, head: -26, armF: [118, 168], armB: [-52, -78], legF: [24, -10], legB: [-20, 6], eyes: "squint", mouth: "grit", propPos: [X + 13, 5], propAngle: 70, fireDrop: true }),
  buckle: P({ hip: [X - 2.5, 23.2], torso: -30, head: -34, armF: [110, 140], armB: [-60, -84], legF: [60, -34], legB: [30, -52], eyes: "squint", mouth: "grit", propPos: [X + 17, 9], propAngle: 112, fireDrop: true, capDrop: true }),
  fall1: P({ hip: [X - 3, 25], torso: -52, head: -58, armF: [100, 118], armB: [-84, -110], legF: [66, 8], legB: [46, -22], eyes: "closed", mouth: "open", propPos: [X + 19, 17], propAngle: 140, fireDrop: true, capDrop: true }),
  fall2: P({ hip: [X - 1, 26], torso: -74, head: -80, armF: [92, 104], armB: [-110, -128], legF: [78, 40], legB: [70, 10], eyes: "closed", mouth: "calm", propPos: [X + 17, 25], propAngle: 100, fireDrop: true, capDrop: true }),
  impact: P({ hip: [X, 26.3], torso: -88, head: -92, armF: [100, 124], armB: [100, 94], legF: [80, 100], legB: [90, 92], eyes: "closed", mouth: "calm", propPos: [X + 15, 27], propAngle: 96, fireDrop: true, capDrop: true, hairLie: true }),
  bounce: P({ hip: [X, 25.0], torso: -86, head: -88, armF: [118, 150], armB: [104, 98], legF: [70, 96], legB: [86, 90], eyes: "closed", propPos: [X + 15, 25.8], propAngle: 84, fireDrop: true, capDrop: true, hairLie: true }),
  // ---- deitado (respiração) ----
  lieA: P({ hip: [X, 26.1], torso: -90, head: -94, armF: [112, 134], armB: [100, 94], legF: [74, 104], legB: [90, 96], eyes: "closed", ...LAND, fireDrop: true, capDrop: true, hairLie: true }),
  lieB: P({ hip: [X, 25.9], torso: -89, head: -95, torsoLen: 7.4, armF: [112, 136], armB: [100, 94], legF: [74, 104], legB: [90, 96], eyes: "closed", ...LAND, fireDrop: true, capDrop: true, hairLie: true }),
  // ---- acorda ----
  stir: P({ hip: [X, 26.1], torso: -90, head: -72, armF: [100, 76], armB: [102, 98], legF: [74, 104], legB: [90, 96], eyes: "half", mouth: "calm", ...LAND, fireDrop: true, capDrop: true, hairLie: true }),
  eyes: P({ hip: [X, 26.1], torso: -90, head: -78, armF: [110, 60], armB: [102, 98], legF: [74, 104], legB: [90, 96], eyes: "wide", ...LAND, fireDrop: true, capDrop: true, hairLie: true }),
  prop: P({ hip: [X, 25.8], torso: -68, head: -46, armF: [150, 190], armB: [-58, -30], legF: [88, 92], legB: [86, 88], eyes: "half", mouth: "grit", ...LAND, fireDrop: true, capDrop: true, hairLie: true }),
  sit1: P({ hip: [X, 25.6], torso: -30, head: -18, armF: [150, 200], armB: [-64, -40], legF: [84, 98], legB: [80, 94], eyes: "squint", mouth: "grit", ...LAND, capDrop: true }),
  sit2: P({ hip: [X, 25.6], torso: -22, head: -8, armF: [130, 190], armB: [-60, -44], legF: [84, 98], legB: [80, 94], eyes: "open", mouth: "calm", ...LAND, capDrop: true }),
  knee: P({ hip: [X, 24.4], torso: 8, head: 2, armF: [70, 40], armB: [-30, -20], legF: [80, -62], legB: [62, 72], eyes: "open", ...LAND, capDrop: true }),
  rise: P({ hip: [X, 22.6], torso: 6, head: 0, armF: [44, 70], armB: [-18, -6], legF: [14, 4], legB: [-12, 2], eyes: "open", ...LAND }),
};

export const RIG_KEYS = Object.keys(RIG_POSES);

// Quadro de uma pose para um herói. t = tempo (chamas tremulam).
export function renderPose(charId, poseKey, t = 0) {
  const pose = RIG_POSES[poseKey];
  const p = new Pix(RIG_W, RIG_H);
  const k = solve(pose);
  const hand = STYLE[charId](p, pose, k, t);
  prop(p, charId, pose, hand, t);
  p.outline(PAL.ink);
  return p;
}

// Sequências (nome → [pose, ms])
export const RIG_SEQ = {
  idleloop: [["idle", 260], ["idle2", 260]],
  fall: [["hit", 100], ["recoil", 120], ["buckle", 150], ["fall1", 140], ["fall2", 120], ["impact", 120], ["bounce", 130], ["lieA", 220]],
  lie: [["lieA", 1100], ["lieB", 1300]],
  wake: [["lieA", 500], ["stir", 800], ["eyes", 1000], ["prop", 800], ["sit1", 900], ["sit2", 900], ["knee", 700], ["rise", 500], ["idle", 300]],
};

// Registra herodown_<id>: uma tira com todos os quadros-chave + as animações
export function registerHeroRig(scene) {
  const keys = RIG_KEYS;
  for (const id of ["guardian", "huntress", "druid", "shaman"]) {
    registerStrip(scene, `herorig_${id}`, keys.map((k, i) => renderPose(id, k, i)));
    for (const [name, steps] of Object.entries(RIG_SEQ)) {
      const anim = `herorig_${id}_${name}`;
      if (scene.anims.exists(anim)) scene.anims.remove(anim);
      scene.anims.create({
        key: anim,
        frames: steps.map(([pk, ms]) => ({ key: `herorig_${id}`, frame: keys.indexOf(pk), duration: ms })),
        repeat: name === "lie" || name === "idleloop" ? -1 : 0,
      });
    }
  }
}
