// Horta NO CHÃO da Clareira: o jogador anda até um canteiro e o botão de ação
// muda com ele (PLANTAR · REGAR · ARRANCAR · TIRAR LAGARTA · COLHER). Passar
// por cima de um canteiro maduro colhe andando. Plantar abre uma fileira de
// sementes no pé da tela (segurar = planta em todos os vazios).
// O Celeiro (prédio ao lado + botão no HUD) mostra a colheita e as sementes.
// Mixin da CampScene (Object.assign): usa this.meta, this.builds, this.garden.
import { GAME, GARDEN, FISHING } from "../config.js";
import { fmtDuration } from "../systems/Builds.js";
import { pantryCount } from "../systems/Garden.js";
import { Analytics } from "../systems/Analytics.js";
import { Clock } from "../systems/Clock.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { cropIcon } from "../art/Garden.js";
import { text, drawFrame, haptic } from "../ui/Theme.js";
import { Modal } from "../ui/Widgets.js";

const S = GAME.PIXEL_SCALE;
const GX = 20,
  GY = 410; // centro da horta no mapa
const COL = 86,
  ROW = 64;
const PLOT_W = 72,
  PLOT_H = 48; // canteiro na tela (arte 24×16 ×3)
const BARN_X = -300,
  BARN_Y = 450;
const NEED_ICON = { water: "ico_water", weed: "ico_weed", pest: "ico_pest" };
const NEED_VERB = { water: "REGAR", weed: "ARRANCAR MATO", pest: "TIRAR LAGARTA" };
const Q_COLOR = [CSS.muted, hex(PAL.s4), CSS.goldHi];
const HOLD_MS = 450; // segurar a semente = plantar em todos os vazios

// Centro do canteiro i (grade 3×3, de cima para baixo)
const plotPos = (i) => ({ x: GX + ((i % 3) - 1) * COL, y: GY + (Math.floor(i / 3) - 1) * ROW });

