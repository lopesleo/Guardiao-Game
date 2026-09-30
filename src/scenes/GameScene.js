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
  ADS,
  ENDLESS,
  INTRO,
  ARENA,
  WOOD,
  BUILD,
} from "../config.js";
import { InputManager } from "../systems/InputManager.js";
import { Pool } from "../systems/Pool.js";
import { SpawnDirector } from "../systems/SpawnDirector.js";
import { RunEvents } from "../systems/RunEvents.js";
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
  WoodPickup,
  HeartPickup,
  AwakenOrb,
} from "../entities/Pickups.js";
import { Chest } from "../entities/Chest.js";
import { DamageNumber } from "../entities/DamageNumber.js";
import { HUD } from "../ui/HUD.js";
import { ForestWorld } from "../world/ForestWorld.js";
import { Lighting } from "../world/Lighting.js";
import { vw, vh, text, drawFrame, fitCamera, Button } from "../ui/Theme.js";
import { CSS } from "../art/Palette.js";
import { DEBUG } from "../systems/Platform.js";
import { Settings } from "../systems/Settings.js";
import { Analytics } from "../systems/Analytics.js";
import { AdService } from "../systems/AdService.js";
import { QualityWatchdog } from "../systems/QualityWatchdog.js";
import { LanternSystem } from "../systems/LanternSystem.js";
import { Builds } from "../systems/Builds.js";
import { VirtualJoystick } from "../ui/VirtualJoystick.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    fitCamera(this);
    const WS = GAME.WORLD_RADIUS * 2;
    // Limite físico na face de dentro da muralha (ver ARENA em config.js)
    this.physics.world.setBounds(ARENA.minX, ARENA.minY, ARENA.maxX - ARENA.minX, ARENA.maxY - ARENA.minY);
    this.world = new ForestWorld(this, { entrance: { half: INTRO.PATH_HALF, y: ARENA.maxY } });

    this.inputMgr = new InputManager(this);
    this.joystick = new VirtualJoystick(this.inputMgr);
    // O Phaser não chama shutdown() sozinho: sem isto, cada partida deixava uma
    // camada de toque (joystick) e a música anteriores para trás
    this.events.once("shutdown", () => {
      this.joystick?.destroy();
      this.joystick = null;
      this.shutdown();
    });

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
    this.woodPool = new Pool(() => new WoodPickup(this), 12);
    this._woodThisRun = 0;
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
    this.player = new Player(this, 0, GAME.WORLD_RADIUS - INTRO.END_OFF, this.character.id);
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
    this.lighting = new Lighting(this, this.world);
    // Aparelho fraco: desliga a iluminação na 1ª partida (uma vez só)
    this.quality = new QualityWatchdog(this, () => {
      this.lighting.setEnabled(false);
      this._hint("quality", "Iluminação desligada para o jogo rodar liso.\nDá pra religar em Opções.");
    });
    AdService.newRun();
    Analytics.track("run_start", { character: this.character.id, difficulty: this.diff.id });
    this.runEvents = new RunEvents(this);
    this.lanterns = new LanternSystem(this);

    // Baús — STARTING_COUNT espalhados aleatoriamente fora do spawn do player
    this.chests = [];
    for (let i = 0; i < CHEST.STARTING_COUNT; i++) {
      const pos = this._randomChestPos();
      this.chests.push(new Chest(this, pos.x, pos.y));
    }
    this._killsSinceLastChest = 0;

    // Câmera — trava nas bordas do mundo; começa PARADA para o guardião entrar
    // pela trilha (ver _startIntro) e só então passa a segui-lo
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
    // O emissor de eventos da cena SOBREVIVE a reinícios (Jogar de novo):
    // sem limpar, cada partida somava mais um ouvinte → cartas em dobro/triplo.
    this.events.off("player:levelup");
    this.events.off("resume");
    this.events.on("player:levelup", () => {
      this.lighting?.flash(this.player.x, this.player.y, 420, 0xffe58f, 500, 1);
      this._pendingLevelUps++;
      Analytics.track("level_up", { level: this.player.level, t: Math.floor(this.elapsedMs / 1000) });
      this._openNextLevelUp();
    });
    // Quando o LevelUpScene termina, atualiza painel de armas + checa
    // conquistas de arma (Lv máximo / arsenal completo)
    this.events.on("resume", () => {
      this.quality.reset();
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
    this._introPhase = null;
    this._levelUpOpen = false;
    this.endless = false;
    this._endlessStartMs = 0;
    this._reviveOpen = false;

    // Entrada pela trilha: o guardião chega andando e a mata se fecha atrás
    // dele; o relógio e as hordas só começam depois (onboarding no fim)
    this._startIntro();
  }

  // =========================================================================
  // ENTRADA NA FLORESTA (continuação da saída da Clareira)
  // =========================================================================
  _startIntro() {
    const p = this.player;
    const S = GAME.PIXEL_SCALE;
    const R = GAME.WORLD_RADIUS;
    this._intro = true;
    this._introEndY = R - INTRO.END_OFF;
    this._gateY = R - INTRO.GATE_OFF;
    const cam = this.cameras.main;
    cam.centerOn(0, R - 260); // limitada pela borda: a base da tela é a borda da arena
    cam.fadeIn(600, 5, 8, 6); // continua o escurecer da Clareira
    p.setCollideWorldBounds(false); // vem de fora da arena
    p.setPosition(0, R - INTRO.START_OFF);
    p.setFlipX(false);
    const env = this.registry.get("envKeys");
    // Trilha de terra atravessando a muralha de árvores
    for (let y = this._introEndY - 50; y < R + 80; y += 36) {
      this.add.image((y % 3) * 5, y, "env", env.patches.dirt[(y / 36) % env.patches.dirt.length | 0]).setScale(S).setDepth(-50);
    }
    // Lados da brecha: mesma regra da muralha sul (copa começando na linha do
    // limite), em fileiras descendo — a trilha passa ENTRE as árvores
    const trees = [...env.trees, ...env.pines, ...env.pines];
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const x = side * (INTRO.PATH_HALF + 70 + (i % 2) * 10);
        this.world.southTree(x, this._gateY - 4 + i * 48, trees).setFlipX(side > 0);
      }
    }
    // Some o HUD durante a entrada (volta junto com o controle)
    // (só o HUD: profundidade >= 50000; a camada de luz e o chão ficam)
    this._introHud = this.children.list.filter((o) => o.scrollFactorX === 0 && o.visible && o.depth >= 50000 && o !== this.lighting?.rt);
    this._introHud.forEach((o) => o.setAlpha(0));
  }

  // Anda sozinho até passar da brecha; então a mata fecha e o jogo começa
  _updateIntro(time, dt) {
    const p = this.player;
    this.world.update(time, dt, p);
    this.lighting.update(time);
    if (this._introPhase === "closing") return;
    if (p.y > this._introEndY) {
      p.setVelocity(0, -p.speed * INTRO.WALK_MULT);
      if (p.anims.currentAnim?.key !== `${p.heroId}_walk`) p.play(`${p.heroId}_walk`);
      p.setDepth(p.y + 10000);
      return;
    }
    p.setVelocity(0, 0);
    p.play(`${p.heroId}_idle`);
    this._introPhase = "closing";
    this._closeGate();
  }

  // Árvores brotam e fecham a brecha atrás do guardião — e viram parede
  _closeGate() {
    const S = GAME.PIXEL_SCALE;
    const env = this.registry.get("envKeys");
    const y = this._gateY;
    const xs = [-INTRO.PATH_HALF + 4, -18, 22, INTRO.PATH_HALF - 2];
    // Folhas voando enquanto as árvores brotam
    xs.forEach((x, i) => {
      this.time.delayedCall(120 + i * 90, () => {
        for (let k = 0; k < 5; k++) {
          const l = this.add.image(x, y - 10, "px_leaf").setScale(3).setDepth(y + 10100);
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          this.tweens.add({
            targets: l,
            x: x + Math.cos(a) * (30 + Math.random() * 40),
            y: y - 10 + Math.sin(a) * (30 + Math.random() * 30) + 30,
            angle: Math.random() * 360,
            alpha: 0,
            duration: 700,
            onComplete: () => l.destroy(),
          });
        }
      });
    });
    // Árvores brotam na brecha: a muralha fica contínua, igual ao resto da borda
    [-30, 32].forEach((x, i) => {
      const t = this.world.southTree(x, y - 4 + i * 12, env.pines);
      t.setScale(S, 0);
      this.tweens.add({ targets: t, scaleY: S, duration: 520, delay: 120 + i * 140, ease: "Back.easeOut" });
    });
    // Parede física: não dá para voltar pela brecha
    const wall = this.add.zone(0, y - 10, INTRO.PATH_HALF * 2 + 90, 40);
    this.physics.add.existing(wall, true);
    this.physics.add.collider(this.player, wall);
    this.player.setCollideWorldBounds(true);
    this.sound.play("sfx_dash", { volume: 0.5, rate: 0.55 });
    this.time.delayedCall(260, () => this.cameras.main.shake(220, 0.006));
    this.time.delayedCall(INTRO.CLOSE_MS, () => this._endIntro());
  }

  _endIntro() {
    this._intro = false;
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this._introHud?.forEach((o) => o.active && this.tweens.add({ targets: o, alpha: 1, duration: 350 }));
    this._introHud = null;
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
    const W = vw(this);
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
    if (this._intro) return this._updateIntro(time, dt);
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
    if (!this.boss && !this.endless && this.elapsedMs >= GAME.RUN_DURATION_S * 1000) {
      this._spawnBoss();
    }

    this.inputMgr.update();
    this.player.update(time, dt, this.inputMgr);
    if (!this.boss) {
      this.spawnDirector.update(time, dt);
      this.runEvents.update();
    }
    this.lanterns.update(time, this.elapsedMs, this.player);
    this._updateSpores(time, dt);
    this.elemental.tick(time);
    this.hud.update(time, dt);
    this.world.update(time, dt, this.player);
    this.lighting.update(time);
    this.quality.update(this.game.loop.delta);

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
        dx * dx + dy * dy < 64 * 64 &&
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
        time - e.lastTouchAt > e.contactCooldownMs &&
        !this.lanterns.timeStopped
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
        if (dx * dx + dy * dy < 56 * 56) {
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
          this.lighting.flash(p.x, p.y, 120, 0xff8a3c, 120, 0.8);
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
        if (dx * dx + dy * dy < 56 * 56 && p.canHit(this.boss, time)) {
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
    // Madeira Ancestral
    this.woodPool.forEachActive((w) => {
      w.update(time, dt, this.player);
      const dx = w.x - this.player.x,
        dy = w.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        this._woodThisRun += 1;
        this.hud.addWood(1);
        this.sound.play("sfx_chest_reel", { volume: 0.5, rate: 0.8 });
        this._hint("wood", "Madeira Ancestral! Leve para a Clareira:\nela serve para as obras do acampamento.");
        w.pickup();
        this.woodPool.release(w);
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
    const y = vh(this) - 130 - this._toasts.length * 44;
    const c = this.add.container(vw(this) / 2, y).setScrollFactor(0).setDepth(60000);
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
    // Cogumelo: vira nuvem de esporos (dano no player que ficar dentro)
    if (enemy._kind === "shroom") this._sporeCloud(enemy.x, enemy.y, enemy.dmg * 0.7);
    // Mini-chefe: baú dourado garantido + gema grande + moedas
    if (enemy.miniBoss) this._miniBossReward(enemy);
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

  _miniBossReward(e) {
    const x = e.x,
      y = e.y;
    this.cameras.main.shake(400, 0.016);
    this.cameras.main.flash(200, 242, 193, 78);
    this.sound.play("sfx_chest_jackpot", { volume: 0.6 });
    this._toast(`${e.miniBoss} DERROTADO!`, 2200, "#ffe58f");
    const chest = new Chest(this, x, y);
    chest.forceKind = "golden";
    this.chests.push(chest);
    for (let i = 0; i < 3; i++) this.xpPool.acquire().spawn(x + (i - 1) * 26, y + 30, 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.coinPool.acquire().spawn(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
    }
    this._spawnWood(x, y, WOOD.MINIBOSS);
    if (this.hud.boss === e) this.hud.clearBoss();
  }

  // Madeira Ancestral saltando em volta de (x, y)
  _spawnWood(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.6;
      const d = 24 + Math.random() * 26;
      this.woodPool.acquire().spawn(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
  }

  // Nuvem de esporos: aviso visual e depois dano periódico no player dentro
  _sporeCloud(x, y, dmg) {
    const r = 64;
    this.elemental._cloudFx(x, y, r, 0x9ccf62, 1800);
    (this._spores ||= []).push({ x, y, r, dmg, until: this.time.now + 1800, nextTick: this.time.now + 350 });
  }

  _updateSpores(time) {
    if (!this._spores?.length) return;
    const p = this.player;
    this._spores = this._spores.filter((c) => time < c.until);
    for (const c of this._spores) {
      if (time < c.nextTick) continue;
      c.nextTick = time + 400;
      const dx = p.x - c.x,
        dy = p.y - c.y;
      if (dx * dx + dy * dy < c.r * c.r && !this._god) {
        p.takeDamage(c.dmg);
        if (p.isDead()) this._onGameOver(false);
      }
    }
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
    // Trilha do chefe entra no lugar da música da partida
    this.bgMusic?.stop();
    this.bgMusic = this.sound.add("music_boss", { loop: true, volume: 0.4 });
    this.bgMusic.play();
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
    // Madeira do Ancião entra direto (a escolha da Noite Eterna vem em seguida)
    this._woodThisRun += WOOD.BOSS;
    this.hud.addWood(WOOD.BOSS);
    this._toast(`+${WOOD.BOSS} Madeira Ancestral`, 2200, "#ffc86b");
    this.cameras.main.shake(600, 0.02);
    // Vitória: escolher entre encerrar ou seguir na Noite Eterna
    this.time.delayedCall(900, () => this._offerEndless());
  }

  // Espera cartas de nível/pausa fecharem antes de abrir a escolha
  _offerEndless() {
    if (this.gameOver) return;
    if (this.scene.isActive("LevelUpScene") || this.scene.isActive("PauseScene") || this._levelUpOpen) {
      this.time.delayedCall(300, () => this._offerEndless());
      return;
    }
    this.scene.pause();
    this.scene.launch("EndlessChoiceScene");
  }

  // Segundos sobrevividos na Noite Eterna
  get endlessSeconds() {
    return this.endless ? (this.elapsedMs - this._endlessStartMs) / 1000 : 0;
  }

  // Multiplicadores de força dos inimigos na Noite Eterna (null fora dela)
  endlessMult() {
    if (!this.endless) return null;
    const min = this.endlessSeconds / 60;
    return { hp: Math.pow(1 + ENDLESS.HP_GROWTH_PER_MIN, min), dmg: Math.pow(1 + ENDLESS.DMG_GROWTH_PER_MIN, min) };
  }

  _startEndless() {
    this.endless = true;
    this._endlessStartMs = this.elapsedMs;
    this.boss = null;
    this.bgMusic?.stop();
    this.bgMusic = this.sound.add("music_gameplay", { loop: true, volume: 0.35, rate: 0.92 });
    this.bgMusic.play();
    this.hud.showBossBanner("A NOITE ETERNA COMEÇA", "#e8ccff");
    this.cameras.main.flash(400, 60, 30, 90);
    Analytics.track("endless_start", { level: this.player.level, t: Math.floor(this.elapsedMs / 1000) });
  }

  _randomChestPos() {
    // Sempre dentro da área jogável (nunca escondido na muralha de árvores)
    const m = 80;
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(ARENA.minX + m, ARENA.maxX - m);
      const y = Phaser.Math.Between(ARENA.minY + m, ARENA.maxY - m);
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
      this._spawnChestLoot(x, y);
      if (kind === "golden") this._spawnWood(x, y, WOOD.GOLDEN_CHEST);
      else if (kind === "normal" && Math.random() < WOOD.CHEST_CHANCE) this._spawnWood(x, y, 1);
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

  // Volta à luta após o anúncio: metade da vida, invulnerável por um tempo e
  // uma onda de luz que fere e empurra quem estava em volta (nada de morrer
  // de novo no mesmo segundo).
  _revive() {
    this._reviveOpen = false;
    const p = this.player;
    p.hp = Math.max(1, Math.round(p.maxHp * ADS.REVIVE_HP_PCT));
    p.invulnUntil = this.time.now + ADS.REVIVE_INVULN_MS;
    const blinks = Math.max(1, Math.floor(ADS.REVIVE_INVULN_MS / 240));
    this.tweens.add({ targets: p, alpha: 0.35, duration: 120, yoyo: true, repeat: blinks - 1, onComplete: () => p.setAlpha(1) });
    const R = ADS.REVIVE_CLEAR_RADIUS;
    this.enemyPool.forEachActive((e) => {
      if (!e.active) return;
      const dx = e.x - p.x,
        dy = e.y - p.y;
      if (dx * dx + dy * dy > R * R) return;
      const died = e.takeDamage(e.maxHp * 0.6, null, p.x, p.y, true);
      if (died) this._onEnemyDeath(e);
    });
    this.enemyProjPool.forEachActive((b) => {
      const dx = b.x - p.x,
        dy = b.y - p.y;
      if (dx * dx + dy * dy < R * R) {
        b.kill?.();
        this.enemyProjPool.release(b);
      }
    });
    this._chestBurst(p.x, p.y, "golden");
    this.lighting?.flash(p.x, p.y, R * 1.5, 0xfff0a0, 900, 1.3);
    this.cameras.main.flash(260, 255, 240, 180);
    this.sound.play("sfx_levelup", { volume: 0.8, rate: 0.9 });
    this._toast("DE VOLTA À LUTA!", 2200, "#ffe58f");
    Analytics.track("revive", { t: Math.floor(this.elapsedMs / 1000), level: p.level });
  }

  // Moedas, gemas e (às vezes) coração/orbe saindo do baú
  _spawnChestLoot(x, y) {
    const ngems = Phaser.Math.Between(CHEST.GEMS_MIN, CHEST.GEMS_MAX);
    const ncoins = Phaser.Math.Between(CHEST.COINS_MIN, CHEST.COINS_MAX);
    const around = (d0, d1) => {
      const ang = Math.random() * Math.PI * 2;
      const d = d0 + Math.random() * d1;
      return [x + Math.cos(ang) * d, y + Math.sin(ang) * d];
    };
    for (let i = 0; i < ngems; i++) this.xpPool.acquire().spawn(...around(8, 22));
    for (let i = 0; i < ncoins; i++) this.coinPool.acquire().spawn(...around(8, 22));
    if (Math.random() < CHEST.HEART_CHANCE_OPEN) this.heartPool.acquire().spawn(x - 22, y);
    if (Math.random() < CHEST.AWAKEN_CHANCE_OPEN) this.awakenOrbPool.acquire().spawn(x + 22, y);
  }

  _chestBurst(x, y, kind) {
    this.lighting?.flash(x, y, kind === "golden" ? 380 : 240, kind === "trap" ? 0xff4060 : 0xffd070, 600, 1);
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

  _onGameOver(won, quit = false, skipRevive = false) {
    if (this.gameOver) return;
    // Segunda chance (anúncio premiado, 1x por partida) — só se os anúncios
    // estiverem ligados. Várias checagens de morte podem cair no mesmo quadro:
    // enquanto a oferta está aberta, ignora as repetidas.
    if (!won && !quit && !skipRevive) {
      if (this._reviveOpen) return;
      if (AdService.canShow("revive")) {
        this._reviveOpen = true;
        this.scene.pause();
        this.scene.launch("ReviveScene");
        return;
      }
    }
    this._reviveOpen = false;
    this.gameOver = true;
    const endlessS = this.endlessSeconds;
    let endlessRecord = false;
    if (this.endless) {
      won = true; // cair na Noite Eterna não apaga a vitória sobre o Ancião
      const bonus = Math.floor(endlessS / 60) * ENDLESS.COINS_PER_MIN;
      this._coinsGainedThisRun += bonus;
      endlessRecord = this.meta.registerEndless(endlessS);
      Analytics.track("endless_end", { s: Math.floor(endlessS), bonus, record: endlessRecord });
    }
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
    if (this._woodThisRun > 0) this.meta.addWood(this._woodThisRun);
    // Cada partida adianta a obra do João-de-barro (jogar acelera as obras)
    const builds = new Builds(this.meta);
    if (builds.job) {
      const min = BUILD.RUN_SPEEDUP_MIN + Math.floor(this.elapsedMs / 60000) * BUILD.RUN_SPEEDUP_PER_MIN;
      builds.advance(min * 60000);
      this.meta.data.lastRunBuildAdvanceMin = min;
      this.meta._save();
    }
    this.meta.registerRun(this.elapsedMs / 1000, won, this.diff.id);
    const newAchievements = this._checkAchievements(won, true);
    this._newUnlocksThisRun.push(...newAchievements.map((a) => a.name));
    Analytics.track("run_end", {
      won,
      quit,
      t: Math.floor(this.elapsedMs / 1000),
      level: this.player.level,
      kills: this.hud.kills,
      coins: coinsFinal,
      wood: this._woodThisRun,
      difficulty: this.diff.id,
      character: this.character.id,
    });
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
        woodGained: this._woodThisRun,
        newUnlocks: this._newUnlocksThisRun,
        difficulty: this.diff,
        endlessS,
        endlessRecord,
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
