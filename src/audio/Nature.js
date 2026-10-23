// Ambiência da Clareira: a mata pela hora do dia, gerada por código (src/audio/Ambience.js toca).
// Fauna brasileira de verdade, no tom de gravação de campo — nada de passarinho de desenho:
//   madrugada/amanhecer: sabiá-laranjeira (frases de flauta, cada uma diferente) e bem-te-vi;
//   dia: cigarras (o coro ao longe e uma que canta perto) e o vento nas folhas;
//   fim de tarde: fogo-apagou (a rolinha do "fo-go-pa-gou"), sabiá, cigarras indo embora, os
//     primeiros grilos;
//   noite: coro de grilos, sapo-ferreiro (a "martelada na bigorna"), sapo-cururu, corujinha-do-mato
//     e o urutau (a mãe-da-lua, de canto que desce de nota em nota).
// Dois tipos de som:
//   · CAMA (amb_bed_<hora>): textura contínua num laço sem emenda (o fim é cruzado com o começo);
//     Ambience.js toca o mesmo laço duas vezes, em lados e velocidades um pouco diferentes, então a
//     soma nunca se repete igual;
//   · CHAMADOS: sílabas curtas (amb_<bicho>_<n>) com a reverberação da mata já embutida; os padrões
//     abaixo (pattern) montam cada canto na hora, sorteando sílabas, tom, pausa e lado: nenhuma frase
//     de sabiá sai igual à outra.
// Só matemática (roda no Worker, na thread principal e no Node). Volume e frequência de cada bicho:
// AUDIO.AMBIENCE no config.

const TAU = Math.PI * 2;
let SR = 22050;

// PRNG determinístico (mulberry32): o mesmo som a cada carga
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Filtro biquad (RBJ). "bp" com pico de 0 dB, "lp", "hp"
class BQ {
  constructor() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, f, q) {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR,
      c = Math.cos(w),
      a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === "bp") [b0, b1, b2] = [a, 0, -a];
    else if (type === "lp") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    const a0 = 1 + a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// Ruído rosa (filtro de Paul Kellet): o "ar" de vento e folhas
function pink(r) {
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  return () => {
    const w = r() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.2;
  };
}

// Valor aleatório que anda devagar e sem quina (interpolação de cosseno), `hz` sorteios por segundo
function drift(r, hz) {
  let a = r(),
    b = r(),
    ph = r();
  return () => {
    ph += hz / SR;
    if (ph >= 1) {
      ph -= 1;
      a = b;
      b = r();
    }
    return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * ph));
  };
}

// ---------------------------------------------------------------------------
// VOZES DAS CAMAS (geradores amostra a amostra)
// ---------------------------------------------------------------------------
// Vento nas folhas: ar (rosa, filtrado) que respira em rajadas + o chiado das folhas, que só aparece
// com a rajada forte (folha batendo em folha)
function breeze(r, level, bright = 1) {
  const air = pink(r),
    g1 = drift(r, 0.11),
    g2 = drift(r, 0.31),
    flutter = drift(r, 13);
  // sem o ronco grave (vento de mata é ar, não trovão: e o grave embolaria com a música)
  const hp = new BQ().set("hp", 190, 0.6),
    lp = new BQ(),
    leafHp = new BQ().set("hp", 2400, 0.7),
    leafLp = new BQ().set("lp", 7000, 0.7);
  let k = 0;
  return () => {
    const g = 0.3 + 0.7 * (g1() * 0.7 + g2() * 0.3);
    if ((k++ & 31) === 0) lp.set("lp", (520 + 1800 * g) * bright, 0.6);
    const a = lp.run(hp.run(air())) * g * 1.6;
    const leaf = leafLp.run(leafHp.run(r() * 2 - 1)) * flutter() ** 3 * g * g * 0.22 * bright;
    return (a + leaf) * level;
  };
}

