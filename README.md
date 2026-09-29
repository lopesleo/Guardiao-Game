# 🌲 Guardião da Floresta

Roguelite de sobrevivência (*survivor-like*) para **celular Android e navegador**.
Você só se move; as armas atacam sozinhas; cada nível traz uma escolha. A
mecânica-assinatura são as **Reações Elementais**: dois elementos no mesmo
inimigo disparam Vapor, Cristal ou Sobrecarga.

Feito em **JavaScript + Phaser 3**, empacotado para Android com **Capacitor**.
Roda 100% offline.

## Conteúdo

- **6 armas** (Cajado, Aura Gélida, Bumerangue, Raio, Orbe Gélido, Sopro
  Flamejante) e **6 evoluções** (arma nível 5 + arma parceira)
- **4 personagens** jogáveis, cada um com arma inicial e estilo próprios
- **Roteiro de partida**: enxames, cercos, mini-chefes (Lobo Alfa, Ogro Ancião)
  e o chefe final, o Ancião, aos 7:00
- **11 passivas**, baús (normal, dourado, armadilha, mímico)
- **Meta-progressão**: 5 níveis de Perigo, Bênçãos em 5 ranks, Tesouro
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

Veja **[`docs/PLAY_STORE.md`](docs/PLAY_STORE.md)** — build do AAB, ficha da loja,
política de privacidade ([`docs/PRIVACY.md`](docs/PRIVACY.md)).

```bash
npm install
npm run android:sync   # copia o jogo para www/ e sincroniza o projeto android/
npm run android:open   # abre no Android Studio
```

## Arquitetura

```
src/
  art/       paleta única + gerador de pixel-art (cenário, ícones, pickups, FX)
  ui/        kit de UI (Theme: fonte, molduras, botões, barras) + Widgets
             (modal, lista rolável, slider, toggle) + HUD + cartas
  world/     ForestWorld: chão, decoração, muralha de árvores, atmosfera, culling
  scenes/    Boot → Preload → Menu → Game (+ LevelUp, Pause) → GameOver
  entities/  Player, inimigos/chefes, armas/evoluções, pickups, baús
  systems/   reações elementais, spawn, eventos da partida, cartas,
             meta-progressão, configurações, plataforma (Android)
  config.js  todo o balanceamento centralizado
```

A identidade visual é **uma paleta só** (`src/art/Palette.js`): o cenário, os
ícones e a interface são gerados por código com ela, e os personagens vêm de
packs CC0 que compartilham o mesmo contorno escuro — por isso tudo conversa.

## Créditos

Lista completa em [`docs/CREDITS.md`](docs/CREDITS.md) e no menu → Créditos.
Personagens: Kenney (Tiny Dungeon) e Clint Bellanger (Tiny Creatures), CC0 ·
Fonte: Jersey 15 (OFL) · Áudio: vários autores CC0/CC-BY · Motor: Phaser 3 (MIT).

**Autor:** Leonardo Lopes
