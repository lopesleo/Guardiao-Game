# Redes sociais: Instagram e Discord

Kit pronto para abrir o Instagram e o Discord do jogo (10/10/2026). Estratégia geral e calendário em
`docs/MARKETING.md` (seção 6); a rotina semanal de posts de todas as redes, com textos prontos, em
`docs/PLANO_DE_CONTEUDO.md`. Os vídeos ficam em `videos/promo/entrega/reels/` (fora do git) e são
gerados por `videos/promo/build/reels.py` (render: `tools/render.sh reel-<nome>`).

**Quem faz o quê:** criar as contas e entrar nelas é com o Leonardo (o Claude não cria contas nem
digita senhas). Com a conta aberta no navegador, o Claude pode montar o servidor do Discord e preparar
os posts, sempre pedindo o OK antes de publicar.

---

## 1. Instagram

### Perfil

**No ar desde 20/10/2026: `@guardiaodaflorestaofc`** (conta criada pelo Leonardo; nome, bio, link, conta profissional e
categoria configurados pelo Claude via adb no celular, com os textos abaixo). Para colar texto com acento/emoji no
celular por adb: uma página local com botões "copiar" aberta no Chrome do celular (`adb reverse`) e `input
keycombination 113 50` (Ctrl+V) no campo; o `input text` do adb não digita acentos.

| Campo | Valor |
|---|---|
| Tipo de conta | **Profissional → Criador de conteúdo** (grátis; libera estatísticas e categoria) |
| Categoria | **Publisher de jogos** (exibida no perfil; "Jogo eletrônico" não existe na lista) |
| Nome de usuário | **`guardiaodaflorestaofc`** (escolhido pelo Leonardo ao criar a conta). Usar o mesmo no TikTok e no YouTube |
| Nome (aparece na busca) | `Guardião da Floresta · jogo` |
| Foto | ícone do jogo, `lopesleo.github.io/public/guardiao/assets/img/icon-512.png` (o recorte redondo do Instagram não corta o Curupira) |
| Link | `https://komedygames.com/guardiao/?utm_source=instagram&utm_medium=bio` (era o `lopesleo.github.io`; trocado em 20/10/2026) |

**Bio** (cabe nos 150 caracteres):

```
Roguelite com as lendas do folclore brasileiro.
Você só se move. Fogo + Gelo = Vapor.
Grátis de verdade · Android
Jogue antes do lançamento 👇
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
Ainda não está na loja. Quer jogar antes do lançamento? Peça seu convite pelo link na bio.

#jogobrasileiro #indiegame #folclorebrasileiro #roguelite #pixelart #gamedev #jogosmobile
```

### Vídeo promocional (91 s, `guardiao_da_floresta_promo_9x16_1080p.mp4`)

Capa: o título sobre a horda (~0:10), `guardiao_promo_capa.jpg`. Áudio original, compartilhar também no feed.

```
A Podridão tomou a mata. As lendas despertaram. 🌳🔥

Guardião da Floresta é um roguelite brasileiro para Android: você só se move, as armas atacam sozinhas e cada nível traz uma escolha de carta.

🌿 7 lendas do folclore: Curupira, Caipora, Iara, Saci, Comadre Fulozinha, Mãe-do-Ouro e Anhangá
🔥 4 elementos e 6 reações (Fogo + Gelo = Vapor)
⚔️ 18 armas e 18 evoluções
👹 Chefes da Amazônia à Caatinga, e todo golpe avisa antes
🏡 Entre as partidas, a Clareira: plantar, pescar e cozinhar

Grátis de verdade: sem energia, sem gacha, anúncio só se você quiser.
Em breve na Google Play. Quer jogar antes do lançamento? Peça seu convite pelo link na bio.

Qual lenda você escolheria? 👇

#jogobrasileiro #folclorebrasileiro #indiegame #roguelite #pixelart
```

No TikTok, trocar a linha de hashtags por
`#jogobrasileiro #folclorebrasileiro #indiegame #roguelite #pixelart #gamedev #jogosmobile #curupira`.
Comentário para fixar: "Quer jogar antes de todo mundo? Peça seu convite pelo link na bio. É grátis."

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

Roguelite brasileiro com as lendas do folclore, para Android. Jogue antes do lançamento: peça seu convite pelo link na bio.

