// Sprites procedurais de gameplay: pickups, projéteis, partículas e sombras.
// Substituem os círculos/retângulos vetoriais (que "denunciavam" protótipo).
import { PAL } from "./Palette.js";
import { Pix, registerStrip, tileNoise, bayer } from "./PixelArt.js";

const K = PAL.ink;

// Gema de XP com brilho que percorre a face (4 frames)
function gemFrames(light, mid, dark) {
  const base = [
    "...kk...",
    "..kLMk..",
    ".kLMMDk.",
    "kLMMMMDk",
    "kMMMMMDk",
    ".kMMMDk.",
    "..kMDk..",
    "...kk...",
  ];
  const legend = { k: K, L: light, M: mid, D: dark };
  const shine = [
    [2, 3],
    [3, 3],
    [4, 4],
    [3, 5],
  ];
  return shine.map(([x, y]) => {
    const p = Pix.fromMap(base, legend);
    p.set(x, y, PAL.white);
    return p;
  });
}

// Moeda girando (4 frames: cheia → fina → borda → fina)
function coinFrames() {
  const maps = [
    [
      "..kkkk..",
      ".kzyyyk.",
      "kzyyYyYk",
      "kyyYyyYk",
      "kyyYyyYk",
      "kyyyyYYk",
      ".kYYYYk.",
      "..kkkk..",
    ],
    [
      "..kkk...",
      ".kzyYk..",
      ".kyYyk..",
      ".kyYYk..",
      ".kyYYk..",
      ".kyyYk..",
      ".kYYYk..",
      "..kkk...",
    ],
    [
      "...kk...",
      "...kzk..",
      "...kyk..",
      "...kYk..",
      "...kYk..",
      "...kyk..",
      "...kYk..",
      "...kk...",
    ],
    [
      "...kkk..",
      "..kzyYk.",
      "..kyYyk.",
      "..kyYYk.",
      "..kyYYk.",
      "..kyyYk.",
      "..kYYYk.",
      "...kkk..",
    ],
  ];
  const legend = { k: K, z: PAL.yel3, y: PAL.yel2, Y: PAL.yel1 };
  return maps.map((m) => Pix.fromMap(m, legend));
}

// Madeira Ancestral: tora deitada — ponta cortada com anéis à esquerda,
// casca com veios, rachadura dourada brilhando e um tufo de musgo.
// A mesma arte serve de ícone (UI) e de coletável (partida).
function woodLog() {
  const p = new Pix(15, 11);
  // Corpo (casca): luz em cima, sombra embaixo, veios verticais
  for (let y = 2; y <= 8; y++)
    for (let x = 4; x <= 13; x++) {
      let c = y <= 3 ? PAL.n3 : y >= 7 ? PAL.n1 : PAL.n2;
      if ((x === 7 || x === 11) && y > 3 && y < 8) c = PAL.n1;
      p.set(x, y, c);
    }
  // Ponta cortada: anel de casca escura + miolo claro com anéis
  p.ellipse(4.5, 5.5, 4.5, 5, PAL.n1);
  p.ellipse(4.5, 5.5, 3.5, 4, PAL.n4);
  p.ellipse(4.5, 5.5, 2.2, 2.7, 0xc99a6a);
  p.ellipse(4.5, 5.5, 1, 1.3, PAL.n4);
  // Rachadura dourada (brilha) na diagonal
  const crack = [[8, 3], [9, 4], [9, 5], [10, 6], [11, 7]];
  for (const [x, y] of crack) p.set(x, y, PAL.yel3);
  p.set(10, 5, PAL.yel2);
  p.set(8, 4, PAL.yel2);
  // Musgo
  p.set(10, 1, PAL.g4);
  p.set(11, 1, PAL.g5);
  p.set(12, 2, PAL.g4);
  p.outline(K);
  return p;
}

function heartPickup() {
  return Pix.fromMap(
    [
      ".kk.kk.",
      "kwrkrrk",
      "krrrrRk",
      "krrrrRk",
      ".krrRk.",
      "..kRk..",
      "...k...",
    ],
    { k: K, w: PAL.white, r: PAL.red2, R: PAL.red1 },
  );
}

