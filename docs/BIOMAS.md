# Biomas — novos mapas (pesquisa, proposta e o que já está no jogo)

> **No jogo (out/2026):** Amazônia (o mapa de sempre) e **Caatinga** — ver
> "A Caatinga, como ficou" e "Como adicionar um bioma" abaixo.

> Status: **proposta** (out/2026). Nada implementado ainda. Decisões em aberto no fim.

## O que é cada bioma (IBGE: são seis)

| Bioma | Área do Brasil | O que tem de único | Ameaça real (a "Podridão" de cada mapa) |
|---|---|---|---|
| **Amazônia** | 49,5% | maior biodiversidade do planeta, rios, igapó | desmatamento, garimpo |
| **Cerrado** | 23,3% | savana mais biodiversa do mundo; ipê, pequizeiro, buriti, cupinzeiros, lobo-guará, tamanduá | **queimadas** (35% da área queimada do país em 2024) e desmatamento recorde |
| **Mata Atlântica** | 13% | água de 70% da população; araucária, bromélias, mico-leão | o bioma mais ameaçado: resta ~27% |
| **Caatinga** | 10,1% | só existe no Brasil; mandacaru, juazeiro, umbu, carnaúba, asa-branca | seca e **desertificação** |
| **Pampa** | 2,3% | campos do RS, coxilhas, vento minuano | ~60% já desmatado; arenização |
| **Pantanal** | 1,8% | maior planície alagável do mundo; onça, tuiuiú, jacaré | **incêndios** (2,2 mi ha queimados em 2024) |

Cada mapa conta a sua Podridão com a ameaça verdadeira do lugar (sem discurso: só a
mecânica e o visual): fogo que avança no Cerrado e no Pantanal, terra que racha na
Caatinga, campo que vira areia no Pampa.

## Proposta por bioma

| Bioma | Visual (paleta e cenário) | Perigo do terreno (mecânica) | Lendas | Chefe (corrompido → libertado) | Recurso para a Clareira |
|---|---|---|---|---|---|
| **Amazônia** (o mapa atual) | verde fundo, árvores altas, rios | — | Curupira, Caipora, Iara, Saci | **Mapinguari** (já existe) | — (atual) |
| **Mata Atlântica** | verde úmido, araucárias, bromélias, neblina | **neblina**: visão curta em ondas (a luz do herói importa) | Curupira, Boitatá (Anchieta registrou o "baetatá" em São Vicente, 1560) | **Boitatá** corrompido: a cobra que guarda contra o fogo virou o próprio fogo | sementes de juçara e araucária |
| **Cerrado** | ocre e dourado, ipês floridos, cupinzeiros, buritis | **queimada**: frentes de fogo avançam pelo mapa (avisadas), derrubam inimigos E o herói | Mãe-do-Ouro (Goiás), lobo-guará | a definir (pesquisa) | pequi, baru |
| **Caatinga** ✅ | terra clara rachada, mandacaru, juazeiro, céu branco | **redemoinhos de poeira**: empurram o herói e deixam os inimigos ventados (feito) | Comadre Fulozinha, Caboclo d'Água | **Caboclo d'Água** (feito; Cabeça de Cuia descartado: a lenda é um matricídio) | umbu, caju (depois) |
| **Pantanal** | lâmina d'água, ilhas de mata, aguapés, tuiuiús | **cheia**: áreas alagadas deixam lento (e apagam fogo) | Minhocão, Pé-de-Garrafa, Cabôclo d'Água | **Minhocão**: serpente gigante que sai d'água (luta em torno das ilhas) | peixes do Pantanal no Lago (pacu, pintado) |
| **Pampa** | campo aberto verde-amarelo, coxilhas, pedras, poucas árvores | **minuano**: rajadas de vento empurram tudo (inimigos e projéteis) | Teiniaguá / Salamanca do Jarau (a lenda carrega estereótipo da "princesa moura" — tratar como a salamandra encantada) | a definir | erva, carne? (não: só plantas) |

Regras do tema continuam: lendas como guardiãs; chefe corrompido e libertado;
cuidado com lendas trágicas ou estereotipadas (ver `TEMA_FOLCLORE.md`).

## Como disponibilizar

**Recomendação: vencer abre o caminho; o João-de-barro constrói a trilha.**

1. **Vencer o chefe de um bioma** (qualquer Perigo) revela a **trilha** do próximo
   na Clareira (placa nova na saída norte — hoje a trilha leva só à floresta).
