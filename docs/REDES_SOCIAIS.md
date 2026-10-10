# Redes sociais: Instagram e Discord

Kit pronto para abrir o Instagram e o Discord do jogo (10/10/2026). Estratégia geral e calendário em
`docs/MARKETING.md` (seção 6). Os vídeos ficam em `videos/promo/entrega/reels/` (fora do git) e são
gerados por `videos/promo/build/reels.py` (render: `tools/render.sh reel-<nome>`).

**Quem faz o quê:** criar as contas e entrar nelas é com o Leonardo (o Claude não cria contas nem
digita senhas). Com a conta aberta no navegador, o Claude pode montar o servidor do Discord e preparar
os posts, sempre pedindo o OK antes de publicar.

---

## 1. Instagram

### Perfil

| Campo | Valor |
|---|---|
| Tipo de conta | **Profissional → Criador de conteúdo** (grátis; libera estatísticas e categoria) |
| Categoria | Jogo eletrônico (ou "Desenvolvedor de videogames") |
| Nome de usuário | **`guardiaodafloresta`** (o mesmo em Instagram, TikTok, YouTube e Discord). Se estiver ocupado: `guardiaodaflorestajogo` → `guardiao.dafloresta` |
| Nome (aparece na busca) | `Guardião da Floresta · jogo` |
| Foto | ícone do jogo, `lopesleo.github.io/public/guardiao/assets/img/icon-512.png` (o recorte redondo do Instagram não corta o Curupira) |
| Link | `https://lopesleo.github.io/guardiao/?utm_source=instagram&utm_medium=bio` |

**Bio** (cabe nos 150 caracteres):

```
Roguelite com as lendas do folclore brasileiro.
Você só se move. Fogo + Gelo = Vapor.
Grátis de verdade · Android
Teste fechado aberto 👇
```

Depois do lançamento (03/12), trocar a última linha por `Baixe grátis na Google Play 👇`.

**Destaques** (stories fixos, criar com o tempo): Lendas · Reações · Chefes · Testadores.

### Imagens (`videos/promo/entrega/social/`)

- `perfil_1080.png`: foto de perfil (o ícone do app, exportado em 1080 px pelo `tools/make-icons.py`; o
  herói cabe inteiro no recorte redondo). Serve também de ícone do servidor no Discord.
- `post_01_capa.png` … `post_07_teste.png`: carrossel de apresentação 1080×1350 (4:5), gerado por
  `videos/promo/social/posts.mjs` com quadros reais do jogo. É o **primeiro post do perfil** (fixar no topo).

Legenda do carrossel:
```
Guardião da Floresta é um roguelite brasileiro para Android 🌳

Você só se move. As armas atacam sozinhas. Fogo + Gelo = Vapor.
As lendas do folclore são as heroínas, e o vilão é a Podridão.

Grátis de verdade: sem energia, sem gacha, anúncio só se você quiser.
Estamos em teste fechado: link na bio para entrar.

#jogobrasileiro #indiegame #folclorebrasileiro #roguelite #pixelart #gamedev #jogosmobile
```

### Os 4 primeiros reels

Todos em 1080×1920, ~12 s, com trilha e sons do próprio jogo (nada de terceiros) e cartão final
"TESTE GRÁTIS NO ANDROID · LINK NA BIO". Ao postar: **música original** (não trocar pela do Instagram,
que pode ser bloqueada), capa = um quadro do meio do vídeo, compartilhar também no feed.

| # | Arquivo | Gancho (2 primeiros segundos) | Quando |
|---|---|---|---|
| 1 | `reel_01_reacoes.mp4` | "FOGO + GELO = ?" | sáb. 10/10 ou dom. 11/10, 19h |
| 2 | `reel_02_lendas.mp4` | as 7 lendas lado a lado | qua. 14/10, 19h |
| 3 | `reel_03_chefes.mp4` | grito do Mapinguari + "TODO GOLPE AVISA ANTES" | sex. 16/10, 19h |
| 4 | `reel_04_clareira.mp4` | a Clareira vista de cima | dom. 18/10, 11h |

Ritmo depois: 3 por semana (seg., qua., sex.). Os mesmos arquivos servem para TikTok e YouTube Shorts.

**Legendas** (colar como estão):

**Reel 1 — Reações**
```
Fogo + Gelo = ? 🔥❄️

No Guardião da Floresta você só se move: as armas atacam sozinhas e os elementos se misturam.
São 6 reações para descobrir. Qual você testa primeiro?

Roguelite brasileiro com as lendas do folclore, para Android. Teste fechado aberto: link na bio.

#jogobrasileiro #indiegame #gamedev #roguelite #folclorebrasileiro #jogosmobile #pixelart
```

