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
    // play(key, {volume}) cria o som por add(key) e só depois aplica o config
    if (Object.prototype.hasOwnProperty.call(proto, "play")) {
      const play = proto.play;
      proto.play = function (key, extra) {
        const cfg = extra && typeof extra === "object" && !extra.name ? extra : null;
        if (!usesBuses(this)) {
          if (cfg) extra = { ...cfg, volume: (cfg.volume ?? 1) * sliderGain(settingOf(channelOf(key, cfg))) };
          return play.call(this, key, extra);
        }
        pendingChannel = channelOf(key, cfg);
        try {
          return play.call(this, key, extra);
        } finally {
          pendingChannel = null;
        }
      };
    }
  }
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
};
