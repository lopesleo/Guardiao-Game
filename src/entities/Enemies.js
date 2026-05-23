// Inimigos: base + Wolf (D1). Crow/Goblin/Boss virão em D2/D3.
import { ENEMY, GAME } from '../config.js';

// Frames do creatures_packed (10 cols, 180 frames). Mapeados via labeled preview.
const FRAMES = {
  WOLF:   132,   // lobo cinza
  CROW:   140,   // pássaro pequeno escuro
  GOBLIN: 10,    // goblin verde
  BOSS:   65,    // ent / criatura-árvore grande
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, frame = FRAMES.WOLF) {
    super(scene, x, y, 'creatures', frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GAME.PIXEL_SCALE);
    this.body.setCircle(7, 1, 1);

    // Estado (resetado em activate())
    this.hp = 1;
    this.maxHp = 1;
    this.dmg = 1;
    this.speed = 60;
    this.statuses = {};       // { fire: expireAt, ice: ..., bolt: ... }
    this.lastTouchAt = 0;
    this.contactCooldownMs = 500;
    this._kind = 'wolf';
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
    this.lastTouchAt = 0;
    this.clearTint();

    if      (kind === 'wolf')   { this.setFrame(FRAMES.WOLF);   this.speed = ENEMY.SPEED_WOLF; }
    else if (kind === 'crow')   { this.setFrame(FRAMES.CROW);   this.speed = ENEMY.SPEED_CROW; }
    else if (kind === 'goblin') { this.setFrame(FRAMES.GOBLIN); this.speed = ENEMY.SPEED_GOBLIN; }
    else                        { this.setFrame(FRAMES.WOLF);   this.speed = ENEMY.SPEED_WOLF; }
  }

  deactivate() {
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
  }

  takeDamage(dmg, element = null) {
    // Status Ice amplifica dano recebido (config STATUS.ICE.damageAmp)
    const iceAmp = this.statuses.ice ? 1.35 : 1;
    this.hp -= dmg * iceAmp;
    // flash branco
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.clearTint());
    if (element) this._applyStatus(element);
    return this.hp <= 0;
  }

  _applyStatus(element) {
    // Aplicado pelo ElementalSystem em D2 (config STATUS).
    // Por ora: marca, expiração simples.
    const now = this.scene.time.now;
    this.statuses[element] = now + 3000;
  }

  update(time, dt, target) {
    if (!this.active || !target?.active) return;
    // Status expirados
    for (const k in this.statuses) {
      if (this.statuses[k] < time) delete this.statuses[k];
    }
    // Slow do gelo
    const slow = this.statuses.ice ? 0.5 : 1;
    // Persegue o player
    const dx = target.x - this.x, dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.speed * slow;
    this.setVelocity((dx / len) * sp, (dy / len) * sp);

    // Sprite face direção
    this.setFlipX(dx < 0);
  }
}
