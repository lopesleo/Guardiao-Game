// Hábito diário na Clareira: aba MISSÕES no Mural, o Baú do Dia junto à
// fogueira e o presente de dias seguidos ao chegar. Só depois que o Mural
// apareceu (uma novidade por vez). Mixin da CampScene (Object.assign).
import { GAME, DAILY } from "../config.js";
import { Daily, dailyUnlocked, rewardText } from "../systems/Daily.js";
import { AdService } from "../systems/AdService.js";
import { PAL, CSS } from "../art/Palette.js";
import { text, drawFrame, Button, haptic } from "../ui/Theme.js";
import { Modal } from "../ui/Widgets.js";
import { fmtDuration } from "../systems/Builds.js";
import { Notify, NOTIFY_ID, tomorrowAt } from "../systems/Notify.js";
import { Clock } from "../systems/Clock.js";

const S = GAME.PIXEL_SCALE;
const CHEST_X = -64,
  CHEST_Y = -18; // no terreiro, a noroeste do fogo

export const CampDaily = {
  _daily() {
    return dailyUnlocked(this.meta.data) ? new Daily(this.meta) : null;
  },

  // Conta uma ação da Clareira nas missões (colher, pescar, cozinhar)
  _dailyBump(stat) {
    const d = this._daily();
    if (!d) return;
    for (const t of d.bump(stat)) this.time.delayedCall(400, () => this._toast(`Missão cumprida: ${t}`));
    this._refreshDailyDots();
  },

  // ---------------------------------------------------------------------------
  // BAÚ DO DIA
  // ---------------------------------------------------------------------------
  _dailyChestWorld() {
    const shown = this._isShown("chest");
    const shadow = this.add.image(CHEST_X, CHEST_Y + 4, "px_shadow").setScale(3.4, 2.4).setAlpha(shown ? 0.55 : 0).setDepth(CHEST_Y - 1);
    const img = this.add.sprite(CHEST_X, CHEST_Y, "obj_chest", 0).setOrigin(0.5, 1).setScale(S).setDepth(CHEST_Y).setAlpha(shown ? 1 : 0);
    const glow = this._glow(CHEST_X, CHEST_Y - 20, 1.3, 0xffe58f, true).setVisible(shown);
    this._solid(CHEST_X, CHEST_Y - 8, 44, 16);
    this.buildings.chest = { img, shadow, glow, x: CHEST_X, y: CHEST_Y, shown, dot: this._notifyDot(CHEST_X + 26, CHEST_Y - 60).setDepth(this.D_HUD - 10).setVisible(false) };
    this._addInteract({ x: CHEST_X, y: CHEST_Y, top: CHEST_Y - 50, r: 70, name: "BAÚ DO DIA", verb: "ABRIR", hiddenUntil: "chest", action: () => this._openDailyChest() });
    // Brilhinho subindo enquanto há presente
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        const d = this.buildings.chest.shown && this._daily();
        if (!d || !d.chestReady("free")) return;
        const s = this.add.image(CHEST_X + (Math.random() - 0.5) * 36, CHEST_Y - 20, "px_dot1").setScale(3).setTint(0xffe58f).setBlendMode(Phaser.BlendModes.ADD).setDepth(50002);
        this.tweens.add({ targets: s, y: s.y - 36, alpha: 0, duration: 900, onComplete: () => s.destroy() });
      },
    });
    this._refreshDailyChest();
  },

  _refreshDailyChest() {
    const b = this.buildings.chest;
    const d = b?.shown && this._daily();
    if (!b) return;
    const ready = !!d && d.chestReady("free");
    b.img.setFrame(ready ? 0 : 2);
    b.glow.setVisible(ready);
    b.dot.setVisible(ready);
  },

  _openDailyChest() {
    const d = this._daily();
    if (!d) return;
    if (!d.chestReady("free")) {
      if (d.chestReady("ad") && AdService.canShow("daily_chest")) {
        AdService.rewarded("daily_chest").then((ok) => ok && this._chestReward(d.openChest("ad")));
      } else this._say("A floresta deixa um presente por dia. Volte amanhã!");
      return;
    }
    this._chestReward(d.openChest("free"));
    // Aviso opcional para amanhã (pedido só aqui, no momento em que faz sentido)
    this.time.delayedCall(2600, () => this._offerNotify?.("chest"));
  },

  _chestReward(r) {
    if (!r) return;
    const b = this.buildings.chest;
    b.img.setFrame(1);
    this.time.delayedCall(140, () => b.img.setFrame(2));
    this.sound.play("sfx_chest_open", { volume: 0.7 });
    this.time.delayedCall(260, () => this.sound.play("sfx_coin_cascade", { volume: 0.5 }));
    haptic(40);
    for (let k = 0; k < 16; k++) {
      const c = this.add.sprite(b.x, b.y - 24, "px_coin", 0).setScale(S).setDepth(this.D_HUD - 7);
      const a = -Math.PI * (0.15 + Math.random() * 0.7);
      this.tweens.add({ targets: c, x: b.x + Math.cos(a) * (40 + Math.random() * 50), y: b.y - 24 + Math.sin(a) * (50 + Math.random() * 40), duration: 420, ease: "Cubic.easeOut" });
      this.tweens.add({ targets: c, alpha: 0, delay: 600, duration: 400, onComplete: () => c.destroy() });
    }
    this._toast(`Baú do dia: ${rewardText(r)}`);
    this._refreshDailyChest();
    this._refreshAll();
  },

  // ---------------------------------------------------------------------------
  // PRESENTE DE DIAS SEGUIDOS (ao chegar, se não houve revelação nesta visita)
  // ---------------------------------------------------------------------------
  _maybeStreak() {
    if (this._pending.length || this._cutscene || this._modals.length || this._leaving) return;
    // Relógio voltado para trás: a floresta explica, uma vez por visita
    if (Clock.frozenMs() > 10 * 60000) {
      this._say(`O tempo da floresta não anda para trás. Plantas, obras e presentes vão esperar o relógio alcançar (${fmtDuration(Clock.frozenMs())}).`);
      return;
    }
    const d = this._daily();
    const day = d?.streakPending();
    if (!day) return;
    this._showStreak(d, day);
  },

  _showStreak(d, day) {
    const m = new Modal(this, { title: `PRESENTE DO DIA ${day}`, subtitle: "Volte todo dia: o 7º dia é o maior presente", w: 900, h: 420, closable: false });
    const n = DAILY.STREAK.length;
    const bw = 108,
      gap = 12;
    const x0 = -((n * bw + (n - 1) * gap) / 2) + bw / 2;
    DAILY.STREAK.forEach((rw, i) => {
      const x = x0 + i * (bw + gap),
        y = -10;
      const past = i + 1 < day,
        now = i + 1 === day;
      const g = this.add.graphics();
      drawFrame(g, x - bw / 2, y - 70, bw, 140, now ? "gold" : past ? "green" : "dark", { noRivets: !now });
      m.add(g);
      m.add(text(this, x, y - 50, `DIA ${i + 1}`, { size: 17, color: now ? CSS.goldHi : past ? CSS.green : CSS.muted, origin: 0.5 }));
      const icon = rw.seeds ? "ico_seed" : rw.wood && !rw.coins ? "ico_wood" : "ico_coin";
      const ic = this.add.image(x, y - 6, icon).setScale(i === n - 1 ? 4.2 : 3.2);
      if (past) ic.setAlpha(0.5);
      m.add(ic);
      if (i === n - 1) this.tweens.add({ targets: ic, scale: 4.6, yoyo: true, repeat: -1, duration: 700, ease: "Sine.easeInOut" });
      const lines = rewardText(rw).split(" · ");
      m.add(text(this, x, y + 38, lines.join("\n"), { size: 13, color: past ? CSS.dim : CSS.txt, origin: 0.5, align: "center" }));
      if (past) m.add(this.add.image(x + 34, y - 52, "ico_check").setScale(2.2));
    });
    m.add(
      new Button(this, 0, 150, 300, 58, "PEGAR", () => {
        const r = d.claimStreak();
        m.close();
        if (!r) return;
        this._buyFx();
        this._toast(`Dia ${r.day}: ${rewardText(r)}`);
        this._refreshAll();
      }, { size: 24, style: "primary", color: CSS.goldHi }),
    );
  },

  // ---------------------------------------------------------------------------
  // MISSÕES (aba do Mural)
  // ---------------------------------------------------------------------------
  _fillMissions(list, reopen) {
    const d = this._daily();
    if (!d) return;
    const s = this.meta.data.streak;
    list.addRow({
      h: 34,
      build: (c, w) => c.add(text(this, w / 2, 16, `Dias seguidos: ${s?.count || 0}   ·   novas missões em ${fmtDuration(msToMidnight())}`, { size: 16, color: CSS.muted, origin: 0.5 })),
    });
    d.missions.forEach((m, i) => {
      const done = m.done;
      list.addRow({
        h: 84,
        onTap: done && !m.claimed ? () => {
          const r = d.claim(i);
          if (!r) return;
          this._buyFx();
          this._toast(`Missão: ${rewardText(r)}`);
          reopen();
        } : null,
        build: (c, w) => {
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, 84, m.claimed ? "green" : done ? "gold" : "dark", { noRivets: true });
          c.add(g);
          c.add(this.add.image(40, 42, m.claimed ? "ico_check" : m.def.camp ? "ico_sprout" : "ico_skull").setScale(3));
          c.add(text(this, 76, 26, m.text, { size: 20, color: m.claimed ? CSS.green : CSS.txt, origin: [0, 0.5] }));
          // barra de progresso
          const bw = w - 330;
          const bar = this.add.graphics();
          bar.fillStyle(PAL.ink, 1).fillRect(76, 50, bw, 12);
          bar.fillStyle(done ? PAL.g5 : PAL.yel2, 1).fillRect(79, 53, (bw - 6) * Math.min(1, m.p / m.n), 6);
          c.add(bar);
          c.add(text(this, 86 + bw, 56, `${m.p}/${m.n}`, { size: 16, color: CSS.muted, origin: [0, 0.5] }));
          const right = m.claimed ? "FEITO" : done ? `PEGAR  +${m.def.coins}` : `+${m.def.coins}`;
          const rt = text(this, w - 20, 42, right, { size: 20, color: m.claimed ? CSS.green : done ? CSS.goldHi : CSS.dim, origin: [1, 0.5], stroke: true });
          c.add(rt);
          if (!m.claimed) c.add(this.add.image(w - 34 - rt.width, 42, "ico_coin").setScale(2.4));
        },
      });
    });
    // Bônus das três
    const ready = d.bonusReady,
      got = this.meta.data.daily.bonus;
    list.addRow(
      this._shopRow({
        icon: "ico_chest",
        name: "COMPLETE AS TRÊS",
        nameColor: ready ? CSS.goldHi : got ? CSS.green : CSS.txt,
        desc: rewardText(DAILY.ALL_BONUS),
        right: got ? "FEITO" : ready ? "PEGAR" : "",
        rightColor: got ? CSS.green : CSS.goldHi,
        style: got ? "green" : ready ? "gold" : "dark",
        onTap: ready
          ? () => {
              const r = d.claimBonus();
              if (!r) return;
              this._buyFx();
              this._toast(`As três do dia: ${rewardText(r)}`);
              reopen();
            }
          : null,
      }),
    );
  },

  // "!" no Mural (missão para pegar) e no baú
  _refreshDailyDots() {
    const d = this._daily();
    const board = this.buildings.board;
    if (board) board.dot.setVisible(!!d && board.shown && d.claimable);
    this._refreshDailyChest();
  },
};

