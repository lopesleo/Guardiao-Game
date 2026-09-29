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
- **Algo acontecendo enquanto você está fora** (plantas crescendo, presentes dos bichos): sempre há algo esperando
  quando você volta.
- Dá **alma** ao menu: hoje o menu é uma tela de botões; a Clareira vira um lugar.

### Riscos e como resolver
| Risco | Solução proposta |
|---|---|
| **Escopo gigante** (pesca + horta + cozinha + bichos + construções é quase um segundo jogo) | Dividir em **fases** (seção 10); a 1ª já entrega valor sozinha |
| **Poder demais**: refeição + acampamento + Bênçãos somados deixam o jogo fácil | Refeição dura **1 partida** e é **só 1 por partida** (2 com Cozinha nv. 3); bônus modestos (≤ 15%); construções dão mais **conveniência/conteúdo** que força bruta |
| **Sistemas duplicados**: Bênçãos, Arsenal e Clareira competindo | **Unificar**: as Bênçãos viram o **Santuário**, o Arsenal vira a **Forja** — tudo mora na Clareira |
| **Moedas demais** confundem | Só 3 tipos: **Moedas** (partidas), **Madeira Ancestral** (materiais de construção, cai nas partidas) e **Ingredientes** (horta e pesca) |
| **Espera frustrante** (o jogador quer jogar, não esperar timer) | **Nada bloqueia a partida.** Timers só aceleram o progresso; sem energia; tudo também pode ser ganho jogando |
| **Buff com prazo em tempo real** é odiado pelos jogadores (reclamação comum sobre refeições por tempo) | Buff vale **para a próxima partida**, não por minutos — nunca se perde |
| **NPC sem história** é só uma planilha | **Os ajudantes são bichos da fauna brasileira resgatados nas partidas** (presos em armadilhas da Podridão) — cada resgate é um evento memorável |

---

> Como e quando cada parte é apresentada ao jogador (sem despejar informação) e
> o ritmo de tempo que o faz voltar: [`RITMO_E_APRESENTACAO.md`](RITMO_E_APRESENTACAO.md).

## 2. Loop principal

```
Partida (7 min) ──► traz Moedas, Madeira Ancestral, Sementes, Iscas, Bichos resgatados
     ▲                                         │
     │                                         ▼
Refeição (buff 1 partida)          Clareira: construir, plantar, pescar, contratar
     ▲                                         │
     └──── Cozinha ◄── Ingredientes ◄── Horta / Lago (você) + presentes dos bichos
```

**Sessão curta (1–2 min, sem partida):** colher, replantar, pescar 1–2 peixes,
pegar os presentinhos dos bichos e reabastecer a tigela. **Sessão longa:** isso + cozinhar + 1–3 partidas.

---

## 3. A Clareira como tela principal

- Substitui o menu atual: uma **cena do acampamento** vista de cima (mesma arte
  procedural), noite com fogueira e vaga-lumes.
- O jogador **toca nas construções** (no PC, clica ou anda até elas).
- **Trilha da floresta** (saída do acampamento) = **JOGAR**.
- Construções com algo pronto mostram um **ícone flutuante** (colheita pronta,
  presente de bicho, refeição cozida) — convida a tocar.
- A Clareira **cresce visualmente** com as melhorias (barracas, tochas, bandeiras,
  cerca, jardim) — progresso que se vê.

---

## 4. Construções (níveis 1–5)

| Construção | Função | Exemplos por nível |
|---|---|---|
| 🔥 **Fogueira** (centro) | Nível do acampamento; libera outras construções | nv. 2 libera Horta, nv. 3 Lago, nv. 4 Toca dos Bichos… |
| 🌿 **Horta** | Plantar e colher ingredientes (tempo real) | 3 → 9 canteiros; plantas mais raras; colheita dupla |
| 🎣 **Lago** | Minigame de pesca + peixes por raridade/horário | Varas melhores (barra maior), iscas, peixes lendários |
| 🍲 **Cozinha** | Receitas: ingredientes → refeição (buff na próxima partida) | Mais receitas; 2º espaço de refeição (nv. 3); "cozinhar em lote" |
| ⛩️ **Santuário** | As **Bênçãos** atuais, agora aqui | Níveis do Santuário liberam ranks mais altos das Bênçãos |
| ⚒️ **Forja** | O **Arsenal** atual (liberar armas) + **Runas do Cajado** | Encaixes de runa; Limit Break das armas |
| 🦫 **Toca dos Bichos** | Abrigo e tarefas dos bichos resgatados | Mais vagas; bichos mais rápidos; armazenamento maior |
| 🗼 **Torre de Vigia** | Utilidade nas partidas + **liberar personagens** | Mostra baús no minimapa; nv. 3 chega a Caçadora; nv. 5 o Xamã |
| 🌳 **Árvore Sagrada** | Renda offline de Moedas (limite de 8h) | Mais capacidade; "assista para dobrar a colheita" |
| 📜 **Mural** | Missões diárias e semanais | Mais missões; missão semanal com prêmio raro |

