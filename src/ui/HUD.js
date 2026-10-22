// HUD — pixel-art, pensado primeiro pro celular (paisagem):
//   topo: barra de XP de ponta a ponta + nível; HP/Despertar à esquerda;
//   cronômetro no centro; abates/moedas + pausa à direita; armas abaixo do HP.
//   baixo-direita (touch): botões redondos de Dash e Despertar com recarga.
// Tudo ancorado em vw(scene) (modo EXPAND: a largura varia).
import { GAME, PLAYER, WEAPONS, MAX_WEAPON_LEVEL, FEEL } from "../config.js";
import { formatTime } from "../utils.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { Pix } from "../art/PixelArt.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { vw, vh, text, setLabel, drawFrame, Bar, P, haptic } from "./Theme.js";
import { tr, dec } from "../i18n/i18n.js";
import { joyRight } from "./VirtualJoystick.js";

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
    this.W = vw(scene);
    this.H = vh(scene);
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const W = this.W;
    const fix = (o, d = 0) => o.setScrollFactor(0).setDepth(D + d);

    // ===== XP (topo, ponta a ponta) + selo de nível =====
    // A barra ENCHE: o XP que acabou de entrar aparece claro e assenta; quase cheia, um brilho corre (FEEL.XP_BAR)
    this.xpBar = new Bar(scene, 0, 0, W, 5 * P, PAL.g5, { depth: D, ghost: PAL.g6, gain: PAL.yel3, fillMs: FEEL.XP_BAR.FILL_MS, shine: FEEL.XP_BAR.NEAR_FULL });
    this.xpBar.set(0, true);
    const lvG = fix(scene.add.graphics(), 1);
    drawFrame(lvG, 10, 2, 28 * P, 11 * P, "gold");
    this.lvlText = fix(text(scene, 10 + 14 * P, 2 + 5.5 * P, tr("NV 1"), { size: 17, color: CSS.goldHi, origin: 0.5 }), 2);

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
    this.pauseBtn = this._iconButton(rx - 26, 52, "ico_pause", () => scene.pauseGame?.(), 3, true);
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
    this.killIcon = fix(scene.add.image(sx - 14, 70, "ico_skull").setScale(2.5).setOrigin(1, 0.5), 2);
    this.woodText = fix(text(scene, sx, 100, "0", { size: 22, color: "#ffc86b", origin: [1, 0.5], stroke: true }), 2).setVisible(false);
    this.woodIcon = fix(scene.add.image(sx - 14, 100, "ico_wood").setScale(2.5).setOrigin(1, 0.5), 2).setVisible(false);

    // ===== AÇÕES: botões de toque OU dicas de teclado =====
    if (this.isTouch) this._touchButtons();
    else {
      this.dashHint = fix(text(scene, W - 18, this.H - 22, "", { size: 16, origin: [1, 0.5], stroke: true, strokeW: 4 }), 2);
    }

    // ===== BOSS =====
    this.bossG = fix(scene.add.graphics(), 0).setVisible(false);
    // Faixa do topo central, de cima para baixo: relógio (44–86) → nome (92) → barra (116).
    // Antes o nome ficava com a base em 96 e encavalava no relógio.
    const bw = Math.min(620, W - 360);
    this.bossLabel = fix(text(scene, W / 2, 92, "", { size: 18, color: CSS.redHi, origin: [0.5, 0], stroke: true }), 2).setVisible(false);
    this.bossBar = new Bar(scene, W / 2 - bw / 2, 116, bw, 7 * P, PAL.red2, { depth: D + 1, segments: 2, ghost: PAL.cream });
    this.bossBar.setVisible(false);
    // Nome do golpe especial da vez, logo abaixo da barra (ensina e dá sabor)
    this.bossMoveT = fix(text(scene, W / 2, 142, "", { size: 16, color: hex(PAL.cream), origin: [0.5, 0], stroke: true, strokeW: 4 }), 2).setVisible(false);

    // ===== FAIXA DE ANÚNCIO (boss, fúria, eventos) =====
    this.banner = fix(scene.add.container(W / 2, this.H * 0.32), 10).setVisible(false);
    this.bannerG = scene.add.graphics();
    this.bannerT = text(scene, 0, 0, "", { size: 30, color: CSS.redHi, origin: 0.5, stroke: true, strokeW: 6 });
    this.banner.add([this.bannerG, this.bannerT]);
  }

  // nativeTouch: o toque dispara ao ENCOSTAR, por um listener nativo (como Dash e
  // Despertar). Com um dedo no joystick, o "soltar" do segundo dedo pode nunca chegar
  // ao Phaser (o navegador cancela o toque) — era assim que a pausa falhava andando.
  _iconButton(x, y, key, onTap, scale = 3, nativeTouch = false) {
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
    const native = (p) => nativeTouch && this.isTouch && p.wasTouch;
    zone.on("pointerdown", (p, lx, ly, ev) => {
      ev?.stopPropagation?.();
      if (native(p)) return;
      draw(true);
      ico.y = y + P / 2;
    });
    const up = () => {
      draw(false);
      ico.y = y;
    };
    zone.on("pointerout", up);
    zone.on("pointerup", (p) => {
      up();
      if (native(p)) return;
      haptic(10);
      onTap();
    });
    if (nativeTouch && this.isTouch) {
      const half = (size + 12) / 2;
      const onTouch = (e) => {
        if (!s.scene.isActive() || s.scene.isPaused()) return;
        for (const t of e.changedTouches) {
          const gx = s.scale.transformX(t.pageX),
            gy = s.scale.transformY(t.pageY);
          if (Math.abs(gx - x) > half || Math.abs(gy - y) > half) continue;
          draw(true);
          ico.y = y + P / 2;
          s.time.delayedCall(120, up); // se o toque pausou a cena, volta ao retomar
          haptic(10);
          onTap();
          return;
        }
      };
      window.addEventListener("touchstart", onTouch, { passive: true, capture: true });
      s.events.once("shutdown", () => window.removeEventListener("touchstart", onTouch, { capture: true }));
    }
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
      const btn = { base, cd, ico, lock, x, y, r };
      const up = () => {
        base.setScale(scale);
        ico.setScale(scale * 0.95);
      };
      btn.press = () => {
        base.setScale(scale * 0.92);
        ico.setScale(scale * 0.88);
        haptic(15);
        onTap();
        s.time.delayedCall(120, up);
      };
      // Toque: tratado no listener nativo abaixo. A zona fica só para o mouse.
      const zone = s.add.zone(x, y, r * 2.4, r * 2.4).setScrollFactor(0).setDepth(D + 5).setInteractive();
      zone.on("pointerdown", (p, lx, ly, ev) => {
        ev?.stopPropagation?.();
        if (!p.wasTouch) btn.press();
      });
      zone.on("pointerup", up);
      zone.on("pointerout", up);
      return btn;
    };
    const W = this.W,
      H = this.H;
    // Joystick à direita (canhoto, Opções → Controles): os botões vão para o canto esquerdo
    const fromRight = (d) => (joyRight() ? d : W - d);
    this.btnDash = mk(fromRight(92), H - 96, 3.4, "ico_dash", () => {
      this.scene.inputMgr.dashPressed = true;
    });
    this.btnAwaken = mk(fromRight(212), H - 70, 2.6, "ico_star", () => {
      this.scene.inputMgr.awakenPressed = true;
    });
    // Toque NATIVO nos botões: cada dedo novo é testado contra os botões, sem passar
    // pelo controle de ponteiros do Phaser (vagas limitadas que podiam ficar presas
    // com um dedo no joystick) — dash ANDANDO funciona sempre.
    const btns = [this.btnDash, this.btnAwaken];
    this._onTouch = (e) => {
      if (!s.scene.isActive() || s.scene.isPaused()) return;
      for (const t of e.changedTouches) {
        const gx = s.scale.transformX(t.pageX),
          gy = s.scale.transformY(t.pageY);
        const b = btns.find((b) => (gx - b.x) ** 2 + (gy - b.y) ** 2 <= (b.r * 1.25) ** 2);
        if (b) b.press();
      }
    };
    window.addEventListener("touchstart", this._onTouch, { passive: true, capture: true });
    s.events.once("shutdown", () => window.removeEventListener("touchstart", this._onTouch, { capture: true }));
  }

  // Fatia de recarga sobre o botão redondo (0 = pronto, 1 = recém-usado)
  _cooldown(btn, frac, readyGlow, time) {
    const g = btn.cd;
    // Pronto e sem brilho (o comum): nada muda de um quadro para o outro
    const idle = frac <= 0.001 && !readyGlow;
    if (idle && btn._idle) return;
    btn._idle = idle;
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
  addWood(n = 1) {
    this.wood = (this.wood || 0) + n;
    this.woodText.setText(String(this.wood)).setVisible(true);
    this.woodIcon.setVisible(true);
    this.woodIcon.x = this.woodText.x - this.woodText.width - 8;
    this.scene.tweens.add({ targets: this.woodIcon, scale: { from: 3.6, to: 2.5 }, duration: 200 });
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

  // Barra de chefe no topo — serve pro Mapinguari e pros mini-chefes (name)
  setBossActive(boss, name = tr("MAPINGUARI")) {
    this.boss = boss;
    this.bossName = name;
    this.bossBar.setVisible(true);
    this.bossBar.set(1, true);
    this.bossBar.setColor(boss.miniBoss ? PAL.org2 : PAL.red2);
    this.bossLabel.setVisible(true).setText(name);
  }

  // Onde termina a faixa reservada do HUD no topo (dicas e setas ficam abaixo)
  get topBand() {
    return this.bossBar.visible ? 166 : 100;
  }

  clearBoss() {
    this.boss = null;
    this.bossBar.setVisible(false);
    this.bossLabel.setVisible(false);
    this.bossMoveT.setVisible(false);
  }

  // Golpe especial anunciado: entra de cima, fica um instante e some
  bossMove(name) {
    if (!this.bossBar.visible) return;
    const t = this.bossMoveT;
    this.scene.tweens.killTweensOf(t);
    t.setText(`« ${name} »`).setVisible(true).setAlpha(0);
    t.y = 134;
    this.scene.tweens.add({ targets: t, alpha: 1, y: 142, duration: 160, ease: "Cubic.easeOut" });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1700, duration: 400 });
  }

  // Slots de arma: moldura + ícone + pips de nível (★ dourado se evoluída)
  refreshWeapons() {
    const s = this.scene;
    this.weaponPanel.removeAll(true);
    const size = 14 * P;
    this._slots = {};
    this.player.weapons.forEach((w, i) => {
      const def = WEAPONS[w.key];
      const evolved = !!def?.evolvesFrom;
      const x = i * (size + 6);
      const g = s.add.graphics();
      drawFrame(g, x, 0, size, size, evolved ? "purple" : "dark", { alpha: 0.9 });
      const ico = s.add.image(x + size / 2, size / 2 - 2, WEAPON_ICON[w.key] ?? "ico_staff").setScale(2.5);
      this._slots[w.key] = { ico, x, size };
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

  // Subiu de nível (a cena vai pausar para as cartas): a barra fica CHEIA e dourada, com o nível novo no selo —
  // é o que se vê atrás da mesa escurecida
  levelFull() {
    this.xpBar.full = PAL.yel2;
    this.xpBar.set(1, true);
    this.lvlText.setText(tr("NV {0}", this.player.level));
    this._leveled = true;
  }

  // A partida voltou depois das cartas: a barra dourada escorre até o XP que sobrou e o selo do nível pula
  levelSettle() {
    if (!this._leveled) return;
    this._leveled = false;
    const b = this.xpBar;
    b.full = null;
    b.ghost = 1;
    b.ghostColor = PAL.yel2;
    b.ghostRate = 1 / FEEL.XP_BAR.LEVEL_DRAIN_MS;
    const p = this.player;
    b.set(p.xp / PLAYER.XP_PER_LEVEL(p.level), false);
    b.lag = b.value; // o resto que sobrou não "entra" de novo
    this.scene.time.delayedCall(FEEL.XP_BAR.LEVEL_DRAIN_MS + 60, () => {
      b.ghostColor = PAL.g6;
      b.ghostRate = 0.0006;
    });
    const t = this.lvlText;
    this.scene.tweens.killTweensOf(t);
    t.setScale(1.7);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 420, ease: "Back.easeOut" });
  }

  // Evolução: o espaço da arma na HUD pulsa (ícone grande que assenta + moldura acesa que apaga)
  popWeapon(key) {
    const sl = this._slots?.[key];
    if (!sl) return;
    const s = this.scene;
    s.tweens.killTweensOf(sl.ico);
    sl.ico.setScale(2.5 * FEEL.EVOLVE.HUD_POP);
    s.tweens.add({ targets: sl.ico, scale: 2.5, duration: 520, ease: "Back.easeOut" });
    // moldura acesa ATRÁS do ícone (o ícone pulando continua à vista) que apaga depressa
    const g = s.add.graphics();
    drawFrame(g, sl.x - P, -P, sl.size + 2 * P, sl.size + 2 * P, { border: PAL.white, body: PAL.pur2, hi: PAL.pur3, lo: PAL.pur1 }, { noRivets: true });
    this.weaponPanel.add(g);
    this.weaponPanel.bringToTop(sl.ico);
    g.setAlpha(0.95);
    s.tweens.add({ targets: g, alpha: 0, duration: 380, ease: "Cubic.easeOut", onComplete: () => g.destroy() });
  }

  // Vida na tela agora. instant: sem a "sombra" do dano drenando (a cena vai pausar —
  // ex.: golpe fatal abre a oferta de reviver no mesmo quadro, antes do update da HUD)
  syncHp(instant = false) {
    const p = this.player;
    this.hpBar.set(p.hp / p.maxHp, instant);
    this.hpText.setText(`${Math.max(0, Math.ceil(p.hp))}/${Math.ceil(p.maxHp)}`);
  }

  update(time, dt) {
    this.elapsedMs += dt;
    const p = this.player;

    this.syncHp();
    this.hpBar.tick(dt);

    const need = PLAYER.XP_PER_LEVEL(p.level);
    this.xpBar.set(p.xp / need);
    this.xpBar.tick(dt);
    this.lvlText.setText(tr("NV {0}", p.level));
    this.elapsedMs = this.scene.elapsedMs ?? this.elapsedMs; // relógio único: o da cena
    this.timerText.setText(formatTime(this.elapsedMs));
    // Números alinhados à direita crescem para a esquerda: o ícone anda junto
    // (antes ficava parado e o número "entrava" nele a partir de 2 dígitos)
    if (this._shownKills !== this.kills) {
      this._shownKills = this.kills;
      this.killText.setText(String(this.kills));
      this.killIcon.x = this.killText.x - this.killText.width - 8;
    }
    if (this._shownCoins !== this.coins) {
      this._shownCoins = this.coins;
      this.coinText.setText(String(this.coins));
      this.coinIcon.x = this.coinText.x - this.coinText.width - 8;
    }

    if (this.boss && this.boss.miniBoss) {
      // Mini-chefe: barra simples; some quando ele morre
      if (!this.boss.active || this.boss.miniBoss !== this.bossName) this.clearBoss();
      else {
        this.bossBar.set(Math.max(0, this.boss.hp / this.boss.maxHp));
        this.bossBar.tick(dt);
      }
    } else if (this.boss && (this.boss.active || this.boss._emerging)) {
      const frac = Math.max(0, this.boss.hp / this.boss.maxHp);
      // Duas barras (fases): Fase 1 = 100%→50%, Fase 2 = 50%→0%. Na virada
      // (êxtase) e enquanto ele sobe da poça (chegada) a barra enche animada pelo boss (_displayFill).
      const phase2 = this.boss.phase === 2;
      const anim = this.boss._transitioning || this.boss._emerging;
      let shown;
      if (anim) shown = this.boss._displayFill ?? 0;
      else shown = phase2 ? frac / 0.5 : (frac - 0.5) / 0.5;
      this.bossBar.setColor(phase2 ? PAL.org2 : PAL.red2);
      this.bossBar.set(shown, anim);
      this.bossBar.tick(dt);
      this.bossLabel.setText(phase2 ? tr("{0} · FÚRIA", this.bossName) : this.bossName);
    }

    // Despertar
    const now = this.scene.time.now;
    let awFrac = 1,
      awReady = false;
    if (!p.awakenUnlocked) {
      this.awBar.set(0, true);
      setLabel(this.awHint, tr("bloqueado"), CSS.dim);
      this.awIcon.setTint(0x555555);
    } else {
      this.awIcon.clearTint();
      const aw = p.awakenMeter / p.awakenMax;
      awFrac = 1 - aw;
      if (p.isAwakened()) {
        const remain = Math.max(0, p.awakenedUntil - now);
        this.awBar.setColor(PAL.yel3);
        this.awBar.set(remain / PLAYER.AWAKEN_DURATION_MS, true);
        setLabel(this.awHint, `${(remain / 1000).toFixed(1)}s`, CSS.goldHi);
        awFrac = 0;
      } else if (p.awakenReady()) {
        this.awBar.setColor(PAL.yel3);
        this.awBar.set(1);
        setLabel(this.awHint, this.isTouch ? tr("PRONTO!") : tr("PRONTO! [R]"), CSS.goldHi);
        this.awHint.setAlpha(0.6 + Math.sin(time / 120) * 0.4);
        awReady = true;
        this.scene._hint?.("awaken", this.isTouch ? tr("Despertar pronto! Toque na estrela\npara disparar tudo mais rápido.") : tr("Despertar pronto! Aperte R\npara disparar tudo mais rápido."));
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
      if (!p.dashUnlocked) setLabel(this.dashHint, "", CSS.dim);
      else if (p.dashReady()) setLabel(this.dashHint, tr("DASH [SHIFT]"), CSS.goldHi);
      else setLabel(this.dashHint, tr("DASH {0}s", dec(Math.max(0, p.dashCdUntil - now) / 1000)), CSS.muted);
    }
  }
}
