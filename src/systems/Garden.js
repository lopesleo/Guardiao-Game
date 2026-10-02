// Horta da Clareira: canteiros com plantas que crescem em tempo REAL
// (Clock: relógio confiável, à prova de mexer na hora). Cuidados (sede, erva
// daninha, lagarta) aparecem sozinhos durante o crescimento; pendentes,
// atrasam a planta e custam qualidade — mas nada morre. A colheita vai para o
// celeiro (meta.data.pantry), por qualidade.
// Tudo mora no save: meta.data.garden = { plots: [...], tutorialDone }.
import { GARDEN } from "../config.js";
import { Clock } from "./Clock.js";

const NEED_TYPES = Object.keys(GARDEN.NEEDS);

export class Garden {
  constructor(meta, level = 1) {
    this.meta = meta;
    const d = meta.data;
    d.garden ||= { plots: [], tutorialDone: false };
    d.pantry ||= {};
    d.seeds ||= {};
    this.setLevel(level);
  }

  get data() {
    return this.meta.data.garden;
  }
  get plots() {
    return this.data.plots;
  }

  // Canteiros abertos = nível da Horta (os plantados nunca somem)
  setLevel(level) {
    this.level = level;
    const n = GARDEN.PLOTS[Math.min(level, GARDEN.PLOTS.length - 1)];
    while (this.plots.length < n) this.plots.push(null);
  }
  get open() {
    return this.plots.length;
  }

  // Plantas que o jogador pode plantar agora (comuns do nível + raras com semente)
  available() {
    // 1º plantio da vida (cresce em segundos): só a cenoura, para o atalho não render mandioca
    if (!this.data.tutorialDone) return ["carrot"];
    return Object.entries(GARDEN.CROPS)
      .filter(([id, c]) => (c.rare ? (this.meta.data.seeds[id] || 0) > 0 : c.lv <= this.level))
      .map(([id]) => id);
  }

  plant(i, crop, now = Clock.now()) {
    const c = GARDEN.CROPS[crop];
    if (!c || this.plots[i] || i >= this.open) return false;
    if (c.rare) {
      if (!(this.meta.data.seeds[crop] > 0)) return false;
      this.meta.data.seeds[crop]--;
    } else if (c.lv > this.level) return false;
    // 1ª planta da vida: cresce em segundos, com 1 cuidado para ensinar
    const tut = !this.data.tutorialDone;
    const dur = (tut ? GARDEN.TUTORIAL_S : c.s) * 1000;
    const nn = tut ? 1 : c.needs;
    const needs = [];
    for (let k = 0; k < nn; k++) {
      // espalhados entre 15% e 85% do crescimento, em faixas (não se amontoam)
      const f = tut ? 0.35 : 0.15 + (0.7 * (k + Math.random() * 0.8)) / nn;
      needs.push({ f, type: tut ? "water" : NEED_TYPES[Math.floor(Math.random() * NEED_TYPES.length)] });
    }
    this.plots[i] = { crop, dur, grown: 0, last: now, needs, ripeAt: null };
    this.data.tutorialDone = true;
    this.meta._save();
    return true;
  }

  // Avança o crescimento até `now`. Um cuidado pendente deixa a planta mais
  // lenta; o aviso nasce no instante exato em que a planta cruza a sua fração.
  step(p, now = Clock.now()) {
    if (!p) return p;
    let t = p.last;
    while (t < now && p.grown < p.dur) {
      const rate = p.needs.some((n) => n.at != null && !n.done) ? GARDEN.NEED_SLOW : 1;
      const next = p.needs.find((n) => n.at == null);
      const target = next ? next.f * p.dur : p.dur;
      const ms = (target - p.grown) / rate;
      if (t + ms <= now) {
        t += ms;
        p.grown = target;
        if (next) next.at = t;
      } else {
        p.grown += (now - t) * rate;
        t = now;
      }
    }
    if (p.grown >= p.dur && p.ripeAt == null) p.ripeAt = t;
    p.last = Math.max(p.last, now); // nunca recua (senão o mesmo tempo contaria duas vezes)
    return p;
  }

  update(now = Clock.now()) {
    for (const p of this.plots) this.step(p, now);
  }

  // ---- Estado de um canteiro (lido pela UI) ----
  // "empty" · "need" (cuidado pendente) · "growing" · "ripe"
  state(i, now = Clock.now()) {
    const p = this.step(this.plots[i], now);
    if (!p) return "empty";
    if (p.ripeAt != null) return "ripe";
    if (this.need(p)) return "need";
    return "growing";
  }
  need(p) {
    return p?.needs.find((n) => n.at != null && !n.done) || null;
  }
  // Estágio visual 0..4 (semente, broto, muda, florindo, pronta)
  stage(p) {
    if (!p) return 0;
    if (p.ripeAt != null) return 4;
    return Math.min(3, Math.floor((p.grown / p.dur) * 4));
  }
  // Tempo real até ficar pronta, contando a lentidão de um cuidado pendente
  remainingMs(p) {
    if (!p || p.ripeAt != null) return 0;
    return (p.dur - p.grown) / (this.need(p) ? GARDEN.NEED_SLOW : 1);
  }
  // Qualidade que sairia colhendo agora (0..2)
  quality(p, now = Clock.now()) {
    const grace = Math.max(GARDEN.NEED_GRACE_MIN_S * 1000, p.dur * GARDEN.NEED_GRACE);
    let q = 2;
    for (const n of p.needs) if (!n.done || n.doneAt - n.at > grace) q--;
    if (p.ripeAt != null && now - p.ripeAt > GARDEN.RIPE_KEEP_H * 3600000) q--;
    return Math.max(0, q);
  }

  // Resolve o cuidado pendente (1 toque). Devolve o tipo resolvido.
  care(i, now = Clock.now()) {
    const p = this.step(this.plots[i], now);
    const n = this.need(p);
    if (!n) return null;
    n.done = true;
    n.doneAt = now;
    this.meta._save();
    return n.type;
  }

  // Colhe: vai para o celeiro. Devolve { crop, n, q } ou null.
  harvest(i, now = Clock.now()) {
    const p = this.step(this.plots[i], now);
    if (!p || p.ripeAt == null) return null;
    const q = this.quality(p, now);
    const n = GARDEN.CROPS[p.crop].yield;
    this.addToPantry(p.crop, q, n);
    this.plots[i] = null;
    const d = this.meta.data;
    d.stats.harvests = (d.stats.harvests || 0) + 1;
    this.meta._save();
    return { crop: p.crop, n, q };
  }

  addToPantry(item, q, n) {
    const row = (this.meta.data.pantry[item] ||= [0, 0, 0]);
    row[q] += n;
  }

  // Quantos canteiros pedem atenção (cuidado ou colheita) — selo "!" no mapa
  attention(now = Clock.now()) {
    let n = 0;
    for (let i = 0; i < this.open; i++) {
      const s = this.state(i, now);
      if (s === "need" || s === "ripe") n++;
    }
    return n;
  }
}

// Total de um item no celeiro (todas as qualidades)
export function pantryCount(data, item) {
  return (data.pantry?.[item] || [0, 0, 0]).reduce((a, b) => a + b, 0);
}

// Sorteia uma semente rara (planta mágica) — drop das partidas
export function randomRareSeed() {
  const ids = Object.entries(GARDEN.CROPS)
    .filter(([, c]) => c.rare)
    .map(([id]) => id);
  return ids[Math.floor(Math.random() * ids.length)];
}