**Nível do Acampamento** = soma dos níveis das construções → marcos liberam
personagens, cosméticos (decoração, skins) e novas construções. Personagens passam
a vir de **marcos da Clareira + missões**, não só de moedas.

Custos: **Moedas + Madeira Ancestral** (cai de mini-chefes, baús e do Ancião) —
assim melhorar o acampamento **exige jogar partidas**, não só esperar.

### 4.1 Obras com tempo de construção e construtores (estilo *Clash of Clans*)

Melhorar uma construção não é instantâneo: vira uma **obra** com tempo, feita por
um **construtor**. Isso cria o ritmo "começo uma obra, jogo umas partidas, volto
e está pronta" — e o gancho de notificação ("sua Cozinha nível 3 ficou pronta!").

**Construtores = pássaros João-de-barro** (o pássaro construtor brasileiro — casa
com o tema do folclore). Cada um faz **1 obra por vez**.

| Construtor | Como se consegue |
|---|---|
| 1º João-de-Barro | já vem no início |
| 2º | marco do Nível do Acampamento (ex.: nível 8) |
| 3º | resgatado de uma armadilha rara (Perigo Veterano+) |
| 4º | conquista de longo prazo (ex.: vencer no Pesadelo) |

> Diferente do *Clash of Clans* (que **vende** construtores com gemas), aqui
> construtor **nunca é vendido** — continua o princípio "não vender progresso".

**Tempos por nível** (curtos no começo para não frustrar; longos só no fim):

| Nível da obra | Tempo |
|---|---|
| 1 → 2 | instantâneo |
| 2 → 3 | 5 min |
| 3 → 4 | 1 h |
| 4 → 5 | 4 h |
| (melhorias futuras) | até 12 h, nunca mais que 1 dia |

**Acelerar sem pagar, e sem só esperar:**
- **Jogar adianta a obra:** cada partida concluída adianta **todas** as obras em
  andamento (ex.: 10 min + 1 min por minuto sobrevivido). Quem joga mais constrói
  mais rápido — o timer premia jogar, não ficar olhando o relógio.
- **Termina grátis com menos de 5 min** restantes (toque para concluir).
- **Anúncio opcional:** −30 min numa obra (até 3× por dia).
- **Poção do Construtor** (rara, cai de baús e de missões semanais): 1 h de todas
  as obras passa num instante.
- A compra "Remover anúncios" transforma os −30 min em toques sem anúncio.

**Visual:** a construção em obra ganha andaime, placa e o João-de-Barro
trabalhando (bater de martelo, pó); ao terminar, confete e um "Novo nível!".

**Regras para não virar frustração:**
- Nada da partida depende de obra pronta (sem bloquear o jogo).
- Sempre mostrar **quanto falta** e o **que a obra vai dar** antes de começar.
- Notificação local **opcional** quando uma obra termina.
- Os primeiros 30 minutos do jogador nunca esperam obra: os níveis 1→3 são rápidos.

---

> **Versão expandida (jogo à parte):** horta, pesca e cozinha foram ampliadas em
> [`VIDA_NA_CLAREIRA.md`](VIDA_NA_CLAREIRA.md) — 6 pontos de pesca, ~45 peixes,
> 30+ plantas com mutações e híbridos, 40+ receitas, pedidos dos bichos e
> o lobo-guará. As seções 5–7 abaixo são o resumo da V1.

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
- O **Tatu-bola** e o **Quati** ajudam quando você planta e colhe (seção 8).

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
- A **Capivara** e a **Arara** ajudam quando você pesca (seção 8).

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
- A **Preguiça** ao lado da panela deixa o prato mais forte (seção 8).

## 8. Os Bichos da Clareira (companheiros, não trabalhadores)

> Decisões (Leonardo): em vez de espíritos, **bichos fofos** da fauna brasileira —
> o **Guardião protege os animais**. E os bichos **não fazem as atividades pelo
> jogador**: pescar, plantar e cozinhar são a parte divertida, e continuam com ele.
> Regra: **automatizar o tedioso, nunca o divertido** (no *Stardew* o regador
> automático tira a parte chata; colher continua sendo do jogador).

- **Como chegam:** nas partidas aparecem **bichos presos em armadilhas da
  Podridão** (um círculo de corrompidos em volta). Derrote o círculo → o bicho
  vai morar na Clareira. Os mais raros só aparecem em Perigos altos.

### 8.1 Ajudam quando VOCÊ faz a atividade
| Bicho | Ajuda na Clareira (quando você faz) | Como companheiro na partida |
|---|---|---|
| **Capivara** | sentada na beira do lago: **zona verde da pesca maior** | +regeneração de vida |
| **Tatu-bola** | afofa a terra: plantas crescem **10% mais rápido** | às vezes cava um item do chão |
| **Quati** | fareja: mais chance de **semente rara** ao colher | pega moedas próximas |
| **Tucano** | canta na Feira: **preço melhor** ao vender | avisa onde estão os baús |
| **Bicho-preguiça** | ao lado da panela: **prato mais forte** | +duração do Despertar |
| **Mico-leão-dourado** *(raro)* | traz sorte: +chance de **mutação** | +sorte nos drops |
| **Arara-azul** *(raro)* | avista cardumes: mais chance de **peixe raro** | +raio de coleta |

