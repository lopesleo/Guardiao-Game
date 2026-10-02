# Meta-Loop — Redesign de progressão entre runs

Spec do redesign da progressão. Objetivo: transformar um loop que se **esgota em
~2–3 runs** num que sustenta **8–12h** de "só mais uma run", sem arte nem mecânica
nova — só design de sistemas em cima do que já existe.

> Contexto comercial: lançamento Steam a US$1. O preço não custa dinheiro, custa
> **credibilidade** no gênero mais saturado da loja. O que vende survivor-like é
> **wishlist + reviews positivas + profundidade percebida**. Um reviewer que bate
> na parede de conteúdo na 1ª sessão escreve "sem profundidade". Este doc ataca
> exatamente isso.

---

## Diagnóstico (o problema)

Economia de moedas rastreada em `config.js`, `GameScene.js`, `MetaProgression.js`:

**Ganho por run** (estimado da curva de spawn + drops)
- Drops no chão: `SPAWN_RATE = 0.6 + t/75` em 420s ≈ ~1.000–1.400 spawns, ~25%
  dropam moeda (`DROPS.COIN_CHANCE`) valendo 1 → ~250–350 moedas num clear
- Boss: +80 · Baús: ~30–80
- **Run vitoriosa ≈ 350–500 moedas. Morte no meio ≈ 120–180.**

**Custo total pra comprar TUDO** (únicos sinks existentes)

| Sink | Custo |
|---|---|
| Armas (Boomer 30 + Chain 60 + Aura 100) | 190 |
| Habilidades (Dash 50 + Awaken 80) | 130 |
| 8 Bênçãos | 580 |
| **TOTAL** | **900** |

**→ Toda a meta-progressão se esgota em 2–3 runs vitoriosas (~30–45 min).**

Três falhas estruturais:
1. **Todo sink é booleano de uma vez** (`ownedBlessings.includes(id)`). Nada
   repetível, nada que escala.
2. **Sem escada de dificuldade.** Uma config de run = uma curva de maestria que acaba.
3. **`registerRun` ignora `won`.** O jogo não rastreia vitórias, dificuldades
   vencidas, nem qualquer meta além de um cronômetro de recorde.

---

## Fase 1 — Níveis de dificuldade ("Perigo")  ✅ IMPLEMENTADO

Maior impacto, menor esforço. Converte um jogo de 30 min numa escada de maestria
de 10+ h reaproveitando 100% do conteúdo. Implementado como **multiplicadores
globais** sobre as fórmulas paramétricas existentes (D16).

| Nível | HP inim.× | Dano inim.× | Spawn× | Recompensa× | Desbloqueio |
|---|---|---|---|---|---|
| 0 — Aprendiz   | 0,85 | 0,85 | 0,90 | 1,0  | aberto (modo fácil) |
| 1 — Guardião   | 1,0  | 1,0  | 1,0  | 1,25 | aberto (padrão = balanceamento atual) |
| 2 — Veterano   | 1,25 | 1,2  | 1,15 | 1,6  | vencer Guardião |
| 3 — Implacável | 1,6  | 1,45 | 1,3  | 2,1  | vencer Veterano |
| 4 — Pesadelo   | 2,1  | 1,8  | 1,5  | 3,0  | vencer Implacável |

O **cursor de desbloqueio** (`maxDifficultyCleared`) começa em 0 → Aprendiz e
Guardião já abertos. Cada vitória num nível ainda não vencido avança 1.

**Encanamento:**
- `DIFFICULTY` em `config.js` — array de `{ id, name, hpMult, dmgMult, spawnMult, rewardMult }`.
- `MetaProgression`: campos `selectedDifficulty`, `maxDifficultyCleared`, `wins`,
  `winsByDifficulty`. `registerRun(elapsed, won, difficulty)` passa a usar `won`:
  vitória num nível `n` faz `maxDifficultyCleared = max(atual, n)` (libera `n+1`).
- `GameScene.create`: lê `this.diff = DIFFICULTY[meta.selectedDifficulty]` (clampa
  ao desbloqueado).
- `Enemy.activate`: `maxHp *= scene.diff.hpMult`, `dmg *= scene.diff.dmgMult`.
- Boss (`_spawnBoss`): `BOSS.HP * this.diff.hpMult`; dano do boss × `dmgMult`.
- `SpawnDirector`: `rate *= scene.diff.spawnMult`.
- Recompensa: total de moedas da run × `rewardMult` no `_onGameOver` (HUD mostra a
  contagem-base ao vivo; tela final mostra o valor escalado — é a recompensa real).
- `MenuScene`: seletor de dificuldade (◄ ►) acima de JOGAR, travado ao
  `maxDifficultyCleared + 1`.
