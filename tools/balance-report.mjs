// Relatório de balanceamento — calcula tudo a partir de src/config.js (sem Phaser).
//   uso:  npm run balance
// NÃO simula uma partida: mostra os números que alimentam o balanceamento e
// confere invariantes de design. Quando um invariante quebra o script sai com
// código 1 — rode depois de mexer em dano, vida, vagas ou pratos.
// Win rate por Perigo só sai de jogo de verdade (Analytics "run_end" / testers).
import { readFileSync } from "node:fs";
import { DIFFICULTY, PLAYER, ENEMY, BOSS, MAX_WEAPON_LEVEL, PASSIVE_SLOTS, WEAPONS, BLESSINGS, KITCHEN, ENDLESS } from "../src/config.js";

// MAX_WEAPON_SLOTS mora em UpgradeSystem.js (que importa Phaser): lê o valor do texto
const slotsSrc = readFileSync(new URL("../src/systems/UpgradeSystem.js", import.meta.url), "utf8");
const MAX_WEAPON_SLOTS = +/MAX_WEAPON_SLOTS\s*=\s*(\d+)/.exec(slotsSrc)[1];
const BASE_WEAPONS = (/BASE_WEAPONS\s*=\s*\[([^\]]*)\]/.exec(slotsSrc)[1].match(/"/g) || []).length / 2;

const RUN_S = 7 * 60; // partida até o chefe
const fails = [];
const check = (ok, msg) => {
  if (!ok) fails.push(msg);
  console.log(`  ${ok ? "ok " : "FALHA"}  ${msg}`);
};
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const wave = (t) => Math.floor(t / 30);
const h1 = (t) => console.log(`\n== ${t} ==`);

// ---------------------------------------------------------------- dano do inimigo comum
h1("Dano de contato do inimigo comum (vida do herói: 100 base · 175 com Vigor da Mata no máx.)");
console.log("  Perigo        0:00   2:00   4:00   6:00   7:00   golpes p/ matar 100 HP (início → 7:00)");
for (const d of DIFFICULTY) {
  const at = (t) => ENEMY.DMG(wave(t)) * d.dmgMult;
  const cells = [0, 120, 240, 360, 420].map((t) => at(t).toFixed(1).padStart(6)).join(" ");
  console.log(`  ${d.name.padEnd(11)} ${cells}     ${Math.ceil(PLAYER.HP_BASE / at(0))} → ${Math.ceil(PLAYER.HP_BASE / at(RUN_S))}`);
}
const g = DIFFICULTY[1];
const firstHit = (ENEMY.DMG(0) * g.dmgMult) / PLAYER.HP_BASE;
const lastHit = (ENEMY.DMG(wave(RUN_S)) * g.dmgMult) / PLAYER.HP_BASE;
check(firstHit >= 0.05 && firstHit <= 0.12, `1ª batida em Guardião tira ${pct(firstHit)} da vida (faixa do gênero: 5–12%)`);
check(lastHit <= 0.35, `batida aos 7:00 em Guardião tira ${pct(lastHit)} da vida (≤ 35%: dá para errar 2 vezes)`);

// ---------------------------------------------------------------- chefe
h1("Chefe (Mapinguari) × inimigo comum aos 7:00");
for (const d of DIFFICULTY) {
  const trash = ENEMY.DMG(wave(RUN_S)) * d.dmgMult;
  console.log(`  ${d.name.padEnd(11)} comum ${trash.toFixed(1).padStart(5)} · chefe corpo a corpo ${(BOSS.DMG_MELEE * d.dmgMult).toFixed(1).padStart(5)} · projétil ${(BOSS.DMG_PROJECTILE * d.dmgMult).toFixed(1).padStart(5)}`);
}
check(BOSS.DMG_MELEE > ENEMY.DMG(wave(RUN_S)), "chefe corpo a corpo bate mais que o inimigo comum do fim da partida");
check(BOSS.DMG_PROJECTILE >= 0.5 * ENEMY.DMG(wave(RUN_S)), "projétil do chefe ≥ metade do golpe comum do fim");

// ---------------------------------------------------------------- orçamento de níveis
h1("Orçamento de níveis (estimativa: mata tudo que nasce, XP_VALUE por abate, sem bônus de XP)");
const xpToReach = (L) => {
  let s = 0;
  for (let l = 1; l < L; l++) s += PLAYER.XP_PER_LEVEL(l);
  return s;
};
const spawns = (d) => d.spawnMult * (0.6 * RUN_S + (RUN_S * RUN_S) / 150); // ∫ SPAWN_RATE(t) dt
const levelsAt7 = (d) => {
  const xp = spawns(d) * ENEMY.XP_VALUE;
  let L = 1;
  while (xpToReach(L + 1) <= xp) L++;
  return L;
};
for (const d of DIFFICULTY) console.log(`  ${d.name.padEnd(11)} ~${Math.round(spawns(d))} inimigos · nível ~${levelsAt7(d)} aos 7:00 (≈ ${levelsAt7(d) - 1} cartas)`);
const picksG = levelsAt7(DIFFICULTY[1]) - 1;
const picksNeeded = (MAX_WEAPON_SLOTS - 1) + MAX_WEAPON_SLOTS * (MAX_WEAPON_LEVEL - 1) + PASSIVE_SLOTS; // armas novas + subir todas + 1 carta por passiva
console.log(`  vagas: ${MAX_WEAPON_SLOTS} armas (herói já nasce com 1) · ${PASSIVE_SLOTS} passivas · ${BASE_WEAPONS} armas base · nível máx. da arma ${MAX_WEAPON_LEVEL}`);
console.log(`  cartas para "fechar" a build: ~${picksNeeded} · cartas disponíveis em Guardião: ~${picksG}`);
check(MAX_WEAPON_SLOTS < BASE_WEAPONS, `vagas de arma (${MAX_WEAPON_SLOTS}) < armas base (${BASE_WEAPONS}): escolher quais levar é decisão`);
check(picksNeeded >= picksG * 0.8, `fechar a build pede ~${picksNeeded} cartas e há ~${picksG}: o tempo também limita (nem tudo fica no máximo)`);
check(MAX_WEAPON_SLOTS >= 3, "pelo menos 3 vagas de arma (o herói já nasce com 1)");

// ---------------------------------------------------------------- poder permanente + prato
h1("Poder permanente × prato (valores no máximo)");
const rank = (id, f) => {
  const b = BLESSINGS.find((x) => x.id === id);
  const p = { maxHp: PLAYER.HP_BASE, hp: PLAYER.HP_BASE, speed: 1, critChance: 0, pickupRadius: 1 };
  b.apply(p, 5);
  return f(p);
};
const dmgBless = rank("dmg1", (p) => p._blessingDmgMult - 1);
const hpBless = rank("hp1", (p) => p.maxHp / PLAYER.HP_BASE - 1);
const goldMult = KITCHEN.QUALITY_MULT[KITCHEN.QUALITY_MULT.length - 1];
const bestMeal = (stat) => Math.max(...KITCHEN.RECIPES.map((r) => r.bonus[stat] ?? 0)) * goldMult;
console.log(`  dano:  bênção cheia +${pct(dmgBless)} · melhor prato Ouro +${pct(bestMeal("dmg"))}`);
console.log(`  vida:  bênção cheia +${pct(hpBless)} · melhor prato Ouro +${pct(bestMeal("hp"))}`);
check(bestMeal("dmg") <= dmgBless * 0.5, "melhor prato de dano ≤ 50% de uma bênção de dano cheia");
check(bestMeal("hp") <= hpBless * 0.6, "melhor prato de vida ≤ 60% de uma bênção de vida cheia");

// ---------------------------------------------------------------- Noite Eterna
h1("Noite Eterna (após o chefe)");
const w14 = ENEMY.DMG(wave(RUN_S));
for (const m of [1, 3, 5]) console.log(`  +${m} min: vida dos inimigos ×${Math.pow(1 + ENDLESS.HP_GROWTH_PER_MIN, m).toFixed(2)} · dano ${(w14 * Math.pow(1 + ENDLESS.DMG_GROWTH_PER_MIN, m)).toFixed(1)}`);

console.log(fails.length ? `\n${fails.length} invariante(s) quebrado(s).` : "\nTodos os invariantes ok.");
process.exit(fails.length ? 1 : 0);
