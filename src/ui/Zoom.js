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

// Preso na tela e desenhado ACIMA do mundo = interface (HUD 50000+, seta do desafio, mapa de luz,
// vinheta, avisos). O chão também é preso na tela, mas fica embaixo de tudo (camada -100): é mundo
// e acompanha o zoom
const UI_DEPTH = 48000;

export function installZoom(scene) {
  const main = scene.cameras.main;
  const ui = scene.cameras.add(0, 0, vw(scene), vh(scene));
  const onResize = () => ui.setSize(vw(scene), vh(scene));
  scene.scale.on("resize", onResize);
  // Cada objeto é desenhado por UMA câmera (a máscara cameraFilter diz quem o IGNORA). Refeito a
  // cada quadro porque objetos novos nascem o tempo todo (e alguns só ganham scrollFactor 0 depois)
  const both = main.id | ui.id;
  const sort = () => {
    for (const o of scene.children.list) {
      const isUi = o.scrollFactorX === 0 && o.depth >= UI_DEPTH;
      o.cameraFilter = (o.cameraFilter & ~both) | (isUi ? main.id : ui.id);
    }
  };
  scene.events.on("prerender", sort);
  scene.events.once("shutdown", () => {
    scene.scale.off("resize", onResize);
    scene.events.off("prerender", sort);
  });
  // Escurecer/clarear a tela (entrada da partida, derrota) vale para as duas câmeras: senão a
  // interface ficaria acesa sobre a tela preta. Tremor e clarão ficam só no mundo (a interface firme)
  for (const fx of ["fade", "fadeIn", "fadeOut"]) {
    const orig = main[fx].bind(main);
    main[fx] = (...a) => (ui[fx](...a), orig(...a));
  }
  main.setZoom(zoomK());
  sort();
  return { ui, set: (k) => main.setZoom(k) };
}

// Liga o zoom só para quem escolheu (com zoom 1 a cena fica exatamente como sempre foi) e
// troca na hora quando o jogador muda a opção no meio da partida
export function applyZoom(scene) {
  if (!scene._zoom && zoomK() === 1) return;
  scene._zoom ??= installZoom(scene);
  scene._zoom.set(zoomK());
}
