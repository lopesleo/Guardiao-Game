// Arena (D3: boss, meta, dmg numbers, screenshake, onboarding).
import {
  GAME,
  COLORS,
  BOSS,
  META,
  ENEMY,
  WEAPONS,
  PLAYER,
  BLESSINGS,
  DROPS,
  CHEST,
  DIFFICULTY,
  ANCESTRAL,
  CHARACTERS,
} from "../config.js";
import { InputManager } from "../systems/InputManager.js";
import { Pool } from "../systems/Pool.js";
import { SpawnDirector } from "../systems/SpawnDirector.js";
import { ElementalSystem } from "../systems/ElementalSystem.js";
import { UpgradeSystem } from "../systems/UpgradeSystem.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Player } from "../entities/Player.js";
import { Enemy, EnemyProjectile, BossEnt } from "../entities/Enemies.js";
import {
  Projectile,
  BoomerangProj,
  Staff,
  AuraWeapon,
  Boomerang,
  ChainLightning,
  WEAPON_CLASSES,
} from "../entities/Weapons.js";
import {
  XPGem,
  CoinPickup,
  HeartPickup,
  AwakenOrb,
} from "../entities/Pickups.js";
import { Chest } from "../entities/Chest.js";
import { DamageNumber } from "../entities/DamageNumber.js";
import { HUD } from "../ui/HUD.js";
import { ForestWorld } from "../world/ForestWorld.js";
import { text, drawFrame } from "../ui/Theme.js";
import { DEBUG } from "../systems/Platform.js";
import { Settings } from "../systems/Settings.js";
import { VirtualJoystick } from "../ui/VirtualJoystick.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    const WS = GAME.WORLD_RADIUS * 2;
    this.physics.world.setBounds(
      -GAME.WORLD_RADIUS,
      -GAME.WORLD_RADIUS,
      WS,
      WS,
    );
    this.world = new ForestWorld(this);

    this.inputMgr = new InputManager(this);
    this.joystick = new VirtualJoystick(this.inputMgr);

    // Meta-progressão (carrega desbloqueios disponíveis)
    this.meta = new MetaProgression();
    // Dificuldade da run (clampa ao desbloqueado por segurança)
    const diffIdx = Math.min(this.meta.selectedDifficulty, DIFFICULTY.length - 1);
    this.diff = DIFFICULTY[diffIdx] || DIFFICULTY[0];
    this._coinsGainedThisRun = 0;
    this._showDmgNumbers = Settings.get("dmgNumbers");
    this._newUnlocksThisRun = [];
    // Conquistas (Fase 3): flags observadas pelos check() de ACHIEVEMENTS
    this._runFlags = { tookHpPassive: false };
    this._survive10Checked = false;

    // Pools
    this.enemyPool = new Pool(() => {
      const e = new Enemy(this, -9999, -9999);
      e.deactivate();
      return e;
    }, 30);
    this.projectilePool = new Pool(() => new Projectile(this), 30);
    this.boomerPool = new Pool(() => new BoomerangProj(this), 8);
    this.enemyProjPool = new Pool(() => new EnemyProjectile(this), 12);
    this.xpPool = new Pool(() => new XPGem(this), 50);
    this.coinPool = new Pool(() => new CoinPickup(this), 20);
    this.heartPool = new Pool(() => new HeartPickup(this), 10);
    this.awakenOrbPool = new Pool(() => new AwakenOrb(this), 10);
    this.dmgNumberPool = new Pool(() => new DamageNumber(this), 30);

    // Sistemas
    this.elemental = new ElementalSystem(this);
    this.upgrades = new UpgradeSystem(this);

    // Personagem escolhido no menu (sprite, arma inicial, viés de stats)
    this.character =
      CHARACTERS.find((c) => c.id === this.meta.selectedCharacter && this.meta.hasCharacter(c.id)) || CHARACTERS[0];

    // Player
    this.player = new Player(this, 0, 0, this.character.frame);
    this._applyCharacterMods(this.player, this.character.mods || {});
    // Aplica bênçãos compradas ANTES de criar armas (afetam stats base)
    for (const b of BLESSINGS) {
      const rank = this.meta.blessingRank(b.id);
      if (rank > 0) b.apply(this.player, rank);
    }
    // Tesouro Ancestral — +2% dano geral por nível (sink infinito)
    const anc = this.meta.ancestralLevel;
    if (anc > 0) {
      this.player._blessingDmgMult =
        (this.player._blessingDmgMult || 1) * Math.pow(1 + ANCESTRAL.DMG_PER_LEVEL, anc);
    }
    // Locks de habilidades: bloqueia se não comprou
    this.player.dashUnlocked = this.meta.hasAbility("DASH");
    this.player.awakenUnlocked = this.meta.hasAbility("AWAKEN");
    this.player.addWeapon(new WEAPON_CLASSES[this.character.weapon](this));

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

    this._poofCount = 0;

    // HUD
    this.hud = new HUD(this, this.player);
    this.hud.refreshWeapons();

    // Boss state
    this.elapsedMs = 0;
    this.boss = null;
    this.bossWarned = false;

    // ESC (PC) e botão ⏸ do HUD (mobile) → pausa. Ambos passam por pauseGame().
    this.input.keyboard.on("keydown-ESC", () => this.pauseGame());

    // ====== DEBUG KEYS — só com ?debug=1 na URL (fora do build da loja) ======
    if (DEBUG) {
    this.input.keyboard.on("keydown-NINE", () => {
      // Enche Despertar
      this.player.awakenMeter = this.player.awakenMax;
      this._toast("★ Despertar cheio");
    });
    this.input.keyboard.on("keydown-EIGHT", () => {
      // Level up imediato
      const need = PLAYER.XP_PER_LEVEL(this.player.level) - this.player.xp;
      this.player.gainXp(need);
      this._toast(`LV ${this.player.level}`);
    });
    this.input.keyboard.on("keydown-SEVEN", () => {
      // Adiciona +20s ao timer (acelera spawn + aproxima boss)
      this.elapsedMs += 20000;
      this._toast(`+20s (agora ${Math.floor(this.elapsedMs / 1000)}s)`);
    });
    this.input.keyboard.on("keydown-ZERO", () => {
      // Spawna boss agora
      if (!this.boss) {
        this.elapsedMs = GAME.RUN_DURATION_S * 1000;
        this._spawnBoss();
        this._toast("BOSS spawned");
      } else {
        this._toast("Boss já está vivo");
      }
    });
    this.input.keyboard.on("keydown-G", () => {
      // God mode toggle
      this._god = !this._god;
      this._toast(`GOD MODE: ${this._god ? "ON" : "OFF"}`);
    });
    this.input.keyboard.on("keydown-K", () => {
      // Kill all enemies
      let n = 0;
      this.enemyPool.forEachActive((e) => {
        e.hp = 0;
        this._onEnemyDeath(e);
        n++;
      });
      this._toast(`Killed ${n} enemies`);
    });
    this.input.keyboard.on("keydown-H", () => {
      // Heal full
      this.player.hp = this.player.maxHp;
      this._toast("HP full");
    });
    this.input.keyboard.on("keydown-T", () => {
      // Mostrar lista de teclas de debug
      this._toast(
        "9=Awaken 8=+50XP 7=+20s 0=Boss G=God K=KillAll H=Heal",
        4500,
      );
    });
    }
    // =================================================================

    // Level-up
    // FILA de level-ups: vários de uma vez (XP alto, baú dourado) abrem a tela
    // de cartas em sequência — antes, reabrir por cima descartava escolhas.
    this._pendingLevelUps = 0;
    this.events.on("player:levelup", () => {
      this._pendingLevelUps++;
      this._openNextLevelUp();
    });
    // Quando o LevelUpScene termina, atualiza painel de armas + checa
    // conquistas de arma (Lv máximo / arsenal completo)
    this.events.on("resume", () => {
      this._levelUpOpen = false;
      this.hud.refreshWeapons();
      this._checkAchievements();
      if (this._pendingLevelUps > 0) this.time.delayedCall(120, () => this._openNextLevelUp());
    });

    // Música
    if (!this.bgMusic) {
      this.bgMusic = this.sound.add("music_gameplay", {
        loop: true,
        volume: 0.35,
      });
      this.bgMusic.play();
    }
    this.gameOver = false;

    // Onboarding (D20): 5s, skipável
    this._showOnboarding();
  }

  // Burst de "poeira" na morte de inimigo. Cap de partículas simultâneas pra
  // aguentar limpezas em massa (Sobrecarga/Vapor) sem afogar o tween manager.
  _deathPoof(x, y) {
    if (this._poofCount > 60) return;
    for (let i = 0; i < 5; i++) {
      this._poofCount++;
      const ang = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 16;
      const p = this.add
        .image(x, y, "px_puff")
        .setScale(1.2 + Math.random() * 1.2)
        .setTint(i % 2 ? 0xf4ecd6 : 0x9fb4a4)
        .setAlpha(0.9)
        .setDepth(y + 10001);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * d,
        y: y + Math.sin(ang) * d - 8,
        alpha: 0,
        scale: 0.4,
        duration: 260 + Math.random() * 120,
        ease: "Cubic.easeOut",
        onComplete: () => {
          p.destroy();
          this._poofCount--;
        },
      });
    }
  }

  // Dicas contextuais — cada uma aparece UMA vez na vida do save, no momento
  // em que a mecânica surge (substitui o tutorial em páginas).
  _hint(id, msg, ms = 4200) {
    const seen = (this.meta.data.hintsSeen ||= []);
    if (seen.includes(id)) return;
    seen.push(id);
    this.meta._save();
    const W = this.scale.width;
    const c = this.add.container(W / 2, 150).setScrollFactor(0).setDepth(60500);
    const t = text(this, 0, 0, msg, { size: 22, origin: 0.5, align: "center", wrap: Math.min(700, W - 80) });
    const w = t.width + 60,
      h = t.height + 30;
    const g = this.add.graphics();
    drawFrame(g, -w / 2, -h / 2, w, h, "gold", { alpha: 0.92 });
    c.add([g, t]);
    c.setAlpha(0).setY(130);
    this.tweens.add({ targets: c, alpha: 1, y: 150, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 400, onComplete: () => c.destroy() });
  }

  _showOnboarding() {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.time.delayedCall(600, () =>
      this._hint(
        "move",
        touch
          ? "Arraste o polegar na esquerda para andar.\nO ataque é automático!"
          : "Ande com WASD ou setas.\nO ataque é automático!",
      ),
    );
  }

  update(time, dt) {
    if (this.gameOver) return;
    this.elapsedMs += dt;

    // Conquista "Maratonista" (10:00) — checagem explícita porque na fase de
    // boss não há kills de horda pra disparar a checagem por kill
    if (!this._survive10Checked && this.elapsedMs >= 600000) {
      this._survive10Checked = true;
      this._checkAchievements();
    }

    // Aviso de boss aos 6:30
    if (
      !this.bossWarned &&
      this.elapsedMs >= (GAME.RUN_DURATION_S - 30) * 1000
    ) {
      this.bossWarned = true;
      this.hud.showBossBanner("O guardião do bosque desperta…");
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
    this.world.update(time, dt, this.player);

    // Baús: glow/prompt + interação E
    let chestPressed = this.inputMgr.consumeInteract();
    const view = this.cameras.main.worldView;
    for (const c of this.chests) {
      if (c.opened) continue;
      if (!this._chestHinted && view.contains(c.x, c.y)) {
        this._chestHinted = true;
        this._hint("chest", "Um baú! Encoste nele para abrir.\nCuidado: alguns são armadilhas…");
      }
      c.update(time, this.player);
      // Abre ao ENCOSTAR (~0,3s perto) — sem botão extra no celular; E ainda vale
      if (c.playerNear) {
        c._nearMs = (c._nearMs || 0) + dt;
        if (chestPressed || c._nearMs > 300) {
          chestPressed = false;
          this._openChest(c);
        }
      } else c._nearMs = 0;
    }

    // Boss update
    if (this.boss && this.boss.active) {
      this.boss.update(time, dt, this.player);
      // Contato com player
      const dx = this.boss.x - this.player.x,
        dy = this.boss.y - this.player.y;
      if (
        dx * dx + dy * dy < 50 * 50 &&
        time - this.boss.lastTouchAt > this.boss.contactCooldownMs
      ) {
        this.boss.lastTouchAt = time;
        this.player.takeDamage(this.boss.dmg);
        if (this.player.isDead()) this._onGameOver(false);
      }
    }

    // Inimigos
    this.enemyPool.forEachActive((e) => {
      e.update(time, dt, this.player);
      const dx = e.x - this.player.x,
        dy = e.y - this.player.y;
      if (
        dx * dx + dy * dy < e.contactRadius * e.contactRadius &&
        time - e.lastTouchAt > e.contactCooldownMs
      ) {
        e.lastTouchAt = time;
        if (!this._god) {
          this.player.takeDamage(e.dmg);
          if (this.player.isDead()) this._onGameOver(false);
        }
      }
    });

    // Separação inimigo-inimigo: não deixam ocupar o mesmo espaço (anti-empilhamento)
    this._separateEnemies(time);

    // Projéteis retos do player (Cajado etc) — somem no impacto
    this.projectilePool.forEachActive((p) => {
      p.update(time);
      if (!p.active) {
        this.projectilePool.release(p);
        return;
      }
      if (this.boss && this.boss.active) {
        const dx = this.boss.x - p.x,
          dy = this.boss.y - p.y;
        if (dx * dx + dy * dy < 40 * 40) {
          const died = this.boss.takeDamage(p.dmg, null, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, p.element, p.crit);
          if (p.element) this.elemental.applyStatus(this.boss, p.element);
          p.onImpact?.(p.x, p.y); // hook de evolução (nuvem da Tempestade de Vapor)
          p.kill();
          this.projectilePool.release(p);
          if (died) this._onBossDeath();
          return;
        }
      }
      this.enemyPool.forEachActive((e) => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x,
          dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) {
          const died = e.takeDamage(p.dmg, p.element, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(e.x, e.y, p.dmg, p.element, p.crit);
          p.onImpact?.(p.x, p.y); // hook de evolução (nuvem da Tempestade de Vapor)
          p.kill();
          this.projectilePool.release(p);
          if (died) this._onEnemyDeath(e);
        }
      });
    });

    // Bumerangues — atravessam inimigos, podem re-hit após cooldown
    this.boomerPool.forEachActive((p) => {
      p.update(time, dt);
      if (!p.active) {
        this.boomerPool.release(p);
        return;
      }
      if (this.boss && this.boss.active) {
        const dx = this.boss.x - p.x,
          dy = this.boss.y - p.y;
        if (dx * dx + dy * dy < 40 * 40 && p.canHit(this.boss, time)) {
          const died = this.boss.takeDamage(p.dmg, null, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, "fire", p.crit);
          this.elemental.applyStatus(this.boss, "fire");
          if (died) this._onBossDeath();
        }
      }
      this.enemyPool.forEachActive((e) => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x,
          dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22 && p.canHit(e, time)) {
          const died = e.takeDamage(p.dmg, "fire", p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(e.x, e.y, p.dmg, "fire", p.crit);
          if (died) this._onEnemyDeath(e);
        }
      });
    });

    // Projéteis dos inimigos
    this.enemyProjPool.forEachActive((p) => {
      p.update(time);
      if (!p.active) {
        this.enemyProjPool.release(p);
        return;
      }
      const dx = p.x - this.player.x,
        dy = p.y - this.player.y;
      if (dx * dx + dy * dy < 22 * 22) {
        this.player.takeDamage(p.dmg);
        p.kill();
        this.enemyProjPool.release(p);
        if (this.player.isDead()) this._onGameOver(false);
      }
    });

    // Gemas + moedas
    this.xpPool.forEachActive((g) => {
      g.update(time, dt, this.player);
      const dx = g.x - this.player.x,
        dy = g.y - this.player.y;
      if (
        dx * dx + dy * dy <
        this.player.pickupRadius * this.player.pickupRadius
      ) {
        this.player.gainXp(g.xpValue);
        this.sound.play("sfx_pickup", { volume: 0.18 });
        g.pickup();
        this.xpPool.release(g);
      }
    });
    this.coinPool.forEachActive((c) => {
      c.update(time, dt, this.player);
      const dx = c.x - this.player.x,
        dy = c.y - this.player.y;
      if (
        dx * dx + dy * dy <
        this.player.pickupRadius * this.player.pickupRadius
      ) {
        this._coinsGainedThisRun += META.COIN_VALUE;
        this.hud.addCoin(META.COIN_VALUE);
        this.sound.play("sfx_coin", { volume: 0.35, rate: 1.2 });
        c.pickup();
        this.coinPool.release(c);
      }
    });
    // Corações
    this.heartPool.forEachActive((h) => {
      h.update(time, dt, this.player);
      const dx = h.x - this.player.x,
        dy = h.y - this.player.y;
      if (
        dx * dx + dy * dy <
        this.player.pickupRadius * this.player.pickupRadius
      ) {
        this.player.healHp(DROPS.HEART_HEAL);
        this.sound.play("sfx_pickup", { volume: 0.3, rate: 0.85 });
        this._showDmg(
          this.player.x,
          this.player.y - 10,
          DROPS.HEART_HEAL,
          "heal",
        );
        h.pickup();
        this.heartPool.release(h);
      }
    });
    // Orbes de Despertar
    this.awakenOrbPool.forEachActive((o) => {
      o.update(time, dt, this.player);
      const dx = o.x - this.player.x,
        dy = o.y - this.player.y;
      if (
        dx * dx + dy * dy <
        this.player.pickupRadius * this.player.pickupRadius
      ) {
        this.player.refillAwaken(DROPS.AWAKEN_REFILL);
        this.sound.play("sfx_pickup", { volume: 0.3, rate: 1.6 });
        o.pickup();
        this.awakenOrbPool.release(o);
      }
    });
  }

  _applyCharacterMods(p, m) {
    if (m.hp) {
      p.maxHp *= m.hp;
      p.hp = p.maxHp;
    }
    if (m.speed) p.speed *= m.speed;
    if (m.crit) p.critChance += m.crit;
    if (m.area) p.areaMult *= m.area;
    if (m.regen) p.regenPerSec += m.regen;
    if (m.cd) p.cdMult *= m.cd;
    if (m.dmg) p._blessingDmgMult = (p._blessingDmgMult || 1) * m.dmg;
  }

  _openNextLevelUp() {
    if (this._pendingLevelUps <= 0 || this.gameOver) return;
    // pause()/launch() do Phaser são enfileirados pro próximo frame: a flag
    // evita abrir 2× no mesmo tick
    if (this._levelUpOpen) return;
    this._levelUpOpen = true;
    this._pendingLevelUps--;
    const cards = this.upgrades.generateCards(this.player);
    this.scene.pause();
    this.scene.launch("LevelUpScene", {
      cards,
      player: this.player,
      gameScene: this,
    });
  }

  // Botão VOLTAR do Android → pausa (ver systems/Platform.js)
  onBack() {
    this.pauseGame();
    return true;
  }

  // Pausa o jogo e abre o PauseScene. Usado pelo ESC (PC) e pelo botão ⏸ (mobile).
  pauseGame() {
    if (this.scene.isActive("LevelUpScene")) return;
    if (this.scene.isActive("PauseScene")) return;
    this.scene.pause();
    this.scene.launch("PauseScene");
  }

  // Aviso curto na parte de baixo da tela (conquistas, baús, eventos).
  // Empilha pra cima se vários chegarem juntos.
  _toast(msg, ms = 1600, color = "#ffe58f") {
    this._toasts = (this._toasts || []).filter((t) => t.active);
    const y = this.scale.height - 130 - this._toasts.length * 44;
    const c = this.add.container(this.scale.width / 2, y).setScrollFactor(0).setDepth(60000);
    const t = text(this, 0, 0, msg, { size: 18, color, origin: 0.5 });
    const w = t.width + 36,
      h = 38;
    const g = this.add.graphics();
    drawFrame(g, -w / 2, -h / 2, w, h, "glass");
    c.add([g, t]);
    c.setAlpha(0).setScale(0.8);
    this._toasts.push(c);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.tweens.add({
      targets: c,
      alpha: 0,
      y: y - 16,
      delay: ms - 300,
      duration: 300,
      onComplete: () => c.destroy(),
    });
  }

  // Contexto de run passado aos check() de ACHIEVEMENTS (ver config.js)
  _runCtx(won = false) {
    return {
      won,
      difficultyId: this.diff.id,
      timeMs: this.elapsedMs,
      weapons: this.player.weapons.map((w) => ({
        key: w.key,
        level: w.level,
        element: WEAPONS[w.key]?.element ?? null,
        baseKey: w.baseKey ?? null, // âncora original, se evoluída
        evolved: !!w.baseKey,
      })),
      tookHpPassive: this._runFlags.tookHpPassive,
    };
  }

  // Checa conquistas pendentes; mostra toast pra cada recém-desbloqueada.
  // silent=true no game over (a tela final já exibe no painel de desbloqueios).
  _checkAchievements(won = false, silent = false) {
    const newly = this.meta.checkAchievements(this._runCtx(won));
    if (!silent && newly.length) {
      this.sound.play("sfx_levelup", { volume: 0.5, rate: 1.3 });
      this._toast(`Conquista: ${newly.map((a) => a.name).join(" · ")}`, 3000, "#e8ccff");
    }
    return newly;
  }

  _showDmg(x, y, dmg, element, crit = false) {
    if (element !== "heal" && !this._showDmgNumbers) return;
    const n = this.dmgNumberPool.acquire();
    let color;
    if (crit) color = "#ffd96b";
    else if (element === "ice") color = "#9ad4ff";
    else if (element === "bolt") color = "#d8a8ff";
    else if (element === "fire") color = "#ff9966";
    else if (element === "heal") color = "#6fcf6f";
    else color = "#ffffff";
    const text =
      element === "heal" ? `+${dmg}` : crit ? `${Math.ceil(dmg)}!` : dmg;
    n.show(x, y, text, color, crit);
  }

  _onEnemyDeath(enemy) {
    if (!enemy.active) return;
    this.hud.addKill();
    this.meta.recordKill();
    this._checkAchievements();
    this.player.addAwakenMeter(PLAYER.AWAKEN_GAIN_KILL);
    this._killsSinceLastChest = (this._killsSinceLastChest || 0) + 1;
    if (this._killsSinceLastChest >= CHEST.KILL_DROP_EVERY) {
      this._killsSinceLastChest = 0;
      const pos = this._randomChestPos();
      this.chests.push(new Chest(this, pos.x, pos.y));
    }
    this.sound.play("sfx_death", { volume: 0.15 });
    this.cameras.main.shake(40, 0.002);
    this._deathPoof(enemy.x, enemy.y);
    // Drop XP sempre
    const g = this.xpPool.acquire();
    g.spawn(enemy.x, enemy.y);
    // Drops aleatórios
    // Sorte (passiva Trevo) escala as chances de drop
    const r = Math.random() / (1 + (this.player.luck || 0));
    if (r < DROPS.COIN_CHANCE) {
      const c = this.coinPool.acquire();
      c.spawn(
        enemy.x + (Math.random() - 0.5) * 10,
        enemy.y + (Math.random() - 0.5) * 10,
      );
    } else if (r < DROPS.COIN_CHANCE + DROPS.HEART_CHANCE) {
      const h = this.heartPool.acquire();
      h.spawn(enemy.x, enemy.y);
    } else if (
      r <
      DROPS.COIN_CHANCE + DROPS.HEART_CHANCE + DROPS.AWAKEN_CHANCE
    ) {
      const o = this.awakenOrbPool.acquire();
      o.spawn(enemy.x, enemy.y);
    }
    enemy.deactivate();
    this.enemyPool.release(enemy);
  }

  // Empurra inimigos sobrepostos pra longe uns dos outros (separação tipo flocking).
  // Congelados não se movem, mas ainda empurram quem encosta.
  _separateEnemies(now) {
    const list = [];
    this.enemyPool.forEachActive((e) => {
      if (e.active) list.push(e);
    });
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      const ra = a.displayWidth * 0.32;
      const aF = a.isFrozen(now);
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const minD = ra + b.displayWidth * 0.32;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const overlap = minD - d;
        const ux = dx / d,
          uy = dy / d;
        const bF = b.isFrozen(now);
        if (aF && bF) continue;
        if (aF) {
          // só b se afasta
          b.x += ux * overlap;
          b.y += uy * overlap;
        } else if (bF) {
          // só a se afasta
          a.x -= ux * overlap;
          a.y -= uy * overlap;
        } else {
          // dividem o empurrão
          const h = overlap * 0.5;
          a.x -= ux * h;
          a.y -= uy * h;
          b.x += ux * h;
          b.y += uy * h;
        }
      }
    }
  }

  _spawnBoss() {
    const ang = Math.random() * Math.PI * 2;
    const r = 320;
    const bx = this.player.x + Math.cos(ang) * r;
    const by = this.player.y + Math.sin(ang) * r;
    this.boss = new BossEnt(this, bx, by);
    this.boss.activate(BOSS.HP * this.diff.hpMult);
    this.boss.dmg *= this.diff.dmgMult; // escala dano do boss pela dificuldade
    this.hud.setBossActive(this.boss);
    this.sound.play("sfx_boss_roar", { volume: 0.8 });
    this.cameras.main.shake(500, 0.015);
    // Limpa hordas para o boss respirar
    this.enemyPool.forEachActive((e) => {
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
      const dx = x - (this.player?.x ?? 0),
        dy = y - (this.player?.y ?? 0);
      if (dx * dx + dy * dy > 250 * 250) return { x, y };
    }
    return { x: 0, y: 300 };
  }

  _openChest(chest) {
    const result = chest.open();
    if (!result) return;
    const { kind, x, y } = result;

    // Som de abertura imediato
    this.sound.play("sfx_chest_open", { volume: 0.7 });

    // CAÇA-NÍQUEL: "reels" — 3 ticks de ficha ascendentes (suspense)
    const reelRates = [1.0, 1.15, 1.3];
    reelRates.forEach((rate, i) => {
      this.time.delayedCall(150 + i * 130, () => {
        this.sound.play("sfx_chest_reel", { volume: 0.7, rate });
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
        const h = this.heartPool.acquire();
        h.spawn(x - 22, y);
      }
      if (Math.random() < CHEST.AWAKEN_CHANCE_OPEN) {
        const o = this.awakenOrbPool.acquire();
        o.spawn(x + 22, y);
      }
    });

    if (kind === "golden") {
      // JACKPOT: chips colliding + level-up + coin cascade
      this.time.delayedCall(burstDelay, () => {
        this.sound.play("sfx_chest_jackpot", { volume: 0.9 });
        this.sound.play("sfx_levelup", { volume: 0.6, rate: 1.1 });
      });
      this.time.delayedCall(burstDelay + 300, () => {
        // Cascata de moedas de verdade
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 130, () => {
            this.sound.play("sfx_coin_cascade", {
              volume: 0.55,
              rate: 1.0 + i * 0.08,
            });
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
      this._toast("BAÚ DOURADO!", 2200, "#ffe58f");
      // Carta extra grátis
      this.time.delayedCall(burstDelay + 1200, () =>
        this.events.emit("player:levelup", this.player.level),
      );
    } else if (kind === "trap") {
      this.time.delayedCall(burstDelay, () => {
        this.sound.play("sfx_chest_trap", { volume: 0.8 });
        this.sound.play("sfx_boss_roar", { volume: 0.5, rate: 0.7 });
        this.cameras.main.shake(280, 0.018);
      });
      this._toast("ARMADILHA!", 1500, "#ff8a8a");
      const wave = Math.floor(this.elapsedMs / 30000);
      const types = ["wolf", "crow", "goblin"];
      for (let i = 0; i < CHEST.TRAP_ENEMY_COUNT; i++) {
        if (this.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) break;
        const ang =
          (i / CHEST.TRAP_ENEMY_COUNT) * Math.PI * 2 + Math.random() * 0.5;
        const sx = x + Math.cos(ang) * 60;
        const sy = y + Math.sin(ang) * 60;
        const e = this.enemyPool.acquire();
        const k = types[Math.floor(Math.random() * types.length)];
        e.activate(sx, sy, k, wave, true);
      }
    } else if (kind === "mimic") {
      // MÍMICO: 1 inimigo super forte spawna no LOCAL do baú
      this.time.delayedCall(burstDelay, () => {
        this.sound.play("sfx_chest_trap", { volume: 1.0, rate: 0.6 });
        this.sound.play("sfx_boss_roar", { volume: 0.7, rate: 0.85 });
        this.cameras.main.shake(450, 0.025);
        this.cameras.main.flash(150, 200, 40, 40);
      });
      this._toast("MÍMICO!", 1800, "#ff8a8a");
      const wave = Math.floor(this.elapsedMs / 30000);
      const types = ["goblin", "wolf"];
      this.time.delayedCall(burstDelay + 200, () => {
        if (this.enemyPool.size >= GAME.MAX_ENEMIES_ALIVE) return;
        const e = this.enemyPool.acquire();
        const k = types[Math.floor(Math.random() * types.length)];
        e.activate(x, y, k, wave, "mimic");
      });
    } else {
      // Normal: pequeno dingdong de moedas
      this.time.delayedCall(burstDelay, () => {
        this.sound.play("sfx_coin", { volume: 0.7 });
      });
    }
  }

  _chestBurst(x, y, kind) {
    const color =
      kind === "trap" ? 0xff5a6e : kind === "golden" ? 0xffe88a : 0xffd96b;
    // 14 partículas pequenas voando pra fora
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const p = this.add
        .image(x, y, i % 2 ? "px_spark" : "px_dot2")
        .setScale(3)
        .setTint(color)
        .setDepth(y + 10500);
      const dist = 50 + Math.random() * 40;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 600,
        ease: "Cubic.easeOut",
        onComplete: () => p.destroy(),
      });
    }
    // Flash radial breve
    const ring = this.add
      .image(x, y, "px_ring")
      .setScale(1)
      .setTint(color)
      .setDepth(y + 10500);
    this.tweens.add({
      targets: ring,
      scale: 9,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy(),
    });
  }

  _onGameOver(won, quit = false) {
    if (this.gameOver) return;
    this.gameOver = true;
    // Recompensa final escalada pela dificuldade (HUD mostrou a contagem-base ao vivo)
    const coinsFinal = Math.round(this._coinsGainedThisRun * this.diff.rewardMult);
    // Detecta se ESTA vitória libera um novo nível (antes de gravar)
    const prevMaxCleared = this.meta.data.maxDifficultyCleared;
    const unlockedNewDifficulty =
      won &&
      this.diff.id > prevMaxCleared &&
      this.diff.id + 1 < DIFFICULTY.length;
    // Salva meta — registerRun ANTES das conquistas (wins/winsByDifficulty
    // precisam estar atualizados pros check() de vitória)
    this.meta.addCoins(coinsFinal);
    this.meta.registerRun(this.elapsedMs / 1000, won, this.diff.id);
    const newAchievements = this._checkAchievements(won, true);
    this._newUnlocksThisRun.push(...newAchievements.map((a) => a.name));
    // Morte: câmera lenta dramática antes do fade
    if (!won && !quit) {
      this.physics.world.timeScale = 3;
      this.tweens.timeScale = 0.35;
      this.cameras.main.zoomTo(1.25, 700);
    }
    this.cameras.main.fade(quit ? 250 : 800, 0, 0, 0);
    this.time.delayedCall(quit ? 300 : 900, () => {
      this.physics.world.timeScale = 1;
      this.tweens.timeScale = 1;
      this.bgMusic?.stop();
      this.bgMusic = null;
      this.scene.start("GameOverScene", {
        won,
        quit,
        level: this.player.level,
        weapons: this.player.weapons.map((w) => ({ key: w.key, level: w.level })),
        elapsedMs: this.elapsedMs,
        kills: this.hud.kills,
        coinsGained: coinsFinal,
        newUnlocks: this._newUnlocksThisRun,
        difficulty: this.diff,
        unlockedNextDifficulty: unlockedNewDifficulty
          ? DIFFICULTY[this.diff.id + 1].name
          : null,
      });
    });
  }

  shutdown() {
    this.bgMusic?.stop();
    this.bgMusic = null;
  }
}
