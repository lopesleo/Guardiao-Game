// Lago da Clareira: quantos peixes há (repõe com o tempo real), sorteio do
// peixe pelo horário real, tamanho, recordes e qualidade da pescaria.
// Tudo no save: meta.data.pond = { fish, since }, meta.data.fishRecords.
import { FISHING } from "../config.js";
import { Clock } from "./Clock.js";

export class Pond {
  constructor(meta, level = 1) {
    this.meta = meta;
    const d = meta.data;
    d.pond ||= { fish: null, since: Clock.now() };
    d.fishRecords ||= {};
    d.pantry ||= {};
    this.setLevel(level);
  }

  setLevel(level) {
    this.level = Math.max(1, Math.min(level, FISHING.LEVELS.length - 1));
    const p = this.meta.data.pond;
    if (p.fish == null) p.fish = this.cap; // lago novo começa cheio
  }
  get cap() {
    return FISHING.LEVELS[this.level].cap;
  }
  get zone() {
    return FISHING.LEVELS[this.level].zone;
  }

  // Peixes disponíveis agora (repõe 1 a cada REGEN_MIN, sem passar do teto)
  fish(now = Clock.now()) {
    const p = this.meta.data.pond;
    const step = FISHING.REGEN_MIN * 60000;
    if (p.fish >= this.cap) {
      p.since = now;
      return p.fish;
    }
    const n = Math.floor((now - p.since) / step);
    if (n > 0) {
      p.fish = Math.min(this.cap, p.fish + n);
      p.since += n * step;
    }
    return p.fish;
  }

  // Tempo até voltar um peixe (0 = tem peixe)
  restMs(now = Clock.now()) {
    if (this.fish(now) > 0) return 0;
    return this.meta.data.pond.since + FISHING.REGEN_MIN * 60000 - now;
  }

  // Sorteia o peixe da vez pelo horário real (1º peixe da vida: lambari fácil)
  roll(now = Clock.date()) {
    const d = this.meta.data;
    if (!d.stats.fishCaught) return { id: "lambari", tutorial: true };
    const h = now.getHours();
    const day = h >= 6 && h < 18;
    const pool = Object.entries(FISHING.FISH).filter(([, f]) => (!f.day || day) && (!f.night || !day));
    let r = Math.random() * pool.reduce((a, [, f]) => a + f.w, 0);
    for (const [id, f] of pool) if ((r -= f.w) < 0) return { id };
    return { id: pool[0][0] };
  }

  // Pegou! Tira do lago, guarda no celeiro, confere o recorde.
  catch(id, q) {
    const d = this.meta.data;
    const f = FISHING.FISH[id];
    const cm = Math.round(f.cm[0] + (f.cm[1] - f.cm[0]) * Math.pow(Math.random(), 1.8));
    const rec = d.fishRecords[id] || 0;
    const record = cm > rec;
    if (record) d.fishRecords[id] = cm;
    this.fish();
    if (d.pond.fish >= this.cap) d.pond.since = Clock.now();
    d.pond.fish = Math.max(0, d.pond.fish - 1);
    const row = (d.pantry[id] ||= [0, 0, 0]);
    row[q]++;
    d.stats.fishCaught = (d.stats.fishCaught || 0) + 1;
    this.meta._save();
    return { id, q, cm, record: record && rec > 0, first: rec === 0 };
  }

  // Escapou: o peixe se assusta e some por um tempo (conta como pescado do lago)
  lose() {
    const d = this.meta.data;
    this.fish();
    if (d.pond.fish >= this.cap) d.pond.since = Clock.now();
    d.pond.fish = Math.max(0, d.pond.fish - 1);
    this.meta._save();
  }
}
