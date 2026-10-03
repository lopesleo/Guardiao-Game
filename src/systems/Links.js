// LAÇOS — combos de dupla (ver docs/CONTEUDO.md e docs/ARMAS_E_COMBOS.md).
//
// Como funciona: as armas AVISAM o que acontece ("o tambor bateu", "a vara fez a
// volta", "a bola andou") com player.links.emit(evento, dados). Cada laço ativo
// escuta os eventos que quiser. Para criar um laço:
//   1. uma linha em LINKS (config.js): { id, a, b, name, desc } — a/b = armas BASE
//   2. uma entrada aqui em LINK_EFFECTS[id] = { "evento": (ev, scene, player) => ... }
// Sem mexer na arma, desde que ela já emita o evento (lista em EVENTS abaixo).
// Evolução conta como a arma base dela (Laçada de Urtiga vale como Açoite).
import { LINKS, ELEMENT } from "../config.js";
import { tr } from "../i18n/i18n.js";

// Eventos que as armas emitem hoje (o verificador confere que cada laço só usa estes).
// Os dados (ev) podem ser alterados pelo laço quando o nome diz (ex.: ev.dmg).
export const EVENTS = {
  "staff:fire": "Cajado atirou · { weapon, target }",
  "whirl:pull": "Redemoinho puxou alguém · { weapon, enemy, whirl }",
  "hail:targets": "Granizo escolheu onde cair · { weapon, points[] } (pode trocar os pontos)",
  "firefly:move": "Vaga-lume andou · { weapon, fly }",
  "firefly:hit": "Vaga-lume acertou · { weapon, fly, target }",
  "boomer:turn": "Vara fez a volta · { weapon, x, y }",
  "chain:damage": "Raio vai acertar · { weapon, target, dmg } (pode mudar ev.dmg)",
  "drum:pulse": "Tambor bateu · { weapon, x, y }",
  "drum:hit": "Onda do tambor acertou · { weapon, target }",
  "goldball:move": "Bola de Ouro andou · { weapon, ball }",
  "goldball:hit": "Bola de Ouro acertou · { weapon, ball, target }",
  "bolas:target": "Boleadeira escolhe o alvo · { weapon, target } (pode trocar ev.target)",
  "bolas:bind": "Boleadeira amarrou · { weapon, enemies[], ms } (pode mudar ev.ms)",
  "flame:fire": "Sopro vai soprar · { weapon, range } (pode mudar ev.range)",
  "folhas:move": "Folha andou · { weapon, leaf } (leaf.boost multiplica o dano)",
};

const near = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r * r;

