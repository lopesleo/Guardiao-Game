---
name: balanco
description: "Checa o balanceamento do Guardião com os laboratórios do repo (npm run balance, tools/rx-lab.mjs, tools/bot-lab.mjs) e compara com as metas de docs/BALANCING.md. Use depois de mexer em dano, vida, Perigo, cartas ou chefes, ou quando o Leonardo pedir 'checa o balanço'."
argument-hint: "[armas | reacoes | perigo | chefe | economia]"
user-invocable: true
---

# Checagem de balanceamento

Adaptada do `/balance-check` do Claude-Code-Game-Studios. A diferença: aqui o balanço não se lê só das
tabelas — o jogo roda de verdade nos laboratórios, e o veredito sai da medição.

## 0. Antes de tudo: há dados?

Liste cada entrada que a pergunta precisa e marque **ACHADO** ou **AUSENTE**. Seção sem dado é
**NÃO AVALIADO — SEM DADOS** (diga o que faltou e qual ferramenta produz). Nunca estime no lugar de
medir; um laboratório que não rodou não "passou".

## 1. Ferramentas (servidor: `python videos/promo/tools/serve.py 8151`; `npm i --no-save playwright-core`)

| Pergunta | Ferramenta | O que mede |
|---|---|---|
| Invariantes das tabelas | `npm run balance` | sai com código 1 se um invariante quebrar |
| Fatia das reações no dano | `node tools/rx-lab.mjs saida.json` | robô imortal, cartas por build, minuto a minuto |
| Vitória por Perigo, causa e minuto das mortes | `node tools/bot-lab.mjs medir saida.json` | robô treinado que desvia (sem modo deus) |
| Estratégia degenerada | `bot-lab` com `BUILDS=...` diferentes | uma build que vence tudo, ou um jeito "chato" de vencer |
| Economia | sim. de economia (ver memória `reference_balance_lab`) | dias até comprar tudo |

Sempre ≥ 2 sementes (`SEEDS=11,23`) e compare versões nas MESMAS sementes. `BOOST=1.7` emula um
veterano (bênçãos de dano no máximo).

## 2. Metas (de `docs/BALANCING.md`, `docs/CHEFES.md`, `CLAUDE.md`)

- Reações: 20–35% do dano é a meta; corte se a mediana de um par passar de 50% em vitórias.
- Perigo: Aprendiz/Guardião vencíveis por um jogador comum; Pesadelo difícil, mas não impossível.
- Chefes: dá para desviar de tudo só andando (laboratório de justiça = 0 acertos no robô que anda).
- Partida de ~7 min até o chefe nos Perigos iniciais (`DIFFICULTY[].durationS`).

Valor sem meta escrita: liste como "sem meta — não julgado" (e sugira a meta para o BALANCING.md).

## 3. Relatório

```
## Balanço: <assunto> (<data>)
Fontes: <comandos rodados, sementes, versão/commit>
Saúde: CRÍTICO | ATENÇÃO | NÃO AVALIADO | SAUDÁVEL

| Medida | Meta | Medido | Situação |
Estratégias degeneradas: ...
Recomendações (prioridade, mudança em config.js, impacto esperado): ...
```

Saúde = o pior achado: CRÍTICO (uma escolha domina todas, Perigo impossível/trivial, loop sem
escoadouro) > ATENÇÃO (fora da faixa, corrigível com ajuste) > NÃO AVALIADO > SAUDÁVEL.

## 4. Depois

Mudou número? Mude em `src/config.js`, rode de novo o MESMO laboratório nas MESMAS sementes, e registre
decisão + tabela em `docs/BALANCING.md` (com data). Lembre: o robô não é um jogador — decisões grandes
esperam os dados reais do Analytics (`docs/ARMAS_E_COMBOS.md`, "Como medir").
