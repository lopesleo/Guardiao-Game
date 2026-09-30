// Obras da Clareira: níveis das construções, feitos pelo João-de-barro (1 obra
// por vez) com tempo REAL (Date.now). Partidas adiantam a obra; faltando pouco,
// conclui com um toque. Tudo mora no save (meta.data.builds / buildJob).
import { BUILD, BUILDINGS, CHARACTERS, WEAPONS, GARDEN, FISHING } from "../config.js";

export class Builds {
  constructor(meta) {
    this.meta = meta;
    const d = meta.data;
    d.builds ||= {};
    for (const id of Object.keys(BUILDINGS)) d.builds[id] ||= { level: 1 };
    if (d.buildJob && !BUILDINGS[d.buildJob.id]) d.buildJob = null;
  }

  level(id) {
    return this.meta.data.builds[id]?.level ?? 1;
  }
  max(id) {
    return BUILDINGS[id].max;
  }
  get job() {
    return this.meta.data.buildJob || null;
  }

  // Custo/tempo para subir ao próximo nível (null = no máximo)
  nextStep(id) {
    const lv = this.level(id);
    if (lv >= this.max(id)) return null;
    return BUILD.STEPS[lv];
  }

  // O que o PRÓXIMO nível libera (texto curto para o jogador)
  nextPerk(id) {
    return perkText(id, this.level(id) + 1);
  }

  // Motivo pelo qual não dá para começar (null = pode)
  blocker(id) {
    const step = this.nextStep(id);
    if (!step) return "max";
    if (this.job) return this.job.id === id ? "building" : "busy";
    if (this.meta.coins < step.coins) return "coins";
    if (this.meta.wood < step.wood) return "wood";
    return null;
  }

  // Começa a obra (paga na hora). Obras de 0 min terminam na hora.
  start(id, now = Date.now()) {
    if (this.blocker(id)) return null;
    const step = this.nextStep(id);
    const d = this.meta.data;
    d.totalCoins -= step.coins;
    d.wood = (d.wood || 0) - step.wood;
    const to = this.level(id) + 1;
    if (step.min <= 0) {
      this._complete(id, to);
      this.meta._save();
      return { id, to, done: true };
    }
    d.buildJob = { id, to, endsAt: now + step.min * 60000, startedAt: now };
    this.meta._save();
    return { id, to, done: false };
  }

  remainingMs(now = Date.now()) {
    const j = this.job;
    return j ? Math.max(0, j.endsAt - now) : 0;
  }

  canFinishFree(now = Date.now()) {
    return !!this.job && this.remainingMs(now) <= BUILD.FREE_FINISH_MIN * 60000;
  }

  finishFree(now = Date.now()) {
    if (!this.canFinishFree(now)) return null;
    return this._finishJob();
  }

  // Chamado pela Clareira periodicamente: conclui se o tempo acabou
  tick(now = Date.now()) {
    const j = this.job;
    if (!j || now < j.endsAt) return null;
    return this._finishJob();
  }

  // Adianta a obra em andamento (partidas, anúncio opcional)
  advance(ms) {
    const j = this.job;
    if (!j || ms <= 0) return 0;
    j.endsAt -= ms;
    this.meta._save();
    return ms;
  }

  _finishJob() {
    const j = this.job;
    this.meta.data.buildJob = null;
    this._complete(j.id, j.to);
    this.meta._save();
    return { id: j.id, to: j.to };
  }

  // Aplica o nível novo e seus efeitos imediatos (guardiões chegam à Clareira)
  _complete(id, to) {
    const d = this.meta.data;
    d.builds[id] = { level: to };
    if (id === "fire") {
      for (const [cid, lv] of Object.entries(BUILD.FIRE_CHARACTER_LEVEL))
        if (lv <= to && !d.unlockedCharacters.includes(cid)) d.unlockedCharacters.push(cid);
    }
  }

  // ---- Travas lidas pelos painéis ----
  shrineRankCap() {
    return this.level("shrine");
  }
  forgeAllows(weaponKey) {
    return this.level("forge") >= (BUILD.FORGE_WEAPON_LEVEL[weaponKey] ?? 1);
  }
}

// Texto do que o nível `lv` de cada construção libera
export function perkText(id, lv) {
  if (id === "shrine") return `Bênçãos até o rank ${lv}`;
  if (id === "forge") {
    const k = Object.entries(BUILD.FORGE_WEAPON_LEVEL).find(([, l]) => l === lv)?.[0];
    return k ? `Libera forjar: ${WEAPONS[k].name}` : "";
  }
  if (id === "fire") {
    const cid = Object.entries(BUILD.FIRE_CHARACTER_LEVEL).find(([, l]) => l === lv)?.[0];
    const c = CHARACTERS.find((c) => c.id === cid);
    return c ? `Chega à Clareira: ${c.name}` : "";
  }
  if (id === "pond") return FISHING.LEVELS[lv] ? `Vara melhor · lago com ${FISHING.LEVELS[lv].cap} peixes` : "";
  if (id === "garden") {
    const crops = Object.values(GARDEN.CROPS).filter((c) => !c.rare && c.lv === lv).map((c) => c.name);
    return `${GARDEN.PLOTS[lv]} canteiros${crops.length ? ` · ${crops.join(", ")}` : ""}`;
  }
  return "";
}

// "3:05" / "1h 12min"
export function fmtDuration(ms) {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
