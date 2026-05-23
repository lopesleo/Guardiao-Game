// Pausa GameScene e mostra 3 cartas. D24: ESC desabilitado.
import { GAME, COLORS } from '../config.js';
import { createCard } from '../ui/Cards.js';

export class LevelUpScene extends Phaser.Scene {
  constructor() { super('LevelUpScene'); }

  create(data) {
    const { cards, player, gameScene } = data;
    this.cards = cards;
    this.player = player;
    this.gameScene = gameScene;

    // Overlay escurecedor
    this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.7).setOrigin(0);

    // Título
    this.add.text(GAME.WIDTH / 2, 80, 'LEVEL UP', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '32px', color: '#d9b25c',
    }).setOrigin(0.5);
    this.add.text(GAME.WIDTH / 2, 130, 'Escolha 1', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#93a89a',
    }).setOrigin(0.5);

    // 3 cartas
    const cw = 320, ch = 380;
    const gap = 30;
    const totalW = cw * 3 + gap * 2;
    const startX = (GAME.WIDTH - totalW) / 2 + cw / 2;
    const y = GAME.HEIGHT / 2 + 40;

    for (let i = 0; i < cards.length; i++) {
      const x = startX + i * (cw + gap);
      createCard(this, x, y, cw, ch, cards[i], (chosen) => this._choose(chosen));
    }
  }

  _choose(card) {
    this.gameScene.upgrades.apply(card, this.player);
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
