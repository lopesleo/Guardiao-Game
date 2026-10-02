# 🌲 Guardião da Floresta: Despertar — Documento de Design & Apresentação

> Documento de revisão para a apresentação da disciplina **P2 (Prof. Dalmo)** — **27/05/2026**.
> Aluno responsável pela entrega: **Leonardo Lopes**.
> Fonte da verdade dos números: `src/config.js`. Este documento explica as **decisões** por trás deles.

---

## 1. Resumo executivo (o "pitch")

**Guardião da Floresta: Despertar** é um *survivor-like* top-down de navegador (JavaScript + Phaser 4), em arena fixa, no qual o jogador sobrevive a hordas crescentes por ~7 minutos até um boss final. O jogador **apenas se move**: as armas atacam sozinhas, e a única decisão tática real acontece nas **cartas de level-up**.

O diferencial que separa o jogo de uma cópia genérica do gênero é a **mecânica-assinatura de Reações Elementais**: cada arma carrega um elemento (🔥 fogo, ❄️ gelo, ⚡ raio); quando um inimigo acumula dois status diferentes, uma **reação dispara automaticamente** (Vapor, Cristal, Sobrecarga).

> **Inspirações:** *Vampire Survivors*, *Megabonk*, *Brotato*. **O que é autoral:** a mecânica de reações, a temática de floresta, o balanceamento e a progressão.

---

## 2. Gênero e pilares de design

A escolha do gênero *survivor-like* é a **decisão raiz** — todas as outras derivam dela:

| Regra do gênero | Consequência de design no jogo |
|---|---|
| O jogador **só se move** | Não há botão de atacar. Todo o combate é automático (mira no inimigo mais próximo). |
| A decisão real é no **level-up** | A profundidade vem da escolha de cartas, não da execução mecânica. |
| A tela **enche de inimigos** | A dificuldade vem da *quantidade*, não de inimigos individualmente difíceis. |
| Uma run é **curta** (~7 min) | Loop "só mais uma run"; meta-progressão entre runs dá sensação de avanço. |

**Pilares que guiaram cada decisão:**
1. **Fidelidade ao gênero.** "Mover apenas; decidir no level-up." Nada de mecânicas ativas que quebrem isso (exceto os dois diferenciais conscientes — Dash e Despertar).
2. **Diferencial anti-cópia.** As Reações Elementais são a defesa contra "isso é só um clone".
3. **Cada commit deixa o jogo rodando.** Sem estados pela metade.
4. **Balanceamento por fórmula**, centralizado em `config.js`.

---

## 3. ★ Mecânica-assinatura: Reações Elementais

**Esta é a parte mais importante para a defesa do trabalho.** É o que torna o jogo autoral.

### Como funciona
- Cada arma tem um **elemento fixo**.
- Ao acertar, a arma aplica um **status** no inimigo, com duração (ver `STATUS` no `config.js`):
  - 🔥 **Fogo** — dano contínuo (DoT), 4s.
  - ❄️ **Gelo** — lentidão (×0,5) + amplificação de dano recebido (+35%), 3s.
  - ⚡ **Raio** — dano contínuo rápido, 2s.
- Quando **dois status diferentes** coexistem no mesmo inimigo, uma **reação** dispara automaticamente e **consome** os status (para não disparar em loop):

| Combinação | Reação | Efeito de design | Papel no jogo |
|---|---|---|---|
| 🔥 + ❄️ | 💨 **VAPOR** | Nuvem escaldante: dano contínuo na área (5/tick) | Dano sustentado em aglomerado |
| ❄️ + ⚡ | 💎 **CRISTAL** | O inimigo estilhaça e fere quem está perto (dano 20); congelado, o estilhaço é 1,8× mais forte e maior | Burst em alvo preparado |
| 🔥 + ⚡ | ⚡ **SOBRECARGA** | Corrente que salta entre 6 inimigos (16/salto) | Recompensa de área em horda |

### Por que isso é bom design
- **Sistema, não conteúdo.** Em vez de criar 30 armas, criamos 3 elementos e deixamos as **combinações** gerarem profundidade — é design emergente.
- **Recompensa a montagem de build.** O jogador é incentivado a pegar armas de elementos diferentes para "ativar a química".
- **Feedback claro** (decisão de UX): toda reação exibe texto flutuante grande (`VAPOR!`, `CRISTAL!`, `SOBRECARGA!`) + efeito visual — o jogador *vê* a mecânica funcionando.

### Decisão de implementação
As reações são **passivas e centralizadas** no `ElementalSystem`. As armas não sabem nada sobre reações — elas só aplicam status. O sistema, a cada tick de dano, verifica se há um par de status mapeado e dispara. Isso mantém as armas simples e as reações em um lugar só.