export const CampGarden = {
  // ---------------------------------------------------------------------------
  // MUNDO
  // ---------------------------------------------------------------------------
  _gardenWorld() {
    const shown = this._isShown("garden");
    const g = (this.gardenGfx = { plots: [] });
    const fade = []; // o que aparece na cena de revelação
    // Cerca de taquara atrás, com o portal de bambu no meio (onde a trilha
    // chega), e mourões de bambu nas laterais
    const x0 = GX - 1.5 * COL - 16,
      x1 = GX + 1.5 * COL + 16,
      y0 = GY - 1.5 * ROW - 6,
      y1 = GY + 1.5 * ROW + 10;
    const gateHalf = 45;
    const fy = y0 - 6;
    const leftW = Math.round((GX - gateHalf - x0) / S),
      rightW = Math.round((x1 - (GX + gateHalf)) / S);
    const fenceL = this.add.tileSprite(x0, fy, leftW, 14, "garden_fence").setOrigin(0, 1).setScale(S).setDepth(fy);
    const fenceR = this.add.tileSprite(GX + gateHalf, fy, rightW, 14, "garden_fence").setOrigin(0, 1).setScale(S).setDepth(fy);
    const arch = this.add.image(GX, fy + 2, "garden_arch").setOrigin(0.5, 1).setScale(S).setDepth(fy + 2);
    fade.push(fenceL, fenceR, arch);
    for (const x of [x0 - 2, x1 - 16])
      for (let y = y0 + 40; y <= y1; y += 46) {
        const post = this.add.image(x, y, "garden_fence_post").setOrigin(0, 1).setScale(S).setDepth(y);
        fade.push(post);
      }
    // postes do portal e as cercas não se atravessam
    this._solid((x0 + GX - gateHalf) / 2, fy - 8, GX - gateHalf - x0, 12);
    this._solid((GX + gateHalf + x1) / 2, fy - 8, x1 - GX - gateHalf, 12);
    // Canteiros: terra arada (aberto) ou mato (fechado) + planta + aviso
    for (let i = 0; i < 9; i++) {
      const { x, y } = plotPos(i);
      const bed = this.add.image(x, y, "garden_locked").setScale(S).setDepth(y - 40);
      const plant = this.add.sprite(x, y + 16, "crop_carrot", 0).setOrigin(0.5, 1).setScale(S).setDepth(y + 16).setVisible(false);
      const bubble = this.add.container(x + 26, y - 46).setDepth(this.D_HUD - 12).setVisible(false);
      const bg = this.add.graphics();
      bg.fillStyle(PAL.ink, 1).fillCircle(0, 0, 17);
      bg.fillStyle(PAL.cream, 1).fillCircle(0, 0, 14);
      const ic = this.add.image(0, 0, "ico_water").setScale(2);
      bubble.add([bg, ic]);
      this.tweens.add({ targets: bubble, y: bubble.y - 6, duration: 520 + i * 17, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      fade.push(bed);
      g.plots.push({ bed, plant, bubble, ic, x, y });
      this._addInteract({ x, y, top: y - 44, r: 46, plot: i, hiddenUntil: "garden", name: "", verb: "", action: () => this._plotAction(i) });
    }
    // Destaque do canteiro alvo
    g.hl = this.add.graphics().setVisible(false);
    this.tweens.add({ targets: g.hl, alpha: 0.45, duration: 480, yoyo: true, repeat: -1 });
    // Celeiro
    const shadow = this.add.image(BARN_X, BARN_Y + 4, "px_shadow").setScale(8, 4).setAlpha(0.55).setDepth(BARN_Y - 1);
    const barn = this.add.image(BARN_X, BARN_Y, "camp_barn").setOrigin(0.5, 1).setScale(S).setDepth(BARN_Y);
    this._solid(BARN_X, BARN_Y - 14, barn.displayWidth * 0.8, 30);
    fade.push(barn, shadow);
    this._addInteract({ x: BARN_X, y: BARN_Y, top: BARN_Y - barn.displayHeight, r: 110, name: "CELEIRO", verb: "CELEIRO", hiddenUntil: "garden", action: () => this._showBarn() });
    // Enquanto em ruínas: tudo escondido, ruína no meio da horta
    if (!shown) fade.forEach((o) => o.setAlpha(0));
    g.ruin = shown ? null : this.add.image(GX, GY + 30, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(GY + 30);
    this.buildings.garden = {
      x: GX,
      y: GY + 40,
      img: null,
      ruin: g.ruin,
      shown,
      dot: this._notifyDot(GX + 1.5 * COL + 20, GY - 1.5 * ROW - 50).setDepth(this.D_HUD - 10).setVisible(false),
      reveal: () => {
        this.tweens.add({ targets: fade, alpha: (t) => (t === shadow ? 0.55 : 1), duration: 700, delay: 300 });
        this.barnBtn?.setVisible(true);
      },
    };
    // Ruína: examinar (some quando a Horta aparece)
    this._addInteract({ x: GX, y: GY + 30, top: GY - 70, r: 130, name: "HORTA", verb: "", ruinOf: "garden", hideWhenShown: "garden", action: () => this._say("Cure a floresta jogando partidas para revelar o que há aqui.") });
    this._refreshGardenWorld();
  },

  // Atualiza o que se vê no mapa (a cada meio segundo e após cada ação)
  _refreshGardenWorld() {
    const g = this.gardenGfx;
    if (!g) return;
    const shown = this.buildings.garden.shown;
    const gd = this.garden;
    const now = Clock.now();
    g.plots.forEach((v, i) => {
      const open = i < gd.open;
      v.bed.setTexture(open ? "garden_plot" : "garden_locked");
      const p = open ? gd.plots[i] : null;
      const st = open ? gd.state(i, now) : "locked";
      v.plant.setVisible(shown && !!p);
      if (p) v.plant.setTexture(`crop_${p.crop}`, gd.stage(p));
      const need = st === "need" ? gd.need(p).type : null;
      v.bubble.setVisible(shown && (!!need || st === "ripe"));
      if (need) v.ic.setTexture(NEED_ICON[need]);
      else if (st === "ripe") v.ic.setTexture(cropIcon(p.crop));
    });
    // "!" quando há canteiro vazio e semente para plantar
    const canPlant = gd.plots.some((p, i) => i < gd.open && !p) && gd.available().length > 0;
    this.buildings.garden.dot.setVisible(shown && canPlant);
    // O rótulo do botão acompanha o estado do canteiro alvo
    const t = this._target;
    if (t?.plot != null && this._plotLabel(t.plot).key !== t._key) this._setTarget(t, true);
  },

  // Nome/ação do canteiro (lido pelo aviso e pelo botão de ação)
  _plotLabel(i) {
    const gd = this.garden;
    if (i >= gd.open) return { key: "locked", name: "MATO", verb: "EXAMINAR" };
    const st = gd.state(i);
    const p = gd.plots[i];
    if (st === "empty") return { key: st, name: "CANTEIRO VAZIO", verb: "PLANTAR" };
    const name = GARDEN.CROPS[p.crop].name.toUpperCase();
    if (st === "need") {
      const type = gd.need(p).type;
      return { key: `need_${type}`, name, verb: NEED_VERB[type] };
    }
    if (st === "ripe") return { key: st, name: `${name} · ${GARDEN.QUALITY[gd.quality(p)].toUpperCase()}`, verb: "COLHER" };
    return { key: st, name, verb: "VER" };
  },

  // Destaque pulsando em volta do canteiro alvo
  _plotHighlight(i) {
    const hl = this.gardenGfx?.hl;
    if (!hl) return;
    hl.clear();
    if (i == null) return hl.setVisible(false);
    const v = this.gardenGfx.plots[i];
    hl.lineStyle(4, PAL.yel3, 1).strokeRect(v.x - PLOT_W / 2 - 5, v.y - PLOT_H / 2 - 5, PLOT_W + 10, PLOT_H + 10);
    hl.setDepth(v.y - 39).setVisible(true);
  },

  _plotAction(i) {
    const gd = this.garden;
    if (i >= gd.open) return this._toast("Melhore a Horta com o João-de-barro para abrir este canteiro");
    const st = gd.state(i);
    if (st === "empty") {
      if (gd.available().length) this._showSeedBar(i);
      else this._toast("Sem sementes agora");
    } else if (st === "need") {
      const type = gd.care(i);
      if (type) this._plotFx(i, "care", type);
    } else if (st === "ripe") this._harvestPlot(i);
    else this._toast(`${GARDEN.CROPS[gd.plots[i].crop].name}: pronta em ${fmtDuration(gd.remainingMs(gd.plots[i]))}`);
    this._refreshGardenWorld();
  },

  _harvestPlot(i) {
    const r = this.garden.harvest(i);
    if (!r) return;
    this._plotFx(i, "harvest", r);
    this._dailyBump?.("harvest");
    if (this.meta.data.stats.harvests === 1) this.time.delayedCall(700, () => this._say("Isso! Agora plante de novo: desta vez leva alguns minutos. Jogue uma partida e volte."));
    this._refreshGardenWorld();
  },

  // Colher andando: pisar num canteiro maduro colhe (chamado pelo update)
  _gardenWalk(px, py) {
    const g = this.gardenGfx;
    if (!g || !this.buildings.garden.shown) return;
    for (let i = 0; i < this.garden.open; i++) {
      const v = g.plots[i];
      if (Math.abs(px - v.x) < PLOT_W / 2 && Math.abs(py - v.y) < PLOT_H / 2 && this.garden.plots[i] && this.garden.state(i) === "ripe") {
        this._harvestPlot(i);
        return;
      }
    }
  },

  // Efeitos no mapa: respingos ao cuidar; ao colher, o fruto voa até o
  // botão do Celeiro no HUD
  _plotFx(i, kind, r) {
    const v = this.gardenGfx.plots[i];
    if (kind === "care") {
      this.sound.play("sfx_pickup", { volume: 0.45, rate: r === "water" ? 0.8 : 1.1 });
      haptic(15);
      const tint = { water: PAL.ice2, weed: PAL.g5, pest: PAL.g4 }[r];
      for (let k = 0; k < 12; k++) {
        const d = this.add.image(v.x, v.y - 10, "px_dot2").setScale(3).setTint(tint).setDepth(this.D_HUD - 11);
        const a = Math.random() * Math.PI * 2;
        this.tweens.add({ targets: d, x: v.x + Math.cos(a) * 44, y: v.y - 10 + Math.sin(a) * 30 - 16, alpha: 0, duration: 500, onComplete: () => d.destroy() });
      }
      Analytics.track("garden_care", { type: r });
      return;
    }
    this.sound.play("sfx_coin", { volume: 0.5, rate: 0.9 + r.q * 0.1 });
    haptic(25);
    const lbl = text(this, v.x, v.y - 40, `+${r.n} ${GARDEN.CROPS[r.crop].name} · ${GARDEN.QUALITY[r.q]}`, { size: 18, color: Q_COLOR[r.q], origin: 0.5, stroke: true }).setDepth(this.D_HUD - 8);
    this.tweens.add({ targets: lbl, y: v.y - 90, alpha: 0, duration: 1300, onComplete: () => lbl.destroy() });
    // Da posição no mundo até o botão fixo do Celeiro
    const cam = this.cameras.main;
    const b = this.barnBtn;
    const ic = this.add.image(v.x - cam.scrollX, v.y - 20 - cam.scrollY, cropIcon(r.crop)).setScale(3).setScrollFactor(0).setDepth(this.D_HUD + 1);
    this.tweens.add({
      targets: ic,
      x: b.x,
      y: b.y,
      scale: 1.6,
      duration: 650,
      ease: "Cubic.easeIn",
      onComplete: () => {
        ic.destroy();
        this.tweens.add({ targets: b, scale: { from: 1.15, to: 1 }, duration: 180 });
      },
    });
    Analytics.track("garden_harvest", { crop: r.crop, q: r.q });
  },

  // ---------------------------------------------------------------------------
  // FILEIRA DE SEMENTES (pé da tela)
  // ---------------------------------------------------------------------------
  _showSeedBar(i) {
    const gd = this.garden;
    const ids = gd.available();
    const W = this.W,
      H = this.H;
    const CW = 132,
      CH = 118,
      GAP = 10;
    const total = ids.length * CW + (ids.length - 1) * GAP;
    const bw = Math.min(W - 24, Math.max(total + 40, 520));
    const c = this.add.container(W / 2, H - CH / 2 - 30).setScrollFactor(0).setDepth(this.D_HUD + 8);
    const bg = this.add.graphics();
    drawFrame(bg, -bw / 2, -CH / 2 - 44, bw, CH + 62, "gold", { alpha: 0.96 });
    c.add(bg);
    c.add(text(this, 0, -CH / 2 - 24, "PLANTAR  ·  segure para plantar em todos os vazios", { size: 16, color: CSS.goldHi, origin: 0.5 }));
    const bar = {
      close: () => {
        if (bar.closed) return;
        bar.closed = true;
        this._modals = this._modals.filter((m) => m !== bar);
        c.destroy();
      },
    };
    this._modals.push(bar);
    this._setTarget(null);
    // Fechar
    const x = this.add.image(bw / 2 - 26, -CH / 2 - 24, "ico_close").setScale(2.5).setInteractive({ useHandCursor: true });
    x.on("pointerup", () => bar.close());
    c.add(x);
    // Um cartão por semente
    const startX = -total / 2 + CW / 2;
    ids.forEach((id, k) => {
      const crop = GARDEN.CROPS[id];
      const card = this.add.container(startX + k * (CW + GAP), 6);
      const g = this.add.graphics();
      drawFrame(g, -CW / 2, -CH / 2, CW, CH, crop.rare ? "gold" : "button", { noRivets: true });
      card.add(g);
      card.add(this.add.image(0, -26, cropIcon(id)).setScale(3.4));
      card.add(text(this, 0, 12, crop.name, { size: 15, origin: 0.5, align: "center", wrap: CW - 10 }));
      const seeds = this.meta.data.seeds[id] || 0;
      card.add(text(this, 0, 38, crop.rare ? `${fmtDuration(crop.s * 1000)} · ×${seeds}` : fmtDuration(crop.s * 1000), { size: 14, color: crop.rare ? CSS.goldHi : CSS.muted, origin: 0.5 }));
      const zone = this.add.zone(0, 0, CW, CH).setInteractive({ useHandCursor: true });
      card.add(zone);
      let downAt = 0;
      zone.on("pointerdown", () => {
        downAt = this.time.now;
        haptic(8);
      });
      zone.on("pointerout", () => (downAt = 0));
      zone.on("pointerup", () => {
        if (!downAt) return;
        const all = this.time.now - downAt >= HOLD_MS;
        downAt = 0;
        bar.close();
        this._plantFromBar(i, id, all);
      });
      c.add(card);
    });
    fixAll(c);
    c.setAlpha(0).setY(c.y + 30);
    this.tweens.add({ targets: c, alpha: 1, y: c.y - 30, duration: 200, ease: "Back.easeOut" });
  },

  // Planta no canteiro i (e, se `all`, nos outros vazios enquanto houver semente)
  _plantFromBar(i, id, all) {
    const gd = this.garden;
    let n = gd.plant(i, id) ? 1 : 0;
    if (all) for (let k = 0; k < gd.open; k++) if (!gd.plots[k] && gd.plant(k, id)) n++;
    if (!n) return;
    this.meta.data.lastSeed = id;
    this.meta._save();
    this.sound.play("sfx_pickup", { volume: 0.5, rate: 0.7 });
    haptic(20);
    for (let k = 0; k < gd.open; k++) {
      if (gd.plots[k]?.crop !== id || gd.plots[k].grown > 0) continue;
      const v = this.gardenGfx.plots[k];
      for (let j = 0; j < 6; j++) {
        const d = this.add.image(v.x, v.y, "px_dot2").setScale(3).setTint(PAL.n4).setDepth(v.y + 20);
        this.tweens.add({ targets: d, x: v.x + (Math.random() - 0.5) * 50, y: v.y - 14 - Math.random() * 16, alpha: 0, duration: 420, onComplete: () => d.destroy() });
      }
    }
    Analytics.track("garden_plant", { crop: id, n });
    this._refreshGardenWorld();
    // Planta demorada (1 h ou mais): oferece o aviso da colheita
    const ms = Math.max(0, ...gd.plots.map((p) => gd.remainingMs(p)));
    if (GARDEN.CROPS[id].s >= 3600) this.time.delayedCall(500, () => this._offerNotify?.("crop", Date.now() + ms));
  },

  // ---------------------------------------------------------------------------
  // CELEIRO (prédio + botão no HUD)
  // ---------------------------------------------------------------------------
  _barnHudButton(x, y) {
    const c = this.add.container(x, y).setScrollFactor(0).setDepth(this.D_HUD);
    const g = this.add.graphics();
    drawFrame(g, -26, -26, 52, 52, "dark", { noRivets: true });
    const ic = this.add.image(0, 0, "ico_basket").setScale(2.6);
    const zone = this.add.zone(0, 0, 52, 52).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => {
      if (this._modals.length || this._cutscene) return;
      this.sound.play("sfx_ui_click", { volume: 0.4 });
      haptic(12);
      this._showBarn();
    });
    c.add([g, ic, zone]);
    fixAll(c);
    this.barnBtn = c;
    c.setVisible(this._isShown("garden"));
    return c;
  },

  _showBarn() {
    const d = this.meta.data;
    const m = new Modal(this, { title: "CELEIRO", subtitle: "Tudo o que você colheu e as sementes guardadas", w: 760, h: 560 });
    const list = this._modalList(m);
    const row = (icon, name, right) =>
      list.addRow({
        h: 56,
        build: (c, w) => {
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, 56, "dark", { noRivets: true });
          c.add(g);
          c.add(this.add.image(34, 28, icon).setScale(FISHING.FISH[icon.slice(4)] ? 2.4 : 3)); // peixe é comprido
          c.add(text(this, 70, 28, name, { size: 19, origin: [0, 0.5] }));
          right(c, w);
        },
      });
    const crops = Object.keys(GARDEN.CROPS).filter((id) => pantryCount(d, id) > 0);
    this._section(list, "COLHEITA");
    if (!crops.length) list.addRow({ h: 40, build: (c, w) => c.add(text(this, w / 2, 20, "Nada ainda — colha na horta!", { size: 16, color: CSS.dim, origin: 0.5 })) });
    for (const id of crops)
      row(cropIcon(id), GARDEN.CROPS[id].name, (c, w) => {
        let x = w - 20;
        const q = d.pantry[id];
        for (let k = 2; k >= 0; k--) {
          if (!q[k]) continue;
          const t = text(this, x, 28, String(q[k]), { size: 19, color: Q_COLOR[k], origin: [1, 0.5], stroke: true });
          c.add(t);
          c.add(this._qualityPip(x - t.width - 12, 28, k));
          x -= t.width + 38;
        }
      });
    const fish = Object.keys(FISHING.FISH).filter((id) => pantryCount(d, id) > 0 || d.fishRecords?.[id]);
    if (fish.length) {
      this._section(list, "PEIXES");
      for (const id of fish)
        row(`ico_${id}`, `${FISHING.FISH[id].name}  ·  recorde ${d.fishRecords?.[id] || 0} cm`, (c, w) => {
          let x = w - 20;
          const q = d.pantry[id] || [0, 0, 0];
          for (let k = 2; k >= 0; k--) {
            if (!q[k]) continue;
            const t = text(this, x, 28, String(q[k]), { size: 19, color: Q_COLOR[k], origin: [1, 0.5], stroke: true });
            c.add(t);
            c.add(this._qualityPip(x - t.width - 12, 28, k));
            x -= t.width + 38;
          }
        });
    }
    const seeds = Object.entries(d.seeds || {}).filter(([, n]) => n > 0);
    if (seeds.length) {
      this._section(list, "SEMENTES RARAS");
      for (const [id, n] of seeds)
        row(cropIcon(id), GARDEN.CROPS[id].name, (c, w) => {
          c.add(this.add.image(w - 76, 28, "ico_seed").setScale(2.2));
          c.add(text(this, w - 20, 28, `×${n}`, { size: 19, color: CSS.goldHi, origin: [1, 0.5], stroke: true }));
        });
    }
    // Legenda das qualidades
    list.addRow({
      h: 36,
      build: (c, w) => {
        const items = GARDEN.QUALITY.map((name, k) => [this._qualityPip(0, 18, k), text(this, 0, 18, name, { size: 15, color: Q_COLOR[k], origin: [0, 0.5] })]);
        const tw = items.reduce((a, [, t]) => a + t.width + 52, -34);
        let x = w / 2 - tw / 2;
        for (const [pip, t] of items) {
          pip.x = x + 6;
          t.x = x + 18;
          c.add([pip, t]);
          x += t.width + 52;
        }
      },
    });
  },

  // Bolinha da cor da qualidade (comum, prata, ouro)
  _qualityPip(x, y, q) {
    const g = this.add.graphics();
    g.fillStyle(PAL.ink, 1).fillCircle(0, 0, 7);
    g.fillStyle([PAL.n3, PAL.s4, PAL.yel2][q], 1).fillCircle(0, 0, 5);
    g.fillStyle(PAL.white, 0.6).fillRect(-3, -3, 2, 2);
    g.setPosition(x, y);
    return g;
  },
};

// scrollFactor 0 em tudo (o toque usa o do próprio objeto, não o do container)
function fixAll(o) {
  o.setScrollFactor?.(0);
  if (o.list) o.list.forEach(fixAll);
}