// Cigarra ao longe: o "tímbalo" é um trem de estalos (rate/s) que faz ressoar o corpo (passa-faixa em fc,
// e um parcial acima): um zumbido com pico agudo. Vem e vai em ondas lentas (swell/s)
function cicadaFar(r, fc, rate, swell, level) {
  const res = new BQ().set("bp", fc, 7),
    res2 = new BQ().set("bp", fc * 1.93, 6),
    lp = new BQ().set("lp", 6200, 0.7),
    sw = drift(r, swell);
  let ph = r();
  return () => {
    ph += (rate * (1 + (r() - 0.5) * 0.05)) / SR;
    let e = (r() * 2 - 1) * 0.06;
    if (ph >= 1) {
      ph -= 1;
      e += 1;
    }
    const s = 0.28 + 0.72 * sw() ** 1.5; // o coro ao longe incha e murcha, mas não some
    return lp.run(res.run(e) + res2.run(e) * 0.3) * s * level * 14;
  };
}

// Um grilo: trinados (chirps) de `pulses` pulsos de seno puro (~4–5 kHz), cada pulso caindo um pouco
// de tom, chirps a `rate` por segundo com o ritmo levemente irregular
function cricket(r, f, rate, pulses, level) {
  const PL = 0.016,
    PG = 0.022,
    span = pulses * (PL + PG);
  let wait = r() / rate,
    pt = -1,
    amp = 1,
    ph = 0;
  return () => {
    wait -= 1 / SR;
    if (wait <= 0) {
      wait = (1 / rate) * (1 + (r() - 0.5) * 0.12);
      pt = 0;
      amp = 0.75 + r() * 0.25;
    }
    if (pt < 0) return 0;
    const k = Math.floor(pt / (PL + PG)),
      u = pt - k * (PL + PG);
    pt += 1 / SR;
    if (pt > span) pt = -1;
    if (k >= pulses || u >= PL) return 0;
    ph += (f * (1 - (0.025 * u) / PL)) / SR;
    const w = Math.sin((Math.PI * u) / PL);
    return Math.sin(TAU * ph) * w * w * amp * level;
  };
}

// Passarinhos ao longe (amanhecer): pios curtíssimos, fracos e sem ritmo — o coro distante
function farBirds(r, density, level) {
  const live = [];
  const lp = new BQ().set("lp", 4200, 0.7);
  return () => {
    if (r() < density / SR) live.push({ t: 0, d: 0.04 + r() * 0.11, f: 2100 + r() * 2500, sw: (r() - 0.5) * 0.6, a: 0.25 + r() * 0.75, ph: 0 });
    let y = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const c = live[i];
      c.t += 1 / SR;
      if (c.t >= c.d) {
        live.splice(i, 1);
        continue;
      }
      const u = c.t / c.d;
      c.ph += (c.f * (1 + c.sw * u)) / SR;
      const w = Math.sin(Math.PI * u);
      y += Math.sin(TAU * c.ph) * w * w * c.a;
    }
    return lp.run(y) * level;
  };
}

// Laço sem emenda: rende `len + fade` amostras e cruza o fim com o começo (potência constante, o
// material não tem fase em comum); a amostra seguinte à última é exatamente a primeira.
// voices: [[gerador, nível]] — cada voz entra com o volume (RMS) pedido, relativo às outras
function* seamless(lenS, fadeS, voices) {
  const len = Math.round(lenS * SR),
    fade = Math.round(fadeS * SR),
    n = len + fade;
  const raw = new Float32Array(n);
  const one = new Float32Array(n);
  for (const [v, level] of voices) {
    let ss = 0;
    for (let i = 0; i < n; i++) {
      const x = v();
      one[i] = x;
      ss += x * x;
      if ((i & 16383) === 16383) yield;
    }
    const g = ss > 0 ? level / Math.sqrt(ss / n) : 0;
    for (let i = 0; i < n; i++) raw[i] += one[i] * g;
  }
  const out = raw.slice(0, len);
  for (let i = 0; i < fade; i++) {
    const t = ((i + 0.5) / fade) * (Math.PI / 2);
    out[i] = raw[i] * Math.sin(t) + raw[len + i] * Math.cos(t);
  }
  return out;
}

// Cama no volume de referência (RMS): o balanço entre as horas fica em AUDIO.AMBIENCE.BED_DB
function toRms(buf, rms) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  const g = rms / Math.sqrt(s / buf.length || 1);
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

