// HUD básico D1: HP + XP + timer + level + kills.
import { COLORS, GAME, PLAYER } from '../config.js';
import { formatTime } from '../utils.js';

export class HUD {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.elapsedMs = 0;
    this.kills = 0;

    const W = GAME.WIDTH, H = GAME.HEIGHT;

    // HP bar (canto superior esquerdo)
    this.hpBg   = scene.add.rectangle(20, 20, 220, 18, 0x000000, 0.6).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.hpFill = scene.add.rectangle(22, 22, 216, 14, COLORS.DANGER).setOrigin(0, 0).setScrollFactor(0).setDepth(1001);
    this.hpText = scene.add.text(130, 21, '', { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#fff' })
                       .setOrigin(0.5, 0).setScrollFactor(0).setDepth(1002);

    // XP bar (topo, largura cheia)
    this.xpBg   = scene.add.rectangle(0, 0, W, 8, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(1000);
    this.xpFill = scene.add.rectangle(0, 0, 0, 8, COLORS.XP).setOrigin(0, 0).setScrollFactor(0).setDepth(1001);

    // Level (topo central)
    this.lvlText = scene.add.text(W / 2, 14, 'LV 1', { fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#d9b25c' })
                        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(1002);

    // Timer (canto superior direito)
    this.timerText = scene.add.text(W - 20, 22, '00:00', { fontFamily: 'Press Start 2P, monospace', fontSize: '16px', color: '#e8f0e6' })
                          .setOrigin(1, 0).setScrollFactor(0).setDepth(1002);

    // Kills (logo abaixo do timer)
    this.killText = scene.add.text(W - 20, 48, 'KILLS 0', { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#93a89a' })
                         .setOrigin(1, 0).setScrollFactor(0).setDepth(1002);
  }

  addKill() { this.kills += 1; }

  update(time, dt) {
    this.elapsedMs += dt;

    const hpPct = Math.max(0, this.player.hp / this.player.maxHp);
    this.hpFill.width = 216 * hpPct;
    this.hpText.setText(`${Math.ceil(this.player.hp)}/${this.player.maxHp}`);

    const need = PLAYER.XP_PER_LEVEL(this.player.level);
    this.xpFill.width = GAME.WIDTH * (this.player.xp / need);

    this.lvlText.setText(`LV ${this.player.level}`);
    this.timerText.setText(formatTime(this.elapsedMs));
    this.killText.setText(`KILLS ${this.kills}`);
  }
}
