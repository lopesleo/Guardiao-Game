// Gera 3 cartas elegíveis no level-up, com SORTEIO PONDERADO:
//   nova arma (peso 3) · melhoria de arma (peso 4) · passiva (peso 1 cada).
// Sem peso, as 11 passivas soterravam as armas — builds ficavam aleatórias.
// Evolução elegível = carta garantida.
import { WEAPONS, MAX_WEAPON_LEVEL, PASSIVES } from "../config.js";
import { WEAPON_ICON, PASSIVE_ICON } from "../art/Icons.js";
import { WEAPON_CLASSES } from "../entities/Weapons.js";

// Ordem = ordem de exibição no menu de desbloqueio
export const BASE_WEAPONS = ["STAFF", "AURA", "BOOMER", "CHAIN", "ORB", "FLAME"];
export const MAX_WEAPON_SLOTS = 6;

export const WEAPON_DESC = {
  STAFF: "Bola de fogo no inimigo mais próximo.",
  AURA: "Campo gélido: dano contínuo e congela quem demora dentro.",
  BOOMER: "Bumerangue em brasa que atravessa e volta.",
  CHAIN: "Raio de dano alto; prefere alvos já afetados.",
  ORB: "Orbes de gelo giram ao seu redor e resfriam quem tocam.",
  FLAME: "Sopro de fogo em cone na direção em que você anda.",
};

const WEAPON_MODS = {
  STAFF: ["dmg", "cd", "range", "proj"],
  AURA: ["dmg", "cd", "range"],
  BOOMER: ["dmg", "cd", "range"],
  CHAIN: ["dmg", "cd", "range", "proj"],
  ORB: ["dmg", "proj", "range"],
  FLAME: ["dmg", "cd", "range"],
};

