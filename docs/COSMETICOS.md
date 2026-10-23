# Cosméticos e novos itens à venda

Ideias anotadas em 19/10/2026 (conversa com o Leonardo), a partir da pergunta "podemos lançar mais itens
para venda?". **Status (19/10/2026): fases 1, 2 e 3 prontas no código, desligadas no build da loja.** As 16 peças, o
Guarda-roupa-vitrine, a Loja (Sem anúncios · Pacote Fundador · kits), a Clareira Ancestral e a compra de kits e
pacotes pela Play Store funcionam no modo de teste (`?debug=1`, com loja simulada). Preços e o porquê:
[Estratégia de preços](#estratégia-de-preços-revista-em-19102026-com-pesquisa). Para vender: 👤 criar os 4 kits
e os 2 pacotes do Fundador no Play Console (tabelas em `docs/PLAY_STORE.md`) e ligar `COSMETICS.ENABLED` e
`COSMETICS.SHOP` em `src/config.js` numa versão nova.

## Princípio (não muda)

Vender **só o que não dá vantagem**: sem moedas, sem bênçãos, sem pular o tempo das obras, sem sorteio
(gacha), sem energia. É promessa da ficha da loja ("sem compra de poder") e da `CLAUDE.md`.

## O que vender, por prioridade

1. **Gorjeta ao estúdio** (consumível, R$ 4,90 / 9,90 / 19,90): só um obrigado e um selo de apoiador na
   Clareira. Barata de fazer (janela + produto consumível; o plugin já consome). Para quem comprou o "Sem
   anúncios" e quer apoiar mais.
2. **Kits cosméticos temáticos** (R$ 4,90) e o **Pacote Fundador** (R$ 19,90): ver a estratégia de preços
   abaixo.
3. **Trajes de silhueta nova**, avulsos (R$ 4,90) ou em pacote: mais caros de fazer (cada herói tem a sua
   função de desenho em `src/art/Hero.js` e as poses de cair/levantar em `src/art/HeroRig.js`).
4. Depois, só com dados de retenção: **bioma novo como expansão** (ex.: Pantanal), como o Vampire Survivors.

Não vender: moedas, bênçãos, atalhos de tempo, baú pago, passe de temporada premium (exige conteúdo novo
toda temporada; só depois dos números de retenção).

## Estratégia de preços (revista em 19/10/2026, com pesquisa)

O Leonardo pediu para repensar ("talvez vender algo mais barato dê mais retorno"). O que a pesquisa mostrou:

- **Cosmético vende pouco em jogo de um jogador só.** O motivo nº 1 de comprar visual é ser visto (status,
  identidade no grupo); sem multijogador sobram "gostei do jogo" e "quero apoiar". O kit avulso é a escada de
  entrada, não o carro-chefe. ([Illinois][f1], [Bristol][f2])
- **No gênero, conteúdo pago é barato:** Vampire Survivors vende DLC a US$ 1,99 (US$ 0,99 no celular, no
  lançamento); Brotato, a US$ 2,99. ([TouchArcade][f3], [App Pricing Lab][f4])
- **A primeira compra é a mais difícil; depois dela o jogador volta.** O pacote de primeira compra da Kongregate
  subiu a conversão de 0,68% para 0,90%, e 74% de quem comprou comprou de novo. Mas o item de US$ 8 fez 99% da
  receita contra o de US$ 4: o barato converte, quem paga a conta é o pacote de valor alto.
  ([Kongregate][f5], [Deconstructor of Fun][f6])
- **Brasil:** 73% dos jogos vivem de anúncios, o Pix facilitou a microtransação e o mínimo do Google Play é
  R$ 0,99. ([Mordor Intelligence][f7], [Google][f8]) Três ofertas lado a lado, com a do meio em destaque, é o
  arranjo clássico de âncora. ([Unity][f9])

**Decisão — degraus, do mais barato ao destaque:**

| Produto | Preço (Brasil · base dos outros países) | Papel |
|---|---|---|
| Kit (cada um dos 4) | **R$ 4,90 · US$ 0,99** (era R$ 9,90) | entrada barata: a primeira compra |
| Sem anúncios | R$ 14,90 · US$ 2,99 | já à venda, não muda |
| **Pacote Fundador** | **R$ 19,90 · US$ 3,99** | o destaque: Sem anúncios + 4 kits (R$ 34,50 separados, 42% de economia) + exclusivos |
| Pacote Fundador sem o Sem anúncios | R$ 9,90 · US$ 1,99 | para quem já tem o Sem anúncios (o Play não faz "complete o conjunto") |
| Pacote Apoiador | R$ 24,90 · US$ 4,99 | depois da janela do Fundador: mesmo conteúdo, sem os exclusivos |

- **Âncora:** a Loja (`src/ui/ShopModal.js`) põe os três lado a lado; o pacote do meio custa R$ 5 a mais que o
  Sem anúncios sozinho e traz tudo ("MELHOR VALOR", "Separado sai por R$ 34,50", "Você economiza 42%"). Os
  números vêm da própria Play Store (preço e moeda de cada país); a economia arredonda para baixo e só soma o
  que também se vende avulso — os exclusivos ficam de bônus, então a vitrine nunca exagera.
- **Exclusivos do Fundador (só aparência):** a **Clareira Ancestral** (skin do acampamento inteiro, 19/10/2026:
  jequitibá no lugar da samaúma, placa e estandarte dos Fundadores, raios de sol de fim de tarde com pólen
  dourado, céu dourado, folhas de cobre caindo e em tapete nas raízes, vaga-lumes dourados; no terreiro, quatro
  esteios entalhados com ponteira de cobre, um cordão de lamparinas de cabaça por cima da fogueira e lamparinas
  nos ganchos, bancos entalhados com almofada e a rede de varanda; um tucano-toco pousado num esteio, borboletas-
  azuis de dia e cogumelos flor-de-coco que brilham à noite; na horta, cerca de estacas entalhadas com trançado
  de palha, portal de esteios com ponteira de cobre, placa do broto e duas lamparinas balançando, e o espantalho
  de poncho tecido com pena azul no chapéu e lamparina no braço (a franja corre ao vento) — arte em
  `src/art/CampAncestral.js`; na 1ª versão era só a árvore e a luz, e o Leonardo pediu mais) e a **insígnia de Fundador** (medalhão ao lado do título da Clareira). O "kit Jequitibá
  premium" saiu: o jequitibá virou a Clareira Ancestral, vista toda vez que se abre o jogo, sem competir com os
  kits. Placar no futuro: a insígnia vai junto do nome (`Wardrobe.isFounder()`).
- **Janela:** à venda até **31/01/2027** (`COSMETICS.FOUNDER_UNTIL`, só o texto "Só até…"). Quem encerra de
  verdade é o Play Console (👤 desativar `pacote_fundador` e `pacote_fundador_kits`): produto desativado some
  do `getProducts` e a Loja passa sozinha para o Pacote Apoiador. Quem comprou continua Fundador para sempre.
- **O momento bom:** comprou o Fundador (ou o pagamento pendente foi aprovado) → ao fechar a Loja a Clareira já
  é a Ancestral; dá para voltar à de sempre na aba **Clareira** do Guarda-roupa.
- **Estorno do pacote:** sai tudo o que ele deu, com aviso que diz o quê (kits, Clareira Ancestral, insígnia; os
  anúncios só voltam se nenhuma outra compra ainda os tira). `npm run test:compra`: cenários `pacote*`.
- **Onde se compra:** ★ da Clareira e botão LOJA do título (com a loja de cosméticos desligada, os dois
  continuam sendo só o "Sem anúncios"); atalhos no Guarda-roupa (aba Kits e aba Clareira). Nunca na partida.
- **Medir:** `shop_view` → `pack_buy_ui` e `iap_result` por produto (`shop_view` com `from: "nudge"` = veio da
  oferta do "Sem anúncios" na volta à Clareira, evento `noads_nudge`). Se o Fundador não converter, testar o
  preço com "Experimentos de preço" do Play Console antes de mexer no conteúdo.

[f1]: https://www.ideals.illinois.edu/items/114139/bitstreams/374302/data.pdf
[f2]: https://bristoluniversitypressdigital.com/view/journals/consoc/5/2/article-p285.xml
[f3]: https://toucharcade.com/2022/12/15/vampire-survivors-legacy-of-the-moonspell-dlc-mobile-release-date-2023-ios-android-iphone-price/
[f4]: https://apppricinglab.com/iap/apple/1668755109
[f5]: https://www.gamedeveloper.com/business/using-new-buyer-packs-to-enhance-player-experience-and-increase-conversion
[f6]: https://www.deconstructoroffun.com/blog/2024/4/8/free-to-play-starter-pack-pricing-when-conversion-is-king-we-may-price-too-low
[f7]: https://www.mordorintelligence.com/industry-reports/latin-america-mobile-gaming-market
[f8]: https://android-developers.googleblog.com/2015/11/minimum-purchase-price-for-apps-and-in.html?hl=pt_BR
[f9]: https://unity.com/resources/in-app-purchases-guide

## Clareira da Caatinga (grátis, por conquista — 23/10/2026)

A segunda skin do acampamento, e a primeira **grátis**: o sertão em casa, para quem domina a Caatinga. Não entra na
Loja nem em pacote; a Ancestral continua exclusiva do Pacote Fundador (regras dela iguais).

- **Como libera:** vencer no **Perigo Pesadelo na Caatinga** dá a conquista **Mandacaru em Flor** (no sertão, o
  mandacaru que floresce na seca é sinal de chuva) e a Clareira. O save passou a guardar o maior Perigo vencido em
  cada mapa (`bestDiffByBiome`); vitórias de antes desse registro (23/10/2026) não contam: vale a próxima.
  A conquista mora no save do jogo, então o **progresso na nuvem** (Play Games) leva o desbloqueio junto; a escolha
  no Guarda-roupa fica no aparelho, como as outras peças.
- **Aviso (uma novidade por vez):** a tela do fim mostra "Nova Clareira no Guarda-roupa: Clareira da Caatinga" no
  topo dos desbloqueios. Na volta à Clareira, a revelação `sertao` (`Reveal.js`): a câmera vai à placa da trilha, o
  botão do mandacaru abre em flor quadro a quadro (pétalas e luz) e a Anciã diz "O mandacaru floriu na seca: é sinal
  de chuva! O sertão também pode morar aqui. Veja no Guarda-roupa." Depois, o Guarda-roupa ganha o selo "!" até ser
  aberto (abre direto na aba Clareira, com a Caatinga na prévia). O mandacaru da trilha fica florido para sempre.
- **Guarda-roupa, aba Clareira:** três cartões (de sempre · Ancestral · Caatinga, com o mandacaru em flor). Trancada,
  mostra "Grátis: Vença no Perigo Pesadelo na Caatinga", o quanto falta (a trilha a abrir, "Você ainda não venceu
  na Caatinga" ou "Seu melhor na Caatinga: Perigo Veterano") e o botão BLOQUEADA. A prévia mostra o pedaço de sertão
  (juazeiro ao vento, mandacaru florido, calango fazendo flexões no lajedo, asas-brancas cruzando com a sombra, folhas
  secas rolando). Selecionar é igual à Ancestral: USAR → ao fechar, a cena recomeça no sertão.
- **O visual** (mesmo mapa, tudo no lugar e funcionando — horta, obras, lago, cozinha, fogueira, Mural, baú):
  - chão de **terra vermelha** com placas de **barro rachado** e manchas de terra clara; trilhas e terreiro de terra
    batida clara (a trilha da floresta afina até sumir no horizonte);
  - o **juazeiro** no lugar da samaúma (copa em 8 quadros: os cachos mexem em onda, de oeste para leste), com o
    **pote de barro** na sombra; **mandacarus** com a flor branca que **abre à noite** e fecha de manhã (cada flor no
    seu tempo, quadro a quadro, e "respira" aberta), **coroa-de-frade**, xique-xique, macambira, lajedos e capim
    seco deitando na mesma onda do vento;
  - horta com **cerca de varas**, mourões de forquilha e a **porteira** com a placa do broto e o **chocalho**
    balançando; **espantalho de chapéu de couro** (aba virada em meia-lua, estrela), gibão e lenço vermelho ao vento,
    cabaça no braço; canteiros fechados de mato seco;
  - **rede de varanda** colorida balançando; toras secas de sentar;
  - o **açude**: margem de barro rachado, lajedos, **aguapés** com a flor lilás e a **carnaúba** na ilhota; à noite,
    o reflexo da lua tremendo na água;
  - **horizonte aberto ao norte** (a caatinga é baixa): céu pela hora em 4 fases misturadas (amanhecer, dia de
    mormaço, poente de fogo, noite de lua com a Via Láctea), serra e caatinga em silhueta, **lua grande** que nasce
    dourada a leste e cruza a noite, **sol** nascendo e se pondo atrás da serra, nuvens finas, estrelas cintilando,
    estrela cadente, bandos de pássaros ao longe e a **cerca de varas na linha do horizonte**. A camada da noite para
    na linha do horizonte (`SkyGlow` com retângulo) e o que fica por cima dela é tingido pela mesma cor;
  - bichos: **calangos** (respiram, fazem flexões, olham para trás, correm levantando poeira, sobem no lajedo e fogem
    do herói), **asas-brancas** (bando em curva, vistas de cima em 16 rumos × 8 quadros de batida com a sombra no
    chão; às vezes pousam, ciscam e saem quando o herói chega), **carcará** planando em círculos com a sombra
    correndo no chão (16 rumos, desenhado em cada rumo, nunca girado); **poeira** levantando e, de vez em quando,
    um **redemoinho** atravessando; folhas secas rolando com o vento.
  - Céu pela hora próprio (`SKY_SERTAO`): manhã quente, sol a pino, poente vermelho e roxo, noite de lua azul.
- **Código:** arte em `src/art/CampSertao.js` (registrada só quando precisa: `ensureCampSertao`), mundo e bichos
  em `src/scenes/CampSertao.js` (mixin da `CampScene`), ganchos com `this._sertao` em `CampScene`, `CampDecor`,
  `CampGarden` e `CampPond`; catálogo em `COSM_CAMP.caatinga` (`earn`/`how`, `Cosmetics.js`); cores novas no
  bloco "Sertão" da `Palette.js`. Teste: **`npm run test:clareira`** (no `npm test`).
- **Conferido** (23/10/2026): capturas em 4 horas, 915×412 e 1280×720, pt/ja/zht; tiras dos quadros e do movimento
  (calango, juazeiro, asas-brancas, carcará, redemoinho, espantalho, rede, flor abrindo, horizonte do dia inteiro).
  Custo: registrar a arte leva ~40–80 ms no PC (uma vez por sessão); a cena tem o mesmo número de objetos da de
  sempre (~925) e o mesmo tempo de quadro. 👤 Ver no S23 e num celular fraco.

## Por que não só trocar a paleta

O herói é pequeno, visto de cima, no meio de centenas de inimigos: cor nova quase não aparece. O que se vê,
em ordem:

| Peça | Quanto aparece | Vale para | Observação |
|---|---|---|---|
| **Efeito de libertação** (o que sai do corrompido ao ser libertado) | centenas de vezes por partida | todos os heróis | conta o tema: "onde a Podridão some, a floresta volta" |
| **Rastro** ao andar e no dash | a partida inteira | todos os heróis | |
| **Traje** (silhueta: chapéu, capa, cabelo, objeto que carrega) | sempre, mas pequeno | 1 herói | precisa redesenhar andar + poses do `HeroRig` |
| **Entrada e vitória** | 2 vezes por partida | todos | é o que se grava e compartilha |
| **Enfeite da Clareira** que o herói usa (rede, bandeirinhas, fogueira de outra cor) | no menu | — | interação, não só objeto parado |

### Ideia forte para trajes: versões regionais das lendas

Cada lenda muda de região para região (a Caipora homem ou mulher, o Curupira amazônico e o do Sul, os vários
Sacis…). Um traje = uma versão real, com história por trás: profundidade cultural, material para as redes
("você conhecia esta versão do Saci?"). Exige pesquisa e os cuidados de `docs/TEMA_FOLCLORE.md` (sem
caricatura; nada de símbolos sagrados de povos indígenas, como cocar).

## Regras de legibilidade (obrigatórias)

- Cosmético **nunca** muda as cores dos elementos (fogo, gelo, raio, vento), dos avisos de perigo, dos
  tiros inimigos nem das gemas de XP (verde, azul, dourada) — passaram pela auditoria de daltonismo.
- O efeito de libertação **soma** ao efeito de morte do elemento (que mostra quem matou, parte da leitura
  das reações); nunca o substitui.
- Movimento e forma diferentes de tudo que é jogo: pétala **cai devagar e gira**; brasa sobe rápido, faísca
  risca, folha de vento voa.
- Teto de custo: matança em massa não pode pesar no aparelho fraco (limite por intervalo e pool fixo).

## Justiça

Cosmético não dá poder: pago ou grátis, ninguém joga melhor por ter. As grátis existem para todo mundo ter
algo para personalizar desde o começo.

## Plano estruturado (decidido com o Leonardo em 19/10/2026)

Decisões: as peças **pagas** são as trabalhadas (nível da pétala de ipê); as **grátis** são simples e de
todos desde o começo (nada de "ganhar a peça por conquista"). Cada **kit pago = uma compra** que libera as
3 peças dele. Loja em dois caminhos: menu de cima e direto no Guarda-roupa. Nunca durante a partida.

### Catálogo (16 peças: 4 grátis + 12 pagas em 4 kits)

| Peça | Libertação | Rastro | Despertar (R) |
|---|---|---|---|
| **Grátis** | **Sementes** — sementinhas pulam e caem | **Pegadas** — marcas no chão que somem · **Folhas secas** | **Luar** — aura prateada |
| **Kit Ipê-rosa** | pétalas + flor que brota + tapete | pétalas | Despertar rosa + anel de ipês |
| **Kit Paineira** | o fruto da barriguda estala e solta painas que sobem devagar | paina se soltando | nuvem de algodão subindo em volta + frutos estalando em roda |
| **Kit Coruja-buraqueira** | uma corujinha sai voando do libertado + penas | pena caindo em pêndulo | **asas abertas** atrás do herói + duas corujinhas levantam voo (sem chama) |
| **Kit Festa Junina** | bandeirinhas de chita caindo | bandeirinha ao vento | **arraiá**: mastro e cordões de bandeirinhas em leque em volta do herói (sem chama) |

Cores: só as livres do combate (rosa, creme, palha, barro, marrons, cinzas). A Festa Junina usa a chita nesses
tons (sem vermelho/azul/verde de jogo). Cada peça paga passa pelo teste de legibilidade (matança em massa,
Despertar, herói sempre à vista) antes de ir à loja.

### Revisão de 19/10 (Leonardo: "o Arraiá está horrível", "revise toda a qualidade e a estrutura")

**Peças (no tamanho do jogo, com e sem horda):** recolorir a chama do Despertar só funciona com cor que
BRILHA (dourado, rosa). Em marrom, barro ou cinza ela vira "chama suja" — o Arraiá e a Coruja pareciam lama, o
Luar e o Algodão pareciam fumaça — e o pontilhado da aura vira xadrez fora do dourado. Então: Luar = chama
prata limpa (sem pontilhado); Algodão = nuvem de bolotas subindo (desenho próprio no laço da aura; a 1ª
versão parecia "bonecos de neve" em fila); Coruja = sem chama, as asas são o Despertar (pintas em vez de
listras, ponta arredondada para não parecer morcego, tons claros — o marrom escuro sumia na trilha de terra à
noite) + brilho creme constante; Arraiá = sem chama, mastro e 4 cordões de bandeirinhas em leque + luz quente.
Três descrições foram reescritas para dizer o que a peça faz agora.

**Textos (sentido, não só caber):** "Quantidade de pétalas" valia para todas as peças → "Quantidade de
efeitos" (Pouca · Normal · Muita); EQUIPADA/EQUIPAR não concordavam com "Padrão" → EM USO/USAR; "uma folha a
cada passo" (cai enquanto anda); "varal na cabeça" (é sobre); "Loja de teste (modo de teste)"; es "PRONTO"
(ambíguo) → "PRÓXIMAMENTE"; zh/zht "足迹" (= pegadas) para rastro → "拖尾".

### Guarda-roupa (vitrine) — estrutura revista em 19/10

| Problema | Solução |
|---|---|
| Cada peça paga mostrava o preço (parecia o preço de cada uma) | preço só no **kit**; a peça diz "Vem no Kit …" com cadeado e o botão **VER KIT · R$ 4,90** |
| Dois destaques confusos (moldura = prévia, ✓ = em uso) | moldura dourada = na prévia · selo ✓ = em uso · cadeado = falta comprar (nunca só a cor) |
| Sem lugar para ver os kits | aba **Kits**: os 4 kits com as 3 peças; a prévia toca o kit inteiro (Rastro → Libertação → Despertar) |
| Compra numa 2ª janela | compra direto na aba Kits (a Play Store já confirma); depois, **USAR O KIT INTEIRO** |
| Configuração e notas no meio da vitrine | rodapé compacto, as 3 opções de quantidade à vista |
| Não dizia o que estava em uso | linha "… · Em uso: X" sob as abas |
| Equipar sem retorno | som, vibração curta e o selo ✓ surge com um pulo; tocar de novo na peça selecionada já usa |
| A prévia ignorava a quantidade de efeitos | a prévia toca com a quantidade escolhida |
| A janela mudava de altura entre as abas | altura fixa |

### Guarda-roupa (vitrine) — primeira versão

- Botão no **menu de cima da Clareira**; abas **Libertação · Rastro · Despertar**; cartões das peças.
- **Prévia ao vivo** à esquerda: o guardião escolhido com a peça tocando em laço — também nas peças que o
  jogador ainda não tem (ver antes de comprar é o que vende).
- Cartão: **EQUIPADA** · **EQUIPAR** · **preço** (abre a compra do kit ali mesmo) · **Em breve** (loja desligada).
- Quantidade de pétalas (discreta · normal · cheia) continua valendo para todas as peças.

### Fases

1. ✅ **Peças e vitrine (19/10/2026):** motor de peças com um "palco" que serve à partida E à prévia
   (`src/systems/Cosmetics.js`, `CosmeticPieces.js`, `src/ui/CosmeticStage.js`, `WardrobeModal.js`, arte em
   `src/art/CosmeticFX.js`), 4 grátis + 12 pagas, botão de camiseta no menu de cima da Clareira, 6 idiomas.
2. ✅ **Compra dos kits (código, 19/10/2026):** `Billing.js` com um registro por produto ("Sem anúncios" +
   4 kits): preço, compra, pendente (conferido a cada 20 s com o app aberto), reconhecimento com nova
   tentativa, carência, conferência dupla e **aviso de estorno/aprovação por kit** (com atalho para o
   Guarda-roupa). O "Sem anúncios" continua no mesmo formato salvo de antes. `npm run test:compra` com 12
   cenários (3 de kit). Falta 👤: criar os produtos e ligar as chaves (acima). Preço: **R$ 4,90 por kit**.
3. ✅ **Loja e pacotes (código, 19/10/2026):** Loja com os três degraus (`ShopModal.js`, ★ da Clareira e LOJA
   do título), Pacote Fundador / sem o Sem anúncios / Apoiador (`STORE.PACKS`, `Billing.buyPack`), Clareira
   Ancestral (`COSM_CAMP`, aba Clareira do Guarda-roupa, `src/scenes/CampDecor.js`), insígnia na Clareira,
   chamada do pacote na aba Kits. `npm run test:compra` com 16 cenários (4 de pacote).
   - ✅ **Clareira da Caatinga (23/10/2026):** a primeira skin grátis, pela conquista Mandacaru em Flor (ver a seção
     acima). `npm run test:clareira`.
4. **Depois:** gorjeta (consumível), kits sazonais, trajes regionais, entrada/vitória, acessório do bicho,
   insígnia no placar.

### Como as peças foram conferidas (19/10/2026)

- Arte: `node tools/monster-sheet.mjs saida.png cos_owl,cos_wings,... 8` (folha de contato sem navegador).
  Rodadas: a paina virava "olho" (disco com ponto) → tufo em leque com a semente embaixo; a corujinha parecia
  um bonequinho de braços → asas largas e corpo de ovo; as asas pareciam escovas → silhueta de asa de coruja
  (borda de ataque, cobertas pintadas, "dedos" nas primárias); a aura da paineira lembrava o dourado → algodão.
- Prévia do Guarda-roupa (as 16): a pegada escura sumia na grama → clara; as asas ficavam atrás da aura →
  NA FRENTE da aura e atrás do herói, maiores que a chama; o lobo da prévia nascia em cima do herói.
- Bug achado e corrigido: trocar de peça na prévia destruía objetos com tweens rodando → exceção no laço e a
  prévia congelava. Agora a prévia cancela atrasos/tweens antes (atrasos das peças via `host.delay`).
- Partida real com cada kit inteiro em "Cheia" (pior caso): matança em massa e Despertar com gemas, moedas,
  baús e herói legíveis; no máximo ~60 partículas de cosmético vivas na tela.

### Pacotes — o que ficou da primeira ideia (19/10/2026)

A 1ª conta (R$ 29,90 com kits a R$ 9,90) foi trocada pela estratégia de preços acima. Continua valendo:

- **Quem já comprou uma parte:** o Play não faz "complete o conjunto" para produtos únicos → dois produtos
  (com e sem o Sem anúncios); a Loja mostra só o que serve para quem está olhando.
- **Kits futuros:** o pacote leva os kits **lançados até a compra** (o texto diz "os 4 kits"); kit novo depois
  é vendido à parte.
- **Política:** o pacote não parece obrigatório, não aparece no meio da partida e a vitrine diz exatamente o
  que vem dentro.

## Protótipo: Kit Ipê-rosa (19/10/2026)

Rosa (`PAL.pink`) porque nenhuma cor de jogo usa rosa (só flores e bandeirinhas de decoração); o ipê-amarelo
se confundiria com a gema dourada e as brasas.

- **Libertação:** pétalas de ipê-rosa sobem do corrompido e caem girando; uma flor de ipê **brota no chão**
  onde ele estava, com um brilho rosa fraco (a flor fica abaixo do mapa de luz e sumiria à noite), e murcha
  em ~2 s (no máximo uma flor nova a cada 90 ms, pool de 16).
- **Tapete de ipê:** a pétala que termina a queda pousa no chão e desbota em ~2–3 s (pool de 48) — marca
  onde se lutou, como o chão embaixo de um ipê florido.
- **Rastro:** uma pétala cai atrás dos pés de vez em quando ao andar; no dash, um punhado.
- **Despertar (R):** o Despertar inteiro fica **rosa** — aura (mesma chama, outra paleta:
  `registerAuraVariant` em `src/art/AuraFX.js`), tinta do herói (`PAL.pinkHi`), clarão da tela, onda, luz e
  fagulhas — com a mesma forma e força do dourado, então o estado continua legível. Mais: explosão de
  pétalas e um anel de 7 ipês florescendo em onda; enquanto dura, pétalas sobem de um anel largo e se
  afastam. Com a peça em "Padrão", tudo dourado como sempre. (Na 1ª versão só se somavam pétalas ao dourado;
  o Leonardo pediu o Despertar rosa de verdade, 19/10/2026.)
- **Personalizável — Guarda-roupa** (Clareira, botão verde de teste): cada peça (libertação, rastro,
  Despertar) se equipa à parte, e a **quantidade de pétalas** é do jogador (discreta, normal, cheia — a
  discreta também serve a quem quer a tela mais limpa). Guardado em `guardiao_cosmetics_v1`; vale na partida
  seguinte.
- Código: `src/systems/Cosmetics.js`, `src/ui/WardrobeModal.js` e texturas em `src/art/CosmeticFX.js`. Só no
  modo de teste (`?debug=1`); `&kit=ipe` equipa tudo enquanto nada foi escolhido no Guarda-roupa.

Rodadas de autocrítica (capturas de partida real, com e sem o kit):
1. Pétala 5×4 e flor clara: viravam **pontinhos (confete)** e a flor se confundia com as florzinhas brancas
   da grama. → pétala 7×5, flor 13×13 rosa com contorno escuro, pétalas que pousam, brilho.
2. Bom no combate normal, mas na **matança em massa** (40 de uma vez) virava nuvem rosa por cima das gemas e
   do baú. → **orçamento total de 14 pétalas por 120 ms** somando todas as mortes (esgotado, a morte fica só
   com o efeito do elemento) e nada fora da tela.
3. Gemas e baú legíveis na matança; rastro e tapete aparecem; sem queda de FPS medida no navegador.
4. Despertar: as pétalas em espiral nasciam perto e viviam muito, e com "Cheia" **cobriam o próprio herói**.
   → emissor próprio, curto, saindo de um anel largo para fora; a quantidade não acelera essa peça; morte
   colada no herói solta metade das pétalas e para longe dele; teto de 90 pétalas vivas.
5. Guarda-roupa: o subtítulo da janela encostava no título em japonês com texto muito grande → a nota
   "protótipo" foi para o pé da janela (que cresce com o texto).

Falta sentir no celular (S23 e um aparelho fraco). Preço do kit decidido: R$ 4,90 (ver a estratégia de preços).

Próximo passo, se o protótipo convencer: sistema de cosméticos (guardar o que tem e o que está equipado),
guarda-roupa na Clareira, produto no Play Console, peça grátis por conquista.
