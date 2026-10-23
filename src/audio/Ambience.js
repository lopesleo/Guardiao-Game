// Ambiência da Clareira pela hora do dia (a mesma hora do céu: CampDecor._applyTimeOfDay). Sons em
// src/audio/Nature.js; volumes, horas e bichos em AUDIO.AMBIENCE. Toca no barramento dos Efeitos (a
// barra de Efeitos das Opções vale; com "Música 0" a mata continua), bem por baixo da música.
//
//   cama da hora (o mesmo laço duas vezes: lados opostos, uma 1,6% mais lenta → a soma nunca se repete)
//   chamados (sílabas sorteadas na hora: PATTERNS) ── ganho → [passa-baixa se for longe] → lado ─┐
//                                                                         saída da ambiência ←┘ → Efeitos
//
// As horas se cruzam devagar (pesos que somam 1; as camas em potência constante). Os chamados vêm em
// intervalos sorteados, mais frequentes quanto mais "da hora" o bicho é. Tudo marcado no relógio do
// áudio com folga (LOOKAHEAD_S): quadro lento não atrasa o canto, e app em segundo plano para tudo junto.
import { AUDIO } from "../config.js";
import { Mixer, dbToGain } from "./Mixer.js";
import { PATTERNS, PERIODS, periodWeights } from "./Nature.js";

const A = () => AUDIO.AMBIENCE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hold(p, t) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
}

export class Ambience {
  constructor(scene) {
    this.scene = scene;
    this.ctx = scene.sound?.context;
    this.cache = scene.cache.audio;
    this.ok = !!(this.ctx && Mixer.active && this.cache.exists("amb_bed_day"));
    this.weights = { dawn: 0, day: 0, dusk: 0, night: 0 };
    this.played = {}; // bicho → quantos cantos (testes e depuração)
    this.rateMul = 1; // testes: cantos mais frequentes
    this.rand = Math.random;
    this.hour = null;
    if (!this.ok) return;
    const c = A(),
      t = this.ctx.currentTime;
    this.out = this.ctx.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(dbToGain(c.DB), t + c.FADE_IN_S);
    this.out.connect(Mixer.buses.sfx.in);
    this.beds = {}; // hora → { gain, srcs, nodes, stopAt }
    this.next = {}; // bicho → quando canta de novo (relógio do áudio)
    this.live = []; // cantos em andamento: notas ainda por marcar
    this.srcs = new Set(); // sílabas marcadas ou tocando
    this.timer = scene.time.addEvent({ delay: c.TICK_MS, loop: true, callback: () => this.tick() });
  }

  // Hora do relógio (0..24). instant: sem cruzar (a entrada já tem o fade da ambiência inteira)
  setHour(hour, instant = false) {
    this.hour = hour;
    const w = periodWeights(hour, A().HOURS);
    this.weights = w;
    if (!this.ok || this.dead) return;
    for (const p of PERIODS) this._bed(p, w[p], instant);
  }

  _bed(p, w, instant) {
    const c = A();
    let b = this.beds[p];
    if (!b && w <= 0.001) return;
    if (!b) b = this.beds[p] = this._startBed(p);
    const target = Math.sqrt(w) * dbToGain(c.BED_DB[p] ?? 0); // potência constante: a soma não afunda no meio
    const g = b.gain.gain,
      t = this.ctx.currentTime;
    hold(g, t);
    if (instant) g.setValueAtTime(target, t);
    else g.setTargetAtTime(target, t, c.XFADE_S / 3);
    b.target = target;
    b.stopAt = w <= 0.001 ? t + c.XFADE_S * 1.6 : 0; // a hora que saiu para de tocar depois de sumir
  }

