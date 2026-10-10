# Armas e combos — variedade de builds

Plano para dar mais variedade às partidas sem fugir do gênero: **o jogador só se
move; toda decisão acontece nas cartas de nível**. Ficha de cada arma (números,
texto, ícone, desbloqueio) em `WEAPONS` (`src/config.js`); código em
`src/entities/Weapons.js` e `src/entities/WeaponsLeva3.js`. **Como adicionar**:
`docs/CONTEUDO.md`.

## Por que

Levantamento de 02/10/2026: o jogo tinha **6 armas e 6 evoluções**, com 4 vagas de
arma por partida. Em 3 a 5 partidas o jogador já tinha visto todas, e as builds
se repetiam. Os elementos também estavam desequilibrados:

> Nomes atuais (out/2026, revisão de lore): o **Bumerangue** virou a **Vara Encantada**
> (da Caipora) e a evolução **Fênix** virou **Boitatá**. Mecânica igual; ids internos
> `BOOMER`/`PHOENIX` mantidos (save). Ver `TEMA_FOLCLORE.md`.

| Elemento | Antes | Depois da leva 2 |
|---|---|---|
| Fogo | Cajado, Bumerangue, Sopro | Cajado, Bumerangue, Sopro |
| Gelo | Aura, Orbe | Aura, Orbe, **Granizo** |
| Raio | Raio Concentrado | Raio Concentrado, **Vaga-lumes**, **Redemoinho** |

Com uma arma só, Raio **nunca** ganhava a Ressonância (+15% por arma extra do
mesmo elemento), e o Saci, o guardião de raio, saía perdendo. As conquistas de
mono-gelo e mono-raio também eram impossíveis.

## Regras de design (para toda arma nova)

1. **Um verbo próprio.** Cada arma resolve o combate de um jeito que nenhuma outra
   resolve (mirar, orbitar, cone, campo, teleguiar, chover, puxar...).
2. **Alimenta as reações.** Toda arma aplica o status do seu elemento; a evolução,
   de preferência, **gera uma reação sozinha** (o combo vira a recompensa).
3. **Parceiras espalhadas.** Toda arma base deve ser parceira de alguma evolução,
   assim nenhuma carta é "morta".
4. **Barata no celular.** Simulação própria (sem corpo de física), teto de objetos
   vivos e pouco número de dano em armas que ticam rápido.
5. **Arte própria, uma paleta.** Sprites em `src/art/Sprites.js`, ícones em
   `src/art/Icons.js`; ataque do jogador nunca usa o vermelho de "perigo".

## Leva 2 (feita)

| Arma | Elemento | Verbo | Forja | Custo |
|---|---|---|---|---|
| **Vaga-lumes** | Raio | 3 vaga-lumes teleguiados, cada um caça um inimigo diferente | nv 2 | 90 |
| **Granizo** | Gelo | pedras caem em inimigos ao acaso; quem já estava resfriado **congela** | nv 3 | 150 |
| **Redemoinho** | Raio | funil do Saci que persegue o bando e **puxa** todos para o centro | nv 4 | 220 |

| Evolução | Receita | O que muda | Combo |
|---|---|---|---|
| **Revoada** | Vaga-lumes 5 + Orbe | 5 vaga-lumes; cada um que acerta se divide em 2 | espalha raio em bando |
| **Tempestade de Granizo** | Granizo 5 + Raio | 4 pedras que congelam na hora; um raio do céu estilhaça | **Cristal** sozinho |
| **Redemoinho de Brasa** | Redemoinho 5 + Sopro | funil maior que alterna fogo e raio a cada tique | **Sobrecarga** sozinho |

Ganhos de design:

- **3 armas por elemento.** A Ressonância vale para todos, e builds de um elemento
  só viraram possíveis (conquistas **Coração de Geada** e **Filho do Trovão**).
- **Orbe e Sopro viraram parceiras** (antes nenhuma evolução pedia essas duas).
- **Combos dentro da arma:** Tempestade de Granizo faz Cristal e Redemoinho de
  Brasa faz Sobrecarga sem depender de outra arma. As que já existiam (Vapor do
  Cajado+Aura) seguem pedindo duas armas.
