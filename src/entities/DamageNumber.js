// Damage number flutuante reutilizável (pool).
export class DamageNumber extends Phaser.GameObjects.Text {
  constructor(scene) {
    super(scene, -9999, -9999, '', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '10px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    });
    scene.add.existing(this);
    this.setOrigin(0.5).setDepth(1500);
    this.setActive(false).setVisible(false);
    this._tween = null;
  }
  show(x, y, value, color = '#ffffff') {
    this.setText(String(Math.ceil(value)));
    this.setColor(color);
    this.setPosition(x + (Math.random() - 0.5) * 16, y - 10);
    this.setActive(true).setVisible(true);
    this.setAlpha(1).setScale(1);
    if (this._tween) this._tween.stop();
    this._tween = this.scene.tweens.add({
      targets: this,
      y: this.y - 30,
      alpha: 0,
      scale: 0.7,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.setActive(false).setVisible(false);
        this.scene.dmgNumberPool?.release(this);
      },
    });
  }
}
