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
import { tr } from "../i18n/i18n.js";

const S = GAME.PIXEL_SCALE;
const KX = 310,
  KY = 460;

export const CampKitchen = {
  _kitchenWorld() {
    const shown = this._isShown("kitchen");
    const shadow = this.add.image(KX, KY + 4, "px_shadow").setScale(8, 4).setAlpha(shown ? 0.55 : 0).setDepth(KY - 1);
    const img = this.add.image(KX, KY, "camp_kitchen").setOrigin(0.5, 1).setScale(S).setDepth(KY).setAlpha(shown ? 1 : 0);
    this._solid(KX - 8, KY - 14, img.displayWidth * 0.7, 30);
    const glow = this._glow(KX - 28, KY - 21, 1.8, 0xff8a3c, true).setVisible(shown);
    const ruin = shown ? null : this.add.image(KX, KY, "camp_ruin").setOrigin(0.5, 1).setScale(S).setDepth(KY);
    // Fumacinha da chaminé
    this.time.addEvent({
      delay: 380,
      loop: true,
      callback: () => {
        if (!this.buildings.kitchen.shown) return;
        const p = this.add.image(KX + 34 + (Math.random() - 0.5) * 6, KY - img.displayHeight, "px_puff").setScale(1.6).setTint(0x9aa0a8).setAlpha(0.5).setDepth(KY + 1);
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
      name: tr("COZINHA"),
      verb: tr("COZINHAR"),
      ruinOf: "kitchen",
      action: () => (this.buildings.kitchen.shown ? this._showKitchen() : this._say(tr("Cure a floresta jogando partidas para revelar o que há aqui."))),
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
    const m = new Modal(this, { title: tr("COZINHA"), subtitle: tr("Coma um prato antes de partir: o bônus vale só na próxima partida"), w: 880, h: 620 });
    const list = this._modalList(m);
    const reopen = () => {
      const y = list.scroll;
      m.close();
      this._refreshAll();
      this._showKitchen();
      this._modals.at(-1)?.list?.setScroll(y);
    };
    // O que já comeu (vale na próxima partida)
    this._section(list, tr("PRÓXIMA PARTIDA"));
    if (d.meal) {
      const r = recipe(d.meal.id);
      list.addRow(
        this._shopRow({
          icon: dishIconKey(r.id),
          name: tr("Você comeu: {0} · {1}", r.name, GARDEN.QUALITY[d.meal.q]),
          nameColor: CSS.goldHi,
          desc: bonusText(r, d.meal.q),
          right: tr("BARRIGA CHEIA"),
          rightColor: CSS.green,
          style: "green",
        }),
      );
    } else list.addRow({ h: 40, build: (c, w) => c.add(text(this, w / 2, 20, tr("Você ainda não comeu — cozinhe e coma um prato antes de partir"), { size: 16, color: CSS.dim, origin: 0.5 })) });
    // Pratos prontos (cozinhados e guardados)
    const ready = [];
    for (const [id, row] of Object.entries(d.dishes || {})) row.forEach((n, q) => n > 0 && ready.push({ id, q, n }));
    if (ready.length) {
      this._section(list, tr("PRATOS PRONTOS"));
      for (const { id, q, n } of ready.sort((a, b) => b.q - a.q)) {
        const r = recipe(id);
        list.addRow(
          this._shopRow({
            icon: dishIconKey(id),
            name: `${r.name} · ${GARDEN.QUALITY[q]}  ×${n}`,
            desc: bonusText(r, q),
            right: d.meal ? tr("JÁ COMEU") : tr("COMER"),
            rightColor: d.meal ? CSS.dim : CSS.goldHi,
            style: d.meal ? "dark" : "button",
            onTap: d.meal
              ? null
              : () => {
                  if (!k.eat(id, q)) return;
                  this.sound.play("sfx_pickup", { volume: 0.5, rate: 0.9 });
                  haptic(20);
                  this._toast(tr("Hum! {0}: vale na próxima partida", r.name));
                  Analytics.track("meal_eat", { id, q });
                  reopen();
                },
          }),
        );
      }
    }
    // Receitas
    this._section(list, tr("RECEITAS"));
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
          right: can ? tr("COZINHAR") : tr("FALTA"),
          rightColor: can ? CSS.goldHi : CSS.dim,
          style: can ? "gold" : "dark",
          onTap: can
            ? () => {
                const res = k.cook(r.id);
                if (!res) return;
                this._dailyBump?.("cook");
                this._buyFx();
                Analytics.track("kitchen_cook", { id: r.id, q: res.q });
                this._toast(tr("{0} ({1}) pronto!{2}", r.name, GARDEN.QUALITY[res.q], d.meal ? "" : tr(" Coma antes de partir")));
                reopen();
              }
            : null,
        }),
      );
    }
  },

  // Na boca da trilha, sem prato ativo: "Levar um prato?". Com prato pronto, um toque come e parte; sem prato
  // pronto mas com o que cozinhar, leva à cozinha. Uma vez por visita à Clareira e nunca com prato ativo (o "!" da
  // cozinha sozinho passava batido). Devolve true se abriu a janela (a partida espera a escolha)
  _mealPrompt() {
    const d = this.meta.data;
    const k = this.kitchen;
    if (this._mealAsked || d.meal || !k || !this.buildings.kitchen?.shown) return false;
    const ready = [];
    for (const [id, row] of Object.entries(d.dishes || {})) row.forEach((n, q) => n > 0 && recipe(id) && ready.push({ id, q, n }));
    const cookable = ready.length ? [] : k.known().filter((r) => k.canCook(r));
    if (!ready.length && !cookable.length) return false;
    this._mealAsked = true;
    Analytics.track("meal_prompt", { ready: ready.length, cookable: cookable.length });
    const m = new Modal(this, {
      title: tr("LEVAR UM PRATO?"),
      subtitle: ready.length ? tr("O bônus do prato vale só nesta partida") : tr("Dá para cozinhar antes de partir: o bônus vale só nesta partida"),
      w: 820,
      h: 560,
    });
    const list = this._modalList(m);
    if (ready.length) {
      for (const { id, q, n } of ready.sort((a, b) => b.q - a.q).slice(0, 4)) {
        const r = recipe(id);
        list.addRow(
          this._shopRow({
            icon: dishIconKey(id),
            name: `${r.name} · ${GARDEN.QUALITY[q]}  ×${n}`,
            desc: bonusText(r, q),
            right: tr("COMER E PARTIR"),
            rightColor: CSS.goldHi,
            style: "button",
            onTap: () => {
              if (!k.eat(id, q)) return;
              this.sound.play("sfx_pickup", { volume: 0.5, rate: 0.9 });
              haptic(20);
              Analytics.track("meal_eat", { id, q, from: "trail" });
              m.close();
              this._play();
            },
          }),
        );
      }
    } else {
      for (const r of cookable.slice(0, 3))
        list.addRow(
          this._shopRow({
            icon: dishIconKey(r.id),
            name: r.name,
            desc: bonusText(r),
            right: tr("COZINHAR"),
            rightColor: CSS.goldHi,
            style: "gold",
            onTap: () => {
              m.close();
              this._showKitchen();
            },
          }),
        );
    }
    list.addRow(
      this._shopRow({
        name: tr("PARTIR SEM COMER"),
        nameColor: CSS.muted,
        desc: ready.length ? tr("O prato fica guardado para outra partida") : tr("Os ingredientes ficam no celeiro"),
        style: "dark",
        onTap: () => {
          Analytics.track("meal_prompt_skip", { ready: ready.length });
          m.close();
          this._play();
        },
      }),
    );
    m.fitToList();
    return true;
  },
};
