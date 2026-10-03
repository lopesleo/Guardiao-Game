// Vitória sobre o Mapinguari: encerrar com a vitória garantida ou seguir na
// Noite Eterna (Modo Infinito) — inimigos cada vez mais fortes, recorde próprio.
// A vitória já conta nos dois casos; continuar só acrescenta.
import { ENDLESS } from "../config.js";
import { CSS, PAL, hex } from "../art/Palette.js";
import { text, dim, Button, vw, vh, fitCamera, haptic, drawFrame } from "../ui/Theme.js";
import { formatTime } from "../utils.js";
import { Analytics } from "../systems/Analytics.js";
import { tr } from "../i18n/i18n.js";

export class EndlessChoiceScene extends Phaser.Scene {
  constructor() {
    super("EndlessChoiceScene");
  }

  create() {
    const W = vw(this),
      H = vh(this);
    fitCamera(this);
    this.gs = this.scene.get("GameScene");
    this._done = false;
    dim(this, 0.8);

    // Painel próprio (antes o texto flutuava sobre o jogo e a dica do HUD aparecia atrás).
    // Tudo empilhado pela altura REAL: a fonte Legível e o texto grande mudam as medidas,
    // e posições fixas deixavam o subtítulo e as regras uns sobre os outros.
    const pg = this.add.graphics();
    const wrap = W - 120; // só quebra linha se nem a tela inteira couber
    const who = this.gs.biome?.bossName ?? tr("Mapinguari");
    const best = this.gs.meta.data.bestEndlessSeconds || 0;
    const info = [
      tr("Na Noite Eterna os inimigos ficam {0}% mais fortes a cada minuto.", Math.round(ENDLESS.HP_GROWTH_PER_MIN * 100)),
      tr("Cada minuto de pé vale +{0} moedas. A vitória já está garantida.", ENDLESS.COINS_PER_MIN),
      best > 0 ? tr("Seu recorde: {0}", formatTime(best * 1000)) : tr("Quanto tempo você aguenta?"),
    ];
    const t = text(this, W / 2, 0, tr("VITÓRIA!"), { size: 80, color: CSS.goldHi, origin: 0.5, stroke: true, strokeW: 10, shadowY: 6 });
    const sub = text(this, W / 2, 0, tr("O {0} está livre. Mas a Podridão não dorme…", who), { size: 24, color: CSS.muted, origin: [0.5, 0], align: "center", wrap });
    const body = text(this, W / 2, 0, info.join("\n"), { size: 19, color: CSS.txt, origin: [0.5, 0], align: "center", lineSpacing: 6, wrap });
    // o painel acompanha o texto (fonte Legível/texto grande = painel mais largo)
    const pw = Math.max(640, Math.min(W - 40, Math.max(sub.width, body.width) + 90));
    const go = new Button(this, W / 2, 0, Math.min(pw - 60, Math.max(460, pw * 0.6)), 72, tr("ENFRENTAR A NOITE ETERNA"), () => this._choose(true), {
      size: 26,
      style: "purple",
      color: hex(PAL.pur3),
    });
    const end = new Button(this, W / 2, 0, Math.min(pw - 60, Math.max(380, pw * 0.5)), 60, tr("ENCERRAR COM A VITÓRIA"), () => this._choose(false), {
      size: 22,
      style: "primary",
      color: CSS.goldHi,
    });
    const PAD = 26,
      GAP = 14;
    const stack = [
      [t, t.height, 2],
      [sub, sub.height, GAP + 4],
      [body, body.height, GAP + 8],
      [go, go.h, GAP],
      [end, end.h, 0],
    ];
    let ph = PAD * 2 + stack.reduce((a, [, h, g]) => a + h + g, 0);
    // tela baixa: o painel nunca passa da altura visível (encolhe o conjunto)
    const k = Math.min(1, (H - 24) / ph);
    ph *= k;
    let y = Math.round(H / 2 - ph / 2);
    drawFrame(pg, W / 2 - pw / 2, y, pw, ph, "purple", { alpha: 0.97 });
    y += PAD * k;
    for (const [o, h, g] of stack) {
      const mid = o instanceof Button || o === t; // botões e título crescem do centro
      o.setScale(k);
      o.y = Math.round(mid ? y + (h * k) / 2 : y);
      y += (h + g) * k;
    }
    t.setScale(0.3 * k).setAlpha(0);
    this.tweens.add({ targets: t, scale: k, alpha: 1, duration: 420, ease: "Back.easeOut" });
    this.input.keyboard.on("keydown-ENTER", () => this._choose(false));
    this.input.keyboard.on("keydown-ESC", () => this._choose(false));
    this.sound.play("sfx_chest_jackpot", { volume: 0.7 });
    haptic(80);
  }

  onBack() {
    this._choose(false);
    return true;
  }

  _choose(endless) {
    if (this._done) return;
    this._done = true;
    Analytics.track("endless_choice", { endless });
    this.scene.stop();
    this.gs.scene.resume();
    if (endless) this.gs._startEndless();
    else this.gs._onGameOver(true);
  }
}
