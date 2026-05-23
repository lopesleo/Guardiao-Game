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
    // Background limpo: 1 TileSprite de grama + decorações desenhadas (não tiles).
    // Não usamos tiles multi-frame do town pack (árvores são 2 tiles colados, ficam quebradas).
    const r = GAME.WORLD_RADIUS;

    // Cor base da câmera (mesma tonalidade da grama p/ disfarçar borda)
    this.cameras.main.setBackgroundColor(0x4a7a3a);

    // Grama tilada (1 draw call)
    this.add.tileSprite(0, 0, r * 2, r * 2, 'town_tiles', 0)
            .setOrigin(0.5).setScale(GAME.PIXEL_SCALE).setDepth(-100);

    // Decorações 100% drawn — moitas/arbustos
    const g = this.add.graphics().setDepth(-50);
    for (let i = 0; i < 220; i++) {
      const x = (Math.random() - 0.5) * r * 2;
      const y = (Math.random() - 0.5) * r * 2;
      const size = 14 + Math.random() * 22;
      const dark = Phaser.Display.Color.GetColor(
        40 + Math.floor(Math.random() * 25),
        80 + Math.floor(Math.random() * 30),
        35 + Math.floor(Math.random() * 20)
      );
      g.fillStyle(dark, 0.55);
      g.fillCircle(x, y, size);
    }

    // Algumas pedras cinza (graphics)
    const gs = this.add.graphics().setDepth(-45);
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * r * 1.7;
      const y = (Math.random() - 0.5) * r * 1.7;
      if (x * x + y * y < 150 * 150) continue;
      const grey = Phaser.Display.Color.GetColor(80 + Math.random() * 50, 80 + Math.random() * 50, 90);
      gs.fillStyle(grey, 0.9);
      gs.fillEllipse(x, y, 14 + Math.random() * 20, 9 + Math.random() * 12);
      gs.fillStyle(0x000000, 0.25);
      gs.fillEllipse(x + 3, y + 4, 14 + Math.random() * 18, 4);
    }

    // Pequenas flores brancas pontilhadas
    const gf = this.add.graphics().setDepth(-40);
    for (let i = 0; i < 300; i++) {
      const x = (Math.random() - 0.5) * r * 2;
      const y = (Math.random() - 0.5) * r * 2;
      gf.fillStyle(0xfff5b8, 0.85);
      gf.fillCircle(x, y, 1.5);
    }

    // Vinheta forte: foca atenção no centro da tela
    const vw = GAME.WIDTH, vh = GAME.HEIGHT;
    const vig = this.add.graphics().setScrollFactor(0).setDepth(900);
    vig.fillStyle(0x000000, 0.55);
    vig.fillRect(0, 0, vw, 60);
    vig.fillRect(0, vh - 60, vw, 60);
    vig.fillRect(0, 60, 60, vh - 120);
    vig.fillRect(vw - 60, 60, 60, vh - 120);
    // gradiente suave nos cantos via mais retângulos com alpha menor
    vig.fillStyle(0x000000, 0.30);
    vig.fillRect(0, 60, 90, vh - 120);
    vig.fillRect(vw - 90, 60, 90, vh - 120);
    vig.fillRect(60, 0, vw - 120, 90);
    vig.fillRect(60, vh - 90, vw - 120, 90);
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
