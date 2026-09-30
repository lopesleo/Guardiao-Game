// Horta na Clareira: os canteiros no mapa (plantas crescendo à vista, avisos
// de cuidado e de colheita) e o painel da Horta, onde se planta, cuida e colhe
// com toques — arrastar o dedo por cima dos canteiros cuida/colhe vários.
// Mixin da CampScene (Object.assign): usa this.meta, this.builds, this.garden.
import { GAME, GARDEN } from "../config.js";
import { fmtDuration } from "../systems/Builds.js";
import { pantryCount } from "../systems/Garden.js";
import { Analytics } from "../systems/Analytics.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { cropIcon } from "../art/Garden.js";
import { text, drawFrame, Button, haptic } from "../ui/Theme.js";
import { Modal } from "../ui/Widgets.js";

const S = GAME.PIXEL_SCALE;
const GX = 0,
  GY = 400; // centro da horta no mapa
const COL = 70,
  ROW = 52;
const NEED_ICON = { water: "ico_water", weed: "ico_weed", pest: "ico_pest" };
const Q_COLOR = [CSS.muted, hex(PAL.s4), CSS.goldHi];

// Posição do canteiro i (grade 3×3, de cima para baixo)
const plotPos = (i) => ({ x: GX + ((i % 3) - 1) * COL, y: GY + (Math.floor(i / 3) - 1) * ROW });