export const LINK_EFFECTS = {
  // Redemoinho + Aura: puxado para dentro da aura congela na hora
  corredeira: {
    "whirl:pull": ({ enemy }, scene, player) => {
      const aura = player.weaponOf("AURA");
      const now = scene.time.now;
      if (!aura || !enemy.freeze || enemy.isFrozen(now) || now < enemy._freezeLockUntil) return;
      if (near(enemy, player, aura.range)) enemy.freeze(now, 900, 2400);
    },
  },
  // Redemoinho + Granizo: as pedras caem dentro do funil
  olho: {
    "hail:targets": (ev, scene, player) => {
      const whirls = player.weaponOf("WHIRL")?.whirls ?? [];
      whirls.forEach((w, i) => {
        if (i < ev.points.length) ev.points[i] = { x: w.x + (Math.random() - 0.5) * 20, y: w.y + (Math.random() - 0.5) * 14 };
      });
    },
  },
  // Vaga-lumes + Fogueira: vaga-lume que cruza a fogueira acende e queima
  saojoao: {
    "firefly:move": ({ fly }, scene, player) => {
      if (fly.lit) return;
      const fires = player.weaponOf("BONFIRE")?.fires ?? [];
      if (fires.some((f) => near(fly, f, f.r))) {
        fly.lit = true;
        fly.spr?.setTint(0xffb36b);
        scene.fx?.burst("ember", fly.x, fly.y, 4);
      }
    },
    "firefly:hit": ({ fly, target }, scene) => {
      // metade: o laço é um empurrão, não uma Sobrecarga garantida a cada acerto
      if (fly.lit && target.active && Math.random() < 0.5) scene.elemental.applyStatus(target, ELEMENT.FIRE);
    },
  },
  // Miragem + Boleadeira: mira quem a miragem atraiu e amarra pelo dobro
  isca: {
    "bolas:target": (ev, scene) => {
      const now = scene.time.now;
      let best = null;
      scene.enemyPool.forEachActive((e) => {
        if (!best && e.active && (e._lureUntil ?? 0) > now) best = e;
      });
      if (best) ev.target = best;
    },
    "bolas:bind": (ev, scene) => {
      const now = scene.time.now;
      if (ev.enemies.some((e) => (e._lureUntil ?? 0) > now)) ev.ms *= 2;
    },
  },
  // Tambor + Açoite: cada batida estala um açoite a mais
  rufar: {
    "drum:pulse": (ev, scene, player) => player.weaponOf("LASH")?.strike?.(),
  },
  // Bola de Ouro + Redemoinho: cruzar um funil dá +2 ricochetes (uma vez por funil)
  correnteza: {
    "goldball:move": ({ ball }, scene, player) => {
      for (const w of player.weaponOf("WHIRL")?.whirls ?? []) {
        if (ball.boosted?.has(w) || !near(ball, w, 60)) continue;
        (ball.boosted ||= new Set()).add(w);
        ball.left += 2;
        scene.fx?.burst("zap", ball.x, ball.y, 6);
      }
    },
  },
  // Cajado + Fogueira: a fogueira mais perto atira junto
  brasa: {
    "staff:fire": ({ weapon, target }, scene, player) => {
      const fires = player.weaponOf("BONFIRE")?.fires ?? [];
      let best = null,
        bd = 340 * 340;
      for (const f of fires) {
        const d = (f.x - target.x) ** 2 + (f.y - target.y) ** 2;
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      if (best) weapon.shootFrom?.(best.x, best.y - 18, target);
    },
  },
  // Raio + Tambor: +60% em quem a onda acabou de acertar
  trovoada: {
    "drum:hit": ({ target }, scene) => {
      target._drumMarkUntil = scene.time.now + 1200;
    },
    "chain:damage": (ev, scene) => {
      if ((ev.target._drumMarkUntil ?? 0) > scene.time.now) ev.dmg *= 1.6;
    },
  },
  // Vara + Miragem: onde a vara faz a volta fica uma miragem curta (pista falsa)
  rastro: {
    "boomer:turn": ({ x, y }, scene, player) => player.weaponOf("MIRAGE")?.spawnEcho?.(x, y),
  },
  // Sopro + Bola de Ouro: a bola que cruza o sopro pega fogo
  derretido: {
    "goldball:move": ({ ball }, scene, player) => {
      if (ball.molten) return;
      const flame = player.weaponOf("FLAME");
      if (!flame || !flame.inCone?.(ball.x, ball.y)) return;
      ball.molten = true;
      scene.fx?.burst("ember", ball.x, ball.y, 6);
    },
    "goldball:hit": ({ ball, target }, scene) => {
      if (ball.molten && target.active && Math.random() < 0.5) scene.elemental.applyStatus(target, ELEMENT.FIRE);
    },
  },
};

// ---- laços do VENTO ----
Object.assign(LINK_EFFECTS, {
  // Assobio + Sopro: o cone do sopro fica maior
  avivar: {
    "flame:fire": (ev) => {
      ev.range *= 1.3;
    },
  },
  // Folhas + Redemoinho: a folha que cruza o funil gira com ele e corta mais
  ciranda: {
    "folhas:move": ({ leaf }, scene, player) => {
      if (leaf.boost > 1) return;
      const whirls = player.weaponOf("WHIRL")?.whirls ?? [];
      if (whirls.some((w) => near(leaf, w, 70))) {
        leaf.boost = 1.5;
        leaf.spr?.setTint(0xd2fbe9);
      }
    },
  },
  // Cata-vento + Granizo: as pedras caem perto dos cata-ventos
  temporuim: {
    "hail:targets": (ev, scene, player) => {
      const towers = player.weaponOf("CATAVENTO")?.towers ?? [];
      towers.forEach((t, i) => {
        if (i < ev.points.length) ev.points[i] = { x: t.x + (Math.random() - 0.5) * 120, y: t.y + (Math.random() - 0.5) * 80 };
      });
    },
  },
});

// Laços ativos de um herói. recompute() quando o arsenal muda; emit() pelas armas.
export class LinkSet {
  constructor(player) {
    this.player = player;
    this.active = new Set();
    this._ready = false;
  }

  recompute() {
    const bases = new Set(this.player.weapons.map((w) => w.baseKey ?? w.key));
    const next = new Set(LINKS.filter((l) => bases.has(l.a) && bases.has(l.b)).map((l) => l.id));
    const scene = this.player.scene;
    if (this._ready)
      for (const id of next)
        if (!this.active.has(id)) {
          const l = LINKS.find((x) => x.id === id);
          scene._toast?.(tr("LAÇO: {0}\n{1}", l.name, l.desc), 3600, "#c8f08c");
          scene.sound?.play("sfx_levelup", { volume: 0.45, rate: 1.45 });
          scene._hint?.("link", tr("LAÇO! Duas armas que combinam ganham um efeito extra.\nVeja os laços ativos na pausa."));
        }
    this.active = next;
    this._ready = true;
  }

  has(id) {
    return this.active.has(id);
  }

  emit(event, ev) {
    if (!this.active.size) return ev;
    for (const id of this.active) LINK_EFFECTS[id]?.[event]?.(ev, this.player.scene, this.player);
    return ev;
  }

  list() {
    return LINKS.filter((l) => this.active.has(l.id));
  }
}

// Para a carta de arma nova: os laços que ela LIGARIA com o arsenal atual
export function linkHint(player, key) {
  const bases = new Set(player.weapons.map((w) => w.baseKey ?? w.key));
  return LINKS.filter((l) => (l.a === key && bases.has(l.b)) || (l.b === key && bases.has(l.a)))
    .map((l) => tr("\nLAÇO: {0}", l.name))
    .join("");
}
