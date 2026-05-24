// Preload: carrega todos os assets com barra de progresso.
import { COLORS, GAME } from '../config.js';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload() {
    this._drawBar();

    // ---- Sprites ----
    this.load.spritesheet('dungeon_tiles', 'assets/sprites/dungeon_packed.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('town_tiles',    'assets/sprites/town_packed.png',    { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('creatures',     'assets/sprites/enemies/creatures_packed.png', { frameWidth: 16, frameHeight: 16 });

    // ---- Áudio ----
    this.load.audio('music_menu',      'assets/audio/music/menu_theme.mp3');
    this.load.audio('music_gameplay',  'assets/audio/music/ambient_gameplay.ogg');
    this.load.audio('sfx_hit',         'assets/audio/sfx/hit_enemy.ogg');
    this.load.audio('sfx_death',       'assets/audio/sfx/enemy_death.ogg');
    this.load.audio('sfx_pickup',      'assets/audio/sfx/pickup.ogg');
    this.load.audio('sfx_levelup',     'assets/audio/sfx/level_up.ogg');
    this.load.audio('sfx_player_hit',  'assets/audio/sfx/player_hit.ogg');
    this.load.audio('sfx_boss_roar',   'assets/audio/sfx/boss_roar.ogg');
    // Novos (chest + UI + coin)
    this.load.audio('sfx_chest_open',    'assets/audio/sfx/chest_open.ogg');
    this.load.audio('sfx_chest_reel',    'assets/audio/sfx/chest_reel.ogg');
    this.load.audio('sfx_chest_jackpot', 'assets/audio/sfx/chest_jackpot.ogg');
    this.load.audio('sfx_chest_trap',    'assets/audio/sfx/chest_trap.ogg');
    this.load.audio('sfx_coin',          'assets/audio/sfx/coin.ogg');
    this.load.audio('sfx_coin_cascade',  'assets/audio/sfx/coin_cascade.ogg');
    this.load.audio('sfx_ui_click',      'assets/audio/sfx/ui_click.ogg');
    this.load.audio('sfx_ui_hover',      'assets/audio/sfx/ui_hover.ogg');
  }

  create() {
    this.scene.start('MenuScene');
  }

  _drawBar() {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2, cy = height / 2;

    this.add.text(cx, cy - 60, 'Carregando...', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '18px',
      color: '#e8f0e6',
    }).setOrigin(0.5);

    const barW = 400, barH = 16;
    const bg = this.add.rectangle(cx, cy, barW, barH, 0x222222).setStrokeStyle(2, COLORS.GOLD);
    const fill = this.add.rectangle(cx - barW / 2 + 2, cy, 0, barH - 4, COLORS.GOLD).setOrigin(0, 0.5);

    this.load.on('progress', v => { fill.width = (barW - 4) * v; });
  }
}
