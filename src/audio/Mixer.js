// Mixagem do jogo. Cada som entra no BARRAMENTO do seu canal e a opção de volume do jogador é o
// ganho do barramento (antes era um multiplicador aplicado na hora de criar o som). Assim:
//   · mexer no volume vale na hora, até para o que já está tocando (fogueira, música);
//   · o tween de volume de um som é RELATIVO ao canal (o fade da cena da 1ª queda não fura "Música 0");
//   · grupos inteiros ganham efeito de uma vez (abafar a partida na pausa, fita parando na morte).
//
//   voz → [música]    volume do jogador → passa-baixa → ganho do momento ─┐
//   voz → [efeitos]   volume do jogador → passa-baixa → ganho do momento ─┼→ mestre do Phaser → limitador → saída
//   voz → [interface] volume dos efeitos (nunca é abafada) ───────────────┘
//
// A voz do Phaser é fonte → mudo → volume → painel 3D → painel estéreo → "destination" do gerenciador,
// lido no construtor do som: o gancho de add() troca esse destino pelo barramento do canal.
// Sem WebAudio (HTML5Audio/NoAudio) tudo segue no esquema antigo: volume multiplicado na criação.
import { AUDIO } from "../config.js";
import { Settings } from "../systems/Settings.js";
import { VoiceGate } from "./Voices.js";
import { MUSIC_INFO } from "./Synth.js";
import { createMusic } from "./MusicLayers.js";

export const dbToGain = (db) => Math.pow(10, db / 20);
// Barra 0..1 → ganho: escala em dB (cada pedaço da barra muda o volume na mesma proporção); 0 = mudo
export const sliderGain = (v) => (v > 0 ? dbToGain(AUDIO.SLIDER_DB * (Math.min(1, v) - 1)) : 0);
// Valor da barra LINEAR antiga (ganho) → posição na barra nova com o mesmo volume
export const sliderFromLinear = (g) => (g > 0 ? Math.max(0.01, Math.min(1, 1 + (20 * Math.log10(g)) / AUDIO.SLIDER_DB)) : 0);

const isMusicKey = (key) => typeof key === "string" && key.startsWith("music");
const isUiKey = (key) => typeof key === "string" && key.startsWith("sfx_ui_");
// Canal de um som: "music", "ui" (cliques, telas por cima da partida) ou "sfx"
export function channelOf(key, cfg) {
  if (isMusicKey(key)) return "music";
  if (cfg?.bus === "ui" || isUiKey(key)) return "ui";
  return "sfx";
}
// Volume do jogador que vale para o canal (a interface segue a barra de Efeitos)
const settingOf = (ch) => (ch === "music" ? Settings.get("music") : Settings.get("sfx"));

// O DynamicsCompressor do WebAudio soma sozinho um ganho de compensação (spec: (1/curva(0 dBFS))^0,6):
// sem desfazer, TUDO sairia mais alto. Com joelho 0, a curva em 0 dBFS = limiar + (0 − limiar)/razão
function limiterMakeup(L) {
  const full = L.THRESHOLD_DB + (0 - L.THRESHOLD_DB) / L.RATIO; // dB
  return Math.pow(1 / dbToGain(full), 0.6);
}

let game = null;
let mgr = null; // gerenciador WebAudio do Phaser (null = sem barramentos)
let ctx = null;
let bus = null;
let pendingChannel = null; // canal escolhido em play(), lido pelo add() que o Phaser chama por dentro

// Liga os barramentos ao gerenciador WebAudio (uma vez). Devolve false sem WebAudio.
function build(m) {
  const c = m?.context;
  if (!c || !m.destination || !m.masterVolumeNode || typeof c.createGain !== "function") return false;
  const gain = () => c.createGain();
  const open = c.sampleRate / 2; // passa-baixa na frequência de Nyquist = passa tudo, sem cor nenhuma
  const lowpass = () => {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = open;
    f.Q.value = Math.SQRT1_2;
    return f;
  };
  const master = m.destination; // masterMuteNode do Phaser (mudo geral) → masterVolumeNode
  const mk = (filtered) => {
    const b = { in: gain() };
    if (filtered) {
      b.lp = lowpass();
      b.duck = gain();
      b.in.connect(b.lp);
      b.lp.connect(b.duck);
      b.duck.connect(master);
    } else b.in.connect(master);
    return b;
  };
  bus = { music: mk(true), sfx: mk(true), ui: mk(false), open };
  // Limitador entre o mestre e a saída (só age nos picos acima do limiar) + o ganho que desfaz
  // a compensação automática do nó
  const L = AUDIO.LIMITER;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = L.THRESHOLD_DB;
  lim.knee.value = L.KNEE_DB;
  lim.ratio.value = L.RATIO;
  lim.attack.value = L.ATTACK_S;
  lim.release.value = L.RELEASE_S;
  const trim = gain();
  trim.gain.value = 1 / limiterMakeup(L);
  m.masterVolumeNode.disconnect();
  m.masterVolumeNode.connect(lim);
  lim.connect(trim);
  trim.connect(c.destination);
  bus.limiter = lim;
  mgr = m;
  ctx = c;
  applyVolumes(true);
  return true;
}

