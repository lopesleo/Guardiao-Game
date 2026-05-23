// Arena principal (D2: armas, inimigos, reações, level-up, joystick).
import { GAME, COLORS } from '../config.js';
import { InputManager } from '../systems/InputManager.js';
import { Pool } from '../systems/Pool.js';
import { SpawnDirector } from '../systems/SpawnDirector.js';
import { ElementalSystem } from '../systems/ElementalSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { Player } from '../entities/Player.js';
import { Enemy, EnemyProjectile } from '../entities/Enemies.js';
import { Projectile, Staff } from '../entities/Weapons.js';
import { XPGem } from '../entities/Pickups.js';
import { HUD } from '../ui/HUD.js';
import { VirtualJoystick } from '../ui/VirtualJoystick.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    const WS = GAME.WORLD_RADIUS * 2;
    this.physics.world.setBounds(-GAME.WORLD_RADIUS, -GAME.WORLD_RADIUS, WS, WS);

    this._drawGround();

    this.inputMgr = new InputManager(this);
    this.joystick = new VirtualJoystick(this.inputMgr);

    // Pools
    this.enemyPool       = new Pool(() => { const e = new Enemy(this, -9999, -9999); e.deactivate(); return e; }, 30);
    this.projectilePool  = new Pool(() => new Projectile(this), 30);
    this.enemyProjPool   = new Pool(() => new EnemyProjectile(this), 12);
    this.xpPool          = new Pool(() => new XPGem(this), 50);

    // Sistemas
    this.elemental = new ElementalSystem(this);
    this.upgrades  = new UpgradeSystem(this);

    // Player
    this.player = new Player(this, 0, 0);
    this.player.addWeapon(new Staff(this));

    // Spawner
    this.spawnDirector = new SpawnDirector(this, this.enemyPool, this.player);

    // Câmera
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // HUD
    this.hud = new HUD(this, this.player);

    // ESC volta ao menu (D24: só se nenhuma cena sobre estiver ativa)
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.scene.isActive('LevelUpScene')) return;
      this.scene.start('MenuScene');
    });

    // Level-up: pausa GameScene, abre LevelUpScene
    this.events.on('player:levelup', () => {
      const cards = this.upgrades.generateCards(this.player);
      this.scene.pause();
      this.scene.launch('LevelUpScene', { cards, player: this.player, gameScene: this });
    });

    // Música
    if (!this.bgMusic) {
      this.bgMusic = this.sound.add('music_gameplay', { loop: true, volume: 0.35 });
      this.bgMusic.play();
    }

    this.gameOver = false;
  }

  _drawGround() {
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
    this.elemental.tick(time);
    this.hud.update(time, dt);

    // Inimigos
    this.enemyPool.forEachActive(e => {
      e.update(time, dt, this.player);
      const dx = e.x - this.player.x, dy = e.y - this.player.y;
      if (dx * dx + dy * dy < 26 * 26) {
        if (time - e.lastTouchAt > e.contactCooldownMs) {
          e.lastTouchAt = time;
          this.player.takeDamage(e.dmg);
          if (this.player.isDead()) this._onGameOver();
        }
      }
    });

    // Projéteis do player
    this.projectilePool.forEachActive(p => {
      p.update(time, dt);
      if (!p.active) { this.projectilePool.release(p); return; }
      this.enemyPool.forEachActive(e => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) {
          const died = e.takeDamage(p.dmg, p.element);
          // Bumerangue não morre no impacto; staff/outras sim
          if (p.behavior !== 'boomerang') {
            p.kill();
            this.projectilePool.release(p);
          }
          if (died) this._onEnemyDeath(e);
        }
      });
    });

    // Projéteis dos inimigos
    this.enemyProjPool.forEachActive(p => {
      p.update(time);
      if (!p.active) { this.enemyProjPool.release(p); return; }
      const dx = p.x - this.player.x, dy = p.y - this.player.y;
      if (dx * dx + dy * dy < 22 * 22) {
        this.player.takeDamage(p.dmg);
        p.kill();
        this.enemyProjPool.release(p);
        if (this.player.isDead()) this._onGameOver();
      }
    });

    // Gemas XP
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
    if (!enemy.active) return;
    this.hud.addKill();
    this.sound.play('sfx_death', { volume: 0.18 });
    const g = this.xpPool.acquire();
    g.spawn(enemy.x, enemy.y);
    enemy.deactivate();
    this.enemyPool.release(enemy);
  }

  _onGameOver() {
    if (this.gameOver) return;
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