- **Controle de multidão novo:** o Redemoinho é a primeira arma que move os
  inimigos (chefe e minichefes não são puxados).

Teste (Edge headless, 02/10/2026): sem erros, 57–60 FPS com 3 armas novas e
bando cheio; numa janela de 6 s, as 3 evoluções dispararam Sobrecarga 7×,
Cristal 4× e Vapor 1×. As cartas só oferecem arma nova depois de forjada; a carta
de evolução aparece com âncora no nível 5 + parceira, e a evolução herda dano,
recarga, alcance e +1 da âncora.

## Leva 3 (feita, out/2026): 5 de fogo e gelo, 4 de raio e vento, 3 guardiões, laços

> **Conferido em 05/10/2026:** armas base = 5 fogo, 5 gelo, **4 raio, 4 vento** (o Redemoinho
> passou do raio para o vento). Nas cartas isso não pesa: todo guardião começa com uma arma e a
> Aura (gelo) vem liberada, então entre as que faltam cada elemento tem 4 candidatas — medido no
> sorteador real (`generateCards`, 20 mil mesas, Cajado + Aura): **25% para cada elemento**. O
> que falta é escolha numa build pura de raio ou de vento (as 4 armas = as 4 vagas da Forja).
> Uma 5ª arma de raio e uma de vento é boa candidata a primeira atualização de conteúdo.

Seis armas, cada uma com um **verbo que o jogo não tinha**. Três são as armas das
lendas novas (ver `TEMA_FOLCLORE.md`); três são do Brasil "sem dono".

| Arma | Elemento | Verbo | Dona | Forja | Custo · feito |
|---|---|---|---|---|---|
| **Açoite de Urtiga** | Fogo | golpe corpo a corpo em arco, empurra | Comadre Fulozinha | nv 4 | 1000 · 6 minichefes |
| **Fogueira de São João** | Fogo | armadilha: planta fogueiras no caminho | — | nv 2 | 500 |
| **Miragem** | Gelo | isca: ilusão que atrai o bando; estoura em geada | Anhangá | nv 4 | 1200 · 2 lutas "desviou de tudo" |
| **Boleadeira** | Gelo | amarra até 3 inimigos juntos (puxa e prende) | — | nv 3 | 700 · 80 Cristais |
| **Bola de Ouro** | Raio | ricocheteia de inimigo em inimigo | Mãe-do-Ouro | nv 4 | 1100 · 40 baús |
| **Tambor do Trovão** | Raio | onda em anel a partir do herói, empurra | — | nv 3 | 850 · 100 Sobrecargas |

Evoluções em **ciclo** (cada arma nova é âncora uma vez e parceira uma vez) e todas
fazem a reação **sozinhas** (`also` na ficha = segundo elemento em cada golpe):

| Evolução | Receita | Reação |
|---|---|---|
| **Laçada de Urtiga** | Açoite 5 + Boleadeira | Vapor (a ponta enlaça com geada e prende) |
| **Minuano** | Boleadeira 5 + Tambor | Cristal (duas boleadeiras; um trovão cai nos amarrados) |
| **Trovão de Brasa** | Tambor 5 + Açoite | Sobrecarga (batida dupla de fogo e raio) |
| **Arraial** | Fogueira 5 + Bola de Ouro | Sobrecarga (fogueiras soltam fogos dourados) |
| **Ouro Encantado** | Bola de Ouro 5 + Miragem | Cristal (ouro gelado, mais ricochetes) |
| **Visagem** | Miragem 5 + Fogueira | Vapor (duas aparições que estouram em fogo e geada) |

### Laços (combos de dupla) — feitos

Basta ter as duas armas (base ou evoluída): o laço liga sozinho, avisa com um toast,
aparece na pausa e na carta de arma nova ("LAÇO: ..."). Implementação por **eventos**
(`src/systems/Links.js`): a arma avisa o que acontece e o laço escuta — criar um laço
não mexe na arma (ver `docs/CONTEUDO.md`).

