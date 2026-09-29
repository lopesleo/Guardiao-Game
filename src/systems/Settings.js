// Configurações do jogador (persistidas). Aplicadas por GANCHOS globais
// instalados 1x no boot — assim nenhum dos ~80 pontos que tocam som ou
// tremem a câmera precisa saber das opções.
const KEY = "guardiao_settings_v1";
const DEFAULTS = {
  music: 0.7,
  sfx: 0.8,
  haptics: true,
  shake: true,
  dmgNumbers: true,
};

let cache = null;

export const Settings = {
  all() {
    if (cache) return cache;
    cache = { ...DEFAULTS };
    try {
      Object.assign(cache, JSON.parse(localStorage.getItem(KEY) || "{}"));
      // Migra o volume único antigo (slider do menu) pros dois canais
      const old = parseFloat(localStorage.getItem("guardiao_volume_v1"));
      if (!localStorage.getItem(KEY) && !isNaN(old)) cache.music = cache.sfx = old;
    } catch {}
    return cache;
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
    if (k === "music") refreshMusic();
  },
};

let game = null;
const isMusic = (key) => typeof key === "string" && key.startsWith("music");

// Reaplica o volume de música às faixas que já estão tocando
function refreshMusic() {
  if (!game) return;
  for (const s of game.sound.sounds) {
    if (isMusic(s.key)) s.setVolume((s._baseVol ?? 1) * Settings.get("music"));
  }
}

export function installSettingsHooks(g) {
  game = g;
  const managers = [Phaser.Sound.WebAudioSoundManager, Phaser.Sound.HTML5AudioSoundManager, Phaser.Sound.BaseSoundManager]
    .filter(Boolean)
    .map((c) => c.prototype);
  for (const proto of managers) {
    if (proto.__guardiaoHooked) continue;
    proto.__guardiaoHooked = true;
    if (Object.prototype.hasOwnProperty.call(proto, "add")) {
      const add = proto.add;
      proto.add = function (key, config = {}) {
        const base = config.volume ?? 1;
        const mult = isMusic(key) ? Settings.get("music") : Settings.get("sfx");
        const snd = add.call(this, key, { ...config, volume: base * mult });
        if (snd) snd._baseVol = base;
        return snd;
      };
    }
    // play(key, {volume}) sobrescreve o volume do add → multiplica aqui também
    if (Object.prototype.hasOwnProperty.call(proto, "play")) {
      const play = proto.play;
      proto.play = function (key, extra) {
        if (extra && typeof extra === "object" && !extra.name) {
          const mult = isMusic(key) ? Settings.get("music") : Settings.get("sfx");
          extra = { ...extra, volume: (extra.volume ?? 1) * mult };
        }
        return play.call(this, key, extra);
      };
    }
  }
  // Tremor de câmera desligável (acessibilidade / enjoo)
  const cam = Phaser.Cameras.Scene2D.Camera.prototype;
  if (!cam.__guardiaoHooked) {
    cam.__guardiaoHooked = true;
    const shake = cam.shake;
    cam.shake = function (...args) {
      if (!Settings.get("shake")) return this;
      return shake.apply(this, args);
    };
  }
  try {
    localStorage.setItem("guardiao_haptics", Settings.get("haptics") ? "1" : "0");
  } catch {}
}
