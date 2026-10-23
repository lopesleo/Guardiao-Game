// Música da partida em CAMADAS: a trilha reage à luta. As camadas (base → bateria → baixo → melodia,
// Synth.js) tocam juntas, sempre, travadas na mesma grade (laços nativos de amostra exata: nunca saem de
// sincronia); o que muda é o ganho de cada uma. Mudança só no compasso (bateria, baixo) ou na frase
// (melodia): a camada que entra cresce em ENTER_BEATS e chega inteira NO tempo forte; a que sai começa a
// sumir no tempo forte. Ver AUDIO.LAYERS no config.
//
//   camadas → ganho de cada uma → volumeNode (o "volume" da trilha) → barramento da música (Mixer.js)
//
// LayeredTrack fala a língua que o Mixer espera de uma trilha do Phaser (key, seek, volume, volumeNode,
// isPlaying, play({delay}), destroy, pendingRemove): troca no compasso (chefe, Noite Eterna), fita parando
// na morte, abafar na pausa e o volume das Opções valem igual.
import { AUDIO } from "../config.js";
import { MUSIC_INFO, stemKey } from "./Synth.js";
import { Mixer, dbToGain, sliderGain } from "./Mixer.js";
import { Settings } from "../systems/Settings.js";

const L = () => AUDIO.LAYERS;

// Segura o AudioParam onde ele está agora (mesmo no meio de uma rampa) e devolve esse valor
function hold(p, t) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
  return p.value;
}

export class LayeredTrack {
  constructor(sound, key, cfg = {}) {
    const info = MUSIC_INFO[key];
    const ctx = sound.context;
    this.key = key;
    this.info = info;
    this.ctx = ctx;
    this.layered = true;
    this.volume = cfg.volume ?? 1;
    this.rate = cfg.rate ?? 1;
    this.totalRate = this.rate;
    this.isPlaying = false;
    this.pendingRemove = false;
    this.startTime = 0;
    this.level = Math.max(0, Math.min(info.stems.length - 1, cfg.layers ?? 0));
    this.changes = []; // { stem, on, beat, at } — para os testes e a depuração
    // Sem barramentos (não deve acontecer com WebAudio): direto no destino, com o volume das Opções
    const dest = Mixer.active ? Mixer.buses.music.in : sound.destination;
    this.volumeNode = ctx.createGain();
    this.volumeNode.gain.value = Mixer.active ? this.volume : this.volume * sliderGain(Settings.get("music"));
    this.volumeNode.connect(dest);
    this.stems = info.stems.map((name, i) => {
      const gain = ctx.createGain();
      const on = i <= this.level;
      gain.gain.value = on ? this._full(name) : 0;
      gain.connect(this.volumeNode);
      return { name, i, on, gain, buffer: sound.game.cache.audio.get(stemKey(key, name)), src: null };
    });
  }

  _full(name) {
    return dbToGain(L().STEM_DB[name] ?? 0);
  }

  // O que o Mixer lê de uma trilha (a fita parando desacelera todas as fontes)
  get sources() {
    return this.stems.map((s) => s.src).filter(Boolean);
  }
  get source() {
    return this.stems[0].src;
  }
  get loopSource() {
    return null;
  }
  get duration() {
    return this.info.beats * this.info.beatS;
  }
  // posição na trilha, em segundos do buffer (como o seek do Phaser)
  get seek() {
    if (!this.isPlaying) return 0;
    return (Math.max(0, this.ctx.currentTime - this.startTime) * this.rate) % this.duration;
  }
  beatAt(t) {
    return ((t - this.startTime) * this.rate) / this.info.beatS;
  }
  timeOfBeat(b) {
    return this.startTime + (b * this.info.beatS) / this.rate;
  }

  play({ delay = 0 } = {}) {
    if (this.isPlaying || this.pendingRemove) return false;
    const when = this.ctx.currentTime + Math.max(0, delay);
    for (const s of this.stems) {
      const src = this.ctx.createBufferSource();
      src.buffer = s.buffer;
      src.loop = true; // laço nativo: amostra exata, nada de emenda por JavaScript
      src.playbackRate.value = this.rate;
      src.connect(s.gain);
      src.start(when);
      s.src = src;
    }
    this.startTime = when;
    this.isPlaying = true;
    return true;
  }

