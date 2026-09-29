// Áudio 100% próprio: efeitos e músicas SINTETIZADOS no carregamento (estilo
// chiptune), gravados como AudioBuffer no cache de áudio do Phaser. O resto do
// jogo usa as mesmas chaves de sempre ("sfx_hit", "music_gameplay"...).
const SR = 22050; // taxa de amostragem (chiptune não precisa de mais)
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// PRNG determinístico pro ruído (mesmo som toda vez)
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

// Ondas básicas por fase (0..1)
const sq = (ph, duty = 0.5) => ((ph % 1) < duty ? 1 : -1);
const tri = (ph) => 4 * Math.abs((ph % 1) - 0.5) - 1;
const saw = (ph) => 2 * (ph % 1) - 1;

// ---------------------------------------------------------------------------
// EFEITOS: cada um é fn(t, dur) → amostra, com fase acumulada pelo gerador
// ---------------------------------------------------------------------------
function renderSfx(dur, gen, gain = 0.8) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  const st = { ph: 0, ph2: 0, ph3: 0, lp: 0, hp: 0, prev: 0, gate: 1 };
  for (let i = 0; i < n; i++) out[i] = gen(i / SR, st, i);
  return normalize(out, gain);
}

function normalize(buf, peak) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((buf[i] / m) * 1.2) * peak;
  // micro fade no fim (evita estalo)
  const f = Math.min(200, buf.length);
  for (let i = 0; i < f; i++) buf[buf.length - 1 - i] *= i / f;
  return buf;
}

// Oscilador com frequência variável: acumula fase em st[key]
const osc = (st, key, f) => (st[key] += f / SR);
const lp = (st, x, a, key = "lp") => (st[key] += a * (x - st[key]));
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

