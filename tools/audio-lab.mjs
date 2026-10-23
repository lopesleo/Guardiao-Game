// Laboratório do SOM, sem navegador: sintetiza tudo com o código do jogo (src/audio/Synth.js roda no Node)
// e MEDE o que o ouvido não pode conferir daqui:
//   · volume: LUFS integrado (BS.1770: filtro K, blocos de 400 ms, portas −70 e −10) e pico, de cada trilha
//     e de cada NÍVEL das camadas (base, +bateria, +baixo, +melodia), no volume em que tocam no jogo;
//   · emendas: o salto entre a última e a primeira amostra de cada laço, comparado com o maior salto
//     normal do próprio som (p99,9); > 1 = estalo na emenda;
//   · trocas de camada: aplica as mesmas rampas do jogo (MusicLayers.js) num tempo forte e procura estalo
//     (2ª diferença em ±60 ms da troca × a do trecho parado);
//   · espectro: parte da energia em cada faixa (grave embolando? agudo sobrando?);
//   · ambiência: 120 s de cada hora simulados como o jogo toca (camas nos dois lados + cantos sorteados),
//     comparados com a música da Clareira.
//   node tools/audio-lab.mjs              (tudo)
//   node tools/audio-lab.mjs --antes=main  (compara a trilha da partida com a versão da outra branch)
//   node tools/audio-lab.mjs --wav=pasta --png=pasta   (WAV para ouvir e espectrogramas: cada bicho,
//     cada cama, a Clareira inteira em cada hora e cada nível das camadas)
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { audioJobs, runJob, SR } from "../src/audio/Synth.js";
import { PATTERNS, PERIODS, periodWeights } from "../src/audio/Nature.js";
import { AUDIO } from "../src/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "−∞");
const MUSIC_VOL = 0.35; // volume das trilhas no jogo (GameScene, CampScene)

// ---------- medidas ----------
function biquad(x, b, a) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
// Filtro K na taxa do jogo (coeficientes da BS.1770 recalculados para fs, como o libebur128)
function kWeight(x, fs = SR) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s1 = biquad(x, [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0], [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]);
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + K / Q + K * K;
  return biquad(s1, [1, -2, 1], [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]);
}
// LUFS integrado de 1 ou 2 canais (cada um um Float32Array)
function lufs(chs) {
  const z = chs.map((c) => kWeight(c));
  const n = z[0].length, blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const ms = [];
  for (let s = 0; s + blk <= n; s += hop) {
    let sum = 0;
    for (const c of z) { let a = 0; for (let i = s; i < s + blk; i++) a += c[i] * c[i]; sum += a / blk; }
    ms.push(sum);
  }
  const L = (m) => -0.691 + 10 * Math.log10(m);
  let g = ms.filter((m) => L(m) > -70);
  if (!g.length) return -Infinity;
  const rel = L(g.reduce((a, b) => a + b, 0) / g.length) - 10;
  g = g.filter((m) => L(m) > rel);
  return L(g.reduce((a, b) => a + b, 0) / g.length);
}
// maior volume de curto prazo (janela de 3 s), para os cantos que se destacam da cama
function shortMax(chs) {
  const z = chs.map((c) => kWeight(c));
  const n = z[0].length, blk = 3 * SR, hop = Math.round(0.5 * SR);
  let best = -Infinity;
  for (let s = 0; s + blk <= n; s += hop) {
    let sum = 0;
    for (const c of z) { let a = 0; for (let i = s; i < s + blk; i++) a += c[i] * c[i]; sum += a / blk; }
    best = Math.max(best, -0.691 + 10 * Math.log10(sum));
  }
  return best;
}
const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
function pct(arr, p) {
  const a = Float64Array.from(arr).sort();
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
}
// Salto da emenda do laço ÷ o salto p99,9 do som (> 1 = estalo)
function seam(x) {
  const d = new Float64Array(x.length - 1);
  for (let i = 1; i < x.length; i++) d[i - 1] = Math.abs(x[i] - x[i - 1]);
  const ref = pct(d, 0.999) || 1e-9;
  return Math.abs(x[0] - x[x.length - 1]) / ref;
}
// FFT radix-2 (in place)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j], ai = im[i + j];
        const br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ar + br; im[i + j] = ai + bi; re[i + j + len / 2] = ar - br; im[i + j + len / 2] = ai - bi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}
