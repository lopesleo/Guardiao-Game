// Spawna inimigos ao longo do tempo. D1: só wolves; D2: crows/goblins; D3: boss.
import { GAME, ENEMY } from '../config.js';

export class SpawnDirector {
  constructor(scene, enemyPool, target) {
    this.scene = scene;
    this.pool  = enemyPool;
    this.target = target;
    this.elapsedMs = 0;
    this.spawnAcc = 0;   // acumulador de "fração de inimigo" por frame
  }

  update(time, dt) {
    this.elapsedMs += dt;
    const tSec = this.elapsedMs / 1000;

    // Acumula spawn por segundo conforme ENEMY.SPAWN_RATE
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
    // D1: só wolf. D2 vai destravar outros tipos.
    const kind = 'wolf';

    // Spawna em raio fora da câmera, ao redor do player
    const cam = this.scene.cameras.main;
    const radius = Math.max(cam.width, cam.height) * 0.6 + 40;
    const angle = Math.random() * Math.PI * 2;
    const x = this.target.x + Math.cos(angle) * radius;
    const y = this.target.y + Math.sin(angle) * radius;

    const e = this.pool.acquire();
    e.activate(x, y, kind, wave);
  }
}
