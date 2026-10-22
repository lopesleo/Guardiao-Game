# Desafio do dia — projeto para decidir

> **Status (22/10/2026): proposta, nada implementado.** Pedido do Leonardo: "talvez desafio diário não funcione
> tão bem; teria que ser muito bem desenhado". Este documento é a análise crítica para ele decidir. A
> recomendação está no fim (§8) e em uma linha aqui: **não fazer o diário agora; depois do lançamento, testar um
> "Desafio da semana" pequeno e só passar para o diário se os números mandarem.**

---

## 1. A pergunta de verdade: por que alguém voltaria todo dia por isso?

Um desafio diário só traz o jogador de volta se cada dia for um **problema novo que dá vontade de resolver** e se
houver **alguém com quem comparar**. Olhando o Guardião com honestidade:

**O que joga a favor**
- A partida já é curta (7 min), e o gênero vive de "só mais uma".
- As cartas de nível são o coração das decisões: **ofertas de carta iguais para todos** fazem cada dia ser uma
  pergunta diferente ("com essas cartas, qual reação eu monto?"). É o que dá cara de quebra-cabeça.
- Já existe a medição (Firebase), o relógio confiável (`Clock.js`), os rankings do Play Games e agora o convite
  ("DESAFIAR UM AMIGO" no ranking, `Invite.js`).

**O que joga contra (e pesa mais)**
- **O hábito diário já existe** e é grande: missões do dia, bônus das 3 missões, presente de dias seguidos, baú
  do dia e bônus de descanso (`DAILY` no config). Um desafio diário seria a **5ª coisa "do dia"**. A pesquisa sobre
  recompensas de engajamento (Frommel e Mandryk, CHI PLAY 2022) acha o mesmo duplo efeito em toda parte: motiva,
  mas também cria medo de perder e vira tarefa. Isso bate de frente com o princípio de justiça do projeto (nada de
  obrigação).
- **Survivor-like é menos "quebra-cabeça" que Spelunky ou Slay the Spire.** O jogo usa `Math.random` em ~400 lugares
  (inimigos, drops, críticos, efeitos). Mesma semente aqui quer dizer **mesmo ponto de partida, não mesma partida**:
  dois jogadores com as mesmas cartas ainda veem hordas diferentes. A diferença de pontos tem uma parte de sorte que
  o jogador sente.
- **Pouca gente para comparar.** No teste fechado são 12–22 pessoas; no lançamento, centenas, se tudo der certo.
  Ranking diário com 3 nomes é triste. E desde setembro de 2025 **os perfis novos do Play Games são privados por
  padrão**: o ranking público só mostra quem deixou o perfil aberto (o jogo já avisa isso na janela do ranking). O
  ranking visível tende a ser bem menor que a base.
- **Trapaça**: todo diário com ranking global teve o topo tomado por pontuação adulterada (Spelunky em 2013, Isaac,
  Slay the Spire 1 e 2). Em 2026 a Mega Crit disse que não quer anti-trapaça invasivo e que é "quase impossível"
  impedir a pontuação máxima, e passou o diário do Slay the Spire 2 a mostrar **só os amigos** por padrão.

**Resposta curta:** para a maioria dos jogadores casuais, o desafio diário **não** seria o motivo de voltar (a
Clareira, a horta e as missões já fazem esse papel). Ele pode segurar uma minoria competitiva, e só funciona se
houver gente suficiente para comparar. Não achei dado público que meça retenção causada por desafio diário com
ranking; as correlações que existem (ex.: GameRefinery, login diário no top 100) não provam causa.

---

## 2. O que os jogos que acertaram fazem

