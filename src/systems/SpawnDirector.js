// Variação por wave: morcego sempre, crow após wave 2, goblin após wave 4.
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
    const rate = ENEMY.SPAWN_RATE(tSec);
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
    let kind;
    if (wave >= 4 && roll < 0.18) kind = 'goblin';
    else if (wave >= 2 && roll < 0.45) kind = 'crow';
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
