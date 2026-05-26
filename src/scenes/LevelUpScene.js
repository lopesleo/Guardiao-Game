// Pausa GameScene e mostra 3 cartas. D24: ESC desabilitado.
// Seleção por mouse OU teclas 1/2/3. Reroll (tecla R) troca todas as cartas — 1x por run.
import { GAME, COLORS } from '../config.js';
import { createCard } from '../ui/Cards.js';

export class LevelUpScene extends Phaser.Scene {
  constructor() { super('LevelUpScene'); }

  create(data) {
    this.cards = data.cards;
    this.player = data.player;
    this.gameScene = data.gameScene;
    this._cardObjs = [];
    this.rerollsLeft = 1; // 1 troca por level-up (não acumula entre níveis)

    // Overlay escurecedor
    this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.7).setOrigin(0);

    // Título
    this.add.text(GAME.WIDTH / 2, 80, 'LEVEL UP', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '32px', color: '#d9b25c',
    }).setOrigin(0.5);
    this.add.text(GAME.WIDTH / 2, 130, 'Escolha 1  ·  teclas 1 2 3', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#93a89a',
    }).setOrigin(0.5);

    this._renderCards();
    this._buildReroll();

    // Teclado: 1/2/3 escolhem a carta; R faz reroll.
    this.input.keyboard.on('keydown-ONE',   () => this._pick(0));
    this.input.keyboard.on('keydown-TWO',   () => this._pick(1));
    this.input.keyboard.on('keydown-THREE', () => this._pick(2));
    this.input.keyboard.on('keydown-R',     () => this._reroll());
  }

  _renderCards() {
    // Limpa cartas antigas (usado também no reroll)
    this._cardObjs.forEach((c) => c.destroy());
    this._cardObjs = [];

    const cw = 320, ch = 380;
    const gap = 30;
    const totalW = cw * this.cards.length + gap * (this.cards.length - 1);
    const startX = (GAME.WIDTH - totalW) / 2 + cw / 2;
    const y = GAME.HEIGHT / 2 + 40;

    for (let i = 0; i < this.cards.length; i++) {
      const x = startX + i * (cw + gap);
      const obj = createCard(this, x, y, cw, ch, this.cards[i], (chosen) => this._choose(chosen), i);
      this._cardObjs.push(obj);
    }
  }

  _buildReroll() {
    const y = GAME.HEIGHT - 60;
    this.rerollBtn = this.add.container(GAME.WIDTH / 2, y);

    const bg = this.add.rectangle(0, 0, 360, 44, 0x12241a, 0.95)
                   .setStrokeStyle(2, 0x5cc8ff, 1)
                   .setInteractive({ useHandCursor: true });
    this.rerollTxt = this.add.text(0, 0, '', {
      fontFamily: 'Press Start 2P, monospace', fontSize: '11px', color: '#5cc8ff',
    }).setOrigin(0.5);
    this.rerollBtn.add([bg, this.rerollTxt]);

    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xb8e8ff, 1));
    bg.on('pointerout',  () => bg.setStrokeStyle(2, 0x5cc8ff, 1));
    bg.on('pointerdown', () => this._reroll());

    this._refreshReroll();
  }

  _refreshReroll() {
    const left = this.rerollsLeft || 0;
    if (left > 0) {
      this.rerollTxt.setText(`↻ TROCAR CARTAS [R]  (${left}x)`).setColor('#5cc8ff');
      this.rerollBtn.setAlpha(1);
    } else {
      this.rerollTxt.setText('↻ Sem trocas restantes').setColor('#5a6a60');
      this.rerollBtn.setAlpha(0.5);
    }
  }

  _reroll() {
    if ((this.rerollsLeft || 0) <= 0) return;
    this.rerollsLeft -= 1;
    this.cards = this.gameScene.upgrades.generateCards(this.player);
    this._renderCards();
    this._refreshReroll();
  }

  _pick(i) {
    if (i < this.cards.length) this._choose(this.cards[i]);
  }

  _choose(card) {
    this.gameScene.upgrades.apply(card, this.player);
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
