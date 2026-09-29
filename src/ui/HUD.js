// HUD — pixel-art, pensado primeiro pro celular (paisagem):
//   topo: barra de XP de ponta a ponta + nível; HP/Despertar à esquerda;
//   cronômetro no centro; abates/moedas + pausa à direita; armas abaixo do HP.
//   baixo-direita (touch): botões redondos de Dash e Despertar com recarga.
// Tudo ancorado em scene.scale.width (modo EXPAND: a largura varia).
import { GAME, PLAYER, WEAPONS, MAX_WEAPON_LEVEL } from "../config.js";
import { formatTime } from "../utils.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { Pix } from "../art/PixelArt.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { text, drawFrame, Bar, P, haptic } from "./Theme.js";

const D = 50000; // profundidade base do HUD (acima do mundo e da vinheta)

// Botão redondo pixelado (gerado 1x): contorno, aro dourado, corpo escuro
function ensureRoundButton(scene) {
  if (scene.textures.exists("ui_round")) return;
  const N = 26;
  const p = new Pix(N, N);
  p.disc(N / 2, N / 2, N / 2 - 1, PAL.uiGold);
  p.disc(N / 2, N / 2, N / 2 - 3, PAL.uiPanel);
  p.disc(N / 2, N / 2 - 1, N / 2 - 4, PAL.uiPanel2);
  p.disc(N / 2, N / 2 + 0.5, N / 2 - 4.5, PAL.uiPanel);
  p.outline(PAL.ink);
  p.register(scene, "ui_round");
}

export class HUD {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.elapsedMs = 0;
    this.kills = 0;
    this.coins = 0;
    this.W = scene.scale.width;
    this.H = scene.scale.height;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const W = this.W;
    const fix = (o, d = 0) => o.setScrollFactor(0).setDepth(D + d);

    // ===== XP (topo, ponta a ponta) + selo de nível =====
    this.xpBar = new Bar(scene, 0, 0, W, 5 * P, PAL.g5, { depth: D, ghost: PAL.g6 });
    this.xpBar.set(0, true);
    const lvG = fix(scene.add.graphics(), 1);
    drawFrame(lvG, 10, 2, 28 * P, 11 * P, "gold");
    this.lvlText = fix(text(scene, 10 + 14 * P, 2 + 5.5 * P, "NV 1", { size: 17, color: CSS.goldHi, origin: 0.5 }), 2);

    // ===== HP =====
    const hx = 16,
      hy = 48;
    fix(scene.add.image(hx + 16, hy + 12, "ico_heart").setScale(P), 2);
    this.hpBar = new Bar(scene, hx + 38, hy, 88 * P, 8 * P, PAL.red2, { depth: D, ghost: PAL.cream });
    this.hpText = fix(text(scene, hx + 38 + 44 * P, hy + 11, "", { size: 16, origin: 0.5, stroke: true, strokeW: 4, shadow: false }), 2);

    // ===== DESPERTAR =====
    const ay = hy + 32;
    this.awIcon = fix(scene.add.image(hx + 16, ay + 9, "ico_star").setScale(2), 2);
    this.awBar = new Bar(scene, hx + 38, ay, 64 * P, 6 * P, PAL.yel2, { depth: D, ghost: PAL.yel3 });
    this.awBar.set(0, true);
    this.awHint = fix(text(scene, hx + 38 + 64 * P + 10, ay + 9, "", { size: 14, color: CSS.muted, origin: [0, 0.5] }), 2);

    // ===== ARMAS (slots abaixo das barras) =====
    this.weaponPanel = fix(scene.add.container(hx, ay + 30), 1);

    // ===== CRONÔMETRO =====
    this.timerText = fix(text(scene, W / 2, 44, "00:00", { size: 38, origin: [0.5, 0], stroke: true, strokeW: 6 }), 2);

