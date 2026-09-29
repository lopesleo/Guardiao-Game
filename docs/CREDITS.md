# Créditos

Todos os assets de terceiros usados neste projeto, com autor, URL e licença.
Mantemos esta lista atualizada conforme novos assets são adicionados.

---

## Engine & Bibliotecas

| Item | Autor | Versão | Licença | URL |
|---|---|---|---|---|
| Phaser | Photon Storm | 3.80.1 | MIT | <https://phaser.io/> |
| nipplejs | Yoann Moïnet | 0.10.2 | MIT | <https://github.com/yoannmoinet/nipplejs> |

---

## Arte

**100% própria.** Heróis, criaturas, chefe, baús, cenário, ícones, projéteis,
partículas, molduras de UI e ícone do app são gerados por código com uma paleta
única (`src/art/`, `tools/make-icons.py`). Nenhum pack de sprites de terceiros é
usado (os packs Kenney/Tiny Creatures e a bola de fogo de Revon foram removidos).

---

## Áudio — SFX

| Pack | Autor | Licença | URL |
|---|---|---|---|
| Impact Sounds | Kenney | CC0 1.0 | <https://kenney.nl/assets/impact-sounds> |
| Casino Audio | Kenney | CC0 1.0 | <https://kenney.nl/assets/casino-audio> |
| RPG Audio | Kenney | CC0 1.0 | <https://kenney.nl/assets/rpg-audio> |
| UI Audio | Kenney | CC0 1.0 | <https://kenney.nl/assets/ui-audio> |
| 100 CC0 SFX (chest_open, chest_reel) | rubberduck | CC0 1.0 | <https://opengameart.org/content/100-cc0-sfx> |
| 8-Bit Sound Effects Library (chest_jackpot, chest_trap) | Little Robot Sound Factory | CC-BY 3.0 | <https://opengameart.org/content/8-bit-sound-effects-library> |
| Swishes Sound Pack (dash whoosh) | artisticdude | CC0 1.0 | <https://opengameart.org/content/swishes-sound-pack> |
| Electricity Game Sound Pack (raio + sobrecarga) | faxcorp | CC0 1.0 | <https://opengameart.org/content/electricity-game-sound-pack> |
| Ice spells (gelo + cristal) | bart (Bart Kelsey) | CC0 1.0 | <https://opengameart.org/content/ice-spells> |
| Steam release sounds (vapor) | bart (Bart Kelsey) | CC0 1.0 | <https://opengameart.org/content/steam-release-sounds> |
| Spell 4 — fogo "foom" (ataque do Cajado) | Bart K. | CC-BY 3.0 | <https://opengameart.org/content/spell-4-fire> |

**Sons selecionados deste pack (renomeados para clareza):**

| Nome no jogo | Arquivo original |
|---|---|
| `hit_enemy.ogg` | `impactPunch_medium_000.ogg` |
| `enemy_death.ogg` | `impactSoft_heavy_000.ogg` |
| `pickup.ogg` | `impactBell_heavy_000.ogg` |
| `level_up.ogg` | `impactMetal_heavy_000.ogg` |
| `player_hit.ogg` | `impactGlass_heavy_000.ogg` |
| `boss_roar.ogg` | `impactPlate_heavy_000.ogg` |

**Sons elementais (cortados/normalizados em mono a partir dos originais CC0):**

| Nome no jogo | Arquivo original | Pack / Autor |
|---|---|---|
| `fire_attack.wav` (ataque Cajado) | `jm-fx-fireball-01.wav` | Fireball / Julien Matthey |
| `bolt_attack.wav` (ataque Raio) | `hit.wav` | Electricity Game Sound Pack / faxcorp |
| `react_overload.wav` (Sobrecarga) | `crackleelectricityloop.wav` | Electricity Game Sound Pack / faxcorp |
| `ice_attack.wav` (ataque Aura/gelo) | `ice.wav` | Ice spells / bart |
| `react_crystal.wav` (Cristal) | `coldsnap.wav` | Ice spells / bart |
| `react_vapor.wav` (Vapor) | `steam hisses - Marker #5.wav` | Steam release sounds / bart |

---

## Áudio — Música

| Trilha | Autor | Licença | URL |
|---|---|---|---|
| Loopable Dungeon Ambience (gameplay) | JaggedStone | CC0 1.0 | <https://opengameart.org/content/loopable-dungeon-ambience> |
| Fantasy Menu Theme (menu) | Thalon | CC-BY 4.0 | <https://opengameart.org/content/natural-forest-fantasy-music> |

**Atribuição CC-BY:** *"Fantasy Menu Theme" by Thalon, licenciado sob CC-BY 4.0, usado sem modificações.*

---

## Fonte tipográfica

| Fonte | Autor | Licença | URL |
|---|---|---|---|
| Jersey 15 | The Soft Type Project Authors | OFL 1.1 | <https://fonts.google.com/specimen/Jersey+15> |

Empacotada localmente (`assets/fonts/`, licença em `OFL-Jersey15.txt`) — funciona offline.

---

## Resumo de licenças

- **CC0 1.0** (domínio público equivalente): livre para qualquer uso, sem atribuição obrigatória — atribuímos por boa prática.
- **CC-BY 4.0**: livre para qualquer uso **com atribuição** ao autor original. Atribuída acima e na tela de Créditos do jogo.
- **MIT / OFL**: licenças permissivas; mantemos avisos de copyright nos arquivos originais (`vendor/` para JS).
