# Roadmap — Guardião da Floresta: Despertar

Plano completo até a entrega em **27/05/2026 (quarta-feira)**.

Status: ✅ feito · 🟡 em andamento · ⏳ pendente · ❌ cortado do escopo

---

## ✅ D0 — Pré-produção (23/05 noite)

Commit `4c32add`

- ✅ Git inicializado
- ✅ Estrutura de pastas profissional (`src/scenes`, `src/entities`, `src/systems`, `src/ui`)
- ✅ Phaser 3.80.1 + nipplejs em `vendor/` (100% offline)
- ✅ Assets baixados: Kenney Tiny Dungeon, Tiny Town, Tiny Creatures, Impact Sounds
- ✅ Música: ambient gameplay (CC0) + menu theme (CC-BY)
- ✅ Skeletons de 8 cenas (Boot, Preload, Menu, Game, HUD, LevelUp, GameOver, Credits)
- ✅ `config.js` com fórmulas paramétricas
- ✅ Docs: README, CREDITS, ARCHITECTURE, BALANCING, SMOKE-TEST
- ✅ LICENSE MIT, legado movido para `legacy/`

## ✅ D1 — Gameplay mínimo (24/05)

Commits `56cc9d3` → `08f2582`

- ✅ Pool genérico de objetos
- ✅ InputManager (teclado WASD; joystick fica pra D2)
- ✅ Player com sprite + movimento + HP + XP + level
- ✅ Enemy + Morcego (frame 132) que persegue
- ✅ Weapon + Staff (Cajado) auto-fire no nearest enemy
- ✅ Projectile pooled (graphics colorido)
- ✅ XPGem pooled (diamante verde com glow + magnetismo)
- ✅ SpawnDirector com fórmula de spawn calibrada
- ✅ HUD: HP, XP, level, timer, kills
- ✅ Música ambiente + SFX (hit, death, pickup, level-up, player-hit)
- ✅ Background grama limpa
- ✅ Game over básico (HP=0 → fade → menu)

---

## ✅ D2 — Sistemas core (25/05)

**Marco:** 5 minutos de gameplay com level-ups e reações elementais visíveis.

### Armas (a implementar todas em `src/entities/Weapons.js`)
- ✅ **Aura Gélida** (`AURA`, ❄️) — dano contínuo em raio ao redor do player
- ✅ **Bumerangue** (`BOOMER`, 🔥) — projétil que volta
- ✅ **Raio Encadeado** (`CHAIN`, ⚡) — salta entre até 3 inimigos

### Inimigos (adicionar em `src/entities/Enemies.js`)
- ✅ **Crow** (frame 140) — rápido, baixo HP, pode flanquear
- ✅ **Goblin** (frame 10) — atira projétil; mantém distância

### Sistema Elemental ★ DIFERENCIAL
- ⏳ `src/systems/ElementalSystem.js`
  - Aplicar status (fire/ice/bolt) com expiração
  - Slow do Gelo (multiplica velocidade do inimigo)
  - Amp do Gelo (+35% dano recebido)
  - DoT do Fogo e Raio
- ⏳ Reações automáticas:
  - 🔥+❄️ → **VAPOR** (nuvem 3s lentifica área)
  - ❄️+⚡ → **CRISTAL** (anel explosivo)
  - 🔥+⚡ → **SOBRECARGA** (corrente entre 4 inimigos)
- ⏳ Feedback visual obrigatório: texto flutuante grande + flash
- ⏳ Pool para efeitos de reação

### Level-up
- ⏳ Carta UI (`src/ui/Cards.js`) com ícone + nome + tag (NOVA/UPGRADE/EVOLUÇÃO) + descrição
- ⏳ `src/systems/UpgradeSystem.js` — gera 3 cartas elegíveis
- ⏳ `LevelUpScene` funcional (pausa GameScene, mostra cartas, retorna)
- ⏳ Regra: ESC desabilitado durante LevelUpScene
- ⏳ Indicador "★ EVOLUÇÃO" quando combinação está disponível

### Upgrades passivos
- ⏳ +HP, +Velocidade, -Cooldown, +Área, +Projéteis (já em `config.js`)
- ⏳ Aplicação em Player + propagação para armas

### SpawnDirector D2
- ⏳ Variar tipo de inimigo por wave
- ⏳ Crow aparece após wave 2; Goblin após wave 4

### Mobile (joystick)
- ⏳ `src/ui/VirtualJoystick.js` integrando nipplejs
- ⏳ Detecção de touch device
- ⏳ Overlay landscape-only (já no `index.html`)

---

