// Boot: garante a fonte pixel carregada ANTES de qualquer texto ser desenhado
// (texto do Phaser é rasterizado uma vez — se a fonte chegar depois, fica a
// fonte de fallback pra sempre naquele objeto).
import { COLORS } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.BG);
    const go = () => this.scene.start('PreloadScene');
    try {
      Promise.all([
        document.fonts.load('bold 16px "Pixelify Sans"'),
        document.fonts.load('16px "Pixelify Sans"'),
      ]).then(go, go);
    } catch {
      go();
    }
  }
}
