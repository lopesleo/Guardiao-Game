# Chefes — golpes especiais e regras de justiça

> Código: `src/entities/Bosses.js` (cérebros e golpes), `src/systems/BossKit.js`
> (relógio do golpe, placar de acertos/desvios, fogo no chão, ponto fraco),
> `src/art/Telegraph.js` (avisos). Números: `BOSS_FIGHT` em `src/config.js`.

## Por que mudou

Antes, a Mula sem Cabeça e o Corpo-Seco eram só "lobos grandes": perseguiam e
batiam no encostão (o bestiário prometia "investidas em chamas" que não existiam).
O Mapinguari tinha golpes genéricos e um combo injusto: as raízes deixavam o herói
lento demais para sair a pé e o baque vinha em cima. **Quem ainda não tinha o Dash
não tinha como escapar.**

## Regras de justiça (valem para os três)

1. **Todo golpe avisa antes, com uma forma própria**, e a forma diz o que fazer:
   círculo = sair dele; cone = sair pelos lados ou para longe; faixa = um passo para
   o lado; anel com brecha = ficar na brecha (em verde); varredura = correr para o
   lado onde a seta começa. A borda branca que cresce é o relógio: fechou, bateu.
2. **Aviso e golpe andam no mesmo relógio** (o do chefe): hit-stop, congelar (Aura,
   Lanterna do Tempo) e pausa param os dois juntos. O aviso nunca "mente".
3. **Dá para desviar de tudo só andando.** O Dash (desbloqueável) facilita, nunca é
   exigido. As raízes só agarram quem tem o Dash pronto.
4. **A área desenhada é a área que fere** (a investida acerta na largura da faixa).
5. **Um golpe por vez**, com fôlego entre um e outro (menor na fase 2).
6. **Avisos acima do mapa de luz**: na noite do chefe, fora da luz do herói, o aviso
   continua visível.
7. **Minichefe só usa golpe dentro da tela.**

## O que recompensa

- **Ponto fraco**: depois de golpes grandes o chefe fica EXPOSTO (anel dourado
  girando, "PONTO FRACO!") e leva **+50%** de dano; o número de dano sai dourado
  e grande. A Bocarra do Mapinguari é ponto fraco **enquanto está aberta** (+70%):
  na lenda, só se fere o Mapinguari pelo umbigo.
- **Desviou!**: cada golpe evitado mostra "DESVIOU!" (ou "ESQUIVOU!" no Dash),
  toca um som e enche um pouco o Despertar.
- **Desviou de tudo**: nenhum golpe especial acertou (com pelo menos 3 tentados) →
  +1 Madeira Ancestral no minichefe, +2 no Mapinguari.
- **Nome do golpe** aparece sob a barra do chefe (ensina e dá sabor).

## Força do chefe e a horda

- **Couraça da Podridão** (`BOSS.ARMOR`): com vida fixa, uma build forte (nível 15, ~300
  de dano/s no chefe) libertava o Mapinguari em ~7 s, antes de ver um golpe. O chefe mede
  o dano que vem levando (média dos últimos ~3 s) e, acima do ritmo que daria uma luta de
  60 s, resiste ao excesso: dano efetivo = ref × (ritmo/ref)^0,45. Quem bate mais vence
  antes, mas sempre há luta. O ponto fraco multiplica **depois** da couraça. Vale para todo
  chefe de bioma. **Revisão 05/10/2026:** o expoente era 0,25 (build 8× mais forte vencia só
  1,7× mais rápido: 60 s → 35 s) e a couraça era invisível — o número na tela mostrava o golpe
  cheio enquanto o chefe perdia bem menos, e a build boa "não parecia servir" contra o chefe.
  Agora, medido no jogo: 35 dano/s → ~51 s (a couraça nem age), 120 → ~29 s, 300 → ~17 s
  (uns 5 golpes, fúria incluída). E ela se mostra: o número exibe o dano **real** (cinza e
  pequeno quando a couraça segurou mais de 25% do golpe; dourado e grande no ponto fraco), o
  chefe pisca cinza-pedra com um anel e lascas da Podridão, e uma dica única ensina a saída:
  acertar o ponto fraco depois dos golpes grandes.
