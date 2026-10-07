# Roadmap — Guardião da Floresta

Consolida [`PRE_LANCAMENTO.md`](PRE_LANCAMENTO.md), [`CLAREIRA.md`](CLAREIRA.md),
[`VIDA_NA_CLAREIRA.md`](VIDA_NA_CLAREIRA.md) e [`RITMO_E_APRESENTACAO.md`](RITMO_E_APRESENTACAO.md)
numa ordem de execução. Cada marco termina **jogável e testado**.

Legenda: ✅ feito · 🚧 em andamento · ⬜ a fazer · 👤 depende do Leonardo

---

## Antes do lançamento

### M0 — Fundações técnicas ✅
Base para tudo que vem depois; o jogador quase não vê.
- ✅ Save com **versão + migração** (proteger progresso nas atualizações)
- ✅ **Serviço de anúncios** (`AdService`): interface única; no navegador simula
  (sem anúncio real); no app, AdMob entra no M5
- ✅ **Registro de eventos** (`Analytics`): partida iniciada/terminada, nível,
  anúncio oferecido/visto — hoje só em memória/console; Firebase no M5
- ✅ **Qualidade gráfica automática** (Alta/Baixa): aparelho fraco desliga
  a iluminação dinâmica
- ✅ Música pausa quando o app vai para o fundo

- ✅ **Motor atualizado para Phaser 4.2.1** (era 3.80.1). Ajustes: `setTintFill` →
  `setTintMode(FILL)`, `postFX` → `camera.filters` e **`render.batchSize: 2048`** em
  `src/main.js` (o padrão do v4 derrubava o S23 para 14 FPS; agora 60–120)

### M1 — Profundidade da partida ✅
- ✅ **Lanternas de cogumelo** quebráveis no mapa (iluminam) com itens:
  Vácuo de Seiva, Relógio da Mata, Sopro Ancestral, caju
- ✅ **Limite de 4 passivas** por partida
- ✅ **Reviver** 1× por partida (via `AdService`)
- ✅ **Mais uma carta** na tela de nível, 1× por partida (via `AdService`) —
  substituiu o "dobrar baú", que oferecia anúncio no meio da ação
- ✅ **Dobrar moedas** no fim da partida (via `AdService`)
- ℹ️ Ofertas de anúncio prontas, mas **desligadas** (`ADS.ENABLED = false` em
  `src/config.js`); para testar, abrir com `?ads=1`. Ligar junto com o AdMob (M5).
- ✅ **Modo Infinito** (Noite Eterna) depois de vencer o Ancião: inimigos +25% vida
  e +12% dano por minuto (composto), eventos em ciclo, +15 moedas/min, recorde

### M2 — Clareira, parte 1: o acampamento ✅
- ✅ **Clareira caminhável** (hub estilo Hades/Dead Cells) entre o título e a partida:
  Fogueira (guardiões), Santuário (bênçãos e dons), Forja (armas), Mural
  (conquistas), placa do Perigo, Anciã (dicas); a trilha ao norte leva à floresta
  com transição contínua (entra pela brecha da muralha sul, que se fecha)
- ✅ Construções com níveis: **Fogueira** (guardiões nv2–4), **Santuário** (teto do rank
  das bênçãos), **Forja** (armas por nível); Mural ganha níveis com as missões (M4)
- ✅ **Obras com tempo** (na hora / 5 min / 1 h / 4 h) + João-de-barro (1 obra por
  vez); cada partida adianta 10 min + 1 min por minuto; conclui grátis com ≤ 2 min;
  save v3 com migração (níveis calculados do progresso antigo)
- ✅ **Madeira Ancestral** caindo nas partidas (minichefe 3, baú dourado 2, baú
  comum 25%, Ancião 6 — valores em `WOOD` no config)
- ✅ Clareira começa **em ruínas** e é revelada por progresso (Santuário após a 2ª
  partida, Forja após a 3ª, ninho com a 1ª madeira, Mural após a 4ª), uma por visita,
  com cena e fala da **Anciã da Fogueira**; 1ª abertura vai direto para a floresta;
  saves antigos veem tudo revelado

### M2.5 — Lendas da mata ✅ (falta só a revisão 👤)
Aplica o tema ([`TEMA_FOLCLORE.md`](TEMA_FOLCLORE.md)) ao que já existe.
- ✅ Redesenho dos 4 personagens: **Curupira** (pés virados, cabelo de fogo), **Caipora**,
  **Iara**, **Saci** (uma perna, sem cachimbo; pele com luz e sombra, sem caricatura)
- ✅ Chefe **Mapinguari corrompido** (um olho, boca na barriga); vencer = libertá-lo
  (a Podridão sai dele, olho verde, some na mata)
- ✅ Minichefes **Mula sem Cabeça** (no lugar do Lobo Alfa) e **Corpo-Seco** (no
  lugar do Ogro Ancião)
- ✅ Nomes revistos no tema (guardiões, chefe, minichefes, falas, guia); criaturas comuns
  seguem como "bichos tomados pela Podridão" (sem nome na tela)
- ✅ Bestiário com a origem de cada lenda (aba **Lendas** do Mural; reveladas ao
  encontrar — guardiões ao liberar, minichefes e chefe ao cruzar na floresta)
- 👤 Revisão dos textos por leitor indígena/pesquisador de folclore (ideal)

