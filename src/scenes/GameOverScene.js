// Fim de partida: vitória / derrota / desistência. Números sobem animados,
// armas da build aparecem, desbloqueios novos ganham destaque. Botão principal
// = JOGAR DE NOVO (o "só mais uma" do gênero).
import { WEAPONS } from "../config.js";
import { formatTime } from "../utils.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera } from "../ui/Theme.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { MetaProgression } from "../systems/MetaProgression.js";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(data) {
    const { won, quit, elapsedMs, kills, coinsGained, woodGained = 0, seedsGained = 0, newUnlocks = [], difficulty, unlockedNextDifficulty, level = 1, weapons = [], endlessS = 0, endlessRecord = false } = data;
    fitCamera(this);
    // O Phaser REAPROVEITA a instância da cena: todo estado de "visita" precisa
    // ser zerado aqui, senão sobra da vez anterior (ex.: herói preso andando).
    this._leaving = false;
    this._coinsShown = undefined;
    this._coinText = null;
    const W = vw(this),
      H = vh(this);
    const cx = W / 2;

    this._backdrop(won);

    // Título
    const title = endlessS > 0 ? "NOITE ETERNA" : won ? "VITÓRIA!" : quit ? "RECUO" : "DERROTA";
    const color = won ? CSS.goldHi : quit ? CSS.muted : CSS.redHi;
    const t = text(this, cx, 78, title, { size: 80, color, origin: 0.5, stroke: true, strokeW: 10, shadowY: 6 });
    t.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 420, ease: "Back.easeOut" });
    const sub =
      endlessS > 0
        ? `Mapinguari libertado e mais ${formatTime(endlessS * 1000)} na escuridão${endlessRecord ? " — NOVO RECORDE!" : "."}`
        : won
          ? "O Mapinguari está livre da Podridão. A floresta respira."
          : quit
            ? "Você recuou para lutar outro dia."
            : "A floresta caiu… por enquanto.";
    text(this, cx, 132, sub, { size: 22, color: CSS.muted, origin: 0.5 });

    // Painel de resultados
    const pw = Math.min(700, W - 60),
      ph = 300;
    const px = cx - pw / 2,
      py = 164;
    const g = this.add.graphics();
    drawFrame(g, px, py, pw, ph, won ? "gold" : "dark");
    text(this, cx, py + 30, `PERIGO: ${(difficulty?.name ?? "").toUpperCase()}   ·   NÍVEL ${level}`, { size: 18, color: CSS.muted, origin: 0.5 });

    const stats = [
      { icon: "ico_hourglass", label: "Tempo", value: elapsedMs / 1000, fmt: (v) => formatTime(v * 1000) },
      { icon: "ico_skull", label: "Abates", value: kills, fmt: (v) => String(Math.round(v)) },
      { icon: "ico_coin", label: "Moedas ganhas", value: coinsGained, fmt: (v) => `+${Math.round(v)}`, color: CSS.goldHi },
    ];
    if (woodGained > 0) stats.push({ icon: "ico_wood", label: "Madeira Ancestral", value: woodGained, fmt: (v) => `+${Math.round(v)}`, color: "#ffc86b" });
    if (seedsGained > 0) stats.push({ icon: "ico_seed", label: "Sementes raras", value: seedsGained, fmt: (v) => `+${Math.round(v)}`, color: "#ffe58f" });
    const rowH = stats.length > 3 ? 44 : 52;
    stats.forEach((s, i) => {
      const y = py + 78 + i * rowH;
      this.add.image(px + 50, y, s.icon).setScale(3);
      text(this, px + 84, y, s.label, { size: 22, color: CSS.muted, origin: [0, 0.5] });
      const v = text(this, px + pw - 36, y, s.fmt(0), { size: 30, color: s.color ?? CSS.txt, origin: [1, 0.5], stroke: true });
      const o = { n: 0 };
      this.tweens.add({
        targets: o,
        n: s.value,
        delay: 350 + i * 250,
        duration: 700,
        ease: "Cubic.easeOut",
        onUpdate: () => v.setText(s.fmt(o.n)),
        onStart: () => this.sound.play("sfx_ui_hover", { volume: 0.3 }),
        onComplete: () => {
          if (s.icon === "ico_coin") this._coinText = v;
          v.setText(s.fmt(this._coinsShown ?? s.value));
          this.tweens.add({ targets: v, scale: { from: 1.25, to: 1 }, duration: 160 });
          if (s.icon === "ico_coin" && s.value > 0) this.sound.play("sfx_coin_cascade", { volume: 0.5 });
        },
      });
    });

    // Build final (ícones)
    const wy = py + ph - 44;
    weapons.forEach((w, i) => {
      const x = cx + (i - (weapons.length - 1) / 2) * 60;
      const sg = this.add.graphics();
      drawFrame(sg, x - 24, wy - 24, 48, 48, WEAPONS[w.key]?.evolvesFrom ? "purple" : "dark", { noRivets: true });
      this.add.image(x, wy, WEAPON_ICON[w.key] ?? "ico_staff").setScale(2.5);
    });

    // Desbloqueios
    const unlocks = [...newUnlocks];
    if (unlockedNextDifficulty) unlocks.unshift(`Novo Perigo: ${unlockedNextDifficulty}`);
    if (unlocks.length) {
      const uy = py + ph + 40;
      const uw = Math.min(pw, W - 60);
      const ug = this.add.graphics();
      drawFrame(ug, cx - uw / 2, uy - 28, uw, 56, "purple");
      this.add.image(cx - uw / 2 + 34, uy, "ico_trophy").setScale(2.5);
      const ut = text(this, cx + 10, uy, unlocks.join("  ·  "), { size: 20, color: hex(PAL.pur3), origin: 0.5 });
      if (ut.width > uw - 90) ut.setScale((uw - 90) / ut.width);
      ug.setAlpha(0);
      ut.setAlpha(0);
      this.tweens.add({ targets: [ug, ut], alpha: 1, delay: 1300, duration: 300, onStart: () => this.sound.play("sfx_levelup", { volume: 0.5 }) });
    }

    // Dobrar moedas (anúncio premiado, opcional) — só com moedas ganhas
    if (!quit && coinsGained > 0 && AdService.canShow("double_coins")) {
      Analytics.track("ad_offer_show", { placement: "double_coins" });
      const db = new Button(this, cx, H - 134, 360, 54, `DOBRAR MOEDAS  +${coinsGained}`, async () => {
        if (db._used) return;
        db._used = true;
        db.setEnabled(false);
        const ok = await AdService.rewarded("double_coins");
        if (!ok) {
          db._used = false;
          db.setEnabled(true);
          return;
        }
        new MetaProgression().addCoins(coinsGained);
        this._coinsShown = coinsGained * 2;
        db.setLabel("MOEDAS DOBRADAS!");
        this._coinText?.setText(`+${this._coinsShown}`);
        if (this._coinText) this.tweens.add({ targets: this._coinText, scale: { from: 1.5, to: 1 }, duration: 260, ease: "Back.easeOut" });
        this.sound.play("sfx_coin_cascade", { volume: 0.7 });
        haptic(30);
      }, { size: 22, style: "primary", color: CSS.goldHi, icon: "ico_play", iconScale: 2.5 });
    }

    // Botões
    const by = H - 62;
    const again = new Button(this, cx - 170, by, 310, 66, "JOGAR DE NOVO", () => this._go("GameScene"), { size: 26, style: "primary", color: CSS.goldHi });
    new Button(this, cx + 170, by, 310, 66, "CLAREIRA", () => this._go("CampScene"), { size: 26 });
    this.tweens.add({ targets: again, scale: 1.04, duration: 800, yoyo: true, repeat: -1, delay: 1500 });
    this.input.keyboard.on("keydown-ENTER", () => this._go("GameScene"));
    this.input.keyboard.on("keydown-ESC", () => this._go("CampScene"));
    haptic(won ? 80 : 40);
  }

  onBack() {
    this._go("CampScene");
    return true;
  }

  _go(key) {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(250, 5, 8, 6);
    // Voltando à Clareira, o guardião chega pela trilha (vindo da floresta)
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(key, key === "CampScene" ? { fromRun: true } : undefined));
  }

  _backdrop(won) {
    const W = vw(this),
      H = vh(this);
    const key = `go_sky_${won ? 1 : 0}_${W}x${H}`;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W, H);
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (won) {
        g.addColorStop(0, "#1a2a3a");
        g.addColorStop(0.6, "#2a4a3a");
        g.addColorStop(1, "#122018");
      } else {
        g.addColorStop(0, "#140a12");
        g.addColorStop(0.6, "#2a1418");
        g.addColorStop(1, "#0c0a0c");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      c.refresh();
    }
    this.add.image(0, 0, key).setOrigin(0);
    const env = this.registry.get("envKeys");
    const trees = [...env.pines, ...env.trees.slice(0, 5)];
    for (let x = -40; x < W + 60; x += 40 + Math.random() * 30) {
      this.add
        .image(x, H + 10 + Math.random() * 20, "env", trees[Math.floor(Math.random() * trees.length)])
        .setOrigin(0.5, 1)
        .setScale(3)
        .setTint(won ? 0x14302a : 0x1a0e12);
    }
    // Partículas: vaga-lumes (vitória) ou cinzas (derrota)
    for (let i = 0; i < 24; i++) {
      const p = this.add
        .image(Math.random() * W, H + Math.random() * 200, won ? "px_dot2" : "px_dot1")
        .setScale(3)
        .setTint(won ? 0xfff5b8 : 0x8a6a6a)
        .setAlpha(0.7);
      this.tweens.add({
        targets: p,
        y: -20,
        x: p.x + (Math.random() - 0.5) * 120,
        duration: 6000 + Math.random() * 6000,
        repeat: -1,
        delay: Math.random() * 6000,
      });
    }
    if (won) {
      for (let i = 0; i < 40; i++) {
        const c = this.add
          .image(W / 2, 80, "px_dot2")
          .setScale(3)
          .setTint([0xf2c14e, 0x9ccf62, 0xff7a3c, 0x5cc8ff][i % 4]);
        const a = Math.random() * Math.PI * 2;
        this.tweens.add({
          targets: c,
          x: W / 2 + Math.cos(a) * (200 + Math.random() * 300),
          y: 80 + Math.sin(a) * 160 + 200,
          alpha: 0,
          duration: 1400 + Math.random() * 800,
          ease: "Cubic.easeOut",
        });
      }
    }
  }
}
