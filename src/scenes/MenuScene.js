// Menu redesenhado com atmosfera: bg florestal animado, player bobbing,
// fireflies, título com glow pulsante, música, botões com hover scale.
import { COLORS, GAME, META, BLESSINGS } from '../config.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { formatTime } from '../utils.js';

const F_TITLE = 'Jersey 10, "Press Start 2P", monospace'; // título chunky
const F_BODY  = 'VT323, "Press Start 2P", monospace';     // texto corrente legível
const F_PIXEL = '"Press Start 2P", monospace';            // pixel art clássico

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const cx = W / 2;
    this.cameras.main.setBackgroundColor(0x0a1410);
    this.meta = new MetaProgression();

    // ========== BACKGROUND DE FLORESTA ==========
    // 1) grama tilada com escuro overlay pra vinheta
    this.add.tileSprite(0, 0, W, H, 'town_tiles', 0).setOrigin(0).setAlpha(0.35);
    // 2) árvores espalhadas atrás
    const treePairs = [[3, 15], [4, 16], [5, 17]];
    for (let i = 0; i < 14; i++) {
      const tx = 60 + Math.random() * (W - 120);
      const ty = 80 + Math.random() * (H - 200);
      const [top, bot] = treePairs[Math.floor(Math.random() * treePairs.length)];
      const TS = 16 * GAME.PIXEL_SCALE;
      this.add.image(tx, ty,        'town_tiles', bot).setScale(GAME.PIXEL_SCALE).setAlpha(0.55).setDepth(ty);
      this.add.image(tx, ty - TS,   'town_tiles', top).setScale(GAME.PIXEL_SCALE).setAlpha(0.55).setDepth(ty);
    }
    // 3) cogumelos
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * W, y = 100 + Math.random() * (H - 200);
      this.add.image(x, y, 'town_tiles', 29).setScale(GAME.PIXEL_SCALE).setAlpha(0.6).setDepth(y);
    }
    // 4) overlay escuro pra contraste
    this.add.rectangle(0, 0, W, H, 0x05080a, 0.55).setOrigin(0);
    // 5) gradiente vinheta (4 retângulos)
    const vg = this.add.graphics().setDepth(1);
    vg.fillStyle(0x000000, 0.6);
    vg.fillRect(0, 0, W, 80);
    vg.fillRect(0, H - 100, W, 100);
    vg.fillStyle(0x000000, 0.3);
    vg.fillRect(0, 80, 120, H - 180);
    vg.fillRect(W - 120, 80, 120, H - 180);

    // ========== FIREFLIES (partículas amarelas drifting) ==========
    this.fireflies = [];
    for (let i = 0; i < 24; i++) {
      const ff = this.add.circle(Math.random() * W, Math.random() * H, 1.5 + Math.random() * 1.5, 0xfff5b8, 0.9).setDepth(5);
      ff._phase = Math.random() * Math.PI * 2;
      ff._speed = 0.3 + Math.random() * 0.6;
      ff._driftY = -0.2 - Math.random() * 0.3;
      ff._driftX = (Math.random() - 0.5) * 0.3;
      this.fireflies.push(ff);
    }

    // ========== PLAYER SPRITE BOBBING ==========
    this.heroSprite = this.add.image(cx, 380, 'dungeon_tiles', 84)
                          .setScale(GAME.PIXEL_SCALE * 1.8).setDepth(10);
    // glow atrás
    this.heroGlow = this.add.circle(cx, 380, 50, 0xd9b25c, 0.18).setDepth(9);
    this.tweens.add({ targets: this.heroSprite, y: 372, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.heroGlow,   scale: 1.15, alpha: 0.28, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ========== TÍTULO ==========
    // glow circular atrás do título
    const tg = this.add.graphics().setDepth(11);
    tg.fillStyle(0xd9b25c, 0.18);
    tg.fillEllipse(cx, 160, 700, 140);
    this.titleGlow = tg;

    sharp(this, cx + 5, 165, 'GUARDIÃO', {
      fontFamily: F_TITLE, fontSize: '96px', color: '#000000',
    }).setOrigin(0.5).setAlpha(0.7).setDepth(12);
    const title = sharp(this, cx, 160, 'GUARDIÃO', {
      fontFamily: F_TITLE, fontSize: '96px', color: '#f0d68f',
      stroke: '#3a2710', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(13);
    sharp(this, cx, 220, 'D A   F L O R E S T A', {
      fontFamily: F_TITLE, fontSize: '36px', color: '#d9b25c',
      stroke: '#3a2710', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(13);
    sharp(this, cx, 260, '~ DESPERTAR ~', {
      fontFamily: F_PIXEL, fontSize: '14px', color: '#6fcf6f',
    }).setOrigin(0.5).setDepth(13);

    // Pulsação leve do título
    this.tweens.add({ targets: title, alpha: { from: 0.92, to: 1 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ========== CARD DE STATS (canto superior direito) ==========
    const sx = W - 240, sy = 20;
    const sp = this.add.rectangle(sx, sy, 220, 70, 0x0a1410, 0.85)
                    .setOrigin(0, 0).setStrokeStyle(2, 0xd9b25c, 0.7).setDepth(20);
    sharp(this, sx + 14, sy + 10, '💰 MOEDAS', { fontFamily: F_PIXEL, fontSize: '9px', color: '#93a89a' }).setDepth(21);
    sharp(this, sx + 14, sy + 24, `${this.meta.coins}`, { fontFamily: F_PIXEL, fontSize: '18px', color: '#d9b25c' }).setDepth(21);
    sharp(this, sx + 116, sy + 10, '🏆 MELHOR', { fontFamily: F_PIXEL, fontSize: '9px', color: '#93a89a' }).setDepth(21);
    sharp(this, sx + 116, sy + 24, formatTime(this.meta.data.highScoreSeconds * 1000), { fontFamily: F_PIXEL, fontSize: '16px', color: '#e8f0e6' }).setDepth(21);

    if (!this.meta.available) {
      sharp(this, cx, 295, '⚠ modo privado — progresso não será salvo', {
        fontFamily: F_PIXEL, fontSize: '9px', color: '#ff5a6e',
      }).setOrigin(0.5).setDepth(21);
    }

    // ========== BOTÕES ==========
    const startY = 470;
    const gap = 56;
    this._button(cx, startY,           '🗡  J O G A R',        '#ffd96b', 22, () => this.scene.start('GameScene'));
    this._button(cx, startY + gap,     '✨  B Ê N Ç Ã O S',     '#e8f0e6', 16, () => this._showBlessingsMenu());
    this._button(cx, startY + gap * 2, '🔓  D E S B L O Q U E A R', '#e8f0e6', 16, () => this._showUnlockMenu());
    this._button(cx, startY + gap * 3, '📜  C R É D I T O S',   '#93a89a', 14, () => this.scene.start('CreditsScene'));

    // Hint
    sharp(this, cx, H - 22,
      'WASD MOVER · R DESPERTAR · SHIFT DASH · E ABRIR BAÚ · M MUTE',
      { fontFamily: F_PIXEL, fontSize: '9px', color: '#6a7a6a' }
    ).setOrigin(0.5).setDepth(25);

    // ========== MÚSICA DO MENU ==========
    if (!this.menuMusic && this.cache.audio.exists('music_menu')) {
      this.menuMusic = this.sound.add('music_menu', { loop: true, volume: 0.25 });
      // Toca após primeiro input (mobile audio unlock)
      this.input.once('pointerdown', () => { this.sound.unlock?.(); this.menuMusic.play(); });
      this.input.keyboard.once('keydown', () => { this.sound.unlock?.(); this.menuMusic.play(); });
    }

    // Para a música ao sair (qualquer scene start daqui)
    this.events.on('shutdown', () => { this.menuMusic?.stop(); this.menuMusic = null; });
  }

  update(time) {
    // Animação dos fireflies
    for (const ff of this.fireflies) {
      ff.x += ff._driftX + Math.sin(time / 600 + ff._phase) * 0.3;
      ff.y += ff._driftY;
      ff.alpha = 0.5 + Math.sin(time / 300 + ff._phase) * 0.4;
      if (ff.y < -10) ff.y = GAME.HEIGHT + 10;
      if (ff.x < -10) ff.x = GAME.WIDTH + 10;
      if (ff.x > GAME.WIDTH + 10) ff.x = -10;
    }
  }

  _button(x, y, label, color, fontSize, onClick) {
    const W = 360, BH = 46;
    const bg = this.add.rectangle(x, y, W, BH, 0x0e1a14, 0.95)
                    .setStrokeStyle(2, 0xd9b25c, 0.7).setDepth(22).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F_PIXEL, fontSize: `${fontSize}px`, color,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x1a3a2a); bg.setStrokeStyle(3, 0xffe88a, 1);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.04, scaleY: 1.04, duration: 90 });
      this.sound.play('sfx_ui_hover', { volume: 0.22 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x0e1a14); bg.setStrokeStyle(2, 0xd9b25c, 0.7);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 90 });
    });
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.4 }); onClick(); });
    return { bg, txt };
  }

  _showUnlockMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.9).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 620, 440, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -180, 'DESBLOQUEAR ARMAS', { fontFamily: F_TITLE, fontSize: '32px', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -140, `💰 ${this.meta.coins} moedas`, { fontFamily: F_PIXEL, fontSize: '13px', color: '#e8f0e6' }).setOrigin(0.5));

    const items = [
      { key: 'BOOMER', name: '🔥 Bumerangue',     cost: META.WEAPON_UNLOCK_COST.BOOMER },
      { key: 'CHAIN',  name: '⚡ Raio Encadeado', cost: META.WEAPON_UNLOCK_COST.CHAIN },
      { key: 'AURA',   name: '❄️ Aura Gélida',    cost: META.WEAPON_UNLOCK_COST.AURA },
    ];
    let y = -70;
    for (const it of items) {
      const has = this.meta.isUnlocked(it.key);
      const canBuy = !has && this.meta.coins >= it.cost;
      const color = has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#666666');
      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 540, 50, has ? 0x1a3a1a : (canBuy ? 0x1a2820 : 0x141414), 1)
                       .setStrokeStyle(2, has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333), 1);
      row.add(bg);
      row.add(sharp(this, -250, 0, it.name, { fontFamily: F_PIXEL, fontSize: '14px', color }).setOrigin(0, 0.5));
      row.add(sharp(this, 250, 0, has ? '✓ COMPRADA' : `${it.cost} 💰`,
        { fontFamily: F_PIXEL, fontSize: '13px', color: has ? '#6fcf6f' : (canBuy ? '#d9b25c' : '#666') }).setOrigin(1, 0.5));
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
    const close = sharp(this, 0, 180, '✕  FECHAR', { fontFamily: F_PIXEL, fontSize: '14px', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(close);
  }

  _showBlessingsMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.9).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 760, 580, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -250, 'BÊNÇÃOS DA MATA', { fontFamily: F_TITLE, fontSize: '36px', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -212, 'Buffs permanentes para todas as runs', { fontFamily: F_PIXEL, fontSize: '11px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -190, `💰 ${this.meta.coins} moedas`, { fontFamily: F_PIXEL, fontSize: '14px', color: '#e8f0e6' }).setOrigin(0.5));

    let y = -140;
    for (const b of BLESSINGS) {
      const has = this.meta.ownsBlessing(b.id);
      const canBuy = !has && this.meta.coins >= b.cost;
      const bgColor = has ? 0x1a3a1a : (canBuy ? 0x1a2820 : 0x141414);
      const stroke  = has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333);
      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 700, 54, bgColor, 1).setStrokeStyle(2, stroke, 1);
      row.add(bg);
      row.add(sharp(this, -330, -12, b.name, { fontFamily: F_PIXEL, fontSize: '13px',
        color: has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#777') }).setOrigin(0, 0.5));
      row.add(sharp(this, -330, 12, b.desc, { fontFamily: F_PIXEL, fontSize: '10px', color: '#93a89a' }).setOrigin(0, 0.5));
      row.add(sharp(this, 330, 0, has ? '✓ COMPRADA' : `${b.cost} 💰`, { fontFamily: F_PIXEL, fontSize: '13px',
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
    const close = sharp(this, 0, 245, '✕  FECHAR', { fontFamily: F_PIXEL, fontSize: '14px', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      overlay.destroy(); panel.destroy();
      this.scene.restart();
    });
    panel.add(close);
  }
}
