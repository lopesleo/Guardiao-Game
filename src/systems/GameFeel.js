// "Game feel" da partida: o que faz um golpe parecer golpe. Tudo barato (imagens e emissores
// reaproveitados) e sob controle do jogador: hit-stop e vinheta seguem a opção de "Tremor de tela";
// a vibração segue "Vibração" (ver Settings / Theme.haptic); clarões seguem "Clarões suaves".
// Regra do gênero (FEEL em config.js): numa horda, nada treme nem congela por abate ou crítico comum;
// o peso fica para os momentos raros (nível, evolução, minichefe, chefe, morte).
import { AUDIO, FEEL } from "../config.js";
import { PAL } from "../art/Palette.js";
import { haptic, vw, vh } from "../ui/Theme.js";
import { Settings } from "./Settings.js";
import { setDanger } from "../audio/Mixer.js";
import { D_FX } from "./WeaponFX.js";

const HIT_SFX_GAP_MS = 55; // acertos em rajada não viram um chiado só
const HIT_STOP_COOLDOWN_MS = 140; // evita "congelar" em sequência de críticos
const GEM_COMBO_WINDOW_MS = 420; // gemas pegas em sequência sobem de tom
const SPARK_CAP = 24;
const GLINT_CAP = 8;
// Cor do anel quando a carta escolhida chega ao herói (a mesma da fita da carta)
const CARD_COLOR = { new: PAL.g6, upgrade: PAL.yel3, passive: PAL.ice3, pact: PAL.red3 };
const GEM_COLOR = { px_gem: PAL.g6, px_gem_blue: PAL.ice3, px_gem_gold: PAL.yel3 };

// Clarão de tela mais fraco que o do Phaser (k = fração da opacidade; "Clarões suaves" já reduz no gancho)
export function softFlash(cam, ms, r, g, b, k = 0.5) {
  const fe = cam.flashEffect;
  const was = fe.isRunning;
  cam.flash(ms, r, g, b);
  if (!was && fe.isRunning) fe._alpha *= k;
}

export class GameFeel {
  constructor(scene) {
    this.scene = scene;
    this._lastHitSfx = 0;
    this._hitStopUntil = 0;
    this._gemCombo = 0;
    this._lastGemAt = 0;
    this._lastGlint = 0;
    this._evoKey = null;
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
    // Cobre a tela INTEIRA: com scale EXPAND a largura real passa de GAME.WIDTH (celular 19.5:9)
    this.vignette = s.add.image(0, 0, "fx_hurt_vignette").setScrollFactor(0).setDepth(70000).setAlpha(0);
    const fit = () => this.vignette.setPosition(vw(s) / 2, vh(s) / 2).setDisplaySize(vw(s), vh(s));
    fit();
    s.scale.on("resize", fit);
    s.events.once("shutdown", () => s.scale.off("resize", fit));
  }

  // Algum chefe/minichefe está AVISANDO um golpe? (forma à mostra: o jogador está lendo para onde fugir).
  // Conta os avisos desenhados (Telegraph.js) e o grito em anel (a brecha anda até o herói). O golpe em si,
  // depois do aviso, pode pesar: a pancada do chefe no herói é o momento de uma pausa
  _telegraphing() {
    const s = this.scene;
    if (s._teleLive > 0) return true;
    const b = s._bossBrains;
    if (b) for (const brain of b) if (brain.threat?.gap) return true;
    return false;
  }

  // Congela o mundo por alguns ms (golpe forte "pesa"). Física e tweens quase param;
  // o relógio da cena segue, então o restaura sozinho. Nunca durante o aviso de golpe de chefe.
  hitStop(ms = 45) {
    const s = this.scene;
    const now = s.time.now;
    if (!Settings.get("shake") || s.gameOver || now < this._hitStopUntil || this._telegraphing()) return;
    this._hitStopUntil = now + ms + HIT_STOP_COOLDOWN_MS;
    s.physics.world.timeScale = 6;
    s.tweens.timeScale = 0.15;
    s.fx?.setTimeScale(0.15);
    s.time.delayedCall(ms, () => {
      if (s.gameOver) return; // a câmera lenta da morte cuida do resto
      s.physics.world.timeScale = 1;
      s.tweens.timeScale = 1;
      s.fx?.setTimeScale(1);
    });
  }