### M3 — Clareira, parte 2: horta, pesca e cozinha ✅
- ✅ **Horta** revelada após a 3ª partida: canteiros no mapa (2 → 9 com obras do
  João-de-barro), 5 plantas comuns (cenoura 5 min, milho 30 min, feijão 1 h, abóbora
  4 h, mandioca 8 h) + 3 **mágicas** (pimenta-de-brasa, flor-de-geada, erva-do-trovão)
  com **sementes raras** das partidas (minichefe, baú dourado, Mapinguari); 5 estágios
  visíveis; cuidados que aparecem sozinhos (sede, erva daninha, lagarta) — pendentes
  atrasam e custam qualidade (Comum/Prata/Ouro), **nada morre**; 1ª cenoura em 30 s
  (tutorial); valores em `GARDEN` no config
- ✅ Horta **no chão** (sem menu): o canteiro mais perto fica destacado e o botão de
  ação muda com ele (PLANTAR/REGAR/ARRANCAR MATO/TIRAR LAGARTA/COLHER); passar por
  cima do que está maduro **colhe andando**; plantar abre uma fileira de sementes no
  pé da tela (segurar = todos os vazios)
- ✅ **Celeiro**: prédio próprio ao lado da horta + botão no HUD; colheita por
  qualidade e sementes raras
- ✅ **Lago no chão** (revelado após a 1ª refeição): pesca no trapiche — lança a
  linha, espera a boia afundar, toca para fisgar e joga o minijogo de um polegar por
  cima do mundo (segurar sobe a zona verde); **7 peixes brasileiros** (lambari, cará,
  tilápia, traíra, pacu, tucunaré, dourado) com jeitos diferentes (calmo, fujão,
  saltador, arrastador) e **horário real** (traíra à noite; tucunaré e dourado de
  dia); tamanho em cm + recordes; pegada perfeita = Ouro; o lago **descansa** (poucos
  peixes, repõe 1 a cada 20 min; bolhas mostram que voltaram); obra do Lago = vara
  melhor + mais peixes; valores em `FISHING` no config
- ✅ Lago redesenhado: igarapé de contorno orgânico com faixas de profundidade,
  ilhota com açaizeiro (e seu reflexo), bica d'água caindo das pedras, vitórias-régias
  balançando, trapiche com lamparina refletida (o herói anda até a ponta), canoa,
  brilho da lua correndo na água, névoa rasteira, peixes saltando e vaga-lumes
  refletidos
- ✅ **Clareira redesenhada**: rede de trilhas de terra que saem do terreiro e se
  ramificam até cada lugar; fogueira com anel de pedras e troncos de sentar; varal
  de **bandeirinhas com luzinhas só na festa junina/julina** (1/6 a 31/7, pela data
  real — `SEASONS` no config, pronto para outras datas); **samaúma** gigante (sapopemas,
  cipós, bromélias, vaga-lumes na copa); helicônias, pedras com samambaia, rede
  listrada, espantalho e regador; capim balançando, folhas caindo, faíscas da forja,
  brilho do santuário e vinheta
- ✅ **Construções redesenhadas** (`src/art/Buildings.js`): sapê em fiadas, tábuas com
  veio, pedra assentada com musgo, barro; Santuário (altar em degraus, esteios
  entalhados, oferendas), Forja (forno com arco de pedra, telheiro, bigorna, fole,
  tina), Mural (mapa com X, lamparina), ninho de torrões, Celeiro (paiol com
  "chapéus" contra ratos, réstia de milho, escada) e Cozinha (pau-a-pique caiado,
  fogão a lenha, panelas com vapor, lenha); Horta com canteiros elevados de tábua,
  cerca de taquara e portal de bambu; `tools/art-preview.html` para ver a arte
- ✅ **Dia e noite pela hora real** do aparelho na Clareira: amanhecer rosado, dia,
  fim de tarde dourado, anoitecer roxo e noite; as luzes acendem conforme escurece
- ✅ **Cozinha** (fogão de barro ao lado da horta; revelada após a 1ª colheita):
  8 receitas da horta (Cenoura Assada, Pamonha, Tapioca, Feijão Tropeiro, Quibebe e
  3 mágicas) → pratos prontos por qualidade; **comer 1 prato = bônus só na próxima
  partida** (Ouro dá 1,7× o bônus); valores em `KITCHEN` no config
- ✅ 6 receitas com peixe (Lambari Frito, Pirão, Caldeirada, Pacu Assado, Moqueca de
  Tucunaré, Dourado na Brasa) — 14 no total
- ✅ Ordem de descobertas por progresso ([`RITMO_E_APRESENTACAO.md`](RITMO_E_APRESENTACAO.md)): Horta (3ª partida) → Cozinha (1ª colheita) → Lago (1ª refeição), uma por visita

### M4 — Hábito diário ✅
Tudo depois que o Mural aparece (uma novidade por vez). "Dia" = data local do aparelho.
- ✅ **Missões diárias** (aba MISSÕES do Mural): 3 por dia sorteadas pela data (2 da
  floresta + 1 da Clareira quando houver: abates, reações, Vapor/Cristal/Sobrecarga,
  sobreviver, baús, lanternas, vencer o Mapinguari, colher, pescar, cozinhar), prêmio
  em moedas + **bônus ao completar as três** (moedas + madeira); o fim da partida
  mostra "Missão: …" cumprida
- ✅ **Presente de dias seguidos** (7 dias; 7º = 200 moedas + 5 madeira + 2 sementes
  raras); pular um dia volta ao 1º; aparece ao chegar na Clareira
- ✅ **Baú do dia** junto à fogueira (revelado na visita depois do Mural): 1 grátis
  por dia + 2º com anúncio opcional (desligado junto com `ADS.ENABLED`)
