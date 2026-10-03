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

## Leva 3 (feita, out/2026): 5 por elemento, 3 guardiões, laços

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

## Vale adicionar mais elementos? (análise, out/2026)

**Não agora.** Os números:

- **Reações crescem em combinação**: 3 elementos = 3 reações; 4 = 6; 5 = 10. Cada
  reação pede efeito, som, cor, texto, tutorial, feito e equilíbrio próprios — e a
  reação é a assinatura do jogo; 6 reações mal feitas valem menos que 3 claras.
- **Leitura no celular**: os status já usam laranja, azul e roxo sobre um chão verde.
  Um 4º elemento "natureza/terra" (o mais temático) cairia no verde — mesma cor do
  chão, das curas e das marcas de "seguro" dos avisos de chefe.
- **Paridade**: acabamos de chegar a 5 armas por elemento. Um elemento novo precisaria
  de ~5 armas para não nascer fraco (Ressonância, Prisma, conquistas mono-elemento).
- **Já rende**: reações são 41–62% do dano medido; o jogador já monta Vapor no 1º
  minuto (Cajado + Aura).

Onde está a profundidade que faltava, com custo muito menor: **laços** (feitos), **evoluções
que fazem reação sozinhas** (feitas) e **catalisadores** (fase 3 abaixo). Reabrir a
questão se os testadores disserem que as reações "cansam" depois de muitas horas — e,
nesse caso, um elemento viria junto de um **bioma** (ex.: água no Pantanal), não solto.

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

Eventos que já existem no Analytics: `run_end` com as armas. Antes do teste
fechado, vale incluir a **arma escolhida em cada carta de nível** e as **evoluções
obtidas**, para ver o que é escolhido e o que é ignorado (escolha ignorada = arma
fraca ou sem graça).
