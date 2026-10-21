// Fim de partida como um quadro, no padrão da tela de título. À esquerda, a CENA na Clareira (TitleArt.js +
// ResultArt.js): na vitória amanhece, a mata do horizonte sara e a lenda libertada aparece na borda da floresta
// diante do guardião de cajado erguido; na derrota o guardião voltou à Clareira (roguelite: a fogueira é o lugar
// seguro), ajoelha junto do fogo e se levanta para tentar de novo, e a Podridão fica lá longe, na mata do
// horizonte; no recuo, a noite calma; na Noite Eterna, a aurora. À direita, o RESULTADO entra em sequência: Perigo
// e pontos, tempo/abates/reações, recompensas (as moedas com a conta e o anúncio que dobra), as armas com a parte
// do dano e os desbloqueios. Tocar fora dos botões pula para o fim. Botão principal = JOGAR DE NOVO.
import { WEAPONS } from "../config.js";
import { formatTime } from "../utils.js";
import { PAL, CSS, hex, ELEMENT_COLOR } from "../art/Palette.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { ROT, makeFreedMapinguari } from "../art/Monsters.js";
import { ScreenVignette } from "../art/Gradients.js";
import { TITLE_PX, makeSky, makeMoon, makeCloud, makeRidge, makeTreeline, makeGround, makeFrameTrunk, makeCanopy, makeFern, makeCampfire, makeLeaf, makeVine } from "../art/TitleArt.js";
import { makeSun, makeRay, makeBird, makeAurora, makeCactusline } from "../art/ResultArt.js";
import { registerResultRig, RIG_W, RESULT_H, GROUND } from "../art/HeroRig.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera, textPx } from "../ui/Theme.js";
import { fitTo, closeTopModal } from "../ui/Widgets.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Leaderboards } from "../systems/Leaderboards.js";
import { openRanking } from "../ui/RankingModal.js";
import { tr, fmt, dec } from "../i18n/i18n.js";

