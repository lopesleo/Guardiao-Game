// Arena (D3: boss, meta, dmg numbers, screenshake, onboarding).
import { GAME, COLORS, BOSS, META, ENEMY, WEAPONS } from '../config.js';
import { InputManager } from '../systems/InputManager.js';
import { Pool } from '../systems/Pool.js';
import { SpawnDirector } from '../systems/SpawnDirector.js';
import { ElementalSystem } from '../systems/ElementalSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { Player } from '../entities/Player.js';
import { Enemy, EnemyProjectile, BossEnt } from '../entities/Enemies.js';
import { Projectile, BoomerangProj, Staff, AuraWeapon, Boomerang, ChainLightning, WEAPON_CLASSES } from '../entities/Weapons.js';
import { XPGem, CoinPickup } from '../entities/Pickups.js';
import { DamageNumber } from '../entities/DamageNumber.js';
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

    // Meta-progressão (carrega desbloqueios disponíveis)
    this.meta = new MetaProgression();
    this._coinsGainedThisRun = 0;
    this._newUnlocksThisRun = [];

    // Pools
    this.enemyPool      = new Pool(() => { const e = new Enemy(this, -9999, -9999); e.deactivate(); return e; }, 30);
    this.projectilePool = new Pool(() => new Projectile(this), 30);
    this.boomerPool     = new Pool(() => new BoomerangProj(this), 8);
    this.enemyProjPool  = new Pool(() => new EnemyProjectile(this), 12);
    this.xpPool         = new Pool(() => new XPGem(this), 50);
    this.coinPool       = new Pool(() => new CoinPickup(this), 20);
    this.dmgNumberPool  = new Pool(() => new DamageNumber(this), 30);

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
    this.hud.refreshWeapons();

    // Boss state
    this.elapsedMs = 0;
    this.boss = null;
    this.bossWarned = false;

    // ESC
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.scene.isActive('LevelUpScene')) return;
      this.scene.start('MenuScene');
    });

    // Level-up
    this.events.on('player:levelup', () => {
      const cards = this.upgrades.generateCards(this.player);
      this.scene.pause();
      this.scene.launch('LevelUpScene', { cards, player: this.player, gameScene: this });
    });
    // Quando o LevelUpScene termina, atualiza painel de armas
    this.events.on('resume', () => this.hud.refreshWeapons());

    // Música
    if (!this.bgMusic) {
      this.bgMusic = this.sound.add('music_gameplay', { loop: true, volume: 0.35 });
      this.bgMusic.play();
    }
    this.gameOver = false;

    // Onboarding (D20): 5s, skipável
    this._showOnboarding();
  }

  _drawGround() {
    const r = GAME.WORLD_RADIUS;
    this.cameras.main.setBackgroundColor(0x4a7a3a);
    this.add.tileSprite(0, 0, r * 2, r * 2, 'town_tiles', 0)
            .setOrigin(0.5).setScale(GAME.PIXEL_SCALE).setDepth(-100);
  }

  _showOnboarding() {
    if (this.meta.data.hasSeenOnboarding) return;
    const txt = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT - 130,
      'WASD/setas pra mover. Ataque é automático.\nSuba de nível para escolher armas.',
      {
        fontFamily: 'Press Start 2P, monospace', fontSize: '12px',
        color: '#e8f0e6', stroke: '#000', strokeThickness: 4,
        align: 'center', lineSpacing: 8,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.tweens.add({ targets: txt, alpha: 0, delay: 4500, duration: 500, onComplete: () => txt.destroy() });
    this.meta.data.hasSeenOnboarding = true;
    this.meta._save();
  }

  update(time, dt) {
    if (this.gameOver) return;
    this.elapsedMs += dt;

    // Aviso de boss aos 6:30
    if (!this.bossWarned && this.elapsedMs >= (GAME.RUN_DURATION_S - 30) * 1000) {
      this.bossWarned = true;
      this.hud.showBossBanner('O guardião do bosque desperta…');
    }
    // Spawn do boss aos 7:00
    if (!this.boss && this.elapsedMs >= GAME.RUN_DURATION_S * 1000) {
      this._spawnBoss();
    }

    this.inputMgr.update();
    this.player.update(time, dt, this.inputMgr);
    if (!this.boss) this.spawnDirector.update(time, dt);
    this.elemental.tick(time);
    this.hud.update(time, dt);

    // Boss update
    if (this.boss && this.boss.active) {
      this.boss.update(time, dt, this.player);
      // Contato com player
      const dx = this.boss.x - this.player.x, dy = this.boss.y - this.player.y;
      if (dx * dx + dy * dy < 50 * 50 && time - this.boss.lastTouchAt > this.boss.contactCooldownMs) {
        this.boss.lastTouchAt = time;
        this.player.takeDamage(this.boss.dmg);
        if (this.player.isDead()) this._onGameOver(false);
      }
    }

    // Inimigos
    this.enemyPool.forEachActive(e => {
      e.update(time, dt, this.player);
      const dx = e.x - this.player.x, dy = e.y - this.player.y;
      if (dx * dx + dy * dy < 26 * 26 && time - e.lastTouchAt > e.contactCooldownMs) {
        e.lastTouchAt = time;
        this.player.takeDamage(e.dmg);
        if (this.player.isDead()) this._onGameOver(false);
      }
    });

    // Projéteis retos do player (Cajado etc) — somem no impacto
    this.projectilePool.forEachActive(p => {
      p.update(time);
      if (!p.active) { this.projectilePool.release(p); return; }
      if (this.boss && this.boss.active) {
        const dx = this.boss.x - p.x, dy = this.boss.y - p.y;
        if (dx * dx + dy * dy < 40 * 40) {
          const died = this.boss.takeDamage(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, p.element);
          if (p.element) this.elemental.applyStatus(this.boss, p.element);
          p.kill(); this.projectilePool.release(p);
          if (died) this._onBossDeath();
          return;
        }
      }
      this.enemyPool.forEachActive(e => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) {
          const died = e.takeDamage(p.dmg, p.element);
          this._showDmg(e.x, e.y, p.dmg, p.element);
          p.kill(); this.projectilePool.release(p);
          if (died) this._onEnemyDeath(e);
        }
      });
    });

    // Bumerangues — atravessam inimigos, podem re-hit após cooldown
    this.boomerPool.forEachActive(p => {
      p.update(time, dt);
      if (!p.active) { this.boomerPool.release(p); return; }
      if (this.boss && this.boss.active) {
        const dx = this.boss.x - p.x, dy = this.boss.y - p.y;
        if (dx * dx + dy * dy < 40 * 40 && p.canHit(this.boss, time)) {
          const died = this.boss.takeDamage(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, 'fire');
          this.elemental.applyStatus(this.boss, 'fire');
          if (died) this._onBossDeath();
        }
      }
      this.enemyPool.forEachActive(e => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22 && p.canHit(e, time)) {
          const died = e.takeDamage(p.dmg, 'fire');
          this._showDmg(e.x, e.y, p.dmg, 'fire');
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
        if (this.player.isDead()) this._onGameOver(false);
      }
    });

    // Gemas + moedas
    this.xpPool.forEachActive(g => {
      g.update(time, dt, this.player);
      const dx = g.x - this.player.x, dy = g.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        this.player.gainXp(g.xpValue);
        this.sound.play('sfx_pickup', { volume: 0.18 });
        g.pickup();
        this.xpPool.release(g);
      }
    });
    this.coinPool.forEachActive(c => {
      c.update(time, dt, this.player);
      const dx = c.x - this.player.x, dy = c.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        this._coinsGainedThisRun += META.COIN_VALUE;
        this.hud.addCoin(META.COIN_VALUE);
        this.sound.play('sfx_pickup', { volume: 0.22, rate: 1.3 });
        c.pickup();
        this.coinPool.release(c);
      }
    });
  }

  _showDmg(x, y, dmg, element) {
    const n = this.dmgNumberPool.acquire();
    const color = element === 'ice' ? '#9ad4ff' : element === 'bolt' ? '#d8a8ff' : element === 'fire' ? '#ff9966' : '#ffffff';
    n.show(x, y, dmg, color);
  }

  _onEnemyDeath(enemy) {
    if (!enemy.active) return;
    this.hud.addKill();
    this.sound.play('sfx_death', { volume: 0.15 });
    // Screenshake mini
    this.cameras.main.shake(40, 0.002);
    // Drop XP
    const g = this.xpPool.acquire();
    g.spawn(enemy.x, enemy.y);
    // Chance de moeda
    if (Math.random() < ENEMY.COIN_DROP_CHANCE) {
      const c = this.coinPool.acquire();
      c.spawn(enemy.x + (Math.random() - 0.5) * 10, enemy.y + (Math.random() - 0.5) * 10);
    }
    enemy.deactivate();
    this.enemyPool.release(enemy);
  }

  _spawnBoss() {
    const ang = Math.random() * Math.PI * 2;
    const r = 320;
    const bx = this.player.x + Math.cos(ang) * r;
    const by = this.player.y + Math.sin(ang) * r;
    this.boss = new BossEnt(this, bx, by);
    this.boss.activate(BOSS.HP);
    this.hud.setBossActive(this.boss);
    this.sound.play('sfx_boss_roar', { volume: 0.8 });
    this.cameras.main.shake(500, 0.015);
    // Limpa hordas para o boss respirar
    this.enemyPool.forEachActive(e => {
      e.deactivate();
      this.enemyPool.release(e);
    });
  }

  _onBossDeath() {
    if (!this.boss) return;
    this.boss.deactivate?.();
    this.boss.setActive(false).setVisible(false);
    this.hud.clearBoss();
    // Recompensa
    this._coinsGainedThisRun += META.COIN_BOSS_WIN;
    this.hud.addCoin(META.COIN_BOSS_WIN);
    this.cameras.main.shake(600, 0.02);
    this.time.delayedCall(800, () => this._onGameOver(true));
  }

  _onGameOver(won) {
    if (this.gameOver) return;
    this.gameOver = true;
    // Salva meta
    this.meta.addCoins(this._coinsGainedThisRun);
    this.meta.registerRun(this.elapsedMs / 1000, won);
    this.cameras.main.fade(700, 0, 0, 0);
    this.time.delayedCall(800, () => {
      this.bgMusic?.stop();
      this.bgMusic = null;
      this.scene.start('GameOverScene', {
        won,
        elapsedMs: this.elapsedMs,
        kills: this.hud.kills,
        coinsGained: this._coinsGainedThisRun,
        newUnlocks: this._newUnlocksThisRun,
      });
    });
  }

  shutdown() {
    this.bgMusic?.stop();
    this.bgMusic = null;
  }
}
