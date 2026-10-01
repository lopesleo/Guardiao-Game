// "Game feel" da partida: o que faz um golpe parecer golpe. Tudo barato (sem sistema de
// partículas novo) e sob controle do jogador: hit-stop e vinheta seguem a opção de
// "Tremor de tela"; a vibração segue "Vibração" (ver Settings / Theme.haptic).
import { GAME } from "../config.js";
import { PAL } from "../art/Palette.js";
import { haptic } from "../ui/Theme.js";
import { Settings } from "./Settings.js";

const HIT_SFX_GAP_MS = 55; // acertos em rajada não viram um chiado só
const HIT_STOP_COOLDOWN_MS = 140; // evita "congelar" em sequência de críticos
const GEM_COMBO_WINDOW_MS = 420; // gemas pegas em sequência sobem de tom
const SPARK_CAP = 24;

export class GameFeel {
  constructor(scene) {
    this.scene = scene;
    this._lastHitSfx = 0;
    this._hitStopUntil = 0;
    this._sparks = 0;
    this._gemCombo = 0;
    this._lastGemAt = 0;
    this._hurtA = 0; // 0..1, decai sozinho
    this._makeVignette();
    // Pausa (cartas de nível, menu): a vinheta congelaria no meio do piscar
    this._onPause = () => {
      this._hurtA = 0;
      this._lastA = 0;
      this.vignette.setAlpha(0);
    };
    scene.events.on("pause", this._onPause);
    scene.events.once("shutdown", () => scene.events.off("pause", this._onPause));
  }

  // Vinheta vermelha pré-desenhada uma vez (textura de canvas), fixa na tela.
  _makeVignette() {
    const s = this.scene;
    if (!s.textures.exists("fx_hurt_vignette")) {
      const c = s.textures.createCanvas("fx_hurt_vignette", 256, 144);
      const ctx = c.getContext();
      const r = (PAL.red2 >> 16) & 255, g = (PAL.red2 >> 8) & 255, b = PAL.red2 & 255;
      const grad = ctx.createRadialGradient(128, 72, 40, 128, 72, 150);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.95)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 144);
      c.refresh();
    }
    this.vignette = s.add
      .image(GAME.WIDTH / 2, GAME.HEIGHT / 2, "fx_hurt_vignette")
      .setDisplaySize(GAME.WIDTH, GAME.HEIGHT)
      .setScrollFactor(0)
      .setDepth(70000)
      .setAlpha(0);
  }

  // Congela o mundo por alguns ms (golpe forte "pesa"). Física e tweens quase param;
  // o relógio da cena segue, então o restaura sozinho.
  hitStop(ms = 45) {
    const s = this.scene;
    const now = s.time.now;
    if (!Settings.get("shake") || s.gameOver || now < this._hitStopUntil) return;
    this._hitStopUntil = now + ms + HIT_STOP_COOLDOWN_MS;
    s.physics.world.timeScale = 6;
    s.tweens.timeScale = 0.15;
    s.time.delayedCall(ms, () => {
      if (s.gameOver) return; // a câmera lenta da morte cuida do resto
      s.physics.world.timeScale = 1;
      s.tweens.timeScale = 1;
    });
  }

  // Chamado quando um inimigo toma dano (Enemy.takeDamage). big = chefe/minichefe.
  hit(enemy, crit = false, big = false) {
    const s = this.scene;
    const now = s.time.now;
    if (now - this._lastHitSfx >= HIT_SFX_GAP_MS) {
      this._lastHitSfx = now;
      s.sound.play("sfx_hit", crit
        ? { volume: 0.32, rate: 0.7 + Math.random() * 0.1 }
        : { volume: 0.13, rate: 0.9 + Math.random() * 0.35 });
    }
    if (crit) {
      this.spark(enemy.x, enemy.y, 0xffd96b);
      s.cameras.main.shake(70, 0.0035);
      this.hitStop(big ? 55 : 38);
    }
  }

  // Faíscas curtas (3 pontinhos) — o mesmo "px_puff" da poeira de morte.
  spark(x, y, tint) {
    const s = this.scene;
    if (this._sparks > SPARK_CAP) return;
    for (let i = 0; i < 3; i++) {
      this._sparks++;
      const a = Math.random() * Math.PI * 2;
      const d = 16 + Math.random() * 14;
      const p = s.add.image(x, y - 6, "px_puff").setScale(0.9).setTint(tint).setDepth(y + 10002);
      s.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y - 6 + Math.sin(a) * d,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        ease: "Cubic.easeOut",
        onComplete: () => {
          p.destroy();
          this._sparks--;
        },
      });
    }
  }

  // O herói tomou dano: vinheta + tremor + vibração + um instante de peso.
  hurt(dmg) {
    const s = this.scene;
    const frac = Math.min(1, dmg / (s.player.maxHp * 0.25)); // golpe forte = efeito maior
    this._hurtA = Math.max(this._hurtA, 0.55 + frac * 0.45);
    s.cameras.main.shake(130, 0.004 + frac * 0.006);
    haptic(20 + Math.round(frac * 30));
    this.hitStop(35 + Math.round(frac * 30));
  }

  // Gemas de XP em sequência sobem de tom (ding-ding-ding). Devolve o rate do som.
  gem() {
    const now = this.scene.time.now;
    this._gemCombo = now - this._lastGemAt < GEM_COMBO_WINDOW_MS ? Math.min(this._gemCombo + 1, 12) : 0;
    this._lastGemAt = now;
    return 1 + this._gemCombo * 0.06;
  }

  levelUp() {
    haptic(35);
  }

  // Abate de elite/minichefe: peso extra.
  bigKill(x, y) {
    this.spark(x, y, 0xfff0a0);
    this.scene.cameras.main.shake(160, 0.007);
    this.hitStop(70);
    haptic(40);
  }

  // Vinheta: pisca no dano e fica pulsando fraco com a vida baixa.
  update(time, dt) {
    const p = this.scene.player;
    this._hurtA = Math.max(0, this._hurtA - dt / 380);
    let low = 0;
    if (p && p.maxHp > 0 && !this.scene.gameOver) {
      const f = p.hp / p.maxHp;
      if (f < 0.3) low = (0.16 + 0.1 * Math.sin(time / 260)) * (1 - f / 0.3 * 0.5);
    }
    const a = Math.max(this._hurtA * 0.7, low);
    if (a !== this._lastA) this.vignette.setAlpha(a);
    this._lastA = a;
  }

  destroy() {
    this.vignette?.destroy();
  }
}