const S = TITLE_PX;
const HERO_SC = 5; // escala do guardião (o quadro pede mais presença que o acampamento)
const ADD = Phaser.BlendModes.ADD;
// Cada desfecho: o céu, quem aparece e como o guardião está
const LOOKS = {
  vitoria: { sky: "dawn", legend: true, pose: "cheer" },
  eterna: { sky: "aurora", legend: true, pose: "cheer" },
  derrota: { sky: "night", rot: true, fire: true, pose: "mourn" },
  recuo: { sky: "night", fire: true, pose: "idle" },
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(data) {
    const d = (this.d = { coinsDoubleable: data.coinsGained, coinsRun: null, restedMult: 1, firstClear: 0, woodGained: 0, seedsGained: 0, newUnlocks: [], score: 0, scoreRecord: false, level: 1, weapons: [], endlessS: 0, endlessRecord: false, biome: null, ...data });
    fitCamera(this);
    // O Phaser REAPROVEITA a instância da cena: todo estado de "visita" precisa
    // ser zerado aqui, senão sobra da vez anterior (ex.: herói preso andando).
    this._leaving = false;
    this._coinsShown = undefined;
    this._coinText = null;
    this._coinNote = null;
    this._steps = [];
    this._skipped = false;
    this._modals = [];
    this.motes = this.spores = this.fire = this.firePool = this.heroLight = this.morning = this.sun = null;
    this.W = vw(this);
    this.H = vh(this);
    this.mode = d.endlessS > 0 ? "eterna" : d.won ? "vitoria" : d.quit ? "recuo" : "derrota";
    this.look = LOOKS[this.mode];
    this.biomeId = d.biomeId ?? "amazonia";
    this.caat = this.biomeId === "caatinga";

    this._layout();
    this._world();
    this._cast();
    this._frame();
    this._title();
    this._panel();
    this._buttons();
    this._sound();

    // tocar fora dos botões: tudo vai direto para o fim
    this.input.on("pointerdown", (p, over) => !over.length && this._skip());
    this.input.keyboard.on("keydown-ENTER", () => !this._modals.length && this._go("GameScene"));
    this.input.keyboard.on("keydown-ESC", () => closeTopModal(this) || this._go("CampScene"));
    this.cameras.main.fadeIn(420, 0, 0, 0);
    haptic(d.won ? 80 : 40);
  }

  // VOLTAR do Android: fecha o ranking aberto por cima; sem janela, volta à Clareira
  onBack() {
    if (!closeTopModal(this)) this._go("CampScene");
    return true;
  }

  _go(key) {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(250, 5, 8, 6);
    // Voltando à Clareira, o guardião chega pela trilha (vindo da floresta)
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(key, key === "CampScene" ? { fromRun: true } : undefined));
  }

  // "628 na floresta × 1,9 Pesadelo × 1,5 descanso × 2 anúncio" (só os fatores que valeram).
  // null quando não há conta a mostrar (sem moedas, ou save/partida sem o número-base).
  _coinMath(run, difficulty, restedMult, doubled) {
    if (run == null || run <= 0) return null;
    const parts = [tr("{0} na floresta", fmt(Math.round(run)))];
    const dm = difficulty?.rewardMult ?? 1;
    if (dm !== 1) parts.push(`${dec(dm)} ${difficulty.name}`); // o nome do Perigo já vem traduzido
    if (restedMult > 1) parts.push(tr("{0} descanso", dec(restedMult)));
    if (doubled) parts.push(tr("{0} anúncio", 2));
    return parts.join(" × ");
  }

  // Coluna da cena (esquerda) e do resultado (direita); o foco da cena fica no meio da coluna
  _layout() {
    const W = this.W,
      H = this.H,
      M = 22;
    const pw = Math.round(Phaser.Math.Clamp(W * 0.47, 600, 740));
    const px = W - M - pw;
    const colW = px - M;
    const cx = Math.round(M + colW / 2);
    const horizon = Math.round(H * 0.6);
    const feet = Math.round(Math.min(H - 54, horizon + (H - horizon) * 0.66));
    this.L = {
      M, pw, px, colW, cx, horizon, feet,
      hx: Math.round(cx - colW * (this.look.legend ? 0.2 : 0.1)), // guardião
      fx: Math.round(cx + colW * 0.1), // fogueira
      lx: Math.round(cx + colW * 0.2), // lenda libertada
      ly: horizon + Math.round((feet - horizon) * 0.42),
      sunY: horizon - 96,
    };
  }

  // Camada de arte gerada uma vez por tamanho de tela, desfecho e bioma
  _layer(name, make) {
    const key = `go_${name}_${this.mode}_${this.biomeId}_${this.W}x${this.H}_${this.L.cx}`;
    if (!this.textures.exists(key)) make().register(this, key);
    return key;
  }

  // Céu, astro, serra, as duas matas (ou o sertão), névoa e chão
  _world() {
    const W = this.W,
      H = this.H,
      L = this.L,
      look = this.look;
    const lw = Math.ceil(W / S) + 1,
      lh = Math.ceil(H / S) + 1;
    const hz = Math.round(L.horizon / S),
      fx = L.cx / S;
    const img = (key, x = 0, y = 0) => this.add.image(x, y, key).setOrigin(0).setScale(S);
    const dawn = look.sky === "dawn";
    this.fog = [];
    this.clouds = [];
    this.flies = [];
    this.rays = [];

    // Céu
    const skyO = dawn ? { tones: [PAL.dawn0, PAL.dawn1, PAL.dawn2, PAL.dawn3, PAL.dawn4, PAL.dawn5], milky: false, curve: 1.1 } : {};
    img(this._layer("sky", () => makeSky(lw, lh, hz, 11, skyO)));
    const nStars = dawn ? 26 : look.sky === "aurora" ? 96 : 70;
    for (let i = 0; i < nStars; i++) {
      const y = Math.random() * L.horizon * (dawn ? 0.32 : 0.75);
      const s = this.add
        .image(Math.random() * W, y, i % 6 ? "px_dot1" : "px_dot2")
        .setScale(3)
        .setAlpha((0.15 + Math.random() * 0.6) * (dawn ? 0.7 : 1))
        .setTint(i % 7 ? PAL.white : PAL.yel3);
      // no amanhecer as estrelas se apagam devagar
      if (dawn) this.tweens.add({ targets: s, alpha: 0, delay: 600 + Math.random() * 1800, duration: 2600, ease: "Sine.easeIn" });
      else this.tweens.add({ targets: s, alpha: 0.08, duration: 900 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2400, ease: "Sine.easeInOut" });
    }

    if (look.sky === "aurora") {
      // Noite Eterna: duas cortinas de aurora ondulando atrás da serra
      for (const [i, c, a] of [[0, PAL.wnd2, 0.55], [1, PAL.pur2, 0.4]]) {
        const au = this.add.image(-40 + i * 60, H * 0.02 + i * 18, this._layer(`aurora${i}`, () => makeAurora(lw + 40, Math.round(hz * 0.8), 90 + i * 13, c))).setOrigin(0).setScale(S).setAlpha(0).setBlendMode(ADD);
        this.tweens.add({ targets: au, alpha: a, duration: 2400, delay: 300 + i * 500 });
        this.tweens.add({ targets: au, x: au.x + 34 - i * 60, duration: 9000 + i * 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.tweens.add({ targets: au, scaleY: S * 1.06, duration: 4200 + i * 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }

    if (dawn) {
      // Sol nascendo atrás da serra: halo grande, raios em leque e o disco subindo
      this.sunGlow = [
        this.add.image(L.cx, L.sunY, "fx_glow").setScale(16, 9).setTint(PAL.dawn5).setAlpha(0).setBlendMode(ADD),
        this.add.image(L.cx, L.sunY, "fx_glow").setScale(6.5).setTint(PAL.sun0).setAlpha(0).setBlendMode(ADD),
      ];
      this.tweens.add({ targets: this.sunGlow[0], alpha: 0.32, duration: 2600, ease: "Sine.easeOut" });
      this.tweens.add({ targets: this.sunGlow[1], alpha: 0.45, duration: 2200, ease: "Sine.easeOut" });
      const ray = this._layer("ray", () => makeRay(110, 9));
      for (let i = 0; i < 9; i++) {
        const a = -1.2 + (i / 8) * 2.4 + (Math.random() - 0.5) * 0.12;
        const r = this.add.image(L.cx, L.sunY, ray).setOrigin(0.5, 0).setScale(S * (0.8 + Math.random() * 0.5), S * (0.75 + Math.random() * 0.6)).setRotation(Math.PI + a).setAlpha(0).setBlendMode(ADD);
        this.rays.push({ o: r, a, ph: Math.random() * 6, peak: 0.16 + Math.random() * 0.16 });
        this.tweens.add({ targets: r, alpha: this.rays.at(-1).peak, delay: 500 + i * 90, duration: 1800, ease: "Sine.easeOut" });
      }
      this.sun = this.add.image(L.cx, L.horizon + 6, this._layer("sun", () => makeSun(13))).setScale(S);
      this.tweens.add({ targets: this.sun, y: L.sunY, duration: 4200, ease: "Sine.easeOut" });
      this.tweens.add({ targets: this.sunGlow, y: L.sunY - 6, duration: 4200, ease: "Sine.easeOut" });
    } else {
      // Lua com halo
      const mx = Math.round(L.cx + L.colW * 0.3),
        my = Math.round(H * 0.31); // abaixo do título e da frase (a Noite Eterna tem o título comprido)
      this.add.image(mx, my, "fx_glow").setScale(7).setTint(PAL.ice3).setAlpha(0.12).setBlendMode(ADD);
      this.add.image(mx, my, "fx_glow").setScale(3.2).setTint(PAL.ice3).setAlpha(0.16).setBlendMode(ADD);
      this.add.image(mx, my, this._layer("moon", makeMoon)).setScale(S);
    }

    // Nuvens: no amanhecer, a barriga acesa pelo sol de baixo
    const cloudO = dawn ? { colors: [PAL.dawnCloud0, PAL.dawnCloud1], under: true } : {};
    const cloud = (i, w, h, y, v, a) => {
      const c = this.add.image(-150 + Math.random() * (W + 300), y, this._layer(`cloud${i}`, () => makeCloud(61 + i * 5, w, h, cloudO))).setScale(S);
      Object.assign(c, { _v: v, _a: a, _x0: -150 - w * S * 0.5, _x1: W + 150 });
      this.clouds.push(c);
    };
    cloud(0, 64, 12, H * (dawn ? 0.2 : 0.1), 6, dawn ? 0.9 : 0.7);
    cloud(1, 92, 16, L.horizon - 146, 3, dawn ? 0.85 : 0.7);
    cloud(2, 70, 13, L.horizon - 186, 4.2, dawn ? 0.75 : 0.55);

    // Serra
    const ridgeC = dawn ? [PAL.dawnRidge0, PAL.dawnRidge1] : undefined;
    img(this._layer("ridge", () => makeRidge(lw, lh, hz - 30, 24, 7, fx, ridgeC)));

    // Mata (ou sertão) ao longe: na derrota, tomada pela Podridão — lá longe, nunca na Clareira
    const far = dawn ? [PAL.dawnFar0, PAL.dawnFar1] : look.rot ? [ROT.dark, ROT.mid] : [PAL.woodsFar0, look.sky === "aurora" ? PAL.t3 : PAL.woodsFar1];
    const farKey = this.caat
      ? this._layer("far", () => makeCactusline(lw, lh, hz - 6, { seed: 21, minH: 9, maxH: 22, fill: far[0], rim: far[1], lightX: fx }))
      : this._layer("far", () => makeTreeline(lw, lh, hz - 7, { seed: 21, minH: 14, maxH: 30, jitter: 4, pines: 0.55, fill: far[0], rim: far[1], moonX: fx }));
    img(farKey);
    if (look.rot) this._rot();
    const fog = (y, tint, alpha, n) => {
      for (let i = 0; i < n; i++) {
        const f = this.add.image(W * (i / (n - 1)) + Math.random() * 80, y, "fx_glow").setScale(10, 1.5).setTint(tint).setAlpha(alpha).setBlendMode(ADD);
        f._v = 5 + Math.random() * 7;
        this.fog.push(f);
      }
    };
    fog(L.horizon - 34, dawn ? PAL.dawn4 : look.rot ? ROT.mid : PAL.night4, dawn ? 0.14 : 0.1, 4);

    // Mata de perto (a da Clareira: sempre sã)
    const near = dawn ? [PAL.dawnNear0, PAL.dawnNear1] : [PAL.woodsNear0, PAL.woodsNear1];
    const nearKey = this.caat
      ? this._layer("near", () => makeCactusline(lw, lh, hz + 3, { seed: 37, minH: 14, maxH: 34, fill: near[0], rim: near[1], lightX: fx }))
      : this._layer("near", () => makeTreeline(lw, lh, hz + 3, { seed: 37, minH: 22, maxH: 44, jitter: 6, pines: 0.45, fill: near[0], rim: near[1], moonX: fx, leafy: true }));
    img(nearKey);

    // Chão (terreiro batido em volta da fogueira, quando há fogueira); o sertão é seco
    const groundO = !this.caat
      ? {}
      : dawn
        ? { tones: [PAL.n0, PAL.clay0, PAL.clay1, PAL.straw0], blades: [PAL.straw0, PAL.straw1, PAL.straw2] }
        : { tones: [PAL.woodsNear0, PAL.n0, PAL.n1, PAL.clay0], blades: [PAL.n2, PAL.straw0, PAL.straw1] };
    const gfx = look.fire ? L.fx / S : -9999;
    img(this._layer("ground", () => makeGround(lw, lh - hz, gfx, L.feet / S - 2 - hz, 5, groundO)), 0, hz * S);
    fog(L.horizon + 6, dawn ? PAL.dawn5 : PAL.night4, dawn ? 0.12 : 0.14, 5);
    // luz da manhã batendo no gramado
    if (dawn) this.morning = this.add.image(L.cx, L.horizon + 40, "fx_glow").setScale(14, 4).setTint(PAL.sun0).setAlpha(0).setBlendMode(ADD);
    if (this.morning) this.tweens.add({ targets: this.morning, alpha: 0.12, duration: 3200, ease: "Sine.easeOut" });

    // Tufos e flores no gramado, longe de quem está em cena
    const env = this.registry.get(this.caat ? "envKeysCaatinga" : "envKeys");
    const atlas = this.caat ? "env_caatinga" : "env";
    const busy = [[L.hx, L.feet], [L.fx, L.feet], [L.lx, L.ly]];
    let placed = 0;
    for (let tries = 0; env && placed < 16 && tries < 160; tries++) {
      const x = 20 + Math.random() * (L.px - 10),
        y = L.horizon + 22 + Math.random() * (H - L.horizon - 34);
      if (busy.some(([bx, by]) => Math.abs(x - bx) < 90 && Math.abs(y - by) < 50)) continue;
      const list = placed % 3 ? env.tufts : env.flowers;
      if (!list?.length) continue;
      const k = (y - L.horizon) / (H - L.horizon);
      this.add.image(x, y, atlas, list[placed % list.length]).setOrigin(0.5, 1).setScale(3).setAlpha(0.5 + k * 0.45);
      placed++;
    }
  }

  // A Podridão no horizonte (derrota): a mata de longe adoecida respira um brilho magenta e solta esporos — a luz
  // da fogueira e a mata da Clareira ficam na frente, sãs
  _rot() {
    const L = this.L,
      W = this.W;
    this.rotGlow = [];
    for (let i = 0; i < 5; i++) {
      const g = this.add.image((W * i) / 4, L.horizon - 22, "fx_glow").setScale(7, 1.4).setTint(ROT.hot).setAlpha(0).setBlendMode(ADD);
      this.tweens.add({ targets: g, alpha: { from: 0, to: 0.13 + (i % 2) * 0.05 }, duration: 1600, delay: 300 + i * 120 });
      this.tweens.add({ targets: g, scaleY: 1.9, duration: 2600 + i * 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: 1900 });
      this.rotGlow.push(g);
    }
    this.spores = [];
    for (let i = 0; i < 18; i++) {
      const o = this.add.image(Math.random() * W, L.horizon - Math.random() * 40, "px_dot1").setScale(2).setTint(i % 3 ? ROT.glow : ROT.hot).setAlpha(0);
      this.spores.push({ o, vy: -(4 + Math.random() * 6), vx: (Math.random() - 0.5) * 4, ph: Math.random() * 6, life: Math.random() });
    }
  }

  // Quem está em cena: a lenda libertada (vitória), a fogueira (derrota e recuo) e o guardião
  _cast() {
    const L = this.L,
      look = this.look;
    if (look.legend) this._legend();
    if (look.fire) this._campfire();
    // o guardião da partida, desenhado quadro a quadro (HeroRig.js)
    const tex = registerResultRig(this, this.d.character ?? "guardian");
    this.add.image(L.hx, L.feet + 2, "px_shadow").setScale(6, 3.4).setAlpha(0.75);
    if (look.fire) this.heroLight = this.add.image(L.hx + 26, L.feet - 30, "fx_glow").setScale(3.6, 3).setTint(PAL.org3).setAlpha(0.18).setBlendMode(ADD);
    if (look.sky === "dawn") this.add.image(L.hx - 14, L.feet - 46, "fx_glow").setScale(3, 3.4).setTint(PAL.sun0).setAlpha(0.12).setBlendMode(ADD); // contraluz
    this.hero = this.add.sprite(L.hx, L.feet, tex, 0).setOrigin(22 / RIG_W, (GROUND + 12 + 0.5) / RESULT_H).setScale(HERO_SC);
    this.hero.play(`${tex}_${look.pose}`);
    // derrota: depois de recuperar o fôlego junto do fogo, ele se levanta (e a fogueira aviva junto)
    if (this.mode === "derrota")
      this.time.delayedCall(2700, () => {
        this.hero.play(`${tex}_rally`);
        this.hero.once("animationcomplete", () => this.hero.play(`${tex}_idle`));
        this._flare();
        this.sound.play("sfx_bonfire", { volume: 0.35 });
      });
  }

  // A lenda libertada na borda da mata: aura verde, motas de vida subindo e flores abrindo em volta dos pés
  _legend() {
    const L = this.L;
    const key = this.caat ? "mon_caboclo" : "mon_boss";
    this.add.image(L.lx, L.ly + 4, "px_shadow").setScale(10, 4).setAlpha(0.6);
    const aura = this.add.image(L.lx, L.ly - 80, "fx_glow").setScale(5, 6).setTint(this.caat ? PAL.ice2 : PAL.g5).setAlpha(0).setBlendMode(ADD);
    this.tweens.add({ targets: aura, alpha: 0.28, duration: 1600, delay: 400 });
    this.tweens.add({ targets: aura, scale: { from: 5, to: 5.6 }, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: 2000 });
    // o Mapinguari em paz (boca da barriga fechada, Monsters.js); o Caboclo d'Água no quadro de libertado
    if (!this.caat && !this.textures.exists("legend_mapinguari")) makeFreedMapinguari().register(this, "legend_mapinguari");
    const lg = (this.caat ? this.add.sprite(L.lx, L.ly, key, 4) : this.add.image(L.lx, L.ly, "legend_mapinguari")).setOrigin(0.5, 1).setScale(3).setAlpha(0);
    this.tweens.add({ targets: lg, alpha: 1, duration: 900, delay: 250 });
    // respiração lenta (sobe e desce o peito, nunca troca de quadro aos trancos)
    this.tweens.add({ targets: lg, scaleY: 3.06, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.motes = [];
    for (let i = 0; i < 14; i++) {
      const o = this.add.image(L.lx, L.ly, "px_dot2").setScale(2).setTint(i % 3 ? PAL.g6 : PAL.yel3).setAlpha(0).setBlendMode(ADD);
      this.motes.push({ o, ph: Math.random() * 6, life: Math.random(), dx: (Math.random() - 0.5) * 120 });
    }
    // a mata floresce aos pés da lenda (um por vez)
    const env = this.registry.get(this.caat ? "envKeysCaatinga" : "envKeys");
    const atlas = this.caat ? "env_caatinga" : "env";
    const fl = env?.flowers ?? [];
    for (let i = 0; i < Math.min(6, fl.length * 2); i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = L.lx + Math.cos(a) * (58 + (i % 2) * 22),
        y = L.ly + 8 + Math.sin(a) * 14;
      const f = this.add.image(x, y, atlas, fl[i % fl.length]).setOrigin(0.5, 1).setScale(0);
      this.tweens.add({ targets: f, scale: 3, duration: 380, delay: 1400 + i * 170, ease: "Back.easeOut", onStart: () => i % 2 || this.sound.play("sfx_pickup", { volume: 0.12, rate: 0.8 + i * 0.06 }) });
    }
  }

  // Fogueira (anel de pedras e toras, chamas e fumaça): na derrota começa baixa e aviva quando ele se levanta
  _campfire() {
    const L = this.L,
      fx = L.fx,
      fy = L.feet - 6;
    this.firePower = this.mode === "derrota" ? 0.45 : 1;
    this.firePool = this.add.image(fx, fy + 4, "fx_glow").setScale(12, 3.4).setTint(PAL.org3).setAlpha(0.2).setBlendMode(ADD);
    this.add.image(fx, fy + 8, "px_shadow").setScale(7, 3).setAlpha(0.7);
    const glow = this.add.image(fx, fy - 12, "fx_glow").setScale(4.8).setTint(PAL.org2).setAlpha(0.45).setBlendMode(ADD);
    this.add.image(fx, fy + 12, this._layer("campfire", makeCampfire)).setOrigin(0.5, 1).setScale(S);
    this.fire = { glow, x: fx, y: fy };
    this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        const k = this.firePower;
        if (Math.random() > 0.35 + k * 0.65) return;
        const f = this.add
          .image(fx + (Math.random() - 0.5) * 24 * (0.6 + k * 0.4), fy - 2, "px_puff")
          .setScale((2.4 + Math.random()) * (0.55 + k * 0.45))
          .setTint([PAL.yel3, PAL.org3, PAL.org2][Math.floor(Math.random() * 3)])
          .setBlendMode(ADD);
        this.tweens.add({ targets: f, y: fy - (24 + 20 * k) - Math.random() * 30 * k, x: f.x + (Math.random() - 0.5) * 14, scale: 0.4, alpha: 0, duration: 520 + Math.random() * 260, onComplete: () => f.destroy() });
        if (Math.random() < 0.12 + k * 0.12) {
          const e = this.add.image(fx, fy - 20, "px_dot1").setScale(3).setTint(PAL.yel3);
          this.tweens.add({ targets: e, y: fy - 90 - Math.random() * 90 * k, x: fx + (Math.random() - 0.5) * 70, alpha: 0, duration: 1500, ease: "Sine.easeOut", onComplete: () => e.destroy() });
        }
        if (Math.random() < 0.1) {
          const s = this.add.image(fx + (Math.random() - 0.5) * 10, fy - 44, "fx_glow").setScale(0.5).setTint(PAL.s3).setAlpha(0);
          this.tweens.add({ targets: s, alpha: { from: 0, to: 0.09 }, duration: 700, yoyo: true, hold: 1600 });
          this.tweens.add({ targets: s, y: fy - 200 - Math.random() * 40, x: s.x + 50 + Math.random() * 40, scale: 2.4, duration: 3000, ease: "Sine.easeOut", onComplete: () => s.destroy() });
        }
      },
    });
  }

  // A fogueira aviva (o guardião se levantou): chama cheia, faíscas e a luz crescendo
  _flare() {
    if (!this.fire) return;
    this.tweens.add({ targets: this, firePower: 1, duration: 900, ease: "Sine.easeOut" });
    const { x, y } = this.fire;
    for (let i = 0; i < 16; i++) {
      const e = this.add.image(x + (Math.random() - 0.5) * 20, y - 16, "px_dot1").setScale(3).setTint(i % 3 ? PAL.yel3 : PAL.org3).setBlendMode(ADD);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const r = 70 + Math.random() * 90;
      this.tweens.add({ targets: e, x: x + Math.cos(a) * r, y: y - 16 + Math.sin(a) * r, alpha: 0, duration: 900 + Math.random() * 500, ease: "Cubic.easeOut", onComplete: () => e.destroy() });
    }
  }

  // Moldura da coluna: árvore enraizada na borda esquerda, copas no canto de cima, samambaia embaixo, folhas
  // caindo, vaga-lumes, pássaros no amanhecer e a vinheta
  _frame() {
    const W = this.W,
      H = this.H,
      L = this.L;
    const lh = Math.ceil(H / S) + 1;
    const dawn = this.look.sky === "dawn";
    this.add.image(-16, H + 4, this._layer("trunk", () => makeFrameTrunk(lh + 2, 26, 3))).setOrigin(0, 1).setScale(S);
    this.sway = [];
    const canopy = (i, w, h, x, y) => {
      const c = this.add.image(x, y, this._layer(`canopy${i}`, () => makeCanopy(71 + i * 7, w, h, 1 + (i % 2)))).setOrigin(0).setScale(S);
      this.sway.push({ o: c, bx: x, by: y, ph: i * 1.7, ax: 2.4, ay: 1.2, per: 1800 + i * 260 });
    };
    canopy(0, 90, 48, -86, -62);
    canopy(2, 58, 34, -70, 70);
    canopy(3, 40, 26, -46, 190);
    const fern = this.add.image(-12, H + 8, this._layer("fern", () => makeFern(51, 56, 34))).setOrigin(0, 1).setScale(S);
    this.sway.push({ o: fern, bx: fern.x, by: fern.y, ph: 0.4, ax: 2, ay: 0, per: 1500 });

    const leafKeys = [this._layer("leafG", () => makeLeaf(false)), this._layer("leafY", () => makeLeaf(true))];
    this.leaves = [0, 1, 2].map((i) => ({ o: this.add.image(-50, -50, leafKeys[i % 2]).setScale(S).setVisible(false), wait: 900 + i * 1900, ph: Math.random() * 6 }));

    // vaga-lumes no gramado (no amanhecer, poucos, apagando)
    const nFlies = dawn ? 6 : 14;
    for (let i = 0; i < nFlies; i++) {
      const g = this.add.image(Math.random() * L.px, L.horizon + Math.random() * (H - L.horizon), "fx_glow").setScale(0.3).setTint(PAL.yel3).setBlendMode(ADD);
      const c = this.add.image(g.x, g.y, "px_dot2").setScale(2).setTint(PAL.yel3);
      this.flies.push({ g, c, ph: Math.random() * 7, vx: (Math.random() - 0.5) * 0.3, vy: -0.08 - Math.random() * 0.2, fade: dawn ? 1 : 0 });
    }

    // pássaros cruzando o céu da manhã
    this.birds = [];
    if (dawn) {
      const kb = [this._layer("birdU", () => makeBird(false)), this._layer("birdD", () => makeBird(true))];
      for (let i = 0; i < 4; i++) {
        const o = this.add.image(-30 - i * 60, H * (0.12 + Math.random() * 0.18), kb[0]).setScale(S - 1);
        this.birds.push({ o, keys: kb, v: 46 + Math.random() * 26, ph: Math.random() * 6, wait: 1200 + i * 700 + Math.random() * 600, y0: o.y });
      }
    }

    // Vinheta (Gradient: sem degraus nos escuros e sem textura do tamanho da tela), centrada na coluna da cena
    new ScreenVignette(this, { geom: (w, h) => ({ cx: this.L.cx, cy: h * 0.58, r0: h * 0.32, r1: Math.max(w, h) * 0.7 }), color: PAL.night0, alpha: 0.62 });
  }

  update(time, dt) {
    const W = this.W,
      H = this.H,
      L = this.L;
    for (const f of this.flies) {
      f.g.x += f.vx + Math.sin(time / 700 + f.ph) * 0.25;
      f.g.y += f.vy;
      if (f.g.y < L.horizon - 20) {
        f.g.y = H + 10;
        f.g.x = Math.random() * L.px;
      }
      // no amanhecer apagam devagar
      if (f.fade) f.fade = Math.max(0, f.fade - dt / 5000);
      const a = (0.3 + Math.abs(Math.sin(time / 400 + f.ph)) * 0.6) * (f.fade || (this.look.sky === "dawn" ? 0 : 1));
      f.g.setAlpha(a * 0.6);
      f.c.setPosition(f.g.x, f.g.y).setAlpha(a);
    }
    for (const f of this.fog) {
      f.x += (f._v * dt) / 1000;
      if (f.x > W + 300) f.x = -300;
    }
    for (const c of this.clouds) {
      c.x += (c._v * dt) / 1000;
      if (c.x > c._x1) c.x = c._x0;
      c.setAlpha(c._a * Math.max(0, Math.min(1, (c.x - c._x0) / 120, (c._x1 - c.x) / 120)));
    }
    for (const s of this.sway) {
      const t = (time / s.per) * Math.PI * 2 + s.ph;
      s.o.setPosition(s.bx + Math.sin(t) * s.ax, s.by + Math.sin(t * 0.7 + 1) * s.ay);
    }
    // raios de sol: abrem e fecham devagar, cada um no seu tempo
    for (const r of this.rays) r.o.setRotation(Math.PI + r.a + Math.sin(time / 2600 + r.ph) * 0.025);
    for (const l of this.leaves) {
      if (!l.o.visible) {
        l.wait -= dt;
        if (l.wait > 0) continue;
        l.o.setPosition(30 + Math.random() * 180, 70 + Math.random() * 60).setVisible(true).setAlpha(1);
        l.vx = 6 + Math.random() * 12;
        continue;
      }
      l.ph += dt / 1000;
      l.o.x += (l.vx + Math.sin(l.ph * 2.1) * 22) * (dt / 1000);
      l.o.y += (26 + Math.sin(l.ph * 4.2) * 10) * (dt / 1000);
      l.o.scaleX = S * Math.cos(l.ph * 3.3);
      if (l.o.y > L.horizon + 40) l.o.alpha -= dt / 900;
      if (l.o.alpha <= 0 || l.o.y > H) {
        l.o.setVisible(false);
        l.wait = 2600 + Math.random() * 4200;
      }
    }
    for (const b of this.birds) {
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      b.ph += dt / 1000;
      b.o.x += (b.v * dt) / 1000;
      b.o.y = b.y0 + Math.sin(b.ph * 1.7) * 6;
      b.o.setTexture(b.keys[Math.floor(b.ph * 5.5) % 2]);
      if (b.o.x > L.px + 40) {
        b.o.x = -30;
        b.y0 = H * (0.1 + Math.random() * 0.2);
        b.wait = 3000 + Math.random() * 5000;
      }
    }
    // motas de vida subindo da lenda; esporos da Podridão subindo lá longe
    for (const m of this.motes || []) {
      m.life += dt / 2600;
      if (m.life > 1) {
        m.life = 0;
        m.dx = (Math.random() - 0.5) * 120;
      }
      m.o.setPosition(L.lx + m.dx * m.life + Math.sin(time / 500 + m.ph) * 6, L.ly - 20 - m.life * 170).setAlpha(Math.sin(m.life * Math.PI) * 0.8);
    }
    for (const s of this.spores || []) {
      s.life += dt / 4200;
      if (s.life > 1) {
        s.life = 0;
        s.o.setPosition(Math.random() * W, L.horizon - Math.random() * 16);
      }
      s.o.x += (s.vx + Math.sin(time / 900 + s.ph) * 3) * (dt / 1000);
      s.o.y += (s.vy * dt) / 1000;
      s.o.setAlpha(Math.sin(s.life * Math.PI) * 0.7);
    }
    if (this.fire) {
      const k = Math.sin(time / 90) * 0.5 + Math.sin(time / 37) * 0.3 + Math.random() * 0.2;
      const p = this.firePower;
      this.fire.glow.setAlpha((0.42 + k * 0.08) * (0.45 + p * 0.55)).setScale(4.8 * (0.7 + p * 0.3));
      this.firePool?.setAlpha((0.2 + k * 0.04) * (0.5 + p * 0.5));
      this.heroLight?.setAlpha((0.16 + k * 0.03) * (0.5 + p * 0.5));
    }
  }

  // Título com as letras caindo uma a uma, o cipó dourado e a frase do desfecho
  _title() {
    const d = this.d,
      L = this.L;
    const title = this.mode === "eterna" ? tr("NOITE ETERNA") : d.won ? tr("VITÓRIA!") : d.quit ? tr("RECUO") : tr("DERROTA");
    const color = d.won ? CSS.goldHi : d.quit ? CSS.txt : CSS.redHi;
    const y = Math.round(78 + Math.max(0, this.H - 720) * 0.12);
    const st = { size: 80, color, origin: 0.5, stroke: true, strokeW: 10, shadowY: 6 };
    const whole = text(this, 0, 0, title, st);
    const tw = whole.width;
    whole.destroy();
    const box = this.add.container(L.cx, y).setDepth(950);
    // letra a letra: a posição sai da largura do pedaço antes dela (cada texto conta o contorno uma vez)
    const chars = [...title];
    let acc = "";
    chars.forEach((ch, i) => {
      const left = acc ? text(this, 0, 0, acc, st) : null;
      const lw = left ? left.width - st.strokeW : 0;
      left?.destroy();
      acc += ch;
      if (ch === " ") return;
      const c = text(this, 0, 0, ch, st);
      c.setX(Math.round(-tw / 2 + lw + c.width / 2));
      box.add(c);
      c.setAlpha(0).setY(-26);
      this._step(120 + i * 55, () => this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 420, ease: "Back.easeOut" }), () => (this.tweens.killTweensOf(c), c.setAlpha(1).setY(0)));
    });
    if (tw > L.colW - 40) box.setScale((L.colW - 40) / tw);
    const glow = this.add.image(L.cx, y + 12, "fx_glow").setScale(7, 2.2).setTint(d.won ? PAL.yel2 : d.quit ? PAL.ice3 : PAL.red2).setAlpha(0).setBlendMode(ADD).setDepth(949);
    this._step(300, () => this.tweens.add({ targets: glow, alpha: 0.18, duration: 900 }), () => glow.setAlpha(0.18));
    const vy = y + Math.round(textPx(80) * 0.55) + 6;
    const vine = this.add.image(L.cx, vy, this._layer("vine", () => makeVine())).setScale(S).setDepth(950);
    const sub =
      this.mode === "eterna"
        ? tr("{0} libertado e mais {1} na escuridão{2}", d.biome?.bossName ?? tr("Mapinguari"), formatTime(d.endlessS * 1000), d.endlessRecord ? tr(" — NOVO RECORDE!") : ".")
        : d.won
          ? d.biome?.freed ?? tr("O Mapinguari está livre da Podridão. A floresta respira.")
          : d.quit
            ? tr("Você recuou para lutar outro dia.")
            : tr("A floresta caiu… por enquanto.");
    const s = text(this, L.cx, vy + 22, sub, { size: 20, color: CSS.txt, origin: [0.5, 0], align: "center", wrap: L.colW - 60 }).setDepth(950);
    this._enter(120 + chars.length * 55 + 120, [vine], { dy: 0, dur: 500 });
    this._enter(120 + chars.length * 55 + 260, [s], { dy: 8, dur: 500 });
  }

  // ---------------------------------------------------------------------------
  // Entrada em sequência: cada passo tem a hora, o que anima e o estado final. Tocar fora dos botões aplica o
  // estado final de tudo de uma vez (quem joga de novo rápido não espera a contagem)
  // ---------------------------------------------------------------------------
  _step(at, play, finish) {
    const s = { finish, done: false };
    s.timer = this.time.delayedCall(at, () => {
      if (s.done) return;
      if (this._skipped) return void (s.done = true, finish());
      play();
    });
    this._steps.push(s);
  }

  _skip() {
    if (this._skipped) return;
    this._skipped = true;
    for (const s of this._steps) {
      s.timer.remove(false);
      if (!s.done) s.finish();
      s.done = true;
    }
  }

  // Aparece deslizando (dy/dx = de onde vem)
  _enter(at, objs, { dy = 10, dx = 0, dur = 340, ease = "Cubic.easeOut", pop = false, sound = null } = {}) {
    objs = objs.filter(Boolean);
    const fin = objs.map((o) => ({ o, x: o.x, y: o.y, a: o.alpha, s: o.scaleX, sy: o.scaleY }));
    for (const f of fin) {
      f.o.setAlpha(0).setPosition(f.x + dx, f.y + dy);
      if (pop) f.o.setScale(f.s * 0.6, f.sy * 0.6);
    }
    this._step(
      at,
      () => {
        if (sound) this.sound.play(sound[0], { volume: sound[1] });
        for (const f of fin) this.tweens.add({ targets: f.o, alpha: f.a, x: f.x, y: f.y, scaleX: f.s, scaleY: f.sy, duration: dur, ease: pop ? "Back.easeOut" : ease });
      },
      () => {
        for (const f of fin) {
          this.tweens.killTweensOf(f.o);
          f.o.setAlpha(f.a).setPosition(f.x, f.y).setScale(f.s, f.sy);
        }
      },
    );
  }

  // Número que conta de 0 até o valor e pula no fim (fit = largura máxima: o número final encolhe para caber)
  _count(at, t, to, show, { dur = 650, tick = true, fit = 0, onDone = null } = {}) {
    const base = t.scaleX;
    const o = { n: 0 };
    const final = () => show(this._coinsShown != null && t === this._coinText ? this._coinsShown : to);
    const scaleFor = () => (fit && t.width * base > fit ? fit / t.width : base);
    t.setText(show(0));
    this._step(
      at,
      () =>
        this.tweens.add({
          targets: o,
          n: to,
          duration: dur,
          ease: "Cubic.easeOut",
          onStart: () => tick && this.sound.play("sfx_ui_hover", { volume: 0.3 }),
          onUpdate: () => t.setText(show(o.n)),
          onComplete: () => {
            t.setText(final());
            const k = scaleFor();
            this.tweens.add({ targets: t, scale: { from: k * 1.22, to: k }, duration: 180 });
            onDone?.();
          },
        }),
      () => {
        this.tweens.killTweensOf(o);
        this.tweens.killTweensOf(t);
        t.setText(final());
        t.setScale(scaleFor());
        onDone?.(true);
      },
    );
  }

  // ---------------------------------------------------------------------------
  // O painel do resultado (coluna da direita), montado de cima para baixo num container: se não couber (texto
  // grande, japonês/chinês), encolhe por inteiro
  // ---------------------------------------------------------------------------
  _panel() {
    const d = this.d,
      L = this.L,
      H = this.H;
    const pw = L.pw,
      P = 22,
      inner = pw - 2 * P;
    const box = (this.panel = this.add.container(L.px, 0).setDepth(1000));
    const add = (o) => (box.add(o), o);
    const g = add(this.add.graphics());
    const lines = add(this.add.graphics());
    let y = P;
    const at0 = 420; // o painel entra; o conteúdo vem depois
    const label = (str, yy) => add(text(this, P + 2, yy, str, { size: 14, color: CSS.dim, origin: [0, 0] }));
    const sep = (yy) => lines.fillStyle(PAL.ink, 0.55).fillRect(P, Math.round(yy), inner, 2);

    // 1 · Perigo e nível (esquerda) · pontos do ranking (direita, abre o ranking)
    const hh = Math.max(44, textPx(18) + 18);
    const head = add(text(this, P + 4, y + hh / 2, tr("PERIGO: {0}   ·   NÍVEL {1}", (d.difficulty?.name ?? "").toUpperCase(), d.level), { size: 18, color: CSS.muted, origin: [0, 0.5] }));
    let scoreBtn = null;
    if (Leaderboards.available() && d.score > 0) {
      const lab = d.scoreRecord ? tr("RECORDE! {0} pontos", fmt(d.score)) : tr("{0} pontos", fmt(d.score));
      const probe = text(this, 0, 0, lab, { size: 18 });
      const bw = Math.min(inner * 0.52, 2 * 16 + 10 + probe.width + 34);
      probe.destroy();
      const open = () => !this._leaving && !this._modals?.length && openRanking(this, { board: "score", from: "fim", fresh: true });
      scoreBtn = add(new Button(this, pw - P - bw / 2, y + hh / 2, bw, Math.min(56, hh), lab, open, { size: 18, style: d.scoreRecord ? "gold" : "dark", color: d.scoreRecord ? CSS.goldHi : CSS.txt, icon: "ico_trophy", iconScale: 2 }));
      fitTo(head, inner - bw - 24);
    } else fitTo(head, inner - 8);
    this._enter(at0 + 120, [head], { dy: 0, dx: -12 });
    y += hh + 10;
    sep(y);
    y += 12;

    // 2 · Tempo, abates e reações em placas
    const tiles = [
      { icon: ["ico_hourglass"], label: tr("Tempo"), value: d.elapsedMs / 1000, show: (v) => formatTime(v * 1000) },
      { icon: ["ico_skull"], label: tr("Abates"), value: d.kills, show: (v) => fmt(Math.round(v)) },
    ];
    if (d.reactions > 0) tiles.push({ icon: ["ico_el_fire", "ico_el_ice"], label: tr("Reações"), value: d.reactions, show: (v) => fmt(Math.round(v)) });
    const gap = 12;
    const tw = Math.floor((inner - gap * (tiles.length - 1)) / tiles.length);
    const th = Math.max(78, textPx(32) + textPx(15) + 22);
    tiles.forEach((t, i) => {
      const x0 = P + i * (tw + gap);
      const tg = add(this.add.graphics());
      drawFrame(tg, x0, y, tw, th, "dark", { noRivets: true });
      const icx = x0 + 34;
      const icons = t.icon.map((k, j) => add(this.add.image(icx + (t.icon.length > 1 ? (j ? 7 : -7) : 0), y + th / 2 + (t.icon.length > 1 ? (j ? 6 : -6) : 0), k).setScale(t.icon.length > 1 ? 2.2 : 3)));
      const v = add(text(this, x0 + 62, y + th / 2 - textPx(15) / 2 - 1, t.show(0), { size: 32, color: CSS.txt, origin: [0, 0.5], stroke: true }));
      const lb = add(text(this, x0 + 63, y + th / 2 + textPx(32) / 2 - 3, t.label, { size: 15, color: CSS.muted, origin: [0, 0.5] }));
      fitTo(lb, tw - 72);
      this._enter(at0 + 160 + i * 110, [tg, ...icons, lb], { dy: 12 });
      this._enter(at0 + 160 + i * 110, [v], { dy: 12 });
      this._count(at0 + 320 + i * 150, v, t.value, t.show, { fit: tw - 72 });
    });
    y += th + 16;

    // 3 · Recompensas: as moedas (com a conta e o anúncio que dobra) e os prêmios extras em fichas
    const rewardsAt = at0 + 320 + tiles.length * 150 + 120;
    const lr = label(tr("RECOMPENSAS"), y);
    this._enter(rewardsAt - 60, [lr], { dy: 0 });
    y += textPx(14) + 8;
    const adShown = !d.quit && d.coinsDoubleable > 0 && AdService.canShow("double_coins");
    const note = this._coinMath(d.coinsRun, d.difficulty, d.restedMult, false) ?? tr("Moedas ganhas"); // sem a conta (save antigo), o nome da linha
    const coinMathDoubled = this._coinMath(d.coinsRun, d.difficulty, d.restedMult, true);
    const ch = Math.max(56, textPx(34) + (note ? textPx(15) + 4 : 0) + 8);
    const coinIco = add(this.add.image(P + 26, y + ch / 2, "ico_coin").setScale(3.2));
    const coinV = add(text(this, P + 58, y + (note ? ch / 2 - textPx(15) / 2 - 1 : ch / 2), "+0", { size: 34, color: CSS.goldHi, origin: [0, 0.5], stroke: true }));
    this._coinText = coinV;
    let room = inner - 58;
    let adBtn = null;
    if (adShown) {
      Analytics.track("ad_offer_show", { placement: "double_coins" });
      const bw = Math.min(300, Math.round(inner * 0.46));
      room -= bw + 12;
      adBtn = add(new Button(this, pw - P - bw / 2, y + ch / 2, bw, 52, tr("DOBRAR MOEDAS  +{0}", d.coinsDoubleable), () => this._doubleCoins(adBtn, coinMathDoubled, room), { size: 20, style: "primary", color: CSS.goldHi, icon: AdService.icon, iconScale: 2.5 }));
      if (adBtn.label) fitTo(adBtn.label, bw - 64);
    }
    if (note) {
      this._coinNote = add(text(this, P + 60, y + ch / 2 + textPx(34) / 2 - 1, note, { size: 15, color: CSS.dim, origin: [0, 0.5] }));
      fitTo(this._coinNote, room);
    }
    this._noteRoom = room;
    this._enter(rewardsAt, [coinIco, coinV, this._coinNote], { dy: 10 });
    if (adBtn) this._enter(rewardsAt + 260, [adBtn], { pop: true, dy: 0, dur: 360 });
    this._count(rewardsAt + 60, coinV, d.coinsDoubleable, (v) => `+${fmt(Math.round(v))}`, {
      dur: 750,
      onDone: (skip) => !skip && d.coinsDoubleable > 0 && this.sound.play("sfx_coin_cascade", { volume: 0.5 }),
    });
    y += ch + 8;
    const chips = [];
    if (d.firstClear > 0) chips.push({ icon: "ico_trophy", value: d.firstClear, label: tr("Primeira vitória no {0}", d.difficulty?.name ?? tr("Perigo")), color: CSS.goldHi });
    if (d.woodGained > 0) chips.push({ icon: "ico_wood", value: d.woodGained, label: tr("Madeira Ancestral"), color: "#ffc86b" });
    if (d.seedsGained > 0) chips.push({ icon: "ico_seed", value: d.seedsGained, label: tr("Sementes raras"), color: "#ffe58f" });
    if (chips.length) {
      const chH = Math.max(40, textPx(18) + 18);
      const made = chips.map((c) => {
        const vt = text(this, 0, 0, `+${fmt(c.value)}`, { size: 20, color: c.color, origin: [0, 0.5], stroke: true });
        const lt = text(this, 0, 0, c.label, { size: 15, color: CSS.muted, origin: [0, 0.5] });
        let w = 14 + 32 + 6 + vt.width + 8 + lt.width + 16;
        if (w > inner) {
          fitTo(lt, inner - (14 + 32 + 6 + vt.width + 8 + 16));
          w = inner;
        }
        return { vt, lt, w };
      });
      // numa fileira só se couber; com 3 que não cabem, a 1ª (a vitória) sozinha em cima e as outras duas embaixo
      // (sem uma ficha órfã no fim)
      const sum = (list) => list.reduce((s, m) => s + m.w, 0) + (list.length - 1) * 10;
      const breakAt = sum(made) <= inner ? -1 : made.length === 3 && sum(made.slice(1)) <= inner ? 1 : null;
      let cx = P,
        rowY = y;
      chips.forEach((c, i) => {
        const { vt, lt, w } = made[i];
        const wrap = breakAt === null ? cx > P && cx + w > P + inner : i === breakAt;
        if (wrap) {
          cx = P;
          rowY += chH + 8;
        }
        const cg = add(this.add.graphics());
        drawFrame(cg, cx, rowY, w, chH, c.icon === "ico_trophy" ? "gold" : "dark", { noRivets: true });
        const ic = add(this.add.image(cx + 14 + 16, rowY + chH / 2, c.icon).setScale(2.2));
        vt.setPosition(cx + 14 + 32 + 6, rowY + chH / 2);
        lt.setPosition(vt.x + vt.width + 8, rowY + chH / 2 + 1);
        add(vt);
        add(lt);
        this._enter(rewardsAt + 420 + i * 150, [cg, ic, vt, lt], { pop: true, dy: 0, dur: 300, sound: ["sfx_pickup", 0.2] });
        cx += w + 10;
      });
      y = rowY + chH + 8;
    }
    y += 6;
    sep(y);
    y += 12;

    // 4 · Armas: ícone, nível e a parte do dano de cada uma (a que mais causou dano em dourado, com estrela)
    const weapons = [...d.weapons];
    const share = d.dmgShare || null;
    if (share) weapons.sort((a, b) => (share[b.key] ?? 0) - (share[a.key] ?? 0));
    const weaponsAt = rewardsAt + 420 + chips.length * 150 + 160;
    if (weapons.length) {
      const lw = label(share ? tr("ARMAS  ·  PARTE DO DANO") : tr("ARMAS"), y);
      this._enter(weaponsAt - 60, [lw], { dy: 0 });
      y += textPx(14) + 8;
      const n = weapons.length,
        wg = 10;
      const cw = Math.min(118, Math.floor((inner - (n - 1) * wg) / n));
      const cardH = Math.max(92, 48 + textPx(15) + (share ? 20 : 10) + 12);
      const best = share && n > 1 ? weapons[0].key : null;
      const rowX = P + (inner - (n * cw + (n - 1) * wg)) / 2;
      weapons.forEach((w, i) => {
        const def = WEAPONS[w.key] || {};
        const x0 = rowX + i * (cw + wg);
        const isBest = w.key === best && (share[w.key] ?? 0) > 0;
        const cg = add(this.add.graphics());
        drawFrame(cg, x0, y, cw, cardH, isBest ? "gold" : def.evolvesFrom ? "purple" : "dark", { noRivets: true });
        const icx = x0 + cw / 2,
          icy = y + 30;
        const ic = add(this.add.image(icx, icy, WEAPON_ICON[w.key] ?? "ico_staff").setScale(2.6));
        // nível num selo no canto do ícone (o número sozinho: cabe em qualquer idioma e tamanho de texto)
        const lv = text(this, 0, 0, String(w.level), { size: 16, color: def.evolvesFrom ? hex(PAL.pur3) : CSS.txt, origin: 0.5, shadow: false });
        const bs = Math.max(24, Math.ceil(Math.max(lv.width, lv.height) / 2) * 2 + 4);
        const badge = add(this.add.graphics());
        drawFrame(badge, icx + 12, icy - 28, bs, bs, def.evolvesFrom ? "purple" : "dark", { noRivets: true, flat: true });
        lv.setPosition(icx + 12 + bs / 2, icy - 28 + bs / 2);
        add(lv);
        const parts = [cg, ic, badge, lv];
        if (share) {
          const pct = share[w.key] ?? 0;
          const pt = add(text(this, icx, y + 58 + textPx(15) / 2, `${Math.round(pct)}%`, { size: 15, color: isBest ? CSS.goldHi : CSS.txt, origin: 0.5 }));
          fitTo(pt, cw - 16);
          const by = y + cardH - 16,
            bw = cw - 20;
          const bar = add(this.add.graphics());
          bar.fillStyle(PAL.ink, 1).fillRect(x0 + 10, by, bw, 6);
          const fill = add(this.add.graphics());
          fill.fillStyle(ELEMENT_COLOR[def.element] ?? PAL.yel2, 1).fillRect(0, 0, Math.max(2, Math.round((bw * Math.min(100, pct)) / 100)), 6);
          fill.fillStyle(PAL.white, 0.35).fillRect(0, 0, Math.max(2, Math.round((bw * Math.min(100, pct)) / 100)), 2);
          fill.setPosition(x0 + 10, by);
          parts.push(pt, bar);
          fill.setScale(0, 1);
          this._step(
            weaponsAt + 260 + i * 110,
            () => this.tweens.add({ targets: fill, scaleX: 1, duration: 520, ease: "Cubic.easeOut" }),
            () => (this.tweens.killTweensOf(fill), fill.setScale(1, 1)),
          );
        }
        if (isBest) {
          const star = add(this.add.image(x0 + 13, y + 13, "ico_star").setScale(2));
          star.setAlpha(0);
          this._step(
            weaponsAt + 260 + n * 110 + 200,
            () => {
              this.tweens.add({ targets: star, alpha: 1, scale: { from: 4, to: 2 }, duration: 380, ease: "Back.easeOut" });
              this.sound.play("sfx_coin", { volume: 0.35 });
            },
            () => (this.tweens.killTweensOf(star), star.setAlpha(1).setScale(2)),
          );
        }
        this._enter(weaponsAt + i * 110, parts, { dy: 14, sound: i % 2 ? null : ["sfx_chest_reel", 0.25] });
      });
      y += cardH + 14;
    }

    // 5 · Desbloqueios: uma faixa roxa por novidade (até 3; o resto vira "+N")
    const unlocks = [...d.newUnlocks];
    if (d.unlockedNextDifficulty) unlocks.unshift(tr("Novo Perigo: {0}", d.unlockedNextDifficulty));
    const unlockAt = weaponsAt + 260 + weapons.length * 110 + 360;
    if (unlocks.length) {
      const show = unlocks.length > 3 ? [...unlocks.slice(0, 2), tr("e mais {0}", unlocks.length - 2)] : unlocks;
      const rh = Math.max(34, textPx(17) + 14);
      show.forEach((u, i) => {
        const ug = add(this.add.graphics());
        drawFrame(ug, P, y, inner, rh, "purple", { noRivets: true });
        const ic = add(this.add.image(P + 22, y + rh / 2, "ico_star").setScale(2));
        const ut = add(text(this, P + 42, y + rh / 2, u, { size: 17, color: hex(PAL.pur3), origin: [0, 0.5] }));
        fitTo(ut, inner - 56);
        this._enter(unlockAt + i * 170, [ug, ic, ut], { dx: 30, dy: 0, dur: 360, sound: i ? null : ["sfx_levelup", 0.45] });
        y += rh + 6;
      });
      y += 4;
    }

    // Moldura do tamanho do conteúdo; encolhe se não couber acima dos botões
    const ph = Math.round(y + P - 8);
    drawFrame(g, 0, 0, pw, ph, d.won ? "gold" : "dark");
    const top = L.M,
      avail = H - L.M - 66 - 14 - top;
    const k = Math.min(1, avail / ph);
    box.setScale(k);
    box.x = L.px + (pw - pw * k);
    box.y = Math.round(top + Math.max(0, (avail - ph * k) / 2) * (H > 760 ? 1 : 0.35));
    // o painel entra deslizando da direita
    const bx = box.x;
    box.setAlpha(0).setX(bx + 40);
    this._step(260, () => {
      this.sound.play("sfx_whoosh", { volume: 0.3 });
      this.tweens.add({ targets: box, alpha: 1, x: bx, duration: 420, ease: "Cubic.easeOut" });
    }, () => (this.tweens.killTweensOf(box), box.setAlpha(1).setX(bx)));
    // Recorde: o botão dos pontos pula e solta confete
    if (scoreBtn) {
      this._enter(unlockAt - 200, [scoreBtn], { pop: true, dy: 0, dur: 360 });
      if (d.scoreRecord) this._step(unlockAt - 60, () => this._confetti(box.x + scoreBtn.x * k, box.y + scoreBtn.y * k), () => {});
    }
  }

  _doubleCoins(db, coinMathDoubled, room) {
    if (db._used) return;
    db._used = true;
    db.setEnabled(false);
    AdService.rewarded("double_coins").then((ok) => {
      if (!this.sys.isActive()) return;
      if (!ok) {
        db._used = false;
        db.setEnabled(true);
        return;
      }
      const d = this.d;
      new MetaProgression().addCoins(d.coinsDoubleable);
      this._coinsShown = d.coinsDoubleable * 2;
      db.setLabel(tr("MOEDAS DOBRADAS!"));
      this._coinText?.setText(`+${fmt(this._coinsShown)}`);
      if (this._coinNote && coinMathDoubled) {
        this._coinNote.setScale(1).setText(coinMathDoubled);
        fitTo(this._coinNote, room);
      }
      if (this._coinText) this.tweens.add({ targets: this._coinText, scale: { from: 1.5, to: 1 }, duration: 260, ease: "Back.easeOut" });
      this.sound.play("sfx_coin_cascade", { volume: 0.7 });
      haptic(30);
    });
  }

  // Confete dourado e das cores dos elementos (recorde)
  _confetti(x, y) {
    this.sound.play("sfx_chest_jackpot", { volume: 0.4 });
    for (let i = 0; i < 34; i++) {
      const c = this.add.image(x, y, "px_dot2").setScale(3).setTint([PAL.yel3, PAL.org2, PAL.ice2, PAL.g6, PAL.pur2][i % 5]).setDepth(1100);
      const a = Math.random() * Math.PI * 2,
        r = 60 + Math.random() * 120;
      this.tweens.add({ targets: c, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7 + 60, alpha: 0, angle: 360, duration: 900 + Math.random() * 600, ease: "Cubic.easeOut", onComplete: () => c.destroy() });
    }
  }

  // JOGAR DE NOVO e CLAREIRA embaixo do painel: aparecem cedo (quem quer jogar de novo não espera)
  _buttons() {
    const L = this.L,
      H = this.H;
    const by = H - L.M - 33,
      bw = Math.floor((L.pw - 12) / 2);
    const again = new Button(this, L.px + bw / 2, by, bw, 66, tr("JOGAR DE NOVO"), () => this._go("GameScene"), { size: 26, style: "primary", color: CSS.goldHi }).setDepth(1000);
    const camp = new Button(this, L.px + L.pw - bw / 2, by, bw, 66, tr("CLAREIRA"), () => this._go("CampScene"), { size: 26 }).setDepth(1000);
    for (const b of [again, camp]) if (b.label) fitTo(b.label, bw - 24);
    this._enter(380, [again, camp], { dy: 16, dur: 360 });
    this.time.delayedCall(2600, () => this.tweens.add({ targets: again, scale: 1.04, duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
  }

  // Vinheta de vitória/derrota; depois só a fogueira estalando (derrota e recuo)
  _sound() {
    const key = this.d.won ? "music_victory" : this.d.quit ? null : "music_defeat";
    if (key && this.cache.audio.exists(key)) this.sound.play(key, { volume: 0.55 });
    if (this.look.fire && this.cache.audio.exists("sfx_fire_loop")) {
      this.fireLoop = this.sound.add("sfx_fire_loop", { loop: true, volume: 0.22 });
      this.fireLoop.play();
    }
    this.events.once("shutdown", () => {
      this.fireLoop?.stop();
      this.fireLoop?.destroy();
      this.fireLoop = null;
      if (key) this.sound.stopByKey(key);
    });
  }
}
