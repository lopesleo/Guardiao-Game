// Persistência entre runs via localStorage.
// Salva: moedas totais, high score (tempo), armas desbloqueadas.
import { META, MAX_BLESSING_RANK, ANCESTRAL, ACHIEVEMENTS } from '../config.js';

const DEFAULT = {
  totalCoins: 0,
  highScoreSeconds: 0,
  unlockedWeapons: ['STAFF'],
  unlockedAbilities: [],   // 'DASH', 'AWAKEN'
  blessingRanks: {},       // { id: rank 1..MAX } (Fase 2)
  ancestralLevel: 0,       // Tesouro Ancestral (sink infinito)
  // Conquistas (Fase 3 — ver docs/META_LOOP.md)
  achievements: [],        // ids desbloqueados
  stats: {                 // contadores cumulativos entre runs
    reactions: {},         // { VAPOR: n, CRYSTAL: n, OVERLOAD: n }
    totalKills: 0,
    totalCoinsEarned: 0,   // só ganhos (compras não descontam)
  },
  // Dificuldade (Fase 1 — ver docs/META_LOOP.md)
  selectedDifficulty: 1,      // padrão = Guardião (balanceamento "normal" atual)
  // Cursor de desbloqueio: libera níveis até maxDifficultyCleared+1. Começa em 0
  // para que Aprendiz (fácil, opcional) E Guardião (normal) já venham abertos.
  // Cada vitória num nível ainda não vencido avança o cursor em 1.
  maxDifficultyCleared: 0,
  wins: 0,                    // total de vitórias (boss morto)
  // Personagens jogáveis (CHARACTERS em config.js)
  selectedCharacter: 'guardian',
  unlockedCharacters: ['guardian'],
  winsByDifficulty: {},       // { "0": n, "1": n, ... }
};

// Cópia fresca do default com os objetos aninhados CLONADOS (evita que instâncias
// compartilhem a mesma referência de blessingRanks/winsByDifficulty).
function freshDefault() {
  return {
    ...DEFAULT,
    blessingRanks: {},
    winsByDifficulty: {},
    achievements: [],
    unlockedCharacters: ['guardian'],
    stats: { reactions: {}, totalKills: 0, totalCoinsEarned: 0 },
  };
}

export class MetaProgression {
  constructor() {
    this.available = this._detectStorage();
    this.data = this._load();
  }

  _detectStorage() {
    try {
      const k = '__test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  }

  _load() {
    if (!this.available) return freshDefault();
    try {
      const raw = localStorage.getItem(META.STORAGE_KEY);
      if (!raw) return freshDefault();
      const parsed = JSON.parse(raw);
      const fd = freshDefault();
      const data = { ...fd, ...parsed };
      // Migração Fase 3: saves antigos não têm achievements/stats
      if (!Array.isArray(data.achievements)) data.achievements = [];
      if (!Array.isArray(data.unlockedCharacters)) data.unlockedCharacters = ['guardian'];
      data.stats = { ...fd.stats, ...(parsed.stats || {}) };
      data.stats.reactions = { ...((parsed.stats || {}).reactions || {}) };
      // Migração Fase 2: saves antigos guardavam ownedBlessings (booleano) →
      // converte cada bênção possuída para rank 1.
      if (Array.isArray(parsed.ownedBlessings) && !parsed.blessingRanks) {
        data.blessingRanks = {};
        for (const id of parsed.ownedBlessings) data.blessingRanks[id] = 1;
      }
      delete data.ownedBlessings;
      return data;
    } catch { return freshDefault(); }
  }

  _save() {
    if (!this.available) return;
    try { localStorage.setItem(META.STORAGE_KEY, JSON.stringify(this.data)); } catch {}
  }

  // ---- Queries ----
  get coins()    { return this.data.totalCoins; }
  get unlocked() { return this.data.unlockedWeapons.slice(); }
  isUnlocked(weaponKey) { return this.data.unlockedWeapons.includes(weaponKey); }

  // ---- Mutations ----
  addCoins(n) {
    this.data.totalCoins += n;
    if (n > 0) this.data.stats.totalCoinsEarned += n;
    this._save();
  }

  // ---- Stats cumulativos (Fase 3) ----
  // Hot path (por kill/reação): NÃO salva aqui — persistido no registerRun e
  // no unlock de conquista. Perder alguns ticks se fechar a aba é aceitável.
  recordKill() { this.data.stats.totalKills += 1; }
  recordReaction(key) {
    const r = this.data.stats.reactions;
    r[key] = (r[key] || 0) + 1;
  }

  // ---- Conquistas (Fase 3) ----
  hasAchievement(id) { return this.data.achievements.includes(id); }
  // Contexto passado aos check(c)/prog(c) de ACHIEVEMENTS (config.js).
  buildAchievementCtx(run = null) {
    const s = this.data.stats;
    return {
      wins: this.data.wins || 0,
      winsByDifficulty: this.data.winsByDifficulty || {},
      maxDifficultyCleared: this.data.maxDifficultyCleared || 0,
      reactions: s.reactions || {},
      totalKills: s.totalKills || 0,
      totalCoinsEarned: s.totalCoinsEarned || 0,
      maxBlessingRank: Math.max(0, ...Object.values(this.data.blessingRanks)),
      ancestralLevel: this.ancestralLevel,
      run,
    };
  }
  // Avalia todas as pendentes; retorna as RECÉM-desbloqueadas (defs completas).
  checkAchievements(run = null) {
    const ctx = this.buildAchievementCtx(run);
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.achievements.includes(a.id)) continue;
      let ok = false;
      try { ok = !!a.check(ctx); } catch {}
      if (ok) {
        this.data.achievements.push(a.id);
        newly.push(a);
      }
    }
    if (newly.length) this._save();
    return newly;
  }

