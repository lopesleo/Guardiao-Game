// Web Worker da síntese (módulo). O src/audio/AudioBank.js abre alguns destes e vai entregando uma
// tarefa de src/audio/Synth.js por vez a quem estiver livre (o trabalho se divide sozinho entre os
// núcleos). Cada som volta pronto TRANSFERINDO os dados (sem cópia); quem cria o AudioBuffer é a thread
// principal (o AudioContext só existe lá).
import { audioJobs, runJob } from "./Synth.js";

const jobs = new Map(audioJobs().map((j) => [j.key, j]));

self.onmessage = (e) => {
  const key = e.data?.job;
  if (!key) return;
  const t = performance.now();
  try {
    const res = runJob(jobs.get(key));
    self.postMessage({ type: "job", key, outputs: res.outputs, info: res.info ?? null, ms: performance.now() - t }, res.outputs.map((o) => o.data.buffer));
  } catch (err) {
    self.postMessage({ type: "fail", key, error: String(err?.message || err) });
  }
};
