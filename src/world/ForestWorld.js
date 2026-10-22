// Mundo da floresta: chão, decalques, decoração, muralha de árvores na borda,
// atmosfera (vaga-lumes, folhas, feixes de luz, poeira; a vinheta e a Podridão da
// borda da tela moram em Podridao.js). Extraído da GameScene pra ela cuidar só de
// gameplay. O BIOMA (BIOMES em config.js) escolhe o atlas do cenário, o chão, a cor
// de fundo e a atmosfera.
//
// CHÃO NA GPU (Phaser 4, SpriteGPULayer): o que é CHATO no chão e nunca passa na frente de
// ninguém — manchas (-90), sombras no pé das árvores (-85) e tufos/flores/cogumelos (-50) — vira
// UMA camada por tipo em vez de ~3.100 imagens soltas. Cada camada é um objeto só na lista de
// exibição (a ordenação por profundidade de todo quadro deixa de passar por elas) e um desenho só
// (instanciado), com os dados num buffer estático enviado uma vez: nada por quadro na CPU, nem o
// culling. O que precisa de ordem por y (árvores, arbustos, pedras, tocos) continua imagem.
// Plano B: sem WebGL, sem textura no vertex shader (a camada lê os quadros de uma textura de dados
// lá; Mali-400 e afins não têm), com GROUND.GPU desligado ou com ?debug=1&chao=img, as mesmas
// coisas viram as imagens de antes — o mesmo desenho.
import { GAME, BIOMES, GROUND } from "../config.js";
import { PAL } from "../art/Palette.js";
import { rng } from "../art/PixelArt.js";
import { vw, vh } from "../ui/Theme.js";
import { DEBUG } from "../systems/Platform.js";
import { PodridaoEdge } from "./Podridao.js";

const S = GAME.PIXEL_SCALE;
const D_PATCH = -90;
const D_SHADOW = D_PATCH + 5; // sombra no pé das árvores (entre as manchas e as sombras projetadas, -80)
const D_FLAT = -50; // flores/tufos (sempre embaixo de tudo)
const Y_SORT = 10000; // mesmo offset do player/inimigos
const SHADOW_RESERVE = 32; // sombras que nascem depois do mundo pronto (árvores da trilha de entrada)

