// Preload: NADA é baixado — arte e áudio são gerados por código (src/art/,
// src/audio/). As etapas rodam uma por frame pra barra de progresso andar em
// vez de a tela congelar enquanto sintetiza as músicas.
import { registerEnvironment } from "../art/Environment.js";
import { registerCaatinga } from "../art/EnvCaatinga.js";
import { registerCaatingaMonsters } from "../art/MonstersCaatinga.js";
import { registerIcons } from "../art/Icons.js";
import { registerSprites } from "../art/Sprites.js";
import { registerHeroes } from "../art/Hero.js";
import { registerMonsters } from "../art/Monsters.js";
import { registerTelegraphs } from "../art/Telegraph.js";
import { registerLanterns } from "../art/Lanterns.js";
import { registerShrines } from "../art/Shrines.js";
import { registerHeroRig } from "../art/HeroRig.js";
import { registerCamp } from "../art/Camp.js";
import { registerBuildings } from "../art/Buildings.js";
import { registerGarden } from "../art/Garden.js";
import { registerKitchen } from "../art/Kitchen.js";
import { registerPond } from "../art/Pond.js";
import { registerCampDecor } from "../art/CampDecor.js";
import { registerAudio } from "../audio/Synth.js";
import { text, Bar, PAL, vw, vh, fitCamera } from "../ui/Theme.js";
import { tr } from "../i18n/i18n.js";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create() {
    fitCamera(this);
    const cx = vw(this) / 2,
      cy = vh(this) / 2;
    text(this, cx, cy - 50, tr("GUARDIÃO DA FLORESTA"), { size: 34, color: "#f2c14e", origin: 0.5 });
    const label = text(this, cx, cy + 44, "", { size: 16, color: "#9fb4a4", origin: 0.5 });
    const barW = 420;
    const bar = new Bar(this, cx - barW / 2, cy - 6, barW, 24, PAL.g5, { segments: 10 });
    bar.set(0, true);

    const steps = [
      [tr("Plantando a floresta…"), () => this.registry.set("envKeys", registerEnvironment(this))],
      [tr("Secando o sertão…"), () => this.registry.set("envKeysCaatinga", registerCaatinga(this))],
      [tr("Talhando ícones…"), () => registerIcons(this)],
      [tr("Acendendo vaga-lumes…"), () => registerSprites(this)],
      [tr("Despertando o Guardião…"), () => { registerHeroes(this); registerHeroRig(this); }],
      [tr("Corrompendo criaturas…"), () => { registerMonsters(this); registerCaatingaMonsters(this); }],
      [tr("Afiando garras…"), () => registerTelegraphs(this)],
      [tr("Acendendo cogumelos…"), () => registerLanterns(this)],
      [tr("Erguendo os santuários…"), () => registerShrines(this)],
      [tr("Erguendo o acampamento…"), () => registerCamp(this)],
      [tr("Cobrindo os telhados de sapê…"), () => registerBuildings(this)],
      [tr("Arando a horta…"), () => registerGarden(this)],
      [tr("Acendendo o fogão…"), () => registerKitchen(this)],
      [tr("Enchendo o lago…"), () => registerPond(this)],
      [tr("Pendurando as bandeirinhas…"), () => registerCampDecor(this)],
      [tr("Afinando a floresta…"), () => registerAudio(this.game)],
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
