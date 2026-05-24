// Tela de pausa: overlay sobre GameScene. Continuar/Sair.
import { COLORS, GAME } from '../config.js';

const F = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const cx = W / 2;

    // Overlay escuro
    this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0).setInteractive();

    // Painel central
    this.add.rectangle(cx, H / 2, 480, 380, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1);

    sharp(this, cx, H / 2 - 130, 'PAUSADO', {
      fontFamily: F, fontSize: '40px', fontStyle: 'bold', color: '#d9b25c',
    }).setOrigin(0.5);

    sharp(this, cx, H / 2 - 80, 'O tempo está parado.', {
      fontFamily: F, fontSize: '14px', color: '#93a89a',
    }).setOrigin(0.5);

    this._button(cx, H / 2 - 10,  'CONTINUAR',   '#ffd96b', true,  () => this._resume());
    this._button(cx, H / 2 + 60,  'SAIR PRO MENU', '#e8f0e6', false, () => this._exit());

    sharp(this, cx, H / 2 + 130, 'ESC para continuar', {
      fontFamily: F, fontSize: '11px', color: '#6a7a6a',
    }).setOrigin(0.5);

    // ESC ou P fecha
    this.input.keyboard.once('keydown-ESC', () => this._resume());
    this.input.keyboard.once('keydown-P', () => this._resume());
  }

  _button(x, y, label, color, primary, onClick) {
    const w = 320, h = 48;
    const bgColor = primary ? 0x1a3a20 : 0x0a1410;
    const strokeColor = primary ? 0xffe88a : 0xd9b25c;
    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.95)
                    .setStrokeStyle(3, strokeColor, primary ? 1 : 0.7).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F, fontSize: '20px', fontStyle: 'bold', color,
    }).setOrigin(0.5);
    bg.on('pointerover', () => {
      bg.setFillStyle(primary ? 0x2a5a30 : 0x1a3a20);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.04, scaleY: 1.04, duration: 90 });
      this.sound.play('sfx_ui_hover', { volume: 0.22 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 90 });
    });
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.4 }); onClick(); });
  }

  _resume() {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
  _exit() {
    this.scene.stop('GameScene');
    this.scene.start('MenuScene');
  }
}
