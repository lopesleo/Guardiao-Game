// Gera 3 cartas elegíveis no level-up.
// - se o jogador não tem todas as armas: pode oferecer NOVA arma
// - se tem arma com nível < MAX: pode oferecer UPGRADE
// - sempre pode oferecer passivo
// (Evoluções foram DESATIVADAS por ora — eram só um Staff reskin sem mecânica.)
import { WEAPONS, MAX_WEAPON_LEVEL, PASSIVES } from "../config.js";
import { pick, shuffle } from "../utils.js";

// Armas disponíveis para a run = APENAS as desbloqueadas na MetaProgression.
// Filtrado dinamicamente em generateCards() lendo this.scene.meta.unlocked.
const ALL_WEAPONS = ["STAFF", "AURA", "BOOMER", "CHAIN"];

export class UpgradeSystem {
  constructor(scene) {
    this.scene = scene;
  }

  generateCards(player) {
    const cards = [];

    // 1) Novas armas — APENAS as desbloqueadas na meta-progressão
    const unlocked = this.scene.meta?.unlocked || ["STAFF"];
    const runWeapons = ALL_WEAPONS.filter((w) => unlocked.includes(w));
    const have = new Set(player.weapons.map((w) => w.key));
    for (const key of runWeapons) {
      if (!have.has(key)) {
        cards.push({
          type: "new",
          weaponKey: key,
          title: WEAPONS[key].name,
          desc: this._weaponDesc(key),
        });
      }
    }

    // 2) Upgrades de armas existentes — rola modificador aleatório por arma
    const weaponMods = {
      STAFF: ["dmg", "cd", "range", "proj"],
      AURA: ["dmg", "cd", "range"],
      BOOMER: ["dmg", "cd", "range"],
      CHAIN: ["dmg", "cd", "range", "proj"],
    };
    const rInt = (min, max) =>
      Math.floor(min + Math.random() * (max - min + 1));
    for (const w of player.weapons) {
      if (w.level >= MAX_WEAPON_LEVEL) continue;
      const pool = weaponMods[w.key] || ["dmg"];
      const mod = pool[Math.floor(Math.random() * pool.length)];
      const wName = WEAPONS[w.key].name;
      const lvlTxt = `Lv ${w.level} → ${w.level + 1}`;
      let title = wName,
        desc = "",
        apply;
      if (mod === "dmg") {
        const v = rInt(15, 30);
        desc = `+${v}% Dano · ${lvlTxt}`;
        apply = () => {
          w.dmgMult *= 1 + v / 100;
          w.level += 1;
        };
      } else if (mod === "cd") {
        const v = rInt(10, 22);
        desc = `−${v}% Recarga · ${lvlTxt}`;
        apply = () => {
          w.cdMult *= 1 - v / 100;
          w.level += 1;
        };
      } else if (mod === "range") {
        const v = rInt(10, 20);
        desc = `+${v}% Alcance · ${lvlTxt}`;
        apply = () => {
          w.rangeMult *= 1 + v / 100;
          w.level += 1;
        };
      } else if (mod === "proj") {
        desc = `+1 Projétil · ${lvlTxt}`;
        apply = () => {
          w.extraProj += 1;
          w.level += 1;
        };
      }
      cards.push({
        type: "upgrade",
        weaponKey: w.key,
        title,
        desc,
        _apply: apply,
      });
    }

    // 3) Passivos — cada um rola valor aleatório DENTRO de uma faixa
    for (const p of PASSIVES) {
      const rolled = p.roll();
      cards.push({
        type: "passive",
        passiveId: p.id,
        title: rolled.name,
        desc: "Modificador permanente",
        _apply: rolled.apply,
      });
    }

    // Embaralha e escolhe até 3.
    return shuffle(cards).slice(0, 3);
  }

  _weaponDesc(key) {
    const w = WEAPONS[key];
    const elem = { fire: "🔥", ice: "❄️", bolt: "⚡" }[w.element] || "";
    const desc =
      {
        STAFF: "Projétil de fogo no inimigo mais próximo",
        AURA: "Aura gélida de dano contínuo ao redor",
        BOOMER: "Bumerangue flamejante que volta",
        CHAIN: "Raio elétrico de dano alto em um alvo",
      }[key] || "";
    return `${elem} ${desc}`;
  }

  apply(card, player) {
    if (card.type === "new") {
      // Cria a arma e adiciona ao player
      // (import dinâmico evita ciclo)
      import("../entities/Weapons.js").then((m) => {
        const cls = m.WEAPON_CLASSES[card.weaponKey];
        if (cls) player.addWeapon(new cls(this.scene));
        // Conquista "Arsenal Completo" — checa aqui porque a arma entra async
        this.scene._checkAchievements?.();
      });
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
      // Conquista "Osso Duro" (quase-pacifista): marca se pegou passivo de HP
      if (card.passiveId === "hp" && this.scene._runFlags) {
        this.scene._runFlags.tookHpPassive = true;
      }
    }
  }
}