---

## 4. Decisões de game design, por sistema

### 4.1 Combate automático e mira
- **Decisão:** armas disparam por **cooldown** e miram sozinhas no **inimigo mais próximo no alcance**.
- **Por quê:** é a essência do gênero; tira o "apontar e clicar" e deixa o foco no posicionamento.
- **Piso de cooldown (22% da base):** trava de segurança — sem ela, os multiplicadores de redução de recarga (player × arma × Despertar) empilhavam até disparos a cada ~42ms, um *fire-rate* degenerado.

### 4.2 Armas (4 ativas)
Cada arma ocupa um **papel** distinto, não é redundante:

| Arma | Elemento | Papel | Notas de design |
|---|---|---|---|
| **Cajado** | 🔥 Fogo | Tiro reto base | Sempre desbloqueado; o "feijão com arroz". |
| **Aura Gélida** | ❄️ Gelo | Controle | Campo ao redor do player; quem fica ~1s dentro **congela**. Prepara o Cristal. |
| **Bumerangue** | 🔥 Fogo | Projétil que volta | Acerta na ida e na volta; cobre os lados. |
| **Raio Concentrado** | ⚡ Raio | Dano alto single-target | Estilhaça congelados (Cristal). A "corrente" virou a reação Sobrecarga. |

> **Decisão deliberada:** as **evoluções de arma** foram *desativadas* na entrega. Eram apenas um "Cajado turbinado" sem mecânica própria (código morto/placeholder) — preferimos **não entregar algo sem profundidade** a inflar a lista de features. Ficam documentadas para reativação futura.

### 4.3 Inimigos (variedade por comportamento, não por número)
A variedade vem do **comportamento**, derivado do mesmo vetor de perseguição:
- **Lobo** — perseguidor puro, rápido, base do swarm.
- **Corvo** — rápido, baixo HP, mergulha em arco e flanqueia.
- **Goblin** — mantém distância (~200px) e **atira** projétil.
- **Mago** — lento, projétil **telegrafado** (dá para desviar) — recompensa atenção.
- **Brutamontes** — tanque grande e lento, dano de contato alto — ameaça posicional.
- **Elite / Mímico** — variantes mais fortes (do baú).

### 4.4 Boss — 2 fases
- **Decisão:** 1 boss com **2 fases** (cortamos a 3ª fase do escopo por tempo).
- **Fase 1:** melee + AOE periódico. **Fase 2 (≤50% HP):** invoca trash + projéteis + controle por raízes (prende/atrasa o player, sai com Dash).
- **Telegrafia:** aviso visual aos 6:30, spawn aos 7:00. O jogo inteiro "aponta" para esse clímax.

### 4.5 Level-up e cartas (a única decisão do jogador)
- Ao subir de nível, o jogo **pausa** e oferece **3 cartas**. Escolha por clique **ou tecla (1/2/3)**, com **reroll (R)**.
- **Decisão:** as cartas respeitam as armas **desbloqueadas** — não oferecem o que o jogador não tem.
- **Por quê pausar:** dá tempo de decidir sem morrer; é o momento de respiro e estratégia do gênero.

### 4.6 Upgrades passivos
Oito passivas roláveis (`PASSIVES`), cada uma com valor aleatório: +HP, +Velocidade, −Recarga, +Área, +Projétil, Roubo de Vida, Regeneração, Crítico.
- **Decisão de UX:** o bônus de HP chega **já preenchido** (cura junto) — feedback de tester; pegar +HP e continuar com a barra vazia frustrava.

### 4.7 Diferenciais ativos — Dash e Despertar
Duas exceções **conscientes** ao "só mover", para dar teto de habilidade sem trair o gênero:
- **Dash (Shift/Space):** esquiva rápida com i-frames; serve para sair de área de raízes do boss e desviar de tiros.
- **Despertar (R) ★:** modo fúria temporário. Enche um medidor com **reações** e kills; ativado, dá +velocidade e −recarga.
  - **Decisão de balanceamento:** o medidor **escala com o nível** (`100 + (lvl-1)·25`) para evitar *spam* no late-game.
  - **Sinergia intencional:** o Despertar enche mais com **reações** → reforça o pilar elemental.

### 4.8 Baús / lootbox (risco × recompensa)
- 5 baús na arena + 1 a cada 50 kills. Abrir é uma **aposta** (estética de caça-níquel, com SFX e burst visual):
  - Loot normal (gemas/moedas/coração/orbe), **Dourado** (jackpot, 6%), **Armadilha** (spawna 6 elites, 12%), **Mímico** (inimigo único super-forte, 7%).
- **Inspiração de design:** o mímico é um aceno ao "baú que morde" de *Dark Souls* — ensina o jogador a hesitar.

