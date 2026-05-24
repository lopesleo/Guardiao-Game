// Arena (D3: boss, meta, dmg numbers, screenshake, onboarding).
import { GAME, COLORS, BOSS, META, ENEMY, WEAPONS, PLAYER, BLESSINGS, DROPS, CHEST } from '../config.js';
import { InputManager } from '../systems/InputManager.js';
import { Pool } from '../systems/Pool.js';
import { SpawnDirector } from '../systems/SpawnDirector.js';
import { ElementalSystem } from '../systems/ElementalSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { Player } from '../entities/Player.js';
import { Enemy, EnemyProjectile, BossEnt } from '../entities/Enemies.js';
import { Projectile, BoomerangProj, Staff, AuraWeapon, Boomerang, ChainLightning, WEAPON_CLASSES } from '../entities/Weapons.js';
import { XPGem, CoinPickup, HeartPickup, AwakenOrb } from '../entities/Pickups.js';
import { Chest } from '../entities/Chest.js';
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
    this.heartPool      = new Pool(() => new HeartPickup(this), 10);
    this.awakenOrbPool  = new Pool(() => new AwakenOrb(this), 10);
    this.dmgNumberPool  = new Pool(() => new DamageNumber(this), 30);

    // Sistemas
    this.elemental = new ElementalSystem(this);
    this.upgrades  = new UpgradeSystem(this);

    // Player
    this.player = new Player(this, 0, 0);
    // Aplica bênçãos compradas ANTES de criar armas (afetam stats base)
    const owned = this.meta.ownedBlessings();
    for (const b of BLESSINGS) {
      if (owned.includes(b.id)) b.apply(this.player);
    }
    // Locks de habilidades: bloqueia se não comprou
    this.player.dashUnlocked   = this.meta.hasAbility('DASH');
    this.player.awakenUnlocked = this.meta.hasAbility('AWAKEN');
    this.player.addWeapon(new Staff(this));

    // Spawner
    this.spawnDirector = new SpawnDirector(this, this.enemyPool, this.player);

    // Baús — STARTING_COUNT espalhados aleatoriamente fora do spawn do player
    this.chests = [];
    for (let i = 0; i < CHEST.STARTING_COUNT; i++) {
      const pos = this._randomChestPos();
      this.chests.push(new Chest(this, pos.x, pos.y));
    }
    this._killsSinceLastChest = 0;

    // Câmera — segue player mas trava nas bordas do mundo
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(-GAME.WORLD_RADIUS, -GAME.WORLD_RADIUS, WS, WS);

    // HUD
    this.hud = new HUD(this, this.player);
    this.hud.refreshWeapons();

    // Boss state
    this.elapsedMs = 0;
    this.boss = null;
    this.bossWarned = false;

    // ESC → pausa (não sai mais direto)
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.scene.isActive('LevelUpScene')) return;
      if (this.scene.isActive('PauseScene')) return;
      this.scene.pause();
      this.scene.launch('PauseScene');
    });

    // ====== DEBUG KEYS (remover antes da entrega final se quiser) ======
    this.input.keyboard.on('keydown-NINE', () => {
      // Enche Despertar
      this.player.awakenMeter = this.player.awakenMax;
      this._toast('★ Despertar cheio');
    });
    this.input.keyboard.on('keydown-EIGHT', () => {
      // Level up imediato
      const need = PLAYER.XP_PER_LEVEL(this.player.level) - this.player.xp;
      this.player.gainXp(need);
      this._toast(`LV ${this.player.level}`);
    });
    this.input.keyboard.on('keydown-SEVEN', () => {
      // Adiciona +20s ao timer (acelera spawn + aproxima boss)
      this.elapsedMs += 20000;
      this._toast(`+20s (agora ${Math.floor(this.elapsedMs / 1000)}s)`);
    });
    this.input.keyboard.on('keydown-ZERO', () => {
      // Spawna boss agora
      if (!this.boss) {
        this.elapsedMs = GAME.RUN_DURATION_S * 1000;
        this._spawnBoss();
        this._toast('BOSS spawned');
      } else {
        this._toast('Boss já está vivo');
      }
    });
    this.input.keyboard.on('keydown-G', () => {
      // God mode toggle
      this._god = !this._god;
      this._toast(`GOD MODE: ${this._god ? 'ON' : 'OFF'}`);
    });
    this.input.keyboard.on('keydown-K', () => {
      // Kill all enemies
      let n = 0;
      this.enemyPool.forEachActive(e => { e.hp = 0; this._onEnemyDeath(e); n++; });
      this._toast(`Killed ${n} enemies`);
    });
    this.input.keyboard.on('keydown-H', () => {
      // Heal full
      this.player.hp = this.player.maxHp;
      this._toast('HP full');
    });
    this.input.keyboard.on('keydown-T', () => {
      // Mostrar lista de teclas de debug
      this._toast('9=Awaken 8=+50XP 7=+20s 0=Boss G=God K=KillAll H=Heal', 4500);
    });
    // =================================================================

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
    const TS = 16 * GAME.PIXEL_SCALE;
    this.cameras.main.setBackgroundColor(0x4a7a3a);

    // Grama base limpa (frame 0)
    this.add.tileSprite(0, 0, r * 2, r * 2, 'town_tiles', 0)
            .setOrigin(0.5).setScale(GAME.PIXEL_SCALE).setDepth(-100);

    // Single-tile decorações verificadas no PNG
    const SINGLE = [
      { f: 1,  weight: 6 },   // grama com flores discretas
      { f: 2,  weight: 4 },   // grama com flores mais marcadas
      { f: 29, weight: 3 },   // cogumelos vermelhos
      { f: 43, weight: 2 },   // calçamento de pedra cinza
    ];
    const pickWeighted = arr => {
      const total = arr.reduce((s, x) => s + x.weight, 0);
      let r2 = Math.random() * total;
      for (const x of arr) { r2 -= x.weight; if (r2 <= 0) return x.f; }
      return arr[0].f;
    };

    // Áreas de exclusão (centro = spawn do player)
    const isClear = (x, y) => (x * x + y * y) > (220 * 220);

    // === Decoração procedural via GRID + JITTER ===
    // Cobre o mapa inteiro com densidade uniforme.

    // Single-tile decorações: célula 192px (4 tiles), 75% chance por célula
    const decoCell = 192;
    for (let cy = -r; cy < r; cy += decoCell) {
      for (let cx = -r; cx < r; cx += decoCell) {
        if (Math.random() > 0.75) continue;
        const x = cx + Math.random() * decoCell;
        const y = cy + Math.random() * decoCell;
        if (!isClear(x, y)) continue;
        const f = pickWeighted(SINGLE);
        this.add.image(x, y, 'town_tiles', f)
                .setScale(GAME.PIXEL_SCALE).setDepth(-50);
      }
    }

    // Árvores 2-tile: célula 384px (8 tiles), 45% chance por célula
    const TREES = [
      [3, 15],  // árvore outono laranja
      [4, 16],  // pinheiro verde
      [5, 17],  // arbusto redondo
    ];
    const treeCell = 384;
    for (let cy = -r; cy < r; cy += treeCell) {
      for (let cx = -r; cx < r; cx += treeCell) {
        if (Math.random() > 0.45) continue;
        const x = cx + Math.random() * treeCell;
        const y = cy + Math.random() * treeCell;
        if (!isClear(x, y)) continue;
        const [top, bot] = TREES[Math.floor(Math.random() * TREES.length)];
        this.add.image(x, y,      'town_tiles', bot).setScale(GAME.PIXEL_SCALE).setDepth(y + 10000);
        this.add.image(x, y - TS, 'town_tiles', top).setScale(GAME.PIXEL_SCALE).setDepth(y + 10000);
      }
    }
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

    // Baús: glow/prompt + interação E
    let chestPressed = this.inputMgr.consumeInteract();
    for (const c of this.chests) {
      if (c.opened) continue;
      c.update(time, this.player);
      if (chestPressed && c.playerNear) {
        chestPressed = false;
        this._openChest(c);
      }
    }

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
        if (!this._god) {
          this.player.takeDamage(e.dmg);
          if (this.player.isDead()) this._onGameOver(false);
        }
      }
    });

    // Projéteis retos do player (Cajado etc) — somem no impacto
    this.projectilePool.forEachActive(p => {
      p.update(time);
      if (!p.active) { this.projectilePool.release(p); return; }
      if (this.boss && this.boss.active) {
        const dx = this.boss.x - p.x, dy = this.boss.y - p.y;
        if (dx * dx + dy * dy < 40 * 40) {
          const died = this.boss.takeDamage(p.dmg, null, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, p.element, p.crit);
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
          const died = e.takeDamage(p.dmg, p.element, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(e.x, e.y, p.dmg, p.element, p.crit);
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
          const died = this.boss.takeDamage(p.dmg, null, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, 'fire', p.crit);
          this.elemental.applyStatus(this.boss, 'fire');
          if (died) this._onBossDeath();
        }
      }
      this.enemyPool.forEachActive(e => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22 && p.canHit(e, time)) {
          const died = e.takeDamage(p.dmg, 'fire', p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(e.x, e.y, p.dmg, 'fire', p.crit);
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
        this.sound.play('sfx_coin', { volume: 0.35, rate: 1.2 });
        c.pickup();
        this.coinPool.release(c);
      }
    });
    // Corações
    this.heartPool.forEachActive(h => {
      h.update(time, dt, this.player);
      const dx = h.x - this.player.x, dy = h.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        this.player.healHp(DROPS.HEART_HEAL);
        this.sound.play('sfx_pickup', { volume: 0.3, rate: 0.85 });
        this._showDmg(this.player.x, this.player.y - 10, DROPS.HEART_HEAL, 'heal');
        h.pickup();
        this.heartPool.release(h);
      }
    });
    // Orbes de Despertar
    this.awakenOrbPool.forEachActive(o => {
      o.update(time, dt, this.player);
      const dx = o.x - this.player.x, dy = o.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        this.player.refillAwaken(DROPS.AWAKEN_REFILL);
        this.sound.play('sfx_pickup', { volume: 0.3, rate: 1.6 });
        o.pickup();
        this.awakenOrbPool.release(o);
      }
    });
  }

  _toast(msg, ms = 1500) {
    const t = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT - 80, msg, {
      fontFamily: 'Press Start 2P, monospace', fontSize: '12px',
      color: '#ffd96b', stroke: '#000', strokeThickness: 3,
      backgroundColor: '#000000', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60000);
    this.tweens.add({ targets: t, alpha: 0, delay: ms - 300, duration: 300, onComplete: () => t.destroy() });
  }

  _showDmg(x, y, dmg, element, crit = false) {
    const n = this.dmgNumberPool.acquire();
    let color;
    if (crit)                       color = '#ffd96b';
    else if (element === 'ice')     color = '#9ad4ff';
    else if (element === 'bolt')    color = '#d8a8ff';
    else if (element === 'fire')    color = '#ff9966';
    else if (element === 'heal')    color = '#6fcf6f';
    else                            color = '#ffffff';
    const text = element === 'heal' ? `+${dmg}` : (crit ? `${Math.ceil(dmg)}!` : dmg);
    n.show(x, y, text, color, crit);
  }

  _onEnemyDeath(enemy) {
    if (!enemy.active) return;
    this.hud.addKill();
    this.player.addAwakenMeter(PLAYER.AWAKEN_GAIN_KILL);
    this._killsSinceLastChest = (this._killsSinceLastChest || 0) + 1;
    if (this._killsSinceLastChest >= CHEST.KILL_DROP_EVERY) {
      this._killsSinceLastChest = 0;
      const pos = this._randomChestPos();
      this.chests.push(new Chest(this, pos.x, pos.y));
    }
    this.sound.play('sfx_death', { volume: 0.15 });
    this.cameras.main.shake(40, 0.002);
    // Drop XP sempre
    const g = this.xpPool.acquire();
    g.spawn(enemy.x, enemy.y);
    // Drops aleatórios
    const r = Math.random();
    if (r < DROPS.COIN_CHANCE) {
      const c = this.coinPool.acquire();
      c.spawn(enemy.x + (Math.random() - 0.5) * 10, enemy.y + (Math.random() - 0.5) * 10);
    } else if (r < DROPS.COIN_CHANCE + DROPS.HEART_CHANCE) {
      const h = this.heartPool.acquire();
      h.spawn(enemy.x, enemy.y);
    } else if (r < DROPS.COIN_CHANCE + DROPS.HEART_CHANCE + DROPS.AWAKEN_CHANCE) {
      const o = this.awakenOrbPool.acquire();
      o.spawn(enemy.x, enemy.y);
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

  _randomChestPos() {
    const r = GAME.WORLD_RADIUS - 100;
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * r * 2;
      const y = (Math.random() - 0.5) * r * 2;
      const dx = x - (this.player?.x ?? 0), dy = y - (this.player?.y ?? 0);
      if (dx * dx + dy * dy > 250 * 250) return { x, y };
    }
    return { x: 0, y: 300 };
  }

  _openChest(chest) {
    const result = chest.open();
    if (!result) return;
    const { kind, x, y } = result;

    // Som de abertura imediato
    this.sound.play('sfx_chest_open', { volume: 0.7 });

    // CAÇA-NÍQUEL: "reels" — 3 ticks de ficha ascendentes (suspense)
    const reelRates = [1.0, 1.15, 1.30];
    reelRates.forEach((rate, i) => {
      this.time.delayedCall(150 + i * 130, () => {
        this.sound.play('sfx_chest_reel', { volume: 0.7, rate });
      });
    });

    // Burst de partículas + reveal SFX
    const burstDelay = 150 + reelRates.length * 130;
    this.time.delayedCall(burstDelay, () => this._chestBurst(x, y, kind));

    // Loot spawnado DEPOIS dos reels (caça-níquel revela)
    this.time.delayedCall(burstDelay + 50, () => {
      const ngems = Phaser.Math.Between(CHEST.GEMS_MIN, CHEST.GEMS_MAX);
      const ncoins = Phaser.Math.Between(CHEST.COINS_MIN, CHEST.COINS_MAX);
      for (let i = 0; i < ngems; i++) {
        const g = this.xpPool.acquire();
        const ang = Math.random() * Math.PI * 2;
        const d = 8 + Math.random() * 22;
        g.spawn(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
      }
      for (let i = 0; i < ncoins; i++) {
        const c = this.coinPool.acquire();
        const ang = Math.random() * Math.PI * 2;
        const d = 8 + Math.random() * 22;
        c.spawn(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
      }
      if (Math.random() < CHEST.HEART_CHANCE_OPEN) {
        const h = this.heartPool.acquire(); h.spawn(x - 22, y);
      }
      if (Math.random() < CHEST.AWAKEN_CHANCE_OPEN) {
        const o = this.awakenOrbPool.acquire(); o.spawn(x + 22, y);
      }
    });

    if (kind === 'golden') {
      // JACKPOT: chips colliding + level-up + coin cascade
      this.time.delayedCall(burstDelay, () => {
        this.sound.play('sfx_chest_jackpot', { volume: 0.9 });
        this.sound.play('sfx_levelup', { volume: 0.6, rate: 1.1 });
      });
      this.time.delayedCall(burstDelay + 300, () => {
        // Cascata de moedas de verdade
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 130, () => {
            this.sound.play('sfx_coin_cascade', { volume: 0.55, rate: 1.0 + i * 0.08 });
          });
        }
      });
      // Bonus de moedas
      this.time.delayedCall(burstDelay + 200, () => {
        for (let i = 0; i < CHEST.GOLDEN_EXTRA_COINS; i++) {
          this.time.delayedCall(i * 20, () => {
            const c = this.coinPool.acquire();
            const ang = Math.random() * Math.PI * 2;
            const d = 12 + Math.random() * 36;
            c.spawn(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
          });
        }
      });
      this._toast('★ BAÚ DOURADO! ★', 2200);
      // Carta extra grátis
      this.time.delayedCall(burstDelay + 1200, () => this.events.emit('player:levelup', this.player.level));
    } else if (kind === 'trap') {
      this.time.delayedCall(burstDelay, () => {
        this.sound.play('sfx_chest_trap', { volume: 0.8 });
        this.sound.play('sfx_boss_roar', { volume: 0.5, rate: 0.7 });
        this.cameras.main.shake(280, 0.018);
      });
      this._toast('⚠ ARMADILHA!', 1500);
      const wave = Math.floor(this.elapsedMs / 30000);
      const types = ['wolf', 'crow', 'goblin'];
      for (let i = 0; i < CHEST.TRAP_ENEMY_COUNT; i++) {
        if (this.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) break;
        const ang = (i / CHEST.TRAP_ENEMY_COUNT) * Math.PI * 2 + Math.random() * 0.5;
        const sx = x + Math.cos(ang) * 60;
        const sy = y + Math.sin(ang) * 60;
        const e = this.enemyPool.acquire();
        const k = types[Math.floor(Math.random() * types.length)];
        e.activate(sx, sy, k, wave, true);
      }
    } else if (kind === 'mimic') {
      // MÍMICO: 1 inimigo super forte spawna no LOCAL do baú
      this.time.delayedCall(burstDelay, () => {
        this.sound.play('sfx_chest_trap', { volume: 1.0, rate: 0.6 });
        this.sound.play('sfx_boss_roar', { volume: 0.7, rate: 0.85 });
        this.cameras.main.shake(450, 0.025);
        this.cameras.main.flash(150, 200, 40, 40);
      });
      this._toast('☠ MÍMICO! ☠', 1800);
      const wave = Math.floor(this.elapsedMs / 30000);
      const types = ['goblin', 'wolf'];
      this.time.delayedCall(burstDelay + 200, () => {
        if (this.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) return;
        const e = this.enemyPool.acquire();
        const k = types[Math.floor(Math.random() * types.length)];
        e.activate(x, y, k, wave, 'mimic');
      });
    } else {
      // Normal: pequeno dingdong de moedas
      this.time.delayedCall(burstDelay, () => {
        this.sound.play('sfx_coin', { volume: 0.7 });
      });
    }
  }

  _chestBurst(x, y, kind) {
    const color = kind === 'trap' ? 0xff5a6e : (kind === 'golden' ? 0xffe88a : 0xffd96b);
    // 14 partículas pequenas voando pra fora
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const p = this.add.circle(x, y, 4, color, 1).setDepth(y + 10500);
      const dist = 50 + Math.random() * 40;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    // Flash radial breve
    const ring = this.add.circle(x, y, 8, color, 0).setStrokeStyle(4, color, 1).setDepth(y + 10500);
    this.tweens.add({
      targets: ring, radius: 60, alpha: 0, duration: 400,
      onComplete: () => ring.destroy(),
    });
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