// Parte da energia por faixa (Welch, 4096 pontos)
const BANDS = [[20, 120, "sub"], [120, 250, "grave"], [250, 500, "médio-grave"], [500, 2000, "médio"], [2000, 6000, "presença"], [6000, 11025, "brilho"]];
function bands(x) {
  const N = 4096, acc = new Float64Array(N / 2);
  const w = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  for (let s = 0; s + N <= x.length; s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * w[i];
    fft(re, im);
    for (let k = 0; k < N / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
  }
  const tot = acc.reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const [lo, hi, name] of BANDS) {
    let e = 0;
    for (let k = 0; k < N / 2; k++) { const f = (k * SR) / N; if (f >= lo && f < hi) e += acc[k]; }
    out[name] = (100 * e) / tot;
  }
  return out;
}
const bandStr = (b) => Object.entries(b).map(([k, v]) => `${k} ${v.toFixed(0)}%`).join(" · ");

// ---------- síntese ----------
const T0 = performance.now();
const buf = {}, info = {};
for (const job of audioJobs()) {
  const r = runJob(job);
  for (const o of r.outputs) buf[o.key] = o.data;
  if (r.info) info[r.info.key] = r.info;
}
console.log(`síntese: ${audioJobs().length} tarefas em ${((performance.now() - T0) / 1000).toFixed(2)} s (Node, uma thread) · ${(Object.values(buf).reduce((a, b) => a + b.length * 4, 0) / 1e6).toFixed(1)} MB`);

// trilha em camadas: soma das camadas até `level`, num comprimento (as de 32 tempos dão duas voltas)
function layered(key, gains, len) {
  const st = info[key].stems;
  len = len ?? Math.max(...st.map((s) => buf[`${key}@${s}`].length));
  const out = new Float32Array(len);
  st.forEach((s, i) => {
    const b = buf[`${key}@${s}`];
    const g = typeof gains === "function" ? gains : () => gains[i];
    for (let j = 0; j < len; j++) out[j] += b[j % b.length] * g(j, i) * MUSIC_VOL;
  });
  return out;
}

let fails = 0;
const flag = (ok) => (ok ? "ok" : (fails++, "FALHA"));

// ---------- 1. trilhas ----------
console.log("\n== Trilhas (no volume do jogo, 0,35) ==");
for (const key of Object.keys(info)) {
  if (info[key].stems) continue;
  const x = Float32Array.from(buf[key], (v) => v * MUSIC_VOL);
  const s = info[key].loop ? seam(buf[key]) : null;
  console.log(`  ${key.padEnd(22)} ${f1(lufs([x]))} LUFS · pico ${f1(db(peak(x)))} dBFS${s != null ? ` · emenda ${s.toFixed(2)} ${flag(s <= 1)}` : ""}`);
}

