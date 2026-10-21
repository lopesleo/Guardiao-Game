# Como adicionar conteúdo — armas, evoluções, laços, guardiões e desbloqueios

O jogo tem um **framework de conteúdo**: cada coisa tem UMA ficha, o resto do jogo
(cartas, Forja, Fogueira, ícones, bestiário, desbloqueios) lê dela, e um
**verificador** acusa o que ficou faltando.

```
npm run check        # verificador de conteúdo (sem navegador)
npm run balance      # invariantes de balanceamento
```

| O quê | Ficha (dados) | Código | Arte |
|---|---|---|---|
| Arma base | `WEAPONS[KEY]` em `src/config.js` | classe que estende `Weapon` + `registerWeapon("KEY", Classe)` | ícone em `src/art/Icons.js`, sprite em `src/art/Sprites.js` |
| Evolução | `WEAPONS[KEY]` com `evolvesFrom` + `partner` | normalmente uma subclasse curta (ou nenhuma lógica nova: `also`) | ícone recolorido (`RECOLOR`) |
| Laço (combo de dupla) | `LINKS` em `src/config.js` | efeito em `LINK_EFFECTS` (`src/systems/Links.js`) | — |
| Guardião | `CHARACTERS` em `src/config.js` | — | `src/art/Hero.js` (andar) + `src/art/HeroRig.js` (queda) |
| Feito (desbloqueio por desafio) | `unlock.deed` na ficha | estatística em `DEED_STATS` | — |

## Arma nova

1. **Ficha** em `WEAPONS` (config.js). Campos:
   ```js
   LASH: {
     name: "Açoite de Urtiga",
     desc: "Texto da carta e da Forja.",
     icon: "ico_lash",                     // textura criada em Icons.js
     mods: ["dmg", "cd", "range", "proj"], // melhorias que as cartas sorteiam
     plus: "+1 Açoite",                    // rótulo do "+1" (se tiver "proj")
     unlock: { forge: 4, cost: 1000, deed: { stat: "miniBosses", n: 6, text: "Derrote {n} minichefes" } },
     element: ELEMENT.FIRE,
     baseDmg: 10, cooldown: 1000, range: 118, ...  // números da arma
   },
   ```
   **"proj" é marco**: a carta de +1 sai só ao subir para os níveis de `CARDS.PROJ_LEVELS` (3 e 5);
   nos outros níveis sorteia entre os demais `mods`. Só ponha `"range"` se o alcance mudar o dano
   de verdade (área, cone, órbita útil) — em arma que mira um alvo na tela ele não faz nada. Quem
   tem `"proj"` deve somar `this.owner?.extraProj` (a passiva Galhos Extras) ao seu `extraProj`.
   `unlock: { start: true }` = já vem liberada. Sem `deed` = só moedas + nível da Forja.
   **A Forja, a ordem da lista, os preços e os feitos saem daqui sozinhos** (`META.*` e
   `BUILD.FORGE_WEAPON_LEVEL` são derivados — não edite).
2. **Classe**: estenda `Weapon` (ou `LevaWeapon` em `WeaponsLeva3.js`, que já traz
   `_closest`, `_push`, `_scaled`, `area`). Implemente `_fire()` (devolve `true` se atirou).
   Para acertar use `this._hit(alvo, dano, elemento, x, y)`: ele cuida de crítico,
   roubo de vida, número de dano, status do elemento, `also` e morte.
   Registre: `registerWeapon("LASH", Lash)`.
3. **Arte**: ícone (mapa ASCII em `MAPS` de `Icons.js`) e, se tiver projétil, sprite em
   `Sprites.js`. Uma paleta só (`PAL`); ataque do herói nunca usa o vermelho de perigo.
   **Efeito do golpe**: prefira quadros DESENHADOS (tiras de pixel em escala 3, como
   `FireFX.js`, `IceFX.js`, `ReactionFX.js`, `AuraFX.js`) tocados por um pool do `WeaponFX`
   (`_flame(tipo, teto, …)`) — nada de círculo/fatia vetorial, nada de criar e destruir
   imagem por golpe, nada de girar sprite de pixel (rodopio se desenha em quadros).
   Graphics redesenhado todo quadro: no máximo algumas centenas de retângulos (milhares
   somem no Phaser 4). Revisar a arte: `node tools/monster-sheet.mjs saida.png fx_<nome> 6`.
4. **Som**: um efeito em `src/audio/Synth.js` (`sfx_<nome>`). Toca pelo barramento de efeitos
   (`src/audio/Mixer.js`): som que sai em rajada ganha linha em `AUDIO.VOICES` (limite de vozes) e,
   se soa sempre igual, em `AUDIO.JITTER` (variação de tom) ou `AUDIO.VARIANTS` (tomadas). Golpe ou
   aviso de chefe vai com `{ alert: true }` (nunca entra no limite: dá para desviar de ouvido); som de
   tela por cima da partida (cartas, escolhas) vai com `{ bus: "ui" }` (não é abafado na pausa).
5. **Luz** (opcional): método `lights(add)` na classe — o mapa de luz chama sozinho.
6. **Laços**: se a arma tem um momento interessante ("bateu", "fez a volta",
   "acertou"), emita um evento: `this._emit("drum:pulse", { weapon: this, ... })` e
   registre o nome em `EVENTS` (`Links.js`).