// Orbe dourado de Despertar (2 frames de faísca)
function awakenFrames() {
  const base = [
    "...kkk...",
    "..kzzyk..",
    ".kzwzyYk.",
    "kzzzyyyYk",
    "kzzyyyyYk",
    "kyyyyyYYk",
    ".kyyyYYk.",
    "..kYYYk..",
    "...kkk...",
  ];
  const legend = { k: K, w: PAL.white, z: PAL.yel3, y: PAL.yel2, Y: PAL.yel1 };
  const a = Pix.fromMap(base, legend);
  const big = new Pix(13, 13);
  big.blit(a, 2, 2);
  const f1 = new Pix(13, 13);
  f1.blit(big, 0, 0);
  f1.set(6, 0, PAL.yel3);
  f1.set(0, 6, PAL.yel3);
  f1.set(12, 6, PAL.yel3);
  f1.set(6, 12, PAL.yel3);
  const f2 = new Pix(13, 13);
  f2.blit(big, 0, 0);
  f2.set(1, 1, PAL.white);
  f2.set(11, 1, PAL.white);
  f2.set(1, 11, PAL.white);
  f2.set(11, 11, PAL.white);
  return [f1, f2];
}

// Sombra "blob" pixelada (substitui a elipse vetorial com borda lisa)
function shadow() {
  const p = new Pix(14, 5);
  p.ellipse(7, 2.5, 7, 2.5, K, 110);
  p.ellipse(7, 2.5, 5, 1.6, K, 150);
  return p;
}

// Vara Encantada da Caipora (gira no voo): forquilha com folhas numa ponta,
// brasa do fumo na outra
function boomerang() {
  return Pix.fromMap(
    [
      "..............gk",
      ".............gNk",
      "............kNk.",
      "kkkkkkkkkkkkNk..",
      "yhonmnmnmnmnnNk.",
      "kkkkkkkkkkkkNk..",
      "............kNk.",
      ".............gNk",
      "..............gk",
    ],
    { k: K, h: PAL.org3, o: PAL.org2, y: PAL.yel3, m: PAL.n4, n: PAL.n3, N: PAL.n2, g: PAL.g5 },
  );
}

// Vara Encantada girando (26×26, 8 quadros = meia volta a cada 4): forquilha de folhas
// numa ponta, brasa acesa na outra e o BORRÃO do giro atrás das duas pontas. O giro é
// desenhado quadro a quadro (girar sprite de pixel serrilha).
function varaSpin(f) {
  const p = new Pix(26, 26);
  const c = 12.5;
  const a = (f / 8) * Math.PI * 2;
  const L = 10.5;
  // a vara: 2 px de grossura, luz de um lado
  const nx = -Math.sin(a),
    ny = Math.cos(a);
  for (let t = -L; t <= L; t += 0.5) {
    const x = c + Math.cos(a) * t,
      y = c + Math.sin(a) * t;
    p.set(Math.round(x), Math.round(y), PAL.n3);
    p.set(Math.round(x + nx * 0.8), Math.round(y + ny * 0.8), Math.abs(t) % 4 < 1 ? PAL.n2 : PAL.n4);
  }
  // forquilha com folhas (ponta 0)
  const fx = c + Math.cos(a) * L,
    fy = c + Math.sin(a) * L;
  for (const s of [-0.55, 0.55]) {
    const b = a + s;
    for (let k = 1; k <= 3; k++) p.set(Math.round(fx + Math.cos(b) * k), Math.round(fy + Math.sin(b) * k), PAL.n2);
    p.set(Math.round(fx + Math.cos(b) * 4), Math.round(fy + Math.sin(b) * 4), PAL.g5);
  }
  p.set(Math.round(fx + Math.cos(a) * 2), Math.round(fy + Math.sin(a) * 2), PAL.g6);
  // brasa do fumo (ponta π): miolo claro
  const ex = c - Math.cos(a) * L,
    ey = c - Math.sin(a) * L;
  p.disc(ex, ey, 2.1, PAL.org2);
  p.disc(ex - 0.3, ey - 0.3, 1.2, PAL.yel3);
  p.set(Math.round(ex - 0.5), Math.round(ey - 0.5), PAL.white);
  p.outline(PAL.ink);
  // borrão do giro DEPOIS do contorno (com contorno virava tracejado): arco pontilhado
  // atrás de cada ponta — a palha atrás da forquilha, brasa atrás da ponta acesa
  for (const [end, col] of [[0, PAL.straw2], [Math.PI, PAL.org2]]) {
    for (let k = 1; k <= 8; k++) {
      const b = a + end - k * 0.13;
      for (const r of [L - 1, L]) {
        const x = Math.round(c + Math.cos(b) * r),
          y = Math.round(c + Math.sin(b) * r);
        if (!p.get(x, y) && bayer(x, y) < 0.85 - k * 0.09) p.set(x, y, col);
      }
    }
  }
  return p;
}

