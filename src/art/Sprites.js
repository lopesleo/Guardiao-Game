// Sprites procedurais de gameplay: pickups, projéteis, partículas e sombras.
// Substituem os círculos/retângulos vetoriais (que "denunciavam" protótipo).
import { PAL } from "./Palette.js";
import { Pix, registerStrip } from "./PixelArt.js";

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

// Bumerangue de madeira com fio em brasa
function boomerang() {
  return Pix.fromMap(
    [
      "kkkk......",
      "khhok.....",
      "kmnnok....",
      ".kmnnok...",
      "..kmnnok..",
      "..kmnnnokk",
      "...kmnnnhk",
      "....kmmnnk",
      ".....kkkkk",
    ],
    { k: K, h: PAL.org3, o: PAL.org2, m: PAL.n4, n: PAL.n3 },
  );
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
function whirlFrames(cols, debris = PAL.g5) {
  const W = 24,
    H = 30,
    N = 6;
  const frames = [];
  for (let f = 0; f < N; f++) {
    const p = new Pix(W, H);
    const ph = (f / N) * Math.PI * 2;
    const rings = [];
    for (let y = 2; y < H - 3; y += 2.6) {
      const t = (y - 2) / (H - 5); // 0 = topo · 1 = base
      const rx = 1.2 + Math.pow(1 - t, 1.35) * 9.6;
      // A onda desce pelo funil (fase anda para baixo a cada frame)
      const cx = W / 2 + Math.sin(t * 5 - ph) * 2.8 * (0.3 + t * 0.7);
      rings.push({ y, t, rx, ry: Math.max(0.7, rx * 0.3), cx });
    }
    // Miolo translúcido bem leve (só dá corpo, não vira cunha)
    for (const r of rings)
      for (let x = Math.floor(r.cx - r.rx * 0.45); x <= Math.ceil(r.cx + r.rx * 0.45); x++) p.set(x, r.y, cols[1], 55);
    // Anéis ABERTOS: cada um tem uma falha que gira — lê como vento, não como sólido
    for (const r of rings) {
      const n = Math.max(10, Math.round(r.rx * 7));
      const gapAt = ph * 2 + r.t * 4;
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        const rel = (((th - gapAt) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (rel > Math.PI * 1.55) continue; // falha (~22% do anel)
        const x = r.cx + Math.cos(th) * r.rx,
          y = r.y + Math.sin(th) * r.ry;
        if (Math.sin(th) <= 0) p.set(x, y, cols[2], 150);
        else p.set(x, y, rel < 0.7 ? PAL.white : cols[0], 255);
      }
    }
    // Fiapos soltos na boca do funil
    for (let k = 0; k < 2; k++) {
      const a = ph + k * Math.PI;
      p.set(W / 2 + Math.cos(a) * 11, 1 + Math.sin(a) * 1.5, cols[0], 200);
    }
    // Folhas e poeira girando na base
    for (let k = 0; k < 3; k++) {
      const a = ph * 1.5 + (k / 3) * Math.PI * 2;
      const base = rings[rings.length - 1];
      p.set(base.cx + Math.cos(a) * (3 + k), H - 3 + Math.sin(a) * 1.2, k === 1 ? cols[2] : debris);
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
  registerStrip(scene, "px_whirl", whirlFrames([PAL.pur3, PAL.pur2, PAL.pur1]));
  registerStrip(scene, "px_whirl_fire", whirlFrames([PAL.yel3, PAL.org2, PAL.org1], PAL.red2));
  leaf().register(scene, "px_leaf");
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
  anim("whirl_spin", "px_whirl", 14, [0, 1, 2, 3, 4, 5]);
  anim("whirl_fire_spin", "px_whirl_fire", 18, [0, 1, 2, 3, 4, 5]);
}