// ---------- 2. camadas ----------
const NAMES = ["base", "+bateria", "+baixo", "+melodia"];
const C = AUDIO.LAYERS;
for (const key of Object.keys(info).filter((k) => info[k].stems)) {
  const st = info[key].stems;
  console.log(`\n== ${key}: camadas ${st.join(" → ")} (${info[key].bpm} BPM) ==`);
  for (const s of st) {
    const b = buf[`${key}@${s}`];
    const sm = seam(b);
    console.log(`  camada ${s.padEnd(5)} ${(b.length / SR).toFixed(2)} s · emenda ${sm.toFixed(2)} ${flag(sm <= 1)}`);
  }
  let prev = null;
  for (let lv = 0; lv < st.length; lv++) {
    const x = layered(key, st.map((_, i) => (i <= lv ? 1 : 0)));
    const L = lufs([x]), pk = db(peak(x));
    const b = bands(x);
    console.log(`  nível ${lv} ${NAMES[lv].padEnd(9)} ${f1(L)} LUFS${prev != null ? ` (${L - prev >= 0 ? "+" : ""}${(L - prev).toFixed(1)})` : ""} · pico ${f1(pk)} dBFS ${flag(pk < AUDIO.LIMITER.THRESHOLD_DB)} · ${bandStr(b)}`);
    prev = L;
  }
  // Trocas: sobe um nível por compasso (0 → 3) e depois desce, com as rampas do jogo
  const beatS = info[key].beatS, spb = beatS * SR;
  const full = Math.max(...st.map((s) => buf[`${key}@${s}`].length));
  const len = full * 2;
  const ev = []; // [amostra do tempo forte, camada, liga]
  const q = (s) => C.QUANT[s] ?? 4;
  let bt = 8;
  for (let i = 1; i < st.length; i++) { bt = Math.ceil((bt + 4) / q(st[i])) * q(st[i]); ev.push([bt * spb, i, true]); }
  bt += 16;
  for (let i = st.length - 1; i >= 1; i--) { bt = Math.ceil((bt + 4) / q(st[i])) * q(st[i]); ev.push([bt * spb, i, false]); }
  const gainAt = (j, i) => {
    if (i === 0) return 1;
    let g = 0;
    for (const [at, k, on] of ev) {
      if (k !== i) continue;
      if (on) { const a = at - (C.ENTER_BEATS[st[i]] ?? 0.5) * spb; if (j >= at) g = 1; else if (j >= a) g = (j - a) / (at - a); }
      else if (j >= at) { const out = C.EXIT_BEATS * spb; g = j >= at + out ? 0 : Math.pow(1e-3, (j - at) / out); }
    }
    return g;
  };
  const y = layered(key, gainAt, len);
  const d2 = new Float64Array(len);
  for (let j = 1; j < len - 1; j++) d2[j] = Math.abs(y[j + 1] - 2 * y[j] + y[j - 1]);
  const ref = pct(d2, 0.999);
  let worst = 0;
  for (const [at] of ev) {
    const w = Math.round(0.06 * SR);
    for (let j = Math.max(1, Math.round(at) - w); j < Math.min(len - 1, Math.round(at) + w); j++) worst = Math.max(worst, d2[j]);
  }
  const bars = ev.map(([at, , on], n) => `${on ? "+" : "−"}${st[ev[n][1]]}@${(at / spb).toFixed(0)}`).join(" ");
  console.log(`  trocas no tempo forte (${bars}): estalo ${(worst / ref).toFixed(2)} × o normal ${flag(worst / ref <= 1.5)} · grade ${flag(ev.every(([at, k]) => Math.abs(at / spb / q(st[k]) - Math.round(at / spb / q(st[k]))) < 1e-6))}`);
}

// ---------- 3. antes × depois (a trilha da partida inteira) ----------
const antes = arg("antes");
if (antes) {
  const tmp = path.join(os.tmpdir(), `synth-${antes.replace(/\W/g, "_")}.mjs`);
  fs.writeFileSync(tmp, execSync(`git show ${antes}:src/audio/Synth.js`, { cwd: ROOT }).toString());
  const old = await import(pathToFileURL(tmp).href);
  const got = {};
  if (old.registerAudio) {
    old.registerAudio({ sound: { context: { createBuffer: (c, n) => { const d = new Float32Array(n); return { d, getChannelData: () => d }; } } }, cache: { audio: { add: (k, b) => (got[k] = b.d) } } });
  } else for (const j of old.audioJobs()) for (const o of old.runJob(j).outputs) got[o.key] = o.data;
  console.log(`\n== Antes (${antes}) × agora, trilha inteira ==`);
  for (const key of ["music_gameplay", "music_caatinga"]) {
    if (!got[key]) continue;
    const a = Float32Array.from(got[key], (v) => v * MUSIC_VOL);
    const n = layered(key, info[key].stems.map(() => 1));
    console.log(`  ${key}: antes ${f1(lufs([a]))} LUFS, pico ${f1(db(peak(a)))} · agora (todas as camadas) ${f1(lufs([n]))} LUFS, pico ${f1(db(peak(n)))}`);
    console.log(`    antes: ${bandStr(bands(a))}`);
    console.log(`    agora: ${bandStr(bands(n))}`);
  }
}