- ✅ **Notificações locais opcionais** (`@capacitor/local-notifications`): perguntadas
  UMA vez no momento certo (abriu o baú do dia; plantou algo de 1 h+), no máximo 2
  avisos (baú de amanhã às 10h e a colheita); chave em Opções — no app, rodar
  `npm install` + `npm run android:sync` 👤
- Valores em `DAILY` no config
- ✅ **Anti-trapaça de tempo** (`src/systems/Clock.js`): tudo com tempo real lê o
  relógio confiável, que só AVANÇA pelo que dá para confirmar — com o jogo aberto,
  relógio monotônico (mudar a hora não tem efeito); entre sessões: (1) com internet,
  a hora do servidor (app: cabeçalho Date do Google, sem enviar dados; web: do
  próprio site); (2) app sem internet: plugin nativo `ElapsedClock` (tempo desde
  que o aparelho ligou, que o jogador não altera); (3) sem confirmação: **cota de
  no máximo 12 h no total** — adiantar a hora sessão após sessão não soma, e ao
  voltar a internet o excesso fica congelado. O tempo nunca volta. Estado do relógio
  dentro do save **assinado** (edição manual fica marcada em `integrity.tampered`,
  sem apagar nada). 👤 compilar o app para testar o plugin no aparelho

### M4.5 — Pré-lançamento: duração e game feel 🚧
- ✅ **Duração por Perigo**: 7 min (Aprendiz/Guardião), 8 (Veterano), 9 (Implacável),
  10 (Pesadelo) — `DIFFICULTY[].durationS`. Waves, roteiro de eventos e spawn são
  esticados por `pace = 420 / durationS` (mesma jornada, mais devagar); o chefe nasce
  no fim da duração. Em partidas longas rendem mais níveis e moedas por tempo.
- ✅ **Game feel** (`src/systems/GameFeel.js`): som de acerto com tom variável (e mais grave
  no crítico), faíscas e hit-stop curto em críticos/chefes, vinheta vermelha + tremor +
  vibração + peso ao tomar dano (golpe forte = efeito maior), vinheta pulsando com vida
  baixa, gemas de XP que sobem de tom em sequência, número de dano crítico que "pipoca",
  peso extra ao abater minichefe/mímico. Hit-stop e vinheta seguem a opção "Tremor de
  tela"; a vibração segue "Vibração". 👤 sentir no aparelho e ajustar intensidades
- ✅ **Mapa 2× maior** (área dobrada: raio 2400 → 3400 em `GAME.WORLD_RADIUS`); baús passam
  a nascer num anel ao redor do jogador (num mapa grande, posição aleatória global não seria achada)
- ✅ **Banir cartas**: tira a carta (ou as melhorias daquela arma) da partida inteira; **1 grátis por
  partida + 1 por anúncio** ("BANIR +1", `extra_banish`); só a carta banida é trocada (as outras ficam
  na mesa); evolução nunca é banível (`CARDS` no config). Trocar já existia.
- ❌ **Roleta da Samaúma — retirada em 06/10/2026.** Sorteava 1 de 8 bênçãos por anúncio e, com a Oferenda,
  deixava **comprar com moedas a bênção que quisesse** antes de cada partida. Saiu inteira (cena, `TREE`, bloco
  `tree_spin`, textos nos 6 idiomas): comprar o bônus escolhido toda partida virava obrigação e enfraquecia as
  decisões das cartas. A Samaúma continua na Clareira como cenário. Ver "Decisões tomadas"
- ✅ **Ressonância elemental**: +15% de dano por arma extra do mesmo elemento; Fogo+Gelo+Raio
  monta o **Prisma** (reações +30%). Dica na carta de arma nova (`RESONANCE` no config)
- ✅ **Armas, leva 2** ([`ARMAS_E_COMBOS.md`](ARMAS_E_COMBOS.md)): **3 armas por elemento** (eram 3 de fogo,
  2 de gelo e 1 de raio). Novas: **Vaga-lumes** (raio, teleguiados), **Granizo** (gelo, chuva em área que
  congela quem já está gelado) e **Redemoinho** (raio, funil que persegue e puxa o bando), na Forja nv 2/3/4.
  Evoluções: **Revoada** (+ Orbe), **Tempestade de Granizo** (+ Raio, faz Cristal sozinha) e **Redemoinho de
  Brasa** (+ Sopro, faz Sobrecarga sozinho); Orbe e Sopro viraram parceiras. Conquistas **Coração de Geada**
  (só gelo) e **Filho do Trovão** (só raio). Próximas fases: Laços, Catalisadores, mais Tratos
- ✅ **Efeitos das armas** (`src/systems/WeaponFX.js`): emissores de partícula reaproveitados por material
  (faísca, brasa, geada, centelha, luz de vaga-lume, lascas, folhas, fumaça, jato de fogo) e pool de clarões,
  anéis e fantasmas — nada é criado/destruído por golpe. Cada golpe tem saída (clarão na ponta do cajado/mão),
  rastro (cauda de cometa, fantasmas do bumerangue e dos orbes), impacto (quadro branco + estouro "POW" + riscos
  na direção do golpe) e morte na língua do elemento (brasa e queimado, lascas e geada, centelhas). Raio em pixel
  com galhos e piscada; Aura com anel contínuo, arcos que giram e cristais em órbita (o anel antigo era uma dúzia
  de pontos que sumia na grama); Sopro vira jato contínuo; Redemoinho redesenhado em escala inteira 3×. Inimigo
  "achata" no golpe e segura durante o hit-stop; tiques de status não piscam mais de branco. Emissivos ficam
  acima do mapa de luz (brilham à noite). Com a iluminação desligada, metade das partículas. 56–60 FPS no teste
  de carga. 👤 sentir no aparelho (S23 e um fraco)