#jogobrasileiro #indiegame #gamedev #roguelite #folclorebrasileiro #jogosmobile #pixelart
```

**Reel 2 — Lendas**
```
Curupira, Caipora, Iara, Saci, Comadre Fulozinha, Mãe-do-Ouro e Anhangá.

Aqui as lendas são as guardiãs da mata, e o vilão é a Podridão.
Qual delas você escolheria?

Guardião da Floresta · Android · peça seu convite pelo link na bio.

#folclorebrasileiro #curupira #saci #iara #jogobrasileiro #indiegame #pixelart
```

**Reel 3 — Chefes**
```
Todo golpe avisa antes. Dá pra desviar andando ou com o dash.

Mula sem Cabeça, Caboclo d'Água e o Mapinguari, tomados pela Podridão.
Vencer a luta liberta a lenda.

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
primeiras horas); fixar o comentário "Quer jogar antes do lançamento? Peça seu convite pelo link na bio. É grátis."; repostar nos
stories com a enquete "Qual reação?".

---

## 2. Discord

**No ar desde 10/10/2026.** Convite permanente: **https://discord.gg/TTYnNtQAes** (está no rodapé, na
chamada e no kit de imprensa da página oficial).

O servidor inteiro é definido em código, no repositório: `tools/discord/servidor.mjs` (estrutura, cargos,
textos, integração, figurinhas, sons, eventos) e aplicado por `tools/discord/setup.mjs` pela API, com o bot
"Guardião da Floresta". O script é idempotente: procura tudo por nome, edita as mensagens fixas em vez de
repostar e não duplica nada.

```bash
python tools/discord/arte.py          # emojis, figurinhas e sons a partir do jogo (tools/discord/arte/)
node tools/discord/setup.mjs --ver    # mostra o que mudaria
node tools/discord/setup.mjs          # aplica
```

O token do bot fica em `tools/discord/.env` (fora do git). O cargo do bot precisa estar **no topo** da lista
de cargos; senão ele não consegue renomear nem ordenar os cargos acima dele.

### O que tem (seguindo o [guia oficial do Discord para jogos](https://docs.discord.com/developers/game-development/how-to-create-a-community-for-your-game))

| Parte | Como ficou |
|---|---|
| Comunidade | ligada; verificação média, filtro de conteúdo para todos, idioma pt-BR, notificações só de menções |
| INÍCIO (só leitura) | `#boas-vindas`, `#regras`, `#avisos` (anúncios, dá para seguir), `#como-testar`, `#perguntas-frequentes` |
| A CLAREIRA | `#geral`, `#prints-e-clipes`, `#builds-e-reações`, fóruns `#sugestões` (tags + 👍 padrão) e `#bugs` (tags + diretrizes) |
| TESTE FECHADO | `#testadores`, privado (Testador e Equipe) |
| VOZ | `Fogueira` |
| EQUIPE | `#moderação`, privado: alertas do AutoMod e avisos do Discord |
| Cargos | Equipe (moderação), Testador (dado pela Equipe), 7 cargos de lenda favorita (cor do elemento), Novidades (avisos) |
| Integração | 3 perguntas: lenda favorita, o que trouxe a pessoa (abre os canais certos), quer avisos |
| Tela de boas-vindas | 5 atalhos com emojis do jogo |
| AutoMod | palavrões/ofensas, spam, menções em massa (castigo de 10 min), convites de outros servidores |
| Arte do jogo | 40 emojis (lendas, chefes, elementos, reações, itens), 5 figurinhas animadas, 8 sons no painel |
| Eventos | Dia do Saci na Fogueira (31/10, 19h) |

### Rotina

- Aviso em `#avisos` a cada versão de teste e marco do calendário (`docs/MARKETING.md`); marcar o cargo
  Novidades só nos avisos importantes.
- Dar o cargo **Testador** a quem estiver na lista do teste fechado (pelo nome no Discord, não automático).
- Um evento por mês (o próximo depois do Dia do Saci: o lançamento, 03/12).
- Responder `#bugs` e `#sugestões` marcando as tags *Resolvido* e *Planejado* (só a Equipe aplica).

### Falta fazer à mão (a API não cobre)

- **Guia do servidor** (Configurações → Integração → Guia do servidor): placa de boas-vindas, 3 a 5
  tarefas para quem chega e `#como-testar`/`#perguntas-frequentes` como páginas de recursos.
- **Proteção contra raids e CAPTCHA** (Configurações → Configuração de segurança).
