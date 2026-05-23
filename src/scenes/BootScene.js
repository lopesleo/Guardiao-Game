// Boot: configurações globais antes do preload.
import { COLORS } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Carregamos uma fonte de fallback aqui para a tela de preload ter texto bonito.
    // (A WebFont 'Press Start 2P' já vem do <link> em index.html.)
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.BG);
    this.scene.start('PreloadScene');
  }
}
