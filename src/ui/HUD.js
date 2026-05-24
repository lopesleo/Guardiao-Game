// HUD: agrupado em painéis, fonte com setResolution(2) pra ficar sharp.
import { COLORS, GAME, PLAYER, WEAPONS } from '../config.js';
import { formatTime } from '../utils.js';

const D_BG     = 50000;
const D_FILL   = 50001;
const D_TEXT   = 50002;
const D_BOSS   = 50500;
const D_BOSS_T = 50501;

// Helper: cria text com resolução dobrada (anti-blur)
function sharpText(scene, x, y, str, opts) {
  const t = scene.add.text(x, y, str, opts).setResolution(2);
  return t;
}

export class HUD {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.elapsedMs = 0;
    this.kills = 0;
    this.coins = 0;

    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const F = 'Press Start 2P, monospace';

    // ===== PAINEL ESQUERDO (HP + DESPERTAR) =====
    const PX = 16, PY = 16, PW = 280, PH = 86;
    this.lpanel = scene.add.rectangle(PX, PY, PW, PH, 0x0a1a10, 0.75)
                       .setOrigin(0, 0).setStrokeStyle(2, 0xd9b25c, 0.5)
                       .setScrollFactor(0).setDepth(D_BG);

    // HP
    sharpText(scene, PX + 12, PY + 10, 'HP', { fontFamily: F, fontSize: '12px', color: '#ff5a6e' })
      .setScrollFactor(0).setDepth(D_TEXT);
    this.hpBg   = scene.add.rectangle(PX + 50, PY + 10, PW - 70, 18, 0x000000, 0.6)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL);
    this.hpFill = scene.add.rectangle(PX + 52, PY + 12, PW - 74, 14, COLORS.DANGER)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL + 1);
    this.hpText = sharpText(scene, PX + 50 + (PW - 70) / 2, PY + 11, '', {
      fontFamily: F, fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D_TEXT + 1);

    // DESPERTAR
    sharpText(scene, PX + 12, PY + 38, '★', { fontFamily: F, fontSize: '14px', color: '#ffd96b' })
      .setScrollFactor(0).setDepth(D_TEXT);
    this.awBg   = scene.add.rectangle(PX + 50, PY + 38, PW - 70, 14, 0x000000, 0.6)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL);
    this.awFill = scene.add.rectangle(PX + 52, PY + 40, 0, 10, 0xffd96b)
                       .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL + 1);

    // Level + XP slim
    this.lvlText = sharpText(scene, PX + 12, PY + 60, 'LV 1', {
      fontFamily: F, fontSize: '14px', color: '#d9b25c',
    }).setScrollFactor(0).setDepth(D_TEXT);
    this.awLabel = sharpText(scene, PX + PW - 12, PY + 60, 'DESPERTAR', {
      fontFamily: F, fontSize: '10px', color: '#d9b25c',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT);

    // ===== TIMER CENTRAL TOPO =====
    this.timerText = sharpText(scene, W / 2, 22, '00:00', {
      fontFamily: F, fontSize: '28px', color: '#ffffff',
      stroke: '#0a1a10', strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D_TEXT);

    // ===== PAINEL DIREITO (KILLS + COINS) =====
    const RX = W - 16, RY = 16;
    this.killText = sharpText(scene, RX, RY,      'KILLS  0', {
      fontFamily: F, fontSize: '14px', color: '#e8f0e6', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT);
    this.coinText = sharpText(scene, RX, RY + 22, '💰  0', {
      fontFamily: F, fontSize: '14px', color: '#d9b25c', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D_TEXT);

    // ===== XP BAR FINA NO TOPO ABSOLUTO =====
    this.xpBg   = scene.add.rectangle(0, 0, W, 6, 0x000000, 0.6).setOrigin(0, 0).setScrollFactor(0).setDepth(D_BG);
    this.xpFill = scene.add.rectangle(0, 0, 0, 6, COLORS.XP)   .setOrigin(0, 0).setScrollFactor(0).setDepth(D_FILL);

    // ===== ARMAS — painel inferior esquerdo =====
    this.weaponPanel = scene.add.container(16, H - 50).setScrollFactor(0).setDepth(D_TEXT);

    // ===== DASH — canto inferior direito =====
    this.dashIcon = sharpText(scene, W - 16, H - 26, '⚡ DASH', {
      fontFamily: F, fontSize: '13px', color: '#ffd96b',
      backgroundColor: '#0a1a10', padding: { x: 10, y: 6 },
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D_TEXT);

    // ===== BOSS UI =====
    this.bossBanner = sharpText(scene, W / 2, 70, '', {
      fontFamily: F, fontSize: '24px', color: '#ff5a6e',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D_BOSS).setVisible(false);

    this.bossHpBg   = scene.add.rectangle(W / 2, 110, 640, 20, 0x000000, 0.8)
                          .setScrollFactor(0).setDepth(D_BOSS).setVisible(false);
    this.bossHpFill = scene.add.rectangle(W / 2 - 318, 110, 0, 14, 0xff5a6e)
                          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(D_BOSS_T).setVisible(false);
    this.bossLabel  = sharpText(scene, W / 2, 110, '', {
      fontFamily: F, fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
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
      const elem = WEAPONS[w.key]?.element;
      const icon = icons[elem] || '✨';
      const txt = sharpText(this.scene, x, 0, `${icon} Lv${w.level}`, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#e8f0e6',
        backgroundColor: '#0a1a10', padding: { x: 8, y: 5 },
      });
      this.weaponPanel.add(txt);
      x += txt.width + 6;
    }
  }

  update(time, dt) {
    this.elapsedMs += dt;
    const PW = 280;

    const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
    this.hpFill.width = (PW - 74) * hpPct;
    this.hpText.setText(`${Math.ceil(this.player.hp)}/${Math.ceil(this.player.maxHp)}`);

    const need = PLAYER.XP_PER_LEVEL(this.player.level);
    this.xpFill.width = GAME.WIDTH * (this.player.xp / need);

    this.lvlText.setText(`LV ${this.player.level}`);
    this.timerText.setText(formatTime(this.elapsedMs));
    this.killText.setText(`KILLS  ${this.kills}`);
    this.coinText.setText(`💰  ${this.coins}`);

    if (this.boss && this.boss.active) {
      const pct = Math.max(0, this.boss.hp / this.boss.maxHp);
      this.bossHpFill.width = 634 * pct;
    }

    // Despertar
    const now = this.scene.time.now;
    const aw = this.player.awakenMeter / this.player.awakenMax;
    this.awFill.width = (PW - 74) * aw;
    if (this.player.isAwakened()) {
      const remain = Math.max(0, this.player.awakenedUntil - now);
      this.awFill.fillColor = 0xffe88a;
      this.awLabel.setText(`DESPERTADO ${(remain / 1000).toFixed(1)}s`).setColor('#ffe88a');
    } else if (this.player.awakenReady()) {
      this.awFill.fillColor = 0xffd96b;
      this.awLabel.setText('PRESSIONE R').setColor('#ffe88a');
    } else if (now < this.player.awakenLockUntil) {
      this.awFill.fillColor = 0x6a4a10;
      this.awLabel.setText('recarregando').setColor('#93a89a');
    } else {
      this.awFill.fillColor = 0xd9b25c;
      this.awLabel.setText('DESPERTAR').setColor('#d9b25c');
    }

    if (this.player.dashReady()) {
      this.dashIcon.setText('⚡ DASH').setColor('#ffd96b');
    } else {
      const remain = Math.max(0, this.player.dashCdUntil - now);
      this.dashIcon.setText(`DASH ${(remain / 1000).toFixed(1)}s`).setColor('#93a89a');
    }
  }
}