// ---------- 4. ambiência ----------
console.log("\n== Ambiência da Clareira (120 s simulados por hora, como o jogo toca) ==");
const AM = AUDIO.AMBIENCE;
const menu = Float32Array.from(buf.music_menu, (v) => v * MUSIC_VOL);
const menuL = lufs([menu]);
console.log(`  música da Clareira: ${f1(menuL)} LUFS`);
for (const id of PERIODS) {
  const b = buf[`amb_bed_${id}`];
  const sm = seam(b);
  console.log(`  cama ${id.padEnd(6)} ${(b.length / SR).toFixed(1)} s · emenda ${sm.toFixed(2)} ${flag(sm <= 1)} · ${bandStr(bands(b))}`);
}
const panG = (p) => { const x = (p + 1) / 2; return [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)]; };
// biquad passa-baixa do WebAudio (Q = 1), para os bichos "longe"
function lowpass(x, f) {
  const w = (2 * Math.PI * f) / SR, c = Math.cos(w), al = Math.sin(w) / 2, a0 = 1 + al;
  return biquad(x, [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0], [1, (-2 * c) / a0, (1 - al) / a0]);
}
// rng determinístico para a simulação
const mul = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const CENTER = { dawn: 6.2, day: 12, dusk: 18, night: 23 };
const scapes = {};
for (const id of PERIODS) {
  const DUR = 120, n = DUR * SR, L = new Float32Array(n), R = new Float32Array(n);
  const w = periodWeights(CENTER[id], AM.HOURS);
  const out = Math.pow(10, AM.DB / 20);
  for (const p of PERIODS) {
    if (w[p] <= 0) continue;
    const b = buf[`amb_bed_${p}`], g = Math.sqrt(w[p]) * Math.pow(10, (AM.BED_DB[p] ?? 0) / 20) * out;
    for (const [pan, rate, at] of [[-0.55, 1, 0], [0.55, 0.984, 0.47]]) {
      const [gl, gr] = panG(pan);
      let pos = at * b.length;
      for (let i = 0; i < n; i++) {
        const k = Math.floor(pos), f = pos - k, v = (b[k % b.length] * (1 - f) + b[(k + 1) % b.length] * f) * g;
        L[i] += v * gl; R[i] += v * gr;
        pos += rate;
      }
    }
  }
  const r = mul(1234 + id.length);
  const count = {};
  for (const [sp, d] of Object.entries(AM.SPECIES)) {
    const sw = PERIODS.reduce((s, p) => s + w[p] * (d.at[p] || 0), 0);
    if (sw <= 0.01) continue;
    const wait = () => (d.EVERY_S[0] + (d.EVERY_S[1] - d.EVERY_S[0]) * r()) / sw;
    for (let t = wait() * (0.12 + 0.5 * r()); t < DUR - 1; t += wait()) {
      const pat = PATTERNS[sp](r);
      count[sp] = (count[sp] || 0) + 1;
      for (const note of pat.notes) {
        let x = buf[note.key];
        if (pat.far) x = lowpass(x, 2600);
        const pan = Math.max(-0.95, Math.min(0.95, pat.pan + (note.pan ? (pat.spread || 0.5) * (pat.pan > 0 ? -1 : 1) : 0)));
        const [gl, gr] = panG(pan), g = Math.pow(10, d.DB / 20) * note.gain * out;
        const s0 = Math.round((t + note.t) * SR);
        for (let pos = 0, i = s0; pos < x.length - 1 && i < n; pos += note.rate, i++) {
          const k = Math.floor(pos), f = pos - k, v = (x[k] * (1 - f) + x[k + 1] * f) * g;
          L[i] += v * gl; R[i] += v * gr;
        }
      }
    }
  }
  scapes[id] = [L, R];
  const lu = lufs([L, R]), st = shortMax([L, R]);
  const pk = Math.max(peak(L), peak(R));
  // a mata com a música por cima: o pico da soma (limitador começa em −6 dBFS)
  const mix = Float32Array.from(L, (v, i) => Math.max(Math.abs(v + menu[i % menu.length] * 0.707), Math.abs(R[i] + menu[i % menu.length] * 0.707)));
  const mpk = db(peak(mix));
  console.log(`  ${id.padEnd(6)} ${f1(lu)} LUFS (${f1(lu - menuL)} LU sob a música) · cantos no máximo ${f1(st)} LUFS (${f1(st - menuL)}) · pico ${f1(db(pk))} dBFS · com a música ${f1(mpk)} dBFS ${flag(mpk < AUDIO.LIMITER.THRESHOLD_DB)} · cantos: ${Object.entries(count).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}
for (const k of Object.keys(buf).filter((k) => k.startsWith("amb_") && !k.startsWith("amb_bed_"))) {
  const x = buf[k];
  const edge = Math.max(Math.abs(x[0]), Math.abs(x[x.length - 1]));
  if (edge > 1e-3) console.log(`  ${k}: começa/termina fora do zero (${edge.toExponential(1)}) ${flag(false)}`);
}

// ---------- 5. para ouvir e ver: --wav=pasta (16 bits) e --png=pasta (espectrograma) ----------
const wavDir = arg("wav"), pngDir = arg("png");
if (wavDir || pngDir) {
  for (const d of [wavDir, pngDir]) if (d) fs.mkdirSync(d, { recursive: true });
  const wav = (name, chs) => {
    if (!wavDir) return;
    const n = chs[0].length, c = chs.length, b = Buffer.alloc(44 + n * c * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * c * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(c, 22);
    b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * c * 2, 28); b.writeUInt16LE(c * 2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * c * 2, 40);
    for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chs[k][i])) * 32767), 44 + (i * c + k) * 2);
    fs.writeFileSync(path.join(wavDir, `${name}.wav`), b);
  };
  const png = (name, x, maxW = 1400) => {
    if (!pngDir) return;
    const N = 512, H = 256, hop = Math.max(64, Math.ceil((x.length - N) / maxW));
    const W = Math.max(1, Math.floor((x.length - N) / hop));
    const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    const img = Buffer.alloc((W * 3 + 1) * H);
    const P = [];
    let top = -Infinity;
    for (let f = 0; f < W; f++) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = (x[f * hop + i] || 0) * win[i];
      fft(re, im);
      const col = new Float64Array(H);
      for (let k = 0; k < H; k++) top = Math.max(top, (col[k] = 10 * Math.log10(re[k] ** 2 + im[k] ** 2 + 1e-20)));
      P.push(col);
    }
    for (let f = 0; f < W; f++) {
      for (let k = 0; k < H; k++) {
        const v = Math.max(0, Math.min(1, (P[f][k] - top + 80) / 80)); // 80 dB abaixo do pico do som → preto
        const o = (H - 1 - k) * (W * 3 + 1) + 1 + f * 3; // grave embaixo
        img[o] = Math.round(255 * Math.min(1, v * 1.6)); img[o + 1] = Math.round(255 * Math.max(0, v * 1.6 - 0.6)); img[o + 2] = Math.round(255 * (v < 0.5 ? v : 1 - v) * 1.4);
      }
    }
    const zlib = require("node:zlib");
    const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (bb) => { let c = 0xffffffff; for (const v of bb) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
    fs.writeFileSync(path.join(pngDir, `${name}.png`), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(img)), chunk("IEND", Buffer.alloc(0))]));
  };
  // um canto de cada bicho (sorteio fixo), como o jogo monta
  const r = mul(99);
  for (const sp of Object.keys(PATTERNS)) {
    const pat = PATTERNS[sp](r);
    const end = Math.max(...pat.notes.map((nn) => nn.t + buf[nn.key].length / SR / nn.rate)) + 0.2;
    const y = new Float32Array(Math.ceil(end * SR));
    for (const nn of pat.notes) {
      const x = buf[nn.key], s0 = Math.round(nn.t * SR);
      for (let pos = 0, i = s0; pos < x.length - 1 && i < y.length; pos += nn.rate, i++) { const k = Math.floor(pos), f = pos - k; y[i] += (x[k] * (1 - f) + x[k + 1] * f) * nn.gain * 0.8; }
    }
    wav(`canto_${sp}`, [y]);
    png(`canto_${sp}`, y);
  }
  for (const id of PERIODS) { wav(`cama_${id}`, [buf[`amb_bed_${id}`]]); png(`cama_${id}`, buf[`amb_bed_${id}`]); }
  // a Clareira inteira em cada hora (cama + cantos, estéreo, no volume do jogo, sem a música): +12 dB para ouvir
  const up = Math.pow(10, 12 / 20);
  for (const [id, [L, R]] of Object.entries(scapes)) {
    wav(`clareira_${id}_120s`, [L.map((v) => v * up), R.map((v) => v * up)]);
    png(`clareira_${id}_30s`, L.subarray(0, 30 * SR).map((v, i) => v + R[i]));
  }
  for (const key of Object.keys(info).filter((k) => info[k].stems)) {
    const st = info[key].stems;
    for (let lv = 0; lv < st.length; lv++) wav(`${key}_nivel${lv}`, [layered(key, st.map((_, i) => (i <= lv ? 1 : 0)))]);
  }
  console.log(`\narquivos: ${[wavDir, pngDir].filter(Boolean).join(", ")}`);
}
console.log(fails ? `\n${fails} falha(s)` : "\nTudo certo.");
process.exit(fails ? 1 : 0);