// [voz, nível RMS relativo]
const BEDS = {
  // amanhecer: ar parado e fresco, o coro de passarinhos ao longe e os últimos grilos
  dawn: (r) => [[breeze(r, 1, 0.9), 1], [farBirds(r, 2.6, 1), 0.5], [cricket(r, 4900, 2.2, 3, 1), 0.12], [cricket(r, 4480, 1.7, 4, 1), 0.1]],
  // dia: o coro das cigarras ao longe (três, em ondas) por cima do vento nas folhas
  day: (r) => [[breeze(r, 1, 1.1), 1], [cicadaFar(r, 4300, 112, 0.09, 1), 0.85], [cicadaFar(r, 4950, 128, 0.13, 1), 0.6], [cicadaFar(r, 5450, 97, 0.07, 1), 0.45]],
  // fim de tarde: vento morno, cigarras mais graves e lentas indo embora, os primeiros grilos
  dusk: (r) => [[breeze(r, 1, 0.75), 1], [cicadaFar(r, 3650, 92, 0.06, 1), 0.6], [cicadaFar(r, 4050, 104, 0.05, 1), 0.38], [cricket(r, 4700, 2.4, 3, 1), 0.26], [cricket(r, 4350, 2.0, 4, 1), 0.2]],
  // noite: coro de grilos (cada um no seu tom, ritmo e distância) e um fio de vento
  night: (r) => [
    [breeze(r, 1, 0.6), 0.32],
    [cricket(r, 4650, 2.7, 3, 1), 1],
    [cricket(r, 4420, 2.1, 4, 1), 0.74],
    [cricket(r, 4880, 3.2, 3, 1), 0.58],
    [cricket(r, 4210, 1.9, 4, 1), 0.48],
    [cricket(r, 5120, 2.9, 3, 1), 0.38],
    [cricket(r, 4540, 2.4, 3, 1), 0.31],
    [cricket(r, 4760, 1.7, 4, 1), 0.25],
  ],
};
// Comprimentos diferentes (e sem divisor comum que importe): as horas não "batem" juntas na troca
const BED_LEN = { dawn: 11.3, day: 9.7, dusk: 10.6, night: 12.1 };

// ---------------------------------------------------------------------------
// CHAMADOS (sílabas com a mata em volta)
// ---------------------------------------------------------------------------
// Reverberação curta de mata (Freeverb enxuto: 4 pentes amortecidos + 2 passa-tudo, ~0,7 s), embutida
// na sílaba: no jogo não custa nada
function forest(dry, wet, tail = 0.55, room = 0.78, damp = 0.4) {
  const n = dry.length + Math.round(tail * SR);
  const k = SR / 44100;
  const combs = [1116, 1188, 1277, 1356].map((d) => ({ b: new Float32Array(Math.round(d * k)), i: 0, lp: 0 }));
  const aps = [556, 341].map((d) => ({ b: new Float32Array(Math.round(d * k)), i: 0 }));
  const out = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const x = j < dry.length ? dry[j] : 0;
    let s = 0;
    for (const c of combs) {
      const y = c.b[c.i];
      c.lp = y * (1 - damp) + c.lp * damp;
      c.b[c.i] = x * 0.5 + c.lp * room;
      c.i = (c.i + 1) % c.b.length;
      s += y;
    }
    s *= 0.25;
    for (const a of aps) {
      const b = a.b[a.i];
      a.b[a.i] = s + b * 0.5;
      a.i = (a.i + 1) % a.b.length;
      s = b - s;
    }
    out[j] = x + s * wet;
  }
  return out;
}

// Pico em `peak`, começo e fim com rampa (nada de estalo quando a sílaba entra ou sai)
function finish(buf, peak = 0.7, inMs = 2, outMs = 40) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  const g = m > 0 ? peak / m : 0;
  const a = Math.round((inMs / 1000) * SR),
    z = Math.min(buf.length, Math.round((outMs / 1000) * SR));
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  for (let i = 0; i < z; i++) buf[buf.length - 1 - i] *= i / z;
  return buf;
}