// Volume do jogador → ganho de cada barramento. Arrastando a barra, suave (sem estalo); no boot,
// direto (o relógio do áudio pode nem ter começado: uma rampa deixaria a 1ª música vazar)
export function applyVolumes(instant = false) {
  if (!bus) return refreshFallback();
  const t = ctx.currentTime;
  if (ctx.state !== "running") instant = true; // relógio parado: rampa só andaria depois
  for (const ch of ["music", "sfx", "ui"]) {
    const g = dbToGain(AUDIO.BUS_DB[ch] ?? 0) * sliderGain(settingOf(ch));
    const p = bus[ch].in.gain;
    p.cancelScheduledValues(t);
    if (instant) p.value = g;
    else p.setTargetAtTime(g, t, 0.015);
  }
}

// Sem WebAudio: reaplica o volume às músicas que já estão tocando (esquema antigo)
function refreshFallback() {
  if (!game?.sound?.sounds) return;
  for (const s of game.sound.sounds) if (isMusicKey(s.key)) s.setVolume((s._baseVol ?? 1) * sliderGain(Settings.get("music")));
}

const usesBuses = (m) => !!bus && m === mgr;

// O jogo não usa som posicional: o painel 3D de cada voz (fonte e ouvinte no mesmo ponto) não muda
// nada no que sai, só custa processamento. Sai da corrente; o painel estéreo faz a mesma divisão
// mono → estéreo (−3 dB por lado), então o volume é idêntico
function dropSpatial(snd, config) {
  if (!snd.spatialNode || !snd.pannerNode || config?.source) return;
  snd.volumeNode.disconnect();
  snd.volumeNode.connect(snd.pannerNode);
  snd.spatialNode.disconnect();
  snd.spatialNode = null;
}

// O Phaser lê o volume da voz no AudioParam (gain.value), que só atualiza no próximo bloco do áudio:
// logo depois de add(…, {volume: 0}) ainda diz 1, e um tween "de 0 até 0,2" começava no volume CHEIO
// e descia (fogueira e música da cena da 1ª queda entravam num estouro). Lê o valor pedido
function fixVolumeGetter() {
  const proto = Phaser.Sound.WebAudioSound?.prototype;
  const d = proto && Object.getOwnPropertyDescriptor(proto, "volume");
  if (!d?.get || !d.set || proto.__guardiaoVolume) return;
  proto.__guardiaoVolume = true;
  Object.defineProperty(proto, "volume", {
    configurable: true,
    enumerable: d.enumerable,
    get() {
      return this.currentConfig?.volume ?? d.get.call(this);
    },
    set: d.set,
  });
}

