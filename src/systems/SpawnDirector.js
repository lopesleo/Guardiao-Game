// Variação por wave. Atiradores (goblin) e corvos entram cedo e ficam mais comuns
// com o tempo, pra ter cada vez MAIS inimigos que atacam à distância.
import { GAME, ENEMY } from '../config.js';

export class SpawnDirector {
  constructor(scene, enemyPool, target) {
    this.scene = scene;
    this.pool  = enemyPool;
    this.target = target;
    this.elapsedMs = 0;
    this.spawnAcc = 0;
  }

  update(time, dt) {
    this.elapsedMs += dt;
    const tSec = this.elapsedMs / 1000;
    const spawnMult = this.scene.diff?.spawnMult ?? 1;
    const rate = ENEMY.SPAWN_RATE(tSec) * spawnMult;
    this.spawnAcc += (rate * dt) / 1000;

    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.pool.size >= GAME.MAX_ENEMIES_ALIVE) break;
      this._spawnOne(tSec);
    }
  }

  _spawnOne(tSec) {
    const wave = Math.floor(tSec / 30);
    const roll = Math.random();
    // Mix por wave: atiradores e tipos especiais entram cedo e escalam.
    //   goblin (tiro rápido), crow (mergulha+tiro), mage (tiro telegrafado), brute (tanque)
    const goblinChance = wave >= 1 ? Math.min(0.16 + wave * 0.04, 0.40) : 0;
    const crowChance   = wave >= 1 ? 0.26 : 0;
    const mageChance   = wave >= 3 ? 0.12 : 0;
    const bruteChance  = wave >= 4 ? 0.10 : 0;
    let kind, acc = 0;
    if      (roll < (acc += goblinChance)) kind = 'goblin';
    else if (roll < (acc += crowChance))   kind = 'crow';
    else if (roll < (acc += mageChance))   kind = 'mage';
    else if (roll < (acc += bruteChance))  kind = 'brute';
    else kind = 'wolf';

    const cam = this.scene.cameras.main;
    const radius = Math.max(cam.width, cam.height) * 0.6 + 40;
    const angle = Math.random() * Math.PI * 2;
    const x = this.target.x + Math.cos(angle) * radius;
    const y = this.target.y + Math.sin(angle) * radius;

    const e = this.pool.acquire();
    e.activate(x, y, kind, wave);
  }
}
