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

## Repertório

### Mula sem Cabeça (minichefe, veloz, fogo)
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

## Como foi verificado

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
