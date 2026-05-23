// Persistência entre runs via localStorage.
// Salva: moedas totais, high score (tempo), armas desbloqueadas.
import { META } from '../config.js';

const DEFAULT = {
  totalCoins: 0,
  highScoreSeconds: 0,
  unlockedWeapons: ['STAFF'],
};

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
    if (!this.available) return { ...DEFAULT };
    try {
      const raw = localStorage.getItem(META.STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT, ...parsed };
    } catch { return { ...DEFAULT }; }
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
  addCoins(n) { this.data.totalCoins += n; this._save(); }

  registerRun(elapsedSeconds, won) {
    if (elapsedSeconds > this.data.highScoreSeconds) {
      this.data.highScoreSeconds = Math.floor(elapsedSeconds);
    }
    this._save();
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
}