2. A trilha é uma **obra** (madeira + tempo real curto, como as outras): usa o laço
   "Clareira apoia a ação" e dá um objetivo de médio prazo.
3. Cada bioma traz **recursos próprios** para a Clareira (sementes nativas para a
   Horta, peixes novos para o Lago, receitas regionais na Cozinha) e **lendas novas**
   no bestiário. Motivo para voltar a biomas já vencidos.
4. O seletor de Perigo continua global; o bioma escolhido aparece ao lado
   ("Caatinga · Perigo Veterano").
5. **Nunca vender mapa** (regra de justiça). Anúncio, se houver, só o de sempre.

**Lançamento e atualizações:** lançar com Amazônia + 1 bioma; os outros saem como
atualizações gratuitas, cada uma perto do **dia nacional do bioma** (gancho de
divulgação): Caatinga (28/04), Mata Atlântica (27/05), Amazônia (05/09), Cerrado
(11/09), Pantanal (12/11), Pampa (17/12) — *conferir as datas oficiais antes de
usar em campanha*. Festa Junina (junho) casa com a Caatinga/Nordeste.

## A Caatinga, como ficou (primeiro bioma novo)

- **Como abre:** vencer o Mapinguari uma vez revela, na Clareira, a **Trilha do Sertão**
  (a Anciã avisa e brotam mandacarus ao lado da placa da trilha). É uma obra do
  João-de-barro: **600 moedas + 10 madeiras, 1 h** (cada partida adianta, como as outras).
  Pronta, a placa da trilha vira **TRILHA: mapa + Perigo** (o Perigo continua global).
  O selo "!" na placa avisa que há mapa novo ainda não visitado.
- **Cenário** (`src/art/EnvCaatinga.js`): chão de terra seca com rachaduras finas e capim
  queimado; **mandacaru** (braços em L, um com flor), **xique-xique**, **juazeiro** (o verde
  que resiste à seca), árvores secas cinzentas, arbusto de gravetos, **macambira**,
  lajedos claros, barro rachado e areia. Muralha da borda com mais árvore seca e juazeiro.
- **Atmosfera e luz:** poeira arrastada pelo vento (no lugar de vaga-lumes), sol forte no
  começo → noite quente → **azul do rio** quando o chefe chega.
- **Bichos** (mesmo comportamento, arte do sertão): **calango** no lugar do lobo, **carcará**
  no lugar do corvo, **cabeça-de-frade** no lugar do cogumelo.
- **Perigo do terreno — redemoinhos de poeira** (`src/world/DustDevils.js`): andam pelo
  mapa, **empurram o herói em espiral sem dano** (andar sempre vence) e deixam **ventado**
  todo inimigo que passa por eles — o fogo do herói vira Labareda, o gelo vira Geada, o
  raio vira Temporal. O sertão ajuda quem sabe usar o vento. Somem quando o chefe chega.
- **Chefe — Caboclo d'Água** (ver `CHEFES.md`): o guardião do Rio São Francisco, que a
  Podridão trouxe para o sertão seco. Golpes de água + as **carrancas** da lenda.
- **Música** (Synth): "Baião do Sertão" (Sol mixolídio, zabumba, triângulo e sanfona) e
  "Cheia" na luta (xaxado acelerado, escala nordestina).
- **Conquistas:** *Cabra da Peste* (libertar o Caboclo) e *Mestre Carranqueiro*
  (espantá-lo com carrancas 10 vezes).
- **Fica para depois:** recursos da Caatinga na Clareira (umbu, caju na Horta; peixes do
  São Francisco no Lago), minichefes próprios (hoje seguem Mula sem Cabeça e Corpo-Seco —
  a Mula é contada no Nordeste; o Corpo-Seco é mais do Sudeste), lanternas com outra arte.

## Como adicionar um bioma (o framework)

Tudo sai de **uma ficha** em `BIOMES` (`src/config.js`):

```js
pantanal: {
  name: "Pantanal", desc: "…",                    // linha da placa da trilha
  env: "envKeysPantanal",                          // chave no registry (cenário)
  bg: 0x2a4a3a,                                    // cor de fundo da câmera
  light: { dusk: [r,g,b], night: [r,g,b], boss: [r,g,b] },   // mapa de luz
  ambient: { fireflies: 8, leaves: 4, leafTint: 0x…, shaft: 0x…, dust: 0 },
  looks: { wolf: "jacare", crow: "tuiuiu" },       // troca de ARTE (comportamento igual)
  hazard: "cheia",                                 // perigo do terreno (sistema próprio)
  wallPines: 1,                                    // peso das "pines" na muralha
  boss: "minhocao", bossName: "Minhocão", wake: "…", freed: "…",
  music: "music_pantanal", bossMusic: "music_boss_pantanal",
  unlock: { trail: 3, won: "caatinga" },           // nível da obra da Trilha + vitória pedida
}
```