- **A horda não some mais** (`BOSS_FIGHT.ADDS`): ao nascer, o chefe espanta os inimigos de
  tiro (tiro + aviso de golpe deixaria de ser "evitável andando"), os minichefes, os que estão
  onde ele chega e o excesso; ficam os 8 mais perto do herói. Não nasce horda nova durante a
  luta: com reforço contínuo os lobos "comiam" a mira automática e builds fracas levavam de
  2 a 5 min. Libertado o chefe, a horda dele se desfaz.
- **Mira automática** conta a distância até a **borda** do chefe, com preferência (×0,4), para
  a mira não largar o chefe com lobos em volta.
- **Medido** (lab 2026-10-02, partida simulada de 7 min com cartas ao acaso, herói circulando
  o chefe parado, Guardião): ~35–50 dano/s → 55–65 s; ~100–140 → 45–50 s; ~300–370 → ~30 s;
  ~600 (Aprendiz) → 24 s. Antes: 300 de dano/s → 7 s.

## Repertório

### Mula sem Cabeça (minichefe, veloz, fogo)
Na Caatinga ela vira a **Cabra Cabriola**: mesmos golpes e números, arte, nome e faixas
próprios (`BIOMES.caatinga.minis`).
| Golpe | Aviso | Como escapar | Depois |
|---|---|---|---|
| **Galope em Chamas** | empina; faixa travada na direção do herói | passo para o lado | deixa **rastro de fogo**; fica OFEGANTE (ponto fraco) |
| **Coice** | vira o traseiro; cone | sair pela ponta ou pelos lados | ponto fraco curto |
| **Chuva de Brasas** | labareda alta; círculos no chão (um no herói) | sair dos círculos (nunca se tocam: sempre há caminho) | fogo no chão |

Fase 2 (abaixo de 50%, "A MULA DISPARA!"): três galopes seguidos, mais brasas, mais rápida.

### Corpo-Seco (minichefe, lento, resistente)
| Golpe | Aviso | Como escapar | Depois |
|---|---|---|---|
| **A Seca** | braços erguidos; círculo seco em volta dele | sair do círculo | quem fica tem a vida sugada (ele cura); quem fugiu o deixa RESSECADO (ponto fraco) |
| **A Terra o Rejeita** | afunda; montinho aceso e rachadura vêm atrás do herói (mais devagar que ele) | continuar andando; sair do círculo quando ele para | a terra o CUSPE: caído = ponto fraco |
| **Cipós da Podridão** | cruz de faixas mirando o herói | ficar entre as faixas | fase 2: uma segunda cruz em X logo depois (as duas aparecem juntas) |

Escolha: o cérebro não repete os dois últimos golpes, então os três aparecem
mesmo que o herói fique sempre na mesma distância.

### Mapinguari (chefe)
| Golpe | Fase | Aviso | Como escapar |
|---|---|---|---|
| **Bocarra da Barriga** | 1 e 2 | boca enorme, círculo; puxa o herói | andar contra a sucção (ela é mais fraca que o herói); é o ponto fraco |
| **Grito do Mapinguari** | 1 e 2 | anéis de som com uma brecha cada; a brecha da vez em verde | ficar na brecha; a próxima aparece apagada (dá para se adiantar) |
| **Olhar da Podridão** | 2 | setor + seta de onde o feixe começa; ponto cego aos pés | correr para o lado da seta, sair do alcance ou ir aos pés dele; depois, OLHO CANSADO |
| **Baque** | 1 e 2 | círculo em volta dele | sair |
| **Raízes** | 1 e 2 | círculo verde sob o herói | sair andando (preso = baque leve em cima) |
| **Investida** | 2 | faixa | passo para o lado; depois ATOLADO (ponto fraco) |
| **Leque de Espinhos** | 2 | cone | sair do cone; chama corvos |
| **Chamado da Podridão** | 1 | grito | invoca lobos (não conta como golpe) |

Fase 1 é uma rotação fixa que ensina; a Fúria (abaixo de 50%) troca a rotação e
encurta o fôlego.

### Caboclo d'Água (chefe da Caatinga — `src/entities/BossCaboclo.js`)
Guardião do Rio São Francisco: vira a canoa de quem maltrata o rio. A Podridão o
trouxe para o sertão seco, e com ele veio o rio. **A marca da lenda são as CARRANCAS**:
os barqueiros punham figuras de proa para espantá-lo. Aqui três carrancas ficam
fincadas perto do herói (renascem perto dele se quebrarem ou ficarem longe).

