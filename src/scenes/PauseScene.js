// Pausa: overlay sobre a GameScene. Mostra a build atual (armas com nível,
// passivas acumuladas) e estatísticas; Continuar / Opções / Desistir.
import { WEAPONS, PASSIVES, MAX_WEAPON_LEVEL, PASSIVE_SLOTS, REACTION } from "../config.js";
import { weaponSlotsFor } from "../systems/Builds.js";
import { formatTime } from "../utils.js";
import { PAL, CSS } from "../art/Palette.js";
import { WEAPON_ICON, PASSIVE_ICON, ELEMENT_SEAL } from "../art/Icons.js";
import { text, drawFrame, dim, Button, vw, vh, fitCamera } from "../ui/Theme.js";
import { Modal, closeTopModal } from "../ui/Widgets.js";
import { openSettings } from "../ui/SettingsModal.js";
import { tr } from "../i18n/i18n.js";

// As seis reações (par de elementos → reação), na ordem em que o jogo as apresenta
const REACTIONS = [
  ["fire", "ice", "VAPOR"],
  ["ice", "bolt", "CRYSTAL"],
  ["fire", "bolt", "OVERLOAD"],
  ["fire", "wind", "LABAREDA"],
  ["ice", "wind", "GEADA"],
  ["bolt", "wind", "TEMPORAL"],
];
// Elementos que a arma aplica: o seu + os que ela "também" põe (evoluções) + o par da
// reação que ela faz por código próprio (ex.: Redemoinho de Brasa alterna fogo e vento)
const weaponElements = (def) => {
  const pair = REACTIONS.find(([, , k]) => k === def.reaction)?.slice(0, 2) ?? [];
  return [...new Set([def.element, ...(def.also || []), ...pair].filter((e) => ELEMENT_SEAL[e]))];
};

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
    // À direita, a coluna das REAÇÕES (tabela dos pares + quantas saíram nesta partida);
    // em tela estreita demais ela some e o painel volta a ser só a build
    const RX = W - 60 >= 1000 ? 270 : 0;
    const pw = Math.min(760, W - 60 - RX) + RX;
    const px = W / 2 - pw / 2,
      py = 128;
    const lw = pw - RX; // largura da parte da build
    const COLS = 3,
      ROW = 64,
      HEAD = 40,
      PAD = 18;
    const colW = (lw - 56) / COLS;
    const taken = p.passivesTaken || {};
    const ids = Object.keys(taken);
    const rows = (n) => Math.max(1, Math.ceil(n / COLS));
    const wRows = rows(p.weapons.length),
      pRows = rows(ids.length);
    const links = p.links?.list() ?? [];
    const LINK_H = links.length ? 38 + links.length * 22 : 0;
    const REACT_H = RX ? PAD + HEAD + 20 + (REACTIONS.length - 1) * 38 + 22 + PAD : 0; // última linha + respiro
    const ph = Math.max(PAD + HEAD + wRows * ROW + 10 + HEAD + pRows * ROW + PAD - 6 + LINK_H, REACT_H);
    const g = this.add.graphics();
    drawFrame(g, px, py, pw, ph, "gold");
    const slot = (i, y0, frame, icon, name, sub, subColor, seals = []) => {
      const x = px + 28 + (i % COLS) * colW;
      const y = y0 + Math.floor(i / COLS) * ROW;
      const sg = this.add.graphics();
      drawFrame(sg, x, y, 52, 52, frame, { noRivets: true });
      this.add.image(x + 26, y + 26, icon).setScale(2.8);
      // selo do elemento no canto da moldura (dois na arma que aplica dois)
      seals.forEach((e, k) => this.add.image(x + 50 - k * 17, y + 50, ELEMENT_SEAL[e]).setScale(2));
      const nt = text(this, x + 64, y + 14, name, { size: 18, origin: [0, 0.5] });
      if (nt.width > colW - 72) nt.setScale((colW - 72) / nt.width);
      text(this, x + 64, y + 38, sub, { size: 15, color: subColor, origin: [0, 0.5] });
    };
    let y = py + PAD;
    text(this, px + 28, y + 12, tr("ARMAS {0}/{1}", p.weapons.length, weaponSlotsFor(gs.meta)), { size: 20, color: CSS.goldHi, origin: [0, 0.5] });
    y += HEAD;
    p.weapons.forEach((w, i) => {
      const def = WEAPONS[w.key];
      slot(i, y, def.evolvesFrom ? "purple" : "dark", WEAPON_ICON[w.key] ?? "ico_staff", def.name, def.evolvesFrom ? tr("EVOLUÍDA") : tr("Nível {0}/{1}", w.level, MAX_WEAPON_LEVEL), def.evolvesFrom ? CSS.gold : CSS.muted, weaponElements(def));
    });
    y += wRows * ROW + 10;
    // separador entre as seções
    g.fillStyle(PAL.ink, 0.6).fillRect(px + 24, y - 6, lw - 48, 2);
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
      g.fillStyle(PAL.ink, 0.6).fillRect(px + 24, y - 6, lw - 48, 2);
      text(this, px + 28, y + 12, tr("LAÇOS {0}", links.length), { size: 20, color: CSS.green, origin: [0, 0.5] });
      links.forEach((l, i) => {
        const t = text(this, px + 28, y + 36 + i * 22, `${l.name}: ${l.desc}`, { size: 14, color: CSS.muted, origin: [0, 0.5] });
        if (t.width > lw - 56) t.setScale((lw - 56) / t.width);
      });
    }
    if (RX) this._reactions(gs, p, g, px + lw, py, RX, ph);

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

  // Coluna das reações: os seis pares sempre à vista (ensina as combinações). Conseguida
  // nesta partida = nome na cor da reação e "×N"; possível com as armas de agora = nome
  // claro; sem os dois elementos no arsenal = apagada.
  _reactions(gs, p, g, x0, y0, w, h) {
    g.fillStyle(PAL.ink, 0.6).fillRect(x0 - 2, y0 + 18, 2, h - 36); // divisória vertical
    const have = new Set(p.weapons.flatMap((wp) => weaponElements(WEAPONS[wp.key])));
    const now = gs.meta?.data?.stats?.reactions || {};
    const start = gs._reactionsAtStart || {};
    const got = REACTIONS.filter(([, , k]) => (now[k] || 0) - (start[k] || 0) > 0).length;
    text(this, x0 + 22, y0 + 18 + 12, tr("REAÇÕES {0}/{1}", got, REACTIONS.length), { size: 20, color: CSS.goldHi, origin: [0, 0.5] });
    REACTIONS.forEach(([a, b, k], i) => {
      const n = (now[k] || 0) - (start[k] || 0);
      const can = have.has(a) && have.has(b);
      const y = y0 + 18 + 40 + 20 + i * 38;
      const alpha = n > 0 || can ? 1 : 0.35;
      this.add.image(x0 + 34, y, ELEMENT_SEAL[a]).setScale(2).setAlpha(alpha);
      this.add.image(x0 + 58, y, ELEMENT_SEAL[b]).setScale(2).setAlpha(alpha);
      const name = String(REACTION[k].label).replace(/[!！]+$/, "");
      const col = n > 0 ? "#" + REACTION[k].color.toString(16).padStart(6, "0") : can ? CSS.txt : CSS.dim;
      const t = text(this, x0 + 80, y, name, { size: 17, color: col, origin: [0, 0.5] }).setAlpha(n > 0 || can ? 1 : 0.6);
      const cnt = text(this, x0 + w - 22, y, n > 0 ? `×${n}` : "—", { size: 17, color: n > 0 ? CSS.goldHi : CSS.dim, origin: [1, 0.5] }).setAlpha(alpha);
      const room = w - 22 - 80 - cnt.width - 10;
      if (t.width > room) t.setScale(room / t.width);
    });
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
