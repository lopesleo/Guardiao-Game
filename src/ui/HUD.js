// HUD: fonte system-ui (sempre legível) + tamanhos grandes pra projetor.
import { COLORS, GAME, PLAYER, WEAPONS } from '../config.js';
import { formatTime } from '../utils.js';

const D_BG     = 50000;
const D_FILL   = 50001;
const D_TEXT   = 50002;
const D_BOSS   = 50500;
const D_BOSS_T = 50501;

// system-ui = fonte nativa do OS (sempre carrega, sempre nítida em projetor)
const F  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FB = `bold ${F}`;
const FP = '"Press Start 2P", monospace'; // reservado pra timer dramatico

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class HUD {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.elapsedMs = 0;
    this.kills = 0;
    this.coins = 0;

    const W = GAME.WIDTH, H = GAME.HEIGHT;

    // ===== PAINEL ESQUERDO: HP + DESPERTAR + LV =====
    const PX = 18, PY = 18, PW = 340, PH = 116;
    scene.add.rectangle(PX, PY, PW, PH, 0x0a1410, 0.85)
         .setOrigin(0, 0).setStrokeStyle(3, 0xd9b25c, 0.85)
         .setScrollFactor(0).setDepth(D_BG);

    // HP linha
    sharp(scene, PX + 16, PY + 14, '♥', {
      fontFamily: F, fontSize: '22px', color: '#ff5a6e',
    }).setScrollFactor(0).setDepth(D_TEXT);
    sharp(scene, PX + 44, PY + 16, 'HP', {
      fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#ff8898',
    }).setScrollFactor(0).setDepth(D_TEXT);
    this.hpBg   = scene.add.rectangle(PX + 80, PY + 18, PW - 100, 22, 0x000000, 0.7)
                       .setOrigin(0, 0).setStrokeStyle(1, 0x000000, 0.5)
                       .setScrollFactor(0).setDepth(D_FILL);
    this.hpFill = scene.add.rectangle(PX + 82, PY + 20, PW - 104, 18, 0xff3a55)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL + 1);
    this.hpText = sharp(scene, PX + 80 + (PW - 100) / 2, PY + 17, '', {
      fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D_TEXT + 1);

    // DESPERTAR linha
    sharp(scene, PX + 16, PY + 46, '★', {
      fontFamily: F, fontSize: '22px', color: '#ffd96b',
    }).setScrollFactor(0).setDepth(D_TEXT);
    sharp(scene, PX + 44, PY + 48, 'DESPERTAR', {
      fontFamily: F, fontSize: '12px', fontStyle: 'bold', color: '#ffd96b',
    }).setScrollFactor(0).setDepth(D_TEXT);
    this.awBg   = scene.add.rectangle(PX + 16, PY + 70, PW - 36, 16, 0x000000, 0.7)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL);
    this.awFill = scene.add.rectangle(PX + 18, PY + 72, 0, 12, 0xd9b25c)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL + 1);
    this.awHint = sharp(scene, PX + PW - 20, PY + 48, '', {
      fontFamily: F, fontSize: '11px', fontStyle: 'bold', color: '#93a89a',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT);

    // LV
    sharp(scene, PX + 16, PY + 92, 'NÍVEL', {
      fontFamily: F, fontSize: '11px', color: '#93a89a',
    }).setScrollFactor(0).setDepth(D_TEXT);
    this.lvlText = sharp(scene, PX + 70, PY + 90, '1', {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#ffd96b',
    }).setScrollFactor(0).setDepth(D_TEXT);

    // ===== TIMER GIGANTE CENTRO TOPO =====
    this.timerText = sharp(scene, W / 2, 24, '00:00', {
      fontFamily: F, fontSize: '36px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D_TEXT);

    // ===== PAINEL DIREITO: KILLS + COINS =====
    const RX = W - 18, RY = 18, RW = 200, RH = 80;
    scene.add.rectangle(RX, RY, RW, RH, 0x0a1410, 0.85)
         .setOrigin(1, 0).setStrokeStyle(3, 0xd9b25c, 0.85)
         .setScrollFactor(0).setDepth(D_BG);
    sharp(scene, RX - RW + 14, RY + 12, '⚔', {
      fontFamily: F, fontSize: '20px', color: '#e8f0e6',
    }).setScrollFactor(0).setDepth(D_TEXT);
    sharp(scene, RX - RW + 44, RY + 14, 'ABATES', {
      fontFamily: F, fontSize: '11px', color: '#93a89a',
    }).setScrollFactor(0).setDepth(D_TEXT);
    this.killText = sharp(scene, RX - 14, RY + 14, '0', {
      fontFamily: F, fontSize: '20px', fontStyle: 'bold', color: '#e8f0e6',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT);

    sharp(scene, RX - RW + 14, RY + 46, '💰', {
      fontFamily: F, fontSize: '20px',
    }).setScrollFactor(0).setDepth(D_TEXT);
    sharp(scene, RX - RW + 44, RY + 48, 'MOEDAS', {
      fontFamily: F, fontSize: '11px', color: '#93a89a',
    }).setScrollFactor(0).setDepth(D_TEXT);
    this.coinText = sharp(scene, RX - 14, RY + 48, '0', {
      fontFamily: F, fontSize: '20px', fontStyle: 'bold', color: '#d9b25c',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT);

    // ===== BOTÃO FULLSCREEN (PC + mobile) =====
    this.fsBtn = sharp(scene, RX, RY + RH + 8, '⛶', {
      fontFamily: F, fontSize: '20px', fontStyle: 'bold', color: '#d9b25c',
      backgroundColor: '#0a1410', padding: { x: 10, y: 6 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT).setInteractive({ useHandCursor: true });
    this.fsBtn.on('pointerup', () => {
      if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
      else scene.scale.startFullscreen();
    });

    // ===== BOTÃO PAUSE (toque/clique — no mobile não há ESC) =====
    this.pauseBtn = sharp(scene, RX, RY + RH + 48, '⏸', {
      fontFamily: F, fontSize: '20px', fontStyle: 'bold', color: '#d9b25c',
      backgroundColor: '#0a1410', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerup', () => scene.pauseGame?.());

    // ===== XP BAR FINA NO TOPO ABSOLUTO =====
    this.xpBg   = scene.add.rectangle(0, 0, W, 6, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(D_BG);
    this.xpFill = scene.add.rectangle(0, 0, 0, 6, COLORS.XP)   .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL);

    // ===== ARMAS — inferior esquerdo, ícone + nível =====
    this.weaponPanel = scene.add.container(18, H - 50).setScrollFactor(0).setDepth(D_TEXT);

    // ===== DASH — inferior direito =====
    this.dashIcon = sharp(scene, W - 18, H - 30, '⚡ DASH', {
      fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#ffd96b',
      backgroundColor: '#0a1410', padding: { x: 14, y: 8 },
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D_TEXT);

    // ===== BOTÕES TOUCH (mobile): Interagir / Despertar / Dash =====
    // No celular não há teclado — estes botões acionam as mesmas flags do InputManager.
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      const mkBtn = (x, label, color, onTap) => {
        const c = scene.add.circle(x, H - 100, 36, 0x0a1410, 0.85)
          .setStrokeStyle(3, color, 0.9).setScrollFactor(0).setDepth(D_TEXT)
          .setInteractive({ useHandCursor: true });
        sharp(scene, x, H - 100, label, {
          fontFamily: F, fontSize: '24px', fontStyle: 'bold', color: '#e8f0e6',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(D_TEXT + 1);
        const reset = () => c.setFillStyle(0x0a1410, 0.85);
        c.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); onTap(); c.setFillStyle(color, 0.5); });
        c.on('pointerup', reset);
        c.on('pointerout', reset);
      };
      mkBtn(W - 74,  '⚡', 0xffd96b, () => { scene.inputMgr.dashPressed = true; });
      mkBtn(W - 162, '★', 0xffe88a, () => { scene.inputMgr.awakenPressed = true; });
      mkBtn(W - 250, '📦', 0xd9b25c, () => { scene.inputMgr.interactPressed = true; });
    }

    // ===== BOSS UI =====
    this.bossBanner = sharp(scene, W / 2, 84, '', {
      fontFamily: F, fontSize: '28px', fontStyle: 'bold', color: '#ff5a6e',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D_BOSS).setVisible(false);
    this.bossHpBg   = scene.add.rectangle(W / 2, 130, 720, 26, 0x000000, 0.85)
                          .setStrokeStyle(2, 0xd9b25c, 0.8)
                          .setScrollFactor(0).setDepth(D_BOSS).setVisible(false);
    this.bossHpFill = scene.add.rectangle(W / 2 - 358, 130, 0, 20, 0xff3a55)
                          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D_BOSS_T).setVisible(false);
    this.bossLabel  = sharp(scene, W / 2, 130, '', {
      fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D_BOSS_T + 1).setVisible(false);
  }

  addKill()      { this.kills += 1; }
  addCoin(n = 1) { this.coins += n; }

  showBossBanner(text) {
    this.bossBanner.setText(text).setVisible(true);
    this.scene.tweens.add({
      targets: this.bossBanner,
      alpha: { from: 0, to: 1 },
      yoyo: true, repeat: 3, duration: 400,
      onComplete: () => this.bossBanner.setVisible(false),
    });
  }

  setBossActive(boss) {
    this.boss = boss;
    [this.bossHpBg, this.bossHpFill, this.bossLabel].forEach(o => o.setVisible(true));
    this.bossLabel.setText('O ANCIÃO');
  }

  clearBoss() {
    this.boss = null;
    [this.bossHpBg, this.bossHpFill, this.bossLabel].forEach(o => o.setVisible(false));
  }

  refreshWeapons() {
    this.weaponPanel.removeAll(true);
    const icons = { fire: '🔥', ice: '❄️', bolt: '⚡' };
    let x = 0;
    for (const w of this.player.weapons) {
      const def = WEAPONS[w.key];
      const icon = icons[def?.element] || '✨';
      // Evoluída = ★ dourado no lugar do nível
      const evolved = !!def?.evolvesFrom;
      const txt = sharp(this.scene, x, 0, evolved ? `${icon}★ MAX` : `${icon}  Lv${w.level}`, {
        fontFamily: F, fontSize: '14px', fontStyle: 'bold',
        color: evolved ? '#ffd96b' : '#e8f0e6',
        backgroundColor: '#0a1410', padding: { x: 10, y: 6 },
      });
      this.weaponPanel.add(txt);
      x += txt.width + 8;
    }
  }

  update(time, dt) {
    this.elapsedMs += dt;
    const PW = 340;

    const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
    this.hpFill.width = (PW - 104) * hpPct;
    this.hpText.setText(`${Math.ceil(this.player.hp)} / ${Math.ceil(this.player.maxHp)}`);

    const need = PLAYER.XP_PER_LEVEL(this.player.level);
    this.xpFill.width = GAME.WIDTH * (this.player.xp / need);

    this.lvlText.setText(String(this.player.level));
    this.timerText.setText(formatTime(this.elapsedMs));
    this.killText.setText(String(this.kills));
    this.coinText.setText(String(this.coins));

    if (this.boss && this.boss.active) {
      const frac = Math.max(0, this.boss.hp / this.boss.maxHp);
      // Duas barras: cada fase = uma barra cheia. Fase 1 = 100%→50%, Fase 2 = 50%→0%.
      // O HP real não muda. Durante a virada (êxtase) a barra recarrega 0→100%
      // animada pelo boss (_displayFill); fora disso, mapeia a fração real.
      const phase2 = this.boss.phase === 2;
      let shown;
      if (this.boss._transitioning) shown = this.boss._displayFill ?? 0;
      else shown = phase2 ? frac / 0.5 : (frac - 0.5) / 0.5;
      this.bossHpFill.width = 714 * Phaser.Math.Clamp(shown, 0, 1);
      this.bossHpFill.fillColor = phase2 ? 0xff8a1e : 0xff3a55; // esquenta na Fase 2
      this.bossLabel.setText(phase2 ? 'O ANCIÃO · FÚRIA' : 'O ANCIÃO');
    }

    // Despertar (mostra cadeado se não comprado)
    const now = this.scene.time.now;
    if (!this.player.awakenUnlocked) {
      this.awFill.width = 0;
      this.awFill.fillColor = 0x333333;
      this.awHint.setText('🔒 NÃO COMPRADO').setColor('#666666');
    } else {
      const aw = this.player.awakenMeter / this.player.awakenMax;
      this.awFill.width = (PW - 40) * aw;
      if (this.player.isAwakened()) {
        const remain = Math.max(0, this.player.awakenedUntil - now);
        this.awFill.fillColor = 0xffe88a;
        this.awHint.setText(`${(remain / 1000).toFixed(1)}s`).setColor('#ffe88a');
      } else if (this.player.awakenReady()) {
        this.awFill.fillColor = 0xffd96b;
        this.awHint.setText('PRESSIONE R').setColor('#ffe88a');
      } else if (now < this.player.awakenLockUntil) {
        this.awFill.fillColor = 0x6a4a10;
        this.awHint.setText('recarregando').setColor('#93a89a');
      } else {
        this.awFill.fillColor = 0xd9b25c;
        this.awHint.setText('').setColor('#d9b25c');
      }
    }

    if (!this.player.dashUnlocked) {
      this.dashIcon.setText('🔒 DASH').setColor('#666666');
    } else if (this.player.dashReady()) {
      this.dashIcon.setText('⚡ DASH').setColor('#ffd96b');
    } else {
      const remain = Math.max(0, this.player.dashCdUntil - now);
      this.dashIcon.setText(`DASH  ${(remain / 1000).toFixed(1)}s`).setColor('#93a89a');
    }
  }
}
