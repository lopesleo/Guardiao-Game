// Preload: carrega todos os assets com barra de progresso.
import { COLORS, GAME } from "../config.js";
import { registerEnvironment } from "../art/Environment.js";
import { registerIcons } from "../art/Icons.js";
import { registerSprites } from "../art/Sprites.js";
import { text, Bar, PAL, vw, vh } from "../ui/Theme.js";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    this._drawBar();

    // ---- Sprites ----
    this.load.spritesheet(
      "dungeon_tiles",
      "assets/sprites/dungeon_packed.png",
      { frameWidth: 16, frameHeight: 16 },
    );
    this.load.spritesheet("town_tiles", "assets/sprites/town_packed.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet(
      "creatures",
      "assets/sprites/enemies/creatures_packed.png",
      { frameWidth: 16, frameHeight: 16 },
    );
    // Bola de fogo do Cajado — 2 frames (arte de Revon, CC-BY 4.0)
    this.load.spritesheet("fireball", "assets/sprites/fx/fireball.png", {
      frameWidth: 32, // Metade da largura total da imagem
      frameHeight: 32, // Altura total da imagem
    });

    // ---- Áudio ----
    this.load.audio("music_menu", "assets/audio/music/menu_theme.mp3");
    this.load.audio(
      "music_gameplay",
      "assets/audio/music/ambient_gameplay.ogg",
    );
    this.load.audio("sfx_hit", "assets/audio/sfx/hit_enemy.ogg");
    this.load.audio("sfx_death", "assets/audio/sfx/enemy_death.ogg");
    this.load.audio("sfx_pickup", "assets/audio/sfx/pickup.ogg");
    this.load.audio("sfx_levelup", "assets/audio/sfx/level_up.ogg");
    this.load.audio("sfx_player_hit", "assets/audio/sfx/player_hit.ogg");
    this.load.audio("sfx_boss_roar", "assets/audio/sfx/boss_roar.ogg");
    // Novos (chest + UI + coin)
    this.load.audio("sfx_chest_open", "assets/audio/sfx/chest_open.ogg");
    this.load.audio("sfx_chest_reel", "assets/audio/sfx/chest_reel.ogg");
    this.load.audio("sfx_chest_jackpot", "assets/audio/sfx/chest_jackpot.mp3");
    this.load.audio("sfx_chest_trap", "assets/audio/sfx/chest_trap.mp3");
    this.load.audio("sfx_coin", "assets/audio/sfx/coin.ogg");
    this.load.audio("sfx_coin_cascade", "assets/audio/sfx/coin_cascade.ogg");
    this.load.audio("sfx_ui_click", "assets/audio/sfx/ui_click.ogg");
    this.load.audio("sfx_ui_hover", "assets/audio/sfx/ui_hover.ogg");
    this.load.audio("sfx_dash", "assets/audio/sfx/dash.wav");
    // Elementais: ataques (gelo/raio) + combinações (vapor/cristal/sobrecarga)
    this.load.audio("sfx_fire_attack", "assets/audio/sfx/fire_attack.wav");
    this.load.audio("sfx_ice_attack", "assets/audio/sfx/ice_attack.wav");
    this.load.audio("sfx_bolt_attack", "assets/audio/sfx/bolt_attack.wav");
    this.load.audio("sfx_react_vapor", "assets/audio/sfx/react_vapor.wav");
    this.load.audio("sfx_react_crystal", "assets/audio/sfx/react_crystal.wav");
    this.load.audio(
      "sfx_react_overload",
      "assets/audio/sfx/react_overload.wav",
    );
  }

  create() {
    // Arte procedural (cenário, ícones, pickups, FX) — gerada 1x, fica no cache
    // global de texturas; as chaves do cenário vão pro registry.
    this.registry.set("envKeys", registerEnvironment(this));
    registerIcons(this);
    registerSprites(this);
    this.scene.start("MenuScene");
  }

  _drawBar() {
    const cx = vw(this) / 2,
      cy = vh(this) / 2;
    text(this, cx, cy - 50, "GUARDIÃO DA FLORESTA", { size: 34, color: "#f2c14e", origin: 0.5 });
    const label = text(this, cx, cy + 44, "Despertando a floresta…", { size: 16, color: "#9fb4a4", origin: 0.5 });
    const barW = 420;
    const bar = new Bar(this, cx - barW / 2, cy - 6, barW, 24, PAL.g5, { segments: 10 });
    bar.set(0, true);
    this.load.on("progress", (v) => bar.set(v, true));
    this.load.on("complete", () => label.setText("Pronto!"));
  }
}
