// Zoom de acessibilidade (Opções → Zoom): aproxima o MUNDO — herói, inimigos, itens e golpes
// ficam maiores — sem aumentar a interface. O Phaser aplica o zoom da câmera também ao que está
// preso na tela (scrollFactor 0), então a interface passa para uma segunda câmera, sem zoom, por
// cima da do mundo. A partida não muda: os inimigos nascem na mesma distância do herói; só se vê
// menos ao redor.
import { Settings } from "../systems/Settings.js";
import { vw, vh } from "./Theme.js";
import { tr } from "../i18n/i18n.js";

export const ZOOMS = [
  { label: tr("Normal"), k: 1 },
  { label: tr("Grande"), k: 1.15 },
  { label: tr("Muito grande"), k: 1.3 },
];
export const zoomK = () => (ZOOMS[Settings.get("zoom")] ?? ZOOMS[0]).k;

// Três tipos de objeto, para a ordem de desenho com zoom ser IGUAL à do zoom 1:
//  - INTERFACE: presa na tela e de profundidade ≥ uiDepth (na partida, o HUD 50000+; na Clareira,
//    60000+). Vai para a câmera sem zoom, desenhada por cima do mundo.
//  - CAMADA DE TELA do mundo: presa na tela, entre 0 e uiDepth (mapa de luz 48500, feixes de luz,
//    vinhetas 49000, seta do desafio; na Clareira, a noite e a vinheta). Fica na câmera do MUNDO, na
//    ordem de profundidade de sempre — o aviso do chefe (48540) e a Aura (48550) continuam ACIMA do
//    mapa de luz —, e o zoom é desfeito só durante o desenho, para ela cobrir a tela como no zoom 1.
//    (Antes ia para a câmera da interface, desenhada depois do mundo: o mapa de luz escurecia avisos,
//    Aura, efeitos e números de quem usa o zoom.)
//  - MUNDO: o resto, inclusive o chão (preso na tela, mas na camada -100: acompanha o zoom).
// Diferença que sobra: o que é do mundo e fica acima de uiDepth (números de dano 59000, rótulos de
// reação 60000) passa por baixo do HUD em vez de por cima — só onde um número cruza uma barra.
const UI_DEPTH = 50000;

export function installZoom(scene, uiDepth = UI_DEPTH) {
  const main = scene.cameras.main;
  const ui = scene.cameras.add(0, 0, vw(scene), vh(scene));
  const onResize = () => ui.setSize(vw(scene), vh(scene));
  scene.scale.on("resize", onResize);
  // Cada objeto é desenhado por UMA câmera (a máscara cameraFilter diz quem o IGNORA). Refeito a
  // cada quadro porque objetos novos nascem o tempo todo (e alguns só ganham scrollFactor 0 depois)
  const both = main.id | ui.id;
  const pinned = []; // [obj, x, y, scaleX, scaleY, ...] das camadas de tela desfeitas do zoom neste quadro
  // Depois do desenho, cada camada volta ao que o código dela escreveu (tweens e resize não percebem)
  const unpin = () => {
    for (let i = 0; i < pinned.length; i += 5) {
      const o = pinned[i];
      o.x = pinned[i + 1];
      o.y = pinned[i + 2];
      o.scaleX = pinned[i + 3];
      o.scaleY = pinned[i + 4];
    }
    pinned.length = 0;
  };
  const sort = () => {
    unpin(); // (nunca desfaz o zoom duas vezes, nem se um desenho falhar no meio)
    const z = main.zoom;
    // A câmera escala em volta do próprio centro: tela = c + z·(p − c) → p = c + (tela − c)/z
    const cx = main.width * main.originX,
      cy = main.height * main.originY;
    for (const o of scene.children.list) {
      const screen = o.scrollFactorX === 0;
      const isUi = screen && o.depth >= uiDepth;
      o.cameraFilter = (o.cameraFilter & ~both) | (isUi ? main.id : ui.id);
      if (screen && !isUi && z !== 1 && o.depth >= 0 && o.scaleX !== undefined) {
        pinned.push(o, o.x, o.y, o.scaleX, o.scaleY);
        o.x = cx + (o.x - cx) / z;
        o.y = cy + (o.y - cy) / z;
        o.scaleX /= z;
        o.scaleY /= z;
      }
    }
  };
  scene.events.on("prerender", sort);
  scene.events.on("render", unpin);
  scene.events.once("shutdown", () => {
    scene.scale.off("resize", onResize);
    scene.events.off("prerender", sort);
    scene.events.off("render", unpin);
  });
  // Escurecer/clarear a tela (entrada da partida, derrota) vale para as duas câmeras: senão a
  // interface ficaria acesa sobre a tela preta. Tremor e clarão ficam só no mundo (a interface firme)
  for (const fx of ["fade", "fadeIn", "fadeOut"]) {
    const orig = main[fx].bind(main);
    main[fx] = (...a) => (ui[fx](...a), orig(...a));
  }
  main.setZoom(zoomK());
  return { ui, set: (k) => main.setZoom(k) };
}

// Liga o zoom só para quem escolheu (com zoom 1 a cena fica exatamente como sempre foi) e
// troca na hora quando o jogador muda a opção no meio da partida
export function applyZoom(scene, uiDepth) {
  if (!scene._zoom && zoomK() === 1) return;
  scene._zoom ??= installZoom(scene, uiDepth);
  scene._zoom.set(zoomK());
}