const sin2 = (u) => Math.sin(Math.PI * Math.max(0, Math.min(1, u))) ** 2;
// Envelope de nota: sobe em atk, desce em rel (frações da duração), suave nas duas pontas
const envAR = (atk, rel) => (u) => Math.min(1, Math.sin((Math.PI / 2) * Math.min(1, u / atk)) ** 2, Math.sin((Math.PI / 2) * Math.min(1, (1 - u) / rel)) ** 2);

// Tom de pássaro: frequência e volume por fração u da nota; harmônicos fracos (assobio) ou fortes e
// ásperos (buzz: modulação rápida de amplitude, o "raspado" do bem-te-vi); um sopro de ar no tom
function tone(r, len, fAt, ampAt, { h2 = 0.12, h3 = 0.03, buzz = 0, buzzHz = 170, breath = 0.02 } = {}) {
  const n = Math.round(len * SR);
  const out = new Float32Array(n);
  const bp = new BQ();
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n,
      f = fAt(u);
    ph += f / SR;
    let y = Math.sin(TAU * ph) + h2 * Math.sin(2 * TAU * ph) + h3 * Math.sin(3 * TAU * ph);
    if (buzz) y *= 1 - buzz + buzz * (0.5 + 0.5 * Math.sin((TAU * buzzHz * i) / SR));
    if (breath) {
      if ((i & 31) === 0) bp.set("bp", f, 5);
      y += bp.run(r() * 2 - 1) * breath * 9;
    }
    out[i] = y * ampAt(u);
  }
  return out;
}
const glide = (a, b, curve = 1) => (u) => a + (b - a) * u ** curve;

// Sabiá-laranjeira: sílabas de flauta, afinadas na pentatônica de Lá menor (a música da Clareira):
// o canto conversa com a trilha em vez de brigar com ela. [contorno, Hz…, duração]
const SABIA = [
  ["flat", 2093, 0.17],
  ["up", 1760, 2349, 0.12],
  ["down", 2637, 2093, 0.14],
  ["warble", 2349, 0.22],
  ["arch", 1568, 2093, 1760, 0.19],
  ["step", 2093, 2637, 0.2],
  ["flat", 2637, 0.1],
  ["down", 3136, 2349, 0.12],
  ["trill", 1760, 0.26],
  ["up", 1319, 1760, 0.15],
  ["vib", 1760, 0.25],
  ["chirp", 3136, 3520, 0.06],
];
function sabia(r, [shape, ...a]) {
  const len = a.pop();
  let fAt;
  if (shape === "flat") fAt = () => a[0];
  else if (shape === "up" || shape === "down" || shape === "chirp") fAt = glide(a[0], a[1], shape === "down" ? 0.7 : 1.4);
  else if (shape === "warble") fAt = (u) => a[0] * (1 + 0.055 * Math.sin(TAU * 70 * u * len));
  else if (shape === "arch") fAt = (u) => (u < 0.5 ? a[0] + (a[1] - a[0]) * sin2(u) : a[1] + (a[2] - a[1]) * (u - 0.5) * 2);
  else if (shape === "step") fAt = (u) => a[0] + (a[1] - a[0]) * (0.5 + 0.5 * Math.tanh((u - 0.5) * 14));
  else if (shape === "vib") fAt = (u) => a[0] * (1 + 0.03 * Math.sin(TAU * 28 * u * len) * Math.min(1, u * 4));
  else fAt = () => a[0];
  const trill = shape === "trill" ? (u) => 0.55 + 0.45 * Math.cos(TAU * 34 * u * len) : () => 1;
  const env = envAR(0.12, 0.35);
  return tone(r, len, fAt, (u) => env(u) * trill(u), { h2: 0.1, h3: 0.025, breath: 0.018 });
}

