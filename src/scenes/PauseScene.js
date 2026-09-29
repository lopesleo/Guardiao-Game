// Pausa: overlay sobre a GameScene. Mostra a build atual (armas com nível,
// passivas acumuladas) e estatísticas; Continuar / Opções / Desistir.
import { WEAPONS, PASSIVES, MAX_WEAPON_LEVEL } from "../config.js";
import { formatTime } from "../utils.js";
import { PAL, CSS } from "../art/Palette.js";
import { WEAPON_ICON, PASSIVE_ICON } from "../art/Icons.js";
import { text, drawFrame, dim, Button, vw, vh } from "../ui/Theme.js";
import { Modal, closeTopModal } from "../ui/Widgets.js";
import { openSettings } from "../ui/SettingsModal.js";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("PauseScene");
  }

  create() {
    const W = vw(this),
      H = vh(this);
    const gs = this.scene.get("GameScene");
    const p = gs.player;
    this._modals = [];
    dim(this, 0.75);

    text(this, W / 2, 62, "PAUSADO", { size: 56, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 8 });
    text(this, W / 2, 104, `${formatTime(gs.hud.elapsedMs)}  ·  ${gs.hud.kills} abates  ·  nível ${p.level}  ·  Perigo ${gs.diff.name}`, {
      size: 18,
      color: CSS.muted,
      origin: 0.5,
    });

    // Painel da build
    const pw = Math.min(760, W - 60),
      ph = 330;
    const px = W / 2 - pw / 2,
      py = 132;
    const g = this.add.graphics();
    drawFrame(g, px, py, pw, ph, "gold");
    text(this, px + 28, py + 30, "ARMAS", { size: 20, color: CSS.goldHi, origin: [0, 0.5] });
    p.weapons.forEach((w, i) => {
      const def = WEAPONS[w.key];
      const x = px + 28 + (i % 3) * ((pw - 56) / 3);
      const y = py + 58 + Math.floor(i / 3) * 70;
      const sg = this.add.graphics();
      drawFrame(sg, x, y, 52, 52, def.evolvesFrom ? "purple" : "dark", { noRivets: true });
      this.add.image(x + 26, y + 26, WEAPON_ICON[w.key] ?? "ico_staff").setScale(2.8);
      text(this, x + 64, y + 14, def.name, { size: 18, origin: [0, 0.5] });
      const lv = def.evolvesFrom ? "EVOLUÍDA" : `Nível ${w.level}/${MAX_WEAPON_LEVEL}`;
      text(this, x + 64, y + 38, lv, { size: 15, color: def.evolvesFrom ? CSS.gold : CSS.muted, origin: [0, 0.5] });
    });

    const taken = p.passivesTaken || {};
    const ids = Object.keys(taken);
    const ty = py + 210;
    text(this, px + 28, ty, "PASSIVAS", { size: 20, color: hexIce(), origin: [0, 0.5] });
    if (!ids.length) text(this, px + 28, ty + 40, "Nenhuma ainda — escolha passivas nas cartas de nível.", { size: 16, color: CSS.dim, origin: [0, 0.5] });
    ids.forEach((id, i) => {
      const x = px + 40 + i * 64;
      const def = PASSIVES.find((d) => d.id === id);
      const sg = this.add.graphics();
      drawFrame(sg, x - 26, ty + 16, 52, 52, "ice", { noRivets: true });
      this.add.image(x, ty + 42, PASSIVE_ICON[id] ?? "ico_plus").setScale(2.6);
      text(this, x + 20, ty + 62, `×${taken[id]}`, { size: 15, origin: 0.5, stroke: true });
      // Nome ao passar o dedo/mouse
      const z = this.add.zone(x, ty + 42, 52, 52).setInteractive();
      z.on("pointerover", () => this._tip?.setText(def?.label ?? id));
      z.on("pointerout", () => this._tip?.setText(""));
    });
    this._tip = text(this, px + pw - 28, ty, "", { size: 16, color: CSS.muted, origin: [1, 0.5] });

    // Botões
    const by = H - 150;
    new Button(this, W / 2, by, 320, 68, "CONTINUAR", () => this._resume(), { size: 30, style: "primary", color: CSS.goldHi });
    new Button(this, W / 2 - 170, by + 76, 300, 52, "OPÇÕES", () => openSettings(this, { onDmgNumbers: (v) => (gs._showDmgNumbers = v) }), {
      size: 20,
      icon: "ico_gear",
      iconScale: 2.5,
      style: "dark",
    });
    new Button(this, W / 2 + 170, by + 76, 300, 52, "DESISTIR", () => this._confirmQuit(), { size: 20, style: "danger", color: CSS.redHi });

    this.input.keyboard.on("keydown-ESC", () => {
      if (!closeTopModal(this)) this._resume();
    });
    this.input.keyboard.on("keydown-P", () => this._resume());
  }

  // VOLTAR do Android: fecha modal; senão continua a partida
  onBack() {
    if (!closeTopModal(this)) this._resume();
    return true;
  }

  _confirmQuit() {
    const m = new Modal(this, { title: "DESISTIR?", style: "danger", w: 560, h: 320 });
    m.add(text(this, 0, -30, "Você volta ao menu com as moedas\njá coletadas nesta partida.", { size: 20, align: "center", origin: 0.5 }));
    m.add(new Button(this, -125, 86, 220, 54, "DESISTIR", () => this._exit(), { style: "danger", color: CSS.redHi, size: 20 }));
    m.add(new Button(this, 125, 86, 220, 54, "VOLTAR", () => m.close(), { size: 20 }));
  }

  _resume() {
    this.scene.resume("GameScene");
    this.scene.stop();
  }

  // Desistir = fim de partida (derrota): credita as moedas e registra a run,
  // em vez de jogar fora o progresso como antes.
  _exit() {
    const gs = this.scene.get("GameScene");
    this.scene.stop();
    this.scene.resume("GameScene");
    gs._onGameOver(false, true);
  }
}

function hexIce() {
  return "#" + PAL.ice3.toString(16).padStart(6, "0");
}
