# Robô jogador (`tools/bot-lab.mjs`)

Um robô que joga partidas reais (sem modo deus) **como um jogador decide**, para medir o jogo
(vitória por Perigo, causas de morte, estratégias degeneradas) e, no futuro, jogar em live.

## O modelo: prioridades em camadas

Uma camada de cima **sempre manda** na de baixo. A ordem é fixa; o treino só ajusta os números de
cada camada (tabela `GENES` no script).

| # | Camada | O que faz | Números que o treino ajusta |
|---|---|---|---|
| 1 | **Sobreviver agora** | Sai de aviso de golpe (chefe, minichefe, fogo, esporos), se afasta de quem está encostando, sai pelo maior buraco quando cercado, volta da muralha. **Projéteis:** testa 16 direções, simula `pT` ms à frente e fica com a que passa mais longe de todos os tiros (sem trombar em inimigo nem muralha), a mais perto de onde queria ir. **O dash é só daqui.** | `tW tM pW pT cR cW mW dashN dashP dashThreat sMix` |
| 2 | **Vida baixa** | Abaixo de `lowHp`: o coração mais próximo vira o objetivo; sem coração, joga na defensiva (anel maior, sem desvios para coleta). | `lowHp` |
| 3 | **Objetivo** | **Um por vez, vai até o fim salvo perigo** (camadas 1 e 2). Ordem: **baú > item no chão > lanterna de cogumelo > gemas**. Valor = prioridade ÷ (distância + `D`), menor com o bando no caminho. Baús: lembra de todos do mapa. Para em cima do baú até abrir (~0,3 s). Objetivo inalcançável em 25 s é deixado de lado por 20 s. | `G D bk lD gR gRet` |
| 4 | **Combate** | Sem objetivo: ronda o bando no alcance das armas (anel `kR`), girando sempre para o mesmo lado — as armas fazem as mortes. Elite e minichefe com mais folga. Chefe: distância de combate `bR`, circulando (a luta é obrigatória). | `kR kT eliteR bR bW bT` |

Habilidades: **dash** só na camada 1; **Despertar** com a barra cheia e chefe ou bando grande na tela.
Cartas (fora das camadas): evolução > arma nova até 3 > ímã > dano > passivas.

Na janela (`assistir`), a legenda mostra a intenção do momento: `sobreviver: projétil`,
`objetivo: baú a 430 px`, `combate: rondando o bando`…

## A nota: pontuar, não só durar

| Parte | Peso | Meta (vale o peso inteiro) |
|---|---|---|
| Tempo sobrevivido | 0,6 | a partida inteira |
| Nível | 0,6 | nível 16 (o de chegar ao chefe) |
| Abates | 0,4 | 1000 |
| Baús abertos | 0,4 | 8 (~5 no mapa + 1 a cada 50 abates) |
| Lanternas | 0,2 | 15 |
| Dano no chefe | 0,5 | o chefe inteiro |
| Vitória | 1 | — |

Antes, o tempo sobrevivido valia quase tudo e o treino aprendeu a fugir com a horda atrás: sobrevivia
sem subir de nível nem abrir baú.

## Como usar

```
node tools/bot-lab.mjs medir [saida.json]      # resumo por Perigo com a nota acima
node tools/bot-lab.mjs assistir                # janela de verdade, legenda com a intenção
node tools/bot-lab.mjs treinar [gerações]      # ajusta os números (INICIO=jogador parte dos à mão)
```

Variáveis: `DIFFS=1,3 SEEDS=11,23 PAR=3 POP=12 CHEFE=1` (treino de chefe), `CEREBRO=jogador|arquivo`,
`AJUSTE="kR=220,G=2"` (sobrescreve números no medir/assistir, para testar uma ideia).

## Lições (14/10/2026)

- **Partidas reproduzíveis são obrigatórias.** Até 14/10 a mesma semente dava partidas totalmente
  diferentes (quadros em tempo real antes de pausar o relógio gastavam sorteios): comparações com 6–12
  partidas eram sorte, e o treino também. Agora mesma semente = mesma partida.
- Comparar cérebros sempre nas **mesmas sementes** e com **≥ 24 partidas** (12 sementes × Perigo 1 e 3).
- **Projéteis eram o que mais matava** (55–70% do dano), quase sempre tiros lentos (135–180 px/s) vindos
  de 200+ px — fáceis para um jogador. Três defeitos em sequência: prever o tiro com o herói parado
  (reagia tarde), fugir "perpendicular à velocidade relativa" (tiro alcançando por trás) e SOMAR os
  desvios de vários tiros (se anulavam). A escolha de direção resolveu: Perigo 1 de 0 → 4 vitórias
  em 12, abates 417 → 845, baús 10,9 → 18,4.
- Depois dos 2 min, ~70% dos inimigos atiram (goblin para a 200 px, mago a 240 px, corvo mergulha).
  Aumentar o anel do combate (190 → 250/280 px) não ajudou e piorou a coleta.
- **Perigo 3 sem bênçãos é pesado demais** (inimigos com 1,6× vida, 1,45× dano, 1,3× quantidade):
  medir com `BOOST` (poder de veterano) antes de concluir algo sobre o jogo. O treino usa Perigo 1 e 2.
- O herói nasce a 150 px da borda sul: medir a muralha pela distância real (antes "82% do caminho"
  deixava a camada 1 ligada desde o começo e o robô travava).
- Manter distância do minichefe como do chefe piorou (9 → 5 vitórias em 24): o minichefe não é
  obrigatório. Na camada 4 ele só ganha folga a mais (`eliteR`).
