# Plano de conteúdo: o que postar, quando e como

Montado em 22/10/2026 com as skills `social` (coreyhaines31/marketingskills) e `reddit-posts`
(kostja94/marketing-skills). Sem anúncio pago. A estratégia geral, a imprensa e os criadores estão em
[`MARKETING.md`](MARKETING.md); o kit do Instagram (perfil, carrossel e os 4 primeiros reels com legenda) e o
Discord, em [`REDES_SOCIAIS.md`](REDES_SOCIAIS.md). Este documento é a rotina: o que sai em cada rede, em que dia
e hora, e como escrever.

**Na hora de postar: `npm run redes`.** Abre no navegador a página local com cada post pronto: o texto com
botão de copiar, a imagem com "Copiar imagem" (cola direto no X ou no Discord) e o vídeo com "Baixar", "Copiar
caminho" (para colar na janela de envio) e "Mostrar na pasta". Lê os arquivos de `videos/promo/entrega/`, então
vídeo novo aparece sozinho. `npm run redes -- --celular` abre a mesma página no celular, na mesma rede Wi-Fi, para
salvar o vídeo e postar pelo app. Os textos da página (`tools/redes/pagina.html`) espelham a seção 9: mudou aqui,
mude lá.

**Quem faz o quê:** o Leonardo posta e responde (as contas são dele). O Claude prepara os vídeos, as imagens e os
textos da semana, e nunca publica sem o OK.

---

## 0. Em que fase o jogo está (ler antes de postar)

**Hoje: ainda não está na Google Play.** Só joga quem pede o convite: a pessoa manda o e-mail pela página oficial
(botão "Quero testar") e o Leonardo cadastra na lista de testadores. Então toda chamada diz o que a pessoa ganha e
o que fazer, sem jargão: **"Jogue antes do lançamento: peça seu convite (Android, grátis)"**. Nunca "baixe",
"disponível", "já na Play Store", nem "teste fechado aberto".

As fases mudam por acontecimento, não por data:

| Fase | Começa quando | A chamada |
|---|---|---|
| **Convite (agora)** | já | "Jogue antes do lançamento: peça seu convite pelo link" |
| **Pré-registro** | a Google libera a produção (pedido por volta de 28/10; a análise leva até ~7 dias, sem data garantida) e o pré-registro é ligado | "Pré-registre-se na Google Play" |
| **Na loja** | o dia do lançamento, **planejado** para 03/12 | "Baixe grátis na Google Play" |

**A data de lançamento só vai a público depois que a produção for liberada e o pré-registro estiver no ar.**
Até lá, "em breve na Google Play". Se a produção atrasar, o calendário inteiro anda junto (seção 5); os assuntos
da semana continuam, só a chamada espera.

---

## 1. O essencial em uma tela

- **Tempo:** ~4 h por semana. 1h30 no domingo para preparar a semana e 15–20 min por dia para postar e responder.
- **Ritmo até o lançamento (03/12):** 3 vídeos curtos por semana (o mesmo vídeo no Instagram, TikTok e YouTube
  Shorts), 1 post por dia no X, 1 post por semana no Reddit, stories quando der.
- **Regra de ouro:** responder todo comentário na primeira hora. Nas quatro redes, o alcance de um post depende
  do que acontece logo depois que ele sai.
- **Um assunto por post.** Quem passa o dedo decide em 2 segundos; o gancho é o post.
- **Toda chamada tem link com origem** (`utm_source`), para saber qual rede traz gente (seção 7).

---

## 2. Os 5 assuntos (pilares) e quanto de cada

