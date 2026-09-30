// Hábito diário: missões do dia, presente de dias seguidos e baú diário.
// "Dia" = data LOCAL do aparelho (AAAA-MM-DD). Tudo no save:
//   meta.data.daily  = { day, missions:[{id,n,p,claimed}], bonus, chest:{free,ad} }
//   meta.data.streak = { last, count }
import { DAILY, GARDEN } from "../config.js";
import { rng } from "../art/PixelArt.js";
import { Analytics } from "./Analytics.js";

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yesterdayKey = (d = new Date()) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
const def = (id) => DAILY.MISSIONS.find((m) => m.id === id);
// "{n}" vira o alvo; "{s}" vira plural quando o alvo passa de 1
const fill = (t, n) => t.replace("{n}", n).replace("{s}", n > 1 ? "s" : "");

// Missões, presentes e baú só existem depois que o Mural apareceu
export const dailyUnlocked = (d) => (d.revealed || []).includes("board");

export class Daily {
  constructor(meta, now = new Date()) {
    this.meta = meta;
    this.now = now;
    this.ensure();
  }
  get d() {
    return this.meta.data;
  }

  // Novo dia → sorteia as missões (a mesma data dá as mesmas missões)
  ensure() {
    const today = dayKey(this.now);
    if (this.d.daily?.day === today) return;
    const seed = today.split("-").reduce((a, v) => a * 31 + Number(v), 7);
    const r = rng(seed);
    const pick = (pool, k) => {
      const out = [];
      const left = pool.slice();
      while (out.length < k && left.length) out.push(left.splice(Math.floor(r() * left.length), 1)[0]);
      return out;
    };
    const ok = DAILY.MISSIONS.filter((m) => !m.needs || m.needs(this.d));
    const camp = pick(ok.filter((m) => m.camp), 1);
    const run = pick(ok.filter((m) => !m.camp), 3 - camp.length);
    this.d.daily = {
      day: today,
      missions: [...run, ...camp].map((m) => ({ id: m.id, n: m.n[Math.floor(r() * m.n.length)], p: 0, claimed: false })),
      bonus: false,
      chest: { free: false, ad: false },
    };
    this.meta._save();
  }

  get missions() {
    return this.d.daily.missions.map((m) => ({ ...m, def: def(m.id), text: fill(def(m.id).text, m.n), done: m.p >= m.n }));
  }

  // Soma progresso num tipo de estatística. Devolve as missões recém-cumpridas.
  bump(stat, amount = 1, isMax = false) {
    this.ensure();
    const newly = [];
    for (const m of this.d.daily.missions) {
      const dm = def(m.id);
      if (dm.stat !== stat || m.p >= m.n) continue;
      m.p = Math.min(m.n, isMax || dm.max ? Math.max(m.p, amount) : m.p + amount);
      if (m.p >= m.n) {
        newly.push(fill(dm.text, m.n));
        Analytics.track("mission_done", { id: m.id });
      }
    }
    if (newly.length || amount) this.meta._save();
    return newly;
  }

  // Fim de partida: tudo o que a partida fez de uma vez
  runEnd(r) {
    return [
      ...this.bump("runs", 1),
      ...this.bump("kills", r.kills),
      ...this.bump("reactions", r.reactions),
      ...this.bump("VAPOR", r.byType.VAPOR || 0),
      ...this.bump("CRYSTAL", r.byType.CRYSTAL || 0),
      ...this.bump("OVERLOAD", r.byType.OVERLOAD || 0),
      ...this.bump("minutes", Math.floor(r.seconds / 60), true),
      ...this.bump("chests", r.chests),
      ...this.bump("lanterns", r.lanterns),
      ...this.bump("wins", r.won ? 1 : 0),
    ];
  }

  claim(i) {
    const m = this.d.daily.missions[i];
    if (!m || m.claimed || m.p < m.n) return null;
    m.claimed = true;
    return this._give({ coins: def(m.id).coins });
  }
  get bonusReady() {
    return !this.d.daily.bonus && this.d.daily.missions.every((m) => m.claimed);
  }
  claimBonus() {
    if (!this.bonusReady) return null;
    this.d.daily.bonus = true;
    Analytics.track("missions_all", {});
    return this._give(DAILY.ALL_BONUS);
  }
  // Há algo para pegar no Mural? (selo "!")
  get claimable() {
    return this.d.daily.missions.some((m) => !m.claimed && m.p >= m.n) || this.bonusReady;
  }

  // ---- Dias seguidos ----
  // Dia do ciclo (1..7) do presente de hoje, ou null se já pegou hoje
  streakPending() {
    const s = (this.d.streak ||= { last: null, count: 0 });
    const today = dayKey(this.now);
    if (s.last === today) return null;
    return s.last === yesterdayKey(this.now) ? (s.count % DAILY.STREAK.length) + 1 : 1;
  }
  claimStreak() {
    const day = this.streakPending();
    if (!day) return null;
    this.d.streak = { last: dayKey(this.now), count: day };
    Analytics.track("streak_claim", { day });
    return { day, ...this._give(DAILY.STREAK[day - 1]) };
  }

  // ---- Baú diário ----
  chestReady(kind = "free") {
    return !this.d.daily.chest[kind];
  }
  openChest(kind = "free") {
    if (!this.chestReady(kind)) return null;
    this.d.daily.chest[kind] = true;
    const c = DAILY.CHEST;
    const reward = { coins: c.coins[0] + Math.floor(Math.random() * (c.coins[1] - c.coins[0] + 1)) };
    if (Math.random() < c.woodChance) reward.wood = 1 + Math.floor(Math.random() * 2);
    if ((this.d.revealed || []).includes("garden") && Math.random() < c.seedChance) reward.seeds = 1;
    Analytics.track("daily_chest", { kind });
    return this._give(reward);
  }

  // Entrega o prêmio e devolve o que foi dado (sementes: quais)
  _give(r) {
    const out = { coins: r.coins || 0, wood: r.wood || 0, seeds: [] };
    if (out.coins) this.meta.addCoins(out.coins);
    if (out.wood) this.meta.addWood(out.wood);
    const rare = Object.entries(GARDEN.CROPS).filter(([, c]) => c.rare).map(([id]) => id);
    const seeds = (this.d.seeds ||= {});
    for (let k = 0; k < (r.seeds || 0); k++) {
      const id = rare[Math.floor(Math.random() * rare.length)];
      seeds[id] = (seeds[id] || 0) + 1;
      out.seeds.push(id);
    }
    this.meta._save();
    return out;
  }
}

// Texto curto de um prêmio: "+60 moedas · +2 madeira"
export function rewardText(r) {
  const parts = [];
  if (r.coins) parts.push(`+${r.coins} moedas`);
  if (r.wood) parts.push(`+${r.wood} madeira`);
  const ns = Array.isArray(r.seeds) ? r.seeds.length : r.seeds || 0;
  if (ns) parts.push(`+${ns} semente${ns > 1 ? "s" : ""} rara${ns > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
