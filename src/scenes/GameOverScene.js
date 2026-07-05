// Tela final polida — combina visual com o menu (gradiente, painéis, animações).
import { COLORS, GAME } from '../config.js';
import { formatTime } from '../utils.js';

const F = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data) {
    const { won, elapsedMs, kills, coinsGained, newUnlocks, difficulty, unlockedNextDifficulty } = data;
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const cx = W / 2;

    // === BG gradiente diferente por vitória/derrota ===
    this.cameras.main.setBackgroundColor(0x0a1410);
    const grad = this.add.graphics();
    if (won) {
      grad.fillStyle(0x1a3a20, 1); grad.fillRect(0, 0, W, H);
      grad.fillStyle(0x152820, 0.7); grad.fillRect(0, H * 0.4, W, H * 0.6);
    } else {
      grad.fillStyle(0x2a1010, 1); grad.fillRect(0, 0, W, H);
      grad.fillStyle(0x0a0606, 0.7); grad.fillRect(0, H * 0.4, W, H * 0.6);
    }
    grad.fillStyle(0x000000, 0.5); grad.fillRect(0, H - 120, W, 120);

    // === Partículas — fireflies pra vitória, cinzas pra derrota ===
    this.particles = [];
    const pColor = won ? 0xfff5b8 : 0x664444;
    for (let i = 0; i < 16; i++) {
      const p = this.add.circle(Math.random() * W, H + Math.random() * 200,
        2 + Math.random() * 1.5, pColor, 0.7).setDepth(5);
      p._phase = Math.random() * Math.PI * 2;
      p._driftX = (Math.random() - 0.5) * 0.4;
      p._driftY = -0.4 - Math.random() * 0.3;
      this.particles.push(p);
    }

    // === TÍTULO ===
    const titleColor = won ? '#ffe88a' : '#ff5a6e';
    const titleText  = won ? 'VITÓRIA' : 'GAME OVER';

    // Sombra
    sharp(this, cx + 4, 124, titleText, {
      fontFamily: F, fontSize: '64px', fontStyle: 'bold', color: '#000000',
    }).setOrigin(0.5).setAlpha(0.7);
    const title = sharp(this, cx, 120, titleText, {
      fontFamily: F, fontSize: '64px', fontStyle: 'bold', color: titleColor,
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);

    // Pulsa o título
    this.tweens.add({ targets: title, alpha: { from: 0.9, to: 1 }, duration: 1400, yoyo: true, repeat: -1 });
    // Spawn com escala
    title.setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 500, ease: 'Back.easeOut' });

    // Subtítulo
    sharp(this, cx, 185, won ? 'O Ancião foi derrotado!' : 'Você caiu na floresta…', {
      fontFamily: F, fontSize: '18px', color: won ? '#6fcf6f' : '#93a89a',
    }).setOrigin(0.5);

    // === PAINEL DE STATS ===
    const px = cx, py = 320, pw = 600, ph = 250;
    this.add.rectangle(px, py, pw, ph, 0x0a1410, 0.92).setStrokeStyle(3, won ? 0xffd96b : 0xd9b25c, 0.85);
    sharp(this, px, py - 100, difficulty ? `RESULTADOS · PERIGO: ${difficulty.name.toUpperCase()}` : 'RESULTADOS DA RUN', {
      fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#93a89a',
    }).setOrigin(0.5);

    const stats = [
      { icon: '⏱',  label: 'TEMPO SOBREVIVIDO', value: formatTime(elapsedMs), color: '#e8f0e6' },
      { icon: '⚔',  label: 'INIMIGOS ABATIDOS',  value: String(kills), color: '#e8f0e6' },
      { icon: '💰', label: 'MOEDAS GANHAS',       value: `+${coinsGained}`, color: '#d9b25c' },
    ];
    let sy = py - 50;
    for (const s of stats) {
      // Linha
      sharp(this, px - pw/2 + 30, sy, s.icon, { fontFamily: F, fontSize: '26px' }).setOrigin(0, 0.5);
      sharp(this, px - pw/2 + 70, sy, s.label, {
        fontFamily: F, fontSize: '14px', color: '#93a89a',
      }).setOrigin(0, 0.5);
      sharp(this, px + pw/2 - 30, sy, s.value, {
        fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: s.color,
      }).setOrigin(1, 0.5);
      sy += 48;
    }

    // === DESBLOQUEIOS NOVOS (se houver) — inclui novo nível de Perigo ===
    const unlocks = [...(newUnlocks || [])];
    if (unlockedNextDifficulty) unlocks.unshift(`Perigo: ${unlockedNextDifficulty}`);
    if (unlocks.length) {
      const uy = py + ph/2 + 30;
      const panel = this.add.rectangle(cx, uy, pw, 50, 0x1a3a1a, 0.9).setStrokeStyle(2, 0xd98cff, 1);
      const utxt = sharp(this, cx, uy, `★ DESBLOQUEADO:  ${unlocks.join(' · ')}`, {
        fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#d98cff',
      }).setOrigin(0.5);
      // Várias conquistas de uma vez podem estourar o painel — encolhe a fonte
      if (utxt.width > pw - 30) utxt.setFontSize(Math.max(10, Math.floor(14 * (pw - 30) / utxt.width)));
      // pulse
      this.tweens.add({ targets: panel, alpha: { from: 0.7, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    }

    // === BOTÕES ===
    const by = H - 110;
    this._button(cx - 180, by, '⟲  JOGAR DE NOVO', '#ffd96b', true,  () => this.scene.start('GameScene'));
    this._button(cx + 180, by, 'VOLTAR AO MENU',    '#e8f0e6', false, () => this.scene.start('MenuScene'));

    // Dica rodapé
    sharp(this, cx, H - 28, won
      ? 'Compre Bênçãos no menu pra fortalecer próximas runs'
      : 'Bênçãos te dão buffs permanentes — não desista!',
      { fontFamily: F, fontSize: '12px', color: '#6a7a6a' }
    ).setOrigin(0.5);
  }

  update(time) {
    for (const p of this.particles) {
      p.x += p._driftX + Math.sin(time / 700 + p._phase) * 0.2;
      p.y += p._driftY;
      p.alpha = 0.4 + Math.sin(time / 350 + p._phase) * 0.35;
      if (p.y < -10) { p.y = GAME.HEIGHT + 20; p.x = Math.random() * GAME.WIDTH; }
    }
  }

  _button(x, y, label, color, primary, onClick) {
    const w = 280, h = 52;
    const bgColor = primary ? 0x1a3a20 : 0x0a1410;
    const strokeColor = primary ? 0xffe88a : 0xd9b25c;
    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.95)
                    .setStrokeStyle(3, strokeColor, primary ? 1 : 0.7).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color,
    }).setOrigin(0.5);
    bg.on('pointerover', () => {
      bg.setFillStyle(primary ? 0x2a5a30 : 0x1a3a20);
      bg.setStrokeStyle(3, 0xffe88a, 1);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.05, scaleY: 1.05, duration: 90 });
      this.sound.play('sfx_ui_hover', { volume: 0.22 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
      bg.setStrokeStyle(3, strokeColor, primary ? 1 : 0.7);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 90 });
    });
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.4 }); onClick(); });
  }
}
