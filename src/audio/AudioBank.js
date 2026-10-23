// Carga do áudio SEM travar o jogo. Antes, sintetizar tudo (Synth.js) era uma tarefa só de ~0,8–1,4 s
// na thread principal: a tela de carga congelava (num celular fraco, vários segundos).
//   · Caminho normal: a síntese roda em Web Workers (SynthWorker.js), em paralelo com a arte que a
//     PreloadScene desenha. Uma fila de tarefas: cada Worker livre pega a próxima (as pesadas primeiro),
//     então o trabalho se divide sozinho entre os núcleos. Aqui só viram AudioBuffer os dados que
//     chegam prontos (transferidos, sem cópia): uma tarefa pequena por som.
//   · Plano B (sem Worker, Worker que falha ou que fica mudo por AUDIO.LOAD.WATCHDOG_MS): as tarefas que
//     faltam rodam aqui mesmo, em fatias de AUDIO.LOAD.SLICE_MS — a barra anda e nenhum quadro trava.
// Depuração: ?debug=1&audio=main força o plano B. AudioBank.stats: o que aconteceu (testes, medições).
import { audioJobs, MUSIC_INFO, SR } from "./Synth.js";
import { AUDIO } from "../config.js";

const now = () => performance.now();
const S = {
  started: false,
  jobs: null,
  byKey: null,
  queue: [], // chaves que ninguém pegou ainda
  failed: [], // o Worker não conseguiu: refaz aqui
  ready: new Map(), // tarefa pronta, esperando o AudioContext
  installed: new Set(),
  workers: [], // { w, key, dog }
  game: null,
  slicing: false,
  waiters: [],
};
const stats = { mode: null, reason: "", workers: 0, jobs: 0, bytes: 0, workerMs: 0, mainMs: 0, maxTaskMs: 0, slices: 0, readyAtMs: 0 };

// Tempo de thread principal gasto com áudio (cada pedaço é uma tarefa do navegador)
function spent(t) {
  const d = now() - t;
  stats.mainMs += d;
  stats.maxTaskMs = Math.max(stats.maxTaskMs, d);
}

// Dados prontos → AudioBuffer no cache do Phaser (e o andamento/camadas da trilha em MUSIC_INFO)
function install(key) {
  const res = S.ready.get(key);
  const ctx = S.game?.sound?.context;
  if (!res || !ctx || S.installed.has(key)) return;
  for (const o of res.outputs) {
    if (!o.data?.length) continue;
    const b = ctx.createBuffer(1, o.data.length, SR);
    if (b.copyToChannel) b.copyToChannel(o.data, 0);
    else b.getChannelData(0).set(o.data);
    S.game.cache.audio.add(o.key, b);
    stats.bytes += o.data.length * 4;
  }
  if (res.info) MUSIC_INFO[res.info.key] = res.info;
  S.ready.delete(key); // o AudioBuffer tem a cópia dele: o Float32Array pode ir embora
  S.installed.add(key);
  if (S.installed.size === S.jobs.length) finish();
}

function finish() {
  stats.readyAtMs = Math.round(now());
  closeWorkers();
  for (const w of S.waiters.splice(0)) w(stats);
}

function closeWorkers() {
  for (const s of S.workers) {
    clearTimeout(s.dog);
    s.w.terminate();
  }
  S.workers = [];
}

// Próxima fatia: MessageChannel não tem o atraso mínimo do setTimeout aninhado
let channel = null;
function later(fn) {
  if (typeof MessageChannel !== "function") return setTimeout(fn, 0);
  if (!channel) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => channel.cb?.();
  }
  channel.cb = fn;
  channel.port2.postMessage(0);
}

// Plano B: o que falta roda na thread principal, em fatias de SLICE_MS
function sliced(reason) {
  stats.reason = stats.reason || reason;
  stats.mode = stats.mode === "worker" ? "worker+main" : "main";
  for (const s of S.workers) if (s.key) S.queue.unshift(s.key);
  closeWorkers();
  if (S.slicing) return;
  S.slicing = true;
  const todo = () => S.failed.shift() ?? S.queue.shift();
  let it = null,
    job = null;
  const step = () => {
    const t = now();
    stats.slices++;
    while (now() - t < AUDIO.LOAD.SLICE_MS) {
      if (!it) {
        const key = todo();
        if (!key) break;
        if (S.ready.has(key) || S.installed.has(key)) continue;
        job = S.byKey.get(key);
        it = job.run();
      }
      let r;
      try {
        r = it.next();
      } catch (err) {
        console.error("[áudio] falhou:", job.key, err); // segue sem este som em vez de travar a carga
        r = { done: true, value: { outputs: [] } };
      }
      if (r.done) {
        S.ready.set(job.key, r.value);
        install(job.key);
        it = null;
      }
    }
    spent(t);
    if (it || S.queue.length || S.failed.length) later(step);
    else S.slicing = false;
  };
  step();
}