// Boleadeira girando (24×20, 8 quadros em laço: as 3 pedras andam 1/3 de volta em 8
// quadros, então o laço não emenda): pedras amarradas a um nó, giro achatado em
// perspectiva (a pedra do fundo fica atrás e mais escura), brilho de geada e o borrão
function bolasSpin(f) {
  const p = new Pix(24, 20);
  const cx = 12,
    cy = 10;
  const R = 8.2;
  const stones = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + (f / 8) * ((Math.PI * 2) / 3);
    return { a, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.62, back: Math.sin(a) < 0 };
  });
  // cordas (de trás para a frente)
  const cord = (s) => {
    for (let t = 0.15; t <= 0.85; t += 0.07) {
      const x = Math.round(cx + (s.x - cx) * t),
        y = Math.round(cy + (s.y - cy) * t + Math.sin(t * Math.PI) * 0.8);
      p.set(x, y, s.back ? PAL.straw0 : PAL.straw2);
    }
  };
  const stone = (s) => {
    const r = s.back ? 2.3 : 2.8;
    for (let y = Math.floor(s.y - r); y <= Math.ceil(s.y + r); y++)
      for (let x = Math.floor(s.x - r); x <= Math.ceil(s.x + r); x++) {
        const dx = (x + 0.5 - s.x) / r,
          dy = (y + 0.5 - s.y) / r;
        if (dx * dx + dy * dy > 1) continue;
        const l = -dx * 0.6 - dy * 0.8;
        p.set(x, y, s.back ? (l > 0.3 ? PAL.s3 : PAL.s2) : l > 0.55 ? PAL.ice3 : l > 0.1 ? PAL.s4 : l > -0.4 ? PAL.s3 : PAL.s2);
      }
    if (!s.back) p.set(Math.round(s.x - 1), Math.round(s.y - 1), PAL.white); // geada
  };
  const order = [...stones].sort((a, b) => a.y - b.y);
  for (const s of order) if (s.back) cord(s);
  for (const s of order) if (s.back) stone(s);
  // nó no meio
  p.set(cx, cy, PAL.straw1);
  p.set(cx - 1, cy, PAL.straw2);
  p.set(cx, cy - 1, PAL.straw2);
  for (const s of order) if (!s.back) cord(s);
  for (const s of order) if (!s.back) stone(s);
  p.outline(PAL.ink);
  // borrão do giro: rastro curto atrás de cada pedra (sem contorno)
  for (const s of stones)
    for (let k = 1; k <= 5; k++) {
      const a = s.a - k * 0.16;
      const x = Math.round(cx + Math.cos(a) * R),
        y = Math.round(cy + Math.sin(a) * R * 0.62);
      if (!p.get(x, y) && bayer(x, y) < 0.8 - k * 0.12) p.set(x, y, k < 3 ? PAL.s4 : PAL.s3);
    }
  return p;
}

