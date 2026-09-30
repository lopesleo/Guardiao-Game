// Cozinha da Clareira: receitas com a colheita do celeiro (meta.data.pantry).
// Prato pronto vai para a marmita (meta.data.dishes, por qualidade); UM prato
// servido (meta.data.meal) vale só para a próxima partida e é consumido nela.
import { KITCHEN, GARDEN } from "../config.js";
import { pantryCount } from "./Garden.js";

export const recipe = (id) => KITCHEN.RECIPES.find((r) => r.id === id);

export class Kitchen {
  constructor(meta) {
    this.meta = meta;
    const d = meta.data;
    d.pantry ||= {};
    d.dishes ||= {};
    if (d.meal && !recipe(d.meal.id)) d.meal = null;
  }

  // Receitas à mostra: as comuns sempre; as mágicas só depois de ver a semente
  known() {
    const d = this.meta.data;
    const seen = (k) => !GARDEN.CROPS[k]?.rare || pantryCount(d, k) > 0 || (d.seeds?.[k] || 0) > 0 || (d.garden?.plots || []).some((p) => p?.crop === k);
    return KITCHEN.RECIPES.filter((r) => (d.cooked || []).includes(r.id) || Object.keys(r.needs).every(seen));
  }

  canCook(r) {
    return Object.entries(r.needs).every(([k, n]) => pantryCount(this.meta.data, k) >= n);
  }

  // Cozinha: usa os melhores ingredientes primeiro. Devolve { id, q } ou null.
  cook(id) {
    const r = recipe(id);
    if (!r || !this.canCook(r)) return null;
    const d = this.meta.data;
    let sum = 0,
      count = 0;
    for (const [k, n] of Object.entries(r.needs)) {
      const row = d.pantry[k];
      let left = n;
      for (let q = 2; q >= 0 && left > 0; q--) {
        const take = Math.min(left, row[q]);
        row[q] -= take;
        left -= take;
        sum += q * take;
        count += take;
      }
    }
    const q = Math.floor(sum / count);
    const row = (d.dishes[id] ||= [0, 0, 0]);
    row[q]++;
    (d.cooked ||= []).includes(id) || d.cooked.push(id);
    d.stats.dishesCooked = (d.stats.dishesCooked || 0) + 1;
    // Nada servido ainda: serve na hora (um toque a menos)
    if (!d.meal) this.serve(id, q, false);
    this.meta._save();
    return { id, q };
  }

  // Serve um prato da marmita para a próxima partida (devolve o anterior)
  serve(id, q, save = true) {
    const d = this.meta.data;
    const row = d.dishes[id];
    if (!row || row[q] <= 0) return false;
    this.unserve(false);
    row[q]--;
    d.meal = { id, q };
    if (save) this.meta._save();
    return true;
  }

  unserve(save = true) {
    const d = this.meta.data;
    if (!d.meal) return;
    const row = (d.dishes[d.meal.id] ||= [0, 0, 0]);
    row[d.meal.q]++;
    d.meal = null;
    if (save) this.meta._save();
  }

  dishCount() {
    return Object.values(this.meta.data.dishes).reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0);
  }
}

// Modificadores do prato (mesmo formato dos mods de personagem) + xp
export function mealMods(meal) {
  const r = recipe(meal.id);
  const k = KITCHEN.QUALITY_MULT[meal.q] ?? 1;
  const m = {};
  for (const [stat, v] of Object.entries(r.bonus)) {
    const b = v * k;
    if (stat === "cd") m.cd = 1 - b;
    else if (stat === "crit" || stat === "regen") m[stat] = b;
    else m[stat] = 1 + b;
  }
  return m;
}

// "+34% vida máxima" etc.
export function bonusText(r, q = 0) {
  const k = KITCHEN.QUALITY_MULT[q] ?? 1;
  const pct = (v) => Math.round(v * k * 100);
  return Object.entries(r.bonus)
    .map(([stat, v]) => {
      if (stat === "hp") return `+${pct(v)}% vida máxima`;
      if (stat === "speed") return `+${pct(v)}% velocidade`;
      if (stat === "dmg") return `+${pct(v)}% dano`;
      if (stat === "area") return `+${pct(v)}% área`;
      if (stat === "xp") return `+${pct(v)}% XP`;
      if (stat === "cd") return `−${pct(v)}% recarga`;
      if (stat === "crit") return `+${pct(v)}% crítico`;
      if (stat === "regen") return `+${(v * k).toFixed(1).replace(".", ",")} vida/s`;
      return "";
    })
    .join(" · ");
}