const SFX = {
  sfx_hit: [0.09, (t, s) => {
    const f = 180 * Math.exp(-t * 25) + 70;
    return sq(osc(s, "ph", f), 0.4) * env(t, 0.002, 0.03) * 0.6 + lp(s, noise(), 0.35) * env(t, 0.001, 0.02);
  }],
  sfx_death: [0.26, (t, s) => {
    const f = 140 * Math.exp(-t * 9) + 40;
    return Math.sin(TAU * osc(s, "ph", f)) * env(t, 0.003, 0.09) * 0.8 + lp(s, noise(), 0.5 * Math.exp(-t * 8) + 0.05) * env(t, 0.002, 0.08);
  }],
  sfx_pickup: [0.07, (t, s) => sq(osc(s, "ph", 880 + t * 7000), 0.25) * env(t, 0.002, 0.03)],
  sfx_levelup: [0.62, (t, s) => {
    const notes = [72, 76, 79, 84, 88];
    const k = Math.min(notes.length - 1, Math.floor(t / 0.08));
    const f = mtof(notes[k]);
    const tt = t - k * 0.08;
    return (sq(osc(s, "ph", f), 0.25) * 0.6 + tri(osc(s, "ph2", f * 2)) * 0.3) * env(tt, 0.004, k === notes.length - 1 ? 0.2 : 0.07);
  }],
  sfx_player_hit: [0.16, (t, s) => {
    const f = 260 * Math.exp(-t * 10) + 90;
    return (sq(osc(s, "ph", f), 0.5) * 0.7 + noise() * 0.4) * env(t, 0.001, 0.06);
  }],
  sfx_boss_roar: [1.1, (t, s) => {
    const f = 62 + Math.sin(t * 22) * 6 - t * 18;
    const x = saw(osc(s, "ph", f)) * 0.7 + saw(osc(s, "ph2", f * 1.51)) * 0.35 + lp(s, noise(), 0.15) * 0.8;
    return Math.tanh(x * 2.5) * env(t, 0.08, 0.45);
  }],
  sfx_chest_open: [0.32, (t, s) => {
    const f = 190 + t * 260 + Math.sin(t * 90) * 30;
    return saw(osc(s, "ph", f)) * 0.35 * (t < 0.24 ? 1 : 0) * env(t, 0.01, 0.2) + (t > 0.24 ? noise() * env(t - 0.24, 0.001, 0.02) : 0);
  }],
  sfx_chest_reel: [0.05, (t, s) => sq(osc(s, "ph", 1250), 0.5) * env(t, 0.001, 0.015)],
  sfx_chest_jackpot: [1.1, (t, s) => {
    const notes = [72, 76, 79, 84, 79, 84, 88, 91];
    const k = Math.min(notes.length - 1, Math.floor(t / 0.1));
    const tt = t - k * 0.1;
    const f = mtof(notes[k]);
    const sparkle = Math.sin(TAU * osc(s, "ph2", 3000 + Math.sin(t * 40) * 400)) * 0.15 * env(t, 0.3, 0.4);
    return (sq(osc(s, "ph", f), 0.5) * 0.5 + tri(s.ph * 0.5) * 0.3) * env(tt, 0.003, k === 7 ? 0.35 : 0.09) + sparkle;
  }],
  sfx_chest_trap: [0.6, (t, s) => {
    const f1 = mtof(62 - t * 14),
      f2 = mtof(56 - t * 14); // trítono descendo
    return (sq(osc(s, "ph", f1), 0.5) + sq(osc(s, "ph2", f2), 0.5)) * 0.4 * env(t, 0.005, 0.25);
  }],
  sfx_coin: [0.14, (t, s) => sq(osc(s, "ph", t < 0.05 ? 988 : 1319), 0.5) * env(t, 0.002, t < 0.05 ? 0.2 : 0.05) * 0.6],
  sfx_coin_cascade: [0.5, (t, s) => {
    const k = Math.floor(t / 0.06);
    const tt = t - k * 0.06;
    return sq(osc(s, "ph", mtof(84 + ((k * 5) % 12))), 0.5) * env(tt, 0.002, 0.025) * 0.5;
  }],
  sfx_ui_click: [0.04, (t, s) => sq(osc(s, "ph", 620 - t * 3000), 0.5) * env(t, 0.001, 0.012)],
  sfx_ui_hover: [0.03, (t, s) => Math.sin(TAU * osc(s, "ph", 1400)) * env(t, 0.001, 0.01) * 0.5],
  sfx_dash: [0.22, (t, s) => {
    const a = 0.08 + t * 1.6; // "abre" o filtro: whoosh subindo
    const x = lp(s, noise(), Math.min(0.9, a));
    s.hp = x - s.prev;
    s.prev = x;
    return (x * 0.6 + s.hp * 0.4) * env(t, 0.03, 0.08);
  }],
  sfx_fire_attack: [0.3, (t, s) => {
    const x = lp(s, noise(), 0.25 + 0.3 * Math.exp(-t * 10));
    return x * env(t, 0.01, 0.12) + Math.sin(TAU * osc(s, "ph", 90 - t * 60)) * 0.4 * env(t, 0.005, 0.08);
  }],
  sfx_ice_attack: [0.4, (t, s) => {
    const bell = Math.sin(TAU * osc(s, "ph", 1760)) * 0.5 + Math.sin(TAU * osc(s, "ph2", 2637)) * 0.35;
    const hiss = noise();
    s.hp = hiss - s.prev;
    s.prev = hiss;
    return bell * env(t, 0.002, 0.14) + s.hp * 0.2 * env(t, 0.001, 0.05);
  }],
  // Raio com PRESENÇA: estalo seco (ruído agudo) → crepitar elétrico (dente de
  // serra grave com picotes aleatórios) → ribombo de trovão (ruído grave + sub)
  sfx_bolt_attack: [0.75, (t, s) => {
    const x = noise();
    s.hp = x - s.prev; // agudo: o "CRACK"
    s.prev = x;
    const crack = s.hp * 1.4 * env(t, 0.0005, 0.018);
    if (rnd() < 0.08) s.gate = rnd() < 0.55 ? 1 : 0.15; // picote irregular do arco
    const buzzF = 95 + Math.sin(t * 60) * 15 + noise() * 25;
    const buzz = (saw(osc(s, "ph", buzzF)) * 0.7 + sq(osc(s, "ph2", buzzF * 2.01), 0.3) * 0.3) * (s.gate ?? 1) * env(t, 0.004, 0.11);
    const rumble = lp(s, noise(), 0.035) * 5 * env(t, 0.03, 0.28); // trovão ao fundo
    const sub = Math.sin(TAU * osc(s, "ph3", 48 - t * 20)) * 0.55 * env(t, 0.005, 0.18);
    return Math.tanh((crack + buzz * 0.8 + rumble + sub) * 1.6);
  }],
  sfx_react_vapor: [0.7, (t, s) => {
    const x = noise();
    s.hp = x - s.prev;
    s.prev = x;
    return s.hp * env(t, 0.03, 0.28);
  }],
  sfx_react_crystal: [0.45, (t, s, i) => {
    let v = 0;
    for (let k = 0; k < 4; k++) {
      const st = k * 0.04;
      if (t > st) v += Math.sin(TAU * (t - st) * (2200 + k * 530)) * env(t - st, 0.001, 0.07);
    }
    return v * 0.35 + noise() * 0.35 * env(t, 0.001, 0.03);
  }],
  sfx_react_overload: [0.55, (t, s) => {
    const gate = Math.sin(t * 190) > 0.2 ? 1 : 0.1;
    return saw(osc(s, "ph", 110 + noise() * 20)) * gate * 0.6 * env(t, 0.01, 0.22) + noise() * 0.25 * env(t, 0.001, 0.08);
  }],
};

