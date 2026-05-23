// HUD: HP, XP, level, timer, kills, moedas, ícones de arma + alerta de boss.
import { COLORS, GAME, PLAYER, WEAPONS } from '../config.js';
const AW = PLAYER.AWAKEN_METER_MAX;
import { formatTime } from '../utils.js';

export class HUD {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.elapsedMs = 0;
    this.kills = 0;
    this.coins = 0;

    const W = GAME.WIDTH, H = GAME.HEIGHT;

    // HP
    this.hpBg   = scene.add.rectangle(20, 20, 240, 22, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.hpFill = scene.add.rectangle(23, 23, 234, 16, COLORS.DANGER).setOrigin(0, 0).setScrollFactor(0).setDepth(1001);
    this.hpText = scene.add.text(140, 22, '', { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#fff' })
                       .setOrigin(0.5, 0).setScrollFactor(0).setDepth(1002);

    // Despertar (★) — barra logo abaixo do HP
    this.awBg   = scene.add.rectangle(20, 48, 240, 14, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.awFill = scene.add.rectangle(23, 51, 0, 8, 0xffd96b).setOrigin(0, 0).setScrollFactor(0).setDepth(1001);
    this.awLabel= scene.add.text(140, 48, 'DESPERTAR', { fontFamily: 'Press Start 2P, monospace', fontSize: '8px', color: '#ffd96b' })
                       .setOrigin(0.5, 0).setScrollFactor(0).setDepth(1002);

    // Dash — ícone com cooldown radial (canto inferior direito)
    this.dashIcon = scene.add.text(GAME.WIDTH - 20, GAME.HEIGHT - 30, 'SHIFT', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px',
      color: '#e8f0e6', backgroundColor: '#1a2a1a', padding: { x: 8, y: 6 },
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(1002);

    // XP bar (topo)
    this.xpBg   = scene.add.rectangle(0, 0, W, 8, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.xpFill = scene.add.rectangle(0, 0, 0, 8, COLORS.XP).setOrigin(0, 0).setScrollFactor(0).setDepth(1001);

    // Level
    this.lvlText = scene.add.text(W / 2, 14, 'LV 1', { fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#d9b25c' })
                        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(1002);

    // Timer
    this.timerText = scene.add.text(W - 20, 22, '00:00', { fontFamily: 'Press Start 2P, monospace', fontSize: '16px', color: '#e8f0e6' })
                          .setOrigin(1, 0).setScrollFactor(0).setDepth(1002);
    // Kills + coins
    this.killText = scene.add.text(W - 20, 48, 'KILLS 0', { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#93a89a' })
                         .setOrigin(1, 0).setScrollFactor(0).setDepth(1002);
    this.coinText = scene.add.text(W - 20, 68, '💰 0', { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#d9b25c' })
                         .setOrigin(1, 0).setScrollFactor(0).setDepth(1002);

    // Painel de armas (canto inferior esquerdo)
    this.weaponPanel = scene.add.container(20, H - 50).setScrollFactor(0).setDepth(1002);

    // Banner de boss (oculto)
    this.bossBanner = scene.add.text(W / 2, 60, '', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '20px', color: '#ff5a6e',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1500).setVisible(false);

    // HP bar do boss (oculto)
    this.bossHpBg   = scene.add.rectangle(W / 2, 100, 600, 16, 0x000000, 0.8).setScrollFactor(0).setDepth(1500).setVisible(false);
    this.bossHpFill = scene.add.rectangle(W / 2 - 297, 100, 0, 12, 0xff5a6e).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1501).setVisible(false);
    this.bossLabel  = scene.add.text(W / 2, 130, '', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#fff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1501).setVisible(false);
  }

  addKill()       { this.kills += 1; }
  addCoin(n = 1)  { this.coins += n; }

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
    this.bossLabel.setText('BOITATÁ');
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
      const txt = this.scene.add.text(x, 0, `${icon} Lv${w.level}`, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#e8f0e6',
        backgroundColor: '#0a1a10', padding: { x: 6, y: 4 },
      });
      this.weaponPanel.add(txt);
      x += txt.width + 6;
    }
  }

  update(time, dt) {
    this.elapsedMs += dt;

    const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
    this.hpFill.width = 234 * hpPct;
    this.hpText.setText(`${Math.ceil(this.player.hp)}/${Math.ceil(this.player.maxHp)}`);

    const need = PLAYER.XP_PER_LEVEL(this.player.level);
    this.xpFill.width = GAME.WIDTH * (this.player.xp / need);

    this.lvlText.setText(`LV ${this.player.level}`);
    this.timerText.setText(formatTime(this.elapsedMs));
    this.killText.setText(`KILLS ${this.kills}`);
    this.coinText.setText(`💰 ${this.coins}`);

    if (this.boss && this.boss.active) {
      const pct = Math.max(0, this.boss.hp / this.boss.maxHp);
      this.bossHpFill.width = 594 * pct;
    }

    // Despertar
    const now = this.scene.time.now;
    const aw = this.player.awakenMeter / AW;
    this.awFill.width = 234 * aw;
    if (this.player.isAwakened()) {
      const remain = Math.max(0, this.player.awakenedUntil - now);
      this.awFill.fillColor = 0xffd96b;
      this.awLabel.setText(`DESPERTADO (${(remain / 1000).toFixed(1)}s)`).setColor('#ffd96b');
    } else if (this.player.awakenReady()) {
      this.awFill.fillColor = 0xffd96b;
      this.awLabel.setText('★ DESPERTAR — R').setColor('#ffe88a');
    } else if (now < this.player.awakenLockUntil) {
      this.awFill.fillColor = 0x6a4a10;
      this.awLabel.setText('recarregando…').setColor('#93a89a');
    } else {
      this.awFill.fillColor = 0xd9b25c;
      this.awLabel.setText('DESPERTAR').setColor('#d9b25c');
    }

    // Dash
    if (this.player.dashReady()) {
      this.dashIcon.setText('⚡ DASH').setColor('#ffd96b');
    } else {
      const remain = Math.max(0, this.player.dashCdUntil - now);
      this.dashIcon.setText(`DASH ${(remain / 1000).toFixed(1)}s`).setColor('#93a89a');
    }
  }
}
