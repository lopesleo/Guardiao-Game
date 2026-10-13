# Balanceamento

Toda decisão numérica do jogo, com justificativa. Tweak em `src/config.js`.

> **Princípio (D16):** preferir fórmulas paramétricas a números mágicos. Permite tunar dificuldade global mexendo em coeficientes.

## Decisão: dano das reações continua FIXO (13/10/2026)

**Pergunta (anotada em 09/10/2026):** o dano das reações é fixo (`REACTION` em `config.js` × Prisma),
enquanto a vida dos inimigos cresce (`ENEMY.HP(wave) = 12 + 6 × wave`: 12 → 96 aos 7:00, ×2,1 no
Pesadelo). A suspeita era que as reações "sumissem" no fim da partida e nos Perigos altos. Proposta em
estudo: multiplicar as reações por `(HP(wave)/HP(0))^k` e criar uma carta "Maestria da Mata" (+X%).

**Medição** (`node tools/rx-lab.mjs`: partidas reais aceleradas, robô que só anda, cartas por build,
2 sementes por caso; fatia = dano das reações ÷ dano total, pelo livro de dano da 1.0.1):

| Build | Guardião, horda | Pesadelo, horda | Guardião, armas ×1,7 | Pesadelo, armas ×1,7 | No chefe |
|---|---|---|---|---|---|
| Fogo+Gelo (Vapor) | 46–47% | 38–40% | 31–34% | 24–46% | 14–19% |
| Gelo+Raio (Cristal) | 50–54% | 35–47% | 30–32% | 17–55% | 5–33% |
| Fogo+Raio (Sobrecarga) | 10–43% | 24–28% | 15–29% | 24–33% | 5–14% |
| Fogo+Vento (Labareda) | 30–58% | 46–72% | 15–53% | 53–61% | 24–41% |
| Prisma (3 elementos) | 38–44% | 63–76% | 34–41% | 54–56% | 7–24% |
| Cartas aleatórias | 50–59% | 55–67% | 40–61% | 19–61% | 31% |

"Horda" = do minuto 1 até o chefe; "armas ×1,7" emula um veterano (bênçãos de dano e crítico no máximo).
Minuto a minuto, a fatia **não cai** ao longo da partida: sobe até o minuto 3 e fica estável até o chefe
(no Pesadelo fica até maior, porque o inimigo vive mais e acumula os dois status). Ela só cai **no chefe**
(alvo único: a reação em área não tem em quem se espalhar), que é o comportamento esperado.

**Decisão:**
1. **Sem curva pela onda.** A premissa não se confirmou: na horda as reações já fazem 25–60% do dano em
   qualquer minuto e Perigo, acima da meta de 20–35%. Uma curva `(HP(wave)/HP(0))^0,8` multiplicaria as
   reações por ~5× aos 7:00 e por ~5× **no chefe** (a onda dele é a 14), derrubando a luta final.
2. **Sem carta "Maestria da Mata"** por agora: o Prisma (+30%) já é a alavanca de build, e as reações
   não precisam de reforço.
3. **Não cortar ainda.** Fogo+Vento e Prisma no Pesadelo passam de 55%, mas o robô é mais fraco que um
   jogador (sobe menos de nível e não desvia por escolha). Conferir nos dados reais antes de mexer.

**O que olhar nos dados reais** (Google Analytics, versão 1.0.1 em diante): em `run_reactions`, a soma de
`rxd_*` ÷ `dmg_total` por `difficulty` e build. Se a mediana de algum par passar de **50%** em partidas
vencidas, cortar 15–20% do dano **daquela** reação no `REACTION` (nunca de todas) e medir de novo com o
laboratório. Se ficar abaixo de **20%** no Perigo alto, aí sim reabrir a curva (com `k` baixo e sem valer
no chefe).

## Curva de inimigos

`wave = floor(t / 30)` — sobe 1 wave a cada 30 segundos.

| Wave | Tempo (s) | HP inimigo | Dano inimigo | Spawn rate (in/s) |
|------|-----------|-----------|-------------|-------------------|
| 0    | 0–30      | 8         | 1           | 1.0               |
| 5    | 150       | 20.5      | 2.5         | 6.0               |
| 10   | 300       | 33        | 4           | 11.0              |
| 14   | 420 (boss)| 43        | 5.2         | 15.0              |

Fórmulas:
- `HP(wave) = 8 + 2.5 × wave`
- `DMG(wave) = 1 + 0.3 × wave`
- `SPAWN_RATE(t) = 1 + t/30`