  // Chamado quando um inimigo toma dano (Enemy.takeDamage). big = chefe/minichefe.
  // Crítico em inimigo comum: faísca + o achatamento/empurrão do próprio inimigo + som grave. Tremor e
  // pausa só em alvo forte (FEEL.CRIT_TOUGH_ONLY): 3 críticos/s na horda eram 1,6 pausas/s.
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
      if (big || enemy._elite || !FEEL.CRIT_TOUGH_ONLY) {
        s.cameras.main.shake(70, 0.0035);
        this.hitStop(big ? 55 : 38);
      }
    }
  }

  // Tremor das reações elementais: no máximo um a cada FEEL.REACT_SHAKE_GAP_MS (a reação continua com
  // rótulo, luz, som e efeito; numa build de reações eram 2+ tremores/s, a câmera tremia 1/5 do tempo)
  reactShake(ms, k) {
    const now = this.scene.time.now;
    if (now - (this._reactShakeAt ?? -1e9) < FEEL.REACT_SHAKE_GAP_MS) return;
    this._reactShakeAt = now;
    this.scene.cameras.main.shake(ms, k);
  }

  // Faíscas curtas (3 pontinhos) — o mesmo "px_puff" da poeira de morte (imagens reaproveitadas: Puffs.js)
  spark(x, y, tint) {
    const s = this.scene;
    if (!s.puffs || s.puffs.count.spark > SPARK_CAP) return;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 16 + Math.random() * 14;
      s.puffs.spawn("spark", "px_puff", x, y - 6, x + Math.cos(a) * d, y - 6 + Math.sin(a) * d, 0.9, 0.3, 1, tint, y + 10002, 200);
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

  // Gemas de XP em sequência sobem de tom (ding-ding-ding). Devolve o rate do som. g = a gema pega:
  // um brilho curto no lugar dela, na cor dela (no máximo um a cada FEEL.GEM_GLINT_MS)
  gem(g = null) {
    const s = this.scene;
    const now = s.time.now;
    this._gemCombo = now - this._lastGemAt < GEM_COMBO_WINDOW_MS ? Math.min(this._gemCombo + 1, 12) : 0;
    this._lastGemAt = now;
    if (g && s.puffs && now - this._lastGlint >= FEEL.GEM_GLINT_MS && s.puffs.count.glint < GLINT_CAP) {
      this._lastGlint = now;
      const tint = GEM_COLOR[g.texture.key] ?? PAL.g6;
      s.puffs.spawn("glint", "fx_star", g.x, g.y - 3, g.x, g.y - 12, 0.45, 1.25, 1, tint, D_FX + 5, 170);
    }
    return 1 + this._gemCombo * 0.06;
  }

  // Abate de elite/minichefe: peso extra.
  bigKill(x, y) {
    this.spark(x, y, 0xfff0a0);
    this.scene.cameras.main.shake(160, 0.007);
    this.hitStop(70);
    haptic(40);
  }

  // Subiu de nível: a barra de XP fica cheia e dourada atrás da mesa de cartas (HUD.levelFull)
  levelUp() {
    haptic(35);
    this.scene.hud?.levelFull?.();
  }

  // A carta escolhida chegou ao herói (LevelUpScene): anel na cor da carta, estrela e fagulhas subindo
  cardLanded(type) {
    const s = this.scene;
    const p = s.player,
      fx = s.fx;
    if (!p || !fx || s.gameOver) return;
    if (type === "evolution" && this._evoKey) return this._evolveBeat();
    const col = CARD_COLOR[type] ?? PAL.yel3;
    const fy = p.y + p.displayHeight * 0.42;
    fx.ring(p.x, fy, col, 10, 92, 300, 0.6, 0.9);
    fx.star(p.x, p.y - 4, PAL.white, 0.6, 2.4, 160, 0);
    fx.burst("glow", p.x, p.y + 6, 10, -Math.PI / 2, 120, { min: 50, max: 160 });
    fx.light(p.x, p.y, 220, col, 380, 1);
    s.sound.play("sfx_absorb", { volume: 0.45 });
  }

  // Evolução escolhida (UpgradeSystem): o tempo dela vem quando a carta chega ao herói
  markEvolve(key) {
    this._evoKey = key;
  }

  // EVOLUÇÃO: a arma vira a versão suprema — onda de trovão roxa saindo do herói, anel branco, estrela,
  // raios e vaga-lumes subindo, a luz roxa na mata, o espaço da arma na HUD pulsa. Momento raro: tremor e
  // vibração valem aqui (clarão de tela fraco: a luz no mundo é que conta)
  _evolveBeat() {
    const s = this.scene;
    const p = s.player,
      fx = s.fx;
    const E = FEEL.EVOLVE;
    const key = this._evoKey;
    this._evoKey = null;
    const fy = p.y + p.displayHeight * 0.42;
    fx.thunderRing(p.x, fy, 12, E.RING_R, 560, [PAL.white, PAL.pur3, PAL.pur2, PAL.pur1], 0.62);
    fx.ring(p.x, fy, PAL.white, 8, E.RING_R * 0.62, 380, 0.62, 1);
    fx.star(p.x, p.y - 8, PAL.pur3, 1, 4.2, 240, Math.PI / 4);
    fx.burst("zap", p.x, p.y, 16);
    fx.burst("glow", p.x, p.y, E.SPARKS, -Math.PI / 2, 160, { min: 80, max: 260 });
    fx.burst("streak", p.x, p.y - 10, 12, null, 360, { min: 200, max: 380 }, [PAL.white, PAL.pur3, PAL.yel3]);
    fx.light(p.x, p.y, E.LIGHT_R, PAL.pur2, 800, 1.3);
    s.cameras.main.shake(260, 0.007);
    softFlash(s.cameras.main, 260, 200, 150, 255, 0.4);
    haptic(60);
    s.sound.play("sfx_evolve", { volume: 0.75 });
    s.hud?.popWeapon?.(key);
  }

  // GOLPE FATAL: o mundo congela um instante com o herói em branco (o quadro que fica na memória), a HUD
  // sai de cena e só então vem a câmera lenta (then). Sem "Tremor de tela": sem congelar.
  fatal(then) {
    const s = this.scene;
    const p = s.player;
    const D = FEEL.DEATH;
    haptic(D.HAPTIC);
    s.sound.play("sfx_strike", { volume: 0.6, rate: 0.8, alert: true });
    for (const o of s.children.list) {
      if (o.scrollFactorX === 0 && o.depth >= 50000 && o.visible && o !== this.vignette && o.alpha > 0) s.tweens.add({ targets: o, alpha: 0, duration: D.HUD_OUT_MS });
    }
    if (!Settings.get("shake") || !p) return then();
    p.setTint(PAL.white).setTintMode(Phaser.TintModes.FILL);
    s.physics.world.timeScale = 40;
    s.tweens.timeScale = 0.03;
    s.fx?.setTimeScale(0.03);
    s.time.delayedCall(D.FREEZE_MS, () => {
      p.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      then();
    });
  }

  // Vinheta: pisca no dano e some. A vida baixa NÃO pulsa aqui: é a própria Podridão da borda
  // que pulsa (world/Podridao.js) — duas vinhetas em ritmos diferentes brigavam na tela.
  update(time, dt) {
    const p = this.scene.player;
    this._hurtA = Math.max(0, this._hurtA - dt / 380);
    if (p && p.maxHp > 0 && !this.scene.gameOver) this._heart(time, p.hp / p.maxHp);
    const a = this._hurtA * 0.7;
    if (a !== this._lastA) this.vignette.setAlpha(a);
    this._lastA = a;
  }

  // Vida baixa: o coração bate, mais rápido quanto mais perto do fim. Um som com intervalo, e a
  // música escurece de leve e fica assim (AUDIO.DANGER): nada "respira" a cada golpe. Histerese:
  // liga abaixo de HP e só desliga acima de HP_OUT. Só roda com a partida andando (pausa = sem batida)
  _heart(time, f) {
    const D = AUDIO.DANGER;
    const on = this._danger ? f < D.HP_OUT : f < D.HP;
    if (on !== !!this._danger) {
      this._danger = on;
      setDanger(on);
      if (on) this._nextBeat = time;
    }
    if (!on || time < this._nextBeat) return;
    const k = Math.max(0, Math.min(1, f / D.HP)); // 1 = começando a apertar, 0 = por um fio
    this._nextBeat = time + D.BEAT_MS[1] + (D.BEAT_MS[0] - D.BEAT_MS[1]) * k;
    this.scene.sound.play("sfx_heartbeat_run", { volume: D.BEAT_VOL });
  }

  destroy() {
    this.vignette?.destroy();
  }
}
