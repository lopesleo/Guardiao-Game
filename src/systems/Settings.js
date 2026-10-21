// Configurações do jogador (persistidas). Aplicadas por GANCHOS globais
// instalados 1x no boot — assim nenhum dos ~80 pontos que tocam som ou
// tremem a câmera precisa saber das opções (o som fica em src/audio/Mixer.js).
// Este módulo não importa nada: o i18n o lê já no carregamento (import circular quebraria).
const KEY = "guardiao_settings_v1";
// Barras de volume em dB (AUDIO.SLIDER_DB = 40 em config.js). Os padrões dão o mesmo volume da
// barra linear antiga (música 0,7 → −3 dB; efeitos 0,8 → −2 dB). volCurve marca o save convertido
const VOL_CURVE = 1;
const DEFAULTS = {
  music: 0.92,
  sfx: 0.95,
  volCurve: VOL_CURVE,
  haptics: true,
  shake: true,
  softFlash: false, // clarões suaves (fotossensibilidade): flash de tela e luzes passageiras bem mais fracos
  dmgNumbers: true,
  lighting: true,
  font: "pixel", // fonte do jogo (ver FONTS em ui/Theme.js)
  textSize: 0, // índice em TEXT_SIZES (Normal/Grande/Muito grande)
  zoom: 0, // índice em ZOOMS (ui/Zoom.js): aproxima o mundo, a interface fica do mesmo tamanho
  notify: false, // avisos (só no app, só depois que o jogador aceitar)
  notifyAsked: false,
  news: null, // novidades por notificação (News.js): null = segue os avisos; true/false = escolha do jogador
  newsTopic: null, // tópico do FCM em que o aparelho está inscrito (para sair dele ao trocar de idioma)
  telemetry: true, // dados de uso e erros (Firebase, só no app); o jogador pode desligar
  joyMode: "dynamic", // joystick: "dynamic" (nasce onde o dedo encosta) ou "static" (fixo no canto)
  joySide: "left", // lado do joystick ("right" = canhoto: Dash/Despertar e o botão de ação vão para a esquerda)
  joySize: 0, // índice em JOY_SIZES (ui/VirtualJoystick.js)
  fishAssist: false, // pesca assistida: zona verde bem maior e o peixe escapa mais devagar
  lang: null, // idioma (ver i18n/i18n.js); null = o do aparelho
  langDevice: null, // idioma do aparelho quando o jogador escolheu o do jogo (se mudar, o aparelho vence)
};

let cache = null;
let linearVolumes = false; // music/sfx ainda na barra linear antiga (o Mixer converte no boot)
const listeners = [];

export const Settings = {
  all() {
    if (cache) return cache;
    cache = { ...DEFAULTS };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) {
        Object.assign(cache, saved);
        linearVolumes = saved.volCurve !== VOL_CURVE;
      } else {
        // Migra o volume único antigo (slider do menu) pros dois canais
        const old = parseFloat(localStorage.getItem("guardiao_volume_v1"));
        if (!isNaN(old)) {
          cache.music = cache.sfx = old;
          linearVolumes = true;
        }
      }
      // sem a marca até converter: se algo gravar antes (o i18n grava o idioma no carregamento), o
      // save continua dizendo "barra antiga" e a conversão não se perde
      if (linearVolumes) delete cache.volCurve;
    } catch {}
    return cache;
  },
  // Barra linear antiga → barra em dB com o MESMO volume (fromLinear vem do Mixer). Uma vez só
  migrateVolumes(fromLinear) {
    this.all();
    if (!linearVolumes) return false;
    linearVolumes = false;
    for (const k of ["music", "sfx"]) if (typeof cache[k] === "number") cache[k] = fromLinear(cache[k]);
    this.set("volCurve", VOL_CURVE);
    return true;
  },
  // Avisa quem precisa reagir na hora (o Mixer muda o volume dos barramentos)
  onChange(fn) {
    if (!listeners.includes(fn)) listeners.push(fn);
  },
  get(k) {
    return this.all()[k];
  },
  set(k, v) {
    this.all()[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
      if (k === "haptics") localStorage.setItem("guardiao_haptics", v ? "1" : "0");
    } catch {}
    for (const fn of listeners) fn(k, v);
  },
};

// Ganchos de câmera (o som é instalado por installMixer, em src/audio/Mixer.js)
export function installSettingsHooks() {
  // Tremor de câmera desligável (acessibilidade / enjoo)
  const cam = Phaser.Cameras.Scene2D.Camera.prototype;
  if (!cam.__guardiaoHooked) {
    cam.__guardiaoHooked = true;
    const shake = cam.shake;
    cam.shake = function (...args) {
      if (!Settings.get("shake")) return this;
      return shake.apply(this, args);
    };
    // Clarões suaves (fotossensibilidade): o flash de tela começa com 25% da opacidade e dura no
    // mínimo 300 ms (sem piscar rápido). O Phaser guarda a opacidade inicial em flashEffect.alpha
    const flash = cam.flash;
    cam.flash = function (duration = 250, ...rest) {
      const soft = Settings.get("softFlash");
      this.flashEffect.alpha = soft ? 0.25 : 1;
      return flash.call(this, soft ? Math.max(300, duration) : duration, ...rest);
    };
  }
  try {
    localStorage.setItem("guardiao_haptics", Settings.get("haptics") ? "1" : "0");
  } catch {}
}
