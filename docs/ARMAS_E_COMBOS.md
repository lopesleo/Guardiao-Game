# Armas e combos — variedade de builds

Plano para dar mais variedade às partidas sem fugir do gênero: **o jogador só se
move; toda decisão acontece nas cartas de nível**. Números ficam em `WEAPONS`
(`src/config.js`); o código das armas, em `src/entities/Weapons.js`.

## Por que

Levantamento de 02/10/2026: o jogo tinha **6 armas e 6 evoluções**, com 4 vagas de
arma por partida. Em 3 a 5 partidas o jogador já tinha visto todas, e as builds
se repetiam. Os elementos também estavam desequilibrados:

| Elemento | Antes | Depois da leva 2 |
|---|---|---|
| Fogo | Cajado, Bumerangue, Sopro | Cajado, Bumerangue, Sopro |
| Gelo | Aura, Orbe | Aura, Orbe, **Granizo** |
| Raio | Raio Concentrado | Raio Concentrado, **Vaga-lumes**, **Redemoinho** |

Com uma arma só, Raio **nunca** ganhava a Ressonância (+15% por arma extra do
mesmo elemento), e o Saci, o guardião de raio, saía perdendo. As conquistas de
mono-gelo e mono-raio também eram impossíveis.

## Regras de design (para toda arma nova)

1. **Um verbo próprio.** Cada arma resolve o combate de um jeito que nenhuma outra
   resolve (mirar, orbitar, cone, campo, teleguiar, chover, puxar...).
2. **Alimenta as reações.** Toda arma aplica o status do seu elemento; a evolução,
   de preferência, **gera uma reação sozinha** (o combo vira a recompensa).
3. **Parceiras espalhadas.** Toda arma base deve ser parceira de alguma evolução,
   assim nenhuma carta é "morta".
4. **Barata no celular.** Simulação própria (sem corpo de física), teto de objetos
   vivos e pouco número de dano em armas que ticam rápido.
5. **Arte própria, uma paleta.** Sprites em `src/art/Sprites.js`, ícones em
   `src/art/Icons.js`; ataque do jogador nunca usa o vermelho de "perigo".

## Leva 2 (feita)

| Arma | Elemento | Verbo | Forja | Custo |
|---|---|---|---|---|
| **Vaga-lumes** | Raio | 3 vaga-lumes teleguiados, cada um caça um inimigo diferente | nv 2 | 90 |
| **Granizo** | Gelo | pedras caem em inimigos ao acaso; quem já estava resfriado **congela** | nv 3 | 150 |
| **Redemoinho** | Raio | funil do Saci que persegue o bando e **puxa** todos para o centro | nv 4 | 220 |

| Evolução | Receita | O que muda | Combo |
|---|---|---|---|
| **Revoada** | Vaga-lumes 5 + Orbe | 5 vaga-lumes; cada um que acerta se divide em 2 | espalha raio em bando |
| **Tempestade de Granizo** | Granizo 5 + Raio | 4 pedras que congelam na hora; um raio do céu estilhaça | **Cristal** sozinho |
| **Redemoinho de Brasa** | Redemoinho 5 + Sopro | funil maior que alterna fogo e raio a cada tique | **Sobrecarga** sozinho |

Ganhos de design:

- **3 armas por elemento.** A Ressonância vale para todos, e builds de um elemento
  só viraram possíveis (conquistas **Coração de Geada** e **Filho do Trovão**).
- **Orbe e Sopro viraram parceiras** (antes nenhuma evolução pedia essas duas).
- **Combos dentro da arma:** Tempestade de Granizo faz Cristal e Redemoinho de
  Brasa faz Sobrecarga sem depender de outra arma. As que já existiam (Vapor do
  Cajado+Aura) seguem pedindo duas armas.
- **Controle de multidão novo:** o Redemoinho é a primeira arma que move os
  inimigos (chefe e minichefes não são puxados).

Teste (Edge headless, 02/10/2026): sem erros, 57–60 FPS com 3 armas novas e
bando cheio; numa janela de 6 s, as 3 evoluções dispararam Sobrecarga 7×,
Cristal 4× e Vapor 1×. As cartas só oferecem arma nova depois de forjada; a carta
de evolução aparece com âncora no nível 5 + parceira, e a evolução herda dano,
recarga, alcance e +1 da âncora.

## Próximas fases (ideias, em ordem de custo/benefício)

### Fase 2 — Laços (combos de dupla)
Duas armas específicas na mesma partida, as duas no nível 3+, ganham um **efeito
extra pequeno**, mostrado na pausa e anunciado com um toast. Não ocupa vaga e não
precisa de carta própria: a decisão continua na carta da arma. Faz das 3 armas
novas parceiras (regra 3). Exemplos:

| Laço | Armas | Efeito |
|---|---|---|
| Olho do Furacão | Redemoinho + Granizo | o granizo prefere cair dentro do funil |
| Noite de São João | Vaga-lumes + Cajado | vaga-lume que acerta inimigo em chamas faz uma faísca de fogo |
| Corredeira | Redemoinho + Aura | inimigo puxado para dentro da aura congela mais rápido |
| Vaga-lume na Neblina | Vaga-lumes + Granizo | vaga-lume que acerta um congelado ganha +1 alvo |

Custo: um sistema (`LINKS` no config + checagem ao pegar carta) e 6 a 9 efeitos
pequenos. Risco: deixar a tela poluída; limitar a 1 efeito visível por laço.

### Fase 3 — Catalisadores (segundo caminho de evolução)
Cada arma ganha uma **segunda evolução** feita com uma **passiva** em vez de uma
arma (estilo Vampire Survivors). Exemplo: Bumerangue 5 + Ímã → bumerangue que
volta puxando gemas. Dobra os caminhos de build e dá peso à escolha das 4 passivas.
A carta de evolução já existe; muda só a receita (`partnerPassive`).

### Fase 4 — Tratos e itens
Tratos da Mata de 5 para ~12 e mais itens de lanterna. É só configuração, e as
partidas ficam menos previsíveis.

### Fase 5 — Mais armas (leva 3)
Só depois de medir com testadores qual elemento é menos escolhido. Ideias no
tema: **Muiraquitã** (gelo, amuleto que reflete projéteis), **Boitatá** (fogo, cobra
de fogo que segue o rastro do herói), **Tambor do Trovão** (raio, onda em anel).

## Como medir

Eventos que já existem no Analytics: `run_end` com as armas. Antes do teste
fechado, vale incluir a **arma escolhida em cada carta de nível** e as **evoluções
obtidas**, para ver o que é escolhido e o que é ignorado (escolha ignorada = arma
fraca ou sem graça).