| Golpe | Fase | Aviso | Como escapar |
|---|---|---|---|
| **Cheia do Rio** | 1 e 2 | faixas paralelas de água (uma sempre passa pelo herói); na fúria, logo depois, outra cheia **em cruz** centrada no herói | passo para o lado, para a margem entre as faixas |
| **Rebojo** | 1 e 2 | 3 (fúria: 4) redemoinhos; um nasce sob o herói | andar para fora: o puxão é fraco (58) perto do andar do herói (160) |
| **Arrastão** | 1 e 2 | faixa na direção do herói; **se houver carranca no caminho, a faixa para nela** (anel verde) | sair da faixa — ou **ficar atrás da carranca**: ele bate nela, se ESPANTA e fica **2,6 s exposto (×1,8)**; sem carranca, ENCALHADO 0,8 s |
| **Pedras do Rio** | 1 e 2 | 3 (fúria: 5) círculos vermelhos, um de cada vez, onde o herói está | não ficar parado: cada pedra cai onde você estava |
| **Tromba d'Água** | 2 | coluna d'água com círculo que **persegue** (112, mais lenta que o herói); no fim, círculo maior onde ela desaba | manter distância e sair do círculo final; depois, CANSADO (ponto fraco) |
| **Chamado do Sertão** | 1 e 2 | braços erguidos | calangos (e carcarás na fúria); não conta como golpe |

Recompensa da leitura: atrair o Arrastão para uma carranca é a maior janela de dano da
luta. Uma dica (uma vez por save) explica as carrancas quando a luta começa.

## Como foi verificado

**Grito em shader (21/10/2026):** os anéis do Grito eram ~9 mil retângulos por quadro na
fase 1 e ~16 mil na fúria (+15 ms por quadro com CPU 4×). Agora um quad com shader
(`ScreamTele`, em `Telegraph.js`) refaz a mesma arte (grade de 3 px, contorno de tinta,
brecha, miolo branco, arco guia) e o Graphics fica com ~200 retângulos; o custo do golpe caiu
para ~0. Comparação pixel a pixel com o desenho antigo: 98% iguais (a diferença são as
"emendas" do traço antigo). Acerto intocado: robô justo **0 acertos em 12 casos** (2
sementes × 2 fases × 3 distâncias), parado **todos os anéis acertam** — igual à `main`.

**Caboclo d'Água (out/2026):** robô justo, 3 distâncias × 2 fases × 5 golpes, **sem as
carrancas** (o pior caso): **0 acertos**; parado: todos os golpes acertam. Rodada final
com os quatro chefes: **0 acertos em 101 casos**. O robô ganhou duas regras mais
fiéis a uma pessoa: cada círculo tem o próprio tempo de reação (pedras em sequência) e
sumir uma onda já resolvida não reinicia a reação. Raros casos de herói "travado" por
alguns quadros no laboratório sumiram ao instrumentar (relógio simulado + hit-stop) —
anotado como artefato do teste, não visto nas partidas renderizadas.

- **Robô justo** (laboratório no navegador, sem render, relógio simulado): cada golpe,
  das distâncias 90/190/320, nas duas fases, com um jogador-robô que **só anda** (Dash
  desligado) e reage **250 ms** depois do aviso, lendo só o que o aviso mostra
  (`brain.threat`). Resultado: **0 acertos em 73 casos** (duas sementes). Com 350 ms
  de reação, sobravam só as Raízes num herói parado de longe — o aviso subiu para 1,1 s.
- **Controle**: o mesmo teste com o herói parado — os golpes acertam (o Grito acerta
  todos os anéis): ameaçam de verdade.
- **Lutas inteiras** (cérebro escolhendo, armas de verdade, até a morte): sem erros;
  fase 2, prêmios e "desviou de tudo" disparam; todos os golpes aparecem.
- **Capturas renderizadas** de cada golpe (1280×720, 1911×1002 e 844×390).
  Arte nova: `node tools/monster-sheet.mjs saida.png mon_alpha,mon_elder,mon_boss 5`.

Problemas que os testes acharam e que foram corrigidos: aviso das Raízes curto demais;
coice e leque inescapáveis de perto; brecha do Grito andando um arco enorme quando o
herói está longe (agora o passo é limitado em pixels e decidido um anel adiantado);
feixe do Olhar começando em cima do herói; faixa da Investida mais estreita que o
acerto real; brasas se sobrepondo em "muros"; nome do golpe que nunca aparecia (a
barra da HUD não tinha `visible`, o que também quebrava o `topBand`).
