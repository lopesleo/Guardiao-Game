// Inimigos: Morcego, Corvo, Goblin (atira) + Boss (D3).
import { ENEMY, GAME, COLORS } from '../config.js';

const FRAMES = {
  WOLF:   132,   // Morcego
  CROW:   140,   // pássaro pequeno
  GOBLIN: 10,    // goblin verde
  BOSS:   65,    // ent
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, frame = FRAMES.WOLF) {
    super(scene, x, y, 'creatures', frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE);
    this.body.setCircle(7, 1, 1);

    this.hp = 1; this.maxHp = 1; this.dmg = 1; this.speed = 60;
    this.statuses = {};      // { fire: {until,def,lastTickAt}, ... }
    this.lastTouchAt = 0;
    this.contactCooldownMs = 500;
    this._kind = 'wolf';
    this._vaporUntil = 0;
    this._lastShotAt = 0;
    this._shotCooldownMs = 1800;
    this._shotRange = 260;
  }

  activate(x, y, kind, wave) {
    this._kind = kind;
    this.setActive(true).setVisible(true);
    this.setPosition(x, y);
    this.body.enable = true;
    this.maxHp = ENEMY.HP(wave);
    this.hp    = this.maxHp;
    this.dmg   = ENEMY.DMG(wave);
    this.statuses = {};
    this._vaporUntil = 0;
    this.lastTouchAt = 0;
    this._lastShotAt = 0;
    this.clearTint();
    this.setAngle(0);

    if (kind === 'wolf') {
      this.setFrame(FRAMES.WOLF);
      this.speed = ENEMY.SPEED_WOLF;
      this.maxHp *= 0.7; this.hp = this.maxHp;
    } else if (kind === 'crow') {
      this.setFrame(FRAMES.CROW);
      this.speed = ENEMY.SPEED_CROW;
      this.maxHp *= 0.55; this.hp = this.maxHp;
    } else if (kind === 'goblin') {
      this.setFrame(FRAMES.GOBLIN);
      this.speed = ENEMY.SPEED_GOBLIN;
      this.maxHp *= 1.3; this.hp = this.maxHp;
    } else {
      this.setFrame(FRAMES.WOLF);
      this.speed = ENEMY.SPEED_WOLF;
    }
  }

  deactivate() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
  }

  // Aplicar dano. `element` opcional: se vier, o ElementalSystem aplica status.
  takeDamage(dmg, element = null) {
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    this.hp -= dmg * iceAmp;
    // flash branco
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (!this.active) return;
      // restaura tint elemental se ainda houver status
      this.scene.elemental?._updateTint(this);
    });
    if (element) this.scene.elemental?.applyStatus(this, element);
    return this.hp <= 0;
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;

    // Slow do gelo + vapor
    let slow = 1;
    if (this.statuses.ice) slow *= 0.5;
    if (time < this._vaporUntil) slow *= 0.5;

    const dx = target.x - this.x, dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;

    if (this._kind === 'goblin') {
      // Atirador: mantém distância (~200px) e atira
      const desired = 200;
      const diff = len - desired;
      const sp = this.speed * slow * Math.sign(diff);
      this.setVelocity((dx / len) * sp, (dy / len) * sp);

      if (len <= this._shotRange && time - this._lastShotAt >= this._shotCooldownMs) {
        this._lastShotAt = time;
        this._shoot(target);
      }
    } else if (this._kind === 'crow') {
      // Corvo: ataque em arco — adiciona oscilação lateral
      const perpX = -dy / len, perpY = dx / len;
      const wob = Math.sin(time / 200 + this.x) * 0.5;
      const sp = this.speed * slow;
      this.setVelocity(
        (dx / len) * sp + perpX * sp * wob,
        (dy / len) * sp + perpY * sp * wob
      );
    } else {
      // Morcego (e default): perseguição reta
      const sp = this.speed * slow;
      this.setVelocity((dx / len) * sp, (dy / len) * sp);
    }

    this.setFlipX(dx < 0);
  }

  _shoot(target) {
    const scene = this.scene;
    const proj = scene.enemyProjPool.acquire();
    const dx = target.x - this.x, dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = 180;
    proj.fire(this.x, this.y, (dx / len) * sp, (dy / len) * sp, this.dmg * 1.0);
  }
}

// Projétil simples de inimigo (goblin)
export class EnemyProjectile extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, -9999, -9999);
    scene.add.existing(this);
    this.core = scene.add.circle(0, 0, 6, 0xff5a6e, 1).setStrokeStyle(2, 0x000000, 0.5);
    this.add([this.core]);
    scene.physics.add.existing(this);
    this.body.setCircle(7, -7, -7);
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.dmg = 0;
    this.lifeUntil = 0;
  }
  fire(x, y, vx, vy, dmg) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(vx, vy);
    this.dmg = dmg;
    this.lifeUntil = this.scene.time.now + 3000;
  }
  kill() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }
  update(time) {
    if (!this.active) return;
    if (time >= this.lifeUntil) this.kill();
  }
}