- `GameOverScene`: mostra o nível jogado; numa vitória que libera novo nível,
  destaca "NÍVEL DESBLOQUEADO".

**Princípio da curva de recompensa:** moedas devem correr sempre **um pouco atrás**
do custo. `rewardMult` cresce mais rápido que a dificuldade pra compensar runs mais
curtas/arriscadas em níveis altos e financiar os sinks da Fase 2.

---

## Fase 2 — Sinks permanentes (Bênçãos niveladas + sink infinito)  ✅ IMPLEMENTADO

Desbloqueios booleanos dão beco sem saída. Converter a meta-loja para mix de
**portões de uma vez** + **trilhas escaláveis**.

**Mantém de uma vez** (descoberta, não power-creep): desbloqueio de armas e
habilidades (Dash/Awaken).

**Bênçãos → trilhas de 5 ranks**, custo crescente `custo(R) ≈ base × 1,7^(R-1)`:

| Trilha | Efeito por rank | Custos (R1→R5) |
|---|---|---|
| Vigor da Mata   | +15 HP máx          | 40 · 70 · 120 · 200 · 320 |
| Pés Ligeiros    | +6% velocidade      | 60 · 100 · 170 · 290 · 490 |
| Cólera Antiga   | +8% dano de arma    | 90 · 150 · 255 · 435 · 740 |
| Olhar de Coruja | +25% raio de coleta | 50 · 85 · 145 · 245 · 415 |
| Eco do Despertar| +15% ganho Despertar| 80 · 135 · 230 · 390 · 665 |
| Sopro do Vento  | −10% CD do dash     | 70 · 120 · 200 · 340 · 580 |
| Sabedoria       | +10% XP             | 100 · 170 · 290 · 490 · 830 |
| Olhar do Caçador| +6% crítico         | 90 · 150 · 255 · 435 · 740 |

**8 trilhas × 5 ranks = 10.830 moedas de sink** (vs. 900 antes — número real,
medido do `config.js`).

**Sink infinito — *Tesouro Ancestral*:** +2% dano geral por compra, custo
`100 × 1,15^n`. Auto-limita pelo custo, nunca acaba — moeda nunca vira lixo
(padrão "Power-Up" do Vampire Survivors).

**Encanamento:**
- `BLESSINGS`: cada item ganha `perRank` (efeito) e `costs[]` (5 custos). `apply`
  passa a receber o rank: `apply(player, rank)`.
- `MetaProgression`: `ownedBlessings` vira `blessingRanks: { id: rank }`.
  `buyBlessing` → `rankUpBlessing(id)` (valida custo do próximo rank, incrementa).
  Aplicar no início da run: `apply(player, rank)`.
- `ancestralTreasure: n` no save; `buyAncestral()`.
- `MenuScene._showBlessingsMenu`: cada linha mostra `Rank x/5` + custo do próximo;
  linha extra do Tesouro Ancestral com nível atual e custo dinâmico.

---

## Fase 3 — Condições de vitória & conquistas  ✅ IMPLEMENTADO

A única meta antes era um cronômetro. Metas explícitas e rastreáveis =
profundidade percebida (e a Steam **espera** conquistas; alimentam o algoritmo).

**23 conquistas** em 6 grupos (spec pedia ~22):

| Grupo | Conquistas |
|---|---|
| Vitórias (6) | primeira vitória + vencer cada um dos 5 níveis de Perigo |
| Armas (5) | cada arma no Lv5 (×4) · as 4 armas numa mesma run |
| Reações (3) | disparar Vapor / Cristal / Sobrecarga 100× (cumulativo) |
| Meta (3) | trilha de Bênção rank 5 · Tesouro Ancestral nv 10 · 2.000 moedas ganhas |
| Desafios (5) | sobreviver 10:00 · vencer < 8:00 · quase-pacifista (Veterano+ sem passivo de HP) · Purista (só Cajado) · Piromante (2+ armas, todas fogo) |
| Diversos (1) | 1.000 kills cumulativos |

**Adaptações sobre o spec original** (checadas contra as regras reais do jogo):
- ~~Speedrun "matar boss < 6:00"~~ → **vencer em < 8:00**. O boss só nasce aos
  7:00 fixos — a versão original era literalmente impossível.
- ~~Mono-elemento ×3~~ → **Piromante** (só fogo) + **Purista** (só Cajado).
  O Cajado (fogo) era arma inicial forçada de toda run: mono-gelo e mono-raio
  eram impossíveis. Com a leva 2 de armas (3 por elemento, ver
  [`ARMAS_E_COMBOS.md`](ARMAS_E_COMBOS.md)) voltaram: **Coração de Geada** (só gelo)
  e **Filho do Trovão** (só raio).

**Encanamento implementado:**
- `ACHIEVEMENTS` em `config.js`: `{ id, name, desc, check(ctx), prog?(ctx) }`.
  `prog` opcional dá o "37/100" das cumulativas no menu.
