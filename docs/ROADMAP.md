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
- ✅ **Dobrar o baú** ao abrir (via `AdService`)
- ✅ **Dobrar moedas** no fim da partida (via `AdService`)
- ℹ️ Ofertas de anúncio prontas, mas **desligadas** (`ADS.ENABLED = false` em
  `src/config.js`); para testar, abrir com `?ads=1`. Ligar junto com o AdMob (M5).
- ✅ **Modo Infinito** (Noite Eterna) depois de vencer o Ancião: inimigos +25% vida
  e +12% dano por minuto (composto), eventos em ciclo, +15 moedas/min, recorde

### M2 — Clareira, parte 1: o acampamento ⬜
- ⬜ Cena do acampamento **substitui o menu** (Fogueira = JOGAR)
- ⬜ Construções com níveis: Fogueira, Santuário (Bênçãos), Forja (Arsenal), Mural
- ⬜ **Obras com tempo** + 1º João-de-barro; partidas adiantam as obras
- ⬜ **Madeira Ancestral** caindo nas partidas
- ⬜ Clareira começa **em ruínas** e é revelada por progresso; guia **Anciã da Fogueira**

### M3 — Clareira, parte 2: horta, pesca e cozinha ⬜
- ⬜ Horta (estágios, rega, ervas daninhas, pragas, qualidade; nunca morre)
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

## Decisões pendentes 👤
- **Tema folclore brasileiro** (Curupira, Iara, Saci…) — decidir **antes do M2**,
  porque muda personagens, guia e nomes na Clareira. Até lá, os sistemas são
  feitos independentes do tema.

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
