// Obras da Clareira: níveis das construções, feitos pelo João-de-barro (1 obra
// por vez) com tempo REAL (Clock, à prova de mexer na hora). Partidas adiantam
// a obra; faltando pouco, conclui com um toque. Tudo mora no save
// (meta.data.builds / buildJob).
import { BUILD, BUILDINGS, BIOMES, CHARACTERS, WEAPONS, GARDEN, FISHING } from "../config.js";
import { Clock } from "./Clock.js";
import { tr } from "../i18n/i18n.js";

export class Builds {
  constructor(meta) {
    this.meta = meta;
    const d = meta.data;
    d.builds ||= {};
    for (const id of Object.keys(BUILDINGS)) d.builds[id] ||= { level: 1 };
    if (d.buildJob && !BUILDINGS[d.buildJob.id]) d.buildJob = null;
    // Guardiões da Fogueira são regra do nível, não evento: um save que chegou ao
    // nível sem passar pela entrega (save antigo, regra que mudou) recebe-os aqui
    if (this._grantFireCharacters(this.level("fire"))) meta._save();
  }

  // Entrega os guardiões liberados até o nível `lv` da Fogueira; true se algum chegou
  _grantFireCharacters(lv) {
    const d = this.meta.data;
    let got = false;
    for (const [cid, need] of Object.entries(BUILD.FIRE_CHARACTER_LEVEL))
      if (need <= lv && !d.unlockedCharacters.includes(cid)) {
        d.unlockedCharacters.push(cid);
        got = true;
      }
    return got;
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
    return BUILDINGS[id].steps?.[lv] ?? BUILD.STEPS[lv]; // obra com tabela própria (Trilha)
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
  start(id, now = Clock.now()) {
    if (this.blocker(id)) return null;
    const step = this.nextStep(id);
    const d = this.meta.data;
    d.totalCoins -= step.coins;
    d.wood = (d.wood || 0) - step.wood;
    const to = this.level(id) + 1;
    this.meta._bought("build", `${id}_${to}`, step.coins, { wood: step.wood });
    if (step.min <= 0) {
      this._complete(id, to);
      this.meta._save();
      return { id, to, done: true };
    }
    d.buildJob = { id, to, endsAt: now + step.min * 60000, startedAt: now };
    this.meta._save();
    return { id, to, done: false };
  }

  remainingMs(now = Clock.now()) {
    const j = this.job;
    return j ? Math.max(0, j.endsAt - now) : 0;
  }

  canFinishFree(now = Clock.now()) {
    return !!this.job && this.remainingMs(now) <= BUILD.FREE_FINISH_MIN * 60000;
  }

  finishFree(now = Clock.now()) {
    if (!this.canFinishFree(now)) return null;
    return this._finishJob();
  }

  // Chamado pela Clareira periodicamente: conclui se o tempo acabou
  tick(now = Clock.now()) {
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
    if (id === "fire") this._grantFireCharacters(to);
  }

  // ---- Travas lidas pelos painéis ----
  // Santuário nível N → bênçãos até o rank 2N (10 ranks em 5 níveis)
  shrineRankCap() {
    return shrineRankCapFor(this.level("shrine"));
  }
  weaponSlots() {
    return weaponSlotsFor(this.meta);
  }
  forgeAllows(weaponKey) {
    return this.level("forge") >= (BUILD.FORGE_WEAPON_LEVEL[weaponKey] ?? 1);
  }
}

export const shrineRankCapFor = (lv) => lv * 2;

// Vagas de arma na partida (nível da Forja; sem save = 2)
export function weaponSlotsFor(meta) {
  const lv = meta?.data?.builds?.forge?.level ?? 1;
  return BUILD.FORGE_WEAPON_SLOTS[lv] ?? 2;
}

// Texto do que o nível `lv` de cada construção libera
export function perkText(id, lv) {
  if (id === "shrine") return tr("Bênçãos até o rank {0}", shrineRankCapFor(lv));
  if (id === "forge") {
    const keys = Object.entries(BUILD.FORGE_WEAPON_LEVEL).filter(([, l]) => l === lv).map(([k]) => k);
    const slots = BUILD.FORGE_WEAPON_SLOTS[lv];
    const parts = [];
    if (slots > (BUILD.FORGE_WEAPON_SLOTS[lv - 1] ?? 0)) parts.push(tr("{0}ª vaga de arma na partida", slots));
    if (keys.length) parts.push(tr("libera forjar: {0}", keys.map((k) => WEAPONS[k].name).join(", ")));
    const t = parts.join(" · ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (id === "fire") {
    const cid = Object.entries(BUILD.FIRE_CHARACTER_LEVEL).find(([, l]) => l === lv)?.[0];
    const c = CHARACTERS.find((c) => c.id === cid);
    return c ? tr("Chega à Clareira: {0}", c.name) : "";
  }
  if (id === "trail") {
    const b = Object.values(BIOMES).find((b) => b.unlock?.trail === lv);
    return b ? tr("Abre o caminho para a {0}", b.name) : "";
  }
  if (id === "pond") return FISHING.LEVELS[lv] ? tr("Vara melhor · lago com {0} peixes", FISHING.LEVELS[lv].cap) : "";
  if (id === "garden") {
    const crops = Object.values(GARDEN.CROPS).filter((c) => !c.rare && c.lv === lv).map((c) => c.name);
    return tr("{0} canteiros{1}", GARDEN.PLOTS[lv], crops.length ? ` · ${crops.join(", ")}` : "");
  }
  return "";
}

// "3:05" / "1h 12min"
export function fmtDuration(ms) {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return tr("{0}h {1}min", Math.floor(s / 3600), String(Math.floor((s % 3600) / 60)).padStart(2, "0"));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