### 4.9 Meta-progressão (entre runs)
- **Moedas** (`localStorage`, chave `guardiao_save_v1`): dropam de inimigos, bônus grande por vencer o boss (80).
- **Desbloqueios progressivos:** Bumerangue (30) → Raio (60) → Aura (100); Dash (50), Despertar (80).
- **Bênçãos persistentes:** 8 buffs permanentes comprados no menu, aplicados em toda run futura (+HP, +vel, +dano inicial, +coleta, +XP, +crit, recargas de Dash/Despertar).
- **Detecção de modo privado:** avisa por toast que o progresso não será salvo.

---

## 5. Decisões técnicas que sustentam o design

Estas decisões de engenharia existem **a serviço do design** — vale citá-las na apresentação:

| Decisão técnica | Problema que resolve |
|---|---|
| **Arquitetura em 3 camadas** (Scenes / Systems / Entities) | Organização: cada coisa tem um lugar óbvio; fácil de manter e explicar. |
| **Object Pool** (cap 80 inimigos) | Permite milhares de projéteis/inimigos sem o navegador travar (sem *garbage collection* a cada frame). |
| **`config.js` paramétrico** | Todo balanceamento num lugar; tunar é mexer em coeficientes, não caçar números no código. |
| **HUD em cena separada** (overlay) | Pausar o jogo (level-up) sem apagar o HUD. |
| **InputManager unificado** | O jogo lê `move.x/y` sem saber se veio de teclado ou joystick → mobile "de graça". |
| **100% offline** (`vendor/`, `assets/`) | Roda no projetor sem depender de internet; entrega num `.zip`. |

---

## 6. Filosofia de balanceamento

> **Princípio:** preferir **fórmulas paramétricas** a números mágicos. A dificuldade global se ajusta mexendo em coeficientes.

- A dificuldade sobe por **ondas**: `wave = floor(tempo / 30)` — a cada 30s os inimigos ganham HP e dano.
  - `HP(wave) = 12 + 6·wave` · `DMG(wave) = 2 + 1.6·wave` · `SPAWN_RATE(t) = 0,6 + t/75`
- Curva de XP suave no início: `XP_PER_nível = floor(5 + N·4 + N²·0,8)` — evoluir cedo não pode ser lento (feedback de tester).

### Revisão de balanceamento multi-agente (26/05)
Foi feita uma revisão estruturada (designer + papéis de Gênero/Cético/Restrições + árbitro). **Achado-chave:** o problema não era "jogador fraco", e sim **inimigos que não ameaçavam** no late-game. Ajustes aplicados:
- Dano de inimigo `2 + 0,9·wave` → `2 + 1,6·wave`.
- Velocidades subidas (lobo 95→145, goblin 60→105…) — *kiting* trivial era um exploit.
- Cristal: `selfDmg 14→0`, `dmg 12→20` (auto-dano maior que o dano fazia a reação ter valor negativo — virava armadilha).
- Vapor: duração 3000→2200ms (nuvens não têm limite de concorrência).
- Correção de bug: com fogo+gelo+raio juntos, a seleção pegava só os 2 primeiros status e engolia uma reação válida.
- Remoção de **código morto** (scaling de dano de arma que nunca era usado).

> **Lição de processo** (boa para a banca): a maior parte do balanceamento foi **encontrar suposições erradas**, não inventar números.

---

## 7. Por que NÃO é cópia (defesa acadêmica)

1. **Mecânica original.** Reações Elementais com status acumulativos disparando reações **não existem** nos títulos de referência. *Vampire Survivors* tem sinergia de armas, mas não um "sistema químico" de status.
2. **Identidade própria.** Tema de floresta com fauna própria (Guardião, Lobo, Corvo, Goblin, Boss Ent), não os monstros genéricos do gênero.
3. **Conteúdo autoral.** Balanceamento, waves, upgrades, baús/mímico, meta-progressão e narrativa: tudo decidido aqui. **Phaser é apenas o renderizador**, como uma engine de jogo qualquer.

---

## 8. Pesquisa de gênero (o que a comunidade valoriza)

Pilares recorrentes em survivors-like (Vampire Survivors, Brotato, HoloCure):
1. **Variedade de build** (nº1) — combinar/evoluir armas.
2. **Múltiplos personagens** com mecânica única.
3. **Níveis de dificuldade / "Perigo"** que escalam inimigos e recompensa.
4. **Loop "só mais uma run"** com progressão rápida.
5. **Meta-progressão significativa.**

**Onde o jogo já entrega:** pilares 4 e 5 (XP/moedas rápidos, Bênçãos + desbloqueios). **Próximos passos priorizados:** seletor de dificuldade ("Perigo"), evoluções de arma reais, 2º personagem.

---