// ---------------------------------------------------------------------------
// MÚSICA: sequenciador simples → eventos {beat, len, midi, inst, vol}
// ---------------------------------------------------------------------------
const INST = {
  lead: (ph, t, f) => sq(ph, 0.25) * 0.8 + sq(ph * 2.002, 0.5) * 0.12,
  lead2: (ph) => sq(ph, 0.5) * 0.7 + saw(ph * 1.003) * 0.3,
  tri: (ph) => tri(ph),
  bass: (ph) => sq(ph, 0.5) * 0.6 + tri(ph) * 0.4,
  pad: (ph) => saw(ph) * 0.5 + saw(ph * 1.006) * 0.5,
};

function renderSong(song) {
  const spb = 60 / song.bpm;
  const total = Math.floor(song.beats * spb * SR);
  const out = new Float32Array(total);
  const add = (start, s) => {
    let idx = (start % total + total) % total; // cauda "dá a volta" (loop sem emenda)
    out[idx] += s;
  };
  for (const e of song.events) {
    const s0 = Math.floor(e.beat * spb * SR);
    const lenS = Math.floor(e.len * spb * SR);
    const rel = e.rel ?? 0.06;
    const n = lenS + Math.floor(rel * SR);
    if (e.drum) {
      renderDrum(e.drum, s0, e.vol, add);
      continue;
    }
    const f = mtof(e.midi);
    const inst = INST[e.inst];
    let ph = 0,
      lpv = 0;
    const atk = e.atk ?? 0.005;
    const cut = e.cut ?? 1; // passa-baixa (0..1) — pad fica macio
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const vib = e.vib ? 1 + Math.sin(t * 34) * 0.006 * Math.min(1, t * 3) : 1;
      ph += (f * vib) / SR;
      let a = t < atk ? t / atk : 1;
      if (i > lenS) a *= Math.max(0, 1 - (i - lenS) / (rel * SR));
      else if (e.decay) a *= Math.exp(-t / e.decay) * 0.7 + 0.3;
      let x = inst(ph, t, f) * a;
      lpv += cut * (x - lpv);
      add(s0 + i, lpv * e.vol);
    }
  }
  return normalize(out, 0.85);
}

function renderDrum(kind, s0, vol, add) {
  if (kind === "kick") {
    let ph = 0;
    for (let i = 0; i < SR * 0.22; i++) {
      const t = i / SR;
      ph += (45 + 110 * Math.exp(-t * 32)) / SR;
      add(s0 + i, Math.sin(TAU * ph) * Math.exp(-t * 11) * vol);
    }
  } else if (kind === "snare") {
    let prev = 0;
    for (let i = 0; i < SR * 0.16; i++) {
      const t = i / SR;
      const x = noise();
      const hp = x - prev;
      prev = x;
      add(s0 + i, (hp * 0.55 * Math.exp(-t * 18) + tri(t * 185) * 0.35 * Math.exp(-t * 30)) * vol);
    }
  } else if (kind === "hat") {
    let prev = 0;
    for (let i = 0; i < SR * 0.035; i++) {
      const x = noise();
      add(s0 + i, (x - prev) * Math.exp(-(i / SR) * 90) * vol);
      prev = x;
    }
  } else if (kind === "tom") {
    let ph = 0;
    for (let i = 0; i < SR * 0.2; i++) {
      const t = i / SR;
      ph += (90 + 60 * Math.exp(-t * 15)) / SR;
      add(s0 + i, Math.sin(TAU * ph) * Math.exp(-t * 12) * vol);
    }
  }
}