| Jogo | Regras | O que ensina |
|---|---|---|
| **Spelunky (HD, 2013)** | 1 tentativa por dia, mesma caverna para todos, morreu = espera amanhã | Nasceu de um ritual entre amigos ("uma partida só, com o outro assistindo"). O próprio Derek Yu escreveu que o modo não recriou o principal: **ter uma testemunha**. Tempos adulterados apareceram no 1º mês e eram apagados à mão |
| **Slay the Spire (Daily Climb)** | Mesma semente + 3 modificadores que não se repetem em dias seguidos; pelos relatos, só a 1ª tentativa pontua | Os **modificadores** fazem cada dia ser diferente. O topo do ranking cheio de trapaça; no StS 2 (2026) o diário passou a mostrar só os amigos e a ordenar por vitória, depois tempo |
| **Dead Cells** | Partida de **4min30**, **tentativas ilimitadas**, prêmios na 1ª, 5ª e 10ª conclusão (**não precisam ser dias seguidos**) | O criador explicou: tentativa única "aumenta muito o risco"; ilimitadas são "mais acolhedoras para a comunidade toda", mas fáceis de abusar. Prêmio por participação acumulada, sem sequência |
| **The Binding of Isaac** | 1 vez por dia; depois de jogar, libera treino sem pontuação; conquista por 31 diários (não seguidos) | Treino depois da partida que vale tira a frustração |
| **Survivor.io (Habby, celular)** | 2 tentativas por dia, **6 minutos, 3 chefes**, um bônus e um castigo que mudam todo dia; baús por chefe vencido | O modelo mais parecido com o Guardião. Sem ranking em destaque: a graça é a regra do dia e o prêmio pequeno |
| **Shattered Pixel Dungeon** | Partida com semente do dia **sem ranking**, histórico local, pede uma vitória antes; depois virou "pode repetir para treinar" | Dá para ter desafio do dia comparando **consigo mesmo** |
| **Risk of Rain 2 (Prismatic Trials)** | Ranking de amigos e global centrado na posição do jogador | Mostrar "perto de você" em vez do topo inalcançável |

Em Hades, Vampire Survivors, 20 Minutes Till Dawn e Halls of Torment **não achei** desafio diário oficial (no
Balatro as fontes divergem). Os maiores do gênero vivem sem ele.

### Por que muitos diários fracassam
1. **Obrigação e medo de perder**: o diário vira tarefa; quebrar a sequência faz a pessoa largar (Silverman e
   Barasch, 2023: a sequência quebrada reduz o engajamento, e o efeito diminui quando dá para "consertar" a
   sequência; o Duolingo ganhou +0,38% de ativos/dia só deixando equipar 2 protetores).
2. **Ranking vazio** com pouca gente, ou **inalcançável** (o topo é de quem joga 10 h/dia ou trapaceia).
3. **Trapaça** no topo global, sem servidor para validar.
4. **Regra sem graça** ("inimigos com +20% de vida" não muda nada na cabeça do jogador).
5. **Partida longa demais** para o "só uma rapidinha hoje" (por isso Dead Cells usa 4min30).
6. **Injustiça percebida**: "a semente é a mesma, mas a minha horda veio pior" — ver §1.

---

## 3. Sete dias de exemplo

Regra de ouro: **uma regra só, de 1 linha, que muda o que o jogador escolhe nas cartas** (o gênero: o jogador só se
move; a decisão está nas cartas). Tudo legível na placa da Trilha num celular deitado, com um ícone que o jogo já
tem. Cada dia fixa também bioma, Perigo, guardião e arma inicial.

| Dia | Regra (o que aparece na placa) | Por que é divertida | Custo |
|---|---|---|---|
| Seg | **Noite sem lanternas** — "Sem lanternas: cure-se nas cartas" | As cartas de vida e regeneração, que ninguém pega, viram decisão. Legível: o ícone da lanterna riscado | P (desligar o `LanternSystem`) |
| Ter | **Começo no fogo** — "As 5 primeiras cartas são de fogo" | Obriga a montar fogo cedo e depois caçar o par certo (Vapor ou Sobrecarga). Ensina reação | P (filtro no `UpgradeSystem`) |
| Qua | **Chefe mais cedo** — "O Mapinguari chega aos 5:00" | Partida de 5 min, tensão alta, cabe no ônibus. Corrida contra o relógio | M (`durationS` por partida + XP ×1,4 para chegar ao chefe com a build; precisa do laboratório) |
| Qui | **Reações em dobro** — "Vapor, Cristal e Sobrecarga ×2" | Mostra a mecânica-assinatura; quem nunca misturou elementos descobre por quê | P (multiplicador no `ElementalSystem`) |
| Sex | **Horda faminta** — "Mais criaturas, mais pontos" (spawn ×1,4) | Dia de pontuação alta, bom para print e para desafiar amigo | P (`spawnMult` do dia) |
| Sáb | **Guardião trocado** — ex.: "Saci com a Boleadeira" | Combinação que o jogador não escolheria; descobre um laço novo | P (fixar guardião e arma) |
| Dom | **Redemoinhos do sertão** — Caatinga com o dobro de redemoinhos | Terreno vivo; mover-se bem vale ponto | P (`DustDevils`) |

