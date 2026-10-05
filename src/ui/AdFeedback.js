// Retorno visual dos anúncios premiados, igual em todas as telas (quem chama é o AdService):
// "Carregando anúncio…" enquanto o Google busca o vídeo e um aviso curto quando ele não vem
// ou foi fechado antes do fim. Desenha na cena de cima — a que o jogador está vendo.
import { CSS, PAL } from "../art/Palette.js";
import { text, vw, vh, dim, drawFrame } from "./Theme.js";
import { tr } from "../i18n/i18n.js";

const DEPTH = 99999;

function topScene() {
  const scenes = window.game?.scene?.getScenes(true) ?? [];
  return scenes[scenes.length - 1];
}

// Plaquinha emoldurada com o texto no meio (e, se pedir, a roda de espera à esquerda)
function pill(s, x, y, msg, style, color, o = {}) {
  const t = text(s, 0, 0, msg, { size: o.size ?? 20, color, origin: 0.5, align: "center", stroke: true });
  const spin = o.spinner ? 34 : 0;
  const w = t.width + 48 + spin,
    h = Math.max(t.height, spin) + 26;
  const g = s.add.graphics();
  drawFrame(g, -w / 2, -h / 2, w, h, style, { alpha: 0.96 });
  t.setX(spin / 2);
  const c = s.add.container(Math.round(x), Math.round(y), [g, t]).setDepth(DEPTH).setScrollFactor(0);
  if (spin) c.add(spinner(s, -w / 2 + 24 + 12, 0));
  return c;
}

// Roda de espera em pixel: 8 quadradinhos em volta, o brilho dá a volta (como um relógio)
function spinner(s, x, y) {
  const g = s.add.graphics().setPosition(x, y);
  let step = 0;
  const draw = () => {
    g.clear();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const age = (step - i + 8) % 8; // 0 = a ponta acesa, depois vai apagando
      g.fillStyle(age === 0 ? PAL.uiGoldHi : PAL.uiGold, age === 0 ? 1 : Math.max(0.3, 0.85 - age * 0.12));
      g.fillRect(Math.round(Math.cos(a) * 10) - 3, Math.round(Math.sin(a) * 10) - 3, 6, 6);
    }
  };
  draw();
  const ev = s.time.addEvent({ delay: 95, loop: true, callback: () => (g.active ? ((step = (step + 1) % 8), draw()) : ev.remove()) });
  return g;
}

const kill = (s, ...objs) =>
  objs.forEach((o) => {
    if (!o?.active) return; // a cena pode ter fechado e destruído tudo antes
    s.tweens.killTweensOf(o);
    o.destroy();
  });

let loading = null;

export const AdFeedback = {
  // Liga/desliga o "carregando" (escurece a tela e segura os toques atrás)
  loading(on) {
    if (loading) loading();
    loading = null;
    if (!on) return;
    const s = topScene();
    if (!s) return;
    const shade = dim(s, 0.45, DEPTH - 1);
    const c = pill(s, vw(s) / 2, vh(s) / 2, tr("Carregando anúncio…"), "gold", CSS.goldHi, { size: 24, spinner: true });
    c.setAlpha(0).setScale(0.9);
    s.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: "Back.easeOut" });
    loading = () => kill(s, c, shade);
  },

  // Aviso curto no alto da tela
  notice(msg) {
    const s = topScene();
    if (!s) return;
    const c = pill(s, vw(s) / 2, 58, msg, "gold", CSS.goldHi);
    c.setAlpha(0).setY(44);
    s.tweens.add({ targets: c, alpha: 1, y: 58, duration: 220, ease: "Back.easeOut" });
    s.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 400, onComplete: () => kill(s, c) });
  },
};
