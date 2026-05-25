# 🌲 Guardião da Floresta: Despertar

Survivor-like top-down em arena fixa: o Guardião enfrenta hordas crescentes durante ~7 minutos até o boss final. Inspirado em *Vampire Survivors* e *Megabonk*, com **mecânica-assinatura própria**: **Reações Elementais** — quando um inimigo acumula dois status elementais diferentes, uma reação dispara automaticamente (Vapor, Cristal Estilhaçado, Sobrecarga).

Construído em **JavaScript + Phaser 3** para navegador web. Tudo offline (libs + assets no `.zip`).

🎮 **Jogue online:** <https://lopesleo.github.io/guardiao-jogo-p2/>
👤 **Aluno responsável pela entrega:** Leonardo Lopes

---

## ▶️ Como rodar

Phaser usa módulos ES, então **não funciona abrindo `index.html` direto** (`file://`). Precisa de um servidor estático local — qualquer um serve.

### Opção A — Python (já vem no Windows/macOS/Linux)
```bash
cd guardiao
python -m http.server 8000
```
Abra no navegador: <http://localhost:8000>

### Opção B — Node.js
```bash
cd guardiao
npx serve .
```

### Opção C — VS Code
Instale a extensão **Live Server** → clique direito em `index.html` → *Open with Live Server*.

> 💡 **Tudo offline:** libs (Phaser, nipplejs) estão em `vendor/`, assets em `assets/`. Não precisa de internet em nenhum momento depois de descompactar o zip.

---

## 🎮 Controles

### Desktop
| Tecla | Ação |
|---|---|
| `W A S D` / setas | Mover |
| `SHIFT` | Dash (esquiva — sai de área de raízes, desvia de tiros) |
| `R` | Despertar (modo fúria temporário) |
| `E` | Abrir baú próximo |
| `M` | Mute/unmute |
| `ESC` | Voltar / Pausar |

> 🔊 No menu há **slider de volume** e botão **⛶ tela cheia** (ambos também úteis no mobile).

### Mobile
- **Joystick virtual** (canto inferior esquerdo) para mover.
- O ataque é **automático** — você só precisa se posicionar.
- 📱 Use em **modo paisagem**.

---

## 🔥 Mecânica-assinatura: Reações Elementais

Cada arma carrega um elemento fixo. Cada elemento aplica um **status** no inimigo. Quando dois status diferentes coexistem no mesmo inimigo, uma **reação** dispara automaticamente:

| Status 1 | Status 2 | Reação | Efeito |
|---|---|---|---|
| 🔥 Fogo | ❄️ Gelo | 💨 **VAPOR** | Nuvem escaldante: dano contínuo na área |
| ❄️ Congelado | ⚡ Raio | 💎 **CRISTAL** | Inimigo congelado **estilhaça** em lascas (dano em área) |
| 🔥 Fogo | ⚡ Raio | ⚡ **SOBRECARGA** | Corrente elétrica salta entre vários inimigos |

> A **Aura Gélida** congela inimigos que ficam tempo demais no seu campo — e um inimigo **congelado** atingido pelo Raio é quem dispara o **Cristal**.

### Evoluções de arma
Quando duas armas atingem o nível máximo, uma combinação específica desbloqueia uma **evolução** na próxima carta de level-up:

- **Cajado** 🔥 + **Aura Gélida** ❄️ → 🌪️ **Tempestade de Vapor**
- **Cajado** 🔥 + **Raio Concentrado** ⚡ → ⚡ **Sobrecarga Eterna**

---

## 🧱 Arquitetura

- `src/scenes/` — máquina de estados (Boot → Preload → Menu → Game → LevelUp → GameOver → Credits)
- `src/entities/` — Player, Inimigos, Armas, Pickups
- `src/systems/` — Elemental, Spawn, Upgrade, Meta-progressão, Input, Audio, Pool
- `src/ui/` — HUD, Cards, Joystick virtual
- `src/config.js` — **todos** os parâmetros de balanceamento centralizados
- `assets/` — sprites, áudio, fonte, tilemaps
- `vendor/` — Phaser e nipplejs (locais, não CDN)
- `docs/` — créditos, balanceamento, arquitetura, smoke-test
- `legacy/` — versões anteriores do projeto (referência histórica)

---

## 💡 Por que não é cópia

1. **Mecânica original** — Reações Elementais com status acumulativos não existem nos titulos referência. Vampire Survivors tem sinergia de armas, mas não tem sistema de status químico/elemental disparando reações.
2. **Identidade própria** — tema da floresta com fauna brasileira/mítica (Guardião, Lobo, Corvo, Goblin, Boss Ent), não os monstros genéricos do gênero.
3. **Conteúdo autoral** — balanceamento, waves, upgrades, sistema de evolução, narrativa: tudo decidido aqui. Phaser é apenas o renderizador.

---

## 📜 Créditos

Lista completa em [`docs/CREDITS.md`](docs/CREDITS.md) e acessível **dentro do jogo** (menu → CRÉDITOS). Resumo:

- Sprites: **Kenney** (Tiny Dungeon, Tiny Town) + **Clint Bellanger** (Tiny Creatures) — todos CC0
- Áudio SFX: **Kenney** Impact Sounds (CC0)
- Música: **JaggedStone** (Loopable Dungeon Ambience, CC0) + **Thalon** (Fantasy Menu Theme, CC-BY 4.0)
- Fonte: **CodeMan38** (Press Start 2P, OFL)
- Engine: **Phaser 3** (MIT) + **nipplejs** (MIT)

---

**Apresentação:** 27/05/2026 — Disciplina P2, Prof. Dalmo.
**Aluno responsável pela entrega:** Leonardo Lopes