| Laço | Armas | Efeito |
|---|---|---|
| Corredeira | Redemoinho + Aura | quem o funil puxa para dentro da aura congela na hora |
| Olho do Furacão | Redemoinho + Granizo | o granizo cai dentro do funil |
| Noite de São João | Vaga-lumes + Fogueira | vaga-lume que cruza a fogueira acende: metade dos golpes queima |
| Isca e Laço | Miragem + Boleadeira | a boleadeira mira quem a miragem atraiu e amarra pelo dobro |
| Rufar da Mata | Tambor + Açoite | cada batida estala um açoite a mais |
| Ouro na Correnteza | Bola de Ouro + Redemoinho | cruzar o funil dá +2 ricochetes |
| Brasa de São João | Cajado + Fogueira | a fogueira mais perto também atira a bola de fogo |
| Trovoada | Raio + Tambor | +60% de dano do Raio em quem a onda acabou de acertar |
| Rastro Falso | Vara Encantada + Miragem | onde a vara faz a volta fica uma miragem curta (pista falsa) |
| Ouro Derretido | Sopro + Bola de Ouro | a bola que cruza o sopro pega fogo: metade dos ricochetes queima |

### Medição (laboratório, 40 s no meio da partida, nível 3, dano ×2, herói parado)

- Armas base antigas: **12–37** de dano/s. Novas: Açoite 32, Bola de Ouro 38,
  Miragem 38, Tambor 32, Boleadeira 15 (controle), Fogueira ~45 parado (armadilha:
  o herói parado é o melhor caso; fogueiras sobrepostas não somam).
- Evoluções antigas: **44–111**. Novas: Laçada 53, Minuano 74, Arraial 81, Visagem 86,
  Trovão de Brasa 106, Ouro Encantado 114 — reação = 46–62% do dano de cada uma.
- Laços: a dupla rende ~+18% sobre a soma das duas armas sozinhas (os dois laços
  que somam fogo — Noite de São João e Ouro Derretido — acendem só metade dos
  golpes; na 1ª versão quase dobravam a dupla).
- Avisos do verificador que vêm de antes: Vaga-lumes, Granizo e Redemoinho não são
  parceiros de nenhuma evolução (os laços compensam em parte).

## Vento — o 4º elemento (out/2026)

Primeiro a análise disse "adiar" (reações crescem em combinação, leitura no celular,
paridade de armas). O Leonardo escolheu adicionar, e o candidato que menos brigava
com o resto era o **Vento**: tema forte (minuano do Pampa, redemoinho do Saci, o
assobio das lendas), cor própria (**verde-água/menta**, longe do laranja, do azul-gelo
e do roxo) e um verbo que nenhum elemento tinha: **empurrar/arrastar**.

- **Status "ventado"**: −15% de velocidade e o vento arrasta o inimigo para longe do
  herói (chefe e minichefe não). Sem dano por tique.
- **Reações novas** (nomes daqui):

| Reação | Par | Efeito |
|---|---|---|
| **Labareda** | fogo + vento | o alvo explode em chama e o vento leva o fogo a até 5 vizinhos |
| **Geada** | gelo + vento | rajada fria em volta: dano, lentidão forte, congela quem já estava gelado |
| **Temporal** | raio + vento | raios caem do céu no alvo e em 2 vizinhos |

- **Prisma** passou a valer com **3 elementos quaisquer** dos 4.
- **Armas de vento**: Redemoinho (era raio — o Saci virou o guardião do vento),
  **Assobio da Mata** (onda em cone que empurra; Forja 2, 350), **Folhas ao Vento**
  (espiral cortante; Forja 3, 650 + 40 Labaredas), **Cata-vento** (torre plantada que
  sopra rajadas, como os cata-ventos dos poços do sertão; Forja 4, 950 + 40 Geadas).
- **Evoluções**: **Vento Sul** (Assobio + Granizo → Geada), **Ventania** (Folhas +
  Vaga-lumes → Temporal), **Cata-vento de Brasa** (Cata-vento + Fogueira → Labareda);
  o **Redemoinho de Brasa** agora faz Labareda (era Sobrecarga).