1. **Cenário:** um `src/art/Env<Bioma>.js` com `register<Bioma>(scene)` devolvendo as
   mesmas categorias de `registerEnvironment` (`trees, pines, bushes, rocks, flowers,
   tufts, shrooms, stumps, logs, patches{dark,dirt,moss}` + `atlas` e `ground`). Registre
   na `PreloadScene` com `this.registry.set("envKeys<Bioma>", …)`. O `ForestWorld` lê.
2. **Bichos:** arte em `src/art/Monsters<Bioma>.js` (tiras `mon_<id>` + `<id>_move`),
   registrada na `PreloadScene`; a entrada em `LOOK` (`Enemies.js`); o mapa em `looks`.
3. **Chefe:** arquivo `src/entities/Boss<Nome>.js` com um `Brain` (golpes como os do
   Mapinguari, `brain.threat` preenchido) e `registerBoss(id, { tex, idle, fury, scale,
   body, furySpeed, Brain })`; importe na `GameScene`. Kit de números em `BOSS_FIGHT`.
   Bestiário em `LEGENDS` (quadro 4 da tira = libertado). Rode o **robô justo**.
4. **Perigo do terreno:** sistema pequeno em `src/world/` chamado pela `GameScene`
   (exemplo: `DustDevils`). Regra: avisa, dá para escapar andando, some no chefe.
5. **Música:** `song<Bioma>()` e `songBoss<Bioma>()` em `Synth.js` + `cache.audio.add`.
6. **Desbloqueio:** suba `BUILDINGS.trail.max` e acrescente o custo em
   `BUILDINGS.trail.steps[nível-1]`. O texto da obra e a placa se montam sozinhos.
7. `npm run check` confere: cenário registrado, músicas existem, chefe no bestiário e
   registrado/importado, arte das trocas em `LOOK`, luz completa, desbloqueio alcançável.

## Decisões em aberto

1. ~~Qual o primeiro bioma novo?~~ **Caatinga** (feito). Próximo sugerido: **Pantanal**
   (o Minhocão é o chefe mais "espetáculo"; a cheia como perigo do terreno).
2. **Chefes ainda sem lenda forte**: Cerrado, Pampa — pesquisar com mais calma (e com o
   leitor de folclore). Na Caatinga, o **Caboclo d'Água** resolveu: lenda do São
   Francisco, rio que corta o sertão (o Cabeça de Cuia e o Pai-do-Mato ficaram de fora:
   matricídio / parecido demais com o Mapinguari).
3. ~~Elemento novo junto dos biomas?~~ **Vento** entrou (ver `ARMAS_E_COMBOS.md`); os
   redemoinhos da Caatinga usam o status "ventado".

Fontes: [IBGE Educa — Biomas](https://educa.ibge.gov.br/jovens/conheca-o-brasil/territorio/18307-biomas) ·
[Prepara Enem — Biomas do Brasil](https://www.preparaenem.com/amp/geografia/biomas-brasil.htm) ·
[Brasil de Fato — MapBiomas: incêndios 2024](https://www.brasildefato.com.br/2025/06/24/mapbiomas-incendios-destruiram-area-do-tamanho-de-sp-e-rj-somados-em-2024/) ·
[Monitor Mercantil — área atingida pelo fogo](https://monitormercantil.com.br/brasil-tem-2238-milhoes-de-hectares-atingidos-pelo-fogo-em-nove-meses/) ·
[IHU — Pantanal em risco](https://ihu.unisinos.br/642384-a-sobrevivencia-do-pantanal-corre-serios-riscos) ·
[O Cafezinho — lendas do Pantanal](https://www.ocafezinho.com/2026/06/09/as-lendas-do-pantanal-entre-mitos-e-medo/amp/) ·
[Campo Grande News — lendas de MS](https://www.campograndenews.com.br/lado-b/comportamento-23-08-2011-08/em-ms-lendas-regionais-ainda-sao-desconhecidas-por-muita-gente) ·
[Toda Matéria — lendas do Nordeste](https://www.todamateria.com.br/lendas-da-regiao-nordeste/)
