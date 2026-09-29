# Vida na Clareira — horta, pesca e cozinha (progressão própria, a serviço da ação)

> Evolução de [`CLAREIRA.md`](CLAREIRA.md) (seções 5–7). Pergunta do Leonardo:
> *"a horta e os peixes estão pequenos? queria um jogo à parte divertido"*.
> Resposta: sim, estavam pequenos — eram só fornecedores de buff. Aqui eles viram
> um **segundo jogo completo**, jogável por si só.
> **Status: coleta de ideias — nada implementado.**

---

## 1. A visão: dois jogos que se alimentam

O modelo é **Dave the Diver**: de dia você mergulha (ação), à noite serve sushi no
restaurante (gestão). Um loop alimenta o outro — "cada mergulho eu penso no próximo
turno do restaurante; cada turno eu anoto o que buscar no próximo mergulho". O jogo
tem **150+ ingredientes e 260 receitas** e vai liberando fazenda, pesqueiro e uma
2ª filial para quebrar a repetição.

No Guardião:

```
   FLORESTA (ação, 7 min)                       CLAREIRA (vida, 1–5 min)
   sobreviver à horda                           pescar · plantar · cozinhar · servir
        │  sementes raras, iscas, madeira,            │  refeições (buff 1 partida),
        │  espíritos resgatados (clientes/NPCs)       │  moedas do restaurante → Bênçãos,
        └──────────────────────────►──────────────────┘  personagens por marcos
                         ◄────────────────────────────
```

- **Regra de ouro (decisão do Leonardo): a Vida na Clareira tem progressão própria
  e é divertida por si, mas existe para APOIAR o jogo principal.** A ação na
  floresta continua sendo o coração do jogo. Na prática:
  - todo resultado da Clareira desemboca na ação (refeições/buffs, moedas para
    Bênçãos, personagens, cosméticos, espíritos aliados);
  - os ingredientes mais valiosos (sementes raras, iscas especiais, madeira)
    **vêm das partidas** — sem jogar a ação, a Clareira estaciona;
  - sessões na Clareira são curtas (1–5 min) e terminam apontando para
    "agora vá jogar uma partida" (ex.: "sua refeição está pronta — use na próxima partida").
- **Dois públicos numa loja só**: ação *e* jogo aconchegante. No Brasil (mais de
  53% dos jogadores são mulheres; *Roblox* é o nº 1 da Google Play e o jogo de
  jardinagem *Grow a Garden* explodiu em 2025) isso amplia muito o alcance.

---

## 2. Pescaria (jogo completo)

### 2.1 Pontos de pesca (6, liberados aos poucos)
| Ponto | Clima | Destaques |
|---|---|---|
| **Lago da Clareira** | calmo | começo; peixes comuns; tutorial |
| **Igarapé** | corredeira estreita | peixes rápidos e "fujões" |
| **Cachoeira** | queda d'água | peixes que **saltam** — variante do minigame: acertar o salto |
| **Mangue** | lama e maré (horário real) | **covos** para caranguejo e camarão (armadilhas passivas) |
| **Várzea alagada** | só existe na **Cheia** (estação) | peixes grandes da Amazônia |
| **Poço da Iara** | noite, lua cheia | lendários e segredos; liberado por história |

### 2.2 Espécies (~45), com peixes **brasileiros de verdade** + místicos
- Comuns: lambari, tilápia, traíra, piaba, cará
- Incomuns: tucunaré, pacu, piau, mandi, jaraqui
- Raros: dourado, pintado, aruanã, tambaqui, **cardume de piranhas** (fisgada múltipla)
- Épicos: pirarara, surubim, peixe-boitatá (místico, em chamas), carpa-luar
- **Lendários** (cada um com uma fase especial no minigame e uma história):
  **Pirarucu Ancião**, **Boto Encantado** (evento noturno), **Guardião do Lago**
- Peixes reais dão charme, curiosidade (educativo sem ser chato) e são exóticos
  para o público de fora.

