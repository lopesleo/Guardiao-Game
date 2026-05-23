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
    // Background simples e limpo. Só grama tilada — sem decorações inventadas.
    const r = GAME.WORLD_RADIUS;
    this.cameras.main.setBackgroundColor(0x4a7a3a);
    this.add.tileSprite(0, 0, r * 2, r * 2, 'town_tiles', 0)
            .setOrigin(0.5).setScale(GAME.PIXEL_SCALE).setDepth(-100);
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
