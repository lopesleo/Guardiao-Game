// Menu principal redesenhado.
import { COLORS, GAME, META, BLESSINGS } from '../config.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { formatTime } from '../utils.js';

const F = 'Press Start 2P, monospace';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(x, y, str, opts).setResolution(2);
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const cx = W / 2;
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.meta = new MetaProgression();

    // Background tile sutil (grama escura como vinheta)
    this.add.tileSprite(0, 0, W, H, 'town_tiles', 0).setOrigin(0).setAlpha(0.12);

    // Vinheta superior/inferior
    this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0); // placeholder se quiser tween

    // Título (sombra + dourado)
    const tShadow = sharp(this, cx + 4, 124, 'GUARDIÃO', {
      fontFamily: F, fontSize: '64px', color: '#000000',
    }).setOrigin(0.5).setAlpha(0.6);
    sharp(this, cx, 120, 'GUARDIÃO', {
      fontFamily: F, fontSize: '64px', color: '#d9b25c',
      stroke: '#3a2710', strokeThickness: 4,
    }).setOrigin(0.5);

    sharp(this, cx, 190, 'DA FLORESTA', {
      fontFamily: F, fontSize: '30px', color: '#d9b25c',
      stroke: '#3a2710', strokeThickness: 3,
    }).setOrigin(0.5);

    sharp(this, cx, 238, '— D E S P E R T A R —', {
      fontFamily: F, fontSize: '14px', color: '#6fcf6f',
    }).setOrigin(0.5);

    // Painel de stats
    const sp = this.add.rectangle(cx, 310, 460, 64, 0x0a1a10, 0.85)
                    .setStrokeStyle(2, 0xd9b25c, 0.6);
    sharp(this, cx - 100, 300, '💰 MOEDAS', { fontFamily: F, fontSize: '10px', color: '#93a89a' }).setOrigin(0.5);
    sharp(this, cx - 100, 320, `${this.meta.coins}`, { fontFamily: F, fontSize: '20px', color: '#d9b25c' }).setOrigin(0.5);
    sharp(this, cx + 100, 300, '🏆 MELHOR', { fontFamily: F, fontSize: '10px', color: '#93a89a' }).setOrigin(0.5);
    sharp(this, cx + 100, 320, formatTime(this.meta.data.highScoreSeconds * 1000), { fontFamily: F, fontSize: '20px', color: '#e8f0e6' }).setOrigin(0.5);

    if (!this.meta.available) {
      sharp(this, cx, 360, '⚠ modo privado — progresso não será salvo', {
        fontFamily: F, fontSize: '10px', color: '#ff5a6e',
      }).setOrigin(0.5);
    }

    // Botões maiores
    this._button(cx, 420, 'JOGAR',         '#ffd96b', () => this.scene.start('GameScene'));
    this._button(cx, 475, 'BÊNÇÃOS',       '#e8f0e6', () => this._showBlessingsMenu());
    this._button(cx, 530, 'DESBLOQUEAR',   '#e8f0e6', () => this._showUnlockMenu());
    this._button(cx, 585, 'CRÉDITOS',      '#93a89a', () => this.scene.start('CreditsScene'));

    // Dica de controles
    sharp(this, cx, H - 30,
      'WASD: mover  •  R: despertar  •  SHIFT: dash  •  E: abrir baú  •  ESC: pausar',
      { fontFamily: F, fontSize: '10px', color: '#6a7a6a' }
    ).setOrigin(0.5);

    // Unlock áudio no primeiro input
    this.input.once('pointerdown', () => this.sound.unlock?.());
    this.input.keyboard.once('keydown', () => this.sound.unlock?.());
  }

  _button(x, y, label, color, onClick) {
    const bg = this.add.rectangle(x, y, 320, 44, 0x0a1a10, 1)
                    .setStrokeStyle(2, 0xd9b25c, 0.7).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F, fontSize: '18px', color, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x1a3a1a); bg.setStrokeStyle(3, 0xffe88a, 1);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.03, scaleY: 1.03, duration: 80 });
      this.sound.play('sfx_ui_hover', { volume: 0.25 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0a1a10); bg.setStrokeStyle(2, 0xd9b25c, 0.7);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 80 });
    });
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.45 }); onClick(); });
    return { bg, txt };
  }

  _showUnlockMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.88).setOrigin(0).setInteractive();
    overlay.setDepth(500);

    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 600, 420, 0x0a1a10, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -180, 'DESBLOQUEAR ARMAS', { fontFamily: F, fontSize: '22px', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -148, `💰 ${this.meta.coins} moedas`, { fontFamily: F, fontSize: '13px', color: '#e8f0e6' }).setOrigin(0.5));

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
      const txt = sharp(this, 0, y, label, { fontFamily: F, fontSize: '16px', color }).setOrigin(0.5);
      panel.add(txt);
      if (canBuy) {
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerdown', () => {
          this.sound.play('sfx_ui_click', { volume: 0.5 });
          this.meta.unlock(it.key);
          overlay.destroy(); panel.destroy();
          this.scene.restart();
        });
        txt.on('pointerover', () => { txt.setColor('#d9b25c'); this.sound.play('sfx_ui_hover', { volume: 0.25 }); });
        txt.on('pointerout',  () => txt.setColor('#e8f0e6'));
      }
      y += 50;
    }

    const close = sharp(this, 0, 170, 'FECHAR', { fontFamily: F, fontSize: '14px', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(close);
  }

  _showBlessingsMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.88).setOrigin(0).setInteractive();
    overlay.setDepth(500);

    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 720, 560, 0x0a1a10, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -250, 'BÊNÇÃOS', { fontFamily: F, fontSize: '24px', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -218, 'Buffs permanentes pra próximas runs', { fontFamily: F, fontSize: '11px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -194, `💰 ${this.meta.coins} moedas`, { fontFamily: F, fontSize: '13px', color: '#e8f0e6' }).setOrigin(0.5));

    let y = -150;
    const rowH = 58;
    for (const b of BLESSINGS) {
      const has = this.meta.ownsBlessing(b.id);
      const canBuy = !has && this.meta.coins >= b.cost;
      const bgColor = has ? 0x1a3a1a : (canBuy ? 0x1a2a2a : 0x141414);
      const stroke = has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333);

      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 660, 50, bgColor, 1).setStrokeStyle(2, stroke, 1);
      row.add(bg);
      row.add(sharp(this, -310, -10, b.name, { fontFamily: F, fontSize: '13px',
        color: has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#777777') }).setOrigin(0, 0.5));
      row.add(sharp(this, -310, 11, b.desc, { fontFamily: F, fontSize: '10px', color: '#93a89a' }).setOrigin(0, 0.5));
      row.add(sharp(this, 310, 0, has ? '✓ COMPRADA' : `${b.cost} 💰`, { fontFamily: F, fontSize: '12px',
        color: has ? '#6fcf6f' : (canBuy ? '#d9b25c' : '#666666') }).setOrigin(1, 0.5));
      panel.add(row);

      if (canBuy) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x2a3a3a); this.sound.play('sfx_ui_hover', { volume: 0.2 }); });
        bg.on('pointerout',  () => bg.setFillStyle(0x1a2a2a));
        bg.on('pointerdown', () => {
          this.sound.play('sfx_ui_click', { volume: 0.5 });
          if (this.meta.buyBlessing(b)) {
            overlay.destroy(); panel.destroy();
            this._showBlessingsMenu();
          }
        });
      }
      y += rowH;
    }

    const close = sharp(this, 0, 240, 'FECHAR', { fontFamily: F, fontSize: '14px', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      overlay.destroy(); panel.destroy();
      this.scene.restart();
    });
    panel.add(close);
  }
}