| Pilar | Quanto | O que mostra | Por que funciona |
|---|---|---|---|
| **Jogo que se entende sem som** | 40% | Reações (Fogo + Gelo = Vapor), evoluções limpando a tela, chefe avisando o golpe e o herói desviando andando | É o gancho do jogo; prende nos 2 primeiros segundos |
| **Folclore com orgulho** | 25% | Uma lenda por post: quem é, de onde vem, o que faz no jogo | Assunto que brasileiro compartilha; datas prontas (Saci, Folclore, Amazônia, Caatinga) |
| **Bastidores: um jogo inteiro feito em código** | 20% | Arte, música e efeitos gerados por código; antes e depois; o robô que aprende a jogar | Comunidade de gamedev (X, Reddit, Bluesky) ama processo |
| **Comunidade** | 10% | Cartões de partida dos jogadores, recordes do ranking, enquetes, respostas a perguntas | Quem aparece compartilha; quem vê quer aparecer |
| **Chamada** | 5–10% | Teste, pré-registro, lançamento, atualização | Pouco e no momento certo; no Reddit, no máximo 1 em cada 6 posts |

**Cuidado com o "feito com IA":** entre jogadores, isso costuma virar briga nos comentários. O texto "arte e música
geradas por código" é verdadeiro e é o que vale usar.

---

## 3. Cada rede: para que serve e como postar

### Instagram (`@guardiaodaflorestaofc`)
- **Para:** o público brasileiro de celular. Reels levam a gente nova; carrossel é salvo e compartilhado.
- **Quanto:** 3 reels por semana (seg., qua., sex.), 1 carrossel a cada 2 semanas, stories 2–4 vezes por semana.
- **Hora (de Brasília, ponto de partida):** reels às 19h nos dias de semana; 11h no fim de semana.
- **Como:** vídeo 9:16 de 8 a 20 s; o gancho visual, o texto na tela e a primeira linha da legenda batem no mesmo
  segundo; legenda queimada no vídeo (a maioria assiste sem som); música original do jogo; capa com um quadro do
  meio. 3 a 5 hashtags específicas (`#jogobrasileiro #folclorebrasileiro #roguelite #indiegame #pixelart`). Link
  só na bio ou no adesivo de link dos stories. Fixar um comentário com a chamada.
- **Stories:** enquete ("Qual reação você descobriu primeiro?"), caixinha de perguntas, bastidor da semana e, de
  25/11 em diante, o adesivo de **contagem regressiva** para 03/12 (quem toca recebe o aviso no dia).

### TikTok e YouTube Shorts (mesmo nome: `guardiaodaflorestaofc`)
- **Para:** alcance de quem não segue ninguém do jogo. Os mesmos vídeos do Instagram.
- **Quando:** 1 hora depois do reel (19h no Instagram, 20h no TikTok e no Shorts), para responder a cada um.
- **Como:** no TikTok, o texto do vídeo é o que conta (a legenda é curta). No Shorts, o título é buscável: escreva o
  que a pessoa procuraria ("Jogo brasileiro de folclore para Android"), e não só o gancho.

### X (Twitter)
- **Para:** a conversa: devs, imprensa de games e jogadores que comentam. Bom para bastidores e para a imprensa
  achar o jogo.
- **Quanto:** 1 post por dia, mais respostas. Nunca dois posts na mesma hora (o X derruba o alcance do segundo).
- **Hora:** 12h ou 19h. Sábado de manhã, o **#ScreenshotSaturday** em inglês (a comunidade indie do mundo).
- **Como (o que o X premia):** a primeira frase diz o assunto e já entrega algo específico; vídeo acima de ~8 s
  (abaixo disso o X não conta como vídeo); **link nunca no post principal**: vai na primeira resposta; 1 ou 2
  hashtags no máximo; escreva pensando em "alguém mandaria isso para um amigo?". Ficar 30 min respondendo depois
  de postar. Fixar no perfil o post de apresentação com o vídeo das reações.

### Reddit
- **Para:** os primeiros jogadores de verdade e feedback sincero. Em inglês nas comunidades de fora; em português
  em r/jogatina e r/gamedevbrasil.
- **Quanto:** 1 post por semana no total, uma comunidade por vez, nunca o mesmo texto em várias no mesmo dia.
- **Antes de postar (obrigatório):** ler as regras e a lista de flairs da comunidade, ver os posts do topo da
  semana e participar antes. Conta com pouco karma é barrada: passe 2 semanas comentando de verdade (ajudando
  outros devs, falando de jogos) antes do primeiro post sobre o jogo.
