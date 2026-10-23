# 🌲 Guardião da Floresta

Roguelite de sobrevivência (*survivor-like*) para **celular Android e navegador**.
Você só se move; as armas atacam sozinhas; cada nível traz uma escolha. A
mecânica-assinatura são as **Reações Elementais**: dois elementos no mesmo
inimigo disparam Vapor, Cristal ou Sobrecarga.

Feito em **JavaScript + Phaser 4**, empacotado para Android com **Capacitor**.
Roda 100% offline.

**Página oficial:** <https://lopesleo.github.io/guardiao/> (6 idiomas, kit de imprensa).
O jogo está em teste fechado na Google Play; a versão web saiu do ar em 09/10/2026.

## Conteúdo

- **2 mapas (biomas)**: a Floresta Amazônica (chefe Mapinguari) e a **Caatinga**
  (chefe Caboclo d'Água, redemoinhos de poeira), aberta pela obra da Trilha do Sertão
- **4 elementos** (fogo, gelo, raio e vento) e **6 reações**; **18 armas** (fogo:
  Cajado, Vara Encantada, Sopro Flamejante, Açoite de Urtiga, Fogueira de São João;
  gelo: Aura Gélida, Orbe Gélido, Granizo, Miragem, Boleadeira; raio: Raio
  Concentrado, Vaga-lumes, Bola de Ouro, Tambor do Trovão; vento: Redemoinho, Assobio
  da Mata, Folhas ao Vento, Cata-vento), **18 evoluções** e **13 laços** de
  dupla — ver `docs/ARMAS_E_COMBOS.md`; para criar conteúdo, `docs/CONTEUDO.md`
  e `npm run check`
- **7 personagens** jogáveis (Curupira, Caipora, Iara, Saci, Comadre Fulozinha,
  Mãe-do-Ouro, Anhangá), cada um com a arma
  da sua lenda e estilo próprios — ver `docs/TEMA_FOLCLORE.md`
- **Roteiro de partida**: enxames, cercos, minichefes (Mula sem Cabeça, Corpo-Seco)
  e o chefe final, o Mapinguari, no fim da partida — cada um com **golpes especiais
  próprios**, avisos claros e ponto fraco (ver `docs/CHEFES.md`)
- **11 passivas**, baús (normal, dourado, armadilha, mímico)
- **Meta-progressão**: 5 níveis de Perigo, Bênçãos em 10 ranks, Tesouro
  Ancestral infinito, 24 conquistas
- Dicas contextuais na primeira partida; Guia completo no menu

## Rodar no navegador

Precisa de um servidor estático (módulos ES não funcionam via `file://`):

```bash
python -m http.server 8000     # ou: npx serve .
```

Abra <http://localhost:8000>. Ferramentas de desenvolvimento (teclas de debug,
botão de moedas) só aparecem com `?debug=1` na URL.

## Controles

| | Celular | Teclado |
|---|---|---|
| Mover | arrastar o polegar na metade esquerda | WASD / setas |
| Dash | botão redondo grande | SHIFT / ESPAÇO |
| Despertar | botão da estrela | R |
| Abrir baú | encostar no baú | encostar / E |
| Pausar | botão ⏸ ou Voltar do Android | ESC |

## Android / Play Store

Veja **[`docs/PLAY_STORE.md`](docs/PLAY_STORE.md)** — app assinado, ficha da loja,
política de privacidade ([`docs/PRIVACY.md`](docs/PRIVACY.md)).

```bash
npm install
npm run android:install  # app de TESTE no celular plugado (depuração USB)
npm run android:chave    # 1 vez: cria a SUA chave de assinatura (fora do git; faça backup)
npm run android:apk      # APK assinado, anúncios de teste → dist/
npm run android:aab      # AAB assinado para a Play Store, anúncios de verdade → dist/
npm run android:open     # (opcional) abre no Android Studio
```

## Testes

```bash
npm run check            # conteúdo e idiomas (sem navegador)
npm i --no-save playwright-core   # 1 vez; os testes abaixo usam o Edge instalado, headless
npm run test:toque       # joystick com toques simulados: volta depois de carta, pausa, reviver, Jogar de novo
npm run test:compra      # compras (Sem anúncios, kits, pacotes) com loja falsa: reconhecer, pendente, estorno com aviso
npm run test:qualidade   # qualidade automática (desce, sobe, não oscila, escolha manual) e o evento perf_run
npm test                 # todos (~10 min) — obrigatório antes de cada versão da loja
node tools/audio-lab.mjs # som sem navegador: LUFS/pico por camada, emendas, estalos nas trocas, ambiência por hora
                         # (--wav=pasta --png=pasta: para ouvir e ver os espectrogramas)
```

## Arquitetura

```
src/
  art/       paleta única + pixel-art procedural (heróis, bestiário, cenário, ícones, FX)
  audio/     sintetizador (efeitos, músicas, ambiência da Clareira) rodando em Web Workers,
             mixagem por barramentos, música da partida em camadas pela intensidade
  ui/        kit de UI (Theme: fonte, molduras, botões, barras) + Widgets
             (modal, lista rolável, slider, toggle) + HUD + cartas
  world/     ForestWorld: chão (o que é chato numa SpriteGPULayer), decoração, muralha de
             árvores, atmosfera, culling; Lighting (mapa de luz, cogumelos que cintilam à noite);
             Podridao (a borda da tela que avança com a partida)
  scenes/    Boot → Preload → Menu → Game (+ LevelUp, Pause) → GameOver
  entities/  Player, inimigos/chefes, armas/evoluções, pickups, baús
  systems/   reações elementais, spawn, eventos da partida, cartas,
             meta-progressão, configurações, qualidade gráfica automática (Quality),
             plataforma (Android)
  config.js  todo o balanceamento centralizado
```

A identidade visual é **uma paleta só** (`src/art/Palette.js`): heróis,
criaturas, cenário, ícones, efeitos e interface são desenhados por código com
ela. Músicas, efeitos sonoros e a ambiência são sintetizados no carregamento, fora da thread
principal (`src/audio/Synth.js`, `AudioBank.js`; medidas em `node tools/audio-lab.mjs`). O jogo não
usa nenhum asset de terceiros além das fontes.

## Créditos

Lista completa em [`docs/CREDITS.md`](docs/CREDITS.md) e no menu → Créditos.
**Arte e áudio 100% próprios**, gerados por código (`src/art/`, `src/audio/`) ·
Fontes: Jersey 15, Atkinson Hyperlegible e Fusion Pixel (todas OFL) · Motor: Phaser 4 (MIT) · nipplejs (MIT).

Idiomas: português, inglês, espanhol, japonês, chinês simplificado e chinês tradicional (`src/i18n/`, ver
`docs/IDIOMAS.md`).

**Autor:** Leonardo Lopes