### 2.3 O minigame (um polegar) com personalidade por espécie
Base: segurar para subir a zona verde, soltar para descer, manter o peixe dentro
até encher (estilo *Stardew*). **Cada espécie se move diferente**:
| Comportamento | Exemplo | Como joga |
|---|---|---|
| Calmo | lambari | sobe e desce devagar |
| Saltador | dourado | pula de repente — antecipe |
| Arrastador | pintado | puxa pro fundo; a **linha** aguenta ou arrebenta |
| Fujão | tucunaré | arrancadas rápidas; o **molinete** ajuda |
| Astuto | aruanã | finge ir pra um lado e volta |
| Cardume | piranhas | vários peixes na barra ao mesmo tempo |

Vibração do celular na fisgada e no esforço. Pegada perfeita ("sem sair da zona")
dá bônus de qualidade.

### 2.4 Tamanho, recordes e coleção
- Cada peixe sai com **tamanho** (curva de raridade): "Tucunaré 58 cm — seu novo recorde!".
- **Coroa** para o maior de cada espécie; recordes pessoais no álbum.
- **Aquário da Clareira**: exibir os peixes vivos, nadando (decoração animada).
- **Álbum aquático** por ponto de pesca (completar dá prêmios) — o "museu" do
  *Animal Crossing*.

### 2.5 Clima, horário e estações
- Horário **real** do celular (dia/noite) e **clima** do dia: sol, chuva,
  tempestade, neblina, lua cheia — cada um muda quem aparece.
- **Estações da Amazônia** em vez de primavera/verão: **Cheia** e **Vazante**
  alternando por semana — abre/fecha a Várzea e troca espécies. Tema único.

### 2.6 Equipamento e extras
- Vara (tamanho da zona verde), molinete (velocidade), linha (aguenta arrastão),
  anzol (chance de raros), iscas (atraem tipos), **lanterna** para pesca noturna
  (usa a iluminação dinâmica!).
- **Tesouros** que vêm no anzol: garrafas com mensagem (pistas de segredos),
  baús do rio, sementes raras.
- **Festival de Pesca semanal**: maior tucunaré da semana (placar Play Games).

---

## 3. Horta (jogo completo)

### 3.1 Terreno que cresce
- Começa **4×4**, expande até **8×8** limpando o mato (tocos, pedras, cipós —
  tocar para limpar; os maiores pedem o João-de-Barro).
- **Colher arrastando o dedo** por cima dos canteiros (gesto satisfatório).

### 3.2 30+ plantas, com a cara do Brasil
| Tipo | Exemplos | Particularidade |
|---|---|---|
| Roçado | **mandioca**, milho, feijão, abóbora | base de receitas |
| Frutíferas (árvores) | **açaí**, cupuaçu, caju, maracujá | demoram a crescer, produzem para sempre |
| Mágicas | flor-de-geada, pimenta-de-brasa, erva-do-trovão, cogumelo-luz | ligadas aos elementos da ação |
| Sombra | cogumelos (canteiro sob árvores) | só crescem sem sol |

### 3.3 Cuidar da horta — inspirado no **Colheita Feliz**
O Colheita Feliz (Orkut, 2009–2010) e o original chinês *Happy Farm* (23 milhões
de jogadores diários no auge) viciaram com um ciclo simples: **plantar → regar →
tirar ervas daninhas e pragas → colher na hora certa**, visitar a fazenda dos
amigos para **ajudar** ou **roubar** a colheita, e um **cachorro de guarda** que
precisava ser alimentado. No Guardião:

- **Estágios visíveis de crescimento** (semente → broto → muda → florindo →
  pronto), cada um com um desenho — ver a planta mudar é metade da graça.
- **Cuidados que aparecem sozinhos**: planta com sede (ícone de gota), **erva
  daninha** brotando, **praga** (lagarta, formiga-cortadeira). Tocar resolve
  (1 toque cada). Cuidar em dia = **mais qualidade**; descuidar só **reduz a
  qualidade** e atrasa — **a planta nunca morre** (o original deixava murchar e
  perder tudo, o que frustra; aqui o castigo é leve).
- **Janela de colheita**: colher no ponto dá bônus; passar muito do ponto cai
  uma estrela de qualidade.
- **O Saci ladrão** (folclore + mecânica do "roubo"): o Saci é famoso por
  travessuras — de vez em quando ele visita a horta e **leva parte da colheita
  madura** se ninguém estiver guardando.
- **Cão-guardião → Lobo-guará**: mascote brasileiro que **protege a horta** do
  Saci. Precisa ser **alimentado** (com comida da cozinha) para ficar de guarda —
  mais um uso para os ingredientes. Evolui com o tempo (e pode ter skins).
