// Cozinha da Clareira: receitas com a colheita do celeiro (meta.data.pantry).
// Prato cozinhado fica guardado (meta.data.dishes, por qualidade); comer UM
// (meta.data.meal) dá o bônus só na próxima partida, que o consome.
import { KITCHEN, GARDEN, FISHING } from "../config.js";
import { pantryCount } from "./Garden.js";

export const recipe = (id) => KITCHEN.RECIPES.find((r) => r.id === id);
// Nome de um ingrediente (planta da horta ou peixe do lago)
export const itemName = (id) => GARDEN.CROPS[id]?.name ?? FISHING.FISH[id]?.name ?? id;

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
    const seen = (k) => {
      if (FISHING.FISH[k]) return (d.revealed || []).includes("pond"); // peixe: depois que o Lago aparece
      return !GARDEN.CROPS[k]?.rare || pantryCount(d, k) > 0 || (d.seeds?.[k] || 0) > 0 || (d.garden?.plots || []).some((p) => p?.crop === k);
    };
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
    this.meta._save();
    return { id, q };
  }

  // Come um prato pronto: o bônus vale na próxima partida (1 por partida;
  // comeu, não tem volta)
  eat(id, q) {
    const d = this.meta.data;
    const row = d.dishes[id];
    if (d.meal || !row || row[q] <= 0) return false;
    row[q]--;
    d.meal = { id, q };
    this.meta._save();
    return true;
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
      if (stat === "pickup") return `+${pct(v)}% raio de coleta`;
      if (stat === "cd") return `−${pct(v)}% recarga`;
      if (stat === "crit") return `+${pct(v)}% crítico`;
      if (stat === "regen") return `+${(v * k).toFixed(1).replace(".", ",")} vida/s`;
      return "";
    })
    .join(" · ");
}