export function installMixer(g) {
  game = g;
  Settings.migrateVolumes(sliderFromLinear); // save da barra linear antiga: o mesmo volume na barra nova
  if (build(g.sound)) fixVolumeGetter();
  Settings.onChange((k) => (k === "music" || k === "sfx") && applyVolumes());
  const protos = [Phaser.Sound.WebAudioSoundManager, Phaser.Sound.HTML5AudioSoundManager, Phaser.Sound.BaseSoundManager]
    .filter(Boolean)
    .map((c) => c.prototype);
  for (const proto of protos) {
    if (proto.__guardiaoMixer) continue;
    proto.__guardiaoMixer = true;
    if (Object.prototype.hasOwnProperty.call(proto, "add")) {
      const add = proto.add;
      proto.add = function (key, config = {}) {
        if (!usesBuses(this)) {
          // esquema antigo: o volume do canal entra no volume do som
          const base = config.volume ?? 1;
          const snd = add.call(this, key, { ...config, volume: base * sliderGain(settingOf(channelOf(key, config))) });
          if (snd) snd._baseVol = base;
          return snd;
        }
        const ch = pendingChannel ?? channelOf(key, config);
        const dest = this.destination;
        this.destination = bus[ch].in; // o construtor do som liga a saída da voz aqui
        let snd;
        try {
          snd = add.call(this, key, config);
        } finally {
          this.destination = dest;
        }
        if (snd) {
          snd._channel = ch;
          dropSpatial(snd, config);
        }
        return snd;
      };
    }
    // play(key, {volume}) cria o som por add(key) e só depois aplica o config. Efeito comum (não
    // música, não interface, não aviso de chefe) passa pelo limite de vozes, sorteia a tomada e o tom
    if (Object.prototype.hasOwnProperty.call(proto, "play")) {
      const play = proto.play;
      proto.play = function (key, extra) {
        if (extra?.name) return play.call(this, key, extra); // marcador de áudio: como o Phaser faz
        let cfg = extra && typeof extra === "object" ? extra : null;
        const ch = channelOf(key, cfg);
        const fx = ch === "sfx" && !cfg?.alert;
        const frame = game?.loop?.frame ?? 0;
        if (fx && !gate.admit(key, performance.now())) {
          const m = gate.merge(key, frame);
          if (m) setVoiceVolume(m.voice, m.gain);
          return false;
        }
        const k = ch === "music" ? key : variantOf(key);
        if (cfg || fx) {
          cfg = { ...cfg };
          delete cfg.alert;
          delete cfg.bus;
          const j = fx ? AUDIO.JITTER[key] : 0;
          if (j) cfg.rate = (cfg.rate ?? 1) * (1 + (Math.random() * 2 - 1) * j);
          if (!usesBuses(this)) cfg.volume = (cfg.volume ?? 1) * sliderGain(settingOf(ch));
          extra = cfg;
        }
        pendingChannel = usesBuses(this) ? ch : null;
        let r;
        try {
          r = play.call(this, k, extra);
        } finally {
          pendingChannel = null;
        }
        if (fx) gate.started(key, this.sounds?.[this.sounds.length - 1], cfg?.volume ?? 1, frame);
        return r;
      };
    }
  }
}

const gate = new VoiceGate(AUDIO.VOICES, AUDIO.MERGE_MAX);
const lastVariant = {};
// Tomada do som: sorteia entre as variações (AUDIO.VARIANTS) sem repetir a da vez anterior
function variantOf(key) {
  const list = AUDIO.VARIANTS[key];
  if (!list || !game?.cache?.audio) return key;
  const ok = list.filter((k) => k !== lastVariant[key] && game.cache.audio.exists(k));
  if (!ok.length) return key;
  return (lastVariant[key] = ok[Math.floor(Math.random() * ok.length)]);
}
// Engrossa uma voz que acabou de começar (o excesso do quadro): rampa curtinha, sem estalo
function setVoiceVolume(voice, v) {
  if (!voice || voice.pendingRemove) return;
  const p = voice.volumeNode?.gain;
  if (!p || !ctx) return voice.setVolume?.(v);
  if (voice.currentConfig) voice.currentConfig.volume = v;
  p.setTargetAtTime(v, ctx.currentTime, 0.004);
}

// ---------------------------------------------------------------------------
// MOMENTOS: o mesmo grupo de sons muda de cor conforme a situação da partida
// ---------------------------------------------------------------------------
const state = { moment: "normal", danger: false };
const fading = new Set(); // trilhas saindo (troca no compasso): somem sozinhas ou no reset()

// Desliza um AudioParam até o valor em `dur` s, em escala exponencial (frequência e ganho em dB
// soam lineares assim), partindo de onde ele estiver agora (mesmo no meio de outra rampa)
function glide(p, v, t, dur) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
  if (dur <= 0) return p.setValueAtTime(v, t);
  if (v > 0 && p.value > 0) p.exponentialRampToValueAtTime(v, t + dur);
  else p.linearRampToValueAtTime(v, t + dur);
}

// Recalcula para onde os barramentos vão (momento + perigo) e desliza até lá
function retarget(dur) {
  if (!bus) return;
  const t = ctx.currentTime;
  const open = bus.open;
  const M = state.moment;
  const MU = AUDIO.MUFFLE,
    D = AUDIO.DANGER,
    X = AUDIO.DEATH;
  let mLP = open,
    mDB = 0,
    sLP = open,
    sDB = 0;
  if (M === "muffle") {
    mLP = sLP = MU.LP_HZ;
    mDB = sDB = MU.DB;
  } else if (M === "death") {
    mLP = X.LP_HZ; // o volume da música cai na própria voz (fita parando)
    sLP = X.SFX_LP_HZ;
    sDB = X.SFX_DB;
  }
  if (state.danger && M !== "death") {
    mLP = Math.min(mLP, D.MUSIC_LP_HZ);
    mDB += D.MUSIC_DB;
  }
  glide(bus.music.lp.frequency, mLP, t, dur);
  glide(bus.music.duck.gain, dbToGain(mDB), t, dur);
  glide(bus.sfx.lp.frequency, sLP, t, dur);
  glide(bus.sfx.duck.gain, dbToGain(sDB), t, dur);
}

