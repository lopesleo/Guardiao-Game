# Arquitetura

## Visão geral

O jogo segue uma divisão clássica em 3 camadas:

```
┌─────────────────────────────────────────────┐
│  SCENES (máquina de estados)                │
│  Boot → Preload → Menu → Game → LevelUp     │
│                          ↓                   │
│                       GameOver → Credits     │
└─────────────────────────────────────────────┘
          ↓ usa
┌─────────────────────────────────────────────┐
│  SYSTEMS (regras transversais)              │
│  Elemental, Spawn, Upgrade, MetaProgression │
│  Input, Audio, Pool                          │
└─────────────────────────────────────────────┘
          ↓ opera em
┌─────────────────────────────────────────────┐
│  ENTITIES (o que existe no mundo)           │
│  Player, Enemies, Weapons, Pickups          │
└─────────────────────────────────────────────┘
```

## Princípios

1. **`config.js` centraliza balanceamento.** Nenhum número mágico em outro arquivo.
2. **Pooling obrigatório** para projéteis, inimigos, damage numbers e efeitos de reação (D18: cap 80 inimigos vivos).
3. **Reações elementais são passivas** (D11). Cada arma tem elemento fixo. `ElementalSystem` checa, a cada tick de dano, se o inimigo acumulou 2 status diferentes e dispara a reação.
4. **HUD é uma cena separada** (`HUDScene`) rodando em overlay sobre `GameScene`. Permite pausar uma sem afetar a outra.
5. **Input unificado** (`InputManager`) — abstrai teclado e joystick virtual; o resto do código só lê `inputManager.move.x/y`.

## Fluxo de uma run

```
MenuScene.JOGAR
  └─ scene.start('GameScene')
       ├─ launch('HUDScene')
       ├─ SpawnDirector inicia timeline 0–420s
       ├─ Player atira armas automaticamente (auto-aim)
       ├─ Inimigos morrem → dropam XP gem / coin
       ├─ XP cheia → pause + launch('LevelUpScene')
       │              └─ jogador escolhe carta → resume
       ├─ t = 420s → SpawnDirector trava spawn, spawna Boss
       └─ HP zerou OU Boss morreu
           └─ launch('GameOverScene') com payload (stats, coins, unlocks)
```

## Reações elementais em detalhe

```
Enemy.takeDamage(dmg, element):
  this.hp -= dmg * (this.statuses.ice ? 1.35 : 1)
  this.applyStatus(element)   // adiciona à lista de status ativos
  ElementalSystem.checkReaction(this)
    └─ se tem 2 status diferentes:
         trigger reação (Vapor/Cristal/Sobrecarga)
         consumir os 2 status (evita disparo contínuo)
         spawn efeito visual + texto flutuante
```

## Meta-progressão

- `MetaProgression` lê/escreve em `localStorage` chave `guardiao_save_v1`
- Estrutura salva:
  ```json
  {
    "totalCoins": 0,
    "highScoreSeconds": 0,
    "unlockedWeapons": ["STAFF"]
  }
  ```
- Modo privado/anônimo: detectado e exibe toast 3s avisando que progresso não será salvo.