  _startBed(p) {
    const ctx = this.ctx,
      buf = this.cache.get(`amb_bed_${p}`);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.out);
    const nodes = [],
      srcs = [];
    for (const [pan, rate, at] of [[-0.55, 1, 0], [0.55, 0.984, 0.47]]) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      const pn = ctx.createStereoPanner();
      pn.pan.value = pan;
      s.connect(pn);
      pn.connect(gain);
      s.start(ctx.currentTime, buf.duration * at);
      nodes.push(s, pn);
      srcs.push(s);
    }
    nodes.push(gain);
    return { gain, nodes, srcs, stopAt: 0, target: 0 };
  }

  _killBed(p) {
    const b = this.beds[p];
    if (!b) return;
    for (const s of b.srcs) {
      try {
        s.stop();
      } catch {
        // já parada
      }
    }
    for (const n of b.nodes) n.disconnect();
    delete this.beds[p];
  }

  // Peso do bicho agora (0 = não é a hora dele)
  weightOf(sp) {
    const at = A().SPECIES[sp]?.at ?? {};
    return PERIODS.reduce((s, p) => s + (this.weights[p] || 0) * (at[p] || 0), 0);
  }

  tick() {
    if (!this.ok || this.dead || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    for (const [p, b] of Object.entries(this.beds)) if (b.stopAt && t >= b.stopAt) this._killBed(p);
    for (const [sp, d] of Object.entries(A().SPECIES)) {
      const w = this.weightOf(sp);
      if (w <= 0.01) {
        this.next[sp] = null;
        continue;
      }
      // o primeiro canto de quem acabou de "chegar" vem logo (a Clareira não começa muda)
      if (this.next[sp] == null) this.next[sp] = t + this._wait(d, w) * (0.12 + 0.5 * this.rand());
      if (t < this.next[sp]) continue;
      this.next[sp] = t + this._wait(d, w);
      const pat = PATTERNS[sp](this.rand);
      this.live.push({ ...pat, t0: t + 0.05, i: 0, gain: dbToGain(d.DB) });
      this.played[sp] = (this.played[sp] || 0) + 1;
    }
    this._schedule(t);
  }

  _wait(d, w) {
    const [a, b] = d.EVERY_S;
    return (a + (b - a) * this.rand()) / (w * this.rateMul);
  }

  // Marca as sílabas que caem dentro da janela à frente (as do fim de um canto longo, no próximo tick)
  _schedule(t) {
    const horizon = t + A().LOOKAHEAD_S;
    for (let k = this.live.length - 1; k >= 0; k--) {
      const c = this.live[k];
      while (c.i < c.notes.length && c.t0 + c.notes[c.i].t <= horizon) {
        const n = c.notes[c.i++];
        if (this.srcs.size < A().MAX_VOICES) this._note(n, Math.max(t, c.t0 + n.t), c);
      }
      if (c.i >= c.notes.length) this.live.splice(k, 1);
    }
  }

  _note(n, when, c) {
    const buf = this.cache.get(n.key);
    if (!buf) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = n.rate;
    const g = ctx.createGain();
    g.gain.value = c.gain * n.gain;
    const pn = ctx.createStereoPanner();
    // segundo bicho do mesmo canto (sapo que responde): do outro lado
    pn.pan.value = clamp(c.pan + (n.pan ? (c.spread || 0.5) * (c.pan > 0 ? -1 : 1) : 0), -0.95, 0.95);
    let lp = null;
    if (c.far) {
      lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      g.connect(lp);
      lp.connect(pn);
    } else g.connect(pn);
    s.connect(g);
    pn.connect(this.out);
    this.srcs.add(s);
    s.onended = () => {
      this.srcs.delete(s);
      s.disconnect();
      g.disconnect();
      lp?.disconnect();
      pn.disconnect();
    };
    s.start(when);
  }

  // Saindo da Clareira: some junto com a tela escurecendo
  fadeOut(sec = A().FADE_OUT_S) {
    if (!this.ok || this.dead) return;
    const t = this.ctx.currentTime;
    hold(this.out.gain, t);
    this.out.gain.linearRampToValueAtTime(0, t + sec);
    this._fadeEnd = t + sec;
  }

  destroy() {
    if (!this.ok || this.dead) return;
    this.dead = true;
    this.timer?.remove();
    const t = this.ctx.currentTime;
    if (!this._fadeEnd || this._fadeEnd < t) this.fadeOut();
    const end = Math.max(t, this._fadeEnd ?? t) + 0.05;
    for (const s of this.srcs) {
      try {
        s.stop(end);
      } catch {
        // ainda não começou e já foi parada
      }
    }
    for (const b of Object.values(this.beds))
      for (const s of b.srcs) {
        try {
          s.stop(end);
        } catch {
          // já parada
        }
      }
    this.live = [];
    // depois do fade, nada fica ligado (as sílabas se desligam sozinhas no onended)
    setTimeout(() => {
      for (const p of Object.keys(this.beds)) this._killBed(p);
      this.out.disconnect();
    }, (end - t) * 1000 + 120);
  }

  // Para testes e depuração
  get state() {
    const beds = {};
    for (const [p, b] of Object.entries(this.beds ?? {})) beds[p] = +b.gain.gain.value.toFixed(4);
    return { ok: this.ok, hour: this.hour, weights: { ...this.weights }, beds, played: { ...this.played }, voices: this.srcs?.size ?? 0, out: this.out ? +this.out.gain.value.toFixed(4) : 0 };
  }
}
