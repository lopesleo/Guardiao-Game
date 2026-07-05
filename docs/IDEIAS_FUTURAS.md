# 💡 Ideias futuras — armas & mecânicas

Backlog de design (não implementado). Critério: **alimentar o motor de reações** (Vapor/Cristal/Sobrecarga) e cobrir lacunas de playstyle.

Hoje: 2 de fogo (Cajado, Bumerangue) · 1 de gelo de **controle** (Aura) · 1 de raio **single-target** (Raio).
Lacunas: arma **defensiva/orbital**, arma **direcional**, gelo **ofensivo**.

---

## 1. Orbe Gélido (orbital) 🧊 — *recomendação nº1*
- **Elemento:** gelo. **Playstyle:** defensivo passivo.
- 1–3 orbes giram ao redor do player num raio fixo. Inimigo que encosta toma dano + status `ice` (acumula → congela).
- **Sinergia:** monta congelados pro **Raio estilhaçar** (Cristal); cobre "inimigos atrás de mim".
- **Upgrades:** +1 orbe (extraProj), +raio de órbita (rangeMult), +dano.
- **Implementação:** nova classe `OrbitalIce extends Weapon`. Mantém N `scene.add.circle` presos via ângulo que incrementa em `update(time)`; a cada frame checa colisão com inimigos (distância < raio do orbe) com cooldown de re-hit por inimigo (igual `BoomerangProj.canHit`). Aplica `applyStatus(e, ELEMENT.ICE)`. Sem pool de projétil — os orbes são persistentes (como a `gfx` da Aura).

## 2. Lança-chamas (cone) 🔥
- **Elemento:** fogo. **Playstyle:** direcional (usa `player.facingX`).
- A cada cooldown, aplica fogo + dano a todos num **cone** à frente do player.
- **Sinergia:** prepara **Vapor** (com Aura) e **Sobrecarga** (com Raio) em massa.
- **Implementação:** nova classe `Flamethrower extends Weapon`. No `_fire`, para cada inimigo no alcance, checa se está dentro do cone (ângulo entre vetor→inimigo e direção do facing < meia-abertura). Desenha um cone/triângulo que some (tween). Aplica fogo. Direção = `Math.atan2` do último input de movimento ou `facingX`.

## 3. Detonador elemental 💥 — *mais original*
- **Mecânica builder/spender:** dano **proporcional à quantidade de status** no inimigo; ao acertar, **consome** os status (gasta o "preparo").
- Ex.: dano base × (1 + 0.5 × nº de status). Inimigo com fogo+gelo+bolt = burst grande.
- **Sinergia:** transforma as outras armas em "builders"; recompensa empilhar efeitos antes de detonar.
- **Implementação:** arma single-target que, no hit, conta `Object.keys(enemy.statuses).length` (+ frozen), aplica dano escalado e dá `delete enemy.statuses[...]`. Cuidado: não disparar reações ao consumir (consumir é o "spend"). Pode mostrar texto "DETONA!".

---

## Ideias menores / rápidas
- **Estilhaços de Gelo (ofensiva):** retomar a ideia antiga — uma arma de gelo que dispara lascas (a `lasca-losango` já existe no shatter do Cristal) nos N mais próximos, aplicando `ice`. Distinta da Aura (que é controle).
- **Totem/Torre (bolt):** deployable estacionário que auto-atira — adiciona jogo de posicionamento.
- ~~**4ª evolução:** completar o web de evoluções~~ ✅ **FEITO** — 4 evoluções
  reais (Tempestade de Vapor, Sobrecarga Eterna, Coração do Inverno, Fênix),
  ver `docs/META_LOOP.md` Fase 4.
- **Relíquias/passivas permanentes** além das Bênçãos (ex.: "reações dão +X% dano").

---

---

## 🌐 O que a comunidade do gênero valoriza (pesquisa)

Pilares recorrentes em survivors-like / bullet heaven (Vampire Survivors, Brotato, HoloCure):

1. **Variedade de build** *(nº1 do gênero)* — combinar/evoluir armas. → completar as **evoluções reais** + armas do backlog acima.
2. **Múltiplos personagens** com mecânica única (HoloCure/Brotato). → hoje só 1; um 2º com viés elemental diferente multiplica rejogabilidade.
3. **Níveis de dificuldade / "Perigo"** (estilo *Danger* do Brotato) — escala inimigos + recompensa maior; agrada casual e hardcore.
4. **Loop "só mais uma run"** com progressão rápida (já melhorado: XP/moedas).
5. **Meta-progressão significativa** (já temos: Bênçãos + desbloqueios).

**Queixas comuns a evitar:** loop repetitivo, pouca variedade de build, picos de dificuldade injustos, pouco conteúdo.

### Priorização sugerida (esforço × impacto)
1. ~~🥇 **Seletor de dificuldade ("Perigo")**~~ ✅ FEITO (META_LOOP Fase 1)
2. ~~🥈 **Evoluções de arma reais**~~ ✅ FEITO (META_LOOP Fase 4)
3. 🥉 **2º personagem jogável** — grande rejogabilidade, esforço médio. ← PRÓXIMO

*Fontes: Rogueliker, GameSpot, TheGamer, GameRant, Brotato Builds.*

---

*Registrado a pedido — decidir/implementar depois.*