- **Laços de vento**: Avivar o Fogo (Assobio + Sopro), Ciranda (Folhas + Redemoinho),
  Tempo Ruim (Cata-vento + Granizo).
- Conquistas: Filho do Vento (vencer só com vento), Fogo Corredor, Sopro do Sul e Dono
  do Temporal (100 de cada reação). Missão do dia: Labaredas.
- Medição (mesmo laboratório): Assobio 38, Folhas 35, Cata-vento ~36, Redemoinho 30;
  Vento Sul 105, Ventania 113, Cata-vento de Brasa 100, Redemoinho de Brasa 80 — na
  faixa. Duplas: Cajado + Assobio (Labareda), Aura + Assobio (Geada), Raio + Assobio
  (Temporal) disparam as três reações.
- Contagem: fogo 5 · gelo 5 · raio 4 · vento 4 (o raio perdeu o Redemoinho). Próximas
  armas, quando vierem: uma de raio e uma de vento.

## Próximas fases

### Fase 3 — Catalisadores (segundo caminho de evolução)
Cada arma ganha uma **segunda evolução** feita com uma **passiva** em vez de uma
arma (estilo Vampire Survivors). Exemplo: Vara Encantada 5 + Ímã → vara que
volta puxando gemas. Dobra os caminhos de build e dá peso à escolha das 4 passivas.
Na ficha: `partnerPassive` no lugar de `partner`.

### Fase 4 — Tratos e itens
Tratos da Mata de 5 para ~12 e mais itens de lanterna. É só configuração, e as
partidas ficam menos previsíveis.

## Como medir

Eventos de balanceamento no Analytics (versão 1.0.1, 09/10/2026; Firebase só no app Android):

| Evento | Quando | Parâmetros |
|---|---|---|
| `card_pick` | cada carta escolhida no nível | `card` (`new:AURA`, `upgrade:STAFF`, `passive:hp`, `pact:…`, `evolution:…`), `kind`, `offered` (as cartas da mesa, separadas por `\|`), `n`, `level`, `t`, `run_n` |
| `run_start` | início da partida | `run_n`, `character`, `difficulty`, `biome`, `power` (soma das bênçãos), `anc` (Tesouro Ancestral), `meal` + `meal_q` (refeição da Clareira) |
| `run_end` | fim da partida | o de antes (`won`, `quit`, `t`, `level`, `kills`, `coins`…) + `weapons` (`STAFF5,AURA3`), `passives` (`hp2,speed1`), `links`, `evos`, `pacts`, `power`, `meal`, `reactions`, `chests`, `lanterns`, `biome` |
| `run_weapon` | fim da partida, 1 por arma | `weapon` (evoluída = chave da evolução), `base_weapon`, `lvl`, `evolved`, `won`, `quit`, `difficulty`, `run_n`, `character` |
| `run_passive` | fim da partida, 1 por passiva | `passive`, `stacks`, `won`, `quit`, `difficulty`, `run_n`, `character` |
| `run_reactions` | fim da partida | `rx_vapor`, `rx_crystal`, `rx_overload`, `rx_labareda`, `rx_geada`, `rx_temporal` (só as que aconteceram) + `won`, `difficulty`… |
| `chest_open` | baú aberto | `kind` (`normal`/`golden`), `t`, `level` |

Já existiam: `pact_taken`, `card_banish`, `lantern_item`, `shrine_used`, `meal_eaten`, `level_up`.

**Como ler:** taxa de escolha = `card_pick` de uma carta ÷ vezes em que ela estava em `offered`
(escolha ignorada = arma fraca ou sem graça); taxa de vitória de uma arma = `run_weapon` com
`won = 1` ÷ total daquela arma, **separando por `difficulty`** e olhando a `power` (quem tem muita
bênção vence com qualquer coisa). As dimensões usadas nos relatórios estão registradas no Google
Analytics (propriedade `p557044087`); um parâmetro novo só aparece nos relatórios depois de
registrado lá, e não vale para trás. O dano por arma ainda **não** é medido (os golpes não
carregam a arma de origem até o inimigo).