## 9. Escopo: o que entrou × o que foi cortado

Mostrar gestão de escopo é um ponto forte na apresentação.

**Entregue:** 4 armas, sistema elemental + 3 reações, 6 tipos de inimigo, boss de 2 fases, level-up com cartas/reroll, 8 passivas, Dash + Despertar, baús (4 tipos + mímico), meta-progressão (moedas/bênçãos/desbloqueios), tutorial animado, HUD, pausa, mobile/joystick, áudio completo.

**Cortado conscientemente** (a 2 dias da entrega, para evitar regressão):
- 2º personagem jogável · 5ª arma / 3ª evolução · boss com 3 fases · evoluções de arma (eram placeholder) · testes automatizados (só smoke-test manual) · i18n (só PT-BR).

---

## 10. Linha do tempo de construção (D0 → D4)

O jogo foi construído em fases, cada commit deixando algo jogável:

| Fase | Data | Marco |
|---|---|---|
| **D0** | 23/05 | Pré-produção: git, estrutura de pastas, Phaser + assets CC0, esqueletos de cena, `config.js`, docs. |
| **D1** | 24/05 | Loop jogável mínimo: Player + inimigo + Cajado + gema de XP + spawn + HUD. |
| **D2** | 25/05 | Sistemas core: elemental + reações, level-up + cartas, 3 armas novas, inimigos novos, joystick. |
| **D3** | 26/05 | Boss + meta-progressão + game over narrativo + polish + balanceamento. |
| **D4** | 27/05 | Lapidação: smoke-test, mobile real, bugfixes, build `.zip`. |
| *Refino* | — | Baús/mímico, Dash/Despertar, tutorial animado, pausa dedicada, áudio elemental, revisão multi-agente. |

---

## 11. Créditos e licenças (importante academicamente)

Todos os assets são **livres e creditados** (lista completa em `docs/CREDITS.md` e dentro do jogo):
- **Sprites:** Kenney (Tiny Dungeon, Tiny Town) + Clint Bellanger / Pimen (Tiny Creatures) — **CC0**.
- **SFX:** Kenney Impact Sounds + complementos CC0.
- **Música:** JaggedStone (CC0) + Thalon (CC-BY 4.0).
- **Fonte:** Press Start 2P (OFL). **Engine:** Phaser 4 (MIT) + nipplejs (MIT).

---

## 12. Roteiro sugerido de apresentação (~8–10 min)

1. **Abertura (30s):** o pitch (seção 1) — "survivor-like com reações elementais".
2. **Demo ao vivo (3–4 min):** jogar 1–2 min mostrando: movimento + ataque automático → level-up (escolher carta) → **disparar uma reação** (ex.: Aura congela + Raio = Cristal) → abrir um baú → mostrar o Despertar.
3. **O diferencial (2 min):** explicar as Reações Elementais (seção 3) — o coração da defesa.
4. **Decisões de design (2 min):** 2–3 escolhas com justificativa (seção 4) — ex.: por que cortamos as evoluções; por que o medidor de Despertar escala com nível.
5. **Engenharia a serviço do design (1 min):** pool + `config.js` paramétrico (seção 5/6).
6. **Fechamento (30s):** por que não é cópia (seção 7) + próximos passos (seção 8).

---

## 13. Anexo — perguntas prováveis da banca e respostas

> **"O Phaser não faz o jogo por você?"**
> Phaser é só o renderizador (desenha sprites, física básica, input). Toda a lógica — reações, IA dos inimigos, waves, progressão, boss — é código autoral. É como usar uma engine: o motor não decide o jogo.

> **"Qual a parte original?"**
> O sistema de Reações Elementais (status acumulativos disparando reações automáticas) — não existe assim nos jogos de referência. Mais a temática, o balanceamento e a meta-progressão.

> **"Como você garante que não trava com a tela cheia?"**
> Object pooling: objetos são reaproveitados em vez de criados/destruídos, com teto de 80 inimigos vivos. Evita travadas do coletor de lixo.

> **"Como você balanceou?"**
> Fórmulas paramétricas centralizadas em `config.js` + uma revisão estruturada que descobriu que o problema real era inimigo fraco, não jogador fraco (seção 6).

> **"Roda em celular?"**
> Sim — joystick virtual, botões de toque para as habilidades, layout que se ajusta à tela. O input é unificado, então o mesmo código serve teclado e toque.

> **"Por que cortou features (evoluções, 2º personagem)?"**
> Gestão de escopo a 2 dias da entrega: preferi entregar menos coisas **bem-feitas e profundas** a entregar placeholders. Tudo cortado está documentado para o futuro.

---

*Documento gerado para revisão e apresentação. Para virar slides: cada seção `##` é um slide; as tabelas e listas já são os bullets.*