// Bem-te-vi: "bem" (curto, subindo), "te" (curto, mais alto) e o "viii" (longo, sobe um pouco e desce),
// timbre áspero e cheio
const BTV = { h2: 0.42, h3: 0.2, buzz: 0.3, buzzHz: 168, breath: 0.03 };
const bemtevi = {
  bem: (r) => tone(r, 0.11, glide(2350, 2900, 0.8), envAR(0.18, 0.3), BTV),
  te: (r) => tone(r, 0.075, glide(3150, 3020), envAR(0.2, 0.35), BTV),
  vi: (r) => tone(r, 0.31, (u) => (u < 0.2 ? 3480 + 220 * (u / 0.2) : 3700 - 1180 * ((u - 0.2) / 0.8) ** 0.9), (u) => envAR(0.06, 0.45)(u) * (1 - 0.35 * u), BTV),
};

// Cigarra perto (dia): a "sirene" que sobe devagar de tom e de volume, fica e despenca no fim. O trem
// de estalos acelera junto (o canto aperta)
function cicadaNear(r, len, fLo, fHi, rate0) {
  const n = Math.round(len * SR);
  const out = new Float32Array(n);
  const res = new BQ(),
    res2 = new BQ();
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n,
      t = i / SR;
    const fc = u < 0.7 ? fLo + (fHi - fLo) * (u / 0.7) ** 0.6 : u < 0.88 ? fHi : fHi - (fHi - fLo) * 0.75 * ((u - 0.88) / 0.12);
    if ((i & 31) === 0) {
      res.set("bp", fc, 9);
      res2.set("bp", fc * 1.94, 7);
    }
    ph += (rate0 * (1 + 0.3 * u) * (1 + (r() - 0.5) * 0.06)) / SR;
    let e = (r() * 2 - 1) * 0.1;
    if (ph >= 1) {
      ph -= 1;
      e += 1;
    }
    const env = Math.min(1, (u / 0.24) ** 1.6) * (u > 0.84 ? Math.max(0, 1 - (u - 0.84) / 0.16) ** 1.5 : 1);
    const am = 1 - 0.16 * (0.5 + 0.5 * Math.sin(TAU * 4.2 * t));
    out[i] = (res.run(e) + res2.run(e) * 0.25) * env * am;
  }
  return out;
}

// Fogo-apagou (rolinha): três arrulhos ocos e graves, os dois primeiros curtos e o último comprido
function fogoApagou(r, k = 1) {
  const notes = [
    [0, 0.13, 650 * k, 640 * k, 0.25],
    [0.21, 0.13, 612 * k, 600 * k, 0.25],
    [0.44, 0.42, 592 * k, 528 * k, 0.5],
  ];
  const out = new Float32Array(Math.round(0.95 * SR));
  for (const [at, len, f0, f1, rel] of notes) {
    const s = tone(r, len, glide(f0, f1), envAR(0.25, rel), { h2: 0.09, h3: 0.02, breath: 0.035 });
    const o = Math.round(at * SR);
    for (let i = 0; i < s.length && o + i < out.length; i++) out[o + i] += s[i];
  }
  return out;
}

