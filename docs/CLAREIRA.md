# A Clareira do Guardião — design do acampamento (hub entre partidas)

> Ideia original (Leonardo): um "menu in-game" em forma de acampamento, com
> **pescaria**, **horta**, **cozinha** (peixe + horta = buffs pré-partida),
> **melhorias do acampamento** (buffs, liberar personagens) e **NPCs contratados**
> que fazem as tarefas mais devagar, gerando recursos enquanto o jogador está fora.
>
> Este documento revisa a ideia, aponta riscos e propõe uma versão estruturada.
> **Status: coleta de ideias — nada implementado ainda.**

---

## 1. Revisão da ideia

### O que é muito forte
- **Motivo para abrir o jogo todo dia** mesmo sem tempo para uma partida: colher,
  pescar, cozinhar. É o hábito diário que o modelo com anúncios precisa.
- **Preparação antes da partida** (escolher a refeição) cria decisão estratégica —
  como as refeições do *Monster Hunter*.
- **NPCs trabalhando offline** é a fórmula de jogos "idle": sempre há algo esperando
  quando você volta.
- Dá **alma** ao menu: hoje o menu é uma tela de botões; a Clareira vira um lugar.

### Riscos e como resolver
| Risco | Solução proposta |
|---|---|
| **Escopo gigante** (pesca + horta + cozinha + NPCs + construções é quase um segundo jogo) | Dividir em **fases** (seção 10); a 1ª já entrega valor sozinha |
| **Poder demais**: refeição + acampamento + Bênçãos somados deixam o jogo fácil | Refeição dura **1 partida** e é **só 1 por partida** (2 com Cozinha nv. 3); bônus modestos (≤ 15%); construções dão mais **conveniência/conteúdo** que força bruta |
| **Sistemas duplicados**: Bênçãos, Arsenal e Clareira competindo | **Unificar**: as Bênçãos viram o **Santuário**, o Arsenal vira a **Forja** — tudo mora na Clareira |
| **Moedas demais** confundem | Só 3 tipos: **Moedas** (partidas), **Madeira Ancestral** (materiais de construção, cai nas partidas) e **Ingredientes** (horta e pesca) |
| **Espera frustrante** (o jogador quer jogar, não esperar timer) | **Nada bloqueia a partida.** Timers só aceleram o progresso; sem energia; tudo também pode ser ganho jogando |
| **Buff com prazo em tempo real** é odiado pelos jogadores (reclamação comum sobre refeições por tempo) | Buff vale **para a próxima partida**, não por minutos — nunca se perde |
| **NPC sem história** é só uma planilha | **NPCs são espíritos da floresta resgatados nas partidas** (os "Espíritos Selados" guardados por anéis de corrompidos) — cada resgate é um evento memorável |

---

## 2. Loop principal

```
Partida (7 min) ──► traz Moedas, Madeira Ancestral, Sementes, Iscas, Espíritos resgatados
     ▲                                         │
     │                                         ▼
Refeição (buff 1 partida)          Clareira: construir, plantar, pescar, contratar
     ▲                                         │
     └──── Cozinha ◄── Ingredientes ◄── Horta / Lago / NPCs (offline)
```

**Sessão curta (1–2 min, sem partida):** colher, replantar, pescar 1–2 peixes,
recolher o que os NPCs juntaram. **Sessão longa:** isso + cozinhar + 1–3 partidas.

---

## 3. A Clareira como tela principal

- Substitui o menu atual: uma **cena do acampamento** vista de cima (mesma arte
  procedural), noite com fogueira e vaga-lumes.
- O jogador **toca nas construções** (no PC, clica ou anda até elas).
- **Trilha da floresta** (saída do acampamento) = **JOGAR**.
- Construções com algo pronto mostram um **ícone flutuante** (colheita pronta,
  NPC com carga cheia, refeição cozida) — convida a tocar.
- A Clareira **cresce visualmente** com as melhorias (barracas, tochas, bandeiras,
  cerca, jardim) — progresso que se vê.

---

## 4. Construções (níveis 1–5)