7. `npm run check` e medir no laboratório (ver `docs/ARMAS_E_COMBOS.md` → "Como medir").

## Evolução

```js
LACADA: {
  name: "Laçada de Urtiga", desc: "...", icon: "ico_lash_ice",
  evolvesFrom: "LASH", partner: "BOLAS",   // arma base nível 5 + parceira na partida
  also: ["ice"],                           // 2º elemento em cada golpe → a REAÇÃO sai sozinha
  element: ELEMENT.FIRE, baseDmg: 14, ...
}
```
A classe costuma ser só `class Lacada extends Lash { constructor(s){ super(s, "LACADA"); this.baseKey = this.def.evolvesFrom; } }`.
Se a reação sai por código próprio (sem `also`), declare `reaction: "VAPOR"`.
Regras que o verificador cobra: parceira e âncora existem e são base; duas evoluções
não podem ter a mesma receita; toda arma base deveria ter evolução e ser parceira de alguma.

## Laço (combo de dupla)

Liga sozinho quando o herói tem as duas armas (base ou evoluídas). Sem carta, sem custo.

1. Uma linha em `LINKS` (config.js): `{ id, a: "DRUM", b: "LASH", name, desc }`.
2. O efeito em `LINK_EFFECTS[id]` (`src/systems/Links.js`), escutando eventos das armas:
   ```js
   rufar: {
     "drum:pulse": (ev, scene, player) => player.weaponOf("LASH")?.strike?.(),
   },
   ```
   `player.weaponOf("BASE")` acha a arma (a evolução responde pela base).
   Eventos com dados alteráveis (ex.: `chain:damage` → `ev.dmg`) deixam o laço mudar o golpe.
3. O jogo avisa quando liga (toast), mostra na pausa e na carta de arma nova.

Eventos disponíveis: ver `EVENTS` em `Links.js` (o verificador recusa evento que
nenhuma arma emite).

## Guardião

1. **Ficha** em `CHARACTERS`:
   ```js
   {
     id: "anhanga", name: "Anhangá", title: "Veado branco da caça",
     weapon: "MIRAGE",                       // arma inicial (base)
     cost: 2400,                             // moedas (guardiões de feito)
     perk: "+18% velocidade · ...", mods: { speed: 1.18, area: 1.1, hp: 0.85 },
     unlock: { fire: 4, deed: { stat: "flawless", n: 4, text: "..." } },
     legend: { id: "anhanga", role: "...", origin: "origem da lenda (cite o povo/região)" },
   }
   ```
   `unlock: { fire: N }` = chega sozinho quando a Fogueira chega ao nível N.
   `unlock: { fire: N, deed }` = Fogueira N + feito + moedas, comprado na Fogueira.
   O bestiário (Mural → Lendas) sai do `legend`.
   `mods` aceitos: `hp, speed, crit, area, regen, cd, dmg, luck`.
2. **Arte**: função de desenho em `Hero.js` (`DRAW[id]`) que recebe uma **pose** (corpo,
   cabelo atrasado, inclinação, pernas com joelho, braço de trás, olhos) e gera 15 quadros
   (`HERO_FRAMES`: 0-3 respiração, 4 piscada, 5-12 caminhada em 8 tempos, 13 dash, 14 golpe;
   quem não anda com dois pés troca o ciclo, ex.: `HOP` do Saci, `GLIDE` de quem flutua) +
   pisadas em `HERO_STEPS` (poeira/gota/brilho), e figurino em `HeroRig.js` (`STYLE[id]`, poses de queda/acordar). Um
   quadrúpede ou forma não humana pode ter render próprio (ver `renderDeer`).
   Revisar: `node tools/monster-sheet.mjs saida.png hero_<id> 7` e
   `node tools/hero-sheet.mjs saida.png <id> 5`.
3. Cuidados de representação: ver `docs/TEMA_FOLCLORE.md`.

## Feito (desbloqueio por desafio)

`deed: { stat, n, text }` com `stat` de `DEED_STATS` (config.js):
`kills`, `win1`, `VAPOR`, `CRYSTAL`, `OVERLOAD`, `LABAREDA`, `GEADA`, `TEMPORAL`, `miniBosses`, `chests`, `flawless`.
(`carrancas` também é contada — vezes que o Caboclo d'Água se espantou — e serve à conquista.)
Estatística nova: some em `DEED_STATS`, conte com `meta.recordStat("nome")` onde ela
acontece, e o progresso aparece sozinho na Forja/Fogueira e no fim da partida.

## Bioma (mapa)

Ficha em `BIOMES` + cenário, bichos, chefe, perigo do terreno e música — passo a passo
em [`BIOMAS.md`](BIOMAS.md) → "Como adicionar um bioma". Chefe novo usa
`registerBoss(id, def)` (`src/entities/Bosses.js`), como as armas usam `registerWeapon`.

## Checklist antes do commit

- [ ] `npm run check` sem erro
- [ ] `npm run balance` ok
- [ ] arma medida no laboratório (faixa das armas antigas do mesmo papel)
- [ ] capturas renderizadas (golpe, evolução, ícone na HUD, carta, pausa)
- [ ] docs: `ARMAS_E_COMBOS.md` (tabelas) e `ROADMAP.md`