- ✅ **Elementos e reações na pausa**: selo da cor do elemento no canto de cada arma (chama, floco, raio,
  lufada — `ELEMENT_SEAL` em `Icons.js`; a evolução que aplica dois elementos ganha dois) e uma coluna
  **REAÇÕES** com os 6 pares sempre à vista: conseguida na partida = nome na cor da reação e "×N";
  possível com o arsenal de agora = clara; sem os dois elementos = apagada. Ensina por que saiu um
  "TEMPORAL!" (Redemoinho = vento + Vaga-lumes = raio). Conferido em 16:9, celular deitado e 4:3
- ✅ **Conta das moedas no resultado**: a linha das moedas mostra "628 na floresta × 1,9 Pesadelo × 1,5
  descanso × 2 anúncio" (só os fatores que valeram). **Imposto das bênçãos 2% → 5%** (ver `META_LOOP.md`):
  bênçãos 147 mil → 269 mil moedas; armas, guardiões e obras iguais. 👤 confirmar com dados reais
- ✅ **Labareda desenhada** (`src/art/FireFX.js`): a reação fogo + vento era um punhado de brasas e um anel.
  Agora um **redemoinho de fogo** pintado quadro a quadro (12 quadros: irrompe do chão, gira com faixas em
  espiral, três arcos de vento o abraçam, a base se solta e ele se desfaz em fumaça), com chão queimado,
  anel de vento e de fogo e brasas subindo em espiral. O vento arranca **línguas de fogo** da coluna que
  voam em curva até os vizinhos e seguem o alvo; a chama **pega** (ignição desenhada, 8 quadros) quando a
  língua chega — o dano e a queimadura dos vizinhos agora caem na chegada (~0,3 s), conferindo que o inimigo
  do pool ainda é o mesmo. Sprites reaproveitados (4 redemoinhos, 16 línguas, 14 ignições); congelam no
  hit-stop. Revisar a arte: `node tools/monster-sheet.mjs saida.png fx_whirl,fx_ignite,fx_wisp 6`
- ✅ **Animação dos guardiões** (`src/art/Hero.js`): de 2 poses de caminhada (perna desliza 1 px) para
  **15 quadros desenhados por pose**: respiração em 4 tempos com cabelo/roupa chegando um quadro depois
  (arrasto), **piscada** a cada ~4 s, **caminhada em 8 tempos** (contato, desce, passa, sobe) com joelho que
  dobra, perna de trás mais escura, braço de trás balançando, tronco inclinado e cabelo/chamas/gorro
  esvoaçando para trás; **pose de dash** (passada longa, olhar focado) e **pose de golpe** (olhos fechados,
  corpo para trás). Ciclos próprios: Saci **pula** numa perna (agacha, voa, amortece), Iara e Mãe-do-Ouro
  **deslizam** flutuando (nadadeira batendo, barra de ouro cintilando), Anhangá anda **em 4 tempos** como
  veado (cabeça acenando, rabo e orelha mexendo). No jogo: o passo acompanha a velocidade real, ao parar o
  corpo "assenta" em vez de estalar, e as pisadas soltam poeira (Curupira chuta para a frente — pés virados;
  Saci levanta vento ao cair; quem flutua solta gota/brilho), com pool de 6 imagens. Sem girar/esticar sprite
- ✅ **Revisão das telas (HUD e painéis)**: as listas roláveis vazavam por cima do título e da borda de TODOS
  os painéis (no Phaser 4/WebGL `setMask` não recorta) — agora a lista é desenhada numa RenderTexture do tamanho
  da janela; painéis com lista curta encolhem até o conteúdo (Obras, Celeiro, Perigo, Créditos); roleta da
  Samaúma sem rótulo de cabeça para baixo; Mural não abre aba inexistente. Na partida: nome do chefe abaixo do
  relógio (encavalava), dicas sempre abaixo da barra do chefe e em fila (uma por vez), seta do santuário fora
  da faixa do HUD, título do nível numa placa própria, conteúdo das cartas centralizado, "Você caiu" com painel.
  Conferido em 1911×1002 e 844×390 (celular)
- ✅ **Equilíbrio das reações e armas** (medido num laboratório: partidas simuladas de 50 s no meio da partida,
  semente fixa, dano atribuído por fonte). Problemas: Cristal só acontecia com a Aura (exigia CONGELADO; Orbe e
  Granizo + Raio davam 0 cristais) e o Vapor dominava (Aura põe gelo no bando todo; nuvens se empilhavam; chegava
  a 2/3 do dano). Agora: **gelo + raio = Cristal** como as outras reações (congelado = estilhaço 1,8× e maior);
  nuvens de Vapor não se empilham (renovam a vizinha); **fôlego de 0,9 s por inimigo** depois de reagir; o
  elemento que chega reage com o mais antigo. Valores por disparo aproximados (Sobrecarga 6→4 saltos, Cristal
  20 de dano + 14 no alvo, Vapor 4/tique). Armas: Cajado 7→10, Raio 15→20 (alvo único rende no chefe),
  Bumerangue 4→3, Redemoinho 3→2 por tique. Resultado: duplas entre 37 e 58 de dano/s (antes 29–74), reação =
  41–55% do dano, e com três elementos as três reações aparecem. Debug G agora protege de todo dano
- ✅ **Cajado com alcance menor** (280 → 210; Tempestade de Vapor 300 → 240) e a bola de fogo some logo depois
  do alcance (voava 600 px). Listas dos painéis redesenhadas só quando mudam (Forja aberta: 1,6 → 0,7 ms/quadro)