// Helpers de composição
const CH = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [60, 64, 67], G: [55, 59, 62], E: [52, 56, 59],
  Dm: [50, 53, 57], Bb: [46, 50, 53], C3: [48, 52, 55], Am3: [45, 48, 52], Gm: [43, 46, 50], A: [45, 49, 52],
  Em: [40, 43, 47], Cb: [36, 40, 43], D: [38, 42, 45], B: [35, 39, 42],
};
const melody = (list, startBeat, inst, vol, extra = {}) => {
  const ev = [];
  let b = startBeat;
  for (const [m, len] of list) {
    if (m != null) ev.push({ beat: b, len: len * 0.92, midi: m, inst, vol, vib: true, ...extra });
    b += len;
  }
  return ev;
};

// Menu — "Clareira" (Lá menor, calmo): pad + arpejo + baixo; melodia na 2ª metade
function songMenu() {
  const prog = ["Am", "F", "C", "G", "Am", "F", "G", "E"];
  const ev = [];
  for (let bar = 0; bar < 16; bar++) {
    const ch = CH[prog[bar % 8]];
    const b0 = bar * 4;
    ch.forEach((m) => ev.push({ beat: b0, len: 4, midi: m, inst: "pad", vol: 0.065, atk: 0.4, rel: 0.5, cut: 0.08 }));
    ev.push({ beat: b0, len: 1.8, midi: ch[0] - 12, inst: "tri", vol: 0.32 });
    ev.push({ beat: b0 + 2, len: 1.8, midi: ch[0] - 12, inst: "tri", vol: 0.28 });
    [0, 1, 2, 1, 0, 1, 2, 1].forEach((k, i) =>
      ev.push({ beat: b0 + i * 0.5, len: 0.4, midi: ch[k] + 12, inst: "tri", vol: 0.16, decay: 0.2 }),
    );
  }
  ev.push(
    ...melody(
      [
        [76, 1.5], [74, 0.5], [72, 1], [74, 1], [72, 1], [69, 1], [72, 0.5], [74, 0.5], [76, 1],
        [79, 1.5], [76, 0.5], [74, 1], [72, 1], [74, 2], [71, 1], [null, 1],
        [76, 1.5], [74, 0.5], [72, 1], [69, 1], [72, 1], [74, 1], [76, 1], [79, 1],
        [81, 1.5], [79, 0.5], [76, 1], [74, 1], [76, 3], [null, 1],
      ],
      32,
      "lead",
      0.13,
      { rel: 0.15 },
    ),
  );
  return { bpm: 84, beats: 64, events: ev };
}