// Grilo perto: um trinado (3 ou 4 pulsos); o padrão repete com o ritmo de cada grilo
function cricketChirp(f, pulses) {
  const PL = 0.016,
    PG = 0.022;
  const out = new Float32Array(Math.round((pulses * (PL + PG) + 0.01) * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR,
      k = Math.floor(t / (PL + PG)),
      u = t - k * (PL + PG);
    if (k >= pulses || u >= PL) continue;
    ph += (f * (1 - (0.025 * u) / PL)) / SR;
    out[i] = Math.sin(TAU * ph) * Math.sin((Math.PI * u) / PL) ** 2;
  }
  return out;
}

// Sapo-ferreiro: a martelada na bigorna — "tóin": tom que cai rápido, parciais inarmônicos (metal) e
// um estalo seco no ataque
function ferreiro(r, f0) {
  const out = new Float32Array(Math.round(0.3 * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (f0 * (1 + 0.09 * Math.exp(-t * 90))) / SR;
    out[i] =
      Math.sin(TAU * ph) * Math.exp(-t * 26) +
      0.42 * Math.sin(TAU * 2.76 * ph) * Math.exp(-t * 52) +
      0.16 * Math.sin(TAU * 4.07 * ph) * Math.exp(-t * 85) +
      (r() * 2 - 1) * 0.25 * Math.exp(-t * 900);
  }
  return out;
}

// Sapo-cururu: o trinado grave e comprido ("trrrrr"), pulsos a `rate`/s num tom que cai um pouco
function cururu(r, len, f0, rate) {
  const out = new Float32Array(Math.round(len * SR));
  const lp = new BQ().set("lp", 2200, 0.7);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const u = i / out.length,
      t = i / SR;
    const f = f0 * (1 - 0.06 * u);
    ph += f / SR;
    const p = (t * rate) % 1;
    const pulse = p < 0.62 ? Math.sin((Math.PI * p) / 0.62) ** 2 : 0;
    const y = Math.sin(TAU * ph) + 0.35 * Math.sin(2 * TAU * ph) + 0.12 * Math.sin(3 * TAU * ph) + (r() * 2 - 1) * 0.08;
    out[i] = lp.run(y * pulse) * Math.min(1, t / 0.15) * Math.min(1, (len - t) / 0.35);
  }
  return out;
}

// Urutau (mãe-da-lua): uma nota assobiada, triste, que firma e escorrega para baixo no fim. O canto
// (pattern) desce de nota em nota, cada uma mais grave e mais fraca
function urutau(r) {
  const len = 1.1;
  const fAt = (u) => 900 * (1 + 0.022 * Math.sin((Math.PI / 2) * Math.min(1, u / 0.15))) * (u > 0.62 ? 1 - 0.075 * ((u - 0.62) / 0.38) ** 1.3 : 1) * (1 + 0.004 * Math.sin(TAU * 5 * u * len));
  const ampAt = (u) => envAR(0.07, 0.42)(u) * (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, u / 0.5)));
  return tone(r, len, fAt, ampAt, { h2: 0.05, h3: 0.01, breath: 0.022 });
}

// Corujinha-do-mato: o ronronar que acelera ("gurrrrr") e termina em uma ou duas notas firmes
function coruja(r, ends) {
  const trill = 0.95;
  const out = new Float32Array(Math.round((trill + 0.2 + ends * 0.27 + 0.05) * SR));
  let ph = 0,
    pp = 0;
  for (let i = 0; i < Math.round(trill * SR); i++) {
    const u = i / (trill * SR);
    ph += (720 + 70 * u) / SR;
    pp += (8.5 + 7.5 * u * u) / SR;
    const pulse = Math.sin(Math.PI * (pp % 1)) ** 2;
    // o ronronar fecha suave (cortar no meio de um pulso estalava)
    out[i] = (Math.sin(TAU * ph) + 0.1 * Math.sin(2 * TAU * ph)) * pulse * Math.min(1, u / 0.12, (1 - u) / 0.06) * (0.6 + 0.4 * u);
  }
  for (let k = 0; k < ends; k++) {
    const s = tone(r, 0.15, glide(815, 790), envAR(0.2, 0.4), { h2: 0.1, h3: 0.02, breath: 0.04 });
    const o = Math.round((trill + 0.2 + k * 0.27) * SR);
    for (let i = 0; i < s.length; i++) out[o + i] += s[i] * (k === ends - 1 ? 1 : 0.85);
  }
  return out;
}

