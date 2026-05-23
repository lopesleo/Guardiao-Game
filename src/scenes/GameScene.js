// Arena principal (D1: Player, Wolves, Staff, XP gems, HUD).
// D2 adiciona: outras armas, outros inimigos, reações, level-up.
import { GAME, COLORS } from '../config.js';
import { InputManager } from '../systems/InputManager.js';
import { Pool } from '../systems/Pool.js';
import { SpawnDirector } from '../systems/SpawnDirector.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemies.js';
import { Projectile, Staff } from '../entities/Weapons.js';
import { XPGem } from '../entities/Pickups.js';
import { HUD } from '../ui/HUD.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    // Mundo enorme — câmera segue o player
    const WS = GAME.WORLD_RADIUS * 2;
    this.physics.world.setBounds(-GAME.WORLD_RADIUS, -GAME.WORLD_RADIUS, WS, WS);
    this.cameras.main.setBackgroundColor(0x0e1a14);

    this._drawGround();

    // Input
    this.inputMgr = new InputManager(this);

    // Pools (expostos como this.* para outras classes lerem)
    this.enemyPool      = new Pool(() => { const e = new Enemy(this, -9999, -9999); e.deactivate(); return e; }, 30);
    this.projectilePool = new Pool(() => new Projectile(this), 30);
    this.xpPool         = new Pool(() => new XPGem(this), 50);

    // Player
    this.player = new Player(this, 0, 0);
    this.player.addWeapon(new Staff(this));

    // Spawner
    this.spawnDirector = new SpawnDirector(this, this.enemyPool, this.player);

    // Câmera
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);

    // HUD
    this.hud = new HUD(this, this.player);

    // Colisões: usamos overlap manual (mais flexível pra pooling)
    // (Não criamos groups; iteramos os pools por simplicidade D1.)

    // Voltar pro menu com ESC (D24: só funciona na GameScene)
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.scene.isActive('LevelUpScene')) return;
      this.scene.start('MenuScene');
    });

    // Música ambiente
    if (!this.bgMusic) {
      this.bgMusic = this.sound.add('music_gameplay', { loop: true, volume: 0.35 });
      this.bgMusic.play();
    }

    // Evento de game over (D3 vai fazer scene de GameOver bonita)
    this.gameOver = false;
  }

  _drawGround() {
    // Background: grama base (TileSprite — 1 draw call), depois decorações esparsas.
    // Não usar tint, deixa cor original do sprite.
    const r = GAME.WORLD_RADIUS;
    const TS = 16 * GAME.PIXEL_SCALE;

    // Cor de fundo da câmera (visível quando sai da grama)
    this.cameras.main.setBackgroundColor(0x2a3a25);

    // Grama base — uma TileSprite enorme, repete frame 0 (grama lisa).
    this.add.tileSprite(0, 0, r * 2, r * 2, 'town_tiles', 0)
            .setOrigin(0.5).setScale(GAME.PIXEL_SCALE).setDepth(-100);

    // Tufos/flores espalhados (frame 1, 2, 12, 13)
    const TUFT_FRAMES = [1, 2, 12, 13, 14];
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * r * 2;
      const y = (Math.random() - 0.5) * r * 2;
      const f = TUFT_FRAMES[Math.floor(Math.random() * TUFT_FRAMES.length)];
      this.add.image(x, y, 'town_tiles', f)
              .setScale(GAME.PIXEL_SCALE).setDepth(-90);
    }

    // Patches de terra (frames 24-26, 36-38)
    const DIRT_FRAMES = [24, 25, 26];
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * r * 1.7;
      const y = (Math.random() - 0.5) * r * 1.7;
      const f = DIRT_FRAMES[Math.floor(Math.random() * DIRT_FRAMES.length)];
      this.add.image(x, y, 'town_tiles', f)
              .setScale(GAME.PIXEL_SCALE * 1.3).setDepth(-95).setAlpha(0.85);
    }

    // Árvores (frames 3-11 e 15-23 são árvores variadas)
    const TREE_FRAMES = [3, 4, 5, 6, 7, 15, 16, 18, 27, 28, 30, 31];
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 220 + Math.random() * (r - 280);
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      const f = TREE_FRAMES[Math.floor(Math.random() * TREE_FRAMES.length)];
      this.add.image(x, y, 'town_tiles', f)
              .setScale(GAME.PIXEL_SCALE).setDepth(y);
    }

    // Vinheta sutil: escurece bordas da câmera.
    const vw = GAME.WIDTH, vh = GAME.HEIGHT;
    const vig = this.add.graphics().setScrollFactor(0).setDepth(900);
    vig.fillStyle(0x000000, 0.45);
    vig.fillRect(0, 0, vw, 50);
    vig.fillRect(0, vh - 50, vw, 50);
    vig.fillRect(0, 50, 50, vh - 100);
    vig.fillRect(vw - 50, 50, 50, vh - 100);
  }

  update(time, dt) {
    if (this.gameOver) return;

    this.inputMgr.update();
    this.player.update(time, dt, this.inputMgr);
    this.spawnDirector.update(time, dt);
    this.hud.update(time, dt);

    // Atualiza inimigos
    this.enemyPool.forEachActive(e => {
      e.update(time, dt, this.player);
      // Contato com player
      const dx = e.x - this.player.x, dy = e.y - this.player.y;
      if (dx * dx + dy * dy < 26 * 26) {
        if (time - e.lastTouchAt > e.contactCooldownMs) {
          e.lastTouchAt = time;
          this.player.takeDamage(e.dmg);
          if (this.player.isDead()) this._onGameOver();
        }
      }
    });

    // Atualiza projéteis + colisão com inimigos
    this.projectilePool.forEachActive(p => {
      p.update(time);
      if (!p.active) { this.projectilePool.release(p); return; }
      this.enemyPool.forEachActive(e => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 18 * 18) {
          const died = e.takeDamage(p.dmg, p.element);
          p.kill();
          this.projectilePool.release(p);
          if (died) this._onEnemyDeath(e);
        }
      });
    });

    // Atualiza gemas XP
    this.xpPool.forEachActive(g => {
      g.update(time, dt, this.player);
      const dx = g.x - this.player.x, dy = g.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        this.player.gainXp(g.xpValue);
        this.sound.play('sfx_pickup', { volume: 0.25 });
        g.pickup();
        this.xpPool.release(g);
      }
    });
  }

  _onEnemyDeath(enemy) {
    this.hud.addKill();
    this.sound.play('sfx_death', { volume: 0.25 });
    // Drop XP gem
    const g = this.xpPool.acquire();
    g.spawn(enemy.x, enemy.y);
    // Recicla inimigo
    enemy.deactivate();
    this.enemyPool.release(enemy);
  }

  _onGameOver() {
    this.gameOver = true;
    this.cameras.main.fade(700, 0, 0, 0);
    this.time.delayedCall(800, () => {
      this.bgMusic?.stop();
      this.bgMusic = null;
      this.scene.start('MenuScene');
    });
  }

  shutdown() {
    this.bgMusic?.stop();
    this.bgMusic = null;
  }
}
