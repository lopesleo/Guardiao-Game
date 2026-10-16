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
- **Tema (decidido):** folclore brasileiro — Curupira, Iara, Saci, Caipora,
  Mapinguari. **As lendas são guardiãs e aliadas; o vilão é a Podridão** (lenda
  inimiga = corrompida e libertada ao vencer). Domínio público; sem caricatura.
  Ver `docs/TEMA_FOLCLORE.md`.

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
  com **uma paleta só** (`src/art/Palette.js`). Não usar assets de terceiros (as
  únicas exceções são fontes OFL: Jersey 15, Atkinson Hyperlegible e a Fusion Pixel
  recortada para japonês/chinês). UI sempre via `src/ui/Theme.js` e
  `src/ui/Widgets.js` — nada de retângulos crus, emojis ou fontes do sistema.
- **Idiomas (pt, en, es, ja, zh, zht = chinês tradicional):** todo texto visível passa por `tr("português", …)`
  (`src/i18n/i18n.js`) com `{0}` para valores — nunca frase concatenada. Fichas do
  `config.js` são traduzidas por campo. `npm run check` aponta o que falta. Ver
  `docs/IDIOMAS.md`.
- **Revisar todos os idiomas a cada novidade:** ao adicionar ou mudar qualquer texto, revisar
  na hora a tradução em todos os idiomas (sentido, tom, glossário e se cabe na tela) — não só
  preencher o que o `npm run check` aponta como faltando.
- **Critério de qualidade:** mirar um nível capaz de ganhar prêmios como Awwwards, Webby Awards
  ou FWA. Verificar o próprio trabalho repetidamente (capturas de tela, jogar como jogador,
  tentar quebrar) e seguir melhorando por conta própria até atingir esse nível, antes de
  dar por pronto.
- **Gênero:** o jogador só se move; decisões acontecem nas cartas de nível.
- **Balanceamento centralizado** em `src/config.js`.
- **Automatizar o tedioso, nunca o divertido** (bichos ajudam e presenteiam;
  quem pesca, planta e cozinha é o jogador).
- **Descobertas por progresso do jogador**, não por dias reais; o tempo real
  fica só no crescimento das coisas.
- Debug só com `?debug=1` na URL (nunca no build da loja).
- Commits sem o trailer `Co-Authored-By`; mensagens em português.

## Fluxo de branches (git)

- `main` = sempre jogável e testada. Nada é desenvolvido direto nela.
- Cada funcionalidade nasce numa branch a partir da `main`:
  `feat/<marco>-<nome>` (ex.: `feat/m1-lanternas`), `fix/<nome>` para correções,
  `docs/<nome>` para documentação.
- Commits pequenos, no padrão `tipo(escopo): descrição` (`feat`, `fix`, `docs`,
  `refactor`, `test`, `chore`).
- Terminou e testou → merge na `main` com `--no-ff` (o histórico mostra cada
  funcionalidade como um bloco) e apaga a branch local.
- Status do `docs/ROADMAP.md` atualizado no mesmo merge.
- Push só quando o Leonardo pedir.

## Pendências atuais (atualizar a cada sessão)

Lista viva do que está aberto. Detalhes nos documentos citados; ao concluir um item, apagar daqui e
marcar no `docs/ROADMAP.md`. Última revisão: **16/10/2026**.

**Agora**
- **1.0.3 (código 4) enviada para revisão em 15/10** (teste fechado Alpha, lançamento completo; publicação
  gerenciada desligada = vai direto aos testadores quando aprovada). Inclui a 1.0.2 (anúncios 13+, nuvem do Play
  Games embutida e desligada), o zoom de acessibilidade e o toque da pesca na tela inteira. Notas nos 8 idiomas
  em `docs/PLAY_STORE.md`. Os 2 avisos do Console (sem arquivo de desofuscação, sem símbolos nativos) são os de
  sempre. Já instalada no S23 (15/10): no aparelho apareceram o botão das Opções virando traço ao ser tocado
  e o zoom só na partida — **corrigidos na `main`** junto com a pesca um pouco mais fácil e o pacote de
  acessibilidade (clarões suaves, joystick fixo/canhoto/tamanho, pesca assistida, ameaças legíveis para
  daltônicos; ver `docs/ROADMAP.md`); vão na próxima versão (1.0.4, código 5) quando o Leonardo pedir.
  👤 Sentir no aparelho o joystick fixo e o canhoto (só dá para testar de verdade com o dedo).
- **Teste fechado:** o Painel mostrou em 15/10 **12 testadores participando há 1 dia** — os 14 dias contam desde
  ~14/10 (pedido de produção possível por volta de **28/10**). 👤 Manter os 12 ativos (ninguém sair da lista).
  Convite: `https://play.google.com/apps/testing/com.lopesleo.guardiao`. Cadastrar e-mails à mão (só contas
  Google); **não trocar por Grupo do Google durante o teste**. Conta do Play Console: "Komedy Games Studio"
  (login leonardolopes952@gmail.com).
- Dano das reações **fica fixo** (decidido em 13/10 pelo laboratório `tools/rx-lab.mjs`): conferir nos dados reais
  `run_reactions` (`rxd_*` ÷ `dmg_total`) com o critério de corte/reabertura em `docs/BALANCING.md`.
- Analytics: as 17 dimensões e 16 métricas personalizadas levam 24–48 h para aparecer nos relatórios; quando
  houver dados dos testadores, analisar taxa de escolha das cartas, vitória por arma/Perigo, dano e
  assistência (como ler: `docs/ARMAS_E_COMBOS.md`, "Como medir").

**Decisões pendentes**
- Descrição curta em espanhol: "leyendas de Brasil" → "del folclore brasileño"? (a captura 07 já foi refeita).