## 🟡 D3 — Boss + Meta + Polish (26/05)

**Marco:** jogo completo do início ao boss final.

### Boss
- ✅ `BossEnt` em `Enemies.js` (frame 65) com 2 fases
- ✅ Fase 1: melee + AOE periódico
- ✅ Fase 2 (50% HP): invoca trash + projéteis retos
- ✅ Aviso visual aos 6:30, spawn aos 7:00
- ⏳ Arena lock (overlay sutil) — adiado, hordas pausam durante boss
- ✅ Música/SFX de boss-roar

### Meta-progressão
- ✅ `src/systems/MetaProgression.js` com `localStorage`
- ✅ Salvar: moedas totais, high score, armas desbloqueadas
- ✅ Drop de moeda por inimigo (5%)
- ✅ Bônus de vitória do boss (50 moedas)
- ✅ Desbloqueio progressivo: AURA (100), CHAIN (60), BOOMER (30)
- ✅ Detecção de modo privado → toast de aviso

### GameOver narrativo
- ✅ Stats: tempo sobrevivido, kills, dano, moedas ganhas, desbloqueios novos
- ✅ Botão "Jogar Novamente" + "Menu"

### Onboarding
- ✅ Overlay 5s na primeira run: "WASD pra mover, ataque é automático"

### Polish funcional
- ✅ Damage numbers (pooled)
- ✅ Screenshake leve no hit
- ⏳ Tela de pausa básica — adiado (ESC já volta ao menu, suficiente)
- ✅ Mute toggle (M) — funcional, sem ícone HUD

### Balanceamento (2h dedicadas — fim do D3)
- ⏳ Run vencível com Cajado puro em ~70% das tentativas
- ⏳ Boss derrotável em ≤ 60s com build razoável
- ⏳ Reações disparam visivelmente pelo menos 1×/min após wave 3

---

## ⏳ D4 — Lapidação e entrega (27/05 manhã)

**Marco:** `.zip` entregue antes da aula.

- ⏳ Executar `docs/SMOKE-TEST.md` completo
- ⏳ Testar em mobile real (1 celular)
- ⏳ Corrigir bugs críticos descobertos
- ⏳ README final revisado
- ⏳ CREDITS conferido
- ⏳ Gerar `.zip` da pasta
- ⏳ Backup do `.zip` em pendrive/cloud

---

## ❌ Fora do escopo (cortados na arbitragem)

- 2º personagem jogável (era checkbox feature)
- 5ª arma + 3ª evolução (mantemos 4 armas + 2 evoluções)
- Boss com 3 fases (mantemos 2)
- Sliders de volume (só mute toggle)
- Testes automatizados (só smoke checklist manual)
- i18n (PT-BR único)
- Polish visual de bg pesado — só essencial

---

## 🎨 Visual Polish (D4 manhã, se houver tempo)

Lista de coisas que estão funcionais mas feias/discretas — melhorar SÓ depois de tudo o mais estar pronto.

### Reações elementais
- ⏳ **VAPOR**: nuvem mais "desenhada" — múltiplas partículas/poofs em vez de 1 círculo plano; rastro de vapor saindo do inimigo origem; cor com gradiente; talvez pequeno dano contínuo (3/s) pra equilibrar com Cristal/Sobrecarga
- ⏳ **CRISTAL**: estilhaços girando para fora do centro além do anel; partículas azul-claro persistindo 0.5s
- ⏳ **SOBRECARGA**: raio mais grosso, com brilho extra nos vértices do zigzag; flash branco breve em cada inimigo atingido

### Player / armas
- ⏳ **Projétil do Cajado**: trilha curta atrás (3 círculos com alpha decrescente)
- ⏳ **Aura Gélida**: pulsação radial em vez de círculo estático
- ⏳ **Bumerangue**: trail de chamas atrás

### Background
- ⏳ Definir sprites corretos com ajuda do usuário (frames de árvores, pedras, etc do dungeon pack)

### Outros
- ⏳ Sprite do player: trocar pra um do Tiny Creatures se houver melhor (frame 113 witch-staff? 114 druid?)

---

## 🔥 Princípios para o resto da execução

1. **Visual polish é o último passo.** Não mexer no background ou em decorações antes de D2 estar 100% pronto.
2. **Cada commit deve deixar o jogo rodando.** Sem half-states.
3. **Reações elementais são a defesa anti-cópia.** Sem elas o jogo é genérico — prioridade alta no D2.
4. **Mobile é teste do D4.** Não otimizar antes.
5. **Balanceamento por fórmula em `config.js`.** Tweak rápido, sem caçar números no código.