> ⚠ **Desatualizado (conferido em 09/10/2026):** o HP hoje é `ENEMY.HP(wave) = 12 + 6 × wave` (12 → 42 → 72 →
> 96 nas ondas 0/5/10/14), multiplicado pelo `hpMult` do Perigo. Conferir dano e spawn em `src/config.js`
> antes de usar esta tabela.

## Curva do jogador

- HP inicial: **100**
- Velocidade: **160 px/s**
- XP para level N: `floor(10 + N×8 + N²×1.5)`
  - Lv 1: 19 xp · Lv 5: 87 xp · Lv 10: 240 xp · Lv 15: 467 xp

## Armas

| Arma | Elemento | Dano base | Cooldown | Range |
|---|---|---|---|---|
| Cajado | Fogo | 8 | 800ms | 280 |
| Aura Gélida | Gelo | 3 (tick) | 600ms | 120 |
| Bumerangue | Fogo | 6 | 1400ms | 240 |
| Raio Encadeado | Raio | 7 | 1200ms | 220 (3 jumps) |

Dano por nível: `base × (1 + 0.25 × (lvl - 1))` — max nível 5.

## Boss

- HP: **2000** (≈ 50× wave-14 inimigo)
- Fase 2 ativa em 50% HP
- Dano corpo a corpo: **12** · Projétil: **8**
- Velocidade: **60 px/s** (lento, mas implacável)

## Meta-progressão

- 5% de chance de moeda por inimigo morto
- Bônus de vitória do boss: **50 moedas**
- Custo de desbloqueio:
  - Bumerangue: **30 moedas** (cedo)
  - Raio Encadeado: **60 moedas**
  - Aura Gélida: **100 moedas** (mais cara, sinergia chave para evoluções)
- Cajado começa desbloqueado

---

> ⚠️ As tabelas acima estão **desatualizadas** em relação ao `src/config.js` atual.
> O `config.js` é a fonte da verdade. Revisão abaixo registra o último passe.

## Revisão de balanceamento — 2026-05-26 (Conselho multi-agente)

Revisão estruturada (designer + chefes de Gênero/Cético/Restrições + árbitro). Veredito: **APROVADO** para um passe só de `config.js`/correções pontuais; mudanças de mecânica e UI novas foram adiadas (risco de regressão a 2 dias da entrega).

**Descoberta-chave:** o scaling de dano de arma documentado (`base×(1+0.25(lvl-1))`, teto 2×) era **código morto** — o leveling real compõe `+15–30%` aleatório por nível (teto efetivo ~2,86× antes de proj/crit/bênção). Logo o problema **não** era "jogador fraco", e sim **inimigos que não ameaçavam**.

Aplicado (GREEN):
- **Dano de inimigo:** `2 + 0.9·wave` → `2 + 1.6·wave` (late-game agora pressiona).
- **Velocidades:** lobo 95→145, goblin 60→105, mago 70→110, brutamontes 55→85 (player 160 não corre de todos de graça; kiting trivial era exploit).
- **Piso de cooldown:** recarga nunca abaixo de 22% da base (antes empilhava player×arma×Despertar até ~42ms).
- **Bug de reação corrigido:** com fogo+gelo+raio juntos, a seleção pegava só os 2 primeiros status e podia engolir uma reação válida; agora varre qualquer par mapeado.
- **CRISTAL:** `selfDmg 14→0`, `dmg 12→20` (auto-dano > dano = EV negativo, lia como armadilha).
- **VAPOR:** duração 3000→2200ms (nuvens não têm cap de concorrência).
- **Código morto removido:** `WEAPON_LEVEL_DMG` e `Player.takeContactDamage` (este nunca foi ligado — o "swarm punitivo" não existia de fato).

Adiado (pós-entrega): **Banish** nas cartas, **UI de receita de evolução**, rework de dano de contato somado, cap de `+proj` (fazer só se sobrar tempo).

## Sessão de balanceamento (D3 noite — 2h dedicadas)

Checklist a executar:

- [ ] Run completa sem morrer com Cajado-only — alvo: vitória em ~70% das tentativas
- [ ] Inimigo wave-14 não one-shota player com HP+1 upgrade
- [ ] Reações disparam visivelmente pelo menos 1×/min após wave 3
- [ ] Boss derrotável em ≤ 60s com build razoável
- [ ] Boss derrota player em ≤ 30s se ele apenas ficar parado
