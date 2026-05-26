// Carta de level-up — visual de UI.
// Layout: tag (NOVA/UPGRADE/EVOLUÇÃO), título, descrição.
import { COLORS } from '../config.js';

const TAG_COLORS = {
  new:       { bg: 0x6fcf6f, label: 'NOVA' },
  upgrade:   { bg: 0xd9b25c, label: 'UPGRADE' },
  evolution: { bg: 0xd98cff, label: '★ EVOLUÇÃO' },
  passive:   { bg: 0x5cc8ff, label: 'PASSIVA' },
};

export function createCard(scene, x, y, w, h, card, onClick, index) {
  const container = scene.add.container(x, y);

  // Fundo
  const bg = scene.add.rectangle(0, 0, w, h, 0x0a1a10, 0.95)
                  .setStrokeStyle(3, 0xd9b25c, 1);
  container.add(bg);

  // Selo com o número da tecla (1/2/3) no canto inferior esquerdo
  if (index != null) {
    const keyBg = scene.add.circle(-w / 2 + 26, h / 2 - 26, 18, 0xd9b25c, 1)
                       .setStrokeStyle(2, 0x0a1a10, 1);
    const keyTxt = scene.add.text(-w / 2 + 26, h / 2 - 26, String(index + 1), {
      fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#0a1a10',
    }).setOrigin(0.5);
    container.add([keyBg, keyTxt]);
  }

  // Tag colorida
  const tag = TAG_COLORS[card.type] || TAG_COLORS.passive;
  const tagBg = scene.add.rectangle(0, -h / 2 + 18, w - 24, 22, tag.bg, 1);
  const tagTxt = scene.add.text(0, -h / 2 + 18, tag.label, {
    fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#0a1a10',
  }).setOrigin(0.5);
  container.add([tagBg, tagTxt]);

  // Título
  const title = scene.add.text(0, -h / 2 + 60, card.title, {
    fontFamily: 'Press Start 2P, monospace', fontSize: '14px', color: '#ffffff',
    align: 'center', wordWrap: { width: w - 30 },
  }).setOrigin(0.5);
  container.add(title);

  // Descrição
  const desc = scene.add.text(0, 10, card.desc, {
    fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#cccccc',
    align: 'center', wordWrap: { width: w - 30 }, lineSpacing: 6,
  }).setOrigin(0.5);
  container.add(desc);

  // Hint
  const hintTxt = index != null ? `TECLA ${index + 1} · CLIQUE` : 'CLIQUE';
  const hint = scene.add.text(0, h / 2 - 22, hintTxt, {
    fontFamily: 'Press Start 2P, monospace', fontSize: '10px', color: '#d9b25c',
  }).setOrigin(0.5);
  container.add(hint);

  // Interatividade
  const hit = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  container.add(hit);
  hit.on('pointerover', () => bg.setStrokeStyle(4, 0xfff5b8, 1));
  hit.on('pointerout',  () => bg.setStrokeStyle(3, 0xd9b25c, 1));
  hit.on('pointerdown', () => onClick(card));

  return container;
}
