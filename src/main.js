// Entry point: configura Phaser e registra as cenas.
// D7: Phaser carregado via <script> tag de vendor/ (não CDN).

import { GAME, COLORS } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { CampScene } from './scenes/CampScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { FirstDefeatScene } from './scenes/FirstDefeatScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ReviveScene } from './scenes/ReviveScene.js';
import { EndlessChoiceScene } from './scenes/EndlessChoiceScene.js';
import { setupPlatform } from './systems/Platform.js';
import { Telemetry } from './systems/Telemetry.js';
import { AdMobBridge } from './systems/AdMobBridge.js';
import { Billing } from './systems/Billing.js';
import { News } from './systems/News.js';
import { Notify } from './systems/Notify.js';
import { Leaderboards } from './systems/Leaderboards.js';
import { MetaProgression } from './systems/MetaProgression.js';
import { Clock } from './systems/Clock.js';
import { CloudSave } from './systems/CloudSave.js';
import { installCloudSaveUI } from './ui/CloudSaveUI.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.BG,
  pixelArt: true,
  // Phaser 4: o lote padrão (16384 quads) faz o upload de buffers enormes por quadro e derruba
  // o FPS em GPUs mobile (S23: 14 FPS no título). 2048 → ~75 FPS no título, 120 na partida.
  render: { batchSize: 2048 },
  roundPixels: true,
  // EXPAND: altura lógica fixa (720) e largura acompanha a proporção da tela
  // (celulares 19.5:9 ganham campo de visão lateral em vez de tarjas pretas).
  scale: {
    mode: Phaser.Scale.EXPAND,
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
    TitleScene,
    CampScene,
    GameScene,
    HUDScene,
    LevelUpScene,
    GameOverScene,
    FirstDefeatScene,
    PauseScene,
    ReviveScene,
    EndlessChoiceScene,
  ],
};

window.addEventListener('load', () => {
  // Relógio confiável antes de qualquer sistema com tempo real (horta, obras…)
  Clock.init();
  // Expõe a instância (útil pra testes automatizados e depuração no console)
  window.game = new Phaser.Game(config);
  setupPlatform(window.game);
  Telemetry.install(); // Firebase (só no app Android)
  AdMobBridge.install(); // consentimento (UMP) + anúncios premiados (só no app Android)
  Billing.install(); // compra "Sem anúncios" pela Play Store: preço e o que esta conta já comprou (só no app)
  // Avisos e novidades por notificação (FCM), só para quem aceitou e só com o que o Android deixa mostrar
  Notify.install().then(() => News.install());
  installCloudSaveUI(window.game);
  CloudSave.install(window.game); // progresso na nuvem pelo Play Games (só no app Android)
  Leaderboards.install(new MetaProgression()); // rankings do Play Games: manda o que ficou na fila (só no app)
});
