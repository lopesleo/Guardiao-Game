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
  SHRINE,
  BUILD,
  GARDEN,
  BOSS_FIGHT,
  BIOMES,
  LIBERATION,
  PERF,
  AUDIO,
  FEEL,
} from "../config.js";
import { Pix, bayer, rng } from "../art/PixelArt.js";
import { shockwave } from "../art/Telegraph.js";
import { setMoment, resetMix, tapeStop, switchTrack } from "../audio/Mixer.js";
import { randomRareSeed } from "../systems/Garden.js";
import { recipe, mealMods, bonusText } from "../systems/Kitchen.js";
import { Daily, dailyUnlocked } from "../systems/Daily.js";
import { InputManager } from "../systems/InputManager.js";
import { Pool } from "../systems/Pool.js";
import { GameFeel } from "../systems/GameFeel.js";
import { Puffs } from "../systems/Puffs.js";
import { ShrineSystem } from "../systems/ShrineSystem.js";
import { SpawnDirector } from "../systems/SpawnDirector.js";
import { RunEvents } from "../systems/RunEvents.js";
import { Hazards } from "../systems/BossKit.js";
import "../entities/WeaponsLeva3.js"; // registra as armas da leva 3 (registerWeapon)
import "../entities/WeaponsVento.js"; // registra as armas de vento
import "../entities/BossCaboclo.js"; // registra o chefe da Caatinga (registerBoss)
import { DustDevils } from "../world/DustDevils.js";
import { ElementalSystem } from "../systems/ElementalSystem.js";
import { WeaponFX, D_FX } from "../systems/WeaponFX.js";
import { UpgradeSystem } from "../systems/UpgradeSystem.js";
import { MetaProgression } from "../systems/MetaProgression.js";
import { Leaderboards } from "../systems/Leaderboards.js";
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
  SeedPickup,
  HeartPickup,
  AwakenOrb,
} from "../entities/Pickups.js";
import { Chest } from "../entities/Chest.js";
import { DamageNumberPool } from "../entities/DamageNumber.js";
import { HUD } from "../ui/HUD.js";
import { ForestWorld } from "../world/ForestWorld.js";
import { Lighting } from "../world/Lighting.js";
import { vw, vh, text, drawFrame, fitCamera, Button, haptic } from "../ui/Theme.js";
import { applyZoom } from "../ui/Zoom.js";
import { CSS, PAL, hex } from "../art/Palette.js";
import { DEBUG } from "../systems/Platform.js";
import { Settings } from "../systems/Settings.js";
import { Analytics } from "../systems/Analytics.js";
import { AdService } from "../systems/AdService.js";
import { QualityWatchdog } from "../systems/QualityWatchdog.js";
import { LanternSystem } from "../systems/LanternSystem.js";
import { Builds } from "../systems/Builds.js";
import { VirtualJoystick, joyRight } from "../ui/VirtualJoystick.js";
import { Cosmetics } from "../systems/Cosmetics.js";
import { tr } from "../i18n/i18n.js";