  // Quantas camadas além da base (0 = só a base). Cada camada que muda é marcada no próximo tempo forte
  // da grade dela; pedir de novo o mesmo nível não mexe em nada
  setLevel(level) {
    level = Math.max(0, Math.min(this.stems.length - 1, level));
    this.level = level;
    if (!this.isPlaying || this.pendingRemove) {
      for (const s of this.stems) {
        s.on = s.i <= level;
        s.gain.gain.value = s.on ? this._full(s.name) : 0;
      }
      return;
    }
    const c = L();
    const now = this.ctx.currentTime;
    const spb = this.info.beatS / this.rate; // segundos reais por tempo
    for (const s of this.stems) {
      if (s.i === 0) continue; // a base nunca sai
      const want = s.i <= level;
      if (want === s.on) continue;
      s.on = want;
      const q = c.QUANT[s.name] ?? 4;
      const enter = want ? (c.ENTER_BEATS[s.name] ?? 0.5) * spb : 0;
      // primeiro tempo forte da grade que ainda dá tempo de preparar (crescendo inteiro depois de agora)
      const beat = Math.ceil(this.beatAt(Math.max(now, this.startTime) + c.LOOKAHEAD_S + enter) / q - 1e-6) * q;
      const at = this.timeOfBeat(beat);
      const p = s.gain.gain;
      const v = hold(p, now);
      if (want) {
        p.setValueAtTime(v, at - enter);
        p.linearRampToValueAtTime(this._full(s.name), at);
      } else {
        const out = c.EXIT_BEATS * spb;
        p.setValueAtTime(v, at);
        if (v > 1e-3) p.exponentialRampToValueAtTime(1e-3 * v, at + out);
        p.setValueAtTime(0, at + out);
      }
      this.changes.push({ stem: s.name, on: want, beat, at });
      if (this.changes.length > 64) this.changes.splice(0, 32);
    }
  }

  stop() {
    for (const s of this.stems) {
      try {
        s.src?.stop();
      } catch {
        // já parada
      }
    }
    this.isPlaying = false;
  }

  destroy() {
    if (this.pendingRemove) return;
    this.stop();
    for (const s of this.stems) {
      s.src?.disconnect();
      s.gain.disconnect();
      s.src = null;
    }
    this.volumeNode.disconnect();
    this.pendingRemove = true;
  }
}

// Trilha pela chave: em camadas se ela tem camadas no cache; senão, a voz comum do Phaser
export function createMusic(sound, key, cfg = {}) {
  const info = MUSIC_INFO[key];
  if (info?.stems && sound.context && info.stems.every((s) => sound.game?.cache?.audio?.exists(stemKey(key, s)))) return new LayeredTrack(sound, key, cfg);
  const { layers, ...rest } = cfg;
  return sound.add(key, rest);
}

// ---------------------------------------------------------------------------
// INTENSIDADE → NÍVEL (lógica pura: o teste roda no Node)
// ---------------------------------------------------------------------------
// inp: { near, elites, mini, danger, time } (time = fração da partida, 0..1). A densidade entra em raiz:
// os primeiros inimigos perto mudam mais que o 40º (um bicho chegando já traz a bateria)
export function intensityOf(inp, c = L()) {
  const W = c.W;
  const near = inp.near || 0;
  const d = Math.sqrt(Math.min(1, near / c.DENSE_N));
  const e = Math.min(1, (inp.elites || 0) / c.ELITE_N);
  return Math.min(1, (near > 0 ? W.BASE : 0) + W.DENSITY * d + W.ELITE * e + (inp.mini ? W.MINI : 0) + (inp.danger ? W.DANGER : 0) + W.TIME * Math.max(0, Math.min(1, inp.time || 0)));
}

export class MusicIntensity {
  constructor(c = L()) {
    this.c = c;
    this.reset();
  }
  reset(level = 0) {
    this.value = 0;
    this.level = level;
    this.sinceMs = Infinity;
    this.changes = 0;
  }
  // raw (0..1) a cada dtMs → nível (0..UP.length)
  update(raw, dtMs) {
    const c = this.c;
    const tau = raw > this.value ? c.RISE_S : c.FALL_S;
    this.value += (raw - this.value) * (1 - Math.exp(-dtMs / 1000 / tau));
    this.sinceMs += dtMs;
    let n = this.level;
    if (this.sinceMs >= c.HOLD_UP_MS) while (n < c.UP.length && this.value >= c.UP[n]) n++;
    if (n === this.level && this.sinceMs >= c.HOLD_DOWN_MS) while (n > 0 && this.value < c.DOWN[n - 1]) n--;
    if (n !== this.level) {
      this.level = n;
      this.sinceMs = 0;
      this.changes++;
    }
    return n;
  }
}
