# Ideias para manter o jogo ativo por mais tempo (pós-lançamento)

Pesquisa (set/2026) sobre o que os jogos do gênero fazem para segurar jogadores por
meses — *Vampire Survivors*, *Survivor.io*, *Brotato*, *Dead Cells* — adaptada ao
Guardião da Floresta. Cada ideia indica **impacto na retenção**, **esforço** e
se **gera receita** no modelo com anúncios.

## O que o mercado mostra

- **Survivor.io** (~US$ 5 mi/mês, 3 anos após o lançamento) aposta em **hábito
  diário**: até 10 missões por dia com bônus ao completar 2, 5 e 10; baús diários
  com anúncio; renda passiva para coletar; eventos por tempo limitado.
- **Vampire Survivors** vive de **atualizações gratuitas frequentes**: cada uma traz
  fase desafio, conquistas, skins e **Arcanas** (cartas que mudam as regras). As
  **Relíquias** desbloqueiam sistemas inteiros (modo infinito, modo inverso,
  mercador…) — o jogador sempre tem "o próximo segredo" para buscar.
- **Brotato**: **Modo Infinito** e **Desafios** com modificadores de dificuldade.
- **Dead Cells**: **Corrida Diária** com a mesma semente para todos e **placar** —
  barata de manter e ótima para trazer o jogador de volta todo dia.
- Retenção de referência para jogos de ação comerciais: **D1 ~30%, D7 ~8%, D30 ~2%**.

---

## Ideias priorizadas

### 🥇 Alto impacto, esforço baixo/médio

| Ideia | Como seria no Guardião | Esforço | Receita |
|---|---|---|---|
| **Desafio Diário** | Mesma semente para todos (mapa, sorteio de cartas, eventos), personagem e arma sorteados, 1 modificador ("sem cura", "inimigos 2× rápidos"). Placar via **Google Play Games** (sem servidor próprio) | M (exige gerador aleatório com semente) | Anúncio: tentativa extra |
| **Árvore Sagrada (renda offline)** | Uma árvore no menu gera moedas/sementes enquanto você está fora (limite de 8h). "Assista para dobrar a colheita" | P | Anúncio premiado diário |
| **Maestria de arma e personagem** | Usar uma arma/personagem sobe seu nível de maestria → cosméticos (brilho do orbe, cor do manto) e pequenos bônus | M | — |
| **Bestiário / Coleção** | Enciclopédia de inimigos, armas, reações e evoluções com contagem de abates e "???" para o que falta descobrir | P | — |
| **Skins cosméticas** | Variações de cor dos heróis (já temos o sistema de paletas em `src/art/Hero.js`) — prêmio de conquistas, passe e loja | P por skin | IAP opcional |

### 🥈 Profundidade (o que segura por meses)

| Ideia | Como seria no Guardião | Esforço |
|---|---|---|
| **Relíquias da Floresta** | Itens raros achados em baús especiais de partida que liberam **sistemas**: Modo Invertido, Mercador na partida, Arcanas, Modo Maldito. Sempre há um segredo a buscar | M |
| **Arcanas / Sementes Ancestrais** | Antes da partida, escolhe 1 carta que muda uma regra ("reações acontecem com 1 elemento só no chefe", "gelo cura", "cada nível dá 2 cartas mas inimigos +30%") | M |
| **Desafios com modificadores** | Lista de desafios fixos ("vença só com gelo", "sem dash", "chefe em 5:00") com recompensas únicas | P |
| **Novos cenários (biomas)** | Pântano Corrompido, Montanha Gelada, Floresta em Chamas — cada um com paleta, inimigos recoloridos + 2 novos, eventos e **chefe próprio**. É a atualização que mais traz jogador de volta | G por bioma |
| **Mais armas/evoluções** | Ideias antigas do `IDEIAS_FUTURAS.md`: Detonador Elemental, Totem, Estilhaços de Gelo | M cada |

