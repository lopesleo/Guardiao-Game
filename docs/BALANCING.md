# Balanceamento

Toda decisão numérica do jogo, com justificativa. Tweak em `src/config.js`.

> **Princípio (D16):** preferir fórmulas paramétricas a números mágicos. Permite tunar dificuldade global mexendo em coeficientes.

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

## Sessão de balanceamento (D3 noite — 2h dedicadas)

Checklist a executar:

- [ ] Run completa sem morrer com Cajado-only — alvo: vitória em ~70% das tentativas
- [ ] Inimigo wave-14 não one-shota player com HP+1 upgrade
- [ ] Reações disparam visivelmente pelo menos 1×/min após wave 3
- [ ] Boss derrotável em ≤ 60s com build razoável
- [ ] Boss derrota player em ≤ 30s se ele apenas ficar parado