// Projétil inimigo (vermelho, núcleo branco) — distinto dos do jogador
function enemyShot() {
  return Pix.fromMap(
    [
      "..kkk..",
      ".krrrk.",
      "krhwhRk",
      "krwwwRk",
      "krhwhRk",
      ".kRRRk.",
      "..kkk..",
    ],
    { k: K, r: PAL.red2, R: PAL.red1, h: PAL.red3, w: PAL.white },
  );
}

// Orbe de gelo (arma orbital)
function iceOrb() {
  return Pix.fromMap(
    [
      "...kkkk...",
      "..kccbbk..",
      ".kcwcbbBk.",
      "kccwbbbBBk",
      "kcbbbbbBBk",
      "kbbbbbBBDk",
      "kbbbbBBBDk",
      ".kbBBBBDk.",
      "..kDDDDk..",
      "...kkkk...",
    ],
    { k: K, w: PAL.white, c: PAL.ice3, b: PAL.ice2, B: PAL.ice1, D: PAL.ice0 },
  );
}

// Partículas brancas (tintáveis) em pixel
function dot(size) {
  const p = new Pix(size, size);
  p.rect(0, 0, size, size, PAL.white);
  return p;
}
function spark() {
  return Pix.fromMap(["..w..", "..w..", "wwwww", "..w..", "..w.."], { w: PAL.white });
}
function puff() {
  const p = new Pix(7, 7);
  p.disc(3.5, 3.5, 3.5, PAL.white);
  return p;
}
function ring() {
  const p = new Pix(15, 15);
  p.disc(7.5, 7.5, 7.5, PAL.white);
  const q = new Pix(15, 15);
  q.disc(7.5, 7.5, 5.5, PAL.white);
  for (let i = 0; i < p.c.length; i++) if (q.c[i]) p.c[i] = 0;
  return p;
}
function shard() {
  return Pix.fromMap([".cc....", "cwwcc..", ".cbbbcc", "..cc..."], {
    c: PAL.ice2,
    w: PAL.white,
    b: PAL.ice3,
  });
}
// Folha que RODOPIA (9×9, 4 quadros): frente, inclinada, de lado (só a nervura) e o verso
// mais escuro — o giro em 3D é desenhado, não é escala. Folhas ao Vento / Ventania.
function leafTumble(f) {
  const p = new Pix(9, 9);
  const w = [1, 0.55, 0.12, 0.55][f]; // largura aparente da folha
  const back = f === 3; // verso: tons mais escuros
  const L = back ? [PAL.g3, PAL.g4, PAL.g2] : [PAL.g6, PAL.g5, PAL.g3];
  // folha em diagonal (do cabinho, embaixo à esquerda, até a ponta, em cima à direita)
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const cx = 1.5 + t * 6,
      cy = 7.5 - t * 6;
    const half = Math.sin(t * Math.PI) * 2.6 * w;
    for (let k = -3; k <= 3; k++) {
      const off = k * 0.5;
      if (Math.abs(off) > half + 0.2) continue;
      const x = Math.round(cx - off * 0.7),
        y = Math.round(cy - off * 0.7);
      p.set(x, y, Math.abs(off) < 0.3 ? L[2] : off < 0 ? L[0] : L[1]);
    }
  }
  p.set(0, 8, PAL.n3); // cabinho
  p.set(1, 8, PAL.n3);
  return p.outline(PAL.g2);
}

function leaf() {
  return Pix.fromMap([".gg", "gGk"], { g: PAL.g5, G: PAL.g3, k: PAL.g2 });
}

// Vaga-lume (arma de raio): asas cinza, cabeça escura e o "lampião" aceso
function firefly() {
  return Pix.fromMap(["aa.aa", ".aka.", ".zwz.", ".zzz.", "..e.."], {
    a: PAL.s4,
    k: K,
    z: PAL.yel3,
    w: PAL.white,
    e: PAL.g6,
  });
}