Regras que **não** usar: "1 de vida" (frustra no celular), "sem dash" (mexe em controle), qualquer coisa que peça
botão novo, e dias que dependam de arma ou guardião que o jogador ainda não comprou (o desafio empresta o que for
preciso só naquela partida). Cada regra nova precisa passar no robô (`tools/bot-lab.mjs`) para não sair um dia
impossível ou trivial.

---

## 4. Formato proposto (se for feito)

**O que é igual para todos no dia:** bioma, Perigo, guardião, arma inicial, a regra, o **mapa** (o
`ForestWorld` já aceita `seed`), a **sequência de ofertas de carta** (um gerador próprio semeado pelo dia dentro
do `UpgradeSystem`, hoje em `Math.random`) e o conteúdo dos baús. **O que não é igual:** posição e hora em que os
inimigos nascem, drops, críticos, efeitos — e, claro, o que o jogador escolhe e como anda. Deixar tudo
determinístico (semear os ~400 `Math.random`) é um projeto **G** à parte e quebra com qualquer mudança de
desempenho; não vale.

**O dia certo:** a semente e a virada seguem o **ranking diário do Play Games**, que vira à meia-noite de UTC-7
(documentação do Android; a referência da classe `LeaderboardVariant` diz "11:59 PM PST" — as duas se contradizem,
👤 conferir no aparelho mandando um ponto às 3h30 e às 5h30). Em Brasília isso é **por volta das 4h–5h da manhã**,
e a tela mostra "novo desafio em 3h12". A data sai do `Clock.now()` (mexer na hora do aparelho não troca o dia).

**Duração:** os 7 min de sempre na v1 (reaproveita todo o balanceamento); o "Chefe mais cedo" testa se 5 min agrada.

**Tentativas:** **até 3 tentativas valendo por dia, vale a melhor**, e treino livre depois sem pontos.
- "Só a 1ª vale" (Spelunky, Isaac) dá drama, mas pune o casual do celular: ligação, app morto pelo sistema, metrô
  sem sinal. E o Play Games guarda sempre a **melhor** pontuação do período, então a regra de "uma só" teria de ser
  imposta pelo jogo e seria fácil de burlar reinstalando.
- "Ilimitadas" (Dead Cells) acolhe, mas premia quem tem tempo e vira maratona para o competitivo.
- 3 valendo é o meio: a Survivor.io usa 2. Uma partida só gasta tentativa depois de 1 minuto (sair no começo não
  conta), e uma partida que o sistema matou (começou e não terminou) devolve a tentativa uma vez por dia.

**Pontuação:** a mesma do ranking (`RANKING`: abates × 10 + 5.000 pela vitória, × Perigo). O Perigo é fixo no
dia, então todos competem na mesma régua, e o jogador já entende a conta.

**Recompensa:** pequena e sem sequência obrigatória. Pela economia (`docs/META_LOOP.md` e `DAILY`), uma missão do
dia paga 80–240 moedas; o baú do dia, 60–160. Proposta: **+100 moedas e 1 madeira na 1ª partida do desafio
concluída no dia** (participar, não vencer), e marcos acumulados como os do Dead Cells — 5, 15 e 30 desafios
jogados (não precisam ser seguidos) dão uma peça de Guarda-roupa **que não se vende**. Nada que se compre, nada que
dê poder, nada perdido por faltar um dia.