// Tarefas de síntese da ambiência (Synth.audioJobs junta com as do resto)
export function natureJobs(sampleRate) {
  SR = sampleRate;
  const jobs = [];
  const job = (key, make) =>
    jobs.push({
      key,
      *run() {
        const data = yield* make(rng(hash(key)));
        return { outputs: [{ key, data }] };
      },
    });
  for (const id of Object.keys(BEDS)) job(`amb_bed_${id}`, function* (r) {
    return toRms(yield* seamless(BED_LEN[id], 1.6, BEDS[id](r)), 0.1);
  });
  const call = (key, wet, peak, make) => job(key, function* (r) {
    const dry = make(r);
    yield;
    return finish(forest(dry, wet), peak);
  });
  SABIA.forEach((s, i) => call(`amb_sabia_${i}`, 0.24, 0.7, (r) => sabia(r, s)));
  for (const [k, f] of Object.entries(bemtevi)) call(`amb_btv_${k}`, 0.22, 0.7, f);
  call("amb_cigarra_0", 0.12, 0.6, (r) => cicadaNear(r, 6.2, 3000, 4400, 104));
  call("amb_cigarra_1", 0.12, 0.6, (r) => cicadaNear(r, 4.8, 3300, 4750, 118));
  call("amb_fogo_0", 0.3, 0.7, (r) => fogoApagou(r, 1));
  call("amb_fogo_1", 0.3, 0.7, (r) => fogoApagou(r, 0.94));
  call("amb_grilo_0", 0.15, 0.6, () => cricketChirp(4650, 3));
  call("amb_grilo_1", 0.15, 0.6, () => cricketChirp(4380, 4));
  call("amb_ferreiro_0", 0.32, 0.7, (r) => ferreiro(r, 760));
  call("amb_ferreiro_1", 0.32, 0.7, (r) => ferreiro(r, 880));
  call("amb_cururu_0", 0.2, 0.6, (r) => cururu(r, 3.2, 640, 14));
  call("amb_cururu_1", 0.2, 0.6, (r) => cururu(r, 2.6, 560, 11.5));
  call("amb_urutau", 0.36, 0.7, urutau);
  call("amb_coruja_0", 0.34, 0.7, (r) => coruja(r, 1));
  call("amb_coruja_1", 0.34, 0.7, (r) => coruja(r, 2));
  return jobs;
}
function hash(k) {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// PADRÕES: como cada bicho canta (Ambience.js chama na hora; tools/audio-lab.mjs, para medir)
// ---------------------------------------------------------------------------
// pattern(rand) → { notes: [{ t, key, rate, gain }], pan, far }: t em segundos desde o começo do canto,
// gain relativo (0..1). Tom, pausa, quantidade e lado sorteados a cada canto
const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, a, b) => a + (b - a) * r();

