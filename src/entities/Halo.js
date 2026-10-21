// Brilho (ou sombra) de um tiro FORA do container dele.
//
// Dentro do container, cada tiro alternava ADD (brilho) e NORMAL (núcleo) e o Phaser 4 fecha o lote
// de desenho a cada troca de modo: eram 2 lotes extras por tiro (130 desenhos por quadro numa horda).
// Solto na cena, um pouco abaixo da profundidade do tiro, o brilho de todos os tiros fica colado na
// lista de exibição e sai num lote só. A cena chama sync() depois da física (POST_UPDATE), quando o
// container já está na posição do quadro; o tiro esconde o halo ao morrer.
const BELOW = 0.01; // abaixo do próprio tiro, como era o 1º filho do container

export function makeHalo(scene, key, scale, alpha, below = BELOW) {
  const img = scene.add.image(-9999, -9999, key).setScale(scale).setAlpha(alpha).setVisible(false);
  img._hs = scale; // escala-base (o tiro pode animá-la: setHaloScale)
  img._ha = alpha;
  img._below = below;
  return img;
}

export function setHaloScale(img, scale) {
  img._hs = scale;
}

// Copia do tiro o que um filho herdaria: posição, giro, escala, alfa, visibilidade e profundidade
export function syncHalo(c, img) {
  if (!c.visible) {
    if (img.visible) img.setVisible(false);
    return;
  }
  if (!img.visible) img.setVisible(true);
  img.x = c.x;
  img.y = c.y;
  img.rotation = c.rotation;
  img.setScale(img._hs * c.scaleX, img._hs * c.scaleY);
  img.alpha = img._ha * c.alpha;
  const d = c.depth - img._below;
  if (img.depth !== d) img.setDepth(d);
}