// Partida — "Horda" (Ré menor, 132 BPM): bateria, baixo pulsante, melodia;
// segunda volta com arpejo em 16avos e melodia uma oitava acima.
function songGame() {
  const prog = ["Dm", "Bb", "C3", "Am3", "Dm", "Bb", "Gm", "A"];
  const ev = [];
  const lead = [
    [74, 0.5], [77, 0.5], [81, 1], [79, 0.5], [77, 0.5], [76, 1],
    [77, 1], [74, 1], [70, 1], [74, 1],
    [72, 0.5], [76, 0.5], [79, 1], [77, 0.5], [76, 0.5], [72, 1],
    [76, 1.5], [74, 0.5], [72, 1], [69, 1],
    [74, 0.5], [77, 0.5], [81, 1], [84, 1], [81, 1],
    [82, 1.5], [81, 0.5], [79, 1], [77, 1],
    [79, 1], [82, 1], [81, 1], [79, 1],
    [81, 2], [73, 1], [76, 1],
  ];
  for (let pass = 0; pass < 2; pass++) {
    const P = pass * 32;
    for (let bar = 0; bar < 8; bar++) {
      const ch = CH[prog[bar]];
      const b0 = P + bar * 4;
      const root = ch[0] - 12;
      [0, 0, 12, 0, 0, 7, 12, 0].forEach((iv, i) => ev.push({ beat: b0 + i * 0.5, len: 0.4, midi: root + iv, inst: "bass", vol: 0.26, cut: 0.35 }));
      for (let q = 0; q < 4; q++) {
        ev.push({ beat: b0 + q, drum: q % 2 ? "snare" : "kick", vol: q % 2 ? 0.5 : 0.9 });
        ev.push({ beat: b0 + q + 0.5, drum: "hat", vol: 0.35 });
        ev.push({ beat: b0 + q, drum: "hat", vol: 0.2 });
      }
      if (bar === 7) ev.push({ beat: b0 + 3.5, drum: "kick", vol: 0.7 });
      if (pass === 1)
        for (let i = 0; i < 16; i++) ev.push({ beat: b0 + i * 0.25, len: 0.2, midi: ch[i % 3] + 24, inst: "lead", vol: 0.05, decay: 0.08 });
    }
    ev.push(...melody(lead, P, pass ? "lead2" : "lead", 0.12)); // 2ª volta: timbre mais cheio
  }
  return { bpm: 132, beats: 64, events: ev };
}

// Chefe — "O Ancião" (Mi menor, 150 BPM): baixo em 16avos, bumbo em 4, tons
function songBoss() {
  const prog = ["Em", "Cb", "D", "B"];
  const ev = [];
  for (let bar = 0; bar < 16; bar++) {
    const ch = CH[prog[bar % 4]];
    const b0 = bar * 4;
    for (let i = 0; i < 16; i++) ev.push({ beat: b0 + i * 0.25, len: 0.2, midi: ch[0] + (i % 4 === 2 ? 12 : 0), inst: "bass", vol: 0.24, cut: 0.4 });
    for (let q = 0; q < 4; q++) {
      ev.push({ beat: b0 + q, drum: "kick", vol: 0.9 });
      if (q % 2) ev.push({ beat: b0 + q, drum: "snare", vol: 0.55 });
      ev.push({ beat: b0 + q + 0.5, drum: "hat", vol: 0.35 });
    }
    if (bar % 4 === 3) [0, 0.25, 0.5, 0.75].forEach((o, k) => ev.push({ beat: b0 + 3 + o, drum: "tom", vol: 0.6 - k * 0.08 }));
    ch.forEach((m) => ev.push({ beat: b0, len: 4, midi: m + 24, inst: "pad", vol: 0.06, atk: 0.1, cut: 0.1 }));
  }
  const riff = [
    [71, 0.5], [76, 0.5], [79, 0.5], [83, 0.5], [81, 1], [79, 1],
    [78, 1], [76, 0.5], [78, 0.5], [79, 1], [76, 1],
    [74, 0.5], [79, 0.5], [83, 1], [81, 0.5], [79, 0.5], [78, 1],
    [78, 2], [75, 2],
  ];
  ev.push(...melody(riff, 16, "lead2", 0.11));
  ev.push(...melody(riff.map(([m, l]) => [m + 12, l]), 48, "lead2", 0.1));
  return { bpm: 150, beats: 64, events: ev };
}

// ---------------------------------------------------------------------------
// Registro no cache de áudio do Phaser (só WebAudio — todo Android moderno)
// ---------------------------------------------------------------------------
export function registerAudio(game) {
  const ctx = game.sound.context;
  if (!ctx || !game.cache?.audio) return false;
  const toBuffer = (data) => {
    const b = ctx.createBuffer(1, data.length, SR);
    b.getChannelData(0).set(data);
    return b;
  };
  for (const [key, [dur, gen]] of Object.entries(SFX)) {
    seed = key.length * 7919; // ruído determinístico por som
    game.cache.audio.add(key, toBuffer(renderSfx(dur, gen)));
  }
  game.cache.audio.add("music_menu", toBuffer(renderSong(songMenu())));
  game.cache.audio.add("music_gameplay", toBuffer(renderSong(songGame())));
  game.cache.audio.add("music_boss", toBuffer(renderSong(songBoss())));
  return true;
}