### 8.2 Presentinhos (o "algo esperando quando você volta")
Modelo do *Neko Atsume*: o jogador põe a **comida favorita** do bicho na **tigela**.
Enquanto está fora, os bichos aparecem, comem e **deixam presentes** — sementes
raras, iscas, moedas, madeira, às vezes um acessório. Quando a tigela esvazia,
eles param de vir → o jogador volta para encher. Mesmo efeito de retenção do
"trabalho offline", **sem tirar a diversão das atividades**. Comida mais caprichada
(melhor qualidade) = presentes melhores.

### 8.3 Afeição e companheiro
- **Carinho e comida favorita** sobem os **corações** → ajuda mais forte,
  **acessórios** (chapeuzinho, lenço) e a habilidade de companheiro.
- **Companheiro na partida:** o jogador leva **1 bicho** para a floresta, que o
  segue e dá uma habilidade pequena (tabela 8.1). Liga a Clareira direto à ação —
  e é o tipo de coisa que o jogador adora mostrar.

### 8.4 Exceções automáticas (não são atividades divertidas)
- **João-de-barro** constrói as obras (seção 4.1).
- **Lobo-guará** guarda a horta do Saci (precisa ser alimentado).

- **Toca dos Bichos** (construção): mais bichos, tigela maior, presentes melhores.
- **Alternativa futura — povoadores:** quando regiões da floresta forem curadas,
  **famílias** podem voltar a morar perto da Clareira (vila que cresce), como
  decoração viva e fonte de pedidos. Fica para uma atualização, se fizer sentido.

---

## 9. Anúncios opcionais (encaixes naturais, nunca obrigatórios)

- Dobrar os presentinhos dos bichos.
- Acelerar 50% um canteiro (1× por canteiro).
- Isca mágica diária.
- Árvore Sagrada: dobrar a coleta.
- Cozinhar 2 refeições de uma vez (1× por dia).

A compra **"Remover anúncios"** concede tudo isso sem assistir.

---

## 10. Fases de implementação

| Fase | Conteúdo | Esforço |
|---|---|---|
| **F1 — Clareira base** | Cena do acampamento como menu; Fogueira (Jogar), Santuário (Bênçãos), Forja (Arsenal), Mural; construções com níveis, **obras com tempo + 1º João-de-Barro**, partidas adiantando obras, Madeira Ancestral caindo nas partidas | M–G |
| **F2 — Comida** | Horta (tempo real, 3–6 canteiros, 5 plantas) + Cozinha (8 receitas) + sistema de buff de 1 partida | M |
| **F3 — Pesca** | Lago + minigame de um polegar + 7 peixes + varas + horário real | M |
| **F4 — Bichos** | Bichos presos nas partidas + Toca dos Bichos + ajuda nas atividades + tigela e presentinhos + afeição + companheiro na partida | M–G |
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
- A Clareira reaproveita o motor de pixel-art (construções procedurais, bichos
  como variações de paleta dos heróis) e a iluminação dinâmica (fogueira e
  tochas iluminando a cena).

## Fontes consultadas

- [Taxonomy of Fishing Mini-games — Davide Aversa](https://www.davideaversa.it/blog/game-design-taxonomy-fishing-mini-games/) · [Fishing — Stardew Valley Wiki](https://stardewvalleywiki.com/Fishing)
- [MH Wilds Food System Explained — Icy Veins](https://www.icy-veins.com/monster-hunter-wilds/news/mh-wilds-food-system-explained-best-buffs-combos/) · [Monster Hunter Wilds' new cooking system — PC Gamer](https://www.pcgamer.com/games/action/monster-hunter-wilds-new-cooking-system-is-a-win-for-balance-but-theres-a-meowscular-chef-shaped-hole-in-my-heart/) · [I really dislike timed meal buff effects — ResetEra](https://www.resetera.com/threads/i-really-dislike-timed-meal-buff-effects.366287/)
- [Neko Atsume — Wikipedia](https://en.wikipedia.org/wiki/Neko_Atsume) · [Game Design Breakdown: Neko Atsume](https://alexiamandeville.medium.com/game-design-breakdown-the-simplicity-of-neko-atsume-a8616a937a47) · [What Is an Idle Game? Clickers and Offline Progress](https://azfreegame.com/news/what-is-an-idle-game) · [Best Idle Games on Mobile — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/best-idle-games)
- [House Contractor — Hades Wiki](https://hades.fandom.com/wiki/House_Contractor)
- [Builder's Hut — Clash of Clans Wiki](https://clashofclans.fandom.com/wiki/Builder's_Hut) · [Clash of Clans — Wikipedia](https://en.wikipedia.org/wiki/Clash_of_Clans)
- [Holo House — HoloCure Wiki](https://holocure.wiki.gg/wiki/Holo_House) · [Fishing Pond — HoloCure Wiki](https://holocure.wiki.gg/wiki/Fishing_Pond)
