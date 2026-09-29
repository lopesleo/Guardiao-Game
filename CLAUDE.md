# Guardião da Floresta

## A ideia

Roguelite de sobrevivência (*survivor-like*) para **celular Android**, com um
segundo loop de "vida na floresta" que apoia a ação.

- **Ação (o coração do jogo):** partidas de ~7 min numa floresta tomada pela
  **Podridão**. O jogador só se move; as armas atacam sozinhas; cada nível traz
  uma escolha de carta. Mecânica-assinatura: **Reações Elementais** (Fogo+Gelo =
  Vapor, Gelo+Raio = Cristal, Fogo+Raio = Sobrecarga). Chefe final aos 7:00.
- **Clareira do Guardião (em design, não implementada):** o acampamento vira o
  menu. Horta (estilo Colheita Feliz), pesca (minigame de um polegar), cozinha
  (refeições = bônus de 1 partida), obras com tempo e construtor João-de-barro,
  e bichos da fauna brasileira resgatados nas partidas (companheiros, não
  trabalhadores). **Regra de ouro: a Clareira tem progressão própria, mas existe
  para apoiar a ação — nunca compete com ela.**
- **Tema em estudo:** folclore brasileiro (Curupira, Iara, Saci, Caipora,
  Mapinguari) — domínio público; cuidar da representação (sem caricatura).

## Finalidade

Lançar na **Google Play** como jogo **gratuito com anúncios opcionais** (modelo
"free-for-real" do Vampire Survivors) + compra "Remover anúncios". Foco no
público brasileiro, com potencial internacional.

## Objetivos

1. **Qualidade de produto**: identidade visual e sonora coesa e 100% própria.
2. **Retenção** (metas de mercado para ação): **D1 ≥ 30%, D7 ≥ 8%, D30 ≥ 2%** —
   hábito diário via Clareira, missões e progressão longa.
3. **Justiça**: nunca vender poder, sem energia, sem sorteio pago (gacha);
   anúncios sempre opcionais e nunca durante a ação.
4. **Mobile-first**: sessões curtas, controles de toque, roda bem em aparelho fraco.
5. **Apresentação gradual**: uma novidade por vez; primeiro sucesso em segundos.

## Princípios e decisões (seguir sempre)

- **Arte e áudio 100% próprios, gerados por código** (`src/art/`, `src/audio/`),
  com **uma paleta só** (`src/art/Palette.js`). Não usar assets de terceiros (a
  única exceção é a fonte Jersey 15, OFL). UI sempre via `src/ui/Theme.js` e
  `src/ui/Widgets.js` — nada de retângulos crus, emojis ou fontes do sistema.
- **Gênero:** o jogador só se move; decisões acontecem nas cartas de nível.
- **Balanceamento centralizado** em `src/config.js`.
- **Automatizar o tedioso, nunca o divertido** (bichos ajudam e presenteiam;
  quem pesca, planta e cozinha é o jogador).
- **Descobertas por progresso do jogador**, não por dias reais; o tempo real
  fica só no crescimento das coisas.
- Debug só com `?debug=1` na URL (nunca no build da loja).
- Commits sem o trailer `Co-Authored-By`; mensagens em português.

## Onde está cada coisa

| Assunto | Documento |
|---|---|
| Visão geral, rodar, controles, arquitetura | `README.md` |
| Plano antes de publicar (anúncios, retenção, loja) | `docs/PRE_LANCAMENTO.md` |
| Publicação na Play Store, privacidade | `docs/PLAY_STORE.md`, `docs/PRIVACY.md` |
| Clareira (acampamento, obras, bichos, fases) | `docs/CLAREIRA.md` |
| Horta, pesca e cozinha em detalhe | `docs/VIDA_NA_CLAREIRA.md` |
| Ordem de apresentação e ritmo de tempo | `docs/RITMO_E_APRESENTACAO.md` |
| Pesquisa de mercado e ideias de retenção/tema | `docs/IDEIAS_RETENCAO.md` |
| Meta-progressão atual (Perigo, Bênçãos, conquistas) | `docs/META_LOOP.md` |

## Rodar e testar

- Navegador: `python -m http.server 8000` na raiz → <http://localhost:8000>
- Android: `npm install` → `npm run android:sync` → `npm run android:open`
  (build e assinatura no Android Studio).
