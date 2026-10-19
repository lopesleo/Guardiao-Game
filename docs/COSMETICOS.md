# Cosméticos e novos itens à venda

Ideias anotadas em 19/10/2026 (conversa com o Leonardo), a partir da pergunta "podemos lançar mais itens
para venda?". **Status (19/10/2026): fases 1 e 2 prontas no código, desligadas no build da loja.** As 16 peças, o
Guarda-roupa-vitrine e a compra dos kits pela Play Store funcionam no modo de teste (`?debug=1`, com loja
simulada). Para vender: 👤 criar os 4 produtos no Play Console (tabela em `docs/PLAY_STORE.md`) e ligar
`COSMETICS.ENABLED` e `COSMETICS.SHOP` em `src/config.js` numa versão nova.

## Princípio (não muda)

Vender **só o que não dá vantagem**: sem moedas, sem bênçãos, sem pular o tempo das obras, sem sorteio
(gacha), sem energia. É promessa da ficha da loja ("sem compra de poder") e da `CLAUDE.md`.

## O que vender, por prioridade

1. **Gorjeta ao estúdio** (consumível, R$ 4,90 / 9,90 / 19,90): só um obrigado e um selo de apoiador na
   Clareira. Barata de fazer (janela + produto consumível; o plugin já consome). Para quem comprou o "Sem
   anúncios" e quer apoiar mais.
2. **Kits cosméticos temáticos** (R$ 9,90): um conjunto que vale para **todos os guardiões** de uma vez —
   efeito de libertação + rastro + um enfeite da Clareira. Ver abaixo.
3. **Trajes de silhueta nova**, avulsos (R$ 4,90) ou em pacote: mais caros de fazer (cada herói tem a sua
   função de desenho em `src/art/Hero.js` e as poses de cair/levantar em `src/art/HeroRig.js`).
4. Depois, só com dados de retenção: **bioma novo como expansão** (ex.: Pantanal), como o Vampire Survivors.

Não vender: moedas, bênçãos, atalhos de tempo, baú pago, passe de temporada premium (exige conteúdo novo
toda temporada; só depois dos números de retenção).

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
| Cada peça paga mostrava "R$ 9,90" (parecia o preço de cada uma) | preço só no **kit**; a peça diz "Vem no Kit …" com cadeado e o botão **VER KIT · R$ 9,90** |
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
   cenários (3 de kit). Falta 👤: criar os produtos e ligar as chaves (acima). Preço: **R$ 9,90 por kit**.
   A ★ de cima continua sendo só o "Sem anúncios"; a vitrine dos kits é o Guarda-roupa (camiseta).
3. **Depois:** pacote do apoiador (abaixo), gorjeta (consumível), kits sazonais, trajes regionais,
   entrada/vitória, acessório do bicho.

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

### Pacote do apoiador (só pensado; não implementar ainda)

**Ideia:** uma compra que leva **"Sem anúncios" + os 4 kits** por bem menos que separado, e um selo de
apoiador na Clareira (cosmético, sem poder).

- **Conta:** separado = R$ 14,90 + 4 × R$ 9,90 = **R$ 54,50**. Pacote a **R$ 29,90** (~45% de desconto) —
  abaixo de R$ 30 é a faixa de "compra de impulso" de quem já gostou do jogo; US$ 5,99 fora do Brasil.
- **Quem já comprou uma parte:** o Play não faz "complete o conjunto" para produtos únicos. Saídas: (a) a
  loja só oferece o pacote a quem **não** tem nada (e mostra "falta só X" a quem tem), ou (b) dois produtos —
  "Pacote do apoiador" e "Pacote do apoiador (sem o Sem anúncios)" a R$ 19,90. A (b) é mais justa.
- **Kits futuros:** prometer "todos os kits futuros" prende o calendário e corta receita; melhor "todos os
  kits **lançados até a compra**" + o selo. Kit novo depois → preço cheio ou desconto de apoiador.
- **Quando:** só depois de haver 4 kits na loja e dados de conversão do "Sem anúncios" (`iap_view` → `iap_result`);
  o pacote vira a oferta do lançamento (03/12) ou de uma data (Dia do Folclore, 22/08).
- **Cuidado de política:** o pacote não pode parecer obrigatório nem aparecer no meio da partida; a vitrine
  diz exatamente o que vem dentro.

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

Falta sentir no celular (S23 e um aparelho fraco) e decidir se o Kit vale R$ 9,90 para quem joga.

Próximo passo, se o protótipo convencer: sistema de cosméticos (guardar o que tem e o que está equipado),
guarda-roupa na Clareira, produto no Play Console, peça grátis por conquista.
