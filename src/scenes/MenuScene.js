// Menu LIMPO. Sem caos. Tipografia única, hierarquia clara, bg simples.
import { COLORS, GAME, META, BLESSINGS } from '../config.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { formatTime } from '../utils.js';

const F = '"Press Start 2P", monospace';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const cx = W / 2;
    this.meta = new MetaProgression();

    // === BG: gradiente escuro suave ===
    this.cameras.main.setBackgroundColor(0x0a1410);
    const grad = this.add.graphics();
    // simula gradiente com 3 retângulos
    grad.fillStyle(0x152820, 1);
    grad.fillRect(0, 0, W, H);
    grad.fillStyle(0x0a1410, 0.6);
    grad.fillRect(0, H * 0.5, W, H * 0.5);
    grad.fillStyle(0x000000, 0.5);
    grad.fillRect(0, H - 120, W, 120);

    // === FIREFLIES sutis (só 12) ===
    this.fireflies = [];
    for (let i = 0; i < 12; i++) {
      const ff = this.add.circle(Math.random() * W, H + Math.random() * 200, 2, 0xfff5b8, 0.7).setDepth(5);
      ff._phase = Math.random() * Math.PI * 2;
      ff._driftX = (Math.random() - 0.5) * 0.4;
      ff._driftY = -0.4 - Math.random() * 0.3;
      this.fireflies.push(ff);
    }

    // === TÍTULO — Press Start 2P em tamanho grande ===
    // Sombra
    sharp(this, cx + 4, 124, 'GUARDIÃO', {
      fontFamily: F, fontSize: '72px', color: '#000000',
    }).setOrigin(0.5).setAlpha(0.7);
    // Principal
    sharp(this, cx, 120, 'GUARDIÃO', {
      fontFamily: F, fontSize: '72px', color: '#d9b25c',
    }).setOrigin(0.5);

    // Subtítulo
    sharp(this, cx, 180, 'DA FLORESTA', {
      fontFamily: F, fontSize: '28px', color: '#d9b25c',
    }).setOrigin(0.5);

    // Tagline
    sharp(this, cx, 220, 'DESPERTAR', {
      fontFamily: F, fontSize: '12px', color: '#6fcf6f',
    }).setOrigin(0.5);

    // === HERO SPRITE (pequeno, acima dos botões) ===
    this.hero = this.add.image(cx, 290, 'dungeon_tiles', 84)
                       .setScale(GAME.PIXEL_SCALE * 1.3);
    this.tweens.add({ targets: this.hero, y: 282, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // === STATS CARD (topo direito, simples) ===
    const sx = W - 240, sy = 20, sw = 220, sh = 60;
    this.add.rectangle(sx, sy, sw, sh, 0x000000, 0.7).setOrigin(0, 0).setStrokeStyle(2, 0xd9b25c, 0.7);
    sharp(this, sx + 14,  sy + 14, '💰', { fontFamily: F, fontSize: '16px' });
    sharp(this, sx + 40,  sy + 16, `${this.meta.coins}`, { fontFamily: F, fontSize: '16px', color: '#d9b25c' });
    sharp(this, sx + 14,  sy + 38, '🏆', { fontFamily: F, fontSize: '16px' });
    sharp(this, sx + 40,  sy + 40, formatTime(this.meta.data.highScoreSeconds * 1000), { fontFamily: F, fontSize: '14px', color: '#e8f0e6' });

    if (!this.meta.available) {
      sharp(this, cx, H - 70, '⚠ modo privado - progresso não será salvo', {
        fontFamily: F, fontSize: '10px', color: '#ff5a6e',
      }).setOrigin(0.5);
    }

    // === BOTÕES (vertical, bem espaçados, sem ícones brigando) ===
    const bx = cx, by = 400, bgap = 60;
    this._button(bx, by,            'JOGAR',       '#ffd96b', 22, () => this.scene.start('GameScene'));
    this._button(bx, by + bgap,     'BÊNÇÃOS',     '#e8f0e6', 16, () => this._showBlessingsMenu());
    this._button(bx, by + bgap * 2, 'DESBLOQUEAR', '#e8f0e6', 16, () => this._showUnlockMenu());
    this._button(bx, by + bgap * 3, 'CRÉDITOS',    '#93a89a', 14, () => this.scene.start('CreditsScene'));

    // === HINT ===
    sharp(this, cx, H - 30,
      'WASD mover · R despertar · SHIFT dash · E abrir baú',
      { fontFamily: F, fontSize: '10px', color: '#6a7a6a' }
    ).setOrigin(0.5);

    // === MÚSICA ===
    if (!this.menuMusic && this.cache.audio.exists('music_menu')) {
      this.menuMusic = this.sound.add('music_menu', { loop: true, volume: 0.25 });
      const startMusic = () => { this.sound.unlock?.(); if (!this.menuMusic.isPlaying) this.menuMusic.play(); };
      this.input.once('pointerdown', startMusic);
      this.input.keyboard.once('keydown', startMusic);
    }
    this.events.on('shutdown', () => { this.menuMusic?.stop(); this.menuMusic = null; });
  }

  update(time) {
    for (const ff of this.fireflies) {
      ff.x += ff._driftX + Math.sin(time / 700 + ff._phase) * 0.2;
      ff.y += ff._driftY;
      ff.alpha = 0.4 + Math.sin(time / 350 + ff._phase) * 0.35;
      if (ff.y < -10) { ff.y = GAME.HEIGHT + 20; ff.x = Math.random() * GAME.WIDTH; }
    }
  }

  _button(x, y, label, color, fontSize, onClick) {
    const w = 360, h = 46;
    const bg = this.add.rectangle(x, y, w, h, 0x0a1410, 0.95)
                    .setStrokeStyle(2, 0xd9b25c, 0.8).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F, fontSize: `${fontSize}px`, color,
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x1a2a20); bg.setStrokeStyle(3, 0xffe88a, 1);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.04, scaleY: 1.04, duration: 90 });
      this.sound.play('sfx_ui_hover', { volume: 0.22 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0a1410); bg.setStrokeStyle(2, 0xd9b25c, 0.8);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 90 });
    });
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.4 }); onClick(); });
    return { bg, txt };
  }

  _showUnlockMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 620, 440, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -180, 'DESBLOQUEAR', { fontFamily: F, fontSize: '22px', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -140, `${this.meta.coins} moedas`, { fontFamily: F, fontSize: '12px', color: '#e8f0e6' }).setOrigin(0.5));

    const items = [
      { key: 'BOOMER', name: 'Bumerangue',     cost: META.WEAPON_UNLOCK_COST.BOOMER, ico: '🔥' },
      { key: 'CHAIN',  name: 'Raio Encadeado', cost: META.WEAPON_UNLOCK_COST.CHAIN,  ico: '⚡' },
      { key: 'AURA',   name: 'Aura Gélida',    cost: META.WEAPON_UNLOCK_COST.AURA,   ico: '❄' },
    ];
    let y = -70;
    for (const it of items) {
      const has = this.meta.isUnlocked(it.key);
      const canBuy = !has && this.meta.coins >= it.cost;
      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 540, 50, has ? 0x1a3a1a : (canBuy ? 0x1a2820 : 0x141414), 1)
                       .setStrokeStyle(2, has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333), 1);
      row.add(bg);
      row.add(sharp(this, -250, 0, `${it.ico}  ${it.name}`, { fontFamily: F, fontSize: '13px',
        color: has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#666') }).setOrigin(0, 0.5));
      row.add(sharp(this, 250, 0, has ? 'COMPRADA' : `${it.cost} 💰`, { fontFamily: F, fontSize: '12px',
        color: has ? '#6fcf6f' : (canBuy ? '#d9b25c' : '#666') }).setOrigin(1, 0.5));
      panel.add(row);
      if (canBuy) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x2a3a3a); this.sound.play('sfx_ui_hover', { volume: 0.2 }); });
        bg.on('pointerout',  () => bg.setFillStyle(0x1a2820));
        bg.on('pointerdown', () => {
          this.sound.play('sfx_ui_click', { volume: 0.5 });
          this.meta.unlock(it.key);
          overlay.destroy(); panel.destroy();
          this.scene.restart();
        });
      }
      y += 60;
    }
    const close = sharp(this, 0, 180, 'FECHAR', { fontFamily: F, fontSize: '13px', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(close);
  }

  _showBlessingsMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 760, 580, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -250, 'BÊNÇÃOS', { fontFamily: F, fontSize: '24px', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -218, 'Buffs permanentes para todas as runs', { fontFamily: F, fontSize: '10px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -195, `${this.meta.coins} moedas`, { fontFamily: F, fontSize: '12px', color: '#e8f0e6' }).setOrigin(0.5));

    let y = -140;
    for (const b of BLESSINGS) {
      const has = this.meta.ownsBlessing(b.id);
      const canBuy = !has && this.meta.coins >= b.cost;
      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 700, 54, has ? 0x1a3a1a : (canBuy ? 0x1a2820 : 0x141414), 1)
                       .setStrokeStyle(2, has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333), 1);
      row.add(bg);
      row.add(sharp(this, -330, -12, b.name, { fontFamily: F, fontSize: '12px',
        color: has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#777') }).setOrigin(0, 0.5));
      row.add(sharp(this, -330, 12, b.desc, { fontFamily: F, fontSize: '9px', color: '#93a89a' }).setOrigin(0, 0.5));
      row.add(sharp(this, 330, 0, has ? 'COMPRADA' : `${b.cost} 💰`, { fontFamily: F, fontSize: '12px',
        color: has ? '#6fcf6f' : (canBuy ? '#d9b25c' : '#666') }).setOrigin(1, 0.5));
      panel.add(row);
      if (canBuy) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x2a3a3a); this.sound.play('sfx_ui_hover', { volume: 0.2 }); });
        bg.on('pointerout',  () => bg.setFillStyle(0x1a2820));
        bg.on('pointerdown', () => {
          this.sound.play('sfx_ui_click', { volume: 0.5 });
          if (this.meta.buyBlessing(b)) {
            overlay.destroy(); panel.destroy();
            this._showBlessingsMenu();
          }
        });
      }
      y += 60;
    }
    const close = sharp(this, 0, 245, 'FECHAR', { fontFamily: F, fontSize: '13px', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      overlay.destroy(); panel.destroy();
      this.scene.restart();
    });
    panel.add(close);
  }
}