**Depois de 12 testadores × 14 dias (~28/10)**
- 👤 Pedir acesso à produção no Painel do Play Console (análise de ~7 dias).
- Com a produção: vincular o app à loja no AdMob; ligar o **pré-registro**; trocar `STAGE` para `"pre"`
  (depois `"loja"`) em `guardiao/config.mjs` no repositório `lopesleo.github.io` e publicar.
- Lançamento planejado: **quinta, 03/12/2026** (calendário completo em `docs/MARKETING.md`).

**Marketing e loja** (`docs/MARKETING.md`)
- Redes (`docs/REDES_SOCIAIS.md`): 👤 criar o Instagram `@guardiaodafloresta` e postar os 4 reels + carrossel
  (`videos/promo/entrega/`). Discord no ar (https://discord.gg/TTYnNtQAes), configurado por `tools/discord/`;
  👤 falta o Guia do servidor e a proteção contra raids (à mão) e subir o cargo do bot ao topo para o script
  renomear "Guardião" → "Equipe" e ordenar os cargos.
- 31/10 Dia do Saci (vídeo do Saci + chamada de testadores); vídeos curtos 3×/semana; formulário de feedback.
- Imprensa e criadores a partir de 10/11 (kit em `lopesleo.github.io/guardiao/#press`).
- Inscrição no BIG Festival 2027 (deve abrir entre nov./2026 e jan./2027).
- 👤 Opcional: trocar a URL da política no Play Console e no AdMob para `lopesleo.github.io/guardiao/privacidade/`;
  trocar o "Site" do desenvolvedor para `/guardiao/`; subir o promo no YouTube para o vídeo da ficha.

**Jogo (backlog do roadmap)**
- Anúncios já pedem classificação máxima "T" no app; 👤 deixar também "T" no console do AdMob (Controles de
  bloqueio). Salvamento na nuvem está na `main`, **desligado** até o ID do Play Games: 👤 criar o projeto na
  Play Console (passo a passo em `docs/PLAY_STORE.md`, inclusive o texto da política), pôr o ID em
  `games-ids.xml` e testar no aparelho. Compra "Remover anúncios"; revisão nativa ja/zh; testes em aparelho fraco.

**Laboratório e ferramentas**
- **Robô jogador** (`tools/bot-lab.mjs`, modelo e lições em `docs/ROBO_JOGADOR.md`): prioridades de jogador em
  camadas + treino que só ajusta os números; vence ~25% em Perigo 1–2. Próximos: medir com 48–60 partidas por
  cérebro (o jogo é caótico), entender as mortes em Perigo 3 com `BOOST` (sem bênçãos é pesado demais) e, mais
  adiante, o modo `assistir` pronto para **live** (1080p, som, legenda no tema, chat escolhe as cartas).
- Skills do estúdio instaladas em `.claude/` (15/10/2026; fora do git, fonte em `tools/estudio/`): revisão de
  design, balanço e versão da loja, mais a guarda do git (bloqueia Co-Authored-By, commit direto na `main`,
  merge sem `--no-ff`, mensagem fora do padrão e `ADS.TESTING: false`; push pede confirmação). Mudou a fonte?
  Reinstalar com o comando de `tools/estudio/README.md`.

**Repositórios**
- `main` deste repo subiu para o `origin` em 15/10/2026 (push só quando o Leonardo pedir). O Pages daqui serve a
  branch `pages` (jogo web fora do ar; política no endereço antigo). Página oficial: repo `lopesleo.github.io`,
  pasta `guardiao/` (deploy = push na `dev`).

## Onde está cada coisa

| Assunto | Documento |
|---|---|
| Visão geral, rodar, controles, arquitetura | `README.md` |
| **Roadmap (ordem de execução e status)** | `docs/ROADMAP.md` |
| Plano antes de publicar (anúncios, retenção, loja) | `docs/PRE_LANCAMENTO.md` |
| **Marketing, distribuição e calendário de lançamento** | `docs/MARKETING.md` |
| Instagram, reels e servidor do Discord (`tools/discord/`) | `docs/REDES_SOCIAIS.md` |
| Página oficial (`lopesleo.github.io/guardiao/`) | repositório `lopesleo.github.io`, pasta `guardiao/` |
| Publicação na Play Store, privacidade | `docs/PLAY_STORE.md`, `docs/PRIVACY.md` |
| Clareira (acampamento, obras, bichos, fases) | `docs/CLAREIRA.md` |
| Horta, pesca e cozinha em detalhe | `docs/VIDA_NA_CLAREIRA.md` |
| Ordem de apresentação e ritmo de tempo | `docs/RITMO_E_APRESENTACAO.md` |
| Pesquisa de mercado e ideias de retenção/tema | `docs/IDEIAS_RETENCAO.md` |
| **Tema folclore: decisão, papéis e cuidados** | `docs/TEMA_FOLCLORE.md` |
| Meta-progressão atual (Perigo, Bênçãos, conquistas) | `docs/META_LOOP.md` |
| Armas, evoluções e próximos combos | `docs/ARMAS_E_COMBOS.md` |
| **Chefes: golpes especiais e regras de justiça** | `docs/CHEFES.md` |
| **Como adicionar armas, laços, guardiões e desbloqueios** (`npm run check`) | `docs/CONTEUDO.md` |
| Biomas (mapas): pesquisa, a Caatinga e como adicionar um bioma | `docs/BIOMAS.md` |
| **Idiomas: como traduzir, adicionar texto/idioma, glossário** | `docs/IDIOMAS.md` |

## Rodar e testar

- Navegador: `python -m http.server 8000` na raiz → <http://localhost:8000>
- Android: `npm install` → `npm run android:sync` → `npm run android:open`
  (build e assinatura no Android Studio).