// ---- Workers ----
function feed(slot) {
  const key = S.queue.shift();
  if (!key) return retire(slot);
  slot.key = key;
  slot.w.postMessage({ job: key });
  clearTimeout(slot.dog);
  slot.dog = setTimeout(() => drop(slot, "worker mudo"), AUDIO.LOAD.WATCHDOG_MS);
}

// Worker sem trabalho: fecha. O último a fechar confere se sobrou algo (falhas) para o plano B
function retire(slot) {
  clearTimeout(slot.dog);
  slot.w.terminate();
  S.workers = S.workers.filter((s) => s !== slot);
  if (!S.workers.length && S.failed.length) sliced("falha no worker");
}

// Worker que deu erro ou calou: a tarefa dele volta para a fila; sem nenhum Worker, plano B
function drop(slot, reason) {
  if (!S.workers.includes(slot)) return;
  clearTimeout(slot.dog);
  slot.w.terminate();
  S.workers = S.workers.filter((s) => s !== slot);
  if (slot.key) S.queue.unshift(slot.key);
  stats.reason = stats.reason || reason;
  if (!S.workers.length) sliced(reason);
}

function onWorker(slot, e) {
  const m = e.data;
  if (!m || !S.workers.includes(slot)) return;
  clearTimeout(slot.dog);
  slot.key = null;
  if (m.type === "job") {
    stats.workerMs += m.ms;
    S.ready.set(m.key, { outputs: m.outputs, info: m.info });
    if (S.game) {
      const t = now();
      install(m.key);
      spent(t);
    }
  } else if (m.type === "fail") {
    console.warn("[áudio] o Worker não fez", m.key, m.error);
    S.failed.push(m.key);
  }
  feed(slot);
}

function spawn() {
  const w = new Worker(new URL("./SynthWorker.js", import.meta.url), { type: "module" });
  const slot = { w, key: null, dog: 0 };
  S.workers.push(slot);
  w.onmessage = (e) => onWorker(slot, e);
  // Worker de módulo sem suporte (WebView antiga), arquivo que não carrega, exceção ao importar
  w.onerror = (ev) => {
    ev.preventDefault?.();
    drop(slot, `erro no worker: ${ev.message || "?"}`);
  };
  w.onmessageerror = () => drop(slot, "mensagem ilegível do worker");
  feed(slot);
}

// Quantos Workers: um núcleo fica para o jogo (a arte é desenhada ao mesmo tempo)
const workerCount = () => Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));

export const AudioBank = {
  // Começa a síntese (uma vez). Chamar o quanto antes: main.js, antes do Phaser
  start() {
    if (S.started) return;
    S.started = true;
    S.jobs = audioJobs();
    S.byKey = new Map(S.jobs.map((j) => [j.key, j]));
    stats.jobs = S.jobs.length;
    // as pesadas primeiro (músicas e camas da ambiência): os Workers terminam juntos
    const heavy = (k) => k.startsWith("music_") || k.startsWith("amb_bed_");
    S.queue = [...S.jobs.filter((j) => heavy(j.key)), ...S.jobs.filter((j) => !heavy(j.key))].map((j) => j.key);
    const force = /[?&]debug=1\b/.test(location.search) && /[?&]audio=main\b/.test(location.search);
    try {
      if (force) throw new Error("?audio=main");
      if (typeof Worker !== "function") throw new Error("sem Worker");
      stats.mode = "worker";
      stats.workers = workerCount();
      for (let i = 0; i < stats.workers && S.queue.length; i++) spawn();
    } catch (err) {
      sliced(String(err?.message || err));
    }
  },

  // Liga ao jogo (o AudioContext) e espera tudo no cache. Sem WebAudio: resolve na hora, sem som
  register(game) {
    this.start();
    S.game = game;
    if (!game?.sound?.context || !game.cache?.audio) {
      closeWorkers();
      return Promise.resolve(stats);
    }
    if (S.installed.size === S.jobs.length) return Promise.resolve(stats);
    const p = new Promise((res) => S.waiters.push(res));
    // o que já chegou entra em fatias (com os Workers rápidos, pode ser quase tudo de uma vez)
    const queued = [...S.ready.keys()];
    const drain = () => {
      const t = now();
      while (queued.length && now() - t < AUDIO.LOAD.SLICE_MS) install(queued.shift());
      spent(t);
      if (queued.length) later(drain);
    };
    drain();
    return p;
  },

  get stats() {
    return { ...stats, installed: S.installed.size, pending: S.ready.size };
  },
};
