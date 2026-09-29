# Pré-lançamento — o que implementar antes de publicar (modelo gratuito + anúncios)

Decisão de negócio: **jogo gratuito, receita com anúncios** (+ compra opcional
"Remover anúncios"). Partidas de ~7 min estão ótimas para celular; o que precisa
crescer é o **motivo para voltar todo dia** — no modelo com anúncios a receita
vem de sessões repetidas por semanas, não de uma compra única.

Legenda — **Esforço:** P (horas) · M (1–2 dias) · G (3+ dias) ·
**Quem:** 🤖 dá pra eu implementar · 👤 depende de você (conta, aparelho, pessoas)

---

## 1. Monetização (obrigatório pro modelo gratuito)

| # | Item | Esforço | Quem |
|---|---|---|---|
| 1.1 | **AdMob no app Android** (`@capacitor-community/admob`) com camada `AdService` — no navegador vira "no-op" (site sem anúncios) | M | 🤖 + 👤 (criar conta AdMob e IDs de bloco) |
| 1.2 | **Consentimento LGPD/GDPR** (formulário UMP do Google) na 1ª abertura | P | 🤖 |
| 1.3 | Anúncio premiado **Reviver** (1× por partida, na tela de morte) | P | 🤖 |
| 1.4 | Anúncio premiado **Dobrar moedas** no fim da partida | P | 🤖 |
| 1.5 | Anúncio premiado **Troca extra de cartas** no level-up | P | 🤖 |
| 1.6 | **Baú diário** no menu (grátis 1×/dia; 2º baú com anúncio) | P | 🤖 |
| 1.7 | **Tela cheia (interstitial)** só no fim de partida, nunca antes da 3ª partida, no máx. 1 a cada 3 partidas / 3 min | P | 🤖 |
| 1.8 | **Compra "Remover anúncios"** (R$ ~9,90): tira os de tela cheia e dá os prêmios sem assistir | M | 🤖 + 👤 (perfil de pagamentos no Play Console) |
| 1.9 | Política de privacidade e **Segurança dos dados** atualizadas (ID de publicidade, SDK do AdMob) + permissão `AD_ID` | P | 🤖 texto · 👤 formulário |
| 1.10 | Público-alvo **13+** no Play Console (evita as regras de "Famílias", que limitam anúncios) | P | 👤 |

> Referência de mercado: estúdios com 3+ pontos de anúncio premiado faturam ~2,4×
> mais por usuário que os com 1 só; a recompensa deve ser explícita ("assista e
> ganhe 120 moedas") e o anúncio nunca aparece durante a ação.

## 2. Retenção (motivos para voltar amanhã)

| # | Item | Esforço | Quem |
|---|---|---|---|
| 2.1 | **Missões diárias** (3/dia: "abata 300", "dispare 20 Vapores", "vença no Guardião"…) + bônus ao completar todas | M | 🤖 |
| 2.2 | **Recompensa de login consecutivo** (7 dias, prêmio maior no 7º; um personagem ou skin no ciclo) | P | 🤖 |
| 2.3 | **Modo Infinito** após vencer o Ancião ("continuar?") — ondas crescentes até morrer, recorde próprio | P | 🤖 |
| 2.4 | **Nível de conta** (XP acumulado de todas as partidas → recompensas a cada nível) | P | 🤖 |
| 2.5 | **Notificação local** opcional ("seu baú diário está pronto") | P | 🤖 |

## 3. Medição (sem isso não dá pra saber se está funcionando)

| # | Item | Esforço | Quem |
|---|---|---|---|
| 3.1 | **Firebase Analytics**: eventos `run_start/run_end` (tempo, nível, causa), `level_up`, `ad_offer/ad_watch`, `purchase`, `mission_done` | M | 🤖 + 👤 (projeto Firebase) |
| 3.2 | **Crashlytics** (ou captura de erros JS enviada ao Firebase) | P | 🤖 + 👤 |
| 3.3 | Metas de retenção para acompanhar: **D1 ≥ 30%, D7 ≥ 8%, D30 ≥ 2%** (média de jogos de ação comerciais) | — | — |

## 4. Qualidade e dispositivos

| # | Item | Esforço | Quem |
|---|---|---|---|
| 4.1 | **Teste em aparelhos reais** — 1 top (S23) e 1 fraco (2–3 GB RAM, Android 9/10): FPS, toque, som, voltar, minimizar, rotação | M | 👤 (eu preparo o roteiro) |
| 4.2 | **Qualidade gráfica automática** (Alta/Baixa): em aparelho fraco desliga iluminação e reduz partículas | P | 🤖 |
| 4.3 | Música pausa quando o app vai pro fundo | P | 🤖 |
| 4.4 | **Versão do save** + migração (proteger progresso nas atualizações) | P | 🤖 |
| 4.5 | **Playtest com 5–10 pessoas** (anotar onde travaram / enjoaram) | — | 👤 |

## 5. Loja

| # | Item | Esforço | Quem |
|---|---|---|---|
| 5.1 | **Capturas de tela** (6–8, 16:9) e **imagem de destaque 1024×500** — gero automaticamente do próprio jogo | P | 🤖 |
| 5.2 | **Vídeo de 30s** (opcional, aumenta instalação) — gravação automatizada de uma partida | M | 🤖 |
| 5.3 | Textos da loja em PT-BR (prontos em `PLAY_STORE.md`) + **inglês** | P | 🤖 |
| 5.4 | Questionário de classificação IARC | P | 👤 |
| 5.5 | Gerar `.aab` assinado e guardar a keystore | P | 👤 |

## 6. Alcance

| # | Item | Esforço | Quem |
|---|---|---|---|
| 6.1 | **Tradução para inglês** (e opcionalmente espanhol) com seletor de idioma | M | 🤖 |

---

## Ordem sugerida

1. **Semana 1 — núcleo gratuito:** 1.1–1.7, 2.1–2.3, 3.1–3.2, 4.2–4.4
2. **Semana 2 — polimento e loja:** 1.8–1.9, 2.4–2.5, 5.1–5.3, 6.1
3. **Você:** contas (AdMob, Firebase, Play Console), teste em aparelhos (4.1), playtest (4.5), `.aab` (5.5)
4. **Lançamento em teste fechado** (Play Console exige testadores antes da produção em contas novas) → ajustar pelos números de D1/D7 → produção.

Ideias para depois do lançamento (manter o jogo ativo por meses): ver
[`IDEIAS_RETENCAO.md`](IDEIAS_RETENCAO.md).
