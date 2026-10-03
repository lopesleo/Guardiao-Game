// Verificador de CONTEÚDO (armas, evoluções, laços, guardiões, biomas, desbloqueios).
// Roda sem navegador: `npm run check` (ou node tools/check-content.mjs).
// Erro (✗) = algo vai quebrar no jogo · aviso (!) = regra de design não cumprida.
// Ver docs/CONTEUDO.md para o passo a passo de cada tipo de conteúdo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WEAPONS, BASE_WEAPON_KEYS, EVOLUTION_KEYS, STARTER_WEAPONS, LINKS, CHARACTERS, LEGENDS, META, BUILD, DEED_STATS, ELEMENT,
  BIOMES, BUILDINGS, BOSS_FIGHT, GARDEN, FISHING, KITCHEN,
} from "../src/config.js";
import { ICON_KEYS } from "../src/art/Icons.js";
import { HERO_IDS } from "../src/art/Hero.js";
import { RIG_IDS } from "../src/art/HeroRig.js";
import { LINK_EFFECTS, EVENTS } from "../src/systems/Links.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const ELS = Object.values(ELEMENT);
const icons = new Set(ICON_KEYS());
const noReaction = []; // evoluções que não geram reação sozinhas (regra 2 é "de preferência")

// Classes registradas: chaves do objeto WEAPON_CLASSES + chamadas registerWeapon("X", ...)
const entitySrc = fs.readdirSync(path.join(ROOT, "src/entities")).map((f) => src(`src/entities/${f}`)).join("\n");
const classes = new Set();
const block = /export const WEAPON_CLASSES = \{([\s\S]*?)\n\};/.exec(src("src/entities/Weapons.js"))?.[1] ?? "";
for (const m of block.matchAll(/^\s+([A-Z_]+):/gm)) classes.add(m[1]);
for (const m of entitySrc.matchAll(/registerWeapon\("([A-Z_]+)"/g)) classes.add(m[1]);

// Sons usados por uma arma precisam existir no sintetizador
const synth = src("src/audio/Synth.js");

// ---------- Armas ----------
for (const [k, d] of Object.entries(WEAPONS)) {
  const tag = `arma ${k}`;
  if (!d.name) err(`${tag}: sem name`);
  if (!ELS.includes(d.element)) err(`${tag}: element "${d.element}" inválido (use ELEMENT.*)`);
  if (!d.desc) err(`${tag}: sem desc (texto da carta/Forja)`);
  if (!d.icon) err(`${tag}: sem icon`);
  else if (!icons.has(d.icon)) err(`${tag}: ícone "${d.icon}" não existe em src/art/Icons.js`);
  if (!classes.has(k)) err(`${tag}: nenhuma classe registrada (WEAPON_CLASSES ou registerWeapon("${k}", ...))`);
  for (const el of d.also ?? []) if (!ELS.includes(el)) err(`${tag}: also tem elemento inválido "${el}"`);
  if (d.evolvesFrom) {
    if (!BASE_WEAPON_KEYS.includes(d.evolvesFrom)) err(`${tag}: evolvesFrom "${d.evolvesFrom}" não é arma base`);
    if (!BASE_WEAPON_KEYS.includes(d.partner)) err(`${tag}: partner "${d.partner}" não é arma base`);
    if (d.partner === d.evolvesFrom) err(`${tag}: partner igual à âncora`);
    const els = new Set([d.element, ...(d.also ?? [])]);
    if (els.size < 2 && !d.reaction) noReaction.push(k);
  } else {
    if (!Array.isArray(d.mods) || !d.mods.length) err(`${tag}: arma base sem mods (melhorias das cartas)`);
    for (const m of d.mods ?? []) if (!["dmg", "cd", "range", "proj"].includes(m)) err(`${tag}: mod "${m}" desconhecido`);
    const u = d.unlock;
    if (!u) err(`${tag}: sem unlock ({ start: true } ou { forge, cost, deed? })`);
    else if (!u.start) {
      if (!(u.forge >= 1 && u.forge <= 4)) err(`${tag}: unlock.forge deve ser 1..4`);
      if (!(u.cost >= 0)) err(`${tag}: unlock.cost inválido`);
      if (u.deed) {
        if (!DEED_STATS.includes(u.deed.stat)) err(`${tag}: feito com stat "${u.deed.stat}" desconhecida (DEED_STATS)`);
        if (u.deed.n > 1 && !u.deed.text?.includes("{n}")) warn(`${tag}: texto do feito sem {n}`);
      }
    }
    // Regra 3: nenhuma carta "morta" — a arma base é parceira de alguma evolução OU faz parte de um laço
    const partner = EVOLUTION_KEYS.some((e) => WEAPONS[e].partner === k);
    const inLink = LINKS.some((l) => l.a === k || l.b === k);
    if (!partner && !inLink) warn(`${tag}: sem sinergia (não é parceira de evolução nem está em laço)`);
    if (!EVOLUTION_KEYS.some((e) => WEAPONS[e].evolvesFrom === k)) warn(`${tag}: não tem evolução`);
  }
}
// Duas evoluções com a mesma receita = uma nunca aparece
const recipes = new Map();
for (const e of EVOLUTION_KEYS) {
  const r = `${WEAPONS[e].evolvesFrom}+${WEAPONS[e].partner}`;
  if (recipes.has(r)) err(`evoluções ${recipes.get(r)} e ${e} com a mesma receita ${r}`);
  recipes.set(r, e);
}

// ---------- Laços ----------
const linkIds = new Set();
for (const l of LINKS) {
  const tag = `laço ${l.id}`;
  if (linkIds.has(l.id)) err(`${tag}: id repetido`);
  linkIds.add(l.id);
  for (const k of [l.a, l.b]) if (!BASE_WEAPON_KEYS.includes(k)) err(`${tag}: "${k}" não é arma base`);
  if (!l.name || !l.desc) err(`${tag}: sem name/desc`);
  const fx = LINK_EFFECTS[l.id];
  if (!fx) err(`${tag}: sem efeito em LINK_EFFECTS (src/systems/Links.js)`);
  for (const ev of Object.keys(fx ?? {})) {
    if (!EVENTS[ev]) err(`${tag}: escuta "${ev}", que não está em EVENTS`);
    else if (!entitySrc.includes(`"${ev}"`)) err(`${tag}: nenhuma arma emite "${ev}"`);
  }
}
for (const id of Object.keys(LINK_EFFECTS)) if (!linkIds.has(id)) warn(`efeito de laço "${id}" sem entrada em LINKS`);
const pairSeen = new Set();
for (const l of LINKS) {
  const p = [l.a, l.b].sort().join("+");
  if (pairSeen.has(p)) warn(`dois laços para a mesma dupla ${p}`);
  pairSeen.add(p);
}

// ---------- Guardiões ----------
const startIds = CHARACTERS.filter((c) => c.unlock?.start).map((c) => c.id);
if (startIds.length !== 1) err(`deve haver exatamente 1 guardião inicial (unlock.start); há ${startIds.length}`);
for (const c of CHARACTERS) {
  const tag = `guardião ${c.id}`;
  if (!WEAPONS[c.weapon] || WEAPONS[c.weapon].evolvesFrom) err(`${tag}: arma inicial "${c.weapon}" não é arma base`);
  if (!HERO_IDS.includes(c.id)) err(`${tag}: sem desenho em src/art/Hero.js (DRAW)`);
  if (!RIG_IDS.includes(c.id)) err(`${tag}: sem poses de queda em src/art/HeroRig.js`);
  if (!c.legend?.id || !c.legend.origin) err(`${tag}: sem legend { id, role, origin } (bestiário)`);
  const u = c.unlock;
  if (!u) err(`${tag}: sem unlock`);
  else if (!u.start) {
    if (!(u.fire >= 1 && u.fire <= 4)) err(`${tag}: unlock.fire deve ser 1..4`);
    if (u.deed && !DEED_STATS.includes(u.deed.stat)) err(`${tag}: feito com stat "${u.deed.stat}" desconhecida`);
    if (u.deed && !(c.cost > 0)) warn(`${tag}: guardião de feito sem cost`);
  }
  for (const m of Object.keys(c.mods ?? {})) if (!["hp", "speed", "crit", "area", "regen", "cd", "dmg", "luck"].includes(m)) err(`${tag}: mod "${m}" não é aplicado (GameScene._applyCharacterMods)`);
}
const legendIds = LEGENDS.map((l) => l.id);
if (new Set(legendIds).size !== legendIds.length) err("bestiário com id repetido");

// ---------- Biomas (mapas) ----------
// Cada bioma: cenário registrado, chefe no bestiário + registerBoss + kit, músicas, troca
// de arte que existe, desbloqueio alcançável pela obra da Trilha.
{
  const preload = src("src/scenes/PreloadScene.js");
  const synth = src("src/audio/Synth.js");
  const enemies = src("src/entities/Enemies.js");
  const bossFiles = entitySrc;
  const scene = src("src/scenes/GameScene.js");
  for (const [id, b] of Object.entries(BIOMES)) {
    const tag = `bioma ${id}`;
    for (const f of ["name", "desc", "env", "boss", "bossName", "wake", "freed", "music", "bossMusic", "light"]) if (b[f] == null) err(`${tag}: falta "${f}"`);
    if (b.env && !preload.includes(`"${b.env}"`)) err(`${tag}: cenário "${b.env}" não é registrado na PreloadScene`);
    for (const k of [b.music, b.bossMusic]) if (k && !synth.includes(`"${k}"`)) err(`${tag}: música "${k}" não existe em Synth.js`);
    if (b.boss && !legendIds.includes(b.boss)) err(`${tag}: chefe "${b.boss}" fora do bestiário (LEGENDS)`);
    if (b.boss && b.boss !== "mapinguari" && !bossFiles.includes(`registerBoss("${b.boss}"`)) err(`${tag}: chefe "${b.boss}" sem registerBoss`);
    if (b.boss && b.boss !== "mapinguari") {
      const file = fs.readdirSync(path.join(ROOT, "src/entities")).find((f) => src(`src/entities/${f}`).includes(`registerBoss("${b.boss}"`));
      if (file && !scene.includes(`import "../entities/${file}"`)) err(`${tag}: ${file} (chefe) não é importado na GameScene`);
    }
    for (const [from, to] of Object.entries(b.looks ?? {})) if (!enemies.includes(`${to}: ["mon_${to}"`)) err(`${tag}: arte "${to}" (no lugar de ${from}) não está em LOOK (Enemies.js)`);
    for (const k of ["dusk", "night", "boss"]) if (b.light && !(Array.isArray(b.light[k]) && b.light[k].length === 3)) err(`${tag}: light.${k} deve ser [r, g, b]`);
    const u = b.unlock;
    if (u) {
      if (!(u.trail >= 2 && u.trail <= BUILDINGS.trail.max)) err(`${tag}: unlock.trail ${u.trail} fora de 2..${BUILDINGS.trail.max} (BUILDINGS.trail.max)`);
      else if (!BUILDINGS.trail.steps?.[u.trail - 1]) err(`${tag}: a obra da Trilha não tem custo para o nível ${u.trail}`);
      if (u.won && !BIOMES[u.won]) err(`${tag}: unlock.won "${u.won}" não é bioma`);
    }
  }
  const trails = Object.values(BIOMES).map((b) => b.unlock?.trail).filter(Boolean);
  if (new Set(trails).size !== trails.length) err("dois biomas abrem no mesmo nível da Trilha");
  if (!BOSS_FIGHT.CABOCLO) err("BOSS_FIGHT.CABOCLO sumiu (kit do Caboclo d'Água)");
}

// ---------- Clareira: plantas, peixes e pratos têm arte; "biome" aponta para um bioma ----------
{
  const garden = src("src/art/Garden.js"),
    pond = src("src/art/Pond.js"),
    kitchen = src("src/art/Kitchen.js");
  const has = (txt, id, ...forms) => forms.some((f) => txt.includes(f.replace("ID", id)));
  for (const [id, c] of Object.entries(GARDEN.CROPS)) {
    if (!has(garden, id, "  ID: {", "CROP_ART.ID =")) err(`planta ${id}: sem arte em Garden.js (CROP_ART)`);
    if (!has(garden, id, "  ID() {", "ICONS.ID =")) err(`planta ${id}: sem ícone em Garden.js (ICONS)`);
    if (c.biome && !BIOMES[c.biome]) err(`planta ${id}: biome "${c.biome}" não existe`);
    if (c.biome && !c.rare) warn(`planta ${id}: de bioma mas não é rara (a semente não cai nas partidas)`);
  }
  for (const [id, f] of Object.entries(FISHING.FISH)) {
    if (!has(pond, id, "  ID: { body")) err(`peixe ${id}: sem arte em Pond.js (FISH_ART)`);
    if (f.biome && !BIOMES[f.biome]) err(`peixe ${id}: biome "${f.biome}" não existe`);
  }
  for (const r of KITCHEN.RECIPES) {
    if (!has(kitchen, r.id, "  ID: { food")) err(`prato ${r.id}: sem ícone em Kitchen.js (DISH)`);
    for (const k of Object.keys(r.needs)) if (!GARDEN.CROPS[k] && !FISHING.FISH[k]) err(`prato ${r.id}: ingrediente "${k}" não existe`);
  }
}

// ---------- Desbloqueios derivados (sanidade) ----------
for (const k of META.WEAPON_UNLOCK_ORDER) if (BUILD.FORGE_WEAPON_LEVEL[k] == null) err(`Forja: ${k} sem nível`);
for (const k of BASE_WEAPON_KEYS) if (!STARTER_WEAPONS.includes(k) && !META.WEAPON_UNLOCK_ORDER.includes(k)) err(`${k}: nem inicial nem forjável`);

// ---------- Relatório ----------
const byEl = (keys) => Object.fromEntries(ELS.map((el) => [el, keys.filter((k) => WEAPONS[k].element === el).length]));
console.log(`Armas base: ${BASE_WEAPON_KEYS.length} ${JSON.stringify(byEl(BASE_WEAPON_KEYS))} · evoluções: ${EVOLUTION_KEYS.length} · laços: ${LINKS.length} · guardiões: ${CHARACTERS.length} · biomas: ${Object.keys(BIOMES).length}`);
if (noReaction.length) console.log(`  · evoluções sem reação própria (ok, mas a regra 2 prefere que gerem): ${noReaction.join(", ")}`);
for (const w of warns) console.log(`  ! ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
console.log(errors.length ? `\n${errors.length} erro(s).` : `\nOK — nenhum erro${warns.length ? ` (${warns.length} aviso(s))` : ""}.`);
process.exit(errors.length ? 1 : 0);