### 🥉 Live ops (calendário recorrente)

| Ideia | Como seria no Guardião | Esforço |
|---|---|---|
| **Temporada com passe (grátis + premium opcional)** | 4–6 semanas, missões semanais dão pontos, trilha grátis com moedas/skins, trilha premium barata com skins exclusivas | G |
| **Eventos temáticos** | Halloween (inimigos-abóbora, chefe Espantalho), Festa Junina (fogueira, balões), Natal (neve, Ancião de Gelo) — recolorir arte procedural é barato | M por evento |
| **Fins de semana especiais** | "Moedas em dobro", "Reações ×2", "Evolução garantida" — só configuração, sem conteúdo novo | P |
| **Correio de presentes** | Aviso de novidades + presente em cada atualização (traz de volta quem parou) | P |
| **Notificações locais** | Baú diário pronto, colheita cheia, desafio diário novo (sempre opcionais, poucas) | P |

---

## Calendário sugerido pós-lançamento

| Quando | Atualização |
|---|---|
| Lançamento | Plano de `PRE_LANCAMENTO.md` (anúncios, missões diárias, login, modo infinito) |
| +2 semanas | Bestiário + Árvore Sagrada + 3 skins |
| +1 mês | **Desafio Diário com placar** + Desafios com modificadores |
| +2 meses | **Bioma 2: Pântano Corrompido** (chefe novo, 2 inimigos, 2 armas) |
| +3 meses | Relíquias + Arcanas; 1º evento temático |
| +4 meses | Temporada 1 com passe |
| Depois | Um bioma novo a cada 2–3 meses + eventos mensais |

Regra de ouro da pesquisa: **sempre deixar o jogador a 1–2 sessões de "algo
novo"** — uma missão fechando, um baú pronto, um desbloqueio perto, um desafio do
dia que ainda não tentou.

---

## Fontes

- [Survivor.io: The "Progressive" Monetization Masterclass — Gamigion](https://www.gamigion.com/survivor-io-the-progressive-monetization-masterclass/)
- [Live Ops features to boost Retention — Gamigion](https://www.gamigion.com/live-ops-features-to-boost-retention/)
- [How Survivor.io continues to pull in $5 million a month three years later](https://www.gf.symphonyonline.co.uk/news/how-survivor.io-continues-to-pull-in-5-million-a-month-three-years-later)
- [Survivor.io Special Ops guide — MTurboGamer](https://mturbogamer.com/2023/04/survivor-io-special-ops-guide-coins-grade/)
- [Vampire Survivors — Relics (wiki)](https://vampire.survivors.wiki/w/Relics) · [Arcanas (wiki)](https://vampire.survivors.wiki/w/Arcanas) · [Version History](https://vampire-survivors.fandom.com/wiki/Version_History)
- [Brotato — Endless Mode (wiki)](https://brotato.wiki.spellsandguns.com/Endless_Mode)
- [The 24-hour ticket: Examining 'daily runs' — Game Developer](https://www.gamedeveloper.com/design/the-24-hour-ticket-examining-daily-runs-)
- [Dead Cells — Daily Challenge (wiki)](https://deadcells.wiki.gg/wiki/Daily_Challenge)
- [Rewarded Ads in Mobile Games: Strategy, Data, and Best Practices — AppSamurai](https://appsamurai.com/blog/rewarded-ads-in-mobile-games/)
- [Rewarded Video Ad-placements — GameRefinery](https://www.gamerefinery.com/rewarded-video-ad-placements-interesting-implementations-from-across-the-market/)
- [Battle Pass: examples & best practices — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/battle-pass)
- [Mobile Game Retention Benchmarks — Maf.ad](https://maf.ad/en/blog/mobile-game-retention-benchmarks/) · [Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies)
- [capacitor-community/admob (plugin, inclui consentimento UMP)](https://github.com/capacitor-community/admob)