- **Hora:** comunidades de fora às 11h–13h de Brasília (manhã nos EUA); as brasileiras às 19h–21h.
- **Como:** título específico e sem exagero; o texto conta uma história ou um processo, com honestidade; a
  pergunta do fim é uma que você quer mesmo ver respondida; responder todo comentário nas primeiras horas.
  Promoção pura é removida.
- **Onde (ver as regras de cada uma):**

| Comunidade | Língua | O que cabe |
|---|---|---|
| r/IndieDev | EN | Devlog, processo, antes e depois; aceita dev mostrando o próprio jogo |
| r/indiegames | EN | Mostrar o jogo com vídeo curto |
| r/roguelites | EN | O jogo e o que ele tem de diferente; pedir opinião |
| r/AndroidGaming | EN | Lançamento (conferir a regra para devs e a flair) |
| r/playmygame | EN | Link de teste pedindo opinião |
| r/gamedev | EN | Só no tópico semanal de **Screenshot Saturday** (promoção fora dele é removida) |
| r/pixelart | EN | Só a arte (um sprite, uma animação), sem chamada |
| r/jogatina | PT | A história de quem fez, o lançamento |
| r/gamedevbrasil | PT | Bastidores, lições, pedir feedback |

### Bluesky (opcional, grátis)
- Muita gente de gamedev e imprensa indie migrou para lá. Mesmos posts de bastidores do X em inglês, com
  `#screenshotsaturday` e `#indiedev`. Criar a conta com o mesmo nome se der tempo; não é prioridade.

### Discord (já no ar) e LinkedIn
- **Discord:** um aviso por semana no canal de avisos (o que mudou, o que vem), prints dos jogadores no destaque.
- **LinkedIn:** 1 post por semana em primeira pessoa, sobre fazer um jogo inteiro em código; alcança devs,
  recrutadores e imprensa de tecnologia. Ver `MARKETING.md` §6.5.

---

## 4. A semana-modelo (até o lançamento)

| Dia | Instagram, TikTok, Shorts | X | Reddit / outros |
|---|---|---|---|
| **Seg.** | 19h: reel do pilar **jogo** | 12h: o mesmo vídeo com outro texto | |
| **Ter.** | stories: bastidor | 12h: bastidor (fio de 3–5 posts ou 1 imagem) | Bluesky: o bastidor em inglês |
| **Qua.** | 19h: reel do pilar **folclore** | 12h: a lenda do dia | |
| **Qui.** | stories: enquete | 19h: enquete ou pergunta | 11h–13h: **o post da semana no Reddit** |
| **Sex.** | 19h: reel do pilar **chefes ou bastidores** | 12h: clipe curto | LinkedIn: o post da semana |
| **Sáb.** | | 10h–12h: **#ScreenshotSaturday** (EN) | r/gamedev: comentário no tópico Screenshot Saturday |
| **Dom.** | | | **1h30: preparar a semana** e ver os números (seção 8) |

---

## 5. O calendário até o lançamento e depois

As datas de pré-registro e lançamento são o **plano**: elas esperam a Google (seção 0). Os assuntos de cada semana
não dependem disso.

| Semana | Tema | Datas e marcos |
|---|---|---|
| **23/10–01/11** | Convites e aquecimento | **Sáb. 31/10: Dia do Saci** (reel do Saci, post no X e no Instagram, convite para jogar antes do lançamento). Começar a participar no Reddit (karma) |
| **02/11–08/11** | Bastidores, ou o pré-registro se a Google liberar | **Quando a produção for liberada:** trocar a bio e o fixado por "Pré-registre-se", reel de anúncio, aviso no Discord. Sem a liberação, a semana fica com os bastidores e o convite continua |
| **09/11–15/11** | Chefes | Reels dos chefes avisando o golpe. Imprensa (`MARKETING.md` §6.3) **só depois da produção liberada**, com a data confirmada |
| **16/11–22/11** | Lendas | Carrossel "As lendas e de onde vêm"; r/IndieDev com o bastidor do código |
| **23/11–29/11** | Clareira | Reels da Clareira; r/roguelites; contagem regressiva nos stories **só com a data confirmada** |
| **30/11–02/12** | Véspera (se a data estiver confirmada) | "Faltam 3", "faltam 2", "amanhã" nos stories; e-mail lembrando a imprensa |
| **Qui. 03/12 (planejado)** | **Lançamento** | Roteiro hora a hora na seção 6 |
| **Depois do lançamento → 31/01** | Férias escolares | Cartões de partida dos jogadores, recordes do ranking, a 1ª atualização (~2 semanas depois), o kit de Natal. Ritmo de 3 vídeos por semana continua |
| **2027** | Datas | 28/04 Dia da Caatinga, 22/08 Dia do Folclore, 05/09 Dia da Amazônia, 31/10 Dia do Saci |

