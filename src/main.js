// Entry point: configura Phaser e registra as cenas.
// D7: Phaser carregado via <script> tag de vendor/ (não CDN).

import { GAME, COLORS } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { CreditsScene } from './scenes/CreditsScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { TutorialScene } from './scenes/TutorialScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.BG,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME.WIDTH,
    height: GAME.HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  input: { activePointers: 3 },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    HUDScene,
    LevelUpScene,
    GameOverScene,
    CreditsScene,
    PauseScene,
    TutorialScene,
  ],
};

window.addEventListener('load', () => {
  // eslint-disable-next-line no-new
  new Phaser.Game(config);
});