- **Social (fase futura)**: visitar a Clareira de amigos (Google Play Games) para
  **regar/tirar pragas** (ganha um pequeno prêmio) e "dar uma de Saci" pegando uma
  fruta madura que o dono esqueceu — só se o lobo-guará dele estiver com fome.
  Gera o ciclo social que fez o Colheita Feliz virar febre; precisa de servidor,
  por isso fica para depois.
- **Marketing de nostalgia**: "lembra do Colheita Feliz?" é um gancho forte para
  o público brasileiro que jogava no Orkut (hoje com 25–40 anos).

### 3.4 Profundidade
- **Qualidade** (comum → prata → ouro → ancestral): adubo, rega em dia, vizinhança.
- **Plantas companheiras**: a técnica indígena das **"três irmãs"** (milho +
  feijão + abóbora juntos crescem melhor) vira bônus de adjacência — verdadeira,
  temática e ensina algo.
- **Mutações** (o que fez *Grow a Garden* explodir): clima e eventos transformam
  a planta visualmente e multiplicam o valor —
  **Orvalhada** (manhã de neblina), **Eletrizada** (tempestade), **Lunar**
  (lua cheia), **Dourada** (rara), **Corrompida** (invasão da Podridão — perigosa,
  mas vale muito). Mutações **fundem** entre si (Lunar + Eletrizada = Estelar).
- **Cruzamento**: duas plantas vizinhas podem gerar uma **variedade híbrida**
  nova (ex.: pimenta-de-geada) — descoberta que ninguém te conta.
- **Culturas gigantes**: 3×3 da mesma planta pode virar uma abóbora gigante.
- **Pragas**: corvos e formigas-cortadeiras visitam — minigame de 10 s para
  espantar, ou construir espantalho.
- **Bichos**: galinheiro (ovos) e **meliponário de abelhas nativas** (jataí →
  mel, que também poliniza e aumenta a qualidade).
- **Composteira**: restos de peixe e da horta viram adubo.
- **Estufa** (construção): planta qualquer coisa em qualquer clima.

---

## 4. Cozinha e o restaurante **Tenda dos Encantados**

### 4.1 Receitas (60+), culinária brasileira + místicas
Moqueca, tacacá, caldeirada, pirão, tapioca, pamonha, curau, pé-de-moleque,
açaí na tigela, **quentão** (Festa Junina), peixe na folha de bananeira… e pratos
místicos (Sopa do Boitatá, Doce da Lua).
- Fórmula simples: **base + ingrediente + tempero** (modelo do *Monster Hunter
  Wilds*); descobrir combinações preenche o **livro de receitas**.
- **Qualidade do prato** = qualidade dos ingredientes + minigame rápido de preparo
  opcional (cortar/mexer no tempo certo, 5 s).

### 4.2 O restaurante (o "Bancho Sushi" da Clareira)
- À noite, **espíritos do folclore** chegam como clientes — Saci, Iara, Boto,
  Caipora, Cuca… — cada um com gostos, pedidos e paciência diferentes.
- Servir dá **moedas, gorjetas e reputação**. Clientes especiais trazem
  **missões** ("o Boto quer um prato de tambaqui dourado") e presentes (receitas,
  sementes, decoração).
- **Reputação** libera decoração, novos clientes, mesas e um **garçom espírito**
  contratável (idle).
- Turnos curtos (1–2 min) — cabem numa pausa.

### 4.3 A ponte com a ação continua
- **1 refeição** antes da partida (2 com Cozinha nv. 3) = buff só daquela partida.
- Moedas do restaurante também compram Bênçãos — **o jogador cozy também
  progride na ação**.

---

## 5. Progressão própria

- **Três ofícios**: Pescador, Agricultor, Cozinheiro — níveis 1 a 30, cada nível
  com uma vantagem (zona verde maior, chance de mutação, gorjeta maior…).
- **Coleções/álbuns**: peixes, plantas, mutações, receitas, clientes atendidos.
- **Conquistas próprias** da Clareira (somam às da ação).
- **Decoração** do acampamento com o que se ganha (troféus de peixe, espantalhos,
  lanternas, bancos) — o lugar fica com a cara do jogador.

---