---

## 6. O dia do lançamento (planejado: qui. 03/12, só com a data confirmada)

| Hora | O quê |
|---|---|
| 9h | Conferir a ficha na Google Play (link abrindo, vídeo, capturas). Trocar o botão da página para "Baixar na Google Play" |
| 11h | **X:** fio de lançamento (vídeo de 20 s + 3 posts: o que é, o que tem de diferente, a promessa "justo de verdade"), link na 1ª resposta. Fixar |
| 12h | **Instagram:** reel "Chegou" + stories com o adesivo de link; trocar a bio |
| 13h | **TikTok e Shorts:** o mesmo vídeo |
| 13h | **Reddit, 1ª comunidade** (r/AndroidGaming ou r/roguelites, conforme as regras). As outras nos dias seguintes, uma por dia |
| 18h | **Discord** (aviso para todos) e **LinkedIn** (a história em primeira pessoa) |
| 19h–22h | Responder tudo: comentários, avaliações na Play, mensagens |
| 04/12 e 05/12 | r/jogatina (04/12, 19h), r/indiegames (05/12); imprensa: mandar o link para quem não publicou |

---

## 7. Links com origem (cole sempre o da rede certa)

Base: `https://komedygames.com/guardiao/` (a página repassa a origem para a Google Play).

| Onde | Link |
|---|---|
| Bio do Instagram | `…/guardiao/?utm_source=instagram&utm_medium=bio` |
| Stories (adesivo) | `…/guardiao/?utm_source=instagram&utm_medium=story` |
| X (1ª resposta) | `…/guardiao/?utm_source=x&utm_medium=social` |
| TikTok (bio) | `…/guardiao/?utm_source=tiktok&utm_medium=bio` |
| YouTube (descrição) | `…/guardiao/?utm_source=youtube&utm_medium=shorts` |
| Reddit | `…/guardiao/?utm_source=reddit&utm_medium=social&utm_campaign=<comunidade>` |
| Bluesky | `…/guardiao/?utm_source=bluesky&utm_medium=social` |
| Discord | `…/guardiao/?utm_source=discord&utm_medium=social` |
| LinkedIn | `…/guardiao/?utm_source=linkedin&utm_medium=social` |

---

## 8. Os números de domingo (20 min)

1. Os 3 posts que mais foram compartilhados ou salvos na semana (não os de mais curtidas) e por quê.
2. Os 3 piores: o gancho demorou? o assunto não era claro?
3. Visitas à página por origem (PostHog do site) e instalações por origem (Play Console → Aquisição).
4. Seguidores novos em cada rede.
5. Escolher **uma** mudança para testar na semana (horário, tipo de gancho, duração do vídeo) e anotar aqui.

Agendamento sem custo: o **Meta Business Suite** agenda Instagram (e Facebook); o TikTok e o YouTube Studio
agendam pelo navegador; para o X e o Bluesky, o agendador do próprio X no navegador ou o plano grátis do Buffer.
Mesmo agendando, esteja por perto na primeira hora para responder.

---

## 9. Posts prontos para colar

Regras de escrita (da skill `social`): a primeira frase já entrega o assunto; nada de travessão nos posts; nada de
"não é X, é Y"; nada de emoji no começo de cada linha; nada de "Concorda?" no fim. Fato específico vale mais que
adjetivo. E a fase (seção 0): até a loja abrir, a chamada é sempre o convite.