const BOSS_TEX = { mapinguari: "mon_boss", caboclo: "mon_caboclo" };
// Cor ao longo de uma rampa de cores da paleta (t de 0 a 1)
function rampColor(cols, t) {
  const f = Math.min(0.9999, Math.max(0, t)) * (cols.length - 1),
    i = Math.floor(f),
    k = f - i;
  const a = cols[i],
    b = cols[i + 1];
  const ch = (c, sh) => (c >> sh) & 255;
  const m = (sh) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    fitCamera(this);
    this._hintQueue = []; // a cena é reaproveitada em "Jogar de novo"
    this._hintOn = null;
    const WS = GAME.WORLD_RADIUS * 2;
    // Limite físico na face de dentro da muralha (ver ARENA em config.js)
    this.physics.world.setBounds(ARENA.minX, ARENA.minY, ARENA.maxX - ARENA.minX, ARENA.maxY - ARENA.minY);

    this.inputMgr = new InputManager(this);
    this.joystick = new VirtualJoystick(this.inputMgr);
    // Pausa, cartas de nível, baú: o joystick (fixo fica sempre visível) sai de cena junto e volta
    // sozinho no update(), que só roda com a partida andando. NÃO depender de um ouvinte de
    // "resume": um off("resume") geral já o apagou e o joystick morria depois da 1ª carta (18/10/2026)
    // (a cena é reaproveitada: os ouvintes saem no shutdown, pelo nome, senão acumulam a cada partida)
    const joyOff = () => this.joystick?.setActive(false);
    this.events.on("pause", joyOff);
    // Conquista pendente (checagem de 1×/s) sai antes de pausar: dá para sair da partida pelo menu
    this._achPending = false;
    this._achNextAt = 0;
    this.events.on("pause", this._flushAchievements, this);
    // Som: partida pausada por cima (cartas, Pausa, Reviver, Noite Eterna) = música e efeitos abafados;
    // volta ao retomar (ver AUDIO.MUFFLE). A morte é outro momento (tapeStop em _onGameOver)
    resetMix();
    const muffle = () => setMoment("muffle");
    const unmuffle = () => !this.gameOver && setMoment("normal");
    this.events.on("pause", muffle);
    this.events.on("resume", unmuffle);
    // O Phaser não chama shutdown() sozinho: sem isto, cada partida deixava uma
    // camada de toque (joystick) e a música anteriores para trás
    this.events.once("shutdown", () => {
      this.events.off("pause", joyOff);
      this.events.off("pause", this._flushAchievements, this);
      // saiu sem passar pelo fim da partida: a pendente vale, sem aviso (a cena está saindo)
      if (this._achPending && !this.gameOver) {
        this._achPending = false;
        this._checkAchievements(false, true);
      }
      this.events.off("pause", muffle);
      this.events.off("resume", unmuffle);
      this.events.off("player:levelup", this._onLevelUp, this);
      this.events.off("resume", this._onResume, this);
      this.joystick?.destroy();
      this.joystick = null;
      this.shutdown();
    });

    // Meta-progressão (carrega desbloqueios disponíveis)
    this.meta = new MetaProgression();
    // Bioma (mapa) escolhido na trilha da Clareira — ver BIOMES em config.js
    this.biomeId = this.meta.selectedBiome;
    this.biome = BIOMES[this.biomeId];
    this.world = new ForestWorld(this, { biome: this.biome, entrance: { half: INTRO.PATH_HALF, y: ARENA.maxY } });
    this.dust = this.biome.hazard === "dust" ? new DustDevils(this) : null;
    // Dificuldade da run (clampa ao desbloqueado por segurança)
    const diffIdx = Math.min(this.meta.selectedDifficulty, DIFFICULTY.length - 1);
    this.diff = DIFFICULTY[diffIdx] || DIFFICULTY[0];
    // Duração da partida pelo Perigo. `pace` (<= 1) estica o relógio das waves/roteiro/spawn
    // para a mesma jornada caber em mais tempo (ver GAME.RUN_DURATION_S).
    this.runDurationS = this.diff.durationS ?? GAME.RUN_DURATION_S;
    this.pace = GAME.RUN_DURATION_S / this.runDurationS;
    this._coinsGainedThisRun = 0;
    this._showDmgNumbers = Settings.get("dmgNumbers");
    this._newUnlocksThisRun = [];
    // Feitos da Forja ainda abertos: no fim da partida avisa os que esta partida cumpriu
    this._deedsOpen = META.WEAPON_UNLOCK_ORDER.filter((k) => !this.meta.isUnlocked(k) && !this.meta.deedDone(k));
    this._charDeedsOpen = CHARACTERS.filter((c) => !this.meta.hasCharacter(c.id) && this.meta.characterDeed(c.id) && !this.meta.characterDeed(c.id).done);
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
    // Depois da física: brilhos dos tiros seguem os tiros (src/entities/Halo.js) e os pickups, que
    // não têm corpo Arcade, dão o passo deles (Pickups.js)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this._postUpdate, this);
    this.xpPool = new Pool(() => new XPGem(this), 50);
    this.coinPool = new Pool(() => new CoinPickup(this), 20);
    this.woodPool = new Pool(() => new WoodPickup(this), 12);
    this._woodThisRun = 0;
    this.seedPool = new Pool(() => new SeedPickup(this), 6);
    this._seedsThisRun = {};
    // Para as missões do dia: o que ESTA partida fez
    this._runChests = 0;
    this._runLanterns = 0;
    this._reactionsAtStart = { ...(this.meta.data.stats.reactions || {}) };
    // Livro de dano (balanceamento): vida que cada fonte tirou nesta partida. A fonte é marcada
    // em _dmgSrc logo antes do golpe (arma = chave da arma de origem, rx_* = reação, st_* = status)
    this._dmgBy = Object.create(null);
    this._dmgSrc = null;
    // Assistência: o dano de cada reação dividido entre as armas que puseram os dois elementos
    this._assistBy = Object.create(null);
    this._dmgAssist = null;
    this._hitSrc = null;
    // Sementes raras só depois que a Horta apareceu (uma novidade por vez)
    this._seedsOn = (this.meta.data.revealed || []).includes("garden");
    this.heartPool = new Pool(() => new HeartPickup(this), 10);
    this.awakenOrbPool = new Pool(() => new AwakenOrb(this), 10);
    this._pickupPools = [this.xpPool, this.coinPool, this.woodPool, this.seedPool, this.heartPool, this.awakenOrbPool];
    this.dmgNumberPool = new DamageNumberPool(this); // por estilo: reaproveitar só troca o texto

    // Sistemas
    this.elemental = new ElementalSystem(this);
    this.fx = new WeaponFX(this);
    this.cosm = Cosmetics.forScene(this); // protótipo do Kit Ipê-rosa (só ?debug=1&kit=ipe; docs/COSMETICOS.md)
    this.hazards = new Hazards(this); // fogo no chão dos golpes de chefe
    this._bossBrains = new Set(); // cérebros de chefe vivos (luzes dos golpes)
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
    // Refeição da Clareira: vale só nesta partida (consumida ao entrar)
    const meal = this.meta.data.meal;
    if (meal && recipe(meal.id)) {
      const m = mealMods(meal);
      this._applyCharacterMods(this.player, m);
      if (m.xp) this.player._xpMult *= m.xp;
      if (m.pickup) this.player.pickupRadius *= m.pickup;
      this.meta.data.meal = null;
      this.meta.data.stats.mealsEaten = (this.meta.data.stats.mealsEaten || 0) + 1;
      this.meta._save();
      const r = recipe(meal.id);
      this.time.delayedCall(2500, () => this._toast(`${r.name}: ${bonusText(r, meal.q)}`, 2600, "#ffc86b"));
      Analytics.track("meal_eaten", { id: meal.id, q: meal.q });
    }
    // Balanceamento: com que força permanente e com qual refeição a partida começou
    // (vai no run_start e no run_end para separar as vitórias por buff)
    this._runPower = BLESSINGS.reduce((s, b) => s + this.meta.blessingRank(b.id), 0);
    this._runAnc = anc;
    this._runMeal = meal && recipe(meal.id) ? meal.id : "";
    this._runMealQ = meal && recipe(meal.id) ? meal.q : 0;
    // Locks de habilidades: bloqueia se não comprou
    this.player.dashUnlocked = this.meta.hasAbility("DASH");
    this.player.awakenUnlocked = this.meta.hasAbility("AWAKEN");
    this.player.addWeapon(new WEAPON_CLASSES[this.character.weapon](this));

    // Spawner
    this.spawnDirector = new SpawnDirector(this, this.enemyPool, this.player);
    this.lighting = new Lighting(this, this.world);
    this.puffs = new Puffs(this); // pó da morte e faíscas (imagens reaproveitadas)
    this.feel = new GameFeel(this);
    // Aparelho fraco: desliga a iluminação na 1ª partida (uma vez só)
    this.quality = new QualityWatchdog(this, () => {
      this.lighting.setEnabled(false);
      this._hint("quality", tr("Iluminação desligada para o jogo rodar liso.\nDá pra religar em Opções."));
    });
    AdService.newRun();
    // nº desta partida na vida do jogador: o funil da 1ª sessão (onde o novato desiste) sai daqui
    this._runN = (this.meta.data.runsPlayed || 0) + 1;
    Analytics.track("run_start", {
      run_n: this._runN,
      character: this.character.id,
      difficulty: this.diff.id,
      biome: this.biomeId,
      power: this._runPower,
      anc: this._runAnc,
      meal: this._runMeal,
      meal_q: this._runMealQ,
    });
    this.runEvents = new RunEvents(this);
    this.lanterns = new LanternSystem(this);
    this.shrines = new ShrineSystem(this);

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
    this._zoom = null; // a cena é reaproveitada em "Jogar de novo"
    applyZoom(this); // acessibilidade: mundo maior, interface do mesmo tamanho

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
      this._toast(tr("★ Despertar cheio"));
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
        this.elapsedMs = this.runDurationS * 1000;
        this._spawnBoss();
        this._toast("BOSS spawned");
      } else {
        this._toast("Boss já está vivo");
      }
    });
    // Minichefes na hora (testar os golpes especiais): M = Mula, C = Corpo-Seco
    this.input.keyboard.on("keydown-M", () => this.runEvents._run({ type: "miniboss", kind: "alpha", msg: tr("A MULA SEM CABEÇA GALOPA!") }));
    this.input.keyboard.on("keydown-C", () => this.runEvents._run({ type: "miniboss", kind: "elder", msg: tr("O CORPO-SECO SE LEVANTA!") }));
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
        "9=Awaken 8=+50XP 7=+20s 0=Boss M=Mula C=Corpo-Seco G=God K=KillAll H=Heal",
        4500,
      );
    });
    }
    // =================================================================

    // Level-up
    // FILA de level-ups: vários de uma vez (XP alto, baú dourado) abrem a tela
    // de cartas em sequência — antes, reabrir por cima descartava escolhas.
    this._pendingLevelUps = 0;
    // O emissor de eventos da cena SOBREVIVE a reinícios (Jogar de novo): os dois saem pelo nome no
    // shutdown (sem isso, cada partida somava mais um ouvinte → cartas em dobro/triplo). Nunca
    // off("evento") sem a função: apaga também os ouvintes dos outros (ex.: o do joystick)
    this.events.on("player:levelup", this._onLevelUp, this);
    // Quando o LevelUpScene termina, atualiza painel de armas + checa
    // conquistas de arma (Lv máximo / arsenal completo)
    this.events.on("resume", this._onResume, this);

    // Música
    if (!this.bgMusic) {
      this.bgMusic = this.sound.add(this.biome.music ?? "music_gameplay", {
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
    const env = this.world.keys;
    // Trilha de terra atravessando a muralha de árvores
    for (let y = this._introEndY - 50; y < R + 80; y += 36) {
      this.add.image((y % 3) * 5, y, this.world.atlas, env.patches.dirt[(y / 36) % env.patches.dirt.length | 0]).setScale(S).setDepth(-50);
    }
    // Lados da brecha: mesma regra da muralha sul (copa começando na linha do
    // limite), em fileiras descendo — a trilha passa ENTRE as árvores
    const trees = [...env.trees, ...Array.from({ length: this.biome.wallPines ?? 2 }, () => env.pines).flat()];
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const x = side * (INTRO.PATH_HALF + 70 + (i % 2) * 10);
        this.world.southTree(x, this._gateY - 4 + i * 48, trees).setFlipX(side > 0);
      }
    }
    // Some o HUD durante a entrada (volta junto com o controle)
    // (só o HUD: profundidade >= 50000; a camada de luz e o chão ficam)
    this._introHud = this.children.list.filter((o) => o.scrollFactorX === 0 && o.visible && o.depth >= 50000 && o !== this.lighting?.rt && o !== this.feel?.vignette);
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
    const env = this.world.keys;
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
  // aguentar limpezas em massa (Sobrecarga/Vapor). Imagens reaproveitadas (Puffs.js):
  // criar e destruir 3 imagens por abate era o pico das matanças.
  _deathPoof(x, y) {
    if (this.puffs.count.poof > 60) return;
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 16;
      const s0 = 1.2 + Math.random() * 1.2;
      const ms = 260 + Math.random() * 120;
      this.puffs.spawn("poof", "px_puff", x, y, x + Math.cos(ang) * d, y + Math.sin(ang) * d - 8, s0, 0.4, 0.9, i % 2 ? 0xf4ecd6 : 0x9fb4a4, y + 10001, ms);
    }
  }

  // Dicas contextuais — cada uma aparece UMA vez na vida do save, no momento
  // em que a mecânica surge (substitui o tutorial em páginas).
  _hint(id, msg, ms = 4200) {
    const seen = (this.meta.data.hintsSeen ||= []);
    if (seen.includes(id)) return;
    seen.push(id);
    this.meta._save();
    // Uma dica por vez: fila que anda quando a da tela SOME (o hit-stop desacelera
    // os tweens, então um prazo fixo deixava duas empilhadas)
    (this._hintQueue ||= []).push([msg, ms]);
    if (!this._hintOn?.active) this._nextHint();
  }

  _nextHint() {
    const next = this._hintQueue?.shift();
    if (next) this._hintOn = this._showHint(...next);
  }

  _showHint(msg, ms) {
    const W = vw(this);
    const c = this.add.container(W / 2, 150).setScrollFactor(0).setDepth(60500);
    const t = text(this, 0, 0, msg, { size: 22, origin: 0.5, align: "center", wrap: Math.min(700, W - 80) });
    const w = t.width + 60,
      h = t.height + 30;
    const g = this.add.graphics();
    drawFrame(g, -w / 2, -h / 2, w, h, "gold", { alpha: 0.92 });
    c.add([g, t]);
    // Sempre abaixo da faixa onde a barra de chefe pode surgir (se ela aparecer
    // depois da dica, não a cobre)
    const y = 164 + h / 2;
    c.setAlpha(0).setY(y - 20);
    this.tweens.add({ targets: c, alpha: 1, y, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({
      targets: c,
      alpha: 0,
      delay: ms,
      duration: 400,
      onComplete: () => {
        c.destroy();
        this._nextHint();
      },
    });
    return c;
  }

  _showOnboarding() {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.time.delayedCall(600, () =>
      this._hint(
        "move",
        touch
          ? joyRight()
            ? tr("Arraste o polegar na direita para andar.\nO ataque é automático!")
            : tr("Arraste o polegar na esquerda para andar.\nO ataque é automático!")
          : tr("Ande com WASD ou setas.\nO ataque é automático!"),
      ),
    );
  }

  // Wave "esticada" pelo pace: o chefe chega na mesma wave em qualquer duração.
  waveIndex() {
    return Math.floor((this.elapsedMs * this.pace) / 30000);
  }

  update(time, dt) {
    if (this.gameOver) {
      // inimigos param, mas o pisca do último golpe ainda volta à cor (era um delayedCall)
      this.enemyPool.forEachActive((e) => {
        if (e._flashUntil && time >= e._flashUntil) {
          e._flashUntil = 0;
          this.elemental?._updateTint(e);
        }
      });
      return;
    }
    this.joystick?.setActive(true); // partida andando = joystick ligado (a pausa desliga)
    if (this._intro) return this._updateIntro(time, dt);
    this.elapsedMs += dt;
    this.cosm?.update(time);

    // Conquista "Maratonista" (10:00) — checagem explícita porque na fase de
    // boss não há kills de horda pra disparar a checagem por kill
    if (!this._survive10Checked && this.elapsedMs >= 600000) {
      this._survive10Checked = true;
      this._checkAchievements();
    }
    if (this._achPending && time >= this._achNextAt) this._flushAchievements();

    // Aviso de boss 30 s antes
    if (
      !this.bossWarned &&
      this.elapsedMs >= (this.runDurationS - 30) * 1000
    ) {
      this.bossWarned = true;
      this.hud.showBossBanner(this.biome.wake);
    }
    // Spawn do boss ao fim da duração do Perigo
    if (!this.boss && !this.endless && this.elapsedMs >= this.runDurationS * 1000) {
      this._spawnBoss();
    }

    this.inputMgr.update();
    this.dust?.update(time, dt); // antes do herói: o empurrão entra neste quadro
    this.player.update(time, dt, this.inputMgr);
    if (!this.boss) {
      this.spawnDirector.update(time, dt);
      this.runEvents.update();
    }
    this.lanterns.update(time, this.elapsedMs, this.player);
    this.feel.update(time, dt);
    this.fx.update(dt);
    this.shrines.update(time, dt, this.player);
    this._updateSpores(time, dt);
    this.elemental.tick(time);
    this.hazards.update(time);
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
        this._hint("chest", tr("Um baú! Encoste nele para abrir.\nCuidado: alguns são armadilhas…"));
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
          this._dmgSrc = this._hitSrc = p.src || "other";
          const died = this.boss.takeDamage(p.dmg, null, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, p.element, p.crit);
          this.fx.impact(p.x, p.y, p.element, { dir: Math.atan2(p.body.velocity.y, p.body.velocity.x), power: 1.3, crit: p.crit });
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
          this._dmgSrc = this._hitSrc = p.src || "other";
          const died = e.takeDamage(p.dmg, p.element, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(e.x, e.y, p.dmg, p.element, p.crit);
          p.onImpact?.(p.x, p.y); // hook de evolução (nuvem da Tempestade de Vapor)
          this.fx.impact(p.x, p.y, p.element, { dir: Math.atan2(p.body.velocity.y, p.body.velocity.x), power: 1.1, crit: p.crit });
          p.kill();
          this.projectilePool.release(p);
          if (died) this._onEnemyDeath(e);
        }
      });
    });

    // Varas Encantadas (voo de ida e volta) — atravessam inimigos, podem re-hit após cooldown
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
          this._dmgSrc = this._hitSrc = p.src || "other";
          const died = this.boss.takeDamage(p.dmg, null, p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(this.boss.x, this.boss.y, p.dmg, "fire", p.crit);
          this.elemental.applyStatus(this.boss, "fire");
          this.fx.impact(p.x, p.y, "fire", { power: 1, crit: p.crit });
          if (died) this._onBossDeath();
        }
      }
      this.enemyPool.forEachActive((e) => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x,
          dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22 && p.canHit(e, time)) {
          this._dmgSrc = this._hitSrc = p.src || "other";
          const died = e.takeDamage(p.dmg, "fire", p.x, p.y, p.crit);
          this.player.lifestealFrom(p.dmg);
          this._showDmg(e.x, e.y, p.dmg, "fire", p.crit);
          this.fx.impact(e.x, e.y - 6, "fire", { dir: Math.atan2(p.body.velocity.y, p.body.velocity.x), power: 0.8, crit: p.crit });
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

    // Gemas + moedas (acima do teto, as gemas mais longe se fundem: _capGems)
    if (time >= (this._gemCapAt ?? 0)) {
      this._gemCapAt = time + PERF.GEM_CAP_CHECK_MS;
      this._capGems();
    }
    this.xpPool.forEachActive((g) => {
      g.update(time, dt, this.player);
      const dx = g.x - this.player.x,
        dy = g.y - this.player.y;
      if (
        dx * dx + dy * dy <
        this.player.pickupRadius * this.player.pickupRadius
      ) {
        this.player.gainXp(g.xpValue);
        this.sound.play("sfx_pickup", { volume: 0.18, rate: this.feel.gem(g) });
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
        this._hint("wood", tr("Madeira Ancestral! Leve para a Clareira:\nela serve para as obras do acampamento."));
        w.pickup();
        this.woodPool.release(w);
      }
    });
    // Sementes raras
    this.seedPool.forEachActive((s) => {
      s.update(time, dt, this.player);
      const dx = s.x - this.player.x,
        dy = s.y - this.player.y;
      if (dx * dx + dy * dy < this.player.pickupRadius * this.player.pickupRadius) {
        const id = randomRareSeed(this.biomeId);
        this._seedsThisRun[id] = (this._seedsThisRun[id] || 0) + 1;
        this.sound.play("sfx_chest_reel", { volume: 0.5, rate: 1.3 });
        this._toast(tr("Semente rara: {0}", GARDEN.CROPS[id].name), 1800, "#ffe58f");
        s.pickup();
        this.seedPool.release(s);
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
    if (m.luck) p.luck = (p.luck || 0) + m.luck;
  }

  _onLevelUp() {
    this.lighting?.flash(this.player.x, this.player.y, 420, 0xffe58f, 500, 1);
    this.feel.levelUp();
    this._pendingLevelUps++;
    Analytics.track("level_up", { level: this.player.level, t: Math.floor(this.elapsedMs / 1000) });
    this._openNextLevelUp();
  }

  _onResume() {
    this.quality.reset();
    this._levelUpOpen = false;
    this.hud.refreshWeapons();
    this.hud.levelSettle?.(); // a barra cheia e dourada esvazia até o XP que sobrou; o selo do nível pula
    this._checkAchievements();
    if (this._pendingLevelUps > 0) this.time.delayedCall(120, () => this._openNextLevelUp());
  }

  _openNextLevelUp() {
    if (this._pendingLevelUps <= 0 || this.gameOver) return;
    // pause()/launch() do Phaser são enfileirados pro próximo frame: a flag
    // evita abrir 2× no mesmo tick
    if (this._levelUpOpen) return;
    // a mesa anterior ainda está saindo (a carta escolhida voando para o herói): espera ela fechar
    if (this.scene.isActive("LevelUpScene")) return void this.time.delayedCall(60, () => this._openNextLevelUp());
    this._levelUpOpen = true;
    this._pendingLevelUps--;
    const cards = this.upgrades.generateCards(this.player);
    this.scene.pause();
    this.scene.launch("LevelUpScene", {
      cards,
      player: this.player,
      gameScene: this,
      from: this.heroOnScreen(), // as cartas saem do herói (FEEL.LEVEL)
    });
  }

  // Onde o herói (o peito dele) aparece na tela, em px da tela (com o zoom de acessibilidade): as cenas por
  // cima (cartas) partem daqui
  heroOnScreen() {
    const cam = this.cameras.main,
      p = this.player;
    const wv = cam.worldView;
    return { x: (p.x - wv.x) * cam.zoom + cam.x, y: (p.y - p.displayHeight * 0.1 - wv.y) * cam.zoom + cam.y };
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
    // Quebra linha em textos longos (laços trazem nome + o que fazem); empilha pela altura real
    const t = text(this, 0, 0, msg, { size: 18, color, origin: 0.5, align: "center", wrap: Math.min(vw(this) - 80, 640) });
    const w = t.width + 36,
      h = Math.max(38, t.height + 14);
    const y = vh(this) - 130 - this._toasts.reduce((a, o) => a + (o._h ?? 38) + 6, 0) - (h - 38) / 2;
    const c = this.add.container(vw(this) / 2, y).setScrollFactor(0).setDepth(60000);
    c._h = h;
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

  // Abates e reações pedem a checagem a toda hora (numa matança, dezenas por quadro): roda na hora
  // se a última foi há mais de PERF.ACHIEVEMENT_CHECK_MS; senão fica pendente e sai no fim do
  // intervalo (update), na pausa ou no fim da partida (_onGameOver checa tudo de novo). Nada se perde.
  _checkAchievementsSoon() {
    const now = this.time.now;
    if (now >= (this._achNextAt ?? 0)) {
      this._achNextAt = now + PERF.ACHIEVEMENT_CHECK_MS;
      this._achPending = false;
      this._checkAchievements();
    } else this._achPending = true;
  }
  _flushAchievements() {
    if (!this._achPending || this.gameOver) return;
    this._achPending = false;
    this._achNextAt = this.time.now + PERF.ACHIEVEMENT_CHECK_MS;
    this._checkAchievements();
  }

  // Checa conquistas pendentes; mostra toast pra cada recém-desbloqueada.
  // silent=true no game over (a tela final já exibe no painel de desbloqueios).
  _checkAchievements(won = false, silent = false) {
    const newly = this.meta.checkAchievements(this._runCtx(won));
    if (!silent && newly.length) {
      this.sound.play("sfx_levelup", { volume: 0.5, rate: 1.3 });
      this._toast(tr("Conquista: {0}", newly.map((a) => a.name).join(" · ")), 3000, "#e8ccff");
    }
    return newly;
  }

  // Golpe no PONTO FRACO de um chefe: takeDamage marca o alvo e a ampliação;
  // o número de dano que sai logo em seguida (mesma posição) mostra o valor real.
  // O alvo levou dano diferente do golpe (ponto fraco, couraça do chefe): quem bateu chama
  // _showDmg logo depois, na mesma posição e no mesmo quadro, e o número mostra o dano REAL
  _markHit(target, mult, o = {}) {
    this._ampMark = { x: target.x, y: target.y, amp: mult, weak: !!o.weak, resisted: !!o.resisted, t: this.time.now };
  }
  _markAmp(target, amp) {
    this._markHit(target, amp, { weak: true });
  }

  _showDmg(x, y, dmg, element, crit = false) {
    const m = this._ampMark;
    let resisted = false;
    if (m && element !== "heal" && m.t === this.time.now && Math.abs(m.x - x) < 1 && Math.abs(m.y - y) < 1) {
      this._ampMark = null;
      dmg = Math.max(1, Math.round(dmg * m.amp));
      if (m.weak) crit = true; // dourado e grande: o jogador VÊ que achou o ponto fraco
      else if (m.resisted) (resisted = true), (crit = false); // cinza e pequeno: a couraça segurou
    }
    if (element !== "heal" && !this._showDmgNumbers) return;
    let color;
    if (resisted) color = hex(PAL.s4);
    else if (crit) color = "#ffd96b";
    else if (element === "ice") color = "#9ad4ff";
    else if (element === "bolt") color = "#d8a8ff";
    else if (element === "wind") color = "#b8f0dc";
    else if (element === "fire") color = "#ff9966";
    else if (element === "heal") color = "#6fcf6f";
    else color = "#ffffff";
    const text =
      element === "heal" ? `+${dmg}` : crit ? `${Math.ceil(dmg)}!` : dmg;
    this.dmgNumberPool.show(x, y, text, color, crit);
  }

  _onEnemyDeath(enemy) {
    if (!enemy.active) return;
    this.hud.addKill();
    this.meta.recordKill();
    this._checkAchievementsSoon();
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
    // Sem tremor por abate comum: no fim da partida eram 6 abates/s e a câmera tremia 1/3 do tempo (e o
    // tremor fraco em curso engolia os fortes). O abate pesa no estalo, na matéria e no som (FEEL)
    const big = !!(enemy.miniBoss || enemy._elite);
    if (enemy.miniBoss || enemy._elite === "mimic") this.feel.bigKill(enemy.x, enemy.y);
    this._deathPoof(enemy.x, enemy.y);
    this.fx.kill(enemy.x, enemy.y - enemy.displayHeight * 0.2, enemy._lastEl, big);
    this.cosm?.kill(enemy.x, enemy.y, big);
    // Drop XP sempre
    const g = this.xpPool.acquire();
    g.spawn(enemy.x, enemy.y);
    // Drops aleatórios
    // Sorte (passiva Trevo) escala as chances de drop
    const r = Math.random() / (1 + (this.player.luck || 0) + (this.shrines?.greedActive ? SHRINE.GREED.LUCK : 0));
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
    this._toast(tr("{0} DERROTADO!", e.miniBoss), 2200, "#ffe58f");
    const chest = new Chest(this, x, y);
    chest.forceKind = "golden";
    this.chests.push(chest);
    for (let i = 0; i < 3; i++) this.xpPool.acquire().spawn(x + (i - 1) * 26, y + 30, 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.coinPool.acquire().spawn(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
    }
    this._spawnWood(x, y, WOOD.MINIBOSS);
    this._spawnSeeds(x, y, GARDEN.SEEDS.MINIBOSS);
    this.meta.recordStat("miniBosses"); // feitos: Açoite / Comadre Fulozinha
    if (e._brain?.log.flawless) this._flawlessBonus(x, y, BOSS_FIGHT.FLAWLESS_WOOD.MINIBOSS, e._brain.log);
    if (this.hud.boss === e) this.hud.clearBoss();
  }

  _recordDmg(src, n, assist = null) {
    if (!(n > 0) || !this._dmgBy) return;
    const k = src || "other";
    this._dmgBy[k] = (this._dmgBy[k] || 0) + n;
    // Reação: divide o dano entre as armas que montaram o par (só armas; status vindos de
    // reação não têm autor). A reação continua contando na linha dela; isto é um crédito a mais
    if (assist?.length && k.startsWith("rx_")) {
      const share = n / assist.length;
      for (const w of assist) this._assistBy[w] = (this._assistBy[w] || 0) + share;
    }
  }

  // Balanceamento: a build no fim da partida em texto curto (cabe nos 100 caracteres do Firebase).
  // armas "STAFF5,AURA3" (chave + nível; evoluída = chave da evolução), passivas "hp2,speed1"
  _buildSummary() {
    const p = this.player;
    const evolved = (w) => !!WEAPONS[w.key]?.evolvesFrom;
    return {
      weapons: p.weapons.map((w) => `${w.key}${w.level}`).join(","),
      passives: Object.entries(p.passivesTaken || {}).map(([id, n]) => `${id}${n}`).join(","),
      links: p.links?.active?.size || 0,
      evos: p.weapons.filter(evolved).length,
      pacts: this.upgrades?.pactsTaken?.size || 0,
    };
  }

  // Uma linha por arma, por passiva e pelas reações da partida: dá para ver no Analytics a taxa de
  // vitória de cada arma/passiva por Perigo, sem quebrar texto (o Firebase não separa listas)
  _trackBuild(won, quit, byType) {
    const base = { won, quit, difficulty: this.diff.id, run_n: this._runN, character: this.character.id };
    // Dano: arma = linha da arma (evolução soma na de origem); % sobre TODO o dano da partida
    const by = this._dmgBy || {};
    const total = this._dmgTotal();
    const pct = (n) => (total > 0 ? Math.round((1000 * n) / total) / 10 : 0);
    for (const w of this.player.weapons) {
      const evo = WEAPONS[w.key]?.evolvesFrom;
      const dmg = by[evo || w.key] || 0;
      const assist = this._assistBy?.[evo || w.key] || 0;
      Analytics.track("run_weapon", {
        ...base, weapon: w.key, base_weapon: evo || w.key, lvl: w.level, evolved: !!evo,
        dmg: Math.round(dmg), dmg_pct: pct(dmg),
        dmg_assist: Math.round(assist), assist_pct: pct(assist), // reações que esta arma ajudou a montar
      });
    }
    for (const [id, n] of Object.entries(this.player.passivesTaken || {})) {
      Analytics.track("run_passive", { ...base, passive: id, stacks: n });
    }
    // Reações: quantas (rx_*) e quanto dano (rxd_*); status (queimadura/choque) e o resto
    const rx = {};
    for (const [k, n] of Object.entries(byType)) if (n > 0) rx[`rx_${k.toLowerCase()}`] = n;
    let st = 0, other = 0;
    for (const [k, n] of Object.entries(by)) {
      if (k.startsWith("rx_")) rx[`rxd_${k.slice(3)}`] = Math.round(n);
      else if (k.startsWith("st_")) st += n;
      else if (!WEAPONS[k]) other += n; // item, revive, other
    }
    Analytics.track("run_reactions", { ...base, ...rx, dmg_status: Math.round(st), dmg_other: Math.round(other), dmg_total: Math.round(total) });
  }

  _dmgTotal() {
    return Object.values(this._dmgBy || {}).reduce((s, n) => s + n, 0);
  }

  // % de TODO o dano da partida por arma (a evolução conta na linha da arma de origem, como no _trackBuild):
  // a fileira de armas da tela de resultado
  _dmgShare() {
    const by = this._dmgBy || {};
    const total = this._dmgTotal();
    return Object.fromEntries(this.player.weapons.map((w) => [w.key, total > 0 ? Math.round((1000 * (by[WEAPONS[w.key]?.evolvesFrom || w.key] || 0)) / total) / 10 : 0]));
  }

  // "Desviou de tudo": nenhum golpe especial acertou o herói nesta luta
  _flawlessBonus(x, y, wood, log) {
    this.meta.recordStat("flawless"); // feitos: Miragem / Anhangá
    this.time.delayedCall(900, () => {
      if (this.gameOver) return;
      this._toast(tr("DESVIOU DE TUDO! +{0} Madeira Ancestral", wood), 2600, "#c8f08c");
      this.sound.play("sfx_levelup", { volume: 0.5, rate: 1.25 });
      this._spawnWood(x, y, wood);
    });
    Analytics.track("boss_flawless", { specials: log.specials, dodges: log.dodges });
  }

  // Madeira Ancestral saltando em volta de (x, y)
  _spawnWood(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.6;
      const d = 24 + Math.random() * 26;
      this.woodPool.acquire().spawn(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
  }

  // Sementes raras saltando em volta de (x, y)
  _spawnSeeds(x, y, n) {
    if (!this._seedsOn) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.seedPool.acquire().spawn(x + Math.cos(a) * 36, y + Math.sin(a) * 30);
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

  // Teto de gemas no chão (PERF.GEM_CAP). Numa partida longa elas passavam de 250 — cada uma com
  // sprite, corpo e update por quadro. Acima do teto, a gema parada mais longe do herói (quase sempre
  // fora da tela) se funde na vizinha mais próxima: o XP vai somado e a gema fica no centro de massa
  // do XP das duas (XPGem.absorb). Gemas puxadas pelo ímã ou ainda no pulinho de saída não entram.
  _capGems() {
    const pool = this.xpPool;
    let excess = pool.size - PERF.GEM_CAP;
    if (excess <= 0) return;
    const list = (this._gemList ||= []);
    list.length = 0;
    const px = this.player.x,
      py = this.player.y;
    for (const g of pool.inUse) {
      if (!g.active || g._pulled || g._hop?.isPlaying()) continue;
      g._capD2 = (g.x - px) ** 2 + (g.y - py) ** 2;
      list.push(g);
    }
    list.sort((a, b) => b._capD2 - a._capD2); // mais longe primeiro
    for (let i = 0; i < list.length - 1 && excess > 0; i++) {
      const g = list[i];
      let best = null,
        bd = Infinity;
      for (let j = i + 1; j < list.length; j++) {
        const h = list[j];
        const d = (h.x - g.x) ** 2 + (h.y - g.y) ** 2;
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      if (!best) break;
      best.absorb(g);
      g.pickup();
      pool.release(g);
      excess--;
    }
    list.length = 0;
  }

  // Empurra inimigos sobrepostos pra longe uns dos outros (separação tipo flocking).
  // Congelados não se movem, mas ainda empurram quem encosta.
  // Varredura por x: a lista (a mesma de um quadro para o outro, sem alocar) fica ordenada por x —
  // quase ordenada de um quadro para o outro, a ordenação por inserção custa ~n — e cada inimigo só
  // testa os da direita até a maior distância de contato. Raio e congelamento: 1 leitura por inimigo
  // por quadro (o raio acompanha o "soco" do golpe, como antes). Antes: todos os pares (n²), lista
  // nova por quadro e displayWidth/isFrozen lidos em cada par.
  _separateEnemies(now) {
    const list = (this._sepList ||= []);
    const stamp = (this._sepStamp = (this._sepStamp || 0) + 1);
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.active && e._pool_active) {
        e._sepAt = stamp;
        list[n++] = e;
      }
    }
    list.length = n;
    for (const e of this.enemyPool.inUse) {
      if (e.active && e._sepAt !== stamp) {
        e._sepAt = stamp;
        list.push(e);
      }
    }
    n = list.length;
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      // ordena por x (inserção)
      let j = i - 1;
      const x = e.x;
      while (j >= 0 && list[j].x > x) {
        list[j + 1] = list[j];
        j--;
      }
      list[j + 1] = e;
      e._sepR = e.displayWidth * 0.32;
      e._sepF = e.isFrozen(now);
      if (e._sepR > maxR) maxR = e._sepR;
    }
    for (let i = 0; i < n; i++) {
      const a = list[i];
      const ra = a._sepR;
      const reach = ra + maxR;
      const aF = a._sepF;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        const dx = b.x - a.x;
        if (dx >= reach) break; // os seguintes estão ainda mais à direita
        const dy = b.y - a.y;
        const minD = ra + b._sepR;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const overlap = minD - d;
        const ux = dx / d,
          uy = dy / d;
        const bF = b._sepF;
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

  // CHEGADA DO CHEFE (FEEL.BOSS_ENTRY): 1) a Podridão borbulha no chão num ponto À VISTA, perto do herói
  // (a música da partida afunda, o chão ronca, esporos sobem) — o jogador lê de onde ele vem; 2) o chefe
  // SOBE da poça como silhueta da Podridão que ganha cor, com rugido, estouro e tremor, e a barra dele
  // enche; 3) só então luta. Enquanto nasce: sem dano dele, sem dano nele, cérebro parado.
  _spawnBoss() {
    this.meta.markLegend(this.biome.boss);
    const E = FEEL.BOSS_ENTRY;
    const { x: bx, y: by } = this._bossSpot();
    this.boss = new BossEnt(this, bx, by, this.biome.boss);
    this.boss.setActive(false).setVisible(false);
    this.boss.body.enable = false;
    this.boss._emerging = true; // a Podridão da borda e a luz do chefe já fecham (Podridao.js, Lighting.js)
    // Trilha do chefe no lugar da música da partida, no compasso: a da partida afunda já (o chão ronca
    // sozinho) e some até a barra; a do chefe entra num tempo forte depois do rugido (AUDIO.SWITCH)
    this.bgMusic = switchTrack(this.sound, this.bgMusic, this.biome.bossMusic ?? "music_boss", { loop: true, volume: 0.4 }, { enterAfterS: E.ERUPT_MS / 1000 + AUDIO.SWITCH.ROAR_S });
    this._bossEruption(bx, by + this.boss.displayHeight * 0.44); // a poça fica sob os PÉS dele
    this.time.delayedCall(E.ERUPT_MS, () => this._bossRise());
    // O chefe espanta os de tiro (tiro + avisos dos golpes deixaria de ser justo), os do
    // lugar onde ele chega e o excesso; os mais perto do herói ficam (ver BOSS_FIGHT.ADDS)
    const A = BOSS_FIGHT.ADDS;
    // minichefe também sai: dois chefes de uma vez não é justo
    this._scatter((e) => e.miniBoss || A.RANGED.includes(e._kind) || Phaser.Math.Distance.Between(e.x, e.y, bx, by) <= A.CLEAR_R);
    const rest = [];
    this.enemyPool.forEachActive((e) => rest.push(e));
    const d2 = (e) => (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2;
    const keep = new Set(rest.sort((a, b) => d2(a) - d2(b)).slice(0, A.MAX_ALIVE));
    this._scatter((e) => !keep.has(e));
  }

  // Onde o chefe nasce: a MIN_DIST–MAX_DIST do herói, dentro da tela (abaixo da faixa da HUD e da barra
  // dele, longe das bordas) e dentro da arena. Antes: 320 px num ângulo qualquer, muitas vezes fora da tela
  _bossSpot() {
    const E = FEEL.BOSS_ENTRY;
    const cam = this.cameras.main,
      wv = cam.worldView,
      p = this.player;
    const z = cam.zoom || 1;
    const top = wv.y + 250 / z, // faixa da HUD + barra do chefe + a cabeça dele (o ponto é o pé)
      bot = wv.bottom - 70 / z,
      left = wv.x + 130 / z,
      right = wv.right - 130 / z;
    const inside = (x, y) => x > left && x < right && y > top && y < bot && x > ARENA.minX + 120 && x < ARENA.maxX - 120 && y > ARENA.minY + 160 && y < ARENA.maxY - 90;
    // nenhuma copa de árvore por cima do lugar (a chegada tem de ser vista inteira)
    const trees = this.world.trees ?? [];
    const clearOfTrees = (x, y) => {
      for (const t of trees) {
        const tl = t.x - t.displayWidth * t.originX,
          tt = t.y - t.displayHeight * t.originY;
        if (tl < x + 90 && tl + t.displayWidth > x - 90 && tt < y + 95 && tt + t.displayHeight > y - 95) return false;
      }
      return true;
    };
    const a0 = Math.random() * Math.PI * 2;
    let fallback = null;
    for (let i = 0; i < 32; i++) {
      const a = a0 + i * 2.4;
      const d = E.MIN_DIST + ((i * 37) % 10) * ((E.MAX_DIST - E.MIN_DIST) / 9);
      const x = p.x + Math.cos(a) * d,
        y = p.y + Math.sin(a) * d * 0.62; // a tela é mais larga que alta
      if (!inside(x, y)) continue;
      if (clearOfTrees(x, y)) return { x, y };
      fallback ??= { x, y };
    }
    if (fallback) return fallback;
    // sem espaço (herói num canto): o mais perto disso que couber
    return { x: Phaser.Math.Clamp(p.x + E.MIN_DIST, Math.max(left, ARENA.minX + 120), Math.min(right, ARENA.maxX - 120)), y: Phaser.Math.Clamp(p.y, Math.max(top, ARENA.minY + 160), Math.min(bot, ARENA.maxY - 90)) };
  }

  // 1) A Podridão borbulha no chão onde o chefe vai nascer: poça que cresce, bolhas e esporos subindo, o chão
  // ronca e a luz dela pulsa. Nada disso fere: é aviso de lugar, não golpe. (x, y) = onde ficam os pés dele
  _bossEruption(x, y) {
    const E = FEEL.BOSS_ENTRY;
    if (!this.textures.exists("fx_rot_pool")) {
      // poça da Podridão em pixel de arte (desenhada na escala 3): miolo escuro, borda acesa e pontilhada
      const W = 44,
        H = 24,
        rnd = rng(77);
      const pool = new Pix(W, H);
      for (let yy = 0; yy < H; yy++)
        for (let xx = 0; xx < W; xx++) {
          const u = (xx + 0.5 - W / 2) / (W / 2),
            v = (yy + 0.5 - H / 2) / (H / 2);
          const d = Math.sqrt(u * u + v * v) + (rnd() - 0.5) * 0.16;
          if (d > 1) continue;
          if (d > 0.84) pool.set(xx, yy, bayer(xx, yy) < 0.6 ? PAL.rot2 : PAL.rot1);
          else if (d > 0.62) pool.set(xx, yy, bayer(xx, yy) < (d - 0.62) * 3.2 ? PAL.rot1 : PAL.rot0);
          else pool.set(xx, yy, PAL.rot0);
        }
      for (let i = 0; i < 10; i++) pool.over(5 + rnd() * (W - 10), 3 + rnd() * (H - 6), i % 3 ? PAL.rot2 : PAL.rot3);
      pool.register(this, "fx_rot_pool");
    }
    const S = GAME.PIXEL_SCALE;
    const k = (E.POOL_R * 2) / (44 * S); // largura final da poça = 2 × POOL_R
    const img = this.add.image(x, y, "fx_rot_pool").setDepth(-48).setScale(S * k * 0.12).setAlpha(0.95);
    this.tweens.add({ targets: img, scale: S * k, duration: E.ERUPT_MS * 0.8, ease: "Cubic.easeOut" });
    // a poça fica até o chefe subir e então se fecha (encolhe e some)
    this.tweens.add({ targets: img, scale: S * k * 0.3, alpha: 0, delay: E.ERUPT_MS + E.RISE_MS, duration: 700, ease: "Cubic.easeIn", onComplete: () => img.destroy() });
    // esporos subindo da poça (um emissor só, destruído depois)
    const zone = new Phaser.Geom.Ellipse(0, 0, E.POOL_R * 1.4, E.POOL_R * 0.7);
    const spores = this.add
      .particles(x, y - 4, "px_dot2", {
        emitZone: { type: "random", source: zone },
        frequency: 45,
        lifespan: { min: 600, max: 1000 },
        speed: { min: 6, max: 26 },
        gravityY: -60,
        scale: { start: 3.6, end: 1 },
        alpha: { start: 0.9, end: 0 },
        color: [PAL.rot3, PAL.rot2, PAL.rot1],
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: 40,
      })
      .setDepth(D_FX + 1);
    this.time.delayedCall(E.ERUPT_MS + E.RISE_MS * 0.6, () => spores.stop());
    this.time.delayedCall(E.ERUPT_MS + E.RISE_MS + 1100, () => spores.destroy());
    // bolhas estourando na poça, cada vez mais (imagens reaproveitadas)
    for (let i = 0; i < 14; i++) {
      const at = E.ERUPT_MS * (0.15 + 0.85 * Math.sqrt(i / 14));
      this.time.delayedCall(at, () => {
        if (this.gameOver || this.puffs.count.bubble > 10) return;
        const bx = x + (Math.random() - 0.5) * E.POOL_R * 1.1,
          by = y + (Math.random() - 0.5) * E.POOL_R * 0.45;
        this.puffs.spawn("bubble", "px_dot2", bx, by, bx, by - 14, 3.6, 1.2, 1, i % 3 ? PAL.rot2 : PAL.rot3, -47, 380);
      });
    }
    // o chão ronca (cresce) e a luz da Podridão pulsa sobre a poça
    this.sound.play("sfx_rumble", { volume: 0.7, alert: true });
    this.cameras.main.shake(E.ERUPT_MS, 0.0018);
    this.time.delayedCall(E.ERUPT_MS * 0.55, () => this.cameras.main.shake(E.ERUPT_MS * 0.45, 0.0035));
    this.lighting?.flash(x, y - 30, 260, PAL.rot2, E.ERUPT_MS * 0.6, 0.9);
    this.time.delayedCall(E.ERUPT_MS * 0.5, () => this.lighting?.flash(x, y - 30, 300, PAL.rot3, E.ERUPT_MS * 0.6, 1));
  }

  // 2) O chefe SOBE da poça: nasce como silhueta acesa da Podridão (tinta SCREEN), cresce do chão para
  // cima com um passo além do tamanho e assenta, enquanto a cor dele aparece; estouro, rugido, tremor e
  // a barra dele enchendo. 3) No fim: corpo, dano e cérebro ligados (o primeiro encostão só depois do fôlego)
  _bossRise() {
    const b = this.boss;
    if (!b || this.gameOver || !b._emerging) return;
    const E = FEEL.BOSS_ENTRY;
    b.activate(BOSS.HP * this.diff.hpMult);
    b.dmg *= this.diff.dmgMult; // escala dano do boss pela dificuldade
    // visível, mas fora do jogo enquanto sobe: nada mira nele, ele não encosta, o cérebro não anda
    b.setActive(false);
    b.body.enable = false;
    b._emerging = true;
    b._displayFill = 0;
    this.hud.setBossActive(b, this.biome.bossName.toUpperCase());
    this.tweens.add({ targets: b, _displayFill: 1, duration: E.RISE_MS, ease: "Sine.easeInOut" });
    const S = b._bossScale;
    const feet = b.y + b.displayHeight / 2;
    const shadowS = b.shadow.scaleX;
    b.setOrigin(0.5, 1).setY(feet).setScale(S * 0.82, S * 0.08);
    b.setTint(PAL.rot3).setTintMode(Phaser.TintModes.SCREEN);
    b.shadow.setScale(shadowS * 0.5).setPosition(b.x, feet - 6);
    this.tweens.add({ targets: b.shadow, scaleX: shadowS, scaleY: shadowS, duration: E.RISE_MS, ease: "Cubic.easeOut" });
    // no fim da subida (no relógio dos tweens: um hit-stop no meio segura os dois juntos)
    const done = () => {
      if (this.boss !== b || !b._emerging || this.gameOver) return;
      b.setScale(S).setOrigin(0.5, 0.5).setY(feet - b.displayHeight / 2);
      b._emerging = false;
      b._displayFill = 1;
      b.setActive(true);
      b.body.enable = true;
      b.body.reset(b.x, b.y);
      b.lastTouchAt = this.time.now; // fôlego: o 1º encostão só depois de contactCooldownMs
    };
    this.tweens.add({ targets: b, scaleX: S, scaleY: S, duration: E.RISE_MS, ease: "Back.easeOut", onComplete: done });
    // acende no pico (o quadro do estalo) e apaga depressa até o roxo escuro; a cor natural chega devagar
    const ramp = [PAL.rot3, PAL.rot2, PAL.rot1, PAL.rot0, 0x000000];
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: E.RISE_MS + 160,
      ease: "Cubic.easeOut",
      onUpdate: (tw) => this.boss === b && b.visible && b.setTint(rampColor(ramp, tw.getValue())),
      onComplete: () => this.boss === b && b.visible && this.elemental?._updateTint(b),
    });
    // estouro da terra: anel de choque, poeira, esporos, luz
    shockwave(this, b.x, feet - 6, 230, PAL.rot2);
    this.fx?.burst("smoke", b.x, feet - 10, 10, -Math.PI / 2, 140, { min: 40, max: 140 });
    this.fx?.burst("leaf", b.x, feet - 20, 8, -Math.PI / 2, 160, { min: 80, max: 220 });
    this.fx?.burst("spark", b.x, feet - 30, 14, -Math.PI / 2, 120, { min: 120, max: 300 }, [PAL.rot3, PAL.rot2, PAL.white]);
    this.lighting?.flash(b.x, feet - 60, 420, PAL.rot3, 700, 1.3);
    this.sound.play("sfx_erupt", { volume: 0.7, alert: true });
    this.sound.play("sfx_boss_roar", { volume: 0.8, alert: true });
    this.cameras.main.shake(500, 0.015);
    haptic(70);
  }

  // Inimigos que a Podridão larga: somem numa fumacinha (sem abate, sem gema)
  _scatter(filter = () => true) {
    this.enemyPool.forEachActive((e) => {
      if (!filter(e)) return;
      const puff = this.add.image(e.x, e.y, "px_puff").setScale(3).setTint(0x8a3fa0).setDepth(e.y + 1);
      this.tweens.add({ targets: puff, y: e.y - 30, alpha: 0, scale: 1, duration: 500, onComplete: () => puff.destroy() });
      e.deactivate();
      this.enemyPool.release(e);
    });
  }

  _onBossDeath() {
    if (!this.boss) return;
    const bx = this.boss.x,
      by = this.boss.y,
      bs = this.boss.scaleX;
    const log = this.boss.brain?.log;
    if (log?.flawless) {
      this.meta.recordStat("flawless");
      // o chefe não deixa madeira no chão: entra direto
      this._woodThisRun += BOSS_FIGHT.FLAWLESS_WOOD.BOSS;
      this.hud.addWood(BOSS_FIGHT.FLAWLESS_WOOD.BOSS);
      this.time.delayedCall(1200, () => {
        this._toast(tr("DESVIOU DE TUDO! +{0} Madeira Ancestral", BOSS_FIGHT.FLAWLESS_WOOD.BOSS), 2600, "#c8f08c");
        this.sound.play("sfx_levelup", { volume: 0.5, rate: 1.25 });
      });
      Analytics.track("boss_flawless", { specials: log.specials, dodges: log.dodges, boss: 1 });
    }
    this.boss.deactivate?.();
    this.boss.setActive(false).setVisible(false);
    this.hud.clearBoss();
    this._scatter(); // liberto o chefe, a horda que ele trazia se desfaz
    this._freeBoss(bx, by, bs, this.boss.flipX);
    // Recompensa
    this._coinsGainedThisRun += META.COIN_BOSS_WIN;
    this.hud.addCoin(META.COIN_BOSS_WIN);
    // Madeira do Mapinguari entra direto (a escolha da Noite Eterna vem em seguida)
    this._woodThisRun += WOOD.BOSS;
    this.hud.addWood(WOOD.BOSS);
    this._toast(tr("+{0} Madeira Ancestral", WOOD.BOSS), 2200, "#ffc86b");
    // Sementes do Mapinguari também entram direto
    if (this._seedsOn)
      for (let i = 0; i < GARDEN.SEEDS.BOSS; i++) {
        const id = randomRareSeed(this.biomeId);
        this._seedsThisRun[id] = (this._seedsThisRun[id] || 0) + 1;
      }
    this.cameras.main.shake(600, 0.02);
    // Vitória: escolher entre encerrar ou seguir na Noite Eterna
    // Depois da cena de libertação (LIBERATION, ~2,6 s), a escolha da Noite Eterna
    this.time.delayedCall(LIBERATION.GRIP_MS + LIBERATION.HEAT_MS + LIBERATION.REVEAL_MS + LIBERATION.STAY_MS + LIBERATION.LEAVE_MS, () => this._offerEndless());
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

  // Vencer = LIBERTAR, o clímax de toda vitória: a lenda é guardiã, o vilão é a Podridão. Três tempos
  // (LIBERATION no config):
  //  1) a Podridão toma o corpo inteiro — silhueta chapada (FILL) que esquenta da cor dela até virar luz, e os
  //     primeiros esporos escapam;
  //  2) estalo: a luz se apaga (SCREEN branco → verde-vida → preto = a cor natural) e revela a lenda livre,
  //     enquanto a Podridão sai do corpo numa revoada de esporos que nascem NO corpo (emitZone nos pixels do
  //     quadro), são empurrados para fora (GravityWell negativo) e esfriam de magenta a quente a verde;
  //  3) a lenda respira um instante e volta para a mata. Quadro 4 = libertado.
  // Dois emissores e cinco tweens (antes: 40 imagens com 40 tweens).
  _freeBoss(x, y, scale, flip = false) {
    const L = LIBERATION;
    const TM = Phaser.TintModes;
    const tex = BOSS_TEX[this.biome.boss] ?? "mon_boss";
    const m = this.add.sprite(x, y, tex, 4).setScale(scale).setFlipX(flip).setDepth(y + 10000);
    m.setTint(PAL.rot1).setTintMode(TM.FILL);
    const heatAt = L.GRIP_MS,
      revealAt = heatAt + L.HEAT_MS,
      leaveAt = revealAt + L.REVEAL_MS + L.STAY_MS;
    const spores = this._liberationSpores(m, tex, scale, flip);

    // 1) a Podridão aperta (inspira) e esquenta até virar luz
    this.tweens.add({ targets: m, scaleX: scale * 1.06, scaleY: scale * 0.97, duration: revealAt, ease: "Sine.easeIn" });
    const heat = [PAL.rot1, PAL.rot2, PAL.rot3, PAL.org3, PAL.white];
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: heatAt,
      duration: L.HEAT_MS,
      ease: "Quad.easeIn",
      onUpdate: (tw) => m.setTint(rampColor(heat, tw.getValue())),
    });
    spores.seep.flow(L.SEEP_MS, 1);
    this.lighting?.flash(x, y - m.displayHeight * 0.2, 300, PAL.rot2, revealAt, 0.8);

    // 2) estalo: SCREEN branco é a mesma silhueta branca do FILL; daí apaga até o preto (= sem tinta)
    this.time.delayedCall(revealAt, () => {
      if (!m.active) return;
      m.setTint(PAL.white).setTintMode(TM.SCREEN);
      this.tweens.add({ targets: m, scaleX: scale, scaleY: scale, duration: 420, ease: "Back.easeOut" });
      const fade = [PAL.white, PAL.g6, PAL.g4, 0x000000];
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: L.REVEAL_MS,
        ease: "Cubic.easeOut",
        onUpdate: (tw) => m.setTint(rampColor(fade, tw.getValue())),
        onComplete: () => m.clearTint(),
      });
      spores.seep.stop();
      // jorro: a maior parte de uma vez, o resto escorrendo por um quarto de segundo
      spores.burst.explode(Math.round(L.BURST * 0.6));
      spores.burst.flow(25, 3, Math.round(L.BURST * 0.4));
      this.fx?.ring(x, y - m.displayHeight * 0.15, PAL.g6, m.displayWidth * 0.25, m.displayWidth * 0.95, 520, 0.62, 0.9);
      this.lighting?.flash(x, y - 60, 440, PAL.g6, L.REVEAL_MS + L.STAY_MS, 1.2);
      this._toast(tr("O {0} ESTÁ LIVRE!", this.biome.bossName.toUpperCase()), 2600, "#9ccf62");
    });

    // 3) a lenda volta para a mata (o Caboclo volta para o rio: afunda numa poça)
    this.time.delayedCall(leaveAt, () => {
      if (this.biome.boss === "caboclo")
        for (let i = 0; i < 18; i++) {
          const d = this.add.image(x + (Math.random() - 0.5) * 80, y + 50, "px_dot2").setScale(3).setTint(i % 2 ? 0x86d0d4 : 0x4aa2b0).setDepth(y + 10100);
          this.tweens.add({ targets: d, y: d.y - 30 - Math.random() * 40, alpha: 0, delay: Math.random() * 300, duration: 600, onComplete: () => d.destroy() });
        }
    });
    this.tweens.add({ targets: m, alpha: 0, y: y - 30, delay: leaveAt, duration: L.LEAVE_MS, ease: "Sine.easeIn", onComplete: () => m.destroy() });
    this.time.delayedCall(leaveAt + L.LIFE[1] + 200, () => {
      spores.seep.destroy();
      spores.burst.destroy();
    });
  }

  // Esporos da Podridão saindo do corpo: nascem nos pixels do quadro (não num círculo), sobem, são empurrados
  // para fora e esfriam da cor da Podridão a quente a verde-vida. Acima do mapa de luz: brilham na noite do chefe
  _liberationSpores(m, tex, scale, flip) {
    const L = LIBERATION;
    const fr = this.textures.getFrame(tex, 4);
    const pts = [];
    try {
      const data = fr.source.image.getContext("2d").getImageData(fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight).data;
      for (let py = 0; py < fr.cutHeight; py++)
        for (let px = 0; px < fr.cutWidth; px++)
          if (data[(py * fr.cutWidth + px) * 4 + 3] > 128) pts.push(((flip ? fr.cutWidth - 1 - px : px) + 0.5 - fr.cutWidth / 2) * scale, (py + 0.5 - fr.cutHeight / 2) * scale);
    } catch {}
    if (!pts.length) pts.push(0, 0);
    const n = pts.length / 2;
    const body = {
      getRandomPoint: (p) => {
        const i = Math.floor(Math.random() * n) * 2;
        p.x = pts[i];
        p.y = pts[i + 1];
        return p;
      },
    };
    const common = {
      emitting: false,
      emitZone: { type: "random", source: body },
      blendMode: Phaser.BlendModes.ADD,
      gravityY: -38, // esporo é leve: sobe
    };
    // Escapando: poucos, ainda da cor da Podridão
    const seep = this.add
      .particles(m.x, m.y, "px_dot2", {
        ...common,
        lifespan: { min: 600, max: 950 },
        speed: { min: 8, max: 30 },
        scale: { start: 4.5, end: 1.5 },
        alpha: { start: 0.9, end: 0 },
        color: [PAL.rot3, PAL.rot2, PAL.rot1],
      })
      .setDepth(D_FX + 1);
    // A revoada do estalo: Podridão → quente → vida
    const burst = this.add
      .particles(m.x, m.y, "px_dot2", {
        ...common,
        lifespan: { min: L.LIFE[0], max: L.LIFE[1] },
        speed: { min: 10, max: 48 },
        scale: { start: 6, end: 1.5, ease: "Quad.easeIn" },
        alpha: { start: 1, end: 0, ease: "Cubic.easeIn" },
        // a Podridão queima rápido (1/5 da vida), esquenta e passa a maior parte do voo já verde-vida
        color: [PAL.rot3, PAL.org2, PAL.yel3, PAL.g6, PAL.g6, PAL.g5],
        maxAliveParticles: L.BURST,
      })
      .setDepth(D_FX + 1);
    // Força da vida no peito do chefe: empurra para fora (negativo) — os de perto saem mais rápido
    const chest = { x: 0, y: -fr.cutHeight * scale * 0.12, power: -L.PUSH, epsilon: 60, gravity: 50 };
    seep.createGravityWell(chest);
    burst.createGravityWell(chest);
    return { seep, burst };
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
    // a trilha do chefe some até a barra e a da noite (mais lenta) entra no tempo forte
    this.bgMusic = switchTrack(this.sound, this.bgMusic, "music_gameplay", { loop: true, volume: 0.35, rate: 0.92 });
    this.hud.showBossBanner(tr("A NOITE ETERNA COMEÇA"), "#e8ccff");
    this.cameras.main.flash(400, 60, 30, 90);
    Analytics.track("endless_start", { level: this.player.level, t: Math.floor(this.elapsedMs / 1000) });
  }

  _randomChestPos() {
    // Sempre dentro da área jogável (nunca escondido na muralha de árvores)
    // Num mapa grande, baú aleatório "no mapa todo" quase nunca seria achado: nasce num anel
    // ao redor do jogador (alcançável em ~3-6 s de caminhada).
    const m = 80;
    const px = this.player?.x ?? 0,
      py = this.player?.y ?? 0;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 350 + Math.random() * 650;
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      if (x < ARENA.minX + m || x > ARENA.maxX - m || y < ARENA.minY + m || y > ARENA.maxY - m) continue;
      return { x, y };
    }
    return { x: 0, y: 300 };
  }

  _openChest(chest) {
    const result = chest.open();
    if (!result) return;
    this._runChests++;
    this.meta.recordStat("chests"); // feitos: Bola de Ouro / Mãe-do-Ouro
    const { kind, x, y } = result;
    Analytics.track("chest_open", { kind, t: Math.floor(this.elapsedMs / 1000), level: this.player.level });

    // Som de abertura imediato
    this.sound.play("sfx_chest_open", { volume: 0.7 });

    // CAÇA-NÍQUEL: "reels" — 3 ticks de ficha ascendentes (suspense). O baú chacoalha junto, cada vez mais
    // forte (FEEL.CHEST) — o mímico não: ele já está mordendo
    const reelRates = [1.0, 1.15, 1.3];
    const C = FEEL.CHEST;
    reelRates.forEach((rate, i) => {
      this.time.delayedCall(150 + i * 130, () => {
        this.sound.play("sfx_chest_reel", { volume: 0.7, rate });
        if (kind === "mimic" || !chest.sprite?.active) return;
        const d = C.RATTLE_DEG[0] + ((C.RATTLE_DEG[1] - C.RATTLE_DEG[0]) * i) / (reelRates.length - 1);
        this.tweens.add({ targets: chest.sprite, angle: { from: -d, to: d }, duration: 32, yoyo: true, repeat: 1, onComplete: () => chest.sprite.setAngle(0) });
        this.tweens.add({ targets: chest.sprite, y: { from: 0, to: -2 - i * 2 }, duration: 60, yoyo: true, ease: "Quad.easeOut" });
      });
    });

    // Burst de partículas + reveal SFX (+ feixe de luz subindo do baú aberto)
    const burstDelay = 150 + reelRates.length * 130;
    this.time.delayedCall(burstDelay, () => {
      this._chestBurst(x, y, kind);
      if (kind !== "mimic") this._chestBeam(x, y, kind);
    });

    // Loot spawnado DEPOIS dos reels (caça-níquel revela)
    this.time.delayedCall(burstDelay + 50, () => {
      this._spawnChestLoot(x, y);
      if (kind === "golden") {
        this._spawnWood(x, y, WOOD.GOLDEN_CHEST);
        this._spawnSeeds(x, y, GARDEN.SEEDS.GOLDEN_CHEST);
      }
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
      this._toast(tr("BAÚ DOURADO!"), 2200, "#ffe58f");
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
      this._toast(tr("ARMADILHA!"), 1500, "#ff8a8a");
      const wave = this.waveIndex();
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
      this._toast(tr("MÍMICO!"), 1800, "#ff8a8a");
      const wave = this.waveIndex();
      const types = ["goblin", "wolf"];
      this.time.delayedCall(burstDelay + 200, () => {
        // o baú VIRA o mímico: some no instante em que o inimigo nasce no lugar dele
        this.tweens.add({
          targets: chest, alpha: 0, scaleX: 1.3, scaleY: 0.6, duration: 140,
          onComplete: () => {
            const i = this.chests.indexOf(chest);
            if (i >= 0) this.chests.splice(i, 1);
            chest.destroy();
          },
        });
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
      this._dmgSrc = "revive";
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
    this._toast(tr("DE VOLTA À LUTA!"), 2200, "#ffe58f");
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

  // Feixe de luz que sobe do baú aberto na revelação (dourado; vermelho na armadilha) e se apaga
  _chestBeam(x, y, kind) {
    const C = FEEL.CHEST;
    const col = kind === "trap" ? PAL.red3 : PAL.yel3;
    const big = kind === "golden" ? 1.35 : 1;
    const beam = this.add
      .image(x, y + 6, "fx_glow")
      .setOrigin(0.5, 0.92)
      .setTint(col)
      .setDepth(y + 10400)
      .setScale(0.55 * big, 0.4)
      .setAlpha(0.7); // sem blend aditivo: na grama o dourado viraria lima
    this.tweens.add({ targets: beam, scaleY: 4.2 * big, duration: 200, ease: "Cubic.easeOut" });
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.2 * big, delay: 160, duration: C.BEAM_MS, ease: "Quad.easeIn", onComplete: () => beam.destroy() });
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
    // A cena pausa já neste quadro: a vida da HUD tem que mostrar o golpe fatal (0)
    if (!won && !quit) this.hud?.syncHp(true);
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
      won = true; // cair na Noite Eterna não apaga a vitória sobre o Mapinguari
      const bonus = Math.floor(endlessS / 60) * ENDLESS.COINS_PER_MIN;
      this._coinsGainedThisRun += bonus;
      endlessRecord = this.meta.registerEndless(endlessS);
      Analytics.track("endless_end", { s: Math.floor(endlessS), bonus, record: endlessRecord });
    }
    // Recompensa final escalada pela dificuldade (HUD mostrou a contagem-base ao vivo)
    const runCoinsBase = Math.round(this._coinsGainedThisRun * this.diff.rewardMult);
    // Bônus de descanso (primeiras partidas do dia, depois que o Mural apareceu).
    // Recuo nos 2 primeiros minutos não gasta o bônus.
    const restedMult =
      runCoinsBase > 0 && dailyUnlocked(this.meta.data) && (!quit || this.elapsedMs >= 120000) ? new Daily(this.meta).takeRested() : 1;
    const runCoins = Math.round(runCoinsBase * restedMult);
    // 1ª vitória neste Perigo: prêmio único (antes de registerRun contar a vitória)
    const firstClear = won && !((this.meta.data.winsByDifficulty || {})[String(this.diff.id)] > 0) ? this.diff.firstClear || 0 : 0;
    const coinsFinal = runCoins + firstClear;
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
    const seeds = (this.meta.data.seeds ||= {});
    let seedsGained = 0;
    for (const [id, n] of Object.entries(this._seedsThisRun)) {
      seeds[id] = (seeds[id] || 0) + n;
      seedsGained += n;
    }
    // Cada partida adianta a obra do João-de-barro (jogar acelera as obras)
    const builds = new Builds(this.meta);
    if (builds.job) {
      const min = BUILD.RUN_SPEEDUP_MIN + Math.floor(this.elapsedMs / 60000) * BUILD.RUN_SPEEDUP_PER_MIN;
      builds.advance(min * 60000);
      this.meta.data.lastRunBuildAdvanceMin = min;
      this.meta._save();
    }
    // 1ª vitória sobre o chefe deste bioma (antes de registerRun contar)
    const firstBiomeWin = won && !(this.meta.biomeWins()[this.biomeId] > 0);
    this.meta.registerRun(this.elapsedMs / 1000, won, this.diff.id, this.biomeId);
    // Rankings (Play Games): pontos desta partida e o recorde; o envio segue sozinho (ou espera na fila)
    const rank = Leaderboards.submitRun({ kills: this.hud.kills, won, difficulty: this.diff.id, mode: "solo" });
    if (firstBiomeWin) {
      const next = Object.values(BIOMES).find((b) => b.unlock?.won === this.biomeId);
      if (next) this._newUnlocksThisRun.push(tr("Nova trilha na Clareira: {0}", next.name));
    }
    for (const k of this._deedsOpen || []) if (this.meta.deedDone(k)) this._newUnlocksThisRun.push(tr("Feito cumprido: {0} na Forja", WEAPONS[k].name));
    for (const c of this._charDeedsOpen || []) if (this.meta.characterDeed(c.id)?.done) this._newUnlocksThisRun.push(tr("Feito cumprido: {0} na Fogueira", c.name));
    const newAchievements = this._checkAchievements(won, true);
    this._newUnlocksThisRun.push(...newAchievements.map((a) => a.name));
    // Reações DESTA partida, por tipo (missões do dia e medição de balanceamento)
    const nowReactions = this.meta.data.stats.reactions || {};
    const byType = {};
    let reactions = 0;
    for (const k of Object.keys(nowReactions)) {
      byType[k] = (nowReactions[k] || 0) - (this._reactionsAtStart[k] || 0);
      reactions += byType[k];
    }
    // Missões do dia (o prêmio se pega no Mural da Clareira)
    if (dailyUnlocked(this.meta.data)) {
      const done = new Daily(this.meta).runEnd({ kills: this.hud.kills, reactions, byType, seconds: this.elapsedMs / 1000, chests: this._runChests, lanterns: this._runLanterns, won });
      this._newUnlocksThisRun.push(...done.map((t) => tr("Missão: {0}", t)));
    }
    Analytics.track("run_end", {
      run_n: this._runN,
      won,
      quit,
      t: Math.floor(this.elapsedMs / 1000),
      level: this.player.level,
      kills: this.hud.kills,
      coins: coinsFinal,
      rested: restedMult > 1,
      first_clear: firstClear,
      wood: this._woodThisRun,
      difficulty: this.diff.id,
      character: this.character.id,
      ...this._buildSummary(),
      biome: this.biomeId,
      power: this._runPower,
      meal: this._runMeal,
      reactions,
      chests: this._runChests,
      lanterns: this._runLanterns,
      dmg_total: Math.round(this._dmgTotal()),
    });
    this._trackBuild(won, quit, byType);
    // Morte: o golpe fatal congela um instante (herói em branco, a HUD sai: FEEL.DEATH) e então vem a
    // câmera lenta dramática antes do fade
    if (!won && !quit) {
      tapeStop(this.bgMusic); // a música desacelera junto, como uma fita parando (AUDIO.DEATH)
      this.feel.fatal(() => {
        this.physics.world.timeScale = 3;
        this.tweens.timeScale = 0.35;
        this.fx?.setTimeScale(0.35);
        this.cameras.main.zoomTo(this.cameras.main.zoom * 1.25, 700);
      });
    }
    this.cameras.main.fade(quit ? 250 : 800, 0, 0, 0);
    this.time.delayedCall(quit ? 300 : 900, () => {
      this.physics.world.timeScale = 1;
      this.tweens.timeScale = 1;
      this.bgMusic?.destroy(); // só parar deixava a voz (e os nós de áudio) no gerenciador a cada partida
      this.bgMusic = null;
      const results = {
        won,
        quit,
        level: this.player.level,
        weapons: this.player.weapons.map((w) => ({ key: w.key, level: w.level })),
        elapsedMs: this.elapsedMs,
        kills: this.hud.kills,
        coinsGained: coinsFinal,
        score: rank.score,
        scoreRecord: rank.record,
        coinsDoubleable: runCoins, // o anúncio dobra a partida, não o prêmio da 1ª vitória
        coinsRun: this._coinsGainedThisRun, // moedas da floresta, antes dos multiplicadores (a conta na tela)
        restedMult,
        firstClear,
        woodGained: this._woodThisRun,
        seedsGained,
        newUnlocks: this._newUnlocksThisRun,
        difficulty: this.diff,
        biome: this.biome,
        biomeId: this.biomeId,
        character: this.character.id, // a tela de resultado mostra o guardião da partida
        reactions,
        dmgShare: this._dmgShare(),
        endlessS,
        endlessRecord,
        unlockedNextDifficulty: unlockedNewDifficulty
          ? DIFFICULTY[this.diff.id + 1].name
          : null,
      };
      // Primeira queda (ou primeira vitória): cena da Anciã antes dos resultados
      if (!quit && !this.meta.data.firstDefeatSeen) {
        this.scene.start("FirstDefeatScene", { won, character: this.character.id, next: results });
      } else if (!quit && !won) {
        // 2ª morte em diante: só a queda do herói (curta) antes dos resultados
        this.scene.start("FirstDefeatScene", { won: false, short: true, character: this.character.id, next: results });
      } else {
        this.scene.start("GameOverScene", results);
      }
    });
  }

  shutdown() {
    this.bgMusic?.destroy();
    this.bgMusic = null;
    resetMix(); // a próxima cena começa com o som limpo (sem abafar, sem trilha saindo)
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this._postUpdate, this);
  }

  _postUpdate(time, dt) {
    for (const pool of this._pickupPools) {
      for (const p of pool.inUse) if (p.active) p.move(dt);
    }
    for (const p of this.projectilePool.inUse) p.syncHalo();
    for (const p of this.boomerPool.inUse) p.syncHalo();
    for (const p of this.enemyProjPool.inUse) p.syncHalo();
  }
}
