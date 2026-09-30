// Preload: NADA é baixado — arte e áudio são gerados por código (src/art/,
// src/audio/). As etapas rodam uma por frame pra barra de progresso andar em
// vez de a tela congelar enquanto sintetiza as músicas.
import { registerEnvironment } from "../art/Environment.js";
import { registerIcons } from "../art/Icons.js";
import { registerSprites } from "../art/Sprites.js";
import { registerHeroes } from "../art/Hero.js";
import { registerMonsters } from "../art/Monsters.js";
import { registerTelegraphs } from "../art/Telegraph.js";
import { registerLanterns } from "../art/Lanterns.js";
import { registerCamp } from "../art/Camp.js";
import { registerGarden } from "../art/Garden.js";
import { registerKitchen } from "../art/Kitchen.js";
import { registerPond } from "../art/Pond.js";
import { registerAudio } from "../audio/Synth.js";
import { text, Bar, PAL, vw, vh, fitCamera } from "../ui/Theme.js";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create() {
    fitCamera(this);
    const cx = vw(this) / 2,
      cy = vh(this) / 2;
    text(this, cx, cy - 50, "GUARDIÃO DA FLORESTA", { size: 34, color: "#f2c14e", origin: 0.5 });
    const label = text(this, cx, cy + 44, "", { size: 16, color: "#9fb4a4", origin: 0.5 });
    const barW = 420;
    const bar = new Bar(this, cx - barW / 2, cy - 6, barW, 24, PAL.g5, { segments: 10 });
    bar.set(0, true);

    const steps = [
      ["Plantando a floresta…", () => this.registry.set("envKeys", registerEnvironment(this))],
      ["Talhando ícones…", () => registerIcons(this)],
      ["Acendendo vaga-lumes…", () => registerSprites(this)],
      ["Despertando o Guardião…", () => registerHeroes(this)],
      ["Corrompendo criaturas…", () => registerMonsters(this)],
      ["Afiando garras…", () => registerTelegraphs(this)],
      ["Acendendo cogumelos…", () => registerLanterns(this)],
      ["Erguendo o acampamento…", () => registerCamp(this)],
      ["Arando a horta…", () => registerGarden(this)],
      ["Acendendo o fogão…", () => registerKitchen(this)],
      ["Enchendo o lago…", () => registerPond(this)],
      ["Afinando a floresta…", () => registerAudio(this.game)],
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) {
        this.scene.start("TitleScene");
        return;
      }
      const [msg, fn] = steps[i];
      label.setText(msg);
      // 1 frame pra desenhar o texto antes da etapa pesada
      this.time.delayedCall(16, () => {
        fn();
        i++;
        bar.set(i / steps.length, true);
        next();
      });
    };
    next();
  }
}
