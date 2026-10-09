# Marketing e distribuição — Guardião da Floresta

Plano escrito em **09/10/2026**, com o app no **teste fechado** da Google Play (enviado para análise nesse
dia). Revisar as datas a cada etapa vencida. Pesquisa e fontes no fim do documento.

Legenda — **Quem:** 🤖 dá pra eu fazer · 👤 depende de você (conta, rosto, voz, pessoas, dinheiro)

---

## Resumo em uma tela

- **Onde:** só a **Google Play** por enquanto (a versão web saiu do ar em 09/10/2026). Steam e iOS ficam para
  depois, cada um com seu custo (ver [Distribuição](#4-distribuição)).
- **Para quem:** jogadores de ação no celular, no Brasil primeiro (16–34 anos, quem já jogou *Survivor.io*,
  *Vampire Survivors*, *Archero* ou *Brotato*); depois, quem joga roguelite no mundo e nunca viu o folclore
  brasileiro.
- **Promessa:** *as lendas do folclore brasileiro contra a Podridão, num survivor justo de verdade.*
- **As três apostas:**
  1. **Vídeo curto com a mecânica que se entende sem som:** *Fogo + Gelo = Vapor*. É o gancho de todos os
     posts.
  2. **Folclore como orgulho, não como sala de aula:** Curupira, Iara e Saci como heróis poderosos. Datas
     prontas: **Dia do Saci (31/10)**, Dia do Folclore (22/08), Dia da Amazônia (05/09), Dia da Caatinga (28/04).
  3. **"Justo de verdade" como diferencial declarado:** sem energia, sem sorteio pago, anúncio só se você
     quiser e nunca durante a ação. É a maior reclamação de quem joga no celular, e o jogo já cumpre.
- **Calendário:** testadores agora → produção no começo de novembro → **pré-registro em novembro** →
  **lançamento na quinta, 03/12/2026**, duas semanas antes das férias escolares.
- **Dinheiro:** zero até os números provarem retenção. Anúncio pago só quando **D1 ≥ 30%** e a receita por
  jogador pagar a instalação.

---

## 1. Onde estamos (09/10/2026)

| Item | Situação |
|---|---|
| Play Console | Conta pessoal; app `com.lopesleo.guardiao` criado; ficha da loja em 8 localidades com 8 capturas cada |
| Teste fechado | Enviado para análise. **Só 1 testador na lista.** Produção e pré-registro ficam travados até 12 testadores ficarem 14 dias seguidos |
| Nome do desenvolvedor | "Komedy Games Studio", em análise |
| Material pronto | 8 capturas × 6 idiomas e gráfico de destaque (`videos/promo/store/out/`), vídeo promocional 16:9 e 9:16 de 91 s (`videos/promo/entrega/`), 60 tomadas de gameplay de 4 s (`videos/promo/clips/`) |
| Página oficial | **lopesleo.github.io/guardiao/** (feita em 09/10/2026, 6 idiomas): ver [seção 7](#7-a-página-oficial) |
| Versão web | Fora do ar. O endereço antigo `/Guardiao-Game/` leva para a página nova; a política continua no endereço antigo |
| Orçamento | ~R$ 0 (a taxa da Steam, US$ 100, está em espera) |

**O gargalo de agora são os 12 testadores.** Tudo o que vem depois espera por eles.

---

## 2. Posicionamento

### Frase de uma linha
> **PT:** As lendas do folclore brasileiro contra a Podridão. Só ande: as armas atacam sozinhas.
> **EN:** Legends of Brazilian folklore against the Rot. Just move — your weapons do the rest.

Em comunidade e imprensa (nunca na ficha da loja, que proíbe citar outros apps), a comparação acelera o
entendimento: *"um survivor no estilo Vampire Survivors, com o folclore brasileiro"*.

### Pilares de mensagem (nessa ordem)
| # | Pilar | Prova que dá para mostrar |
|---|---|---|
| 1 | **Reações elementais**: 4 elementos, 6 reações | Clipes `re_*`: a palavra "VAPOR!" aparece na tela |
| 2 | **As lendas são heroínas** e o vilão é a Podridão | 7 guardiões com origem pesquisada; o Mapinguari é libertado, não morto |
| 3 | **Justo de verdade** | Sem energia, sem gacha, anúncio opcional, offline |
| 4 | **Feito para o celular** | Partidas de 7 min, um polegar, roda em aparelho fraco |
| 5 | **Uma vida entre as partidas** | A Clareira: horta, pesca, cozinha |

### Tom
Guardião, não professor. O folclore é apresentado como **poder** ("o Saci viaja dentro do redemoinho"),
nunca como lição nem como piada. O jogo **não é educativo**, e chamá-lo assim afasta o público de ação.
As regras de representação estão em [`TEMA_FOLCLORE.md`](TEMA_FOLCLORE.md).

---

## 3. Funil e o que medir

```
vê um post / matéria / a loja  →  abre a página ou a ficha  →  instala  →  volta amanhã (D1)  →  volta em 7 dias (D7)  →  avalia
```

| Etapa | Onde medir | Meta inicial |
|---|---|---|
| Visitas à página e cliques nos botões | PostHog do site (eventos `guardiao_*`, por `utm_source`) | saber qual canal traz gente |
| Conversão da ficha (visita → instalação) | Play Console → Estatísticas → Aquisição de usuários | ficar acima da mediana do grupo de comparação que o Console mostra |
| Retenção D1 / D7 / D30 | Firebase Analytics (`run_start` com `run_n`) | **30% / 8% / 2%** ([`PRE_LANCAMENTO.md`](PRE_LANCAMENTO.md)) |
| Nota na loja | Play Console → Avaliações | ≥ 4,4, respondendo a **todas** as avaliações nos 3 primeiros meses |

**Todo link tem etiqueta.** O botão da página já repassa o `utm_source` da visita para a Play
(`&referrer=utm_source%3D…`). Use um por canal: `?utm_source=tiktok`, `instagram`, `youtube`, `reddit`,
`discord`, `imprensa`, `linkedin`, `qr` (cartaz/evento). Sem isso não dá para saber o que funcionou.

---

## 4. Distribuição

| Canal | Quando | Custo | Observação |
|---|---|---|---|
| **Google Play** | agora | já pago (US$ 25) | Único canal até o lançamento estabilizar |
| Google Play Games no PC | junto (deixado ligado) | 0 | Alcance extra sem trabalho; conferir controles de teclado no relatório do Console |
| Steam | depois de 2027 T1, se os números do celular forem bons | US$ 100 | Sem anúncios premiados (a Steam proíbe). Versão paga barata, como o Vampire Survivors; precisa de controles de teclado/controle e de um empacotador para PC. Página da loja no ar 2 semanas antes |
| iOS | só com retorno comprovado | US$ 99/ano + um Mac | O Capacitor gera o projeto, mas o build e a assinatura precisam de macOS |
| Portais web (CrazyGames, Poki) | **não agora** (decisão de 09/10/2026) | 0 | Funcionariam como demonstração; voltar ao assunto só se o celular estagnar |

### Loja (ASO)
- **Título:** manter "Guardião da Floresta" (sem palavras-chave forçadas; a Play pune título com "grátis",
  "top" e afins).
- **Vídeo da ficha:** subir o promo 16:9 no YouTube (canal "Komedy Games Studio", público ou não listado) e
  colar no campo de vídeo da ficha. 👤
- **Experimentos da ficha** (só depois de publicado): testar o **ícone** primeiro (maior alavanca), depois
  a **1ª captura** (horda × reação "VAPOR!"). Uma variável por vez, 50/50, até o Console declarar vencedor.
- **Fichas personalizadas por país:** a de Portugal pode usar o mesmo texto; o México e a Argentina, a
  ficha `es-419` que já existe.
- **Avaliações:** pedir avaliação **dentro do jogo** pela API de avaliação da Play, logo depois de uma
  **vitória** (nunca depois de morrer). Item novo para o jogo: ver [seção 9](#9-o-que-o-jogo-pode-ganhar-para-ajudar-o-marketing).

---

## 5. Calendário

| Quando | O quê | Quem |
|---|---|---|
| **09–12/10** | Página oficial no ar; versão web fora do ar com a política preservada. A **BGS 2026** está acontecendo agora (Anhembi, SP): não há tempo de expor, mas vale para contatos se você estiver lá | 🤖 / 👤 |
| **até 14/10** | **Grupo do Google de testadores** criado e ligado à faixa de teste fechado; **20–25 convites** (12 é o mínimo e sempre alguém sai): família, amigos, turma do CEFET, colegas de trabalho, Discords de gamedev | 👤 (eu preparo os textos) |
| 14/10 → 28/10 | **Teste fechado** de 14 dias. Formulário de feedback curto (5 perguntas); corrigir o que travar; anotar **quem jogou de verdade**, porque o pedido de produção pergunta como foi o teste | 👤 + 🤖 |
| 14/10 → 03/12 | **Conteúdo curto 3×/semana** (ver [seção 6.1](#61-vídeo-curto-tiktok-reels-shorts)) para chegar ao lançamento com público | 👤 posta · 🤖 corta |
| **31/10 (sáb.)** | **Dia do Saci**: vídeo do Saci com o Redemoinho ("aqui o Saci é guardião") e chamada para a última leva de testadores. Falar com a **SOSACI** (Sociedade dos Observadores de Saci, de São Luiz do Paraitinga) | 👤 + 🤖 |
| ~28/10 | **Pedir acesso à produção** no Painel do Play Console (a análise costuma levar até ~7 dias) | 👤 |
| ~05/11 | Com a produção liberada: **ligar o pré-registro** (com uma recompensa simples que o jogo consiga entregar, ex.: 300 moedas) e trocar o botão da página para "Pré-registre-se" | 👤 + 🤖 |
| 05/11 → 02/12 | **Imprensa e criadores** (ver [seção 6.3](#63-imprensa) e [6.4](#64-criadores)): kit de imprensa enviado a partir de 10/11 com data marcada | 🤖 escreve · 👤 envia |
| **03/12 (qui.)** | **Lançamento.** Post em todos os canais, troca do botão para "Baixar na Google Play", resposta a toda avaliação | 👤 + 🤖 |
| meados de dez. → fim de jan. | **Férias escolares**: o maior pico de tempo livre do ano. Primeira atualização ~2 semanas depois do lançamento (correções + 1 novidade pequena) | 🤖 |
| nov./dez. 2026 → jan. 2027 | **Inscrição no BIG Festival 2027** (a edição de 2026 fechou em 15/01). Categorias **Melhor Jogo Mobile** e **Melhor Jogo: Brasil** | 👤 |
| 2027 | Editais (ver [seção 8](#8-editais-festivais-e-programas)); Dia da Caatinga (28/04) com o bioma da Caatinga; Dia do Folclore (22/08) | 👤 + 🤖 |

**Por que não lançar no Dia do Saci:** os 14 dias de teste só terminam ~28/10, e a análise da produção vem
depois. Lançar às pressas desperdiça o pico do primeiro dia, que conta para a Play destacar jogos novos. O
Dia do Saci fica como **campanha de aquecimento**.

---

## 6. Canais (custo zero primeiro)

### 6.1 Vídeo curto (TikTok, Reels, Shorts)
O mesmo vídeo vertical vai para os três. Legenda em português e texto na tela (a maioria assiste sem som).
Os 60 clipes de 4 s e o promo 9:16 já dão material para ~2 meses.

| Formato | Exemplo | Clipes |
|---|---|---|
| **Pergunta da reação** | "Fogo + Gelo = ?" → a resposta aparece em 2 s | `re_vapor`, `re_crystal`, `re_overload`… |
| **Lenda do dia** | "A Caipora anda montada num porco-do-mato. No jogo, ela protege os bichos com uma vara encantada." | `leg_*` + origem do bestiário |
| **Desvie só andando** | Chefe solta o golpe enorme, o herói passa ileso | `mapi_*`, `mula_charge`, `cab_*` |
| **Horda virando pó** | Evolução de arma limpando a tela | `evo_*` |
| **Do código à tela** | Toda a arte e a música do jogo são geradas por código (sem pacote de assets comprado) | captura do `art-preview.html` + jogo |
| **Vida na Clareira** | Pescar, plantar e cozinhar entre as partidas | `camp_*` |

**Ritmo:** 3 posts por semana é sustentável; um viral não é plano. Gancho nos 2 primeiros segundos,
duração de 8 a 20 s, fim com "Guardião da Floresta · Google Play" e o link na bio apontando para a página.

### 6.2 Comunidades
- **Testadores (agora):** amigos e família primeiro (são os que ficam 14 dias). Depois Discords de gamedev
  brasileiros e r/AndroidClosedTesting. Testador de troca ("eu testo o seu, você testa o meu") só para
  completar o número: costuma desinstalar, e a Play pergunta pelo engajamento.
- **Lançamento:** r/AndroidGaming (ler as regras de autopromoção antes), r/roguelites, r/IndieGaming,
  r/gamedevbrasil e r/jogatina. Um post por comunidade, escrito para ela, com o GIF da reação. Responder
  todo comentário.
- **Servidor no Discord do jogo:** pequeno, para testadores e primeiros jogadores (canais: avisos,
  sugestões, bugs, prints). Vira a fonte das atualizações.

### 6.3 Imprensa
Kit de imprensa na página (seção "Imprensa"): ficha técnica, textos curtos, capturas, ícone, logo e trailer.

| Alvo | Ângulo |
|---|---|
| **Imprensa local** (A Voz da Serra, de Nova Friburgo, e a comunicação do CEFET/RJ) | "Estudante de Nova Friburgo lança jogo com as lendas do folclore brasileiro". É a matéria mais fácil de sair, e a que abre portas |
| **Sites de games do Brasil** (TecMundo/Voxel, que publica listas de indies brasileiros; Drops de Jogos; Arkade; Gamers & Games; Omelete; o "Só Jogo" do Correio Braziliense) | Folclore como heróis + "justo de verdade" + lançamento em data marcada |
| **Exterior** (Pocket Gamer e o **Big Indie Pitch** deles; sites de Android) | "Brazilian folklore survivor-like", com os 6 idiomas como argumento |

Enviar **uma semana antes** da data, com assunto direto ("Guardião da Floresta: survivor brasileiro com
folclore chega à Google Play em 03/12") e o link do kit, sem anexos pesados.

### 6.4 Criadores
- Criadores **pequenos e médios** de jogos de celular no Brasil (10 mil a 200 mil seguidores), que respondem
  e jogam de verdade. Mandar o link de teste ou de pré-registro com um roteiro de 3 linhas, nunca um texto
  pronto para ler.
- Criadores de **folclore e cultura brasileira** (o tema puxa o assunto).
- **Classificação 14 no Brasil:** não mirar canais infantis (público abaixo de 13 anos tornaria o app
  sujeito às regras de Famílias, que limitam anúncios).

### 6.5 Rede pessoal
- **Portfólio:** card do jogo na página inicial de `lopesleo.github.io` levando para `/guardiao/` (sugestão:
  exige atualizar também os dois CVs, pela regra daquele repositório).
- **LinkedIn:** a história de desenvolvimento ("um jogo inteiro com arte e som gerados por código") alcança
  recrutadores e devs. Bom canal para recrutar testadores.

### 6.6 Pago (depois)
Só com **D1 ≥ 30%** medido e receita por jogador conhecida. Começar com **Google Ads para apps** a
R$ 20–30/dia por 2 semanas, só no Brasil, com os 3 vídeos curtos de melhor retenção orgânica. Parar se o
custo por instalação passar da receita por jogador em 30 dias.

---

## 7. A página oficial

**`https://lopesleo.github.io/guardiao/`** (português) · `/en/` · `/es/` · `/ja/` · `/zh/` · `/zh-hant/`

- Fonte em `lopesleo.github.io/guardiao/` (gerador `build.mjs` + textos por idioma); sai em `public/guardiao/`.
- **Uma linha muda a fase** (`STAGE` em `guardiao/config.mjs`): `teste` (botão "Quero testar") → `pre`
  (pré-registro) → `loja` (baixar). Também ficam lá o link do Grupo do Google de testadores e o da Play.
- Mostra: o herói com gameplay em laço, como se joga, **as reações (interativo: escolha dois elementos)**,
  as 7 lendas animadas com a origem de cada uma, chefes, Clareira, biomas, as promessas de "justo de
  verdade", o trailer e o kit de imprensa.
- **Política de privacidade nova:** `/guardiao/privacidade/` (PT) e `/guardiao/en/privacy/` (EN). O endereço
  antigo continua respondendo. 👤 Trocar a URL no **Play Console** (Conteúdo do app → Política de
  privacidade) e na **mensagem de consentimento do AdMob** quando der.
- Medição anônima (sem cookies) dos cliques, pelo mesmo PostHog do portfólio.

---

## 8. Editais, festivais e programas

| O quê | Quando | Observação |
|---|---|---|
| **BIG Festival 2027** (junto da gamescom latam, SP) | inscrição deve abrir entre nov./2026 e jan./2027 | Gratuita em 2026. Categorias Mobile e Brasil; o **BIG Starter** dá espaço na área indie a nacionais não selecionados |
| **Google Play Indie Games Fund — América Latina** | rodadas de 2024 e 2025 abriram entre julho e setembro | Exigia jogo **já lançado**; acompanhar o blog de desenvolvedores Android em 2027 |
| **Editais de cultura (PNAB, ciclo 3)** | conforme cada estado | Costumam exigir **CNPJ (MEI serve)** e sede no estado. Ver a Secretaria de Cultura do RJ; o folclore conta a favor em editais de cultura |
| **Pocket Gamer Big Indie Pitch** | várias edições por ano, algumas online | Pitch de 4 min para jurados da imprensa |

---

## 9. O que o jogo pode ganhar para ajudar o marketing

| Item | Por quê | Esforço |
|---|---|---|
| **Pedido de avaliação** (API In-App Review da Play) depois da 1ª vitória | Nota e número de avaliações pesam na conversão da ficha | P 🤖 |
| **Cartão de partida para compartilhar** (imagem com guardião, tempo, reações disparadas) | Cada jogador vira um post | M 🤖 |
| **Link de convite com UTM** no menu ("Chame um amigo") | Mede o boca a boca | P 🤖 |
| **Evento do Dia do Saci** (Saci em destaque na Clareira) e do Dia do Folclore | Dá assunto nas datas | P 🤖 |
| **Conquistas do Play Games** (os ids já existem) | Aparece no perfil do jogador e no Play Games | M 🤖 |

---

## 10. Cuidados

- **Promessas da loja são contrato:** "anúncio nunca durante a ação" e "sem compra de poder" estão na ficha.
  Quebrar isso em uma atualização derruba a nota.
- **Ficha sem palavras proibidas:** nada de "grátis", "nº 1", "melhor" no título ou no ícone, nem nomes de
  outros jogos.
- **Folclore:** sem estereótipo, sem a lenda como vilã, crédito à origem indígena e africana quando citar uma
  lenda (o bestiário já faz isso). Ver [`TEMA_FOLCLORE.md`](TEMA_FOLCLORE.md).
- **Honestidade sobre o processo:** dizer "arte e música **geradas por código**" (é verdade e é
  diferencial). Nunca dizer "feito à mão, pixel a pixel". A Steam pede declaração de conteúdo gerado com IA,
  então a resposta precisa estar pronta e coerente com o que foi dito antes.
- **Nome legal:** a compra "Remover anúncios" (Play Billing) torna público o nome e o endereço de uma conta
  pessoal. Decidir antes de ligar a compra (ver `PLAY_STORE.md`).
- **Público 14+ no Brasil:** nada de campanha em escolas para menores de 14, nem criadores infantis.

---

## 11. Checklist desta semana

- 👤 Criar o Grupo do Google **guardiao-testadores** ("qualquer pessoa pode participar") e adicioná-lo à faixa
  **Teste fechado → Testadores**; colar o link em `guardiao/config.mjs` (eu atualizo e publico)
- 👤 Mandar o convite para 20–25 pessoas (texto pronto abaixo)
- 👤 Trocar a URL da política no Play Console e no AdMob (opcional: o endereço antigo continua valendo)
- 🤖 Cortar os 6 primeiros vídeos curtos (3 reações, 2 lendas, 1 chefe) em 9:16
- 🤖 Formulário de feedback do teste (5 perguntas)

### Convite para testadores (pronto para colar)
> Fiz um jogo de celular com as lendas do folclore brasileiro: o **Guardião da Floresta**. Ele vai sair na Google Play,
> mas antes a Google exige que 12 pessoas testem por 14 dias. Me ajuda? Leva 2 minutos:
> 1) entre no grupo pelo link da página (**lopesleo.github.io/guardiao**) com o Gmail do seu celular;
> 2) aceite o convite de teste; 3) instale pela Play e **deixe instalado por 14 dias** (jogar uma partida de
> 7 min já ajuda muito). Valeu demais!

---

## Fontes (consultadas em 09/10/2026)

- Teste fechado com 12 testadores por 14 dias; produção e pré-registro travados até lá:
  [Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465) ·
  [Android Authority](https://androidauthority.com/google-play-app-testing-requirement-3510580)
- Pré-registro (até 2 apps por vez, janela de 90 dias por país):
  [Play Console Help](https://support.google.com/googleplay/android-developer/answer/9859047)
- BIG Festival 2026 (inscrições até 15/01/2026; evento de 30/04 a 03/05; categorias Mobile e Brasil; BIG Starter):
  [Arkade](https://arkade.com.br/big-festival-2026-estende-prazo-de-inscricoes-para-jogos-independentes-ate-15-de-janeiro/) ·
  [Omelete](https://www.omelete.com.br/games/gamescom-latam-2026-big-festival-palestras-inscricoes-prorrogadas)
- BGS 2026 de 9 a 12/10 no Distrito Anhembi:
  [Canaltech](https://canaltech.com.br/games/quando-e-a-bgs-2026-veja-data-e-local/)
- Dia do Saci (31/10; Lei estadual de SP 11.669/2004):
  [ALESP](https://www.al.sp.gov.br/repositorio/legislacao/lei/2004/lei-11669-13.01.2004.html)
- Google Play Indie Games Fund na América Latina:
  [Android Developers Blog](https://developers.googleblog.com/indie-games-fund-google-plays-2m-fund-in-latin-america-is-back/)
- Editais de games com PNAB/ProAC em 2026 (exigem pessoa jurídica, MEI serve):
  [Cultura SP](https://www.cultura.sp.gov.br/sec_cultura/Arquivo_de_Editais/Editais_Fomento_Cultsp/Fomento_CultSP_2026/desenvolvimento_ou_finalizacao_e_publicacao_de_jogos_eletronicos_2026/)
- Survivor.io e TikTok (vídeo nativo, criadores médios, foco no gameplay):
  [Apptamin](https://www.apptamin.com/blog/survivor-io-a-tiktok-success-story-for-mobile-games-%E2%8E%AE-case-study/)
- Alcance orgânico menos previsível no TikTok desde 2025; ritmo de 3–5 posts por semana:
  [Acorn Games](https://acorngames.gg/blog/2025/8/10/the-indie-devs-guide-to-mastering-tiktok-in-2025)
- Indies brasileiros na imprensa em 2026:
  [TecMundo/Voxel](https://tecmundo.com.br/voxel/505342-12-jogos-independentes-brasileiros-lancados-em-2026-para-conhecer.htm)
