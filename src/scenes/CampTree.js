// Roleta da Samaúma: por anúncio premiado (opcional), a árvore gigante sorteia UMA bênção
// para a próxima partida. Recarrega de hora em hora (relógio confiável, Clock). Só uma
// bênção guardada por vez: usou na partida, pode girar de novo quando a árvore descansar.
// Aparece depois do Baú do Dia (uma novidade por vez). Mixin da CampScene (Object.assign).
import { TREE } from "../config.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { Clock } from "../systems/Clock.js";
import { fmtDuration } from "../systems/Builds.js";
import { PAL, CSS } from "../art/Palette.js";
import { text, Button, haptic } from "../ui/Theme.js";
import { Modal } from "../ui/Widgets.js";

const TX = -250,
  TY = -250; // pé da Samaúma (CampDecor)
const R = 168; // raio da roleta
const N = TREE.SLICES.length;
const STEP = 360 / N;

const slice = (id) => TREE.SLICES.find((s) => s.id === id);

export const CampTree = {
  // Estado da árvore: "pending" (bênção guardada), "rest" (descansando) ou "ready"
  _treeState() {
    const d = this.meta.data;
    if (slice(d.treeBuff)) return { kind: "pending", buff: slice(d.treeBuff) };
    const left = (d.treeSpinAt || 0) + TREE.COOLDOWN_MIN * 60000 - Clock.now();
    if (left > 0) return { kind: "rest", left };
    return { kind: "ready" };
  },

  _treeWorld() {
    const shown = this._isShown("tree");
    // Brilho na copa enquanto a árvore pode abençoar
    const glow = this.add.image(TX, TY - 190, "fx_glow").setScale(4.2).setTint(0xd8ffb0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(50001);
    this.tweens.add({ targets: glow, scale: 4.8, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const dot = this._notifyDot(TX + 70, TY - 300).setDepth(this.D_HUD - 10).setVisible(false);
    this.buildings.tree = { x: TX, y: TY, shown, glow, dot, reveal: () => this._refreshTree() };
    this._addInteract({ x: TX, y: TY, top: TY - 300, r: 125, name: "SAMAÚMA", verb: "BÊNÇÃO", hiddenUntil: "tree", action: () => this._showTree() });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this._refreshTree() });
    this._refreshTree();
  },

  _refreshTree() {
    const b = this.buildings.tree;
    if (!b) return;
    const ready = b.shown && this._treeState().kind === "ready" && AdService.canShow("tree_spin");
    b.glow.setAlpha(ready ? 0.42 : 0);
    b.dot.setVisible(ready);
  },

  _showTree() {
    const m = new Modal(this, { title: "SAMAÚMA", subtitle: "A mãe da mata abençoa a sua próxima partida", w: 640, h: 640 });
    const cy = m.top + R + 34;

    // Roleta: fatias da paleta, contorno de tinta, rótulo em 2 linhas
    const wheel = this.add.container(0, cy);
    const g = this.add.graphics();
    g.fillStyle(PAL.ink, 1).fillCircle(0, 0, R + 12);
    g.fillStyle(PAL.n2, 1).fillCircle(0, 0, R + 8);
    TREE.SLICES.forEach((s, i) => {
      const a0 = Phaser.Math.DegToRad(-90 + i * STEP - STEP / 2),
        a1 = Phaser.Math.DegToRad(-90 + i * STEP + STEP / 2);
      g.fillStyle(s.color, 1).slice(0, 0, R, a0, a1, false).fillPath();
      // metade de dentro mais escura: dá volume sem gradiente
      g.fillStyle(PAL.ink, 0.18).slice(0, 0, R * 0.55, a0, a1, false).fillPath();
      g.lineStyle(4, PAL.ink, 1).lineBetween(0, 0, Math.cos(a0) * R, Math.sin(a0) * R);
    });
    g.lineStyle(4, PAL.ink, 1).strokeCircle(0, 0, R);
    wheel.add(g);
    TREE.SLICES.forEach((s, i) => {
      const a = Phaser.Math.DegToRad(-90 + i * STEP);
      const [top, ...rest] = s.label.split(" ");
      const t = text(this, Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, `${top}\n${rest.join(" ")}`, { size: 16, color: CSS.ink, origin: 0.5, align: "center", shadow: false });
      t.setRotation(a + Math.PI / 2);
      wheel.add(t);
    });
    // Luzinhas na borda (piscam alternadas)
    const bulbs = [];
    for (let k = 0; k < N * 2; k++) {
      const a = Phaser.Math.DegToRad(k * (STEP / 2));
      const bl = this.add.image(Math.cos(a) * (R + 4), Math.sin(a) * (R + 4), "px_dot2").setScale(2.5).setTint(k % 2 ? PAL.yel3 : PAL.cream);
      bulbs.push(bl);
      wheel.add(bl);
    }
    m.add(wheel);
    let blink = 0;
    const blinkEv = this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        if (!wheel.active) return blinkEv.remove();
        blink ^= 1;
        bulbs.forEach((bl, k) => bl.setAlpha((k + blink) % 2 ? 1 : 0.35));
      },
    });
    // Miolo (não gira) e ponteiro no topo
    const hub = this.add.graphics();
    hub.fillStyle(PAL.ink, 1).fillCircle(0, cy, 30);
    hub.fillStyle(PAL.uiGold, 1).fillCircle(0, cy, 25);
    hub.fillStyle(PAL.uiGoldHi, 1).fillCircle(-6, cy - 6, 9);
    hub.fillStyle(PAL.ink, 1).fillTriangle(-20, cy - R - 26, 20, cy - R - 26, 0, cy - R + 14);
    hub.fillStyle(PAL.uiGoldHi, 1).fillTriangle(-14, cy - R - 22, 14, cy - R - 22, 0, cy - R + 6);
    m.add(hub);

    const status = m.add(text(this, 0, cy + R + 40, "", { size: 19, color: CSS.txt, origin: 0.5, align: "center", wrap: m.w - 60 }));
    const btn = m.add(new Button(this, 0, m.h / 2 - 50, 300, 54, "GIRAR", () => this._spinTree(m, wheel, status, btn, refresh), { size: 20, style: "primary", color: CSS.goldHi, icon: "ico_play", iconScale: 2 }));
    let spinning = false;
    const refresh = (isSpinning = spinning) => {
      spinning = isSpinning;
      if (!status.active || spinning) return;
      const st = this._treeState();
      const canAd = AdService.canShow("tree_spin");
      if (st.kind === "pending") status.setText(`Bênção guardada: ${st.buff.short}\nVale na próxima partida`).setColor(CSS.goldHi);
      else if (st.kind === "rest") status.setText(`A Samaúma descansa. Nova bênção em ${fmtDuration(st.left)}`).setColor(CSS.muted);
      else if (!canAd) status.setText("Sem anúncio disponível agora. Tente mais tarde.").setColor(CSS.muted);
      else status.setText(`Assista a um anúncio e gire: uma bênção para a próxima partida\nRecarrega a cada ${TREE.COOLDOWN_MIN} min`).setColor(CSS.txt);
      btn.setEnabled(st.kind === "ready" && canAd);
    };
    refresh();
    const ev = this.time.addEvent({ delay: 1000, loop: true, callback: () => (status.active ? refresh() : ev.remove()) });
    Analytics.track("tree_open", { state: this._treeState().kind });
  },

  async _spinTree(m, wheel, status, btn, refresh) {
    if (this._treeState().kind !== "ready" || this._treeBusy) return;
    this._treeBusy = true;
    btn.setEnabled(false);
    const ok = await AdService.rewarded("tree_spin");
    this._treeBusy = false;
    if (!ok) return status.active && refresh();
    // Sorteia e grava JÁ (fechar a janela no meio do giro não perde a bênção)
    const k = Math.floor(Math.random() * N);
    const won = TREE.SLICES[k];
    const d = this.meta.data;
    d.treeBuff = won.id;
    d.treeSpinAt = Clock.now();
    d.stats.treeSpins = (d.stats.treeSpins || 0) + 1;
    this.meta._save();
    Analytics.track("tree_spin", { id: won.id });
    this._refreshTree();
    if (!wheel.active) return this._toast(`Bênção da Samaúma: ${won.short}`);

    refresh(true);
    status.setText("").setColor(CSS.txt);
    // Fatia k para no ponteiro: ângulo final ≡ -k·STEP, com 5 voltas e um desvio dentro da fatia
    const cur = wheel.angle;
    const target = -k * STEP + (Math.random() - 0.5) * STEP * 0.6;
    const w = Phaser.Math.Angle.WrapDegrees(target - cur);
    const delta = 360 * 5 + (w < 0 ? w + 360 : w);
    let lastTick = Math.floor((cur + STEP / 2) / STEP);
    this.tweens.addCounter({
      from: cur,
      to: cur + delta,
      duration: 3600,
      ease: "Quart.easeOut",
      onUpdate: (tw) => {
        if (!wheel.active) return;
        const a = tw.getValue();
        wheel.angle = a;
        const tick = Math.floor((a + STEP / 2) / STEP);
        if (tick !== lastTick) {
          lastTick = tick;
          this.sound.play("sfx_ui_hover", { volume: 0.35, rate: 1.1 + Math.random() * 0.2 });
        }
      },
      onComplete: () => {
        if (!wheel.active) return this._toast(`Bênção da Samaúma: ${won.short}`);
        this.sound.play("sfx_chest_jackpot", { volume: 0.6 });
        haptic(50);
        // A fatia vencedora pisca no ponteiro
        const fl = this.add.graphics();
        const a0 = Phaser.Math.DegToRad(-90 + k * STEP - STEP / 2),
          a1 = Phaser.Math.DegToRad(-90 + k * STEP + STEP / 2);
        fl.fillStyle(PAL.white, 0.55).slice(0, 0, R, a0, a1, false).fillPath();
        wheel.addAt(fl, 1);
        fl.setScrollFactor(0);
        this.tweens.add({ targets: fl, alpha: 0.1, duration: 220, yoyo: true, repeat: 4 });
        for (let i = 0; i < 14; i++) {
          const p = this.add.image(0, wheel.y - R, "px_dot2").setScale(3).setTint(i % 2 ? won.color : PAL.yel3);
          m.add(p);
          const ang = -Math.PI * (0.1 + Math.random() * 0.8);
          this.tweens.add({ targets: p, x: Math.cos(ang) * (60 + Math.random() * 90), y: p.y + Math.sin(ang) * (40 + Math.random() * 70), alpha: 0, duration: 800, ease: "Cubic.easeOut", onComplete: () => p.destroy() });
        }
        refresh(false);
      },
    });
  },
};
