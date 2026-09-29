# Ritmo e apresentação — como a Clareira entra na vida do jogador

> Pedido do Leonardo: essas atividades **precisam de tempo** para manter o jogador
> voltando, e devem ser apresentadas **de forma natural, sem despejar informação**
> quando ele começa. Complementa [`CLAREIRA.md`](CLAREIRA.md) e
> [`VIDA_NA_CLAREIRA.md`](VIDA_NA_CLAREIRA.md). **Status: ideia — nada implementado.**

---

## 1. Princípios

1. **Primeiro sucesso em segundos.** Ao abrir o jogo pela 1ª vez: um toque e já
   está na floresta jogando. Nada de acampamento, tutorial ou menu antes da ação.
2. **Uma novidade por vez.** No máximo **1 sistema novo por sessão** — e só depois
   que o anterior foi usado pelo menos uma vez.
3. **Mostrar quando é útil.** Cada coisa aparece no momento em que resolve um
   problema do jogador (ex.: a Cozinha aparece logo depois dele colher a 1ª planta
   — "e agora, o que faço com isto?").
4. **Descobrir pelo mundo, não por menu.** A Clareira começa **tomada pela
   Podridão**: construções em ruínas, cobertas de cipós corrompidos. Jogar
   partidas "cura" a Clareira e **revela** uma construção de cada vez. O
   desbloqueio vira história e curiosidade ("o que tem embaixo daquele cipó?").
5. **Um personagem apresenta, em uma frase.** Cada sistema é introduzido por um
   espírito com **uma fala curta + uma ação guiada** (uma mão apontando). Nunca
   um texto longo.
6. **Profundidade só para quem pedir.** Regras detalhadas moram no **Guia** e nos
   **álbuns** (e num toque longo sobre o item) — quem quer entender a fundo acha;
   quem só quer jogar não é interrompido.

---

## 2. Calendário de descobertas (os primeiros 7 dias)

Os desbloqueios dependem de **progresso do jogador** (partidas jogadas) **e** de
**tempo real** — assim ninguém recebe tudo num dia só, nem trava esperando.

| Quando | O que aparece | Como é apresentado |
|---|---|---|
| **1ª abertura** | Partida direto (só a floresta) | Dica de 1 linha: "Arraste para andar" (já existe) |
| Fim da 1ª partida | **A Clareira em ruínas** com a **Fogueira** acesa | Espírito da Fogueira: *"A Podridão tomou nosso lar. Cada partida devolve um pouco da floresta."* → botão JOGAR |
| Após a 2ª partida | **Santuário** (Bênçãos) se descobre | Moedas suficientes para a 1ª Bênção barata → mão aponta → compra → volta a jogar |
| Após a 3ª partida | **Horta**: 1 canteiro limpo + 1 semente de cenoura | Planta **cresce em 30 s** (tutorial) → colher → "plante de novo" — agora leva 5 min |
| Colheu a 1ª vez | **Cozinha** aparece | 1 receita pronta (Cenoura Assada = +vida) → "coma antes da próxima partida" → mostra o bônus na partida |
| **Dia 1**, 2ª sessão | **Lago** | 1º peixe **garantido e fácil** (minigame em câmera lenta); ao terminar: "o lago descansa — volte mais tarde" |
| **Dia 2** | **1º Espírito Selado** aparece numa partida (garantido) → **Oferendas** | O espírito resgatado chega na Clareira e pede 1 item simples |
| **Dia 2** | **João-de-Barro** e a 1ª **obra** (tempo curto) | "Posso reconstruir a horta maior — volto em 5 minutos" |
| **Dia 3** | **Saci** visita pela 1ª vez (rouba só 1 cenoura, rindo) + **Lobo-guará filhote** chega | Encenado e leve — apresenta o problema e a solução na mesma cena |
| **Dia 4** | 1ª **mutação** (acontece sozinha num dia de chuva) | Planta brilha → "Mutação! Vale 3×" → álbum de mutações se abre |
| **Dia 5** | **Feira** e 2º canteiro de receitas | Espírito comerciante passa pela Clareira |
| **Dia 7** | **Igarapé** + 1º **evento de fim de semana** | Recompensa de "uma semana na floresta" |
| Semanas 2+ | Cachoeira, estações Cheia/Vazante, NPCs trabalhando offline, construções nv. 3+ | Um por vez, como atualização de conteúdo |

> Regra de segurança: se o jogador jogar muitas partidas seguidas no 1º dia, os
> desbloqueios **por partida** continuam chegando, mas os **por dia** esperam —
> evita afogar em novidades e guarda surpresas para amanhã.

---

## 3. O tempo que faz o jogador voltar