// A camada de GPU funciona neste aparelho? (o resto do jogo já exige WebGL com instâncias e VAO)
export function groundGPU(scene) {
  if (!GROUND.GPU || (DEBUG && /[?&]chao=img\b/.test(location.search))) return false;
  const r = scene.sys.game.renderer;
  if (r?.type !== Phaser.WEBGL || !Phaser.GameObjects.SpriteGPULayer) return false;
  try {
    return r.gl.getParameter(r.gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0;
  } catch {
    return false;
  }
}

export class ForestWorld {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.R = opts.radius ?? GAME.WORLD_RADIUS;
    this.biome = opts.biome ?? BIOMES.amazonia;
    this.keys = scene.registry.get(this.biome.env) ?? scene.registry.get("envKeys");
    this.atlas = this.keys.atlas ?? "env";
    this.r = rng(opts.seed ?? (Math.random() * 1e9) | 0);
    // Entrada da floresta na borda sul: { half } = meia-largura da brecha
    this.entrance = opts.entrance ?? null;
    this.trees = [];
    this.statics = []; // decoração fixa em imagem (o que tem ordem por y, ou tudo no plano B) — culling em update()
    this.layers = []; // camadas de GPU do chão (vazio no plano B)
    // membros das camadas chatas, juntados durante a geração e montados de uma vez em _buildFlat
    this._flat = { patch: [], shadow: [], low: [] };
    this._cullAt = 0;
    this._buildGround();
    this._scatter();
    this._border();
    this._buildFlat();
    if (opts.atmosphere !== false) this._atmosphere();
  }

  _pick(list) {
    return list[Math.floor(this.r() * list.length)];
  }

  // Chão: tileSprite do TAMANHO DA TELA, fixo na câmera; o deslocamento da
  // textura acompanha o scroll (1 quad só, em vez de um sprite de 14000px).
  _buildGround() {
    const sc = this.scene;
    sc.cameras.main.setBackgroundColor(this.biome.bg ?? 0x1d3926);
    this.ground = sc.add
      .tileSprite(0, 0, vw(sc), vh(sc), this.keys.ground ?? "env_ground")
      .setOrigin(0)
      .setScrollFactor(0)
      .setTileScale(S)
      .setDepth(-100);
    this._onResize = () => this.ground.setSize(vw(sc), vh(sc));
    sc.scale.on("resize", this._onResize);
    sc.events.once("shutdown", () => sc.scale.off("resize", this._onResize));
  }

  _img(x, y, frame, depth, originY = 1, flip = null) {
    const im = this.scene.add
      .image(Math.round(x), Math.round(y), this.atlas, frame)
      .setOrigin(0.5, originY)
      .setScale(S)
      .setDepth(depth);
    if (flip ?? this.r() < 0.5) im.setFlipX(true);
    this.statics.push(im);
    return im;
  }

  // Peça CHATA do chão (sem ordem por y): vira membro de uma camada de GPU ou, no plano B, a imagem
  // de sempre. Mesma posição, origem e espelho da imagem (espelho = escala negativa: com a origem
  // no meio do quadro, a camada espelha igual ao flipX/flipY da imagem)
  _flatAdd(kind, x, y, frame, originY, flipX, flipY = false) {
    const m = { x: Math.round(x), y: Math.round(y), frame, originX: 0.5, originY, scaleX: flipX ? -S : S, scaleY: flipY ? -S : S, alpha: 1 };
    if (this._flat) this._flat[kind].push(m);
    else this._flatPut(kind, m); // depois do mundo pronto (árvores da trilha de entrada)
  }

  // Sombra pixelada no pé de objetos altos
  _shadow(x, y, w) {
    const m = { x: Math.round(x), y: Math.round(y), originX: 0.5, originY: 0.5, scaleX: (w / 14) * 0.9, scaleY: S, alpha: 0.8 };
    if (this._flat) this._flat.shadow.push(m);
    else this._flatPut("shadow", m);
  }

  // Monta as camadas chatas (uma vez, no fim da geração): GPU ou imagens, na ordem em que nasceram
  _buildFlat() {
    const F = this._flat;
    this._flat = null;
    const kinds = [
      ["patch", this.atlas, D_PATCH, F.patch, 0],
      ["shadow", "px_shadow", D_SHADOW, F.shadow, SHADOW_RESERVE],
      ["low", this.atlas, D_FLAT, F.low, 0],
    ];
    this._layerOf = {};
    if (groundGPU(this.scene)) {
      try {
        for (const [kind, tex, depth, list, reserve] of kinds) {
          const L = this.scene.add.spriteGPULayer(tex, list.length + reserve).setDepth(depth);
          for (let i = 0; i < list.length; i++) L.addMember(list[i]);
          this.layers.push(L);
          this._layerOf[kind] = L;
        }
      } catch (e) {
        // a camada não montou neste aparelho: desfaz e cai nas imagens (o jogo segue igual)
        console.warn("chão na GPU indisponível:", e?.message ?? e);
        for (const L of this.layers) L.destroy();
        this.layers.length = 0;
        this._layerOf = {};
      }
    }
    if (this.layers.length) return;
    for (const [kind, , , list] of kinds) for (let i = 0; i < list.length; i++) this._flatPut(kind, list[i]);
  }

  // Um membro a mais depois de montado: na camada (se couber) ou como imagem
  _flatPut(kind, m) {
    const L = this._layerOf?.[kind];
    if (L && L.memberCount < L.size) {
      L.addMember(m);
      return;
    }
    const sh = kind === "shadow";
    const im = this.scene.add
      .image(m.x, m.y, sh ? "px_shadow" : this.atlas, m.frame)
      .setOrigin(m.originX, m.originY)
      .setScale(Math.abs(m.scaleX), Math.abs(m.scaleY))
      .setFlip(m.scaleX < 0, m.scaleY < 0)
      .setAlpha(m.alpha)
      .setDepth(kind === "patch" ? D_PATCH : sh ? D_SHADOW : D_FLAT);
    this.statics.push(im);
  }

  _scatter() {
    const R = this.R,
      k = this.keys;
    // Livre: centro da arena e a trilha de entrada (borda sul)
    const E = this.entrance;
    const clear = (x, y, r = 240) => (x * x + y * y > r * r) && !(E && Math.abs(x) < E.half + 140 && y > R - 620);
    const grid = (cell, fn) => {
      for (let cy = -R; cy < R; cy += cell)
        for (let cx = -R; cx < R; cx += cell) fn(cx + this.r() * cell, cy + this.r() * cell);
    };
    // (a ordem das chamadas a this.r() é a de sempre: a mesma semente dá o mesmo mundo)

    // Decalques grandes no chão (quebram a repetição do tile)
    grid(380, (x, y) => {
      const roll = this.r();
      const list = roll < 0.5 ? k.patches.dark : roll < 0.75 ? k.patches.moss : k.patches.dirt;
      const f = this._pick(list);
      const fx = this.r() < 0.5;
      this._flatAdd("patch", x, y, f, 0.5, fx, this.r() < 0.5);
    });

    // Detalhes rasteiros (sem y-sort)
    grid(150, (x, y) => {
      if (this.r() > 0.7) return;
      const roll = this.r();
      const f = roll < 0.45 ? this._pick(k.tufts) : roll < 0.8 ? this._pick(k.flowers) : this._pick(k.shrooms);
      this._flatAdd("low", x, y, f, 1, this.r() < 0.5);
      // Tufos em grupinhos
      if (roll < 0.45 && this.r() < 0.6) this._flatAdd("low", x + 18 + this.r() * 12, y + 6, this._pick(k.tufts), 1, this.r() < 0.5);
    });

    // Obstáculos visuais médios (y-sort)
    grid(330, (x, y) => {
      if (!clear(x, y) || this.r() > 0.55) return;
      const roll = this.r();
      const f =
        roll < 0.4 ? this._pick(k.bushes) : roll < 0.7 ? this._pick(k.rocks) : roll < 0.9 ? this._pick(k.stumps) : this._pick(k.logs);
      this._img(x, y, f, y + Y_SORT);
    });

    // Árvores (y-sort + desvanecem quando o player passa atrás)
    grid(430, (x, y) => {
      if (!clear(x, y, 320) || this.r() > 0.5) return;
      this._tree(x, y);
      // Pequenos bosques
      if (this.r() < 0.35) this._tree(x + 60 + this.r() * 50, y + 20 + this.r() * 40);
    });
  }

  _tree(x, y, list = null) {
    const k = this.keys;
    const f = list ? this._pick(list) : this.r() < 0.28 ? this._pick(k.pines) : this._pick(k.trees);
    const im = this._img(x, y, f, y + Y_SORT);
    this._shadow(x, y - 2, im.displayWidth * 0.7);
    this.trees.push(im);
    return im;
  }

  // Árvore da muralha sul: a copa começa em topY (o tronco fica mais abaixo).
  // Não entra na lista de "desbotar": o jogador nunca fica atrás dela.
  southTree(x, topY, list) {
    const f = this._pick(list);
    const h = this.scene.textures.getFrame(this.atlas, f).height * S;
    const y = topY + h;
    const im = this._img(x, y, f, y + Y_SORT);
    this._shadow(x, y - 2, im.displayWidth * 0.7);
    return im;
  }

  // Muralha de floresta nas bordas: a arena vira uma CLAREIRA fechada
  _border() {
    const R = this.R;
    const k = this.keys;
    // peso das "pines" na muralha (mata: pinheiros 2×; sertão: mandacaru 1×, mais árvore seca)
    const wp = this.biome.wallPines ?? 2;
    const all = [...k.trees, ...Array.from({ length: wp }, () => k.pines).flat()];
    const step = 74;
    const E = this.entrance;
    for (let t = -R - 60; t < R + 60; t += step) {
      for (let row = 0; row < 2; row++) {
        const inset = 30 + row * 80 + this.r() * 30;
        const j = () => t + (this.r() - 0.5) * 40;
        this._tree(j(), -R + inset, all); // topo
        // Sul: cada árvore é posicionada pela PRÓPRIA altura para a copa começar
        // na linha do limite físico — a mata é a parede (sem grama aberta antes
        // dela). Brecha no meio para a trilha de entrada.
        const xb = j();
        if (E?.y == null) this._tree(xb, R - inset + 40, all);
        else if (Math.abs(xb) > E.half + 100) this.southTree(xb, E.y - 4 + row * 48 + this.r() * 10, all);
        this._tree(-R + inset, j(), all); // esquerda
        this._tree(R - inset, j(), all); // direita
      }
    }
  }

  _atmosphere() {
    const sc = this.scene;
    const W = vw(sc),
      H = vh(sc);

    const A = this.biome.ambient ?? {};
    // Feixes de luz diagonais (aditivos, bem sutis) — dão profundidade
    this.shafts = [];
    for (let i = 0; i < 3; i++) {
      const s = sc.add
        .image(W * (0.2 + i * 0.3), H * 0.3, "fx_glow")
        .setScrollFactor(0)
        .setScale(3.5, 18)
        .setRotation(-0.5)
        .setTint(A.shaft ?? 0xfff2b0)
        .setAlpha(0.05)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(48600); // acima do mapa de luz: os feixes CLAREIAM
      s._phase = i * 2.1;
      this.shafts.push(s);
    }

    // Vaga-lumes e folhas em espaço de MUNDO (renascem ao sair da tela)
    this.ambient = [];
    for (let i = 0; i < (A.fireflies ?? 14); i++) {
      const glow = sc.add.image(0, 0, "fx_glow").setScale(0.35).setTint(0xfff5b8).setBlendMode(Phaser.BlendModes.ADD).setDepth(20000);
      const core = sc.add.image(0, 0, "px_dot2").setScale(S * 0.7).setTint(0xfff5b8).setDepth(20001);
      const p = { kind: "ff", glow, core, x: 0, y: 0, phase: this.r() * 7 };
      this._respawn(p, true);
      this.ambient.push(p);
    }
    for (let i = 0; i < (A.leaves ?? 9); i++) {
      const leaf = sc.add.image(0, 0, "px_leaf").setScale(S).setDepth(20000);
      if (i % 3 === 0 || A.dust) leaf.setTint(A.leafTint ?? 0xe0a050);
      const p = { kind: "leaf", core: leaf, x: 0, y: 0, phase: this.r() * 7, vy: 18 + this.r() * 14, vx: (this.r() - 0.5) * 26 };
      this._respawn(p, true);
      this.ambient.push(p);
    }

    // Poeira do sertão: grãos claros que o vento arrasta na horizontal
    for (let i = 0; i < (A.dust ?? 0); i++) {
      const g = sc.add.image(0, 0, "px_dot2").setScale(S * (0.5 + this.r() * 0.5)).setTint(i % 3 ? 0xe8d0a0 : 0xc8a878).setAlpha(0.55).setDepth(20000);
      const p = { kind: "dust", core: g, x: 0, y: 0, phase: this.r() * 7, vx: 60 + this.r() * 70, vy: (this.r() - 0.5) * 10 };
      this._respawn(p, true);
      this.ambient.push(p);
    }

    // Vinheta + Podridão avançando pelas bordas + pulso da vida baixa: UMA camada (ver Podridao.js)
    this.podridao = new PodridaoEdge(sc);
  }

  _respawn(p, anywhere = false) {
    const cam = this.scene.cameras.main;
    p.x = cam.scrollX + this.r() * cam.width;
    p.y = p.kind === "leaf" && !anywhere ? cam.scrollY - 20 : cam.scrollY + this.r() * cam.height;
    if (p.kind === "dust" && !anywhere) p.x = cam.scrollX - 20; // entra pela esquerda (o vento sopra para a direita)
  }

  // Esconde decoração fora da câmera (com margem) — o Phaser não faz culling
  // de imagens soltas; sem isto ~2000 objetos iriam pro renderer todo frame.
  _cull() {
    const v = this.scene.cameras.main.worldView;
    const M = 260;
    const x0 = v.x - M,
      x1 = v.right + M,
      y0 = v.y - M,
      y1 = v.bottom + M + 200; // árvores têm origem no pé: copa fica acima
    // laço por índice: ~5 mil objetos a cada 150 ms, sem iterador
    const st = this.statics;
    for (let i = 0, n = st.length; i < n; i++) {
      const o = st[i];
      const on = o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;
      if (o.visible !== on) o.setVisible(on);
    }
  }

  update(time, dt, player) {
    const cam = this.scene.cameras.main;
    if (time >= this._cullAt) {
      this._cullAt = time + 150;
      this._cull();
    }
    this.ground.tilePositionX = cam.scrollX / S;
    this.ground.tilePositionY = cam.scrollY / S;

    // Árvores na frente do player ficam translúcidas (não esconder o herói)
    if (player) {
      const trees = this.trees;
      for (let i = 0, n = trees.length; i < n; i++) {
        const t = trees[i];
        if (!t.visible) continue;
        const dx = Math.abs(t.x - player.x);
        if (dx > t.displayWidth * 0.5) {
          if (t.alpha < 1) t.setAlpha(1);
          continue;
        }
        const behind = player.y < t.y - 6 && player.y > t.y - t.displayHeight;
        const a = behind ? 0.45 : 1;
        if (t.alpha !== a) t.setAlpha(Phaser.Math.Linear(t.alpha, a, 0.25));
      }
    }

    if (!this.ambient) return;
    for (const s of this.shafts) s.setAlpha(0.035 + Math.sin(time / 2600 + s._phase) * 0.02);
    const M = 40;
    for (const p of this.ambient) {
      if (p.kind === "ff") {
        p.x += Math.sin(time / 900 + p.phase) * 0.35;
        p.y += Math.cos(time / 1100 + p.phase) * 0.3 - 0.08;
        const a = 0.25 + Math.abs(Math.sin(time / 400 + p.phase)) * 0.6;
        p.core.setPosition(p.x, p.y).setAlpha(a);
        p.glow.setPosition(p.x, p.y).setAlpha(a * 0.5);
      } else if (p.kind === "dust") {
        p.x += p.vx * (dt / 1000);
        p.y += (p.vy + Math.sin(time / 300 + p.phase) * 12) * (dt / 1000);
        p.core.setPosition(p.x, p.y);
      } else {
        p.x += (p.vx + Math.sin(time / 600 + p.phase) * 14) * (dt / 1000);
        p.y += p.vy * (dt / 1000);
        p.core.setPosition(p.x, p.y).setRotation(Math.sin(time / 300 + p.phase) * 0.8);
      }
      if (p.x < cam.scrollX - M || p.x > cam.scrollX + cam.width + M || p.y < cam.scrollY - M || p.y > cam.scrollY + cam.height + M)
        this._respawn(p);
    }

    this.podridao?.update(time, dt, player);
  }
}