// Sorteio ponderado sem reposição
function weightedPick(list, n) {
  const pool = list.slice();
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, c) => s + c._w, 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i]._w;
      if (r <= 0) break;
    }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export class UpgradeSystem {
  constructor(scene) {
    this.scene = scene;
  }

  generateCards(player) {
    const cards = [];
    const rInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

    // 1) Novas armas — só as desbloqueadas na meta-progressão, com slot livre
    const unlocked = this.scene.meta?.unlocked || ["STAFF"];
    const have = new Set(player.weapons.map((w) => w.key));
    const haveBase = new Set(player.weapons.map((w) => w.baseKey ?? w.key));
    if (player.weapons.length < MAX_WEAPON_SLOTS) {
      for (const key of BASE_WEAPONS) {
        if (!unlocked.includes(key) || haveBase.has(key)) continue;
        cards.push({
          type: "new",
          weaponKey: key,
          title: WEAPONS[key].name,
          desc: WEAPON_DESC[key],
          stat: "Nova arma",
          icon: WEAPON_ICON[key],
          element: WEAPONS[key].element,
          level: 0,
          _w: 3,
        });
      }
    }

    // 2) Melhorias — cada arma rola UM modificador
    for (const w of player.weapons) {
      if (w.level >= MAX_WEAPON_LEVEL) continue;
      const pool = WEAPON_MODS[w.key] || ["dmg"];
      const mod = pool[Math.floor(Math.random() * pool.length)];
      let stat, apply;
      if (mod === "dmg") {
        const v = rInt(15, 30);
        stat = `+${v}% Dano`;
        apply = () => (w.dmgMult *= 1 + v / 100);
      } else if (mod === "cd") {
        const v = rInt(10, 20);
        stat = `−${v}% Recarga`;
        apply = () => (w.cdMult *= 1 - v / 100);
      } else if (mod === "range") {
        const v = rInt(12, 22);
        stat = `+${v}% Alcance`;
        apply = () => (w.rangeMult *= 1 + v / 100);
      } else {
        stat = w.key === "ORB" ? "+1 Orbe" : "+1 Projétil";
        apply = () => (w.extraProj += 1);
      }
      cards.push({
        type: "upgrade",
        weaponKey: w.key,
        title: WEAPONS[w.key].name,
        desc: WEAPON_DESC[w.key] ?? "",
        stat,
        icon: WEAPON_ICON[w.key],
        element: WEAPONS[w.key].element,
        level: w.level,
        _w: 4,
        _apply: () => {
          apply();
          w.level += 1;
        },
      });
    }

    // 3) Passivas — valor rolado dentro de uma faixa
    for (const ps of PASSIVES) {
      const rolled = ps.roll();
      cards.push({
        type: "passive",
        passiveId: ps.id,
        title: ps.label,
        desc: ps.desc,
        stat: rolled.name,
        icon: PASSIVE_ICON[ps.id] ?? "ico_plus",
        _w: 1,
        _apply: rolled.apply,
      });
    }

    const evo = this._evolutionCard(player, have);
    if (evo) return [evo, ...weightedPick(cards, 2)];
    return weightedPick(cards, 3);
  }

  // Primeira evolução elegível: def com evolvesFrom, âncora no nível MAX,
  // parceira na run e evolução ainda não obtida.
  _evolutionCard(player, have) {
    for (const key of Object.keys(WEAPONS)) {
      const def = WEAPONS[key];
      if (!def.evolvesFrom || have.has(key)) continue;
      const anchor = player.weapons.find((w) => w.key === def.evolvesFrom);
      if (!anchor || anchor.level < MAX_WEAPON_LEVEL) continue;
      if (!have.has(def.partner)) continue;
      return {
        type: "evolution",
        weaponKey: key,
        title: def.name,
        desc: this._evoDesc(key),
        stat: `${WEAPONS[def.evolvesFrom].name} + ${WEAPONS[def.partner].name}`,
        icon: WEAPON_ICON[key],
        element: def.element,
      };
    }
    return null;
  }

  _evoDesc(key) {
    return (
      {
        VAPOR_STORM: "As bolas de fogo EXPLODEM em nuvem escaldante no impacto.",
        OVERLOAD_X: "O raio SALTA em cadeia entre até 5 inimigos.",
        WINTER_HEART: "A aura pulsa NOVAS de estilhaços que congelam de longe.",
        PHOENIX: "O bumerangue deixa um RASTRO DE CHAMAS pelo caminho.",
        GLACIER: "Os orbes crescem e CONGELAM na hora quem tocam.",
        INFERNO: "O sopro vira um INFERNO que deixa o chão em chamas.",
      }[key] || WEAPONS[key].name
    );
  }

  apply(card, player) {
    if (card.type === "new") {
      const cls = WEAPON_CLASSES[card.weaponKey];
      if (cls) player.addWeapon(new cls(this.scene));
      this.scene.hud?.refreshWeapons();
    } else if (card.type === "evolution") {
      {
        const def = WEAPONS[card.weaponKey];
        const cls = WEAPON_CLASSES[card.weaponKey];
        const idx = player.weapons.findIndex((w) => w.key === def.evolvesFrom);
        if (!cls || idx < 0) return;
        const old = player.weapons[idx];
        const evo = new cls(this.scene);
        // Herda o investimento da âncora; nível MAX tira das cartas de upgrade
        evo.dmgMult = old.dmgMult;
        evo.cdMult = old.cdMult;
        evo.rangeMult = old.rangeMult;
        evo.extraProj = old.extraProj;
        evo.level = MAX_WEAPON_LEVEL;
        evo.owner = player;
        old.dispose();
        player.weapons[idx] = evo;
        this.scene.sound.play("sfx_levelup", { volume: 0.7, rate: 0.8 });
        this.scene.cameras.main.flash(220, 216, 140, 255); // flash roxo de evolução
        this.scene._toast?.(`★ ${def.name}! ★`, 2200);
        this.scene.hud?.refreshWeapons();
        this.scene._checkAchievements?.(); // "Metamorfose"
      }
    } else if (card.type === "upgrade") {
      if (card._apply) card._apply();
      else {
        const w = player.weapons.find((w) => w.key === card.weaponKey);
        if (w) {
          w.level += 1;
          w.dmgMult *= 1.25;
        }
      }
    } else if (card.type === "passive") {
      if (card._apply) card._apply(player);
      player.passivesTaken ??= {};
      player.passivesTaken[card.passiveId] = (player.passivesTaken[card.passiveId] || 0) + 1;
      // Conquista "Osso Duro" (quase-pacifista): marca se pegou passivo de HP
      if (card.passiveId === "hp" && this.scene._runFlags) {
        this.scene._runFlags.tookHpPassive = true;
      }
    }
  }
}