**Reel 2 — Lendas**
```
Curupira, Caipora, Iara, Saci, Comadre Fulozinha, Mãe-do-Ouro e Anhangá.

Aqui as lendas não são monstros: são as guardiãs da mata. O vilão é a Podridão.
Qual delas você escolheria?

Guardião da Floresta · Android · teste fechado no link da bio.

#folclorebrasileiro #curupira #saci #iara #jogobrasileiro #indiegame #pixelart
```

**Reel 3 — Chefes**
```
Todo golpe avisa antes. Dá pra desviar andando ou com o dash.

Mula sem Cabeça, Caboclo d'Água e o Mapinguari, tomados pela Podridão.
Vencer não é matar: é libertar a lenda.

Guardião da Floresta · Android · link na bio.

#mapinguari #mulasemcabeca #jogobrasileiro #roguelite #indiegame #gamedev
```

**Reel 4 — Clareira**
```
Entre uma batalha e outra: plantar, pescar e cozinhar.
A comida que você faz vira bônus na próxima partida.

Sem energia, sem gacha, anúncio só se você quiser.
Guardião da Floresta · Android · link na bio.

#jogobrasileiro #cozygames #indiegame #pixelart #jogosmobile #gamedev
```

**Respostas e rotina:** responder todo comentário no mesmo dia (o alcance do reel depende das
primeiras horas); fixar o comentário "Quer testar? Link na bio, é grátis e leva 2 minutos"; repostar nos
stories com a enquete "Qual reação?".

---

## 2. Discord

Servidor pequeno, para testadores e primeiros jogadores (MARKETING.md, 6.2). Sem bot no começo.

### Estrutura

| Categoria | Canal | Tipo | Quem escreve |
|---|---|---|---|
| **INÍCIO** | `#boas-vindas` | texto | só a equipe |
| | `#regras` | texto (canal de regras da Comunidade) | só a equipe |
| | `#avisos` | anúncios | só a equipe |
| | `#como-testar` | texto | só a equipe |
| **A CLAREIRA** | `#geral` | texto | todos |
| | `#prints-e-clipes` | texto (com mídia) | todos |
| | `#builds-e-reações` | texto | todos |
| | `#sugestões` | fórum (tags: Arma, Lenda, Clareira, Interface, Outro) | todos |
| | `#bugs` | fórum (tags: Trava, Visual, Som, Anúncio, Resolvido) | todos |
| **TESTE FECHADO** | `#testadores` | texto, privado do cargo Testador | Testador |
| **VOZ** | `Fogueira` | voz | todos |

**Cargos:** `Guardião` (equipe, Administrador) · `Testador` (quem está no teste fechado; cor verde
`#9ccf62`) · `Jogador` (padrão). Ícone do servidor = ícone do jogo. Ativar **Comunidade** (dá o canal
de regras e as boas-vindas), nível de verificação **Médio** e filtro de conteúdo explícito para todos.

### Textos

**#boas-vindas**
```
Bem-vindo à Clareira! 🌳

Guardião da Floresta é um roguelite para Android com as lendas do folclore brasileiro. Você só se move,
as armas atacam sozinhas e os elementos se misturam: Fogo + Gelo = Vapor.

• Leia as #regras
• Quer jogar antes de todo mundo? Veja #como-testar
• Achou um bug? Abra um tópico em #bugs
• Ideia? Mande em #sugestões

Página do jogo: https://lopesleo.github.io/guardiao/?utm_source=discord
```

**#regras**
```
1. Respeito com todo mundo. Sem ofensa, preconceito ou assédio.
2. Nada de conteúdo adulto, violento ou ilegal.
3. Sem spam nem divulgação de outros servidores sem combinar com a equipe.
4. Spoilers de chefes e segredos: use ||spoiler||.
5. Bugs e sugestões nos fóruns certos, um tópico por assunto.
6. Respeite a idade mínima do Discord (13 anos).

A equipe pode apagar mensagens e remover quem descumprir as regras.
```

**#como-testar**
```
O jogo está em teste fechado na Google Play (só Android).

1. Mande o e-mail da sua conta Google (a do celular) para a equipe aqui ou pelo botão da página.
2. Quando avisarmos que você entrou na lista, aceite o convite:
   https://play.google.com/apps/testing/com.lopesleo.guardiao
3. Instale pela Play e deixe o jogo no celular por pelo menos 14 dias. Uma partida de vez em quando ajuda muito.

Quem testar ganha o cargo Testador e o canal #testadores. Obrigado por ajudar a lenda a chegar na loja!
```

**Primeiro aviso (#avisos)**
```
A Clareira abriu! 🔥

Este é o servidor oficial do Guardião da Floresta. Aqui saem as novidades, as datas e as versões de teste
antes de qualquer outro lugar.

Agora: teste fechado na Google Play. Precisamos de mais testadores Android: veja #como-testar.
Lançamento planejado: 03/12/2026.
```

### Depois de criar

- Link de convite **permanente** (sem expirar), para pôr na bio do Instagram, na página e no jogo.
- Colocar o convite no site (botão "Discord" no rodapé) e na tela de Opções do jogo numa próxima versão.