### 3.1 A curva dos tempos
| Fase | Tempos típicos | Por quê |
|---|---|---|
| Tutorial (1ª sessão) | segundos (30 s) | o jogador **vê** o ciclo completo antes de esperar |
| Primeiros dias | 5 min – 1 h | cabe dentro de uma sessão de algumas partidas |
| Depois da 1ª semana | 1 h – 8 h | combina com a rotina: **manhã, almoço, noite** (~3 visitas/dia) |
| Coisas especiais | "durante a noite" (8–12 h) | a "planta de dormir": planta antes de deitar, colhe ao acordar |

### 3.2 O jogador escolhe o encontro (não o jogo)
Como no *Hay Day*: plantar **cenoura (15 min)** ou **mandioca (8 h)** é escolha do
jogador — ele decide quando volta. Sempre deve existir **uma opção curta e uma
longa** disponíveis.

### 3.3 Ritmo "natural", sem cronômetro na cara
Em vez de energia ou relógio visível, o próprio mundo explica a pausa:
- **O lago descansa**: depois de alguns peixes, eles "se escondem" e voltam mais
  tarde (bolhas na água mostram quando voltaram).
- **Os espíritos vão e voltam**: depois de uma oferenda, o espírito vai embora
  pela trilha e **volta no dia seguinte** com um pedido novo.
- **O Saci aparece à noite**; o **clima** muda algumas vezes por dia.
- Os timers existem (para quem quiser ver, com um toque), mas a tela mostra
  **sinais do mundo**, não números.

### 3.4 Limites que não castigam
- **Armazenamento de 8–12 h** para NPCs e colheita: dá para passar o dia fora
  sem perder, mas não uma semana inteira (senão o jogador não volta).
- **Nada morre**: descuidar só reduz a qualidade (a planta que murcha e se perde
  do Colheita Feliz frustrava).
- **Nada bloqueia a partida**: dá para jogar a ação a qualquer hora, sem energia.

### 3.5 O que renova e quando
| Frequência | O que renova |
|---|---|
| A cada partida | adianta obras; traz sementes/iscas/madeira |
| Algumas horas | colheitas, peixes do lago, produção dos NPCs, clima |
| Diário | oferendas, missões, baú diário, "peixe do dia", visita do Saci |
| Semanal | estação (Cheia/Vazante), Festival de Pesca, missão semanal |
| Por atualização | pontos de pesca, plantas, receitas, espíritos novos |

---

## 4. Na tela: pouco texto, muito sinal

- **No máximo 1 destaque** (seta/mão/brilho) na tela por vez.
- **Dicas de 1 linha**, ditas por um personagem, somem sozinhas; nunca janela de
  texto que precisa fechar.
- **Ícones flutuantes** sobre o que está pronto (colheita, peixe, obra, oferenda)
  convidam a tocar — o jogador aprende o padrão "ícone = algo para pegar" sozinho.
- **Construções bloqueadas** aparecem como **ruínas com cipós** e uma placa "?" —
  toque mostra só "Cure a floresta para revelar" (sem listar requisitos longos).
- **Notificações**: só pedir permissão **no momento em que faz sentido** — por
  exemplo, quando o jogador planta algo de 4 h: *"Quer que eu avise quando ficar
  pronto?"* (nunca na primeira abertura). Máximo 1–2 por dia.
- **Voltar ao jogo depois de um tempo**: um resumo curto e visual ("enquanto você
  esteve fora: 🐟 4 · 🥕 6 · 🌳 120 moedas"), com um toque para coletar tudo.

---

## 5. Como isso conversa com a retenção

| Meta | O que o design faz |
|---|---|
| **Dia 1** (voltar amanhã) | 1ª sessão termina com algo plantado para "amanhã" + promessa do espírito ("volto amanhã") |
| **Dia 7** | Um sistema novo a cada 1–2 dias na primeira semana — sempre há uma surpresa a caminho |
| **Dia 30** | Álbuns, mutações, estações semanais e obras longas dão metas de semanas |

## Fontes

- [Best Practices For Mobile Game Onboarding — Adrian Crook](https://adriancrook.com/best-practices-for-mobile-game-onboarding/) · [Onboarding and FTUE Design — Nasty Rodent](https://nastyrodent.com/onboarding-and-ftue-design/) · [Progressive disclosure in onboarding — UserTourKit](https://usertourkit.com/blog/progressive-disclosure-onboarding) · [What Is Progressive Disclosure — UXPin](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)
- [Hay Day Dissection — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/hay-day-monetization) · [Appointment Mechanics — Grant's Games](https://grantsgames.com/2014/08/26/appointment-mechanics/) · [Boost retention with appointment mechanics — GameRefinery/Game World Observer](https://gameworldobserver.com/2019/06/10/appointment-mechanics)
- [Carrots and sticks: wither and daily rewards — PocketGamer.biz](https://www.pocketgamer.biz/how-f2p-designers-should-balance-wither-and-daily-rewards/) · [3 Tips for Better Pacing — Mobile Free To Play](https://mobilefreetoplay.com/3-tips-for-better-pacing-in-mobile-games/)
