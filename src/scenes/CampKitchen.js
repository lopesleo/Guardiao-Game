// Cozinha na Clareira: fogão a lenha ao lado da horta. Escolher receita é
// naturalmente um menu, então aqui é painel: cozinhar (colheita → prato na
// pratos prontos) e comer UM prato antes da próxima partida.
// Mixin da CampScene (Object.assign): usa this.meta e this.kitchen.
import { GAME, GARDEN } from "../config.js";
import { recipe, bonusText, itemName } from "../systems/Kitchen.js";
import { pantryCount } from "../systems/Garden.js";
import { Analytics } from "../systems/Analytics.js";
import { CSS } from "../art/Palette.js";
import { dishIconKey } from "../art/Kitchen.js";
import { Modal } from "../ui/Widgets.js";
import { text, haptic } from "../ui/Theme.js";

const S = GAME.PIXEL_SCALE;
const KX = 310,
  KY = 460;

export const CampKitchen = {
  _kitchenWorld() {
    const shown = this._isShown("kitchen");
    const shadow = this.add.image(KX, KY + 4, "px_shadow").setScale(8, 4).setAlpha(shown ? 0.55 : 0).setDepth(KY - 1);
    const img = this.add.image(KX, KY, "camp_kitchen").setOrigin(0.5, 1).setScale(S).setDepth(KY).setAlpha(shown ? 1 : 0);
    this._solid(KX - 8, KY - 14, img.displayWidth * 0.7, 30);
    const glow = this._glow(KX - 30, KY - 16, 1.8, 0xff8a3c, true).setVisible(shown);
    const ruin = shown ? null : this.add.image(KX, KY, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(KY);
    // Fumacinha da chaminé
    this.time.addEvent({
      delay: 380,
      loop: true,
      callback: () => {
        if (!this.buildings.kitchen.shown) return;
        const p = this.add.image(KX + 18 + (Math.random() - 0.5) * 6, KY - img.displayHeight, "px_puff").setScale(1.6).setTint(0x9aa0a8).setAlpha(0.5).setDepth(KY + 1);
        this.tweens.add({ targets: p, y: p.y - 60, x: p.x + 14, scale: 3, alpha: 0, duration: 1800, onComplete: () => p.destroy() });
      },
    });
    this.buildings.kitchen = {
      img,
      shadow,
      glow,
      ruin,
      x: KX,
      y: KY,
      shown,
      dot: this._notifyDot(KX + img.displayWidth / 2 - 10, KY - img.displayHeight + 6).setDepth(this.D_HUD - 10).setVisible(false),
    };
    this._addInteract({
      x: KX,
      y: KY,
      top: KY - img.displayHeight,
      r: 120,
      name: "COZINHA",
      verb: "COZINHAR",
      ruinOf: "kitchen",
      action: () => (this.buildings.kitchen.shown ? this._showKitchen() : this._say("Cure a floresta jogando partidas para revelar o que há aqui.")),
    });
  },

  // "!" quando dá para cozinhar ou comer algo e ainda não comeu
  _refreshKitchenDot() {
    const b = this.buildings.kitchen;
    if (!b) return;
    const k = this.kitchen;
    b.dot.setVisible(b.shown && !this.meta.data.meal && (k.known().some((r) => k.canCook(r)) || k.dishCount() > 0));
  },

  _showKitchen() {
    const k = this.kitchen;
    const d = this.meta.data;
    const m = new Modal(this, { title: "COZINHA", subtitle: "Coma um prato antes de partir: o bônus vale só na próxima partida", w: 880, h: 620 });
    const list = this._modalList(m);
    const reopen = () => {
      const y = list.scroll;
      m.close();
      this._refreshAll();
      this._showKitchen();
      this._modals.at(-1)?.list?.setScroll(y);
    };
    // O que já comeu (vale na próxima partida)
    this._section(list, "PRÓXIMA PARTIDA");
    if (d.meal) {
      const r = recipe(d.meal.id);
      list.addRow(
        this._shopRow({
          icon: dishIconKey(r.id),
          name: `Você comeu: ${r.name} · ${GARDEN.QUALITY[d.meal.q]}`,
          nameColor: CSS.goldHi,
          desc: bonusText(r, d.meal.q),
          right: "BARRIGA CHEIA",
          rightColor: CSS.green,
          style: "green",
        }),
      );
    } else list.addRow({ h: 40, build: (c, w) => c.add(text(this, w / 2, 20, "Você ainda não comeu — cozinhe e coma um prato antes de partir", { size: 16, color: CSS.dim, origin: 0.5 })) });
    // Pratos prontos (cozinhados e guardados)
    const ready = [];
    for (const [id, row] of Object.entries(d.dishes || {})) row.forEach((n, q) => n > 0 && ready.push({ id, q, n }));
    if (ready.length) {
      this._section(list, "PRATOS PRONTOS");
      for (const { id, q, n } of ready.sort((a, b) => b.q - a.q)) {
        const r = recipe(id);
        list.addRow(
          this._shopRow({
            icon: dishIconKey(id),
            name: `${r.name} · ${GARDEN.QUALITY[q]}  ×${n}`,
            desc: bonusText(r, q),
            right: d.meal ? "JÁ COMEU" : "COMER",
            rightColor: d.meal ? CSS.dim : CSS.goldHi,
            style: d.meal ? "dark" : "button",
            onTap: d.meal
              ? null
              : () => {
                  if (!k.eat(id, q)) return;
                  this.sound.play("sfx_pickup", { volume: 0.5, rate: 0.9 });
                  haptic(20);
                  this._toast(`Hum! ${r.name}: vale na próxima partida`);
                  Analytics.track("meal_eat", { id, q });
                  reopen();
                },
          }),
        );
      }
    }
    // Receitas
    this._section(list, "RECEITAS");
    for (const r of k.known()) {
      const can = k.canCook(r);
      const ing = Object.entries(r.needs)
        .map(([id, n]) => `${n} ${itemName(id)} (${pantryCount(d, id)})`)
        .join(" + ");
      list.addRow(
        this._shopRow({
          icon: dishIconKey(r.id),
          dim: !can,
          name: r.name,
          nameColor: can ? CSS.txt : CSS.muted,
          desc: `${bonusText(r)} · ${ing}`,
          right: can ? "COZINHAR" : "FALTA",
          rightColor: can ? CSS.goldHi : CSS.dim,
          style: can ? "gold" : "dark",
          onTap: can
            ? () => {
                const res = k.cook(r.id);
                if (!res) return;
                this._buyFx();
                Analytics.track("kitchen_cook", { id: r.id, q: res.q });
                this._toast(`${r.name} (${GARDEN.QUALITY[res.q]}) pronto!${d.meal ? "" : " Coma antes de partir"}`);
                reopen();
              }
            : null,
        }),
      );
    }
  },
};