// Avisos opcionais: pergunta UMA vez, no momento em que faz sentido; depois
// só (re)agenda em silêncio. kind: "chest" (baú de amanhã) | "crop" (colheita)
CampDaily._offerNotify = function (kind, at = null) {
  if (!Notify.available()) return;
  const plan = () => {
    if (kind === "chest") Notify.schedule(NOTIFY_ID.chest, tomorrowAt(10), "Guardião da Floresta", "O baú do dia está esperando por você na Clareira.");
    else if (at) Notify.schedule(NOTIFY_ID.crop, at, "Guardião da Floresta", "Sua colheita está pronta na horta!");
  };
  if (Notify.enabled()) return plan();
  if (Notify.asked() || this._modals.length) return;
  const m = new Modal(this, { title: "QUER UM AVISO?", w: 640, h: 300 });
  m.add(text(this, 0, -40, kind === "chest" ? "Posso avisar quando o baú de amanhã estiver pronto." : "Posso avisar quando a colheita ficar pronta.", { size: 20, origin: 0.5, align: "center", wrap: 560 }));
  m.add(text(this, 0, -2, "No máximo dois avisos. Dá para desligar em Opções.", { size: 15, color: CSS.muted, origin: 0.5 }));
  m.add(new Button(this, -135, 80, 240, 54, "SIM, AVISE", async () => {
    m.close();
    if (await Notify.enable()) plan();
  }, { size: 20, style: "primary", color: CSS.goldHi }));
  m.add(new Button(this, 135, 80, 240, 54, "AGORA NÃO", () => {
    Notify.decline();
    m.close();
  }, { size: 20, style: "dark" }));
};

function msToMidnight(now = Clock.date()) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return t - now;
}