// Pedra de granizo: gelo opaco com reflexo
function hailstone() {
  return Pix.fromMap([".kkkk.", "kcwbbk", "kwbbBk", "kbbBBk", "kbBBDk", ".kkkk."], {
    k: K,
    w: PAL.white,
    c: PAL.ice3,
    b: PAL.ice2,
    B: PAL.ice1,
    D: PAL.ice0,
  });
}

// Redemoinho do Saci: anéis de vento empilhados (largo em cima, fino embaixo) que
// serpenteiam e giram — 6 frames. Corpo translúcido, frente clara, fundo escuro,
// um fio de luz correndo pelos anéis e folhas sendo levantadas na base.
// cols = [clara, média, escura]; o mesmo desenho serve à evolução em brasa.
// Funil de vento PINTADO (era uma pilha de anéis abertos que parecia arame): largo em
// cima, fino no chão, faixas claras em espiral DESCENDO, lado de trás mais escuro e
// translúcido, saia de poeira na base e detritos girando na frente/atrás. 8 quadros em
// laço sem emenda (ruído e faixas avançam exatamente 1/8 de período por quadro).
// Desenhado para escala INTEIRA 3× (escala quebrada deixava faixas de pixel desiguais).
function whirlFrames(cols, debris = PAL.g5, dust = PAL.s3) {
  const W = 30,
    H = 38,
    N = 8;
  const G = H - 3; // chão
  const noise = tileNoise(32, 32, 4, 909);
  const frames = [];
  for (let f = 0; f < N; f++) {
    const p = new Pix(W, H);
    const ph = (f / N) * Math.PI * 2;
    const cxAt = (h) => W / 2 + Math.sin(h * 4.2 - ph) * (0.4 + h * 2.6);
    const hwAt = (h) => 1.6 + Math.pow(h, 1.25) * 12.2;
    for (let y = 0; y < H; y++) {
      const h = (G - y) / (G - 1); // 0 no chão … 1 na boca
      if (h < -0.05 || h > 1.02) continue;
      const cx = cxAt(Math.max(0, h)),
        hw = hwAt(Math.max(0, h));
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5 - cx) / hw; // −1 … 1 de borda a borda
        const n = noise((x + 64) & 31, (y + f * 4) & 31);
        if (Math.abs(u) > 1 + (n - 0.5) * 0.35) continue;
        // faixas QUASE horizontais (o vento gira em volta do eixo) descendo pelo funil;
        // volume: claro à esquerda (luz), escuro e translúcido à direita (o lado de trás)
        const band = (((h * 10 + u * 0.3 + f / N) % 1) + 1) % 1;
        const lit = 0.5 - u * 0.5 + (n - 0.5) * 0.3; // 1 = esquerda … 0 = direita
        let col, a;
        if (band < 0.11) {
          col = band < 0.045 && lit > 0.35 ? PAL.white : cols[0];
          a = lit > 0.3 ? 255 : 170;
        } else if (lit > 0.62) {
          col = cols[1];
          a = 165;
        } else if (lit > 0.3) {
          col = cols[1];
          a = 100;
        } else {
          col = cols[2];
          a = 60; // o lado de trás é quase transparente (vê-se o chão através)
        }
        // a boca do funil se desfaz em fiapos irregulares
        if (h > 0.78 + (n - 0.5) * 0.35) continue;
        p.set(x, y, col, a);
      }
    }
    // saia de poeira na base (larga, achatada, gira)
    for (let k = 0; k < 14; k++) {
      const a = ph + (k / 14) * Math.PI * 2;
      const r = 4 + (k % 3);
      const x = W / 2 + Math.cos(a) * r,
        y = G + Math.sin(a) * 1.3;
      p.set(x, y, Math.sin(a) > 0 ? dust : cols[1], Math.sin(a) > 0 ? 230 : 140);
    }
    // detritos orbitando em alturas diferentes (frente opaca, trás apagado)
    for (let k = 0; k < 4; k++) {
      const h = 0.2 + k * 0.2;
      const a = ph * (k % 2 ? 1 : -1) * 0 + ph + k * 1.9;
      const x = cxAt(h) + Math.cos(a) * (hwAt(h) + 1.5),
        y = G - h * (G - 1) + Math.sin(a) * 1.5;
      const front = Math.sin(a) > 0;
      p.set(x, y, k % 2 ? debris : PAL.g6, front ? 255 : 120);
      if (front && k % 2) p.set(x + 1, y, debris, 255);
    }
    frames.push(p);
  }
  return frames;
}

