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
- ⬜ Game feel (impacto, tremor, hit-stop, números de dano)
- ⬜ Primeira derrota: a personagem desmaia e a Anciã acorda e explica tudo
  (curta, pulável, só na 1ª vez; flag no save)

### M5 — Monetização e medição reais 👤
- 👤 Contas: AdMob, Firebase, perfil de pagamentos no Play Console
- ⬜ AdMob + consentimento LGPD (UMP) plugados no `AdService`
- ⬜ Compra "Remover anúncios"
- ⬜ Firebase Analytics + Crashlytics plugados no `Analytics`
- ⬜ Política de privacidade e Segurança dos dados atualizadas

### M6 — Loja e lançamento 👤
- ⬜ Capturas de tela + imagem de destaque (geradas do jogo) + vídeo de 30 s
- ⬜ Tradução para inglês
- 👤 Testes em aparelho forte e fraco + playtest com 5–10 pessoas
- 👤 `.aab` assinado, classificação IARC, **teste fechado** exigido pelo Play Console
- ⬜ Ajustes pelos números de D1/D3/D7 → **produção**

---

## Decisões tomadas
- **Tema folclore brasileiro: SIM** (29/09/2026), como camada respeitosa — as
  lendas são guardiãs e aliadas; o vilão é a Podridão. Ver
  [`TEMA_FOLCLORE.md`](TEMA_FOLCLORE.md).

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
