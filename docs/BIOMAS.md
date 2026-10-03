# Biomas — novos mapas (pesquisa e proposta)

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
| **Caatinga** | terra clara rachada, mandacaru, juazeiro, céu branco | **calor**: miragens no horizonte; poças d'água curam/refrescam | Comadre Fulozinha | a definir (Cabeça de Cuia é do Piauí, mas a lenda é um matricídio — cuidado) | umbu, caju |
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

## Como construir (no mesmo framework de conteúdo)

Uma ficha `BIOMES` em `config.js` e o mundo lendo dela (como armas e guardiões):

```js
caatinga: {
  name: "Caatinga",
  unlock: { after: "amazonia", build: { wood: 20, min: 60 } },
  ground: { ramp: [0xb89a6a, ...], cracks: true },          // chão (gerador de hoje com outra rampa)
  props: { trees: ["mandacaru", "juazeiro"], bushes: [...] }, // geradores em Environment.js
  atmosphere: { particles: "dust", fireflies: false, haze: true },
  light: { dusk: [...], night: [...] },                       // cores do mapa de luz
  roster: { wolf: 1, crow: 1.3, shroom: 0 },                  // pesos do bando (+ variantes)
  hazard: "heat",                                             // mecânica do terreno
  boss: "...", miniBosses: ["mula", "corposeco"],
  music: "music_caatinga", drops: { seeds: ["umbu"] },
}
```

- `ForestWorld` vira `BiomeWorld` (chão, decoração, borda e atmosfera vindos da ficha).
- `SpawnDirector` lê o `roster`; `RunEvents` aceita roteiro por bioma.
- Perigos de terreno como sistemas pequenos (`hazard`), testados como os golpes de chefe
  (aviso claro, dá para desviar).
- O verificador (`npm run check`) passa a conferir os biomas também.

**Custo por bioma** (estimativa): cenário (3–6 geradores novos de árvore/arbusto +
chão) ≈ médio; perigo de terreno ≈ pequeno/médio; **chefe novo ≈ o mesmo trabalho
dos golpes dos chefes atuais** (o maior item); música ≈ pequeno (Synth). Lançar o
primeiro bioma novo exige primeiro o `BiomeWorld` (uma vez só).

## Decisões em aberto

1. **Qual o primeiro bioma novo?** Sugestão: **Caatinga** (contraste visual máximo
   com o verde atual, casa da Comadre Fulozinha, gancho da Festa Junina) ou **Pantanal**
   (o Minhocão é o chefe mais fácil de imaginar e o mais "espetáculo").
2. **Chefes ainda sem lenda forte**: Cerrado, Caatinga, Pampa — pesquisar com mais
   calma (e com o leitor de folclore).
3. **Elemento novo junto dos biomas?** Ver `ARMAS_E_COMBOS.md` → "Vale adicionar mais
   elementos?". Se entrar, o candidato que melhor cabe é **Vento** (Pampa/minuano,
   redemoinho do Saci): cor própria (branco-creme, traço de movimento), verbo de
   empurrar/arrastar, e reações que não brigam com o tema.

Fontes: [IBGE Educa — Biomas](https://educa.ibge.gov.br/jovens/conheca-o-brasil/territorio/18307-biomas) ·
[Prepara Enem — Biomas do Brasil](https://www.preparaenem.com/amp/geografia/biomas-brasil.htm) ·
[Brasil de Fato — MapBiomas: incêndios 2024](https://www.brasildefato.com.br/2025/06/24/mapbiomas-incendios-destruiram-area-do-tamanho-de-sp-e-rj-somados-em-2024/) ·
[Monitor Mercantil — área atingida pelo fogo](https://monitormercantil.com.br/brasil-tem-2238-milhoes-de-hectares-atingidos-pelo-fogo-em-nove-meses/) ·
[IHU — Pantanal em risco](https://ihu.unisinos.br/642384-a-sobrevivencia-do-pantanal-corre-serios-riscos) ·
[O Cafezinho — lendas do Pantanal](https://www.ocafezinho.com/2026/06/09/as-lendas-do-pantanal-entre-mitos-e-medo/amp/) ·
[Campo Grande News — lendas de MS](https://www.campograndenews.com.br/lado-b/comportamento-23-08-2011-08/em-ms-lendas-regionais-ainda-sao-desconhecidas-por-muita-gente) ·
[Toda Matéria — lendas do Nordeste](https://www.todamateria.com.br/lendas-da-regiao-nordeste/)