// Brilho suave (NÃO-pixel, gradiente radial) — só pra luz aditiva
function registerGlow(scene) {
  if (scene.textures.exists("fx_glow")) return;
  const c = scene.textures.createCanvas("fx_glow", 64, 64);
  const ctx = c.getContext();
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  c.refresh();
}

export function registerSprites(scene) {
  registerStrip(scene, "px_gem", gemFrames(PAL.g6, PAL.g5, PAL.g3));
  registerStrip(scene, "px_gem_blue", gemFrames(PAL.ice3, PAL.ice2, PAL.ice1));
  registerStrip(scene, "px_gem_gold", gemFrames(PAL.yel3, PAL.yel2, PAL.yel1));
  registerStrip(scene, "px_coin", coinFrames());
  registerStrip(scene, "px_awaken", awakenFrames());
  heartPickup().register(scene, "px_heart");
  woodLog().register(scene, "px_wood");
  woodLog().register(scene, "ico_wood");
  shadow().register(scene, "px_shadow");
  boomerang().register(scene, "px_boomer");
  registerStrip(scene, "px_vara_spin", Array.from({ length: 8 }, (_, f) => varaSpin(f)));
  registerStrip(scene, "px_bolas_spin", Array.from({ length: 8 }, (_, f) => bolasSpin(f)));
  // ---- leva 3 ----
  // Bola de Ouro: bola de fogo dourada (e a versão gelada do Ouro Encantado)
  const goldBall = (warm) =>
    Pix.fromMap(
      ["..kkk..", ".kyzyk.", "kyzwzyk", "kzwwwzk", "kyzwzyO", ".kyyyO.", "..kOO.."],
      warm
        ? { k: K, y: PAL.yel2, z: PAL.yel3, w: PAL.white, O: PAL.org2 }
        : { k: K, y: PAL.ice2, z: PAL.ice3, w: PAL.white, O: PAL.ice1 },
    );
  goldBall(true).register(scene, "px_goldball");
  goldBall(false).register(scene, "px_goldball_ice");
  // Miragem: o veado branco do Anhangá, de olho de fogo (fantasma, vai meio transparente)
  Pix.fromMap(
    [
      "...........k..k...",
      "..........kck.kck.",
      "...........kckck..",
      "............kcck..",
      "...........kwwwwk.",
      "...........kwowwkk",
      "..kkkkkkkkkwwwwwk.",
      ".kwwwwwwwwwwwwkk..",
      "kcwwwwwwwwwwwk....",
      "kccwwwwwwwwwck....",
      ".kcccccccccck.....",
      ".kwk.kwk.kwk.kwk..",
      ".kck.kck..kck.kck.",
      ".kk..kk...kk..kk..",
    ],
    { k: PAL.ice1, w: PAL.white, c: PAL.ice3, o: PAL.org2 },
  ).register(scene, "px_mirage");
  // Fogueira de São João: toras empilhadas com brasa e pedrinhas em volta
  Pix.fromMap(
    ["...kkkkkkkk...", "..kmnnnnnnmk..", ".kkkkkkkkkkkk.", "kmnnnnoonnnnmk", "kkkkkkkkkkkkkk", ".ss........ss."],
    { k: K, m: PAL.n4, n: PAL.n3, o: PAL.org2, s: PAL.s3 },
  ).register(scene, "px_logs");
  // Boleadeira: três pedras presas numa corda
  Pix.fromMap(
    ["...kk....", "..kssk...", "..kask...", "...kk....", "...ll....", "..l..l...", ".kk...kk.", "kssk.kssk", "kask.kask", ".kk...kk."],
    { k: K, s: PAL.s3, a: PAL.s4, l: PAL.straw2 },
  ).register(scene, "px_bolas");
  // ---- vento ----
  // Cata-vento: quatro pás de cores de festa (gira inteiro no jogo) + cabo
  const pinwheel = (c1, c2, c3, c4) =>
    Pix.fromMap(
      [".....uu....", "..l..uuuu..", ".ll..uuuuu.", ".lll.uuu...", "llll.u.....", "lllllorrrrr", ".....y.rrrr", "...yyy.rrr.", ".yyyyy..rr.", "..yyyy..r..", "....yy....."],
      { u: c1, l: c2, r: c3, y: c4, o: PAL.yel3 },
    ).outline(K);
  pinwheel(PAL.wnd2, PAL.cream, PAL.red2, PAL.yel2).register(scene, "px_catavento");
  pinwheel(PAL.org2, PAL.yel3, PAL.red2, PAL.org3).register(scene, "px_catavento_brasa");
  Pix.fromMap(["kk", "km", "km", "km", "km", "km", "km", "km", "km", "km", "kk"], { k: K, m: PAL.n3 }).register(scene, "px_catavento_stick");
  // Rajada do cata-vento: risco de vento com a cauda se desfazendo
  Pix.fromMap([".......kk.", "..u.uuwwwk", "uu.uuwwwwk", "..u.uuwwwk", ".......kk."], { k: PAL.wnd1, u: PAL.wnd2, w: PAL.white }).register(scene, "px_gust");
  // Pegada do Curupira (dedos para CIMA; girada no uso — os pés dele são virados)
  Pix.fromMap(["d.d.d", ".....", ".kkk.", "kkkkk", ".kkk.", "..k..", ".kkk.", ".kkk."], { k: PAL.n0, d: PAL.n1 }).register(scene, "px_foot");
  enemyShot().register(scene, "px_eshot");
  iceOrb().register(scene, "px_iceorb");
  dot(1).register(scene, "px_dot1");
  dot(2).register(scene, "px_dot2");
  spark().register(scene, "px_spark");
  puff().register(scene, "px_puff");
  ring().register(scene, "px_ring");
  shard().register(scene, "px_shard");
  firefly().register(scene, "px_firefly");
  hailstone().register(scene, "px_hail");
  registerStrip(scene, "px_whirl", whirlFrames([PAL.wnd3, PAL.wnd2, PAL.wnd1])); // vento (era roxo/raio)
  registerStrip(scene, "px_whirl_fire", whirlFrames([PAL.yel3, PAL.org2, PAL.red1], PAL.yel3, PAL.n2));
  leaf().register(scene, "px_leaf");
  registerStrip(scene, "px_leaf_tumble", [0, 1, 2, 3].map((f) => leafTumble(f)));
  registerGlow(scene);

  const anim = (key, tex, rate, frames) => {
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(tex, { frames }),
        frameRate: rate,
        repeat: -1,
      });
  };
  anim("gem_shine", "px_gem", 6, [0, 1, 2, 3, 0, 0, 0, 0]);
  anim("gem_blue_shine", "px_gem_blue", 6, [0, 1, 2, 3, 0, 0, 0, 0]);
  anim("gem_gold_shine", "px_gem_gold", 6, [0, 1, 2, 3, 0, 0, 0, 0]);
  anim("coin_spin", "px_coin", 8, [0, 1, 2, 3]);
  anim("awaken_spark", "px_awaken", 4, [0, 1]);
  anim("whirl_spin", "px_whirl", 16, [0, 1, 2, 3, 4, 5, 6, 7]);
  anim("leaf_tumble", "px_leaf_tumble", 10, [0, 1, 2, 3]);
  anim("vara_spin", "px_vara_spin", 22, [0, 1, 2, 3, 4, 5, 6, 7]);
  anim("bolas_spin", "px_bolas_spin", 20, [0, 1, 2, 3, 4, 5, 6, 7]);
  anim("whirl_fire_spin", "px_whirl_fire", 20, [0, 1, 2, 3, 4, 5, 6, 7]);
}