## 6. Por que isso segura o jogador

- **Sessões de 1–3 min** que não exigem uma partida inteira (ônibus, fila).
- **Coisas que acontecem no tempo real** (plantas crescem, clima muda, lua cheia,
  cheia/vazante) = motivo para abrir todo dia.
- **Colecionar** (álbuns, recordes, mutações) é o motor de longo prazo mais
  confiável do gênero aconchegante.
- **Descoberta** (híbridos, mutações fundidas, segredos nas garrafas) gera
  conversa e vídeos na internet — marketing de graça.

## 7. Riscos

| Risco | Cuidado |
|---|---|
| Escopo enorme | Fases (seção 8); cada fase é uma atualização que traz jogador de volta |
| Dividir a identidade do jogo | Marketing como **"ação + vida na floresta"** (como *Dave the Diver*: dois gêneros, uma identidade) |
| Timers irritantes | Nada bloqueia; tempos curtos no começo; anúncios só opcionais |
| Economia desequilibrar a ação | Moedas do restaurante entram na mesma economia das Bênçãos, com teto diário de clientes |

## 8. Fases sugeridas

| Fase | Conteúdo |
|---|---|
| **V1** | Lago + minigame com 3 comportamentos + 15 peixes + tamanhos/recordes + álbum · Horta 4×4 com 12 plantas, qualidade e 3 mutações · Cozinha com 15 receitas e buff de partida |
| **V2** | **Tenda dos Encantados** (restaurante) com 6 clientes do folclore e reputação |
| **V3** | Igarapé e Cachoeira + estações Cheia/Vazante + Festival de Pesca semanal |
| **V4** | Mutações completas + híbridos + culturas gigantes + abelhas e galinhas + estufa |
| **V5** | Mangue (covos), Várzea, Poço da Iara, lendários, aquário |
| Contínuo | Novos peixes/plantas/receitas por evento (Festa Junina, Dia do Folclore) |

## Fontes

- [Into the depths of Dave the Diver — Game Developer](https://www.gamedeveloper.com/design/dave-the-diver) · [The Genius Goal Loops of Dave the Diver](https://www.linkedin.com/pulse/genius-goal-loops-dave-diver-dan-butchko-g2zwe) · [Dive, Gather, Filet — AV Club](https://www.avclub.com/dave-the-diver-review-gameplay-loop-roguelike-fish-restaurant-management)
- [Best Fishing Game Design Insights](https://aaagameartstudio.com/blog/fishing-game) · [Best Casual Fishing Games 2026](https://gamecentral.blog/best-casual-fishing-games/) · [Fishing — Stardew Valley Wiki](https://stardewvalleywiki.com/Fishing)
- [Crops](https://stardewvalleywiki.com/Crops) · [Fertilizer](https://stardewvalleywiki.com/Fertilizer) · [Giant Crops — TheGamer](https://www.thegamer.com/stardew-valley-giant-crops/) · [Greenhouse](https://stardewvalleywiki.com/Greenhouse) — Stardew Valley
- [Colheita Feliz — Wikipédia](https://pt.wikipedia.org/wiki/Colheita_Feliz) · [Colheita Feliz e mais 4 jogos clássicos do Orkut — TecMundo](https://www.tecmundo.com.br/redes-sociais/237148-colheita-feliz-4-jogos-classicos-orkut.htm) · [Colheita Feliz, mais uma febre no Orkut — Gazeta Digital](https://www.gazetadigital.com.br/suplementos/zine/colheita-feliz-mais-uma-febre-no-orkut/230307)
- [Happy Farm — Wikipedia](https://en.wikipedia.org/wiki/Happy_Farm) · [Crop-stealing on Happy Farm: an addiction to affiliation — China.org.cn](http://www.china.org.cn/china/2009-12/10/content_19044478.htm) · [China's Happy Farm and the Impact of Social Gaming — AAS](https://www.asianstudies.org/publications/eaa/archives/chinas-happy-farm-and-the-impact-of-social-gaming/)
- [Crop Mutations — Grow a Garden Wiki](https://growagarden.fandom.com/wiki/Crop_Mutations) · [Garden — Cookie Clicker Wiki](https://cookieclicker.fandom.com/wiki/Garden) · [Gardening — Palia Wiki](https://palia.wiki.gg/wiki/Gardening)