    // ===== DIREITA: abates / moedas / pausa =====
    const rx = W - 16;
    this.pauseBtn = this._iconButton(rx - 26, 52, "ico_pause", () => scene.pauseGame?.());
    let sx = rx - 70;
    // Tela cheia só no navegador (no app Android já é tela cheia)
    if (!window.Capacitor?.isNativePlatform?.()) {
      this.fsBtn = this._iconButton(rx - 84, 52, "ico_fullscreen", () => {
        if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
        else scene.scale.startFullscreen();
      }, 2);
      sx -= 58;
    }
    this.coinText = fix(text(scene, sx, 40, "0", { size: 22, color: CSS.goldHi, origin: [1, 0.5], stroke: true }), 2);
    this.coinIcon = fix(scene.add.image(sx - 14, 40, "ico_coin").setScale(2.5).setOrigin(1, 0.5), 2);
    this.killText = fix(text(scene, sx, 70, "0", { size: 22, origin: [1, 0.5], stroke: true }), 2);
    fix(scene.add.image(sx - 14, 70, "ico_skull").setScale(2.5).setOrigin(1, 0.5), 2);

    // ===== AÇÕES: botões de toque OU dicas de teclado =====
    if (this.isTouch) this._touchButtons();
    else {
      this.dashHint = fix(text(scene, W - 18, this.H - 22, "", { size: 16, origin: [1, 0.5], stroke: true, strokeW: 4 }), 2);
    }

    // ===== BOSS =====
    this.bossG = fix(scene.add.graphics(), 0).setVisible(false);
    const bw = Math.min(620, W - 360);
    this.bossBar = new Bar(scene, W / 2 - bw / 2, 104, bw, 8 * P, PAL.red2, { depth: D + 1, segments: 2, ghost: PAL.cream });
    this.bossBar.setVisible(false);
    this.bossLabel = fix(text(scene, W / 2, 96, "", { size: 18, color: CSS.redHi, origin: [0.5, 1], stroke: true }), 2).setVisible(false);

