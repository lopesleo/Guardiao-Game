// Fim de partida: vitória / derrota / desistência. Números sobem animados,
// armas da build aparecem, desbloqueios novos ganham destaque. Botão principal
// = JOGAR DE NOVO (o "só mais uma" do gênero).
import { WEAPONS } from "../config.js";
import { formatTime } from "../utils.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { text, drawFrame, Button, vw, vh, haptic, fitCamera, textPx } from "../ui/Theme.js";
import { fitTo } from "../ui/Widgets.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Leaderboards } from "../systems/Leaderboards.js";
import { openRanking } from "../ui/RankingModal.js";
import { tr, fmt, dec } from "../i18n/i18n.js";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(data) {
    const { won, quit, elapsedMs, kills, coinsGained, coinsDoubleable = coinsGained, coinsRun = null, restedMult = 1, firstClear = 0, woodGained = 0, seedsGained = 0, newUnlocks = [], difficulty, unlockedNextDifficulty, score = 0, scoreRecord = false, level = 1, weapons = [], endlessS = 0, endlessRecord = false, biome = null } = data;
    fitCamera(this);
    // O Phaser REAPROVEITA a instância da cena: todo estado de "visita" precisa
    // ser zerado aqui, senão sobra da vez anterior (ex.: herói preso andando).
    this._leaving = false;
    this._coinsShown = undefined;
    this._coinText = null;
    this._coinNote = null;
    const W = vw(this),
      H = vh(this);
    const cx = W / 2;

    this._backdrop(won);

    // Título
    const title = endlessS > 0 ? tr("NOITE ETERNA") : won ? tr("VITÓRIA!") : quit ? tr("RECUO") : tr("DERROTA");
    const color = won ? CSS.goldHi : quit ? CSS.muted : CSS.redHi;
    const t = text(this, cx, 78, title, { size: 80, color, origin: 0.5, stroke: true, strokeW: 10, shadowY: 6 });
    t.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 420, ease: "Back.easeOut" });
    const sub =
      endlessS > 0
        ? tr("{0} libertado e mais {1} na escuridão{2}", biome?.bossName ?? tr("Mapinguari"), formatTime(endlessS * 1000), endlessRecord ? tr(" — NOVO RECORDE!") : ".")
        : won
          ? biome?.freed ?? tr("O Mapinguari está livre da Podridão. A floresta respira.")
          : quit
            ? tr("Você recuou para lutar outro dia.")
            : tr("A floresta caiu… por enquanto.");
    // a frase fica embaixo do título de verdade (japonês/chinês com texto grande: o título cresce e a frase
    // invadia as letras dele)
    const subY = Math.max(132, 78 + t.height / 2 + textPx(22) / 2 - 2); // pt com texto normal: 132, como sempre
    fitTo(text(this, cx, subY, sub, { size: 22, color: CSS.muted, origin: 0.5 }), W - 40); // frase comprida (es/ja, texto grande) passava da tela

    // Painel de resultados — altura CALCULADA (antes: fixa em 300, e com Madeira +
    // Sementes a 5ª linha caía em cima da fileira de armas)
    const pw = Math.min(700, W - 60);
    const px = cx - pw / 2,
      py = Math.max(164, Math.round(subY + textPx(22) / 2 + 14));

    const stats = [
      { icon: "ico_hourglass", label: tr("Tempo"), value: elapsedMs / 1000, fmt: (v) => formatTime(v * 1000) },
      { icon: "ico_skull", label: tr("Abates"), value: kills, fmt: (v) => String(Math.round(v)) },
      // Moedas da PARTIDA (é o que o anúncio dobra); o prêmio da 1ª vitória vem em linha própria.
      // Embaixo, a CONTA: o que caiu na floresta × Perigo × descanso (× anúncio) — o jogador
      // vê de onde veio cada moeda em vez de um número que "pula" sem explicação
      { icon: "ico_coin", label: tr("Moedas ganhas"), note: this._coinMath(coinsRun, difficulty, restedMult, false), value: coinsDoubleable, fmt: (v) => `+${Math.round(v)}`, color: CSS.goldHi },
    ];
    const coinMathDoubled = this._coinMath(coinsRun, difficulty, restedMult, true);
    if (firstClear > 0) stats.push({ icon: "ico_trophy", label: tr("Primeira vitória no {0}", difficulty?.name ?? tr("Perigo")), value: firstClear, fmt: (v) => `+${Math.round(v)}`, color: CSS.goldHi });
    if (woodGained > 0) stats.push({ icon: "ico_wood", label: tr("Madeira Ancestral"), value: woodGained, fmt: (v) => `+${Math.round(v)}`, color: "#ffc86b" });
    if (seedsGained > 0) stats.push({ icon: "ico_seed", label: tr("Sementes raras"), value: seedsGained, fmt: (v) => `+${Math.round(v)}`, color: "#ffe58f" });
    // Orçamento vertical: tudo acima do botão de anúncio (ou dos botões finais)
    const unlocks = [...newUnlocks];
    if (unlockedNextDifficulty) unlocks.unshift(tr("Novo Perigo: {0}", unlockedNextDifficulty));
    const adShown = !quit && coinsDoubleable > 0 && AdService.canShow("double_coins");
    const limit = (adShown ? H - 134 - 30 : H - 62 - 36) - 12;
    const HEAD = 62, // faixa "PERIGO · NÍVEL"
      BUILD = weapons.length ? 66 : 0, // fileira de armas
      FOOT = 14,
      UNL = unlocks.length ? 70 : 0;
    const rowH = Phaser.Math.Clamp(Math.floor((limit - py - HEAD - BUILD - FOOT - UNL) / stats.length), 28, 52); // 28: até 6 linhas cabem no celular deitado
    const ph = HEAD + stats.length * rowH + BUILD + FOOT;
    const g = this.add.graphics();
    drawFrame(g, px, py, pw, ph, won ? "gold" : "dark");
    const head = text(this, cx, py + 30, tr("PERIGO: {0}   ·   NÍVEL {1}", (difficulty?.name ?? "").toUpperCase(), level), { size: 18, color: CSS.muted, origin: 0.5 });
    // Pontos do ranking (só com os rankings do Play Games ligados): à direita da faixa, tocar abre o ranking
    if (Leaderboards.available() && score > 0) {
      const label = scoreRecord ? tr("RECORDE! {0} pontos", fmt(score)) : tr("{0} pontos", fmt(score));
      const probe = text(this, 0, 0, label, { size: 18 });
      const pw2 = Math.min(pw * 0.5, this.textures.get("ico_trophy").getSourceImage().width * 2 + 10 + probe.width + 34);
      probe.destroy();
      const open = () => !this._leaving && !this._modals?.length && openRanking(this, { board: "score", from: "fim", fresh: true });
      const pb = new Button(this, px + pw - 22 - pw2 / 2, py + 30, pw2, Math.min(56, Math.max(40, textPx(18) + 14)), label, open, {
        size: 18,
        style: scoreRecord ? "gold" : "dark",
        color: scoreRecord ? CSS.goldHi : CSS.txt,
        icon: "ico_trophy",
        iconScale: 2,
      });
      // a faixa "PERIGO · NÍVEL" vai para a esquerda e encolhe se precisar
      head.setOrigin(0, 0.5).setX(px + 26);
      fitTo(head, pw - 26 - pw2 - 40);
      pb.setAlpha(0);
      this.tweens.add({ targets: pb, alpha: 1, delay: 350 + stats.length * 250, duration: 260 });
      if (scoreRecord) this.tweens.add({ targets: pb, scale: { from: 1.15, to: 1 }, delay: 350 + stats.length * 250, duration: 320, ease: "Back.easeOut" });
    }
    const small = rowH < 44,
      tiny = rowH < 34;
    stats.forEach((s, i) => {
      const y = py + HEAD + rowH * (i + 0.5);
      this.add.image(px + 50, y, s.icon).setScale(tiny ? 2.2 : small ? 2.5 : 3);
      if (s.note && rowH >= 40) {
        // duas linhas: rótulo em cima, a conta embaixo (menor, apagada)
        text(this, px + 84, y - 10, s.label, { size: small ? 20 : 22, color: CSS.muted, origin: [0, 0.5] });
        this._coinNote = text(this, px + 84, y + 13, s.note, { size: 17, color: CSS.dim, origin: [0, 0.5] });
      } else if (s.note) this._coinNote = text(this, px + 84, y, s.note, { size: tiny ? 15 : 17, color: CSS.muted, origin: [0, 0.5] });
      else text(this, px + 84, y, s.label, { size: tiny ? 18 : small ? 20 : 22, color: CSS.muted, origin: [0, 0.5] });
      // a conta nunca invade o número da direita
      if (s.note && this._coinNote.width > pw - 84 - 170) this._coinNote.setScale((pw - 84 - 170) / this._coinNote.width);
      const v = text(this, px + pw - 36, y, s.fmt(0), { size: tiny ? 22 : small ? 26 : 30, color: s.color ?? CSS.txt, origin: [1, 0.5], stroke: true });
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

    // Build final (ícones), numa faixa própria abaixo dos números
    const wy = py + HEAD + stats.length * rowH + BUILD / 2 + 4;
    if (weapons.length) {
      const sep = this.add.graphics();
      sep.fillStyle(PAL.ink, 0.6).fillRect(px + 24, wy - BUILD / 2 - 2, pw - 48, 2);
    }
    weapons.forEach((w, i) => {
      const x = cx + (i - (weapons.length - 1) / 2) * 60;
      const sg = this.add.graphics();
      drawFrame(sg, x - 24, wy - 24, 48, 48, WEAPONS[w.key]?.evolvesFrom ? "purple" : "dark", { noRivets: true });
      this.add.image(x, wy, WEAPON_ICON[w.key] ?? "ico_staff").setScale(2.5);
    });

    // Desbloqueios
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
    if (adShown) {
      Analytics.track("ad_offer_show", { placement: "double_coins" });
      const db = new Button(this, cx, H - 134, 360, 54, tr("DOBRAR MOEDAS  +{0}", coinsDoubleable), async () => {
        if (db._used) return;
        db._used = true;
        db.setEnabled(false);
        const ok = await AdService.rewarded("double_coins");
        if (!ok) {
          db._used = false;
          db.setEnabled(true);
          return;
        }
        new MetaProgression().addCoins(coinsDoubleable);
        this._coinsShown = coinsDoubleable * 2;
        db.setLabel(tr("MOEDAS DOBRADAS!"));
        this._coinText?.setText(`+${this._coinsShown}`);
        if (this._coinNote && coinMathDoubled) {
          this._coinNote.setScale(1).setText(coinMathDoubled);
          const room = pw - 84 - 170;
          if (this._coinNote.width > room) this._coinNote.setScale(room / this._coinNote.width);
        }
        if (this._coinText) this.tweens.add({ targets: this._coinText, scale: { from: 1.5, to: 1 }, duration: 260, ease: "Back.easeOut" });
        this.sound.play("sfx_coin_cascade", { volume: 0.7 });
        haptic(30);
      }, { size: 22, style: "primary", color: CSS.goldHi, icon: AdService.icon, iconScale: 2.5 });
    }

    // Botões
    const by = H - 62;
    const again = new Button(this, cx - 170, by, 310, 66, tr("JOGAR DE NOVO"), () => this._go("GameScene"), { size: 26, style: "primary", color: CSS.goldHi });
    new Button(this, cx + 170, by, 310, 66, tr("CLAREIRA"), () => this._go("CampScene"), { size: 26 });
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
