// Menu principal com info de meta-progressão.
import { COLORS, GAME, META } from '../config.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { formatTime } from '../utils.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const cx = GAME.WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.BG);

    this.meta = new MetaProgression();

    // Título
    this.add.text(cx, 110, 'GUARDIÃO', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '56px', color: '#d9b25c',
    }).setOrigin(0.5);
    this.add.text(cx, 175, 'DA FLORESTA', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '28px', color: '#d9b25c',
    }).setOrigin(0.5);
    this.add.text(cx, 220, 'D E S P E R T A R', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#6fcf6f',
    }).setOrigin(0.5);

    // Stats meta
    this.add.text(cx, 290, `💰 ${this.meta.coins}    🏆 ${formatTime(this.meta.data.highScoreSeconds * 1000)}`, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#e8f0e6',
    }).setOrigin(0.5);

    // Modo privado warning
    if (!this.meta.available) {
      this.add.text(cx, 320, 'modo privado — progresso não será salvo', {
        fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#ff5a6e',
      }).setOrigin(0.5);
    }

    // Botões principais
    this._button(cx, 380, 'JOGAR',         () => this.scene.start('GameScene'));
    this._button(cx, 440, 'DESBLOQUEAR',   () => this._showUnlockMenu());
    this._button(cx, 500, 'CRÉDITOS',      () => this.scene.start('CreditsScene'));

    // Dica
    this.add.text(cx, GAME.HEIGHT - 40,
      'WASD / setas: mover  •  ESC: pausar  •  M: mute',
      { fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#93a89a' }
    ).setOrigin(0.5);

    // Unlock áudio
    this.input.once('pointerdown', () => this.sound.unlock?.());
    this.input.keyboard.once('keydown', () => this.sound.unlock?.());
  }

  _button(x, y, label, onClick) {
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '18px', color: '#e8f0e6',
      backgroundColor: '#1a2a1a', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    txt.on('pointerover', () => txt.setColor('#d9b25c'));
    txt.on('pointerout',  () => txt.setColor('#e8f0e6'));
    txt.on('pointerdown', onClick);
    return txt;
  }

  _showUnlockMenu() {
    // Overlay simples com lista de armas + custos
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.85).setOrigin(0).setInteractive();
    overlay.setDepth(500);

    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 560, 380, 0x0a1a10, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(this.add.text(0, -160, 'DESBLOQUEAR ARMAS', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '18px', color: '#d9b25c',
    }).setOrigin(0.5));
    panel.add(this.add.text(0, -130, `💰 ${this.meta.coins} moedas`, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px', color: '#e8f0e6',
    }).setOrigin(0.5));

    const items = [
      { key: 'BOOMER', name: 'Bumerangue 🔥',     cost: META.WEAPON_UNLOCK_COST.BOOMER },
      { key: 'CHAIN',  name: 'Raio Encadeado ⚡', cost: META.WEAPON_UNLOCK_COST.CHAIN },
      { key: 'AURA',   name: 'Aura Gélida ❄️',    cost: META.WEAPON_UNLOCK_COST.AURA },
    ];
    let y = -70;
    for (const it of items) {
      const has = this.meta.isUnlocked(it.key);
      const canBuy = !has && this.meta.coins >= it.cost;
      const color = has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#666666');
      const label = has ? `✓ ${it.name}` : `${it.name}   ${it.cost} 💰`;
      const txt = this.add.text(0, y, label, {
        fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color,
      }).setOrigin(0.5);
      panel.add(txt);
      if (canBuy) {
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerdown', () => {
          this.meta.unlock(it.key);
          overlay.destroy(); panel.destroy();
          this.scene.restart();
        });
        txt.on('pointerover', () => txt.setColor('#d9b25c'));
        txt.on('pointerout',  () => txt.setColor('#e8f0e6'));
      }
      y += 44;
    }

    const close = this.add.text(0, 145, 'FECHAR', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#d9b25c',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(close);
  }
}