// "normal" | "muffle" (pausa, cartas, Reviver) | "death" (use tapeStop). Repetir não reinicia a rampa
export function setMoment(m) {
  if (state.moment === m) return;
  const was = state.moment;
  state.moment = m;
  const MU = AUDIO.MUFFLE;
  retarget(m === "muffle" ? MU.IN_S : m === "death" ? AUDIO.DEATH.S : was === "muffle" ? MU.OUT_S : 0.2);
}

// Vida baixa (GameFeel cuida da histerese e do batimento)
export function setDanger(on) {
  on = !!on;
  if (state.danger === on) return;
  state.danger = on;
  if (state.moment !== "death") retarget(on ? AUDIO.DANGER.IN_S : AUDIO.DANGER.OUT_S); // a fita parando manda
}

// Tudo de volta ao normal NA HORA (partida nova, troca de cena) e as trilhas que saíam somem
export function resetMix() {
  state.moment = "normal";
  state.danger = false;
  retarget(0);
  for (const s of fading) if (!s.pendingRemove) s.destroy();
  fading.clear();
}

// Morte: a fita para. A trilha desacelera (rate 1 → DEATH.RATE), fecha no passa-baixa e some;
// os efeitos abafam junto. Quem chamou para/destrói a trilha depois (a câmera lenta dura 0,9 s)
export function tapeStop(snd) {
  setMoment("death");
  if (!bus || !snd?.source || !snd.volumeNode) return;
  const X = AUDIO.DEATH;
  const t = ctx.currentTime;
  // trilha em camadas (MusicLayers.js): todas desaceleram juntas
  for (const src of snd.sources ?? [snd.source, snd.loopSource]) {
    if (!src) continue;
    const p = src.playbackRate;
    glide(p, p.value * X.RATE, t, X.S);
  }
  const g = snd.volumeNode.gain;
  const v = snd.volume;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
  else g.cancelScheduledValues(t);
  g.setValueAtTime(v, t);
  g.setValueAtTime(v, t + X.S * 0.4);
  g.exponentialRampToValueAtTime(Math.max(1e-4, v * 1e-3), t + X.S);
  g.setValueAtTime(0, t + X.S);
}

// Troca de trilha NO COMPASSO. A atual afunda na hora (o rugido do chefe fica sozinho) e some até a
// próxima barra; a nova entra num tempo forte da mesma grade, depois de enterAfterS. Devolve a nova.
// Sem WebAudio (ou sem saber o andamento): o corte de antes, só que sem deixar a velha no gerenciador.
// A velha ou a nova podem ser trilhas em camadas (createMusic, MusicLayers.js)
export function switchTrack(sound, old, key, cfg = {}, { enterAfterS = 0 } = {}) {
  const next = createMusic(sound, key, cfg);
  const info = old && MUSIC_INFO[old.key];
  if (!bus || !info || !old.isPlaying || !old.volumeNode) {
    if (old && !old.pendingRemove) old.destroy();
    next.play();
    return next;
  }
  const S = AUDIO.SWITCH;
  const t = ctx.currentTime;
  const spb = 60 / (info.bpm * (old.totalRate || 1)); // segundos reais por tempo
  const beats = ((old.seek || 0) * info.bpm) / 60; // onde a trilha está, em tempos (seek = tempo do buffer)
  let toBar = (4 - (beats % 4)) * spb;
  if (toBar < S.MIN_FADE_BEATS * spb) toBar += 4 * spb;
  const end = t + toBar;
  const grid = S.GRID_BEATS * spb;
  const enter = end + Math.ceil(Math.max(0, t + enterAfterS - end) / grid - 1e-6) * grid;
  const g = old.volumeNode.gain;
  const v = old.volume;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
  else g.cancelScheduledValues(t);
  g.setValueAtTime(v, t);
  g.linearRampToValueAtTime(v * dbToGain(S.DIP_DB), t + Math.min(S.DIP_S, toBar * 0.5));
  g.exponentialRampToValueAtTime(Math.max(1e-4, v * 1e-3), end);
  g.setValueAtTime(0, end);
  fading.add(old);
  setTimeout(() => {
    fading.delete(old);
    if (!old.pendingRemove) old.destroy();
  }, (end - t) * 1000 + 80);
  next.play({ delay: enter - t });
  return next;
}

// Para testes e depuração: estado dos barramentos
export const Mixer = {
  get active() {
    return !!bus;
  },
  get buses() {
    return bus;
  },
  get context() {
    return ctx;
  },
  get state() {
    return { ...state, fading: fading.size };
  },
};