**Com pouca gente:** nunca "você é o 3º de 4".
- Com menos de ~20 pontuações públicas no período: não mostrar posição; mostrar **o seu histórico** ("seu melhor
  desafio: 12.300 · hoje: 13.450, recorde!") e o botão **DESAFIAR UM AMIGO** (o convite já existe e leva o feito).
- Com mais gente: **faixa** em vez de posição — "você ficou entre os 20% de hoje" (o Play Games dá `rank` e
  `numScores`).
- Amigos: a coleção FRIENDS do Play Games exige o consentimento do jogador, e a troca de "amigos" por "seguidores"
  em 2025 deixou incerto o que ela devolve hoje. Não contar com ela sem testar no aparelho.

**Onde entra:** uma linha na placa da Trilha (`CampScene._showDifficulty`), com selo de "novo" quando o do dia não
foi jogado, e só depois de o jogador conhecer o jogo (ex.: depois da 1ª vitória, pela ordem de `Reveal.js`). No
fim da partida do desafio, uma linha com o resultado (faixa ou recorde pessoal), sem janela nova.

**Medição:** `daily_challenge` (`action: start | end`, `day`, `score`, `won`, `attempt`, `rule`).

---

## 5. Riscos

| Risco | Tamanho | O que fazer |
|---|---|---|
| Vira obrigação (5ª coisa "do dia") | **Alto** | Sem sequência, prêmio pequeno, nada de aviso diário; ou fazer **semanal** |
| Ranking vazio ou só com perfis abertos | **Alto** no lançamento | Faixa/recorde pessoal; esconder a posição com pouca gente |
| Trapaça no topo | Médio | A "proteção contra adulteração" do Play Games já vem ligada nos rankings novos (só Android, esconde suspeitos em até 24 h); teto `SCORE_MAX`; não mostrar o topo global com destaque |
| "Minha horda veio pior" (sorte) | Médio | Semear o que decide (cartas, mapa, baús); 3 tentativas diluem o azar |
| Dia impossível ou trivial | Médio | Cada regra passa no robô antes; regra nova só com teste |
| Virada às 4h–5h confunde | Baixo | Contagem regressiva na placa |
| Manutenção: regras ×6 idiomas, postar "o desafio de hoje" nas redes todo dia | Médio | Pool pequeno (8–10 regras); nas redes, só no semanal |
| Tirar tempo de coisas com retorno mais claro (Clareira da Caatinga, lançamento) | **Alto** agora | Esperar o lançamento |

---

## 6. Custo

- **P — "Desafio da semana" (2–3 dias):** semente da semana para mapa e ofertas de carta; bioma, Perigo, guardião e
  arma fixos; 1 regra de um pool de 4 baratas (lanternas, começo no fogo, reações ×2, horda faminta); tentativas
  ilimitadas, vale a melhor; ranking **semanal** do Play Games (o mesmo ranking novo, visão "esta semana"; vira de
  sábado para domingo em UTC-7); recorde pessoal e faixa; +300 moedas e 3 madeiras na 1ª da semana; 1 linha na
  Trilha; evento no Analytics; testes.
- **M — Diário completo (1–1,5 semana):** tudo acima no ritmo diário, 3 tentativas com devolução, contagem
  regressiva, selo de novo, 8–10 regras com passagem no robô, marcos com peça de Guarda-roupa, aviso opcional pelo
  `Notify.js`.
- **G — Diário "de verdade" (3+ semanas, com servidor):** determinismo das hordas, fantasma/replay para comparar com
  amigo, formato de 5 min com ritmo próprio e validação de pontuação no servidor (Firebase Functions) contra
  trapaça.

---

## 7. O que dá para medir antes

1. **Já no teste fechado (custo zero):** perguntar aos testadores no formulário se jogariam "um desafio com regra
   especial que muda toda semana" e quantas vezes. Opinião, não prova, mas barato.
2. **Depois do lançamento, com o P (4 semanas):**
   - % dos ativos da semana que jogam pelo menos 1 desafio;
   - % que volta ao desafio na semana seguinte;
   - tentativas por jogador e partidas do desafio que terminam (largar no meio = regra ruim);
   - D7 de quem jogou × de quem não jogou (correlação, mas ajuda);
   - convites e cartões compartilhados a partir do desafio (`invite` com `from: ranking`, `share_card`).
3. **Critério para passar ao diário:** ≥ 25% dos ativos da semana tentam, ≥ 40% voltam na semana seguinte e o
   ranking semanal tem ≥ 30 pontuações públicas. Abaixo disso, manter o semanal (ou tirar) — o diário teria ainda
   menos gente por período.

---

## 8. Recomendação

**Não fazer o desafio diário agora. Fazer menor, depois do lançamento: o "Desafio da semana" (custo P), e decidir
o diário com os números do §7.**

Por quê:
1. O hábito diário já está coberto (missões, baú, presente, descanso, horta, obras). Mais uma obrigação diária
   contraria a regra de justiça do projeto e o achado da pesquisa (motiva e cansa ao mesmo tempo).
2. O que faz o diário valer — comparar com outros — **precisa de gente**, e o jogo ainda não tem (teste fechado,
   perfis privados por padrão no Play Games). Uma semana junta 7× mais pontuações por ranking que um dia.
3. No survivor-like a semente iguala o começo, não a partida; o "quebra-cabeça" vem da regra e das cartas. Uma regra
   boa por semana é mais fácil de fazer bem do que uma por dia — e dá assunto semanal para as redes ("o desafio
   desta semana: reações em dobro") sem exigir postagem diária.
4. O dinheiro e o tempo de agora rendem mais no lançamento e na Clareira da Caatinga.

Se o semanal passar no critério, o diário vira um passo **M** em cima dele (a semente, as regras, o ranking e a
tela já existirão). Se não passar, perdeu-se pouco e o semanal pode ficar como está.

👤 Para criar o ranking quando for a hora: uma entrada `desafio` em `tools/play/rankings.json` (nomes nos 8
idiomas) e `npm run play:rankings -- criar` (cria em rascunho na conta; não foi rodado).

---

## Fontes (consultadas em 22/10/2026)

- Play Games, rankings (períodos, virada em UTC-7, proteção contra adulteração, perfis públicos): <https://developer.android.com/games/pgs/leaderboards> · referência `LeaderboardVariant` ("11:59PM PST"): <https://developers.google.com/android/reference/com/google/android/gms/games/leaderboard/LeaderboardVariant> · envio (só a melhor fica, `scoreTag`): <https://developer.android.com/games/services/web/api/rest/v1/scores/submit> · coleção FRIENDS: <https://developer.android.com/games/services/web/api/rest/v1/ScoreCollection> · amigos com consentimento: <https://developer.android.com/games/pgs/friends> · perfis privados por padrão (2025): <https://support.google.com/googleplay/answer/16562063>
- Spelunky: <https://spelunky.fandom.com/wiki/Daily_Challenge_Mode_(HD)> · <https://gutefabrik.com/redux-spelunky-glory-videogame-rituals-and-nifflas-miracle-run/> · <https://theludite.com/2014/06/23/spelunky-when-scoring-goes-bad/> · <https://steamcommunity.com/app/239350/discussions/0/864978109695115837>
- Slay the Spire: <https://kotaku.com/slay-the-spires-daily-challenges-keep-getting-better-1823780588> · <https://steamcommunity.com/app/646570/discussions/0/1743357605566110144> · StS 2, notas da v0.103.0: <https://sts2.gg/patch-notes>
- Dead Cells: <https://deadcells.wiki.gg/wiki/Daily_Challenge> · "The 24-hour ticket" (Game Developer): <https://www.gamedeveloper.com/design/the-24-hour-ticket-examining-daily-runs->
- Isaac: <https://bindingofisaacrebirth.wiki.gg/wiki/Daily_Challenge>
- Survivor.io (guia de 2022): <https://mturbogamer.com/2022/10/survivor-io-daily-challenge-daily-event-guide/>
- Shattered Pixel Dungeon (notas de versão no código): <https://github.com/00-Evan/shattered-pixel-dungeon>
- Risk of Rain 2: <https://riskofrain2.wiki.gg/wiki/Prismatic_Trials>
- Frommel e Mandryk, "Daily Quests or Daily Pests?" (CHI PLAY 2022): <https://research-portal.uu.nl/en/publications/daily-quests-or-daily-pests-the-benefits-and-pitfalls-of-engageme/> · Silverman e Barasch (2023), sequências: <https://udspace.udel.edu/handle/19716/34160> · Duolingo, protetores de sequência: <https://blog.duolingo.com/how-duolingo-streak-builds-habit>