### X

**Fixado (com o vídeo das reações, 9:16):**
```
Fogo + Gelo vira Vapor. Gelo + Raio vira Cristal. Fogo + Raio vira Sobrecarga.

Guardião da Floresta é um roguelite brasileiro: você só se move, as armas atacam sozinhas e as lendas do folclore lutam do seu lado contra a Podridão.

Em breve na Google Play. Grátis, sem energia e sem gacha.
```
1ª resposta: `Quer jogar antes do lançamento? Peça seu convite (Android, grátis): https://komedygames.com/guardiao/?utm_source=x&utm_medium=social`

**Bastidor (com o vídeo do herói sendo desenhado por código, reel 8):**
```
Toda a arte do Guardião da Floresta sai de código: heróis, criaturas, cenário, ícones e efeitos. Nenhuma imagem foi desenhada à mão nem comprada.

A música também: cada trilha é composta e sintetizada por código dentro do próprio jogo.
```

**Lenda do dia (com o clipe do chefe, reel 6):**
```
O Mapinguari, das histórias da Amazônia, tem um olho só e uma boca na barriga.

No Guardião da Floresta ele é o chefe final, tomado pela Podridão. Antes de cada golpe ele grita e o chão mostra onde vai acertar. Ao vencer, a lenda fica livre.
```

**Enquete:**
```
Qual lenda você levaria para a floresta?
```
Opções: `Curupira` · `Saci` · `Iara` · `Caipora`

**#ScreenshotSaturday (inglês, com GIF ou vídeo do chefe):**
```
Every boss attack in Guardião da Floresta is telegraphed on the ground first, so you can dodge just by walking.

A Brazilian folklore roguelite coming to Android, with all the pixel art and music generated in code.

#screenshotsaturday #indiedev
```

**Dia do Saci (sáb. 31/10, com o reel 5):**
```
Hoje é Dia do Saci. No Guardião da Floresta ele é guardião: o redemoinho dele persegue o bando e puxa todo mundo para o centro.

Viva o folclore brasileiro.
```
1ª resposta: o mesmo convite do fixado.

### Instagram (reels novos; os 4 primeiros estão em `REDES_SOCIAIS.md`)