export const PATTERNS = {
  // frase de 3 a 7 sílabas; às vezes repete a sílaba (o sabiá "insiste"), às vezes fecha com o pio agudo
  sabia(r) {
    const n = 3 + Math.floor(r() * 5);
    const k = between(r, 0.96, 1.04);
    const notes = [];
    let t = 0,
      last = -1;
    for (let i = 0; i < n; i++) {
      let s = last >= 0 && r() < 0.28 ? last : Math.floor(r() * (SABIA.length - 1));
      if (i === n - 1 && r() < 0.35) s = SABIA.length - 1;
      notes.push({ t, key: `amb_sabia_${s}`, rate: k * between(r, 0.985, 1.015), gain: between(r, 0.75, 1) });
      t += SABIA[s].at(-1) + between(r, 0.04, 0.15);
      last = s;
    }
    return { notes, pan: between(r, -0.8, 0.8) };
  },
  // "bem-te-vi" (às vezes "bem-bem-te-vi"; às vezes repete o chamado)
  bemtevi(r) {
    const k = between(r, 0.97, 1.03);
    const notes = [];
    let t = 0;
    const calls = r() < 0.3 ? 2 : 1;
    for (let c = 0; c < calls; c++) {
      const bems = r() < 0.25 ? 2 : 1;
      for (let b = 0; b < bems; b++) {
        notes.push({ t, key: "amb_btv_bem", rate: k, gain: 0.85 });
        t += 0.11 + between(r, 0.05, 0.08);
      }
      notes.push({ t, key: "amb_btv_te", rate: k, gain: 0.8 });
      t += 0.075 + between(r, 0.04, 0.06);
      notes.push({ t, key: "amb_btv_vi", rate: k, gain: 1 });
      t += 0.31 + between(r, 0.7, 1.4);
    }
    return { notes, pan: between(r, -0.85, 0.85) };
  },
  cigarra(r) {
    return { notes: [{ t: 0, key: `amb_cigarra_${r() < 0.5 ? 0 : 1}`, rate: between(r, 0.93, 1.07), gain: between(r, 0.6, 1) }], pan: between(r, -0.9, 0.9) };
  },
  // a rolinha repete o arrulho de 2 a 5 vezes
  fogo(r) {
    const n = 2 + Math.floor(r() * 4),
      v = r() < 0.5 ? 0 : 1,
      k = between(r, 0.97, 1.03),
      gap = between(r, 1.5, 2.1);
    return { notes: Array.from({ length: n }, (_, i) => ({ t: i * gap * between(r, 0.96, 1.04), key: `amb_fogo_${v}`, rate: k, gain: between(r, 0.8, 1) })), pan: between(r, -0.8, 0.8) };
  },
  // um grilo perto trila por 4–11 s no seu ritmo (que depende do grilo, não muda no meio)
  grilo(r) {
    const v = r() < 0.5 ? 0 : 1,
      k = between(r, 0.96, 1.05),
      per = between(r, 0.32, 0.46),
      dur = between(r, 4, 11);
    const notes = [];
    for (let t = 0; t < dur; t += per * between(r, 0.95, 1.05)) notes.push({ t, key: `amb_grilo_${v}`, rate: k, gain: Math.min(1, t / 0.8 + 0.4) * between(r, 0.85, 1) });
    return { notes, pan: between(r, -0.9, 0.9) };
  },
  // sapo-ferreiro: de 3 a 9 marteladas; às vezes um segundo sapo responde, noutro tom e noutro lado
  ferreiro(r) {
    const notes = [];
    const frogs = r() < 0.4 ? 2 : 1;
    for (let f = 0; f < frogs; f++) {
      const n = 3 + Math.floor(r() * 7),
        v = r() < 0.5 ? 0 : 1,
        k = between(r, 0.95, 1.05),
        per = between(r, 0.42, 0.68),
        t0 = f * between(r, 0.2, 0.35);
      for (let i = 0; i < n; i++) notes.push({ t: t0 + i * per * between(r, 0.96, 1.04), key: `amb_ferreiro_${v}`, rate: k, gain: (f ? 0.6 : 1) * between(r, 0.8, 1), pan: f ? 1 : 0 });
    }
    return { notes, pan: between(r, -0.7, 0.7), spread: 0.6 };
  },
  cururu(r) {
    return { notes: [{ t: 0, key: `amb_cururu_${r() < 0.5 ? 0 : 1}`, rate: between(r, 0.95, 1.05), gain: between(r, 0.6, 1) }], pan: between(r, -0.8, 0.8), far: true };
  },
  // mãe-da-lua: de 4 a 7 notas descendo, cada uma mais grave, mais fraca e um pouco mais espaçada
  urutau(r) {
    const n = 4 + Math.floor(r() * 4),
      k = between(r, 0.95, 1.04);
    const notes = [];
    let t = 0;
    for (let i = 0; i < n; i++) {
      const rate = k * Math.pow(0.905, i);
      notes.push({ t, key: "amb_urutau", rate, gain: Math.pow(0.84, i) });
      t += 1.1 / rate + between(r, 0.28, 0.5) + i * 0.04;
    }
    return { notes, pan: between(r, -0.6, 0.6), far: true };
  },
  coruja(r) {
    return { notes: [{ t: 0, key: `amb_coruja_${r() < 0.55 ? 0 : 1}`, rate: between(r, 0.96, 1.04), gain: 1 }], pan: between(r, -0.8, 0.8), far: true };
  },
};

// Peso de cada hora (madrugada/amanhecer, dia, fim de tarde, noite) numa hora do relógio (0..24): as
// faixas se cruzam devagar, sempre somando 1. `edges`: AUDIO.AMBIENCE.HOURS
export const PERIODS = ["dawn", "day", "dusk", "night"];
export function periodWeights(hour, edges) {
  const h = ((hour % 24) + 24) % 24;
  const w = { dawn: 0, day: 0, dusk: 0, night: 0 };
  // edges: [[hora, período], …] em ordem; entre dois pontos de períodos diferentes, cruza linear
  for (let i = 0; i < edges.length - 1; i++) {
    const [h0, p0] = edges[i],
      [h1, p1] = edges[i + 1];
    if (h < h0 || h > h1) continue;
    const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
    w[p0] += 1 - t;
    w[p1] += t;
    return w;
  }
  w[edges[0][1]] = 1;
  return w;
}