| Construção | Função | Exemplos por nível |
|---|---|---|
| 🔥 **Fogueira** (centro) | Nível do acampamento; libera outras construções | nv. 2 libera Horta, nv. 3 Lago, nv. 4 Casa dos Espíritos… |
| 🌿 **Horta** | Plantar e colher ingredientes (tempo real) | 3 → 9 canteiros; plantas mais raras; colheita dupla |
| 🎣 **Lago** | Minigame de pesca + peixes por raridade/horário | Varas melhores (barra maior), iscas, peixes lendários |
| 🍲 **Cozinha** | Receitas: ingredientes → refeição (buff na próxima partida) | Mais receitas; 2º espaço de refeição (nv. 3); "cozinhar em lote" |
| ⛩️ **Santuário** | As **Bênçãos** atuais, agora aqui | Níveis do Santuário liberam ranks mais altos das Bênçãos |
| ⚒️ **Forja** | O **Arsenal** atual (liberar armas) + **Runas do Cajado** | Encaixes de runa; Limit Break das armas |
| 🏚️ **Casa dos Espíritos** | Contratar/alocar NPCs resgatados | Mais vagas; NPCs trabalham mais rápido; armazenamento maior |
| 🗼 **Torre de Vigia** | Utilidade nas partidas + **liberar personagens** | Mostra baús no minimapa; nv. 3 chega a Caçadora; nv. 5 o Xamã |
| 🌳 **Árvore Sagrada** | Renda offline de Moedas (limite de 8h) | Mais capacidade; "assista para dobrar a colheita" |
| 📜 **Mural** | Missões diárias e semanais | Mais missões; missão semanal com prêmio raro |

**Nível do Acampamento** = soma dos níveis das construções → marcos liberam
personagens, cosméticos (decoração, skins) e novas construções. Personagens passam
a vir de **marcos da Clareira + missões**, não só de moedas.

Custos: **Moedas + Madeira Ancestral** (cai de mini-chefes, baús e do Ancião) —
assim melhorar o acampamento **exige jogar partidas**, não só esperar.

---

## 5. Horta

- **Canteiros** (3 no início, até 9). Plantar gasta **sementes** (caem em baús e
  na loja da Clareira).
- **Crescimento em tempo real**: 15 min a 4 h conforme a planta.
- Plantas (ingredientes):
  | Planta | Tempo | Uso típico |
  |---|---|---|
  | Cenoura-do-mato | 15 min | base de receitas simples |
  | Abóbora-luar | 1 h | XP |
  | Pimenta-de-brasa | 1 h | dano de fogo |
  | Flor-de-geada | 2 h | gelo |
  | Cogumelo-luz | 2 h | luz / coleta |
  | Erva-do-trovão | 3 h | raio |
  | Raiz Ancestral (rara) | 4 h | receitas lendárias |
- **Regar** (tocar) acelera 10%; **anúncio opcional** acelera 50% (1× por canteiro).
- NPC **Hortelão** colhe e replanta sozinho.

## 6. Lago e o minigame de pesca

- **Controle com um polegar** (celular): toque para lançar → espere a **fisgada**
  (o celular **vibra**) → toque rápido → **barra de tensão**: segure para subir,
  solte para descer, mantendo o peixe dentro da zona verde até encher o progresso
  (modelo *Stardew Valley*, simplificado; 5–10 s).
- **Varas melhores = zona verde maior** (a pesca fica mais fácil com o progresso).
- **Raridade**: comum, incomum, raro, lendário. Peixes lendários desbloqueiam
  cosméticos e aparecem no **Bestiário**.
- **Horário real do celular**: alguns peixes só **de noite** ou em certos dias —
  motivo extra para voltar.
- **Iscas** (caem nas partidas) aumentam a chance de raros; anúncio opcional dá
  1 isca mágica por dia.
- Peixes:
  | Peixe | Raridade | Quando |
  |---|---|---|
  | Lambari-da-mata | comum | sempre |
  | Tilápia-musgo | comum | sempre |
  | Peixe-brasa | incomum | dia |
  | Truta-geada | incomum | noite |
  | Enguia-trovão | raro | chuva/noite |
  | Carpa-luar | raro | noite, fim de semana |
  | **Guardião do Lago** | lendário | 1% à noite, com isca mágica |
- NPC **Pescador** traz peixes comuns sozinho (bem mais devagar).

## 7. Cozinha e refeições

- Fórmula simples (inspirada no *Monster Hunter Wilds*): **Base + Ingrediente +
  Tempero = Refeição**. O jogador descobre receitas combinando (livro de receitas
  vai se preenchendo — colecionável).
- **1 refeição por partida** (2 com Cozinha nv. 3). O efeito vale **só para a
  próxima partida**.
- Exemplos:
  | Refeição | Ingredientes | Efeito (1 partida) |
  |---|---|---|
  | Espetinho de Lambari | lambari + cenoura | +15 vida máxima |
  | Sopa de Abóbora-luar | abóbora ×2 | +10% XP |
  | Peixe-brasa Apimentado | peixe-brasa + pimenta | +15% dano de fogo |
  | Caldo de Geada | truta-geada + flor-de-geada | gelo congela 20% mais rápido |
  | Torta de Cogumelo-luz | cogumelo-luz ×2 | +20% raio de coleta e de luz |
  | Ensopado do Trovão | enguia + erva-do-trovão | raio salta +1 inimigo |
  | **Banquete do Guardião** | Guardião do Lago + Raiz Ancestral | começa a partida com uma arma no nível 2 |
