// Boot: garante a fonte pixel carregada ANTES de qualquer texto ser desenhado
// (texto do Phaser é rasterizado uma vez — se a fonte chegar depois, fica a
// fonte de fallback pra sempre naquele objeto).
import { COLORS } from '../config.js';
import { lang, isCJK } from '../i18n/i18n.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.BG);
    const go = () => this.scene.start('PreloadScene');
    try {
      Promise.all([
        document.fonts.load('16px "Jersey 15"'),
        document.fonts.load('bold 16px "Atkinson Hyperlegible"'),
        document.fonts.load('16px "Fusion Pixel Langs"', '日本語简体中文繁體中文'),
        // japonês/chinês: o texto do Phaser é desenhado uma vez, a fonte tem de chegar antes
        ...(isCJK ? [document.fonts.load(`16px "Fusion Pixel ${lang.toUpperCase()}"`, '森')] : []),
      ]).then(go, go);
    } catch {
      go();
    }
  }
}