  // difficulty = índice do nível jogado nesta run.
  registerRun(elapsedSeconds, won, difficulty = 0) {
    if (elapsedSeconds > this.data.highScoreSeconds) {
      this.data.highScoreSeconds = Math.floor(elapsedSeconds);
    }
    if (won) {
      this.data.wins = (this.data.wins || 0) + 1;
      const k = String(difficulty);
      this.data.winsByDifficulty[k] = (this.data.winsByDifficulty[k] || 0) + 1;
      if (difficulty > this.data.maxDifficultyCleared) {
        this.data.maxDifficultyCleared = difficulty;
      }
    }
    this._save();
  }

  // ---- Dificuldade ----
  // Maior índice de nível que o jogador pode escolher: o próximo ao maior vencido,
  // limitado ao último nível disponível (passado pela cena que conhece DIFFICULTY).
  maxSelectableDifficulty(lastIndex) {
    return Math.min(this.data.maxDifficultyCleared + 1, lastIndex);
  }
  get selectedDifficulty() { return this.data.selectedDifficulty || 0; }
  setSelectedDifficulty(idx) {
    this.data.selectedDifficulty = idx;
    this._save();
  }
  isDifficultyUnlocked(idx) {
    return idx <= this.data.maxDifficultyCleared + 1;
  }

  unlock(weaponKey) {
    if (this.data.unlockedWeapons.includes(weaponKey)) return false;
    const cost = META.WEAPON_UNLOCK_COST[weaponKey] ?? 0;
    if (this.data.totalCoins < cost) return false;
    this.data.totalCoins -= cost;
    this.data.unlockedWeapons.push(weaponKey);
    this._save();
    return true;
  }

  // Bênçãos (trilhas de rank, Fase 2)
  blessingRank(id) { return this.data.blessingRanks[id] || 0; }
  // Custo do PRÓXIMO rank, ou null se no máximo.
  blessingNextCost(blessing) {
    const rank = this.blessingRank(blessing.id);
    if (rank >= MAX_BLESSING_RANK) return null;
    return blessing.costs[rank];
  }
  rankUpBlessing(blessing) {
    const rank = this.blessingRank(blessing.id);
    if (rank >= MAX_BLESSING_RANK) return false;
    const cost = blessing.costs[rank];
    if (this.data.totalCoins < cost) return false;
    this.data.totalCoins -= cost;
    this.data.blessingRanks[blessing.id] = rank + 1;
    this._save();
    return true;
  }

  // Tesouro Ancestral (sink infinito)
  get ancestralLevel() { return this.data.ancestralLevel || 0; }
  ancestralCost() { return ANCESTRAL.cost(this.ancestralLevel); }
  buyAncestral() {
    const cost = this.ancestralCost();
    if (this.data.totalCoins < cost) return false;
    this.data.totalCoins -= cost;
    this.data.ancestralLevel = this.ancestralLevel + 1;
    this._save();
    return true;
  }

  // Habilidades (DASH, AWAKEN)
  hasAbility(id) { return this.data.unlockedAbilities.includes(id); }
  abilities() { return this.data.unlockedAbilities.slice(); }
  unlockAbility(id, cost) {
    if (this.hasAbility(id)) return false;
    if (this.data.totalCoins < cost) return false;
    this.data.totalCoins -= cost;
    this.data.unlockedAbilities.push(id);
    this._save();
    return true;
  }

  // Personagens
  hasCharacter(id) { return this.data.unlockedCharacters.includes(id); }
  get selectedCharacter() { return this.data.selectedCharacter || 'guardian'; }
  setSelectedCharacter(id) {
    if (!this.hasCharacter(id)) return false;
    this.data.selectedCharacter = id;
    this._save();
    return true;
  }
  unlockCharacter(id, cost) {
    if (this.hasCharacter(id)) return false;
    if (this.data.totalCoins < cost) return false;
    this.data.totalCoins -= cost;
    this.data.unlockedCharacters.push(id);
    this.data.selectedCharacter = id;
    this._save();
    return true;
  }

  // RESET completo
  reset() {
    this.data = freshDefault();
    if (this.available) {
      try { localStorage.removeItem(META.STORAGE_KEY); } catch {}
    }
  }
}