- NPC **Cozinheira** prepara uma receita da fila enquanto você está fora.

## 8. NPCs — os Espíritos da Floresta

- **Como chegam:** nas partidas aparecem **Espíritos Selados** (círculo de
  corrompidos ao redor). Derrote o anel → o espírito se junta à Clareira.
  Alguns só aparecem em Perigos mais altos (motiva subir a dificuldade).
- **Tipos:** Pescador, Hortelão, Cozinheira, Lenhador (Madeira Ancestral devagar),
  Vigia (dá pequenos bônus na próxima partida).
- **Bem mais lentos que o jogador** — a regra que você propôs:
  | Tarefa | Jogador (ativo) | NPC (offline) |
  |---|---|---|
  | Pescar | ~1 peixe a cada 20 s | 1 peixe comum a cada 30 min |
  | Colher | instantâneo ao tocar | colhe/replanta sozinho quando pronto |
  | Cozinhar | instantâneo | 1 refeição a cada 2 h (da fila) |
- **Limite de armazenamento (8–12 h)**: quando enche, o NPC para → o jogador
  volta para esvaziar (prática padrão de jogos idle; sem limite, o jogador não volta).
- NPCs **sobem de nível** com Moedas (mais rápidos, mais capacidade) e têm nome,
  aparência e uma fala curta — dão personalidade à Clareira.

---

## 9. Anúncios opcionais (encaixes naturais, nunca obrigatórios)

- Dobrar a colheita/pescaria de um NPC.
- Acelerar 50% um canteiro (1× por canteiro).
- Isca mágica diária.
- Árvore Sagrada: dobrar a coleta.
- Cozinhar 2 refeições de uma vez (1× por dia).

A compra **"Remover anúncios"** concede tudo isso sem assistir.

---

## 10. Fases de implementação

| Fase | Conteúdo | Esforço |
|---|---|---|
| **F1 — Clareira base** | Cena do acampamento como menu; Fogueira (Jogar), Santuário (Bênçãos), Forja (Arsenal), Mural; construções com níveis e Madeira Ancestral caindo nas partidas | M–G |
| **F2 — Comida** | Horta (tempo real, 3–6 canteiros, 5 plantas) + Cozinha (8 receitas) + sistema de buff de 1 partida | M |
| **F3 — Pesca** | Lago + minigame de um polegar + 7 peixes + varas + horário real | M |
| **F4 — Espíritos** | Espíritos Selados nas partidas + Casa dos Espíritos + produção offline com limite + notificações | M–G |
| **F5 — Vida** | Torre de Vigia liberando personagens, decoração, cosméticos, eventos sazonais na Clareira | contínuo |

Sugestão: **F1 e F2 antes do lançamento** (já transformam o menu e criam o hábito
diário); F3 e F4 como primeiras atualizações — cada uma vira um motivo para o
jogador voltar ("chegou a pescaria!").

## 11. Notas técnicas

- Tempo real via `Date.now()` salvo no progresso; diferença negativa (relógio
  mexido) é ignorada. Jogo offline e sem ranking de dinheiro → trapaça de relógio
  não prejudica ninguém, não vale complicar.
- Novo formato de save com **versão + migração** (Bênçãos/Arsenal atuais viram
  níveis do Santuário/Forja sem perda).
- A Clareira reaproveita o motor de pixel-art (construções procedurais, NPCs
  como variações de paleta dos heróis) e a iluminação dinâmica (fogueira e
  tochas iluminando a cena).

## Fontes consultadas

- [Taxonomy of Fishing Mini-games — Davide Aversa](https://www.davideaversa.it/blog/game-design-taxonomy-fishing-mini-games/) · [Fishing — Stardew Valley Wiki](https://stardewvalleywiki.com/Fishing)
- [MH Wilds Food System Explained — Icy Veins](https://www.icy-veins.com/monster-hunter-wilds/news/mh-wilds-food-system-explained-best-buffs-combos/) · [Monster Hunter Wilds' new cooking system — PC Gamer](https://www.pcgamer.com/games/action/monster-hunter-wilds-new-cooking-system-is-a-win-for-balance-but-theres-a-meowscular-chef-shaped-hole-in-my-heart/) · [I really dislike timed meal buff effects — ResetEra](https://www.resetera.com/threads/i-really-dislike-timed-meal-buff-effects.366287/)
- [What Is an Idle Game? Clickers and Offline Progress](https://azfreegame.com/news/what-is-an-idle-game) · [Best Idle Games on Mobile — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/best-idle-games)
- [House Contractor — Hades Wiki](https://hades.fandom.com/wiki/House_Contractor)
- [Holo House — HoloCure Wiki](https://holocure.wiki.gg/wiki/Holo_House) · [Fishing Pond — HoloCure Wiki](https://holocure.wiki.gg/wiki/Fishing_Pond)