- ✅ **Revisão das telas, rodada 2**: resultado da partida com altura calculada (com Madeira + Sementes a
  5ª linha caía sobre as armas); Pausa com armas e passivas no mesmo padrão (ícone, nome, nível); custo do
  Trato acima do selo da tecla; escolha da Noite Eterna com painel; ícone próprio em cada missão; título da
  barra de sementes em uma linha. **Controles:** teclas de movimento lidas na janela (segurar D durante as
  cartas/pausa não "perde" mais a tecla); dash e Despertar no celular pelo toque nativo (funcionam andando,
  mesmo se o Phaser perder um "soltar dedo")
- ✅ **Economia rebalanceada por simulação** (ver `META_LOOP.md`, "Economia 2026-10"): a loja inteira
  acabava em 4–8 dias; agora 20 / 35 / 59 dias (hardcore / médio / casual, 30 min por dia), sem o jogador
  ficar muitas partidas sem comprar. Início igual; armas, guardiões e obras mais caros; **bênçãos com 10
  ranks** (metade do efeito, mesmo máximo) e **imposto de coleção** de 2%; recompensa dos Perigos achatada
  + **prêmio da 1ª vitória**; hábito diário ×2 e **bônus de descanso** (2 primeiras partidas do dia +50%).
  Save v4 dobra os ranks antigos (ninguém perde poder). Tela de resultado com linha própria do prêmio.
  👤 conferir no aparelho e, com testadores, comparar `run_end` com a simulação
- ✅ **Feitos da Forja** (desbloqueio por desafio, como no Megabonk; `META.WEAPON_DEED`): além de moedas e
  do nível da Forja, Vaga-lumes pede 1.500 abates, Orbe 60 Vapores, Granizo 40 Cristais, Sopro Flamejante
  vencer no Perigo Guardião ou acima e Redemoinho 60 Sobrecargas (acumulados entre partidas). A Forja mostra
  o feito e o progresso; o fim da partida avisa quando um feito é cumprido. Os feitos ensinam as reações
- ✅ **Golpes especiais dos chefes** ([`CHEFES.md`](CHEFES.md)): Mula sem Cabeça (Galope em Chamas com rastro
  de fogo, Coice, Chuva de Brasas), Corpo-Seco (A Seca, A Terra o Rejeita, Cipós da Podridão) e Mapinguari
  (Bocarra da Barriga, Grito com brecha, Olhar da Podridão na fúria, mais Baque, Raízes, Investida, Leque).
  Regras de justiça: aviso com forma própria e no mesmo relógio do golpe, acima do mapa de luz; tudo se
  desvia só andando (raízes não prendem mais quem não tem Dash); a área desenhada é a que fere; um golpe
  por vez. Recompensa: **ponto fraco** depois dos golpes grandes (+50%, número dourado; a Bocarra aberta
  +70%), "DESVIOU!" enche o Despertar, **desviou de tudo** = +1 Madeira (minichefe) / +2 (Mapinguari).
  Arte nova (Mula empinada e no coice, Corpo-Seco de braços erguidos, Mapinguari de bocarra e gritando),
  13 sons novos, nome do golpe sob a barra. Verificado com um robô que só anda e reage em 250 ms: 0 acertos
  em 73 casos; parado, os golpes acertam. Debug: M = Mula, C = Corpo-Seco. 👤 sentir no aparelho
- ✅ **Bioma 2: Caatinga** (ver `BIOMAS.md`): vencer o Mapinguari revela a **Trilha do Sertão**
  (obra do João-de-barro); a placa da trilha passa a escolher **mapa + Perigo**. Cenário do sertão
  por código, calango/carcará/cabeça-de-frade, **redemoinhos de poeira** (empurram e deixam ventado),
  chefe **Caboclo d'Água** com 5 golpes de água e as **carrancas** (atraia o Arrastão para uma: ele
  se espanta e fica exposto), baião e xaxado no Synth, 2 conquistas. Framework: ficha `BIOMES`,
  `registerBoss`, `npm run check` confere biomas. Robô justo: 0 acertos em 101 casos
- ✅ **Caatinga, parte 2 — o sertão na Clareira e na partida**: minichefe **Cabra Cabriola** (golpes da
  Mula), **candeeiros de barro** no lugar das lanternas, sementes de **umbu** e **caju** (só da Caatinga),
  peixes do **São Francisco** no Lago depois de libertar o Caboclo (curimatã, piau, surubim) e 5 pratos
  (Umbuzada, Cajuína, Curimatã Assada, Piau Frito, Surubim com Caju). `npm run check` confere a arte
  de toda planta, peixe e prato
- ✅ **Iluminação de volta**: desde a migração para o Phaser 4 o mapa de luz não aparecia (a
  RenderTexture só executa o desenho com `render()`). Corrigido, com ambiente mais claro que o
  original (o jogo foi equilibrado "aceso"): entardecer → noite → chefe, legível no celular.
  A opção "Iluminação" e o desligamento automático em aparelho fraco seguem valendo
- ✅ **Vento, o 4º elemento** (ver `ARMAS_E_COMBOS.md`): status "ventado" (arrasta para longe), reações
  **Labareda** (fogo+vento), **Geada** (gelo+vento) e **Temporal** (raio+vento); Prisma com 3 dos 4 elementos;
  Redemoinho vira vento (o Saci é o guardião do vento); armas novas **Assobio da Mata**, **Folhas ao Vento** e
  **Cata-vento**; evoluções **Vento Sul**, **Ventania** e **Cata-vento de Brasa**; 3 laços e 4 conquistas