    // ===== FAIXA DE ANÚNCIO (boss, fúria, eventos) =====
    this.banner = fix(scene.add.container(W / 2, this.H * 0.32), 10).setVisible(false);
    this.bannerG = scene.add.graphics();
    this.bannerT = text(scene, 0, 0, "", { size: 30, color: CSS.redHi, origin: 0.5, stroke: true, strokeW: 6 });
    this.banner.add([this.bannerG, this.bannerT]);
  }

  _iconButton(x, y, key, onTap, scale = 3) {
    const s = this.scene;
    const size = 16 * P;
    const g = s.add.graphics().setScrollFactor(0).setDepth(D + 1);
    const draw = (down) => {
      g.clear();
      drawFrame(g, x - size / 2, y - size / 2 + (down ? P : 0), size, size - (down ? P : 0), "dark", { flat: down });
    };
    draw(false);
    const ico = s.add.image(x, y, key).setScale(scale).setScrollFactor(0).setDepth(D + 2);
    const zone = s.add.zone(x, y, size + 12, size + 12).setScrollFactor(0).setDepth(D + 3).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", (p, lx, ly, ev) => {
      ev?.stopPropagation?.();
      draw(true);
      ico.y = y + P / 2;
    });
    const up = () => {
      draw(false);
      ico.y = y;
    };
    zone.on("pointerout", up);
    zone.on("pointerup", () => {
      up();
      haptic(10);
      onTap();
    });
    return { g, ico, zone };
  }

  // Botões redondos de ação (touch): Dash (grande) e Despertar
  _touchButtons() {
    const s = this.scene;
    ensureRoundButton(s);
    const mk = (x, y, scale, iconKey, onTap) => {
      const base = s.add.image(x, y, "ui_round").setScale(scale).setScrollFactor(0).setDepth(D + 1).setAlpha(0.92);
      const cd = s.add.graphics().setScrollFactor(0).setDepth(D + 2);
      const ico = s.add.image(x, y, iconKey).setScale(scale * 0.95).setScrollFactor(0).setDepth(D + 3);
      const lock = s.add.image(x + 9 * scale, y + 9 * scale, "ico_lock").setScale(2).setScrollFactor(0).setDepth(D + 4).setVisible(false);
      const r = 13 * scale;
      const zone = s.add.zone(x, y, r * 2.4, r * 2.4).setScrollFactor(0).setDepth(D + 5).setInteractive();
      zone.on("pointerdown", (p, lx, ly, ev) => {
        ev?.stopPropagation?.();
        base.setScale(scale * 0.92);
        ico.setScale(scale * 0.88);
        haptic(15);
        onTap();
      });
      const up = () => {
        base.setScale(scale);
        ico.setScale(scale * 0.95);
      };
      zone.on("pointerup", up);
      zone.on("pointerout", up);
      return { base, cd, ico, lock, x, y, r };
    };
    const W = this.W,
      H = this.H;
    this.btnDash = mk(W - 92, H - 96, 3.4, "ico_dash", () => {
      this.scene.inputMgr.dashPressed = true;
    });
    this.btnAwaken = mk(W - 212, H - 70, 2.6, "ico_star", () => {
      this.scene.inputMgr.awakenPressed = true;
    });
  }

  // Fatia de recarga sobre o botão redondo (0 = pronto, 1 = recém-usado)
  _cooldown(btn, frac, readyGlow, time) {
    const g = btn.cd;
    g.clear();
    if (frac > 0.001) {
      g.fillStyle(PAL.ink, 0.6);
      g.slice(btn.x, btn.y, btn.r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      g.fillPath();
      btn.ico.setAlpha(0.55);
    } else {
      btn.ico.setAlpha(1);
      if (readyGlow) {
        g.lineStyle(4, PAL.yel3, 0.5 + Math.sin(time / 120) * 0.4);
        g.strokeCircle(btn.x, btn.y, btn.r + 4);
      }
    }
  }

  addKill() {
    this.kills += 1;
  }
  addCoin(n = 1) {
    this.coins += n;
    this.scene.tweens.add({ targets: this.coinIcon, scale: { from: 3.4, to: 2.5 }, duration: 160 });
  }

  // Faixa central com moldura (anúncios)
  showBossBanner(str, color = CSS.redHi) {
    this.bannerT.setText(str).setColor(color);
    const w = this.bannerT.width + 60,
      h = 64;
    this.bannerG.clear();
    drawFrame(this.bannerG, -w / 2, -h / 2, w, h, "danger", { alpha: 0.9 });
    this.banner.setVisible(true).setAlpha(0).setScale(0.6);
    this.scene.tweens.killTweensOf(this.banner);
    this.scene.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 220, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => this.banner.setVisible(false),
    });
  }

  setBossActive(boss) {
    this.boss = boss;
    this.bossBar.setVisible(true);
    this.bossBar.set(1, true);
    this.bossLabel.setVisible(true).setText("O ANCIÃO");
  }

  clearBoss() {
    this.boss = null;
    this.bossBar.setVisible(false);
    this.bossLabel.setVisible(false);
  }

  // Slots de arma: moldura + ícone + pips de nível (★ dourado se evoluída)
  refreshWeapons() {
    const s = this.scene;
    this.weaponPanel.removeAll(true);
    const size = 14 * P;
    this.player.weapons.forEach((w, i) => {
      const def = WEAPONS[w.key];
      const evolved = !!def?.evolvesFrom;
      const x = i * (size + 6);
      const g = s.add.graphics();
      drawFrame(g, x, 0, size, size, evolved ? "purple" : "dark", { alpha: 0.9 });
      const ico = s.add.image(x + size / 2, size / 2 - 2, WEAPON_ICON[w.key] ?? "ico_staff").setScale(2.5);
      this.weaponPanel.add([g, ico]);
      if (evolved) {
        this.weaponPanel.add(s.add.image(x + size - 8, 8, "ico_star").setScale(1.2));
      } else {
        // Pips de nível embaixo do slot
        for (let l = 0; l < MAX_WEAPON_LEVEL; l++) {
          const pip = s.add.rectangle(x + 5 + l * 8, size + 5, 6, 6, l < w.level ? PAL.yel2 : PAL.inkSoft).setStrokeStyle(1, PAL.ink);
          this.weaponPanel.add(pip);
        }
      }
    });
  }

  update(time, dt) {
    this.elapsedMs += dt;
    const p = this.player;

    this.hpBar.set(p.hp / p.maxHp);
    this.hpBar.tick(dt);
    this.hpText.setText(`${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)}`);

    const need = PLAYER.XP_PER_LEVEL(p.level);
    this.xpBar.set(p.xp / need);
    this.xpBar.tick(dt);
    this.lvlText.setText(`NV ${p.level}`);
    this.timerText.setText(formatTime(this.elapsedMs));
    this.killText.setText(String(this.kills));
    this.coinText.setText(String(this.coins));

    if (this.boss && this.boss.active) {
      const frac = Math.max(0, this.boss.hp / this.boss.maxHp);
      // Duas barras (fases): Fase 1 = 100%→50%, Fase 2 = 50%→0%. Na virada
      // (êxtase) a barra recarrega animada pelo boss (_displayFill).
      const phase2 = this.boss.phase === 2;
      let shown;
      if (this.boss._transitioning) shown = this.boss._displayFill ?? 0;
      else shown = phase2 ? frac / 0.5 : (frac - 0.5) / 0.5;
      this.bossBar.setColor(phase2 ? PAL.org2 : PAL.red2);
      this.bossBar.set(shown, this.boss._transitioning);
      this.bossBar.tick(dt);
      this.bossLabel.setText(phase2 ? "O ANCIÃO · FÚRIA" : "O ANCIÃO");
    }

    // Despertar
    const now = this.scene.time.now;
    let awFrac = 1,
      awReady = false;
    if (!p.awakenUnlocked) {
      this.awBar.set(0, true);
      this.awHint.setText("bloqueado").setColor(CSS.dim);
      this.awIcon.setTint(0x555555);
    } else {
      this.awIcon.clearTint();
      const aw = p.awakenMeter / p.awakenMax;
      awFrac = 1 - aw;
      if (p.isAwakened()) {
        const remain = Math.max(0, p.awakenedUntil - now);
        this.awBar.setColor(PAL.yel3);
        this.awBar.set(remain / PLAYER.AWAKEN_DURATION_MS, true);
        this.awHint.setText(`${(remain / 1000).toFixed(1)}s`).setColor(CSS.goldHi);
        awFrac = 0;
      } else if (p.awakenReady()) {
        this.awBar.setColor(PAL.yel3);
        this.awBar.set(1);
        this.awHint.setText(this.isTouch ? "PRONTO!" : "PRONTO! [R]").setColor(CSS.goldHi);
        this.awHint.setAlpha(0.6 + Math.sin(time / 120) * 0.4);
        awReady = true;
        this.scene._hint?.("awaken", this.isTouch ? "Despertar pronto! Toque na estrela\npara disparar tudo mais rápido." : "Despertar pronto! Aperte R\npara disparar tudo mais rápido.");
      } else {
        this.awBar.setColor(now < p.awakenLockUntil ? PAL.yel1 : PAL.yel2);
        this.awBar.set(aw);
        this.awHint.setText("").setAlpha(1);
      }
    }

    // Dash
    const dashFrac = !p.dashUnlocked ? 1 : p.dashReady() ? 0 : Math.max(0, p.dashCdUntil - now) / (PLAYER.DASH_CD_MS * (p._dashCdMult ?? 1));

    if (this.btnDash) {
      this.btnDash.lock.setVisible(!p.dashUnlocked);
      this._cooldown(this.btnDash, dashFrac, false, time);
      this.btnAwaken.lock.setVisible(!p.awakenUnlocked);
      this._cooldown(this.btnAwaken, p.awakenUnlocked ? awFrac : 1, awReady, time);
    } else if (this.dashHint) {
      if (!p.dashUnlocked) this.dashHint.setText("").setColor(CSS.dim);
      else if (p.dashReady()) this.dashHint.setText("DASH [SHIFT]").setColor(CSS.goldHi);
      else this.dashHint.setText(`DASH ${(Math.max(0, p.dashCdUntil - now) / 1000).toFixed(1)}s`).setColor(CSS.muted);
    }
  }
}