export const CampGarden = {
  // ---------------------------------------------------------------------------
  // MUNDO
  // ---------------------------------------------------------------------------
  _gardenWorld() {
    const shown = this._isShown("garden");
    const g = (this.gardenGfx = { plots: [], shown });
    // Cerquinha de varas em volta
    const fence = this.add.graphics().setDepth(GY - 80).setAlpha(shown ? 1 : 0);
    const x0 = GX - 1.5 * COL - 18,
      x1 = GX + 1.5 * COL + 18,
      y0 = GY - 1.5 * ROW - 14,
      y1 = GY + 1.5 * ROW + 16;
    const post = (x, y) => {
      fence.fillStyle(PAL.ink, 1).fillRect(x - 4, y - 22, 8, 26);
      fence.fillStyle(PAL.n3, 1).fillRect(x - 2, y - 20, 4, 22);
    };
    fence.fillStyle(PAL.ink, 1);
    for (const y of [y0 - 14, y0 - 6]) fence.fillRect(x0, y, x1 - x0, 5);
    fence.fillStyle(PAL.n3, 1);
    for (const y of [y0 - 13, y0 - 5]) fence.fillRect(x0, y, x1 - x0, 3);
    for (let x = x0; x <= x1; x += (x1 - x0) / 4) post(x, y0);
    // Laterais e frente: mourões baixos
    const low = this.add.graphics().setDepth(y1 + 10).setAlpha(shown ? 1 : 0);
    for (const x of [x0, x1])
      for (let y = y0 + 30; y <= y1; y += 40) {
        low.fillStyle(PAL.ink, 1).fillRect(x - 4, y - 16, 8, 20);
        low.fillStyle(PAL.n3, 1).fillRect(x - 2, y - 14, 4, 16);
      }
    g.fence = [fence, low];
    // Canteiros (abertos = terra arada; fechados = mato) + planta + aviso
    for (let i = 0; i < 9; i++) {
      const { x, y } = plotPos(i);
      const bed = this.add.image(x, y, "garden_locked").setScale(S).setDepth(y - 30).setAlpha(shown ? 1 : 0);
      const plant = this.add.sprite(x, y + 14, "crop_carrot", 0).setOrigin(0.5, 1).setScale(S).setDepth(y + 14).setVisible(false);
      const bubble = this.add.container(x + 22, y - 44).setDepth(this.D_HUD - 12).setVisible(false);
      const bg = this.add.graphics();
      bg.fillStyle(PAL.ink, 1).fillCircle(0, 0, 17);
      bg.fillStyle(PAL.cream, 1).fillCircle(0, 0, 14);
      const ic = this.add.image(0, 0, "ico_water").setScale(2);
      bubble.add([bg, ic]);
      this.tweens.add({ targets: bubble, y: bubble.y - 6, duration: 520 + i * 17, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      g.plots.push({ bed, plant, bubble, ic });
    }
    for (let r = 0; r < 3; r++) this._solid(GX, GY + (r - 1) * ROW, 3 * COL - 8, 16);
    // Ruína enquanto a Horta não aparece
    g.ruin = shown ? null : this.add.image(GX, GY + 30, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(GY + 30);
    this.buildings.garden = {
      x: GX,
      y: GY + 60,
      img: null,
      ruin: g.ruin,
      shown,
      dot: this._notifyDot(GX + 1.5 * COL + 20, GY - 1.5 * ROW - 40).setDepth(this.D_HUD - 10).setVisible(false),
      reveal: () => this.tweens.add({ targets: [...g.fence, ...g.plots.map((p) => p.bed)], alpha: 1, duration: 700, delay: 300 }),
    };
    this._addInteract({
      x: GX,
      y: GY - 1.5 * ROW - 20,
      top: GY - 1.5 * ROW - 60,
      r: 150,
      name: "HORTA",
      verb: "HORTA",
      ruinOf: "garden",
      build: "garden",
      action: () => (this.buildings.garden.shown ? this._showGarden() : this._say("Cure a floresta jogando partidas para revelar o que há aqui.")),
    });
    this._refreshGardenWorld();
  },

  // Atualiza o que se vê no mapa (chamado a cada meio segundo)
  _refreshGardenWorld() {
    const g = this.gardenGfx;
    if (!g) return;
    const shown = this.buildings.garden.shown;
    const gd = this.garden;
    const now = Date.now();
    let attention = 0;
    g.plots.forEach((v, i) => {
      const open = i < gd.open;
      v.bed.setTexture(open ? "garden_plot" : "garden_locked");
      const p = open ? gd.plots[i] : null;
      const st = open ? gd.state(i, now) : "empty";
      v.plant.setVisible(shown && !!p);
      if (p) v.plant.setTexture(`crop_${p.crop}`, gd.stage(p));
      const need = st === "need" ? gd.need(p).type : null;
      v.bubble.setVisible(shown && (need || st === "ripe"));
      if (need) v.ic.setTexture(NEED_ICON[need]);
      else if (st === "ripe") v.ic.setTexture(cropIcon(p.crop));
      if (need || st === "ripe") attention++;
    });
    this.buildings.garden.dot.setVisible(shown && !attention && gd.plots.some((p, i) => i < gd.open && !p) && this._gardenCanPlant());
  },

  _gardenCanPlant() {
    return this.garden.available().length > 0;
  },

  // ---------------------------------------------------------------------------
  // PAINEL DA HORTA
  // ---------------------------------------------------------------------------
  _showGarden() {
    const gd = this.garden;
    gd.update();
    const m = new Modal(this, {
      title: `HORTA · NÍVEL ${this.builds.level("garden")}`,
      subtitle: "Plante, cuide e colha · nada morre, mas cuidar em dia dá mais qualidade",
      w: 940,
      h: 600,
      onClose: () => {
        timer.remove();
        this.input.off("pointerup", clearDrag);
        this._refreshGardenWorld();
        this._refreshAll();
      },
    });
    const W = m.w,
      H = m.h;
    // Grade 3×3 à esquerda
    const TW = 156,
      TH = 130,
      GAP = 10;
    const gx0 = -W / 2 + 30,
      gy0 = m.top + 8;
    const tiles = [];
    let dragAct = null;
    const clearDrag = () => (dragAct = null);
    this.input.on("pointerup", clearDrag);

    const act = (i, only) => {
      const st = gd.state(i);
      if (st === "need" && (!only || only === "care")) {
        const type = gd.care(i);
        if (type) this._gardenFx(tiles[i], "care", type);
        return "care";
      }
      if (st === "ripe" && (!only || only === "harvest")) {
        const r = gd.harvest(i);
        if (r) this._gardenFx(tiles[i], "harvest", r);
        if (r && this.meta.data.stats.harvests === 1) setTip("Plante de novo! Agora leva alguns minutos: jogue uma partida e volte.");
        return "harvest";
      }
      if (only) return null;
      if (st === "empty" && i < gd.open) {
        if (gd.available().length) this._showSeedPicker(i, () => drawAll());
        else setTip("Sem sementes disponíveis agora.");
        return null;
      }
      if (st === "growing") setTip(`${GARDEN.CROPS[gd.plots[i].crop].name}: pronta em ${fmtDuration(gd.remainingMs(gd.plots[i]))}`);
      if (i >= gd.open) setTip("Melhore a Horta com o João-de-barro para abrir mais canteiros.");
      return null;
    };

    for (let i = 0; i < 9; i++) {
      const tx = gx0 + (i % 3) * (TW + GAP),
        ty = gy0 + Math.floor(i / 3) * (TH + GAP);
      const c = this.add.container(tx, ty);
      const frame = this.add.graphics();
      const bed = this.add.image(TW / 2, TH / 2 + 8, "garden_plot").setScale(5);
      const plant = this.add.sprite(TW / 2, TH / 2 + 26, "crop_carrot", 0).setOrigin(0.5, 1).setScale(4);
      const label = text(this, TW / 2, TH - 15, "", { size: 16, origin: 0.5, stroke: true });
      const need = this.add.image(TW - 28, 28, "ico_water").setScale(3);
      const bar = this.add.graphics();
      c.add([frame, bed, plant, need, bar, label]);
      this.tweens.add({ targets: need, y: 20, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      // scrollFactor 0 também no filho: o teste de toque usa o do próprio objeto
      const zone = this.add.zone(TW / 2, TH / 2, TW, TH).setScrollFactor(0).setInteractive({ useHandCursor: true });
      c.add(zone);
      zone.on("pointerdown", () => {
        haptic(10);
        dragAct = act(i);
      });
      zone.on("pointerover", (p) => {
        if (p.isDown && dragAct) act(i, dragAct);
      });
      m.add(c);
      tiles.push({ c, frame, bed, plant, label, need, bar, x: tx, y: ty, w: TW, h: TH });
    }

    // Coluna da direita: celeiro + sementes raras + dica
    const rx = gx0 + 3 * (TW + GAP) + 12,
      rw = W / 2 - 30 - rx;
    const side = this.add.graphics();
    drawFrame(side, rx, gy0, rw, 3 * TH + 2 * GAP, "dark", { noRivets: true });
    m.add(side);
    m.add(text(this, rx + rw / 2, gy0 + 22, "CELEIRO", { size: 20, color: CSS.goldHi, origin: 0.5 }));
    const store = this.add.container(0, 0);
    m.add(store);
    const tip = text(this, rx + rw / 2, gy0 + 3 * TH + 2 * GAP - 56, "", { size: 15, color: CSS.muted, origin: 0.5, align: "center", wrap: rw - 24 });
    m.add(tip);
    let tipUntil = 0;
    const setTip = (s) => {
      tip.setText(s).setColor(CSS.txt);
      tipUntil = Date.now() + 4500;
    };
    this._gardenStoreAnchor = { x: rx + rw / 2, y: gy0 + 22 };

    // Botão: repetir a última semente nos canteiros vazios
    const repeatBtn = new Button(this, 0, H / 2 - 42, 380, 50, "", () => {
      const crop = this.meta.data.lastSeed;
      let n = 0;
      for (let i = 0; i < gd.open; i++) if (!gd.plots[i] && gd.plant(i, crop)) n++;
      if (n) {
        this.sound.play("sfx_pickup", { volume: 0.5, rate: 0.7 });
        haptic(20);
        drawAll();
      }
    }, { size: 18, style: "green" }).setScrollFactor(0);
    m.add(repeatBtn);

    const drawStore = () => {
      store.removeAll(true);
      const d = this.meta.data;
      const items = Object.keys(GARDEN.CROPS).filter((id) => pantryCount(d, id) > 0);
      let y = gy0 + 54;
      if (!items.length) {
        store.add(text(this, rx + rw / 2, y + 10, "Vazio — colha algo!", { size: 15, color: CSS.dim, origin: 0.5 }));
        y += 28;
      }
      for (const id of items) {
        const q = d.pantry[id];
        store.add(this.add.image(rx + 26, y + 10, cropIcon(id)).setScale(2.2));
        store.add(text(this, rx + 48, y + 10, GARDEN.CROPS[id].name, { size: 15, origin: [0, 0.5] }));
        const parts = q.map((n, k) => (n ? { n, k } : null)).filter(Boolean);
        let x = rx + rw - 14;
        for (const { n, k } of parts.reverse()) {
          const t = text(this, x, y + 10, String(n), { size: 16, color: Q_COLOR[k], origin: [1, 0.5], stroke: true });
          store.add(t);
          store.add(this._qualityPip(x - t.width - 9, y + 10, k));
          x -= t.width + 24;
        }
        y += 28;
      }
      const seeds = Object.entries(d.seeds || {}).filter(([, n]) => n > 0);
      if (seeds.length) {
        y += 8;
        store.add(text(this, rx + rw / 2, y + 8, "SEMENTES RARAS", { size: 16, color: CSS.goldHi, origin: 0.5 }));
        y += 28;
        for (const [id, n] of seeds) {
          store.add(this.add.image(rx + 26, y + 10, "ico_seed").setScale(2));
          store.add(text(this, rx + 48, y + 10, GARDEN.CROPS[id].name, { size: 15, origin: [0, 0.5] }));
          store.add(text(this, rx + rw - 14, y + 10, `×${n}`, { size: 16, color: CSS.goldHi, origin: [1, 0.5], stroke: true }));
          y += 28;
        }
      }
    };

    // Legenda das qualidades (rodapé do celeiro)
    const legend = this.add.container(0, gy0 + 3 * TH + 2 * GAP - 18);
    let lx = 0;
    GARDEN.QUALITY.forEach((name, k) => {
      legend.add(this._qualityPip(lx + 7, 0, k));
      const t = text(this, lx + 18, 0, name, { size: 14, color: Q_COLOR[k], origin: [0, 0.5] });
      legend.add(t);
      lx += t.width + 40;
    });
    legend.x = rx + rw / 2 - (lx - 22) / 2;
    m.add(legend);

    const drawTile = (t, i, now) => {
      const open = i < gd.open;
      const p = open ? gd.plots[i] : null;
      const st = open ? gd.state(i, now) : "locked";
      t.frame.clear();
      drawFrame(t.frame, 0, 0, t.w, t.h, st === "ripe" ? "green" : st === "need" ? "gold" : st === "locked" ? "disabled" : "button", { noRivets: true });
      t.bed.setTexture(open ? "garden_plot" : "garden_locked");
      t.plant.setVisible(!!p);
      if (p) t.plant.setTexture(`crop_${p.crop}`, gd.stage(p));
      t.need.setVisible(st === "need");
      if (st === "need") t.need.setTexture(NEED_ICON[gd.need(p).type]);
      t.bar.clear();
      if (st === "growing" || st === "need") {
        const f = Math.min(1, p.grown / p.dur);
        t.bar.fillStyle(PAL.ink, 1).fillRect(24, t.h - 20, t.w - 48, 9);
        t.bar.fillStyle(st === "need" ? PAL.yel1 : PAL.g5, 1).fillRect(27, t.h - 17, (t.w - 54) * f, 3);
      }
      if (st === "locked") t.label.setText(`HORTA NV ${GARDEN.PLOTS.findIndex((n) => n > i)}`).setColor(CSS.dim);
      else if (st === "empty") t.label.setText("PLANTAR").setColor(CSS.goldHi);
      else if (st === "ripe") t.label.setText(`COLHER · ${GARDEN.QUALITY[gd.quality(p, now)].toUpperCase()}`).setColor(Q_COLOR[gd.quality(p, now)]);
      else t.label.setText("");
    };

    const drawAll = () => {
      const now = Date.now();
      tiles.forEach((t, i) => drawTile(t, i, now));
      drawStore();
      const crop = this.meta.data.lastSeed;
      const empty = gd.plots.filter((p) => !p).length;
      const ok = crop && empty > 0 && gd.available().includes(crop);
      repeatBtn.setVisible(!!ok);
      if (ok) repeatBtn.setLabel(`PLANTAR ${GARDEN.CROPS[crop].name.toUpperCase()} NOS VAZIOS`);
      if (Date.now() > tipUntil) tip.setText(this._gardenTip()).setColor(CSS.muted);
    };
    this._gardenRedraw = drawAll;
    drawAll();
    const timer = this.time.addEvent({ delay: 500, loop: true, callback: drawAll });
  },

  // Bolinha da cor da qualidade (comum, prata, ouro)
  _qualityPip(x, y, q) {
    const g = this.add.graphics();
    g.fillStyle(PAL.ink, 1).fillCircle(x, y, 7);
    g.fillStyle([PAL.n3, PAL.s4, PAL.yel2][q], 1).fillCircle(x, y, 5);
    g.fillStyle(PAL.white, 0.6).fillRect(x - 3, y - 3, 2, 2);
    return g;
  },

  // Dica curta do momento (1 linha, sem manual)
  _gardenTip() {
    const gd = this.garden;
    const sts = [];
    for (let i = 0; i < gd.open; i++) sts.push(gd.state(i));
    if (sts.includes("ripe")) return "Toque (ou arraste o dedo) para colher.";
    if (sts.includes("need")) {
      const i = sts.indexOf("need");
      return GARDEN.NEEDS[gd.need(gd.plots[i]).type];
    }
    if (sts.includes("empty")) return "Toque num canteiro vazio para plantar.";
    return "Tudo crescendo. Que tal uma partida enquanto isso?";
  },

  // Escolher a semente para o canteiro i
  _showSeedPicker(i, onDone) {
    const gd = this.garden;
    const m = new Modal(this, { title: "PLANTAR", subtitle: "Curtas para agora, longas para quando for dormir", w: 720, h: 560 });
    const list = this._modalList(m);
    for (const id of gd.available()) {
      const c = GARDEN.CROPS[id];
      const seeds = this.meta.data.seeds[id] || 0;
      list.addRow(
        this._shopRow({
          icon: cropIcon(id),
          name: c.name,
          nameColor: c.rare ? CSS.goldHi : CSS.txt,
          desc: `${fmtDuration(c.s * 1000)} para crescer · colhe ${c.yield}${c.rare ? ` · semente rara ×${seeds}` : ""}`,
          right: "PLANTAR",
          style: c.rare ? "gold" : "button",
          onTap: () => {
            if (!gd.plant(i, id)) return;
            this.meta.data.lastSeed = id;
            this.meta._save();
            this.sound.play("sfx_pickup", { volume: 0.5, rate: 0.7 });
            haptic(20);
            Analytics.track("garden_plant", { crop: id });
            m.close();
            onDone?.();
          },
        }),
      );
    }
  },

  // Efeitos de cuidar/colher dentro do painel
  _gardenFx(t, kind, r) {
    const m = this._modals[this._modals.length - 1];
    if (!m) return;
    const cx = t.x + t.w / 2,
      cy = t.y + t.h / 2;
    if (kind === "care") {
      this.sound.play("sfx_pickup", { volume: 0.45, rate: r === "water" ? 0.8 : 1.1 });
      haptic(15);
      const tint = { water: PAL.ice2, weed: PAL.g5, pest: PAL.g4 }[r];
      for (let k = 0; k < 10; k++) {
        const d = this.add.image(cx, cy, "px_dot2").setScale(3).setTint(tint);
        m.add(d);
        const a = Math.random() * Math.PI * 2;
        this.tweens.add({ targets: d, x: cx + Math.cos(a) * 50, y: cy + Math.sin(a) * 40 - 20, alpha: 0, duration: 500, onComplete: () => d.destroy() });
      }
    } else {
      this.sound.play("sfx_coin", { volume: 0.5, rate: 0.9 + r.q * 0.1 });
      haptic(25);
      const ic = this.add.image(cx, cy, cropIcon(r.crop)).setScale(3);
      m.add(ic);
      const a = this._gardenStoreAnchor;
      this.tweens.add({ targets: ic, x: a.x, y: a.y, scale: 1.5, duration: 520, ease: "Cubic.easeIn", onComplete: () => ic.destroy() });
      const lbl = text(this, cx, cy - 20, `+${r.n} ${GARDEN.CROPS[r.crop].name} · ${GARDEN.QUALITY[r.q]}`, { size: 18, color: Q_COLOR[r.q], origin: 0.5, stroke: true });
      m.add(lbl);
      this.tweens.add({ targets: lbl, y: cy - 60, alpha: 0, duration: 1100, onComplete: () => lbl.destroy() });
      Analytics.track("garden_harvest", { crop: r.crop, q: r.q });
    }
    this._gardenRedraw?.();
  },
};