- ✅ **Framework de conteúdo** (`docs/CONTEUDO.md`): cada arma tem UMA ficha em `WEAPONS` (números, texto,
  ícone, melhorias, desbloqueio com feito) e cada guardião uma ficha em `CHARACTERS` (arma, viés, desbloqueio,
  bestiário); Forja, Fogueira, cartas, ícones e bestiário leem delas (as tabelas antigas viraram derivadas).
  Laços por **eventos** (`src/systems/Links.js`); evolução faz reação com `also`; `registerWeapon()`;
  verificador `npm run check` (ficha incompleta, parceira inexistente, laço com evento que ninguém emite,
  guardião sem arte...)
- ✅ **Leva 3** ([`ARMAS_E_COMBOS.md`](ARMAS_E_COMBOS.md)): **5 armas de fogo e de gelo, 4 de raio e de vento** (nas cartas cada elemento sai 25%; ver `ARMAS_E_COMBOS.md`) — Açoite de Urtiga,
  Fogueira de São João, Miragem, Boleadeira, Bola de Ouro, Tambor do Trovão (verbos novos: corpo a corpo,
  armadilha, isca, amarrar, ricochete, onda); **6 evoluções em ciclo** que fazem reação sozinhas; **10 laços**
  de dupla (aviso, pausa e carta); **3 guardiões** — Comadre Fulozinha, Mãe-do-Ouro e Anhangá (o veado
  branco, com poses de queda próprias) — liberados na Fogueira nv 4 com **feito** (minichefes, baús, "desviou
  de tudo") + moedas. Medido no laboratório (dentro da faixa das antigas). Elemento novo: analisado e
  **adiado** (ver a análise no doc). 👤 sentir no aparelho; rever preços com a simulação de economia
- ✅ **Lendas × armas** (pesquisa de lore em `TEMA_FOLCLORE.md`): **Saci começa com o Redemoinho** (era o
  Raio; a lenda e a própria arte dele são o redemoinho), o **Bumerangue virou a Vara Encantada** da Caipora
  (bumerangue é australiano; a lenda dá a ela uma vara) com arte nova na mão, no voo e no ícone, a evolução
  **Fênix virou Boitatá** (a cobra de fogo) e o **Curupira deixa pegadas viradas para trás** no Dash.
  Curupira (Cajado de fogo) e Iara (Aura de águas frias) já batiam com a lenda
- ✅ **Tratos da Mata**: às vezes uma carta é um trato — poder grande com custo visível (ex.:
  +37% dano / −23% vida máxima). Do nível 3, até 3 por partida, cada um uma vez (`PACTS`)
- ✅ **Santuários da Floresta** no mapa (`ShrineSystem`, `SHRINE`): **Carga** (fique perto 3 s:
  +25% dano e +15% velocidade por 40 s), **Ganância** (60 s de mais drops e +35% inimigos),
  **Desafio** (elites; vencer dá baú dourado). Seta na borda da tela aponta o mais próximo.
  👤 testar o ritmo e a distância no aparelho
- ✅ **Primeira queda** (`FirstDefeatScene`): um curta em 2 planos, pulável e só na 1ª vez
  (`firstDefeatSeen` no save; quem já jogou não vê). **A queda:** floresta corrompida, 3 lobos,
  golpe com hit-stop, câmera lenta, baque com poeira e escuro com zumbido. **A Clareira:** título,
  foco volta (desfoque + bloom), a Anciã chega com a lamparina e o guardião acorda; depois ela
  explica o jogo (falas com os números reais da partida). Na 1ª vitória, versão de festa.
  Usa câmera própria para a interface, faixas de cinema, grão, pós-processamento (só WebGL e fora
  de aparelho fraco) e sons novos (batimento, golpe, baque, zumbido, fogueira, passos).
- ✅ **Queda curta nas mortes seguintes**: da 2ª derrota em diante só a queda do herói (~4 s,
  toque pula) e logo a tela de resultados. A 1ª derrota segue o curta completo e vai para a Clareira.
- ✅ **Animação dos guardiões** (`src/art/HeroRig.js`): queda, deitado respirando e acordar são
  QUADROS DESENHADOS (esqueleto de quadril/tronco/cabeça/braços/pernas + figurino de cada lenda),
  não o sprite de caminhada girado. Revisar as poses: `node tools/hero-sheet.mjs saida.png <id>`
- ✅ **Chefe com luta de verdade** (ver `CHEFES.md`): **Couraça da Podridão** (acima de um ritmo de dano o
  chefe resiste ao excesso; build forte: de ~7 s para ~30 s, build média ~50 s), a **horda não some** quando
  ele nasce (somem só os de tiro, minichefes e o excesso; ficam 8) e a mira prefere o chefe. Correções: tela
  de **vitória** sem texto encavalado com a fonte Legível/texto grande (rótulo de botão sempre cabe na
  moldura) e **pesca** que não confunde o polegar no joystick com "segurar". 👤 sentir no aparelho

- ✅ **Couraça do chefe revista (05/10/2026)** (ver `CHEFES.md`): era invisível (a tela mostrava o golpe
  cheio e o chefe perdia bem menos) e forte demais (build 8× mais forte vencia só 1,7× mais rápido). Agora
  o número mostra o dano real (cinza quando a couraça segura; dourado no ponto fraco), anel e lascas da
  Podridão e uma dica que ensina o ponto fraco; KEEP 0,25 → 0,45 (300 dano/s: ~35 s → ~17 s; build
  fraca não muda). 👤 sentir no aparelho

### M5 — Monetização e medição reais 👤
- ✅ AdMob: app Android criado e **7 blocos premiados** em uso (revive, extra_card, build_speed,
  double_coins, daily_chest, extra_reroll, extra_banish; o `tree_spin` da roleta saiu do jogo em 06/10/2026 —
  👤 arquivar o bloco no console do AdMob) + 1 intersticial pronto e desligado; IDs em `ADMOB` no `src/config.js`
- ✅ Mensagem de consentimento europeia (GDPR) **publicada** no AdMob (app selecionado, URL da
  política, botão "Não consentir" ligado). Falta dar push da `docs/PRIVACY.md` atualizada (a
  mensagem aponta para ela) e, no app, integrar o SDK da UMP no M5
- ✅ `app-ads.txt` no ar em https://lopesleo.github.io/app-ads.txt (repo `lopesleo.github.io`, `public/`)
- 👤 Falta: **criar a conta de desenvolvedor da Play Console** (taxa única + verificação de identidade) e
  cadastrar `https://lopesleo.github.io` como site do desenvolvedor; ligar o app à loja no AdMob;
  informações fiscais (CPF e W-8BEN) e forma de pagamento no AdMob; conta do Firebase
- ✅ AdMob + consentimento (UMP) plugados (`src/systems/AdMobBridge.js`): consentimento → SDK → anúncios
  premiados em todos os pontos; na Europa o uso de dados (Firebase) começa desligado; sem consentimento ou sem
  AdMob pronto o app NÃO oferece anúncio. `ADS.TESTING = true` usa anúncios de TESTE do Google:
  **trocar para false só no build de loja**. `ADS.TEST_EEA = true` simula a Europa para ver o formulário
- ✅ App de teste compilado e `npm run android:install` (compila, instala via adb e abre). Ambiente neste
  PC: Node 22, Java 21 em `C:\Program Files\Microsoft\jdk-21.*` (o script acha sozinho), Android SDK em
  `%LOCALAPPDATA%\Android\Sdk`.
- ✅ **Capacitor 8.5** (era 6): alvo **Android 16 (API 36)**, exigido pela Play para apps novos; mínimo Android 7
  (API 24); Gradle 8.14.3, AGP 8.13, Java 21; plugins na v8. No app o cenário vai até a borda (por baixo do furo
  da câmera). Validado no S23 Ultra em 02/10/2026 (AdMob, consentimento, Firebase, vibração e ElapsedClock ok)
- ✅ **Validado no aparelho (S23 Ultra, 01/10/2026):** consentimento "não necessário" no Brasil, SDK iniciado,
  anúncio premiado de TESTE carregado → exibido → recompensa → fechado → 4ª carta liberada; eventos
  `ad_offer_show/accept/ad_reward` enviados ao Firebase. Com bloqueador de anúncios (ex.: DNS privado
  AdGuard) o anúncio não carrega e o jogo avisa "Anúncio indisponível agora" (sem bônus grátis).
  👤 Falta: ver o formulário europeu (`ADS.TEST_EEA = true` **e** o código do celular em
  `ADS.TEST_DEVICE_IDS`, que aparece no logcat — sem ele o Google ignora a simulação num aparelho de
  verdade) e conferir os eventos no painel do Firebase
- ✅ **Retorno dos anúncios (05/10/2026):** "Carregando anúncio…" com roda de espera enquanto o vídeo vem;
  aviso quando não vem (sem rede, sem anúncio, 12 s sem carregar) ou quando o jogador fecha antes do fim
  ("Assista até o fim…"); o Reviver diz o motivo certo e congela a contagem durante a espera. Se o AdMob
  falhar na abertura (sem internet), tenta de novo ao voltar ao app. Em Opções, **"Consentimento de
  anúncios" agora abre as opções de privacidade do Google** (antes apagava a escolha e não abria nada):
  só existe onde há mensagem publicada (Europa); no Brasil o botão fica apagado com "Não é exigido na sua
  região". Teste no navegador: `?debug=1&adsim=fail` ou `&adsim=cancel`. Evento novo: `ad_fail`
- ✅ **Medição para o teste fechado (05/10/2026):** `run_start`/`run_end` com `run_n` (nº da partida: funil da
  1ª sessão) e `shop_buy` em toda compra (arma, bênção, dom, guardião, Tesouro, obra). Economia simulada de
  novo com o catálogo atual: 63 / 37 / 22 dias (casual / médio / hardcore), sem buracos de compra; ver
  `META_LOOP.md`
- ⬜ Compra "Remover anúncios"
- ✅ Firebase Analytics + Crashlytics plugados (`src/systems/Telemetry.js`, plugins `@capacitor-firebase/*`):
  projeto `guardiao-da-floresta` (plano Spark, grátis), app Android `com.lopesleo.guardiao`, GA4 em conta
  própria (local Brasil). Coleta desligada no manifesto e ligada pelo jogo; opção "Dados de uso e erros"
  em Opções; erros de JS viram não fatais no Crashlytics. `android/app/google-services.json` fica fora do
  git. 👤 **Falta testar no aparelho** (compilar no Android Studio e olhar o DebugView do Firebase) e,
  antes de publicar, ligar o consentimento (UMP) para o EEE chamando `Telemetry.setEnabled(false)` em quem
  recusar; vincular o app do AdMob ao Firebase quando o app estiver na loja
- ⬜ Política de privacidade e Segurança dos dados atualizadas

### Pendências suas, adiadas (anotadas em 01/10/2026) 👤
Nada disso trava o desenvolvimento; só o lançamento e a receita.
- **Conta de desenvolvedor pessoal na Play Console**: tipo "Você", taxa única de ~US$ 25, documento
  com foto e confirmação do aparelho. Depois: cadastrar `https://lopesleo.github.io` como site do
  desenvolvedor e ligar o app à loja no AdMob ("Adicionar loja"). Atenção: o endereço pode ficar
  público (compra "Remover anúncios" = desenvolvedor comercial) e contas pessoais novas exigem
  **teste fechado** (a regra recente: 12 testadores por 14 dias) antes da produção
- **AdMob → Pagamentos**: informações fiscais do Brasil (CPF) e dos EUA (W-8BEN); a forma de
  pagamento (conta bancária) só aparece quando os ganhos começam; pagamento mensal a partir de US$ 100
- **Push do repositório do jogo** para a `docs/PRIVACY.md` atualizada ir ao ar (a mensagem de
  consentimento do AdMob aponta para ela)

### M6 — Loja e lançamento 👤
- ⬜ Capturas de tela + imagem de destaque (geradas do jogo) + vídeo de 30 s
- ✅ **Idiomas: inglês, espanhol, japonês e chinês simplificado** (ver `IDIOMAS.md`): 933 textos por
  idioma, idioma do aparelho na 1ª abertura (sem suporte = inglês) e seletor em Opções → Jogo; fichas do
  `config.js` traduzidas por campo; Fusion Pixel (OFL) recortada para japonês/chinês com quebra por caractere;
  nome do app no Android por idioma; `npm run check` aponta texto sem tradução e fonte desatualizada. Painéis,
  listas, cartas e falas passam a caber com textos longos. 👤 revisão por falantes nativos (ja/zh antes de tudo)
- ✅ **Chinês tradicional (05/10/2026):** 6º idioma (`zht`, 繁體中文) para Taiwan, Hong Kong, Macau e `zh-Hant`,
  convertido do simplificado (OpenCC, padrão de Taiwan) e revisado; fonte com o desenho de Taiwan; nome do
  app 森林守護者 (`values-b+zh+Hant`); ficha da loja. **"Idioma do app" do Android 13+** (`locales_config.xml`);
  trocar o idioma do aparelho depois de escolher no jogo faz o jogo voltar a seguir o aparelho.
  👤 Falta conferir no celular a tela "Idioma do app" (Configurações → Apps → Guardião → Idioma)
- 👤 Testes em aparelho forte e fraco + playtest com 5–10 pessoas
- 👤 `.aab` assinado, classificação IARC, **teste fechado** exigido pelo Play Console
- ⬜ Ajustes pelos números de D1/D3/D7 → **produção**

---

## Decisões tomadas
- **Tema folclore brasileiro: SIM** (29/09/2026), como camada respeitosa — as
  lendas são guardiãs e aliadas; o vilão é a Podridão. Ver
  [`TEMA_FOLCLORE.md`](TEMA_FOLCLORE.md).
- **Sem roleta de bênçãos** (06/10/2026): nada de sortear nem comprar o bônus da próxima partida na
  Clareira. Escolher e pagar pelo buff que quiser antes de toda partida virava rotina obrigatória e tirava
  peso das cartas de nível. Bônus de uma partida vêm das refeições (feitas pelo jogador).

## Depois do lançamento (atualizações)
| Ordem | Atualização |
|---|---|
| 1 | **Bichos** (resgate, ajuda nas atividades, tigela de presentes, companheiro na partida) |
| 2 | Bestiário + Árvore Sagrada + skins |
| 3 | **Desafio Diário** com placar (Play Games) + desafios com modificadores |
| 4 | Santuários da Floresta no mapa + missões que desbloqueiam |
| 5 | **Bioma 2** com chefe próprio |
| 6 | Mutações/híbridos na horta, novos pontos de pesca, estações Cheia/Vazante |
| 7 | Relíquias + Sementes Ancestrais; eventos temáticos; temporada com passe |
| 8 | **Coop de 2 jogadores** com servidor Nakama (Oracle Cloud) — ver abaixo |

## Coop online (ideia aprovada em 01/10/2026, depois do lançamento)
- **Escopo:** 2 jogadores, entrada por **código de convite**, sem matchmaking com desconhecidos. 4 jogadores
  só se o desempenho permitir (o gargalo é o celular do anfitrião, não a rede).
- **Arquitetura:** o **anfitrião simula** o jogo; o **Nakama** (Oracle Cloud Always Free) só retransmite
  as mensagens (partida em relay). Dificuldade escala pela **vida/dano dos inimigos**, não pela quantidade
  (teto de inimigos vivos continua baixo). Reações elementais entre jogadores = a sinergia que vende o modo.
- **Cartas de nível:** escolha simultânea com tempo limite (não dá para pausar o outro jogador).
- **Pré-requisitos no código (melhoram o jogo solo também):** separar simulação e desenho no `GameScene`
  (~1.500 linhas), gerador de números aleatórios com semente (hoje há `Math.random()` por toda parte) e
  suporte a uma **lista de heróis** em vez de um só.
- **Antes de investir:** protótipo de viabilidade em branch (Nakama local em Docker + dois navegadores com
  um herói sincronizado) para sentir o atraso.
- **Impacto de privacidade:** o jogo passa a ter identificador e dados de partida em servidor próprio;
  atualizar a política, o consentimento e o formulário de segurança de dados da Play.
- **Em aberto:** região da instância Oracle (latência para o Brasil), e o que acontece se o servidor cair
  (o solo precisa continuar funcionando offline).
