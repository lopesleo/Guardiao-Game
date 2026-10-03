// Pausa: overlay sobre a GameScene. Mostra a build atual (armas com nível,
// passivas acumuladas) e estatísticas; Continuar / Opções / Desistir.
import { WEAPONS, PASSIVES, MAX_WEAPON_LEVEL, PASSIVE_SLOTS } from "../config.js";
import { weaponSlotsFor } from "../systems/Builds.js";
import { formatTime } from "../utils.js";
import { PAL, CSS } from "../art/Palette.js";
import { WEAPON_ICON, PASSIVE_ICON } from "../art/Icons.js";
import { text, drawFrame, dim, Button, vw, vh, fitCamera } from "../ui/Theme.js";
import { Modal, closeTopModal } from "../ui/Widgets.js";
import { openSettings } from "../ui/SettingsModal.js";
import { tr } from "../i18n/i18n.js";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("PauseScene");
  }

  create() {
    const W = vw(this),
      H = vh(this);
    fitCamera(this);
    const gs = this.scene.get("GameScene");
    const p = gs.player;
    this._modals = [];
    dim(this, 0.75);

    text(this, W / 2, 62, tr("PAUSADO"), { size: 56, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 8 });
    text(this, W / 2, 104, tr("{0}  ·  {1} abates  ·  nível {2}  ·  Perigo {3}", formatTime(gs.hud.elapsedMs), gs.hud.kills, p.level, gs.diff.name), {
      size: 18,
      color: CSS.muted,
      origin: 0.5,
    });

    // Painel da build: ARMAS e PASSIVAS no MESMO padrão (moldura + ícone, nome, nível),
    // grade de 3 colunas; a altura sai do conteúdo. Antes as passivas eram só ícones
    // com um "×2" em cima da moldura e o nome só aparecia passando o mouse.
    const pw = Math.min(760, W - 60);
    const px = W / 2 - pw / 2,
      py = 128;
    const COLS = 3,
      ROW = 64,
      HEAD = 40,
      PAD = 18;
    const colW = (pw - 56) / COLS;
    const taken = p.passivesTaken || {};
    const ids = Object.keys(taken);
    const rows = (n) => Math.max(1, Math.ceil(n / COLS));
    const wRows = rows(p.weapons.length),
      pRows = rows(ids.length);
    const links = p.links?.list() ?? [];
    const LINK_H = links.length ? 38 + links.length * 22 : 0;
    const ph = PAD + HEAD + wRows * ROW + 10 + HEAD + pRows * ROW + PAD - 6 + LINK_H;
    const g = this.add.graphics();
    drawFrame(g, px, py, pw, ph, "gold");
    const slot = (i, y0, frame, icon, name, sub, subColor) => {
      const x = px + 28 + (i % COLS) * colW;
      const y = y0 + Math.floor(i / COLS) * ROW;
      const sg = this.add.graphics();
      drawFrame(sg, x, y, 52, 52, frame, { noRivets: true });
      this.add.image(x + 26, y + 26, icon).setScale(2.8);
      const nt = text(this, x + 64, y + 14, name, { size: 18, origin: [0, 0.5] });
      if (nt.width > colW - 72) nt.setScale((colW - 72) / nt.width);
      text(this, x + 64, y + 38, sub, { size: 15, color: subColor, origin: [0, 0.5] });
    };
    let y = py + PAD;
    text(this, px + 28, y + 12, tr("ARMAS {0}/{1}", p.weapons.length, weaponSlotsFor(gs.meta)), { size: 20, color: CSS.goldHi, origin: [0, 0.5] });
    y += HEAD;
    p.weapons.forEach((w, i) => {
      const def = WEAPONS[w.key];
      slot(i, y, def.evolvesFrom ? "purple" : "dark", WEAPON_ICON[w.key] ?? "ico_staff", def.name, def.evolvesFrom ? tr("EVOLUÍDA") : tr("Nível {0}/{1}", w.level, MAX_WEAPON_LEVEL), def.evolvesFrom ? CSS.gold : CSS.muted);
    });
    y += wRows * ROW + 10;
    // separador entre as seções
    g.fillStyle(PAL.ink, 0.6).fillRect(px + 24, y - 6, pw - 48, 2);
    text(this, px + 28, y + 12, tr("PASSIVAS {0}/{1}", ids.length, PASSIVE_SLOTS), { size: 20, color: hexIce(), origin: [0, 0.5] });
    y += HEAD;
    if (!ids.length) text(this, px + 28, y + 20, tr("Nenhuma ainda — escolha passivas nas cartas de nível."), { size: 16, color: CSS.dim, origin: [0, 0.5] });
    ids.forEach((id, i) => {
      const def = PASSIVES.find((d) => d.id === id);
      slot(i, y, "ice", PASSIVE_ICON[id] ?? "ico_plus", def?.label ?? id, tr("Nível {0}", taken[id]), hexIce());
    });
    // Laços ativos (combos de dupla): nome + o que fazem, uma linha cada
    if (links.length) {
      y += pRows * ROW + 4;
      g.fillStyle(PAL.ink, 0.6).fillRect(px + 24, y - 6, pw - 48, 2);
      text(this, px + 28, y + 12, tr("LAÇOS {0}", links.length), { size: 20, color: CSS.green, origin: [0, 0.5] });
      links.forEach((l, i) => {
        const t = text(this, px + 28, y + 36 + i * 22, `${l.name}: ${l.desc}`, { size: 14, color: CSS.muted, origin: [0, 0.5] });
        if (t.width > pw - 56) t.setScale((pw - 56) / t.width);
      });
    }

    // Botões
    const by = H - 150;
    new Button(this, W / 2, by, 320, 68, tr("CONTINUAR"), () => this._resume(), { size: 30, style: "primary", color: CSS.goldHi });
    new Button(this, W / 2 - 170, by + 76, 300, 52, tr("OPÇÕES"), () => openSettings(this, { onDmgNumbers: (v) => (gs._showDmgNumbers = v), onLighting: (v) => gs.lighting?.setEnabled(v) }), {
      size: 20,
      icon: "ico_gear",
      iconScale: 2.5,
      style: "dark",
    });
    new Button(this, W / 2 + 170, by + 76, 300, 52, tr("DESISTIR"), () => this._confirmQuit(), { size: 20, style: "danger", color: CSS.redHi });

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
    const m = new Modal(this, { title: tr("DESISTIR?"), style: "danger", w: 560, h: 320 });
    m.add(text(this, 0, -30, tr("Você volta ao menu com as moedas\njá coletadas nesta partida."), { size: 20, align: "center", origin: 0.5 }));
    m.add(new Button(this, -125, 86, 220, 54, tr("DESISTIR"), () => this._exit(), { style: "danger", color: CSS.redHi, size: 20 }));
    m.add(new Button(this, 125, 86, 220, 54, tr("VOLTAR"), () => m.close(), { size: 20 }));
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
