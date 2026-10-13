---
name: revisao-design
description: "Revisa uma novidade do Guardião (arma, carta, laço, guardião, golpe de chefe, cena, texto) contra os pilares do projeto antes do merge. Use ao terminar uma feature, antes do merge na main, ou quando o Leonardo pedir 'revisa o design'."
argument-hint: "[branch ou caminho; padrão = diferença da branch atual para a main]"
user-invocable: true
---

# Revisão de design

Adaptada do `/design-review` do Claude-Code-Game-Studios, enxugada para um projeto de uma pessoa: sem
hierarquia de diretores, com os pilares deste jogo como régua. Responde "isso respeita o que o jogo
prometeu ser?" — não "o código está bonito?" (para isso existe o `/code-review`).

## 1. O que revisar

- Sem argumento: `git diff main...HEAD --stat` e depois o diff completo dos arquivos de `src/`, `docs/`.
- Leia SEMPRE antes de julgar: `CLAUDE.md` (pilares e princípios), e conforme o assunto
  `docs/CHEFES.md` (regras de justiça), `docs/CONTEUDO.md` (checklist de conteúdo), `docs/IDIOMAS.md`,
  `docs/TEMA_FOLCLORE.md` (lendas são aliadas; sem caricatura), `docs/RITMO_E_APRESENTACAO.md`.

## 2. Régua (cada item vira uma linha do relatório)

| # | Pilar | Pergunta | Onde conferir |
|---|---|---|---|
| 1 | Gênero | O jogador só se move? Toda decisão nova acontece numa carta de nível? Nenhum botão novo na ação? | `src/scenes/GameScene.js`, `src/ui/HUD.js` |
| 2 | Justiça | Vende poder? Cria energia, gacha, anúncio obrigatório ou anúncio durante a ação? | `AdService.js`, `config.js` (ADS) |
| 3 | Chefes | Golpe novo segue as 7 regras de `docs/CHEFES.md` (aviso com forma própria, publica `brain.threat`, dá para desviar só andando)? | `src/entities/Bosses.js` |
| 4 | Arte | Gerada por código, só com `src/art/Palette.js`? UI só via `Theme.js`/`Widgets.js`? Nenhum emoji, fonte do sistema ou asset de terceiro? | `src/art/`, `src/ui/` |
| 5 | Idiomas | Todo texto visível passa por `tr()` com `{0}`, nada concatenado? Revisou o SENTIDO nos 6 idiomas (não só preencheu)? Cabe na tela em ja/zh/es? | `src/i18n/`, `npm run check` |
| 6 | Números | Todo número de balanceamento mora em `src/config.js`? | grep de literais nos arquivos novos |
| 7 | Tema | Folclore tratado com respeito; lenda inimiga = corrompida e libertada; vilão = Podridão? | `docs/TEMA_FOLCLORE.md` |
| 8 | Apresentação | Uma novidade por vez; aparece por progresso do jogador (não por dia real)? | `src/systems/Reveal.js` |
| 9 | Clareira | Se mexe na Clareira: apoia a ação sem competir com ela? Automatiza o tedioso, nunca o divertido? | `docs/CLAREIRA.md` |
| 10 | Debug | Nada de debug fora de `?debug=1`? `ADS.TESTING` intocado? | `src/config.js` |

## 3. Veredito

Para cada linha: **OK**, **RESSALVA** (anda, mas anote), **BLOQUEIA** (não faz merge) ou
**NÃO AVALIADO** (a novidade não toca esse pilar, ou faltou o que conferir — diga qual dos dois).

Regra herdada do Game Studios: **ausência de evidência não é evidência de ausência.** Se não deu para
verificar (ex.: o texto novo não foi visto renderizado em japonês), é NÃO AVALIADO, nunca OK.

Veredito geral = o pior item: BLOQUEADO > COM RESSALVAS > APROVADO. Escreva em português, curto:

```
## Revisão de design: <nome da novidade>
Veredito: APROVADO | COM RESSALVAS | BLOQUEADO

| Pilar | Resultado | Evidência (arquivo:linha, captura, comando) |
|---|---|---|

Antes do merge: <lista do que falta, se houver>
```

## 4. Depois

Itens BLOQUEIA se corrigem antes do merge. RESSALVAS vão para o `docs/ROADMAP.md` ou para as
"Pendências atuais" do `CLAUDE.md`. Não corrija nada sem dizer o que mudou.
