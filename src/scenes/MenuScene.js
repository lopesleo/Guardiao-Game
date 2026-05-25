// Menu LIMPO com fonte system-ui (legível em projetor) — só título em pixel font.
import { COLORS, GAME, META, BLESSINGS } from '../config.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { formatTime } from '../utils.js';

const F  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FP = '"Press Start 2P", monospace';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const cx = W / 2;
    this.meta = new MetaProgression();

    // === BG gradiente escuro ===
    this.cameras.main.setBackgroundColor(0x0a1410);
    const grad = this.add.graphics();
    grad.fillStyle(0x152820, 1); grad.fillRect(0, 0, W, H);
    grad.fillStyle(0x0a1410, 0.6); grad.fillRect(0, H * 0.5, W, H * 0.5);
    grad.fillStyle(0x000000, 0.5); grad.fillRect(0, H - 120, W, 120);

    // === Fireflies sutis ===
    this.fireflies = [];
    for (let i = 0; i < 12; i++) {
      const ff = this.add.circle(Math.random() * W, H + Math.random() * 200, 2, 0xfff5b8, 0.7).setDepth(5);
      ff._phase = Math.random() * Math.PI * 2;
      ff._driftX = (Math.random() - 0.5) * 0.4;
      ff._driftY = -0.4 - Math.random() * 0.3;
      this.fireflies.push(ff);
    }

    // === TÍTULO — Press Start 2P só pra ter cara de jogo, mas grande pra ler ===
    sharp(this, cx + 4, 134, 'GUARDIÃO', { fontFamily: FP, fontSize: '54px', color: '#000000' })
      .setOrigin(0.5).setAlpha(0.7);
    sharp(this, cx, 130, 'GUARDIÃO', {
      fontFamily: FP, fontSize: '54px', color: '#d9b25c',
    }).setOrigin(0.5);

    sharp(this, cx, 190, 'DA FLORESTA', {
      fontFamily: FP, fontSize: '22px', color: '#d9b25c',
    }).setOrigin(0.5);

    // Tagline em sans-serif legível
    sharp(this, cx, 232, '— DESPERTAR —', {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#6fcf6f',
    }).setOrigin(0.5);

    // === HERO ===
    this.hero = this.add.image(cx, 310, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.3);
    this.tweens.add({ targets: this.hero, y: 302, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // === STATS CARD ===
    const sx = W - 260, sy = 24, sw = 240, sh = 80;
    this.add.rectangle(sx, sy, sw, sh, 0x000000, 0.7).setOrigin(0, 0).setStrokeStyle(2, 0xd9b25c, 0.8);
    sharp(this, sx + 14, sy + 12, '💰  MOEDAS', { fontFamily: F, fontSize: '12px', color: '#93a89a' });
    this._coinsText = sharp(this, sx + 14, sy + 30, `${this.meta.coins}`, { fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#d9b25c' });
    sharp(this, sx + 130, sy + 12, '🏆  MELHOR', { fontFamily: F, fontSize: '12px', color: '#93a89a' });
    sharp(this, sx + 130, sy + 32, formatTime(this.meta.data.highScoreSeconds * 1000), {
      fontFamily: F, fontSize: '20px', fontStyle: 'bold', color: '#e8f0e6',
    });

    // Botão DEV: +100 moedas (para testar desbloqueios/bênçãos sem grindar)
    const dcx = sx, dcy = sy + sh + 8;
    const devBtn = this.add.rectangle(dcx, dcy, 130, 26, 0x0a1410, 0.95)
      .setOrigin(0, 0).setStrokeStyle(2, 0x6fcf6f, 0.8).setInteractive({ useHandCursor: true });
    const devTxt = sharp(this, dcx + 65, dcy + 13, '+100 💰 (dev)',
      { fontFamily: F, fontSize: '12px', fontStyle: 'bold', color: '#6fcf6f' }).setOrigin(0.5);
    devBtn.on('pointerover', () => { devBtn.setFillStyle(0x14241a); this.sound.play('sfx_ui_hover', { volume: 0.2 }); });
    devBtn.on('pointerout', () => devBtn.setFillStyle(0x0a1410));
    devBtn.on('pointerdown', () => {
      this.sound.play('sfx_coin', { volume: 0.5 });
      this.meta.addCoins(100);
      this._coinsText.setText(`${this.meta.coins}`);
      this.tweens.add({ targets: devTxt, scaleX: 1.2, scaleY: 1.2, duration: 80, yoyo: true });
    });

    if (!this.meta.available) {
      sharp(this, cx, H - 70, '⚠ Modo privado — progresso não será salvo', {
        fontFamily: F, fontSize: '13px', color: '#ff5a6e',
      }).setOrigin(0.5);
    }

    // === BOTÕES — sans-serif grande e legível ===
    const by = 380, bgap = 56;
    this._button(cx, by,            'JOGAR',         '#ffd96b', 26, true,  () => this.scene.start('GameScene'));
    this._button(cx, by + bgap,     'COMO JOGAR',    '#e8f0e6', 20, false, () => this.scene.start('TutorialScene'));
    this._button(cx, by + bgap * 2, 'BÊNÇÃOS',       '#e8f0e6', 20, false, () => this._showBlessingsMenu());
    this._button(cx, by + bgap * 3, 'DESBLOQUEAR',   '#e8f0e6', 20, false, () => this._showUnlockMenu());
    this._button(cx, by + bgap * 4, 'CRÉDITOS',      '#93a89a', 18, false, () => this.scene.start('CreditsScene'));
    this._button(cx, by + bgap * 5, 'NOVO JOGO',     '#ff8898', 14, false, () => this._showResetConfirm());

    // === HINT ===
    sharp(this, cx, H - 28,
      'WASD mover  ·  R despertar  ·  SHIFT dash  ·  E abrir baú  ·  M mute',
      { fontFamily: F, fontSize: '13px', color: '#93a89a' }
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

  _button(x, y, label, color, fontSize, primary, onClick) {
    const w = 400, h = 52;
    const bgColor = primary ? 0x1a3a20 : 0x0a1410;
    const strokeColor = primary ? 0xffe88a : 0xd9b25c;
    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.95)
                    .setStrokeStyle(3, strokeColor, primary ? 1 : 0.7).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F, fontSize: `${fontSize}px`, fontStyle: 'bold', color,
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(primary ? 0x2a5a30 : 0x1a3a20);
      bg.setStrokeStyle(3, 0xffe88a, 1);
      this.tweens.add({ targets: [bg, txt], scaleX: 1.04, scaleY: 1.04, duration: 90 });
      this.sound.play('sfx_ui_hover', { volume: 0.22 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
      bg.setStrokeStyle(3, strokeColor, primary ? 1 : 0.7);
      this.tweens.add({ targets: [bg, txt], scaleX: 1, scaleY: 1, duration: 90 });
    });
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.4 }); onClick(); });
    return { bg, txt };
  }

  _showUnlockMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 640, 460, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -190, 'DESBLOQUEAR ARMAS', { fontFamily: F, fontSize: '26px', fontStyle: 'bold', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -150, `${this.meta.coins} moedas disponíveis`, { fontFamily: F, fontSize: '14px', color: '#e8f0e6' }).setOrigin(0.5));

    const items = [
      { kind: 'weapon',  key: 'BOOMER', name: 'Bumerangue',     cost: META.WEAPON_UNLOCK_COST.BOOMER,  ico: '🔥' },
      { kind: 'weapon',  key: 'CHAIN',  name: 'Raio Concentrado', cost: META.WEAPON_UNLOCK_COST.CHAIN,   ico: '⚡' },
      { kind: 'weapon',  key: 'AURA',   name: 'Aura Gélida',    cost: META.WEAPON_UNLOCK_COST.AURA,    ico: '❄' },
      { kind: 'ability', key: 'DASH',   name: 'Dash (SHIFT)',   cost: META.ABILITY_UNLOCK_COST.DASH,   ico: '⚡' },
      { kind: 'ability', key: 'AWAKEN', name: 'Despertar (R)',  cost: META.ABILITY_UNLOCK_COST.AWAKEN, ico: '★' },
    ];
    let y = -130;
    for (const it of items) {
      const has = it.kind === 'weapon' ? this.meta.isUnlocked(it.key) : this.meta.hasAbility(it.key);
      const canBuy = !has && this.meta.coins >= it.cost;
      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 560, 50, has ? 0x1a3a1a : (canBuy ? 0x1a2820 : 0x141414), 1)
                       .setStrokeStyle(2, has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333), 1);
      row.add(bg);
      const tag = it.kind === 'ability' ? ' [HAB]' : '';
      row.add(sharp(this, -260, 0, `${it.ico}  ${it.name}${tag}`, {
        fontFamily: F, fontSize: '16px', fontStyle: 'bold',
        color: has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#777'),
      }).setOrigin(0, 0.5));
      row.add(sharp(this, 260, 0, has ? 'COMPRADA' : `${it.cost} 💰`, {
        fontFamily: F, fontSize: '14px', fontStyle: 'bold',
        color: has ? '#6fcf6f' : (canBuy ? '#d9b25c' : '#666'),
      }).setOrigin(1, 0.5));
      panel.add(row);
      if (canBuy) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x2a3a3a); this.sound.play('sfx_ui_hover', { volume: 0.2 }); });
        bg.on('pointerout',  () => bg.setFillStyle(0x1a2820));
        bg.on('pointerdown', () => {
          this.sound.play('sfx_ui_click', { volume: 0.5 });
          if (it.kind === 'weapon') this.meta.unlock(it.key);
          else                       this.meta.unlockAbility(it.key, it.cost);
          overlay.destroy(); panel.destroy();
          this.scene.restart();
        });
      }
      y += 58;
    }
    const close = sharp(this, 0, 200, 'FECHAR', { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    panel.add(close);
  }

  _showResetConfirm() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 520, 280, 0x2a0a0a, 1).setStrokeStyle(3, 0xff5a6e, 1));
    panel.add(sharp(this, 0, -100, '⚠  NOVO JOGO  ⚠', { fontFamily: F, fontSize: '24px', fontStyle: 'bold', color: '#ff5a6e' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -60, 'Isto vai APAGAR TODO seu progresso:', { fontFamily: F, fontSize: '14px', color: '#e8f0e6' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -32, '· Moedas acumuladas', { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -12, '· Armas e habilidades desbloqueadas', { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0,   8, '· Bênçãos compradas', { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0,  28, '· Recorde de tempo', { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0.5));

    // Botões
    const yesBg = this.add.rectangle(-120, 80, 200, 44, 0x3a0a0a, 1).setStrokeStyle(2, 0xff5a6e, 1).setInteractive({ useHandCursor: true });
    panel.add(yesBg);
    panel.add(sharp(this, -120, 80, 'SIM, APAGAR', { fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#ff8898' }).setOrigin(0.5));
    yesBg.on('pointerover', () => yesBg.setFillStyle(0x5a1a1a));
    yesBg.on('pointerout',  () => yesBg.setFillStyle(0x3a0a0a));
    yesBg.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: 0.5 });
      this.meta.reset();
      overlay.destroy(); panel.destroy();
      this.scene.restart();
    });

    const noBg = this.add.rectangle(120, 80, 200, 44, 0x0a1410, 1).setStrokeStyle(2, 0xd9b25c, 1).setInteractive({ useHandCursor: true });
    panel.add(noBg);
    panel.add(sharp(this, 120, 80, 'CANCELAR', { fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#e8f0e6' }).setOrigin(0.5));
    noBg.on('pointerover', () => noBg.setFillStyle(0x1a3a20));
    noBg.on('pointerout',  () => noBg.setFillStyle(0x0a1410));
    noBg.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
  }

  _showBlessingsMenu() {
    const W = GAME.WIDTH, H = GAME.HEIGHT;
    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setInteractive().setDepth(500);
    const panel = this.add.container(W / 2, H / 2).setDepth(501);
    panel.add(this.add.rectangle(0, 0, 780, 600, 0x0a1410, 1).setStrokeStyle(3, 0xd9b25c, 1));
    panel.add(sharp(this, 0, -260, 'BÊNÇÃOS', { fontFamily: F, fontSize: '30px', fontStyle: 'bold', color: '#d9b25c' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -224, 'Buffs permanentes para todas as runs', { fontFamily: F, fontSize: '13px', color: '#93a89a' }).setOrigin(0.5));
    panel.add(sharp(this, 0, -200, `${this.meta.coins} moedas disponíveis`, { fontFamily: F, fontSize: '14px', color: '#e8f0e6' }).setOrigin(0.5));

    let y = -150;
    for (const b of BLESSINGS) {
      const has = this.meta.ownsBlessing(b.id);
      const canBuy = !has && this.meta.coins >= b.cost;
      const row = this.add.container(0, y);
      const bg = this.add.rectangle(0, 0, 720, 58, has ? 0x1a3a1a : (canBuy ? 0x1a2820 : 0x141414), 1)
                       .setStrokeStyle(2, has ? 0x6fcf6f : (canBuy ? 0xd9b25c : 0x333333), 1);
      row.add(bg);
      row.add(sharp(this, -340, -12, b.name, {
        fontFamily: F, fontSize: '15px', fontStyle: 'bold',
        color: has ? '#6fcf6f' : (canBuy ? '#e8f0e6' : '#777'),
      }).setOrigin(0, 0.5));
      row.add(sharp(this, -340, 12, b.desc, { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0, 0.5));
      row.add(sharp(this, 340, 0, has ? 'COMPRADA' : `${b.cost} 💰`, {
        fontFamily: F, fontSize: '15px', fontStyle: 'bold',
        color: has ? '#6fcf6f' : (canBuy ? '#d9b25c' : '#666'),
      }).setOrigin(1, 0.5));
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
      y += 66;
    }
    const close = sharp(this, 0, 260, 'FECHAR', { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#d9b25c' })
                  .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      overlay.destroy(); panel.destroy();
      this.scene.restart();
    });
    panel.add(close);
  }
}