Os vídeos estão em `videos/promo/entrega/reels/`, cada um em duas versões de cartão final: `_teste` ("Jogue antes
do lançamento · peça seu convite na bio", a de agora) e `_prereg` (só depois que a Google liberar o pré-registro).

**Reel 5: Dia do Saci** (sáb. 31/10, 11h)
```
Hoje é Dia do Saci. No Guardião da Floresta ele é guardião: o redemoinho dele persegue o bando e puxa todo mundo para o centro.

Roguelite brasileiro com as lendas do folclore. Jogue antes do lançamento: peça seu convite pelo link na bio.

#diadosaci #folclorebrasileiro #jogobrasileiro #indiegame #pixelart
```

**Reel 6: desvie andando** (o chão avisa o golpe do chefe e o herói passa ileso)
```
O chão mostra onde o golpe vai cair. Dá pra sair andando.

No Guardião da Floresta todo ataque de chefe avisa antes. Quem morre aprende o desenho do golpe na próxima.

Roguelite brasileiro com as lendas do folclore. Jogue antes do lançamento: peça seu convite pelo link na bio.

#jogobrasileiro #roguelite #indiegame #folclorebrasileiro #pixelart
```

**Reel 7: a evolução** (arma evoluindo e limpando a tela)
```
Juntando as cartas certas, a arma evolui e o bando vira cinza.
Qual arma você evoluiria primeiro?

Guardião da Floresta · Android · peça seu convite pelo link na bio.

#jogobrasileiro #roguelite #indiegame #jogosmobile #pixelart
```

**Reel 8: do código à tela** (bastidor)
```
Esse Curupira foi desenhado por código, pixel por pixel. A floresta, os monstros e a música também.

Um jogo brasileiro inteiro feito assim, sem banco de imagens nem música comprada.

#gamedev #indiedev #jogobrasileiro #pixelart #folclorebrasileiro
```

**Carrossel: "As lendas e de onde vêm"** (1080×1350, `videos/promo/entrega/social/lendas_*.png`)
- 9 imagens: capa, uma por guardiã (retrato do jogo, a origem resumida do bestiário do jogo, o que ela faz no jogo)
  e a final ("Qual delas você conhecia?" + o convite).
- Legenda: `Folclore brasileiro em 7 lendas, com a origem de cada uma. Salve para mostrar para alguém. No Guardião da Floresta todas são guardiãs. Jogue antes do lançamento: convite no link da bio.`

### Reddit

**r/IndieDev (EN, bastidor; serve em qualquer fase):**

Título: `I generated every sprite, sound and song of my Brazilian folklore roguelite in code. Here's the hero being drawn`

```
Hi! I've been making Guardião da Floresta, a survivor-like for Android where the heroes are Brazilian folklore legends (Curupira, Saci, Iara…) fighting a rot that corrupts the forest.

All the art is generated by code: each hero, enemy and tile is drawn pixel by pixel from functions, with a single shared palette. The music and sound effects are synthesized in code too, inside the game.

The video shows the Curupira being drawn by the game's own art function (drawCurupira in src/art/Hero.js): every pixel call replayed in order with the code line highlighted, then its 15 animation frames, then the hero walking in the game.

What I learned: [1–2 lições reais, ex.: uma paleta só mantém tudo coeso; animação com 2 quadros parece barata].

Happy to answer how any part works. If you've done procedural pixel art, what tripped you up?
```
Flair sugerida: `Devlog` ou equivalente. **Verifique as regras antes de postar.**

**r/roguelites (EN, antes da loja):**

Título: `I'm making a survivor-like with Brazilian folklore legends as the heroes. Looking for players before launch`

```
It plays like a survivor-like: you only move, weapons fire on their own, and every level-up is a card choice. A few things I tried to do differently:

- Elemental reactions: fire + ice makes steam, ice + lightning makes crystal, fire + lightning makes overload.
- Bosses telegraph every attack on the ground, so a good run is about reading and walking.
- Free with optional ads only (never during a run), no energy, no gacha.

It's Brazilian folklore: the legends are the heroes and a rot is the villain.

It isn't on the Play Store yet. If you have an Android phone and want to play before launch, you can ask for an invite on the game's page. I'd love feedback from people who play a lot of these: what makes a run feel fair to you?
```
Link no texto ou num comentário, conforme a regra da comunidade. **Verifique as regras e a flair.** No
lançamento, troque o título por `Guardião da Floresta, a free survivor-like with Brazilian folklore legends, is out on Android`.

**r/jogatina (PT, só no dia seguinte ao lançamento):**

Título: `Fiz um roguelite com as lendas do folclore brasileiro e ele saiu na Play Store`

```
Oi, gente! Sou o Leonardo, de Nova Friburgo, e passei os últimos meses fazendo o Guardião da Floresta.

É um roguelite em que você só anda e as armas atacam sozinhas. Curupira, Saci, Iara, Caipora e outras lendas são os heróis, e o vilão é a Podridão que toma a mata. Fogo + Gelo vira Vapor, e os chefes (Mapinguari, Mula sem Cabeça, Caboclo d'Água) avisam cada golpe antes.

É grátis de verdade: sem energia, sem gacha, e anúncio só se você quiser, nunca no meio da partida.

Se jogar, me conta o que achou, inclusive o que não gostou. Respondo todo mundo aqui.
```
**Verifique as regras e a flair.**

---

## 10. O que não fazer

- Postar o mesmo link em várias comunidades do Reddit no mesmo dia (vira spam e derruba a conta).
- Comprar seguidores ou trocar "sigo de volta": o algoritmo passa a mostrar os posts para quem não se importa.
- Sorteio com prêmio sem ler as regras de promoção de cada rede.
- Prometer data, recurso ou plataforma que ainda não existe. Antes da produção liberada: nada de "baixe" nem a data.
- Discutir em comentário. Agradecer a crítica, responder o que der e corrigir no jogo quando fizer sentido.
