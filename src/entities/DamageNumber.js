import { fontFamily, fontStyle } from '../ui/Theme.js';
// Damage number flutuante reutilizável (pool).
export class DamageNumber extends Phaser.GameObjects.Text {
  constructor(scene) {
    super(scene, -9999, -9999, '', {
      resolution: 2,
      fontFamily: fontFamily(), fontStyle: fontStyle(),
      fontSize: '16px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    });
    scene.add.existing(this);
    this.setOrigin(0.5).setDepth(59000);
    this.setActive(false).setVisible(false);
    this._tween = null;
  }
  show(x, y, value, color = '#ffffff', big = false) {
    this.setText(typeof value === 'string' ? value : String(Math.ceil(value)));
    this.setColor(color);
    this.setFontSize(big ? 24 : 16);
    this.setStroke('#1a1420', big ? 5 : 4);
    this.setPosition(x + (Math.random() - 0.5) * 16, y - 10);
    this.setActive(true).setVisible(true);
    this.setAlpha(1).setScale(big ? 1.7 : 1); // crítico nasce grande e encolhe (pop)
    if (this._tween) this._tween.stop();
    this._tween = this.scene.tweens.add({
      targets: this,
      y: this.y - (big ? 44 : 30),
      alpha: 0,
      scale: 0.7,
      duration: big ? 750 : 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.setActive(false).setVisible(false);
        this.scene.dmgNumberPool?.release(this);
      },
    });
  }
}
