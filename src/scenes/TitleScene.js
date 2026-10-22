// Tela de título — a "vitrine" (screenshots da loja): a clareira à noite em camadas (TitleArt.js) — céu com Via
// Láctea, lua e nuvens, serra, duas matas com luar, névoa —, árvores emoldurando os cantos, folhas caindo,
// vaga-lumes e o guardião escolhido na fogueira. JOGAR leva à Clareira
// do Guardião (o acampamento caminhável), de onde se parte para a floresta.
import { CHARACTERS } from "../config.js";
import { MetaProgression, SaveLock } from "../systems/MetaProgression.js";
import { CloudSave } from "../systems/CloudSave.js";
import { DEBUG, isNative } from "../systems/Platform.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { ScreenVignette } from "../art/Gradients.js";
import { TITLE_PX, makeSky, makeMoon, makeCloud, makeRidge, makeTreeline, makeGround, makeFrameTrunk, makeCanopy, makeFern, makeCampfire, makeLeaf, makeStreak, makeVine } from "../art/TitleArt.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera } from "../ui/Theme.js";
import { closeTopModal } from "../ui/Widgets.js";
import { MetaPanels } from "../ui/MetaPanels.js";
import { tr } from "../i18n/i18n.js";
import { Billing } from "../systems/Billing.js";
import { openNoAds, showStoreNotice } from "../ui/NoAdsModal.js";
import { openShop, shopOn } from "../ui/ShopModal.js";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  // data.vitrine (só as ferramentas de captura das artes da loja, videos/promo/tools/vitrine.mjs): sem botões e com
  // as posições da cena ajustáveis — { hx, mx, my, tx, ty (frações da tela), k (escala do título), tagline, bare (só o
  // cenário: sem guardião, fogueira nem título) }
  create(data) {
    this.vitrine = data?.vitrine || null;
    this.events.once("create", () => this._maybeReopenSettings?.());
    fitCamera(this);
    this.meta = new MetaProgression();
    this.sound.volume = 1; // volumes por canal vêm de Settings (ganchos globais)
    this.W = vw(this);
    this.H = vh(this);
    this._modals = [];
    // O Phaser REAPROVEITA a instância da cena: todo estado de "visita" precisa
    // ser zerado aqui, senão sobra da vez anterior (ex.: herói preso andando).
    this._leaving = false;

    this._layout();
    this._backdrop();
    this._heroArea();
    this._foreground();
    this._title();
    this._buttons();

    // Música (desbloqueia áudio no 1º toque, exigência dos navegadores)
    if (this.cache.audio.exists("music_menu")) {
      this.menuMusic = this.sound.add("music_menu", { loop: true, volume: 0.35 });
      const start = () => {
        if (this.menuMusic && !this.menuMusic.isPlaying) this.menuMusic.play();
      };
      if (!this.sound.locked) start();
      else this.sound.once("unlocked", start);
    }
    this.events.once("shutdown", () => {
      this.menuMusic?.stop();
      this.menuMusic?.destroy();
      this.menuMusic = null;
    });

    this.input.keyboard.on("keydown-ESC", () => closeTopModal(this));
    this.input.keyboard.on("keydown-ENTER", () => !this._modals.length && this._play());
    this.cameras.main.fadeIn(350, 10, 14, 10);
  }

  // Botão VOLTAR do Android: fecha modal; sem modal, deixa o app sair
  onBack() {
    return closeTopModal(this);
  }

  _refreshAll() {}

  // Posições da cena (o resto se arruma em volta): horizonte, guardião e fogueira
  _layout() {
    const W = this.W,
      H = this.H;
    const v = this.vitrine || {};
    const hx = Math.round(W * (v.hx ?? 0.3)),
      hy = Math.round(H * 0.8);
    this.L = {
      horizon: Math.round(H * 0.6),
      hx,
      hy,
      fx: v.bare ? -9999 : hx + 150, // cena vazia (fundo de outra arte): sem fogueira nem terreiro
      fy: hy - 6,
      mx: Math.round(W * (v.mx ?? 0.6)),
      my: Math.round(H * (v.my ?? 0.17)),
      tx: Math.round(W * (v.tx ?? 0.3)), // centro do título
      tk: v.k ?? 1,
    };
    this.heroX = hx;
    this.heroY = hy;
  }

  // Camada de arte (TitleArt.js) gerada uma vez por tamanho de tela
  _layer(name, make) {
    // a posição da fogueira (terreiro) e da lua (luar nas cristas) entram na chave: a vitrine muda as duas
    const key = `title_${name}_${this.W}x${this.H}_${this.L.fx}_${this.L.mx}`;
    if (!this.textures.exists(key)) make().register(this, key);
    return key;
  }

  _backdrop() {
    const W = this.W,
      H = this.H,
      S = TITLE_PX,
      L = this.L;
    const lw = Math.ceil(W / S) + 1,
      lh = Math.ceil(H / S) + 1;
    const hz = Math.round(L.horizon / S),
      mxl = L.mx / S;
    const img = (key, x = 0, y = 0) => this.add.image(x, y, key).setOrigin(0).setScale(S);

    // Céu (com a Via Láctea) e estrelas piscando
    img(this._layer("sky", () => makeSky(lw, lh, hz)));
    for (let i = 0; i < 70; i++) {
      const s = this.add
        .image(Math.random() * W, Math.random() * L.horizon * 0.75, i % 6 ? "px_dot1" : "px_dot2")
        .setScale(3)
        .setAlpha(0.15 + Math.random() * 0.6)
        .setTint(i % 7 ? PAL.white : PAL.yel3);
      this.tweens.add({ targets: s, alpha: 0.08, duration: 900 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2400, ease: "Sine.easeInOut" });
    }
    // Lua com halo e nuvens finas passando na frente
    this.add.image(L.mx, L.my, "fx_glow").setScale(7).setTint(PAL.ice3).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(L.mx, L.my, "fx_glow").setScale(3.2).setTint(PAL.ice3).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(L.mx, L.my, this._layer("moon", makeMoon)).setScale(S);
    // nuvens: uma fina passa na frente da lua (só à direita do título, surgindo e sumindo devagar); duas baixas
    // espiam por trás da serra (desenhada depois, cobre o pé delas)
    const titleR = Math.round(L.tx + 190 * L.tk);
    const cloud = (i, w, h, y, v, a, x0, x1) => {
      const c = this.add.image(x0 + Math.random() * (x1 - x0), y, this._layer(`cloud${i}`, () => makeCloud(61 + i * 5, w, h))).setScale(S);
      Object.assign(c, { _v: v, _a: a, _x0: x0, _x1: x1 });
      return c;
    };
    this.clouds = [
      cloud(0, 54, 12, L.my + 26, 5, 0.7, titleR, W - 40),
      cloud(1, 92, 16, L.horizon - 146, 3, 0.7, -150, W + 150),
      cloud(2, 70, 13, L.horizon - 176, 4.2, 0.55, -150, W + 150),
    ];
    // arte da loja: a nuvem da lua começa ao lado dela (a lua inteira na foto)
    if (this.vitrine) this.clouds[0].x = L.mx + 200;

    // Serra, mata ao longe, névoa, mata de perto: cada uma cheia até embaixo (o chão cobre o pé)
    img(this._layer("ridge", () => makeRidge(lw, lh, hz - 30, 24, 7, mxl)));
    img(this._layer("woodsFar", () => makeTreeline(lw, lh, hz - 7, { seed: 21, minH: 14, maxH: 30, jitter: 4, pines: 0.55, fill: PAL.woodsFar0, rim: PAL.woodsFar1, moonX: mxl })));
    this.fog = [];
    const fog = (y, alpha, n) => {
      for (let i = 0; i < n; i++) {
        const f = this.add
          .image(W * (i / (n - 1)) + Math.random() * 80, y, "fx_glow")
          .setScale(10, 1.5)
          .setTint(PAL.night4)
          .setAlpha(alpha)
          .setBlendMode(Phaser.BlendModes.ADD);
        f._v = 5 + Math.random() * 7;
        this.fog.push(f);
      }
    };
    fog(L.horizon - 34, 0.1, 4);
    img(this._layer("woodsNear", () => makeTreeline(lw, lh, hz + 3, { seed: 37, minH: 22, maxH: 44, jitter: 6, pines: 0.45, fill: PAL.woodsNear0, rim: PAL.woodsNear1, moonX: mxl, leafy: true })));

    // Chão da clareira (terreiro batido em volta da fogueira) e a névoa rente ao pé da mata
    img(this._layer("ground", () => makeGround(lw, lh - hz, L.fx / S, L.fy / S - hz)), 0, hz * S);
    fog(L.horizon + 6, 0.14, 5);
    // Tufos e flores no gramado, longe do terreiro e dos cantos de baixo
    const env = this.registry.get("envKeys");
    let placed = 0;
    for (let tries = 0; placed < 22 && tries < 200; tries++) {
      const x = 30 + Math.random() * (W - 60),
        y = L.horizon + 24 + Math.random() * (H - L.horizon - 40);
      const dx = (x - L.fx) / 300,
        dy = (y - L.fy) / 80;
      const btnX = Math.max(W * 0.74, W - 250);
      if (dx * dx + dy * dy < 1 || (y > H - 110 && (x < 200 || x > W - 200)) || (Math.abs(x - btnX) < 210 && y < H * 0.56 + 200)) continue;
      const list = placed % 3 ? env.tufts : env.flowers;
      const near = (y - L.horizon) / (H - L.horizon);
      this.add.image(x, y, "env", list[placed % list.length]).setOrigin(0.5, 1).setScale(3).setAlpha(0.55 + near * 0.45);
      placed++;
    }
    // Poça de luz quente da fogueira no chão
    if (!this.vitrine?.bare) this.firePool = this.add.image(L.fx, L.fy + 4, "fx_glow").setScale(12, 3.4).setTint(PAL.org3).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD);
  }

  // Árvores da moldura (enraizadas fora da tela; as copas cobrem os cantos de cima), samambaias à frente,
  // folhas caindo, vaga-lumes, estrela cadente e a vinheta
  _foreground() {
    const W = this.W,
      H = this.H,
      S = TITLE_PX;
    const lh = Math.ceil(H / S) + 1;
    const trunk = this._layer("trunk", () => makeFrameTrunk(lh + 2, 26, 3));
    this.add.image(-16, H + 4, trunk).setOrigin(0, 1).setScale(S);
    this.add.image(W + 16, H + 4, trunk).setOrigin(1, 1).setScale(S).setFlipX(true);
    // copas: cachos que balançam devagar, cada um no seu ritmo; descem pela lateral sem chegar ao título nem à lua
    this.sway = [];
    const canopy = (i, w, h, x, y, flip) => {
      const c = this.add.image(x, y, this._layer(`canopy${i}`, () => makeCanopy(71 + i * 7, w, h, 1 + (i % 2)))).setOrigin(0).setScale(S).setFlipX(flip);
      this.sway.push({ o: c, bx: x, by: y, ph: i * 1.7, ax: 2.4, ay: 1.2, per: 1800 + i * 260 });
    };
    const titleL = Math.round(this.L.tx - 175 * this.L.tk); // borda esquerda do título
    canopy(0, 90, 48, -86, -62, false);
    canopy(1, 66, 38, Math.min(70, titleL - 66 * S - 6), -58, false);
    canopy(2, 58, 34, -70, 70, false);
    canopy(3, 40, 26, -46, 190, false);
    canopy(4, 90, 48, W - 90 * S + 86, -66, true);
    canopy(5, 66, 38, W - 66 * S - 66, -54, true);
    canopy(6, 58, 34, W - 58 * S + 70, 64, true);
    canopy(7, 40, 26, W - 40 * S + 46, 184, true);
    // samambaias nos cantos de baixo
    const fernL = this.add.image(-12, H + 8, this._layer("fernL", () => makeFern(51, 56, 34))).setOrigin(0, 1).setScale(S);
    const fernR = this.add.image(W + 12, H + 8, this._layer("fernR", () => makeFern(57, 56, 34, true))).setOrigin(1, 1).setScale(S);
    this.sway.push({ o: fernL, bx: fernL.x, by: fernL.y, ph: 0.4, ax: 2, ay: 0, per: 1500 }, { o: fernR, bx: fernR.x, by: fernR.y, ph: 2.1, ax: 2, ay: 0, per: 1650 });

    // Folhas que se soltam das copas e caem girando
    const leafKeys = [this._layer("leafG", () => makeLeaf(false)), this._layer("leafY", () => makeLeaf(true))];
    this.leaves = [0, 1, 2, 3].map((i) => {
      const o = this.add.image(-50, -50, leafKeys[i % 2]).setScale(S).setVisible(false);
      return { o, wait: 600 + i * 1700, ph: Math.random() * 6 };
    });

    // Vaga-lumes no gramado
    this.flies = [];
    for (let i = 0; i < 16; i++) {
      const g = this.add.image(Math.random() * W, this.L.horizon + Math.random() * (H - this.L.horizon), "fx_glow").setScale(0.3).setTint(PAL.yel3).setBlendMode(Phaser.BlendModes.ADD);
      const c = this.add.image(g.x, g.y, "px_dot2").setScale(2).setTint(PAL.yel3);
      this.flies.push({ g, c, ph: Math.random() * 7, vx: (Math.random() - 0.5) * 0.3, vy: -0.08 - Math.random() * 0.2 });
    }

    // Estrela cadente de vez em quando
    const streak = this._layer("streak", makeStreak);
    const shoot = () => {
      if (!this.sys.isActive()) return;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const x = W * (0.25 + Math.random() * 0.5),
        y = H * (0.04 + Math.random() * 0.16);
      const s = this.add.image(x, y, streak).setScale(S).setFlipX(dir < 0).setRotation(dir * 0.32).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: s, alpha: { from: 0, to: 0.9 }, duration: 160, yoyo: true, hold: 380 });
      this.tweens.add({ targets: s, x: x + dir * 260, y: y + 86, duration: 720, ease: "Quad.easeIn", onComplete: () => s.destroy() });
      this.time.delayedCall(7000 + Math.random() * 9000, shoot);
    };
    this.time.delayedCall(3000 + Math.random() * 3000, shoot);

    // Vinheta (Gradient: sem degraus nos escuros e sem textura do tamanho da tela). O foco fica embaixo à
    // esquerda, na fogueira e no guardião
    new ScreenVignette(this, { geom: (w, h) => ({ cx: w * 0.45, cy: h * 0.58, r0: h * 0.4, r1: Math.max(w, h) * 0.7 }), color: PAL.night0, alpha: 0.6, depth: 900 });
  }

  update(time, dt) {
    const W = this.W,
      H = this.H;
    // Aviso da loja (pagamento aprovado / compra estornada): o botão "Sem anúncios" muda → recomeça a cena
    if (Billing.hasNotice && !this._modals.length && !this._leaving) showStoreNotice(this, { onClose: () => this.sys.isActive() && this.scene.restart() });
    for (const f of this.flies || []) {
      f.g.x += f.vx + Math.sin(time / 700 + f.ph) * 0.25;
      f.g.y += f.vy;
      if (f.g.y < this.L.horizon - 20) {
        f.g.y = H + 10;
        f.g.x = Math.random() * W;
      }
      const a = 0.3 + Math.abs(Math.sin(time / 400 + f.ph)) * 0.6;
      f.g.setAlpha(a * 0.6);
      f.c.setPosition(f.g.x, f.g.y).setAlpha(a);
    }
    for (const f of this.fog || []) {
      f.x += (f._v * dt) / 1000;
      if (f.x > W + 300) f.x = -300;
    }
    for (const c of this.clouds || []) {
      c.x += (c._v * dt) / 1000;
      if (c.x > c._x1) c.x = c._x0;
      // some e aparece nas pontas do caminho (nunca pula na tela)
      c.setAlpha(c._a * Math.max(0, Math.min(1, (c.x - c._x0) / 120, (c._x1 - c.x) / 120)));
    }
    // Copas e samambaias: balanço suave (seno), nunca parado nem aos trancos
    for (const s of this.sway || []) {
      const t = (time / s.per) * Math.PI * 2 + s.ph;
      s.o.setPosition(s.bx + Math.sin(t) * s.ax, s.by + Math.sin(t * 0.7 + 1) * s.ay);
    }
    // Folhas: soltam de uma copa, caem balançando e virando (a largura vai e volta)
    for (const l of this.leaves || []) {
      if (!l.o.visible) {
        l.wait -= dt;
        if (l.wait > 0) continue;
        const left = Math.random() < 0.5;
        l.o.setPosition(left ? 40 + Math.random() * 160 : W - 40 - Math.random() * 160, 60 + Math.random() * 60).setVisible(true).setAlpha(1);
        l.vx = (left ? 1 : -1) * (6 + Math.random() * 10);
        continue;
      }
      l.ph += dt / 1000;
      l.o.x += (l.vx + Math.sin(l.ph * 2.1) * 22) * (dt / 1000);
      l.o.y += (26 + Math.sin(l.ph * 4.2) * 10) * (dt / 1000);
      l.o.scaleX = TITLE_PX * Math.cos(l.ph * 3.3);
      if (l.o.y > this.L.horizon + 40) l.o.alpha -= dt / 900;
      if (l.o.alpha <= 0 || l.o.y > H) {
        l.o.setVisible(false);
        l.wait = 2500 + Math.random() * 4000;
      }
    }
    // Fogueira: chamas, luz no chão e no guardião pulsando juntas
    if (this.fire) {
      const k = Math.sin(time / 90) * 0.5 + Math.sin(time / 37) * 0.3 + Math.random() * 0.2;
      this.fire.glow.setAlpha(0.42 + k * 0.08);
      this.firePool?.setAlpha(0.2 + k * 0.04);
      this.heroLight?.setAlpha(0.16 + k * 0.03);
    }
  }

  _heroArea() {
    if (this.vitrine?.bare) return;
    const L = this.L;
    const hx = L.hx,
      hy = L.hy,
      fx = L.fx,
      fy = L.fy;

    // Fogueira: anel de pedras e toras (TitleArt.js), chamas e fumaça de partículas
    this.add.image(fx, fy + 8, "px_shadow").setScale(7, 3).setAlpha(0.7);
    const glow = this.add.image(fx, fy - 12, "fx_glow").setScale(4.8).setTint(PAL.org2).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(fx, fy + 12, this._layer("campfire", makeCampfire)).setOrigin(0.5, 1).setScale(TITLE_PX);
    this.fire = { glow };
    this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        const f = this.add
          .image(fx + (Math.random() - 0.5) * 24, fy - 2, "px_puff")
          .setScale(2.4 + Math.random())
          .setTint([PAL.yel3, PAL.org3, PAL.org2][Math.floor(Math.random() * 3)])
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: f,
          y: fy - 44 - Math.random() * 30,
          x: f.x + (Math.random() - 0.5) * 14,
          scale: 0.4,
          alpha: 0,
          duration: 520 + Math.random() * 260,
          onComplete: () => f.destroy(),
        });
        if (Math.random() < 0.22) {
          const e = this.add.image(fx, fy - 20, "px_dot1").setScale(3).setTint(PAL.yel3);
          this.tweens.add({ targets: e, y: fy - 130 - Math.random() * 60, x: fx + (Math.random() - 0.5) * 70, alpha: 0, duration: 1500, ease: "Sine.easeOut", onComplete: () => e.destroy() });
        }
        // fumaça: sobe devagar, cresce e some para o lado do vento
        if (Math.random() < 0.1) {
          const s = this.add.image(fx + (Math.random() - 0.5) * 10, fy - 44, "fx_glow").setScale(0.5).setTint(PAL.s3).setAlpha(0);
          this.tweens.add({ targets: s, alpha: { from: 0, to: 0.09 }, duration: 700, yoyo: true, hold: 1600 });
          this.tweens.add({ targets: s, y: fy - 200 - Math.random() * 40, x: s.x + 50 + Math.random() * 40, scale: 2.4, duration: 3000, ease: "Sine.easeOut", onComplete: () => s.destroy() });
        }
      },
    });

    this.heroLight = this.add.image(hx + 30, hy - 26, "fx_glow").setScale(4, 3).setTint(PAL.org3).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(hx, hy + 4, "px_shadow").setScale(6, 4);
    this.hero = this.add.sprite(hx, hy + 6, "hero_guardian", 0).setOrigin(0.5, 1).setScale(6);

    const c = CHARACTERS.find((c) => c.id === this.meta.selectedCharacter) || CHARACTERS[0];
    this.hero.setTexture(`hero_${c.id}`, 0).play(`${c.id}_idle`);
  }

  _title() {
    if (this.vitrine?.bare) return;
    const v = this.vitrine || {};
    const x = this.L.tx,
      k = this.L.tk;
    const y = Math.round(v.ty != null ? this.H * v.ty : 96 + Math.max(0, this.H - 720) * 0.2); // tela mais alta (tablet): o título desce um pouco
    const glow = this.add.image(x, y + 14 * k, "fx_glow").setScale(8 * k, 2.5 * k).setTint(PAL.yel2).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.24, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const t1 = text(this, x, y, tr("GUARDIÃO"), { size: Math.round(84 * k), color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: Math.round(10 * k), shadowY: Math.round(6 * k) });
    const t2 = text(this, x, y + 64 * k, tr("DA FLORESTA"), { size: Math.round(34 * k), color: hex(PAL.g6), origin: 0.5, stroke: true, strokeW: Math.round(6 * k) });
    const vine = this.add.image(x, y + 96 * k, this._layer("vine", () => makeVine())).setScale(Math.max(1, Math.round(TITLE_PX * k)));
    const parts = [t1, t2, vine];
    if (v.tagline !== false) parts.push(text(this, x, y + 124 * k, tr("Sobreviva à horda. Desperte a mata."), { size: Math.round(18 * k), color: CSS.muted, origin: 0.5 }));
    // arte da loja em escala não inteira (8/3): o texto na resolução da tela, senão o traço do "e" some ao esticar
    if (this.vitrine) for (const t of parts) t.setResolution?.(Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
    parts.forEach((t, i) => {
      t.setAlpha(0).y -= 20;
      this.tweens.add({ targets: t, alpha: 1, y: t.y + 20, delay: 150 + i * 120, duration: 520, ease: "Back.easeOut" });
    });
  }

  _buttons() {
    if (this.vitrine) return; // arte da loja: só a cena e o título
    const W = this.W,
      H = this.H;
    const cx = Math.round(Math.max(W * 0.74, W - 250));
    this.playBtn = new Button(this, cx, H * 0.56, 380, 86, tr("JOGAR"), () => this._play(), { size: 42, style: "primary", color: CSS.goldHi });
    this.tweens.add({ targets: this.playBtn, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    new Button(this, cx, H * 0.56 + 92, 380, 58, tr("OPÇÕES"), () => !this._modals.length && this._showSettings(), { size: 22, icon: "ico_gear", iconScale: 2.5, style: "dark" });
    const credits = () => !this._modals.length && this._showCredits();
    // Loja (Sem anúncios, Pacote Fundador, kits) ou, sem a loja de cosméticos, só o "Sem anúncios": divide a
    // linha com os Créditos (discreto, nunca sozinho na tela)
    const shop = shopOn();
    if (shop || (Billing.available() && !Billing.owned)) {
      new Button(this, cx - 96, H * 0.56 + 160, 186, 58, tr("CRÉDITOS"), credits, { size: 20, style: "dark" });
      new Button(this, cx + 96, H * 0.56 + 160, 186, 58, shop ? tr("LOJA") : tr("SEM ANÚNCIOS"), () => {
        if (this._modals.length) return;
        // comprou: o botão muda (a cena recomeça)
        if (shop) openShop(this, { from: "title", onClose: () => this.sys.isActive() && this.scene.restart() });
        else openNoAds(this, { from: "title", onClose: () => Billing.owned && this.scene.restart() });
      }, { size: 20, style: "dark", color: CSS.goldHi });
    } else new Button(this, cx, H * 0.56 + 160, 380, 58, tr("CRÉDITOS"), credits, { size: 22, style: "dark" });
    // Tela cheia (só navegador)
    if (!isNative()) new Button(this, 44, 40, 52, 52, null, () => this.scale.toggleFullscreen(), { icon: "ico_fullscreen", style: "dark", iconScale: 2.5 });
    if (!this.meta.available) text(this, 20, H - 20, tr("Modo privado: o progresso não será salvo"), { size: 14, color: CSS.redHi, origin: [0, 1] });
    text(this, W - 12, H - 8, "v1.0", { size: 12, color: CSS.dim, origin: [1, 1], shadow: false });
  }

  async _play() {
    if (this._leaving) return;
    this._leaving = true;
    haptic(30);
    // 1ª vez: direto para a floresta (primeiro sucesso em segundos); a Clareira
    // aparece depois da 1ª partida
    const firstTime = !(this.meta.data.runsPlayed > 0) && !(this.meta.data.highScoreSeconds > 0);
    // Aparelho sem progresso: antes da 1ª partida, confere se a conta tem progresso no
    // Play Games (reinstalou ou trocou de celular). Se tiver, o jogo recarrega com ele.
    if (firstTime && CloudSave.available()) {
      const wait = text(this, this.playBtn.x, this.playBtn.y - 66, tr("Procurando progresso salvo…"), { size: 16, color: CSS.muted, origin: 0.5 });
      this.tweens.add({ targets: wait, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
      await CloudSave.settled(8000);
      if (SaveLock.frozen || !this.sys.isActive()) return;
      wait.destroy();
    }
    this.cameras.main.fadeOut(300, 5, 8, 6);
    // a Clareira recebe os dados de novo: sem eles, o Phaser mantém os da última visita (o fromRun de uma partida)
    this.cameras.main.once("camerafadeoutcomplete", () => (firstTime ? this.scene.start("GameScene") : this.scene.start("CampScene", { fromRun: false })));
  }
}

Object.assign(TitleScene.prototype, MetaPanels);
