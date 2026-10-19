# Cosméticos e novos itens à venda

Ideias anotadas em 19/10/2026 (conversa com o Leonardo), a partir da pergunta "podemos lançar mais itens
para venda?". Status: **ideia + protótipo** (Kit Ipê-rosa, só com `?debug=1&kit=ipe`). Nada aqui está à venda.

## Princípio (não muda)

Vender **só o que não dá vantagem**: sem moedas, sem bênçãos, sem pular o tempo das obras, sem sorteio
(gacha), sem energia. É promessa da ficha da loja ("sem compra de poder") e da `CLAUDE.md`.

## O que vender, por prioridade

1. **Gorjeta ao estúdio** (consumível, R$ 4,90 / 9,90 / 19,90): só um obrigado e um selo de apoiador na
   Clareira. Barata de fazer (janela + produto consumível; o plugin já consome). Para quem comprou o "Sem
   anúncios" e quer apoiar mais.
2. **Kits cosméticos temáticos** (R$ 9,90): um conjunto que vale para **todos os guardiões** de uma vez —
   efeito de libertação + rastro + um enfeite da Clareira. Ver abaixo.
3. **Trajes de silhueta nova**, avulsos (R$ 4,90) ou em pacote: mais caros de fazer (cada herói tem a sua
   função de desenho em `src/art/Hero.js` e as poses de cair/levantar em `src/art/HeroRig.js`).
4. Depois, só com dados de retenção: **bioma novo como expansão** (ex.: Pantanal), como o Vampire Survivors.

Não vender: moedas, bênçãos, atalhos de tempo, baú pago, passe de temporada premium (exige conteúdo novo
toda temporada; só depois dos números de retenção).

## Por que não só trocar a paleta

O herói é pequeno, visto de cima, no meio de centenas de inimigos: cor nova quase não aparece. O que se vê,
em ordem:

| Peça | Quanto aparece | Vale para | Observação |
|---|---|---|---|
| **Efeito de libertação** (o que sai do corrompido ao ser libertado) | centenas de vezes por partida | todos os heróis | conta o tema: "onde a Podridão some, a floresta volta" |
| **Rastro** ao andar e no dash | a partida inteira | todos os heróis | |
| **Traje** (silhueta: chapéu, capa, cabelo, objeto que carrega) | sempre, mas pequeno | 1 herói | precisa redesenhar andar + poses do `HeroRig` |
| **Entrada e vitória** | 2 vezes por partida | todos | é o que se grava e compartilha |
| **Enfeite da Clareira** que o herói usa (rede, bandeirinhas, fogueira de outra cor) | no menu | — | interação, não só objeto parado |

### Ideia forte para trajes: versões regionais das lendas

Cada lenda muda de região para região (a Caipora homem ou mulher, o Curupira amazônico e o do Sul, os vários
Sacis…). Um traje = uma versão real, com história por trás: profundidade cultural, material para as redes
("você conhecia esta versão do Saci?"). Exige pesquisa e os cuidados de `docs/TEMA_FOLCLORE.md` (sem
caricatura; nada de símbolos sagrados de povos indígenas, como cocar).

## Regras de legibilidade (obrigatórias)

- Cosmético **nunca** muda as cores dos elementos (fogo, gelo, raio, vento), dos avisos de perigo, dos
  tiros inimigos nem das gemas de XP (verde, azul, dourada) — passaram pela auditoria de daltonismo.
- O efeito de libertação **soma** ao efeito de morte do elemento (que mostra quem matou, parte da leitura
  das reações); nunca o substitui.
- Movimento e forma diferentes de tudo que é jogo: pétala **cai devagar e gira**; brasa sobe rápido, faísca
  risca, folha de vento voa.
- Teto de custo: matança em massa não pode pesar no aparelho fraco (limite por intervalo e pool fixo).

## Justiça

Cada kit tem uma peça que **também sai jogando** (conquista ou maestria). A loja vende os exclusivos, nunca
todos. Kits com tema brasileiro: ipê, festa junina (junho), carnaval (fevereiro), boi-bumbá de Parintins
(Amazônia, com respeito), cerrado em flor.

## Protótipo: Kit Ipê-rosa (19/10/2026)

Rosa (`PAL.pink`) porque nenhuma cor de jogo usa rosa (só flores e bandeirinhas de decoração); o ipê-amarelo
se confundiria com a gema dourada e as brasas.

- **Libertação:** pétalas de ipê-rosa sobem do corrompido e caem girando; uma flor de ipê **brota no chão**
  onde ele estava, com um brilho rosa fraco (a flor fica abaixo do mapa de luz e sumiria à noite), e murcha
  em ~2 s (no máximo uma flor nova a cada 90 ms, pool de 16).
- **Tapete de ipê:** a pétala que termina a queda pousa no chão e desbota em ~2–3 s (pool de 48) — marca
  onde se lutou, como o chão embaixo de um ipê florido.
- **Rastro:** uma pétala cai atrás dos pés de vez em quando ao andar; no dash, um punhado.
- Código: `src/systems/Cosmetics.js` + texturas em `src/art/CosmeticFX.js`. Liga só com `?debug=1&kit=ipe`.

Rodadas de autocrítica (capturas de partida real, com e sem o kit):
1. Pétala 5×4 e flor clara: viravam **pontinhos (confete)** e a flor se confundia com as florzinhas brancas
   da grama. → pétala 7×5, flor 13×13 rosa com contorno escuro, pétalas que pousam, brilho.
2. Bom no combate normal, mas na **matança em massa** (40 de uma vez) virava nuvem rosa por cima das gemas e
   do baú. → **orçamento total de 14 pétalas por 120 ms** somando todas as mortes (esgotado, a morte fica só
   com o efeito do elemento) e nada fora da tela.
3. Gemas e baú legíveis na matança; rastro e tapete aparecem; sem queda de FPS medida no navegador.

Falta sentir no celular (S23 e um aparelho fraco) e decidir se o Kit vale R$ 9,90 para quem joga.

Próximo passo, se o protótipo convencer: sistema de cosméticos (guardar o que tem e o que está equipado),
guarda-roupa na Clareira, produto no Play Console, peça grátis por conquista.
