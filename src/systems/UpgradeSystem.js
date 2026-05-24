// Gera 3 cartas elegíveis no level-up.
// - se o jogador não tem todas as armas: pode oferecer NOVA arma
// - se tem arma com nível < MAX: pode oferecer UPGRADE
// - se 2 armas estão em max-level e formam uma evolução: oferece EVOLUÇÃO (prioritária)
// - sempre pode oferecer passivo
import { WEAPONS, MAX_WEAPON_LEVEL, PASSIVES } from '../config.js';
import { pick, shuffle } from '../utils.js';

// Armas disponíveis para a run = APENAS as desbloqueadas na MetaProgression.
// Filtrado dinamicamente em generateCards() lendo this.scene.meta.unlocked.
const ALL_WEAPONS = ['STAFF', 'AURA', 'BOOMER', 'CHAIN'];

// Evoluções: requerem (arma A, arma B) ambas em max-level.
const EVOLUTIONS = [
  { key: 'VAPOR_STORM', requires: ['STAFF', 'AURA'] },
  { key: 'OVERLOAD_X',  requires: ['STAFF', 'CHAIN'] },
];

export class UpgradeSystem {
  constructor(scene) { this.scene = scene; }

  generateCards(player) {
    const cards = [];

    // 1) Evoluções disponíveis (prioritárias se houver)
    for (const evo of EVOLUTIONS) {
      const haveAll = evo.requires.every(k => player.weapons.find(w => w.key === k && w.level >= MAX_WEAPON_LEVEL));
      if (haveAll && !player.weapons.find(w => w.key === evo.key)) {
        cards.push({
          type: 'evolution',
          weaponKey: evo.key,
          requires: evo.requires,
          title: WEAPONS[evo.key].name,
          desc: `Evolução: combina ${evo.requires.map(k => WEAPONS[k].name).join(' + ')}`,
        });
      }
    }

    // 2) Novas armas — APENAS as desbloqueadas na meta-progressão
    const unlocked = this.scene.meta?.unlocked() || ['STAFF'];
    const runWeapons = ALL_WEAPONS.filter(w => unlocked.includes(w));
    const have = new Set(player.weapons.map(w => w.key));
    for (const key of runWeapons) {
      if (!have.has(key)) {
        cards.push({
          type: 'new',
          weaponKey: key,
          title: WEAPONS[key].name,
          desc: this._weaponDesc(key),
        });
      }
    }

    // 3) Upgrades de armas existentes — rola modificador aleatório por arma
    const weaponMods = {
      STAFF:  ['dmg', 'cd', 'range', 'proj'],
      AURA:   ['dmg', 'cd', 'range'],
      BOOMER: ['dmg', 'cd', 'range'],
      CHAIN:  ['dmg', 'cd', 'range', 'proj'],
    };
    const rInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    for (const w of player.weapons) {
      if (w.level >= MAX_WEAPON_LEVEL) continue;
      if (w.key.startsWith('VAPOR') || w.key.startsWith('OVERLOAD_X')) continue;
      const pool = weaponMods[w.key] || ['dmg'];
      const mod = pool[Math.floor(Math.random() * pool.length)];
      let title, desc, apply;
      if (mod === 'dmg') {
        const v = rInt(15, 30);
        title = `${WEAPONS[w.key].name} +${v}% dano`;
        desc  = `Lv ${w.level} → ${w.level + 1}`;
        apply = () => { w.dmgMult *= 1 + v / 100; w.level += 1; };
      } else if (mod === 'cd') {
        const v = rInt(10, 22);
        title = `${WEAPONS[w.key].name} −${v}% recarga`;
        desc  = `Lv ${w.level} → ${w.level + 1}`;
        apply = () => { w.cdMult *= 1 - v / 100; w.level += 1; };
      } else if (mod === 'range') {
        const v = rInt(10, 20);
        title = `${WEAPONS[w.key].name} +${v}% alcance`;
        desc  = `Lv ${w.level} → ${w.level + 1}`;
        apply = () => { w.rangeMult *= 1 + v / 100; w.level += 1; };
      } else if (mod === 'proj') {
        title = `${WEAPONS[w.key].name} +1 projétil`;
        desc  = `Lv ${w.level} → ${w.level + 1}`;
        apply = () => { w.extraProj += 1; w.level += 1; };
      }
      cards.push({ type: 'upgrade', weaponKey: w.key, title, desc, _apply: apply });
    }

    // 4) Passivos — cada um rola valor aleatório DENTRO de uma faixa
    for (const p of PASSIVES) {
      const rolled = p.roll();
      cards.push({
        type: 'passive',
        passiveId: p.id,
        title: rolled.name,
        desc: 'Modificador permanente',
        _apply: rolled.apply,
      });
    }

    // Embaralha. Se houver evolução, ela aparece em pelo menos uma das 3 slots.
    const evolutions = cards.filter(c => c.type === 'evolution');
    const others = shuffle(cards.filter(c => c.type !== 'evolution'));
    const result = [];
    if (evolutions.length) result.push(evolutions[0]);
    while (result.length < 3 && others.length) result.push(others.shift());
    return result.slice(0, 3);
  }

  _weaponDesc(key) {
    const w = WEAPONS[key];
    const elem = { fire: '🔥', ice: '❄️', bolt: '⚡' }[w.element] || '';
    const desc = {
      STAFF:  'Projétil de fogo no inimigo mais próximo',
      AURA:   'Aura gélida de dano contínuo ao redor',
      BOOMER: 'Bumerangue flamejante que volta',
      CHAIN:  'Raio elétrico em corrente entre inimigos',
    }[key] || '';
    return `${elem} ${desc}`;
  }

  apply(card, player) {
    if (card.type === 'new') {
      // Cria a arma e adiciona ao player
      // (import dinâmico evita ciclo)
      import('../entities/Weapons.js').then(m => {
        const cls = m.WEAPON_CLASSES[card.weaponKey];
        if (cls) player.addWeapon(new cls(this.scene));
      });
    } else if (card.type === 'upgrade') {
      if (card._apply) card._apply();
      else {
        const w = player.weapons.find(w => w.key === card.weaponKey);
        if (w) { w.level += 1; w.dmgMult *= 1.25; }
      }
    } else if (card.type === 'passive') {
      if (card._apply) card._apply(player);
    } else if (card.type === 'evolution') {
      // Remove armas-ingrediente, adiciona evolução
      const evoDef = WEAPONS[card.weaponKey];
      player.weapons = player.weapons.filter(w => !card.requires.includes(w.key));
      import('../entities/Weapons.js').then(m => {
        // Por ora, a evolução é um Staff turbinado com cor diferente.
        // (Implementação cheia em D3.)
        const staffEvo = new m.Staff(this.scene);
        staffEvo.def = { ...evoDef };
        staffEvo.key = card.weaponKey;
        staffEvo.level = 1;
        player.addWeapon(staffEvo);
      });
    }
  }
}
