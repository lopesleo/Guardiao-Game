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

### M3 — Clareira, parte 2: horta, pesca e cozinha 🚧
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
- ⬜ Lago + minigame de um polegar + 7 peixes + varas + horário real
- ⬜ Cozinha (8 receitas peixe + horta) + **buff de 1 partida**
- ⬜ Ordem de descobertas por progresso ([`RITMO_E_APRESENTACAO.md`](RITMO_E_APRESENTACAO.md))

### M4 — Hábito diário ⬜
- ⬜ Missões diárias (3/dia) + bônus ao completar todas
- ⬜ Recompensa por dias seguidos (7 dias)
- ⬜ Baú diário (grátis + 2º com anúncio)
- ⬜ Notificações locais opcionais (pedidas no momento certo)

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