- `MetaProgression`: `achievements: []` + `stats` cumulativos (`reactions`,
  `totalKills`, `totalCoinsEarned`). `checkAchievements(runCtx)` avalia as
  pendentes e retorna as recém-desbloqueadas; salva só quando desbloqueia
  (hot paths de kill/reação não tocam o localStorage).
- Marcos que disparam checagem: kill, reação elemental, retorno do level-up,
  cruzamento dos 10:00, compra de bênção/ancestral no menu, fim de run
  (depois do `registerRun`, pros checks de vitória verem os dados novos).
- Toast in-game "🏆 …" ao desbloquear; na tela final entram no painel
  "★ DESBLOQUEADO". Menu ganhou botão **CONQUISTAS x/23** com painel de
  2 colunas (✓ verde, progresso das cumulativas).
- Fiação Steam (Greenworks/Steamworks) só ao empacotar — local fica em
  `localStorage` até lá. Os ids de `ACHIEVEMENTS` já servem de API names.

---

## Fase 4 — Evoluções de arma reais  ✅ IMPLEMENTADO

Variedade de build é o valor nº1 do gênero (pesquisa em `IDEIAS_FUTURAS.md`);
as evoluções antigas eram stubs desativados (Staff reskin). Agora são 4
mecânicas novas de verdade, uma por arma-âncora:

| Evolução | Receita | Mecânica |
|---|---|---|
| Tempestade de Vapor | Cajado Lv5 + Aura | projéteis explodem em nuvem escaldante (DoT em área) no impacto |
| Sobrecarga Eterna | Raio Lv5 + Cajado | o raio encadeia: alvo prioritário + 4 saltos com falloff, bolt em todos |
| Coração do Inverno | Aura Lv5 + Raio | campo normal + nova periódica de estilhaços (dano+gelo em raio 2,2×) |
| Fênix | Bumerangue Lv5 + Cajado | rastro de zonas de fogo no trajeto (dano + status fire) |

**Regras:**
- Receita: âncora no **Lv5** + parceira presente na run → a carta ★ EVOLUÇÃO é
  **garantida** no próximo level-up (1 por level-up se várias elegíveis).
- A evolução **substitui** a âncora, **herda** dmg/cd/range/extraProj comprados
  e fica em nível MAX (some das cartas de upgrade — evolução é final).
- Conquista nova: **Metamorfose** (evolua uma arma) → total 24.
- Conquistas "arma no Lv5" contam via `baseKey` (evoluir não as invalida).

**Encanamento:** defs em `WEAPONS` (`evolvesFrom`/`partner` + params);
classes `VaporStorm/OverloadX/WinterHeart/Phoenix` em `Weapons.js` (estendem a
base parametrizando `defKey`; hooks `_decorateProj`/`onImpact`/`trailFn` nos
projéteis pooled); carta e troca em `UpgradeSystem` (`_evolutionCard`/`apply`);
HUD mostra `★ MAX` dourado. `Cards.js` já tinha a tag ★ EVOLUÇÃO.

---

## Matemática de retenção — antes vs. depois

| | Hoje | Redesenhado |
|---|---|---|
| Esgotamento de conteúdo | ~2–3 runs (~40 min) | ~40–80 runs |
| Sinks totais | 900 | 10.830 + infinito |
| Metas pra perseguir | 1 (cronômetro) | 5 clears + ~22 conquistas + speedruns |
| Motor "só mais uma run" | nenhum após 1ª sessão | sempre falta 1 rank / nível / conquista |
| Tempo até "valeu o US$1" | ~45 min | **8–12 h** |

**Regra de ouro:** a todo momento o jogador deve estar a ~1–2 runs de *uma* compra
ou *um* clear. Dificuldade estica a curva de habilidade; trilhas + sink infinito
esticam a de poder; conquistas dão metas discretas entre as duas.

---

## Ordem de implementação

1. ✅ **Fase 1** — dificuldade + rastreio de vitória (feito; ver `config.js DIFFICULTY`,
   `MetaProgression`, `SpawnDirector`, `Enemies`, `GameScene`, `MenuScene`, `GameOverScene`).
2. ✅ **Fase 2** — trilhas de bênção + Tesouro Ancestral (feito; ver `config.js
   BLESSINGS`/`ANCESTRAL`, `MetaProgression`, `GameScene`, `MenuScene`).
3. ✅ **Fase 3** — conquistas + condições de vitória variantes (feito; ver
   `config.js ACHIEVEMENTS`, `MetaProgression`, `GameScene._checkAchievements`,
   `ElementalSystem`, `UpgradeSystem`, `MenuScene._showAchievementsMenu`).
</content>
</invoke>
