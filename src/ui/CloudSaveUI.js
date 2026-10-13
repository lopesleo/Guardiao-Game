// Interface do progresso na nuvem (ver systems/CloudSave.js): a escolha entre o save
// do aparelho e o do Play Games (quando os dois têm progresso) e os avisos curtos.
// Aparece só no título ou na Clareira — nunca no meio da partida.
import { CloudSave } from "../systems/CloudSave.js";
import { CSS } from "../art/Palette.js";
import { text, drawFrame, Button, vw, vh } from "./Theme.js";
import { Modal } from "./Widgets.js";
import { tr, fmt, locale } from "../i18n/i18n.js";

const HOSTS = ["CampScene", "TitleScene"];

function host(game) {
  for (const k of HOSTS) if (game.scene.isActive(k)) return game.scene.getScene(k);
  return null;
}

const when = (at) => (at ? new Date(at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "—");

// Aviso curto, acima de qualquer painel aberto (padrão: no pé da tela, abaixo dos painéis)
export function cloudToast(scene, msg, x = vw(scene) / 2, y = vh(scene) - 50) {
  const c = scene.add.container(x, y).setScrollFactor(0).setDepth(90000);
  const t = text(scene, 0, 0, msg, { size: 20, color: CSS.goldHi, origin: 0.5, stroke: true });
  const g = scene.add.graphics();
  drawFrame(g, -t.width / 2 - 20, -22, t.width + 40, 44, "gold", { alpha: 0.95 });
  c.add([g, t]);
  c.setAlpha(0).setY(y + 16);
  scene.tweens.add({ targets: c, alpha: 1, y, duration: 240, ease: "Back.easeOut" });
  scene.tweens.add({ targets: c, alpha: 0, delay: 3000, duration: 400, onComplete: () => c.destroy() });
}

function askChoice(scene, o) {
  let chosen = false;
  const m = new Modal(scene, {
    title: tr("PROGRESSO NA NUVEM"),
    subtitle: tr("Há outro progresso salvo nesta conta Google. Qual você quer usar?"),
    w: 800,
    h: 430,
    onClose: () => !chosen && o.later(),
  });
  const colW = 340;
  const side = (x, label, s, more, pick) => {
    const top = m.top + 12;
    const h = 276;
    const g = scene.add.graphics();
    drawFrame(g, x - colW / 2, top, colW, h, more ? "gold" : "dark");
    m.add(g);
    m.add(text(scene, x, top + 28, label, { size: 22, color: more ? CSS.goldHi : CSS.txt, origin: 0.5 }));
    // tabela rótulo … valor (sem plural solto: "1 guardiões")
    const rows = [
      [tr("Partidas"), s.runs],
      [tr("Vitórias"), s.wins],
      [tr("Moedas"), s.coins],
      [tr("Guardiões"), s.legends],
    ];
    rows.forEach(([k, v], i) => {
      const y = top + 68 + i * 30;
      m.add(text(scene, x - colW / 2 + 32, y, k, { size: 18, color: CSS.muted, origin: [0, 0.5] }));
      m.add(text(scene, x + colW / 2 - 32, y, fmt(v), { size: 18, color: more ? CSS.goldHi : CSS.txt, origin: [1, 0.5] }));
    });
    m.add(text(scene, x, top + 194, tr("Salvo em {0}", when(s.at)), { size: 15, color: CSS.muted, origin: 0.5 }));
    m.add(
      new Button(scene, x, top + 236, colW - 60, 48, tr("USAR ESTE"), () => {
        chosen = true;
        m.close();
        pick();
      }, { size: 18, style: more ? "primary" : "button", color: more ? CSS.goldHi : undefined }),
    );
  };
  const cloudMore = o.cloud.runs > o.local.runs;
  side(-colW / 2 - 20, tr("NESTE APARELHO"), o.local, !cloudMore, o.keepLocal);
  side(colW / 2 + 20, tr("NO PLAY GAMES"), o.cloud, cloudMore, o.useCloud);
  m.add(text(scene, 0, m.h / 2 - 30, tr("O outro progresso será substituído."), { size: 15, color: CSS.muted, origin: 0.5 }));
}

// Liga a interface ao sistema (1x no boot)
export function installCloudSaveUI(game) {
  CloudSave._ui = {
    ask(o) {
      const s = host(game);
      if (!s) return setTimeout(() => this.ask(o), 1500);
      askChoice(s, o);
    },
  };
  // Depois de recarregar com o save da nuvem: avisa onde o jogador estiver
  if (CloudSave.takeRestoredNotice()) {
    const show = () => {
      const s = host(game);
      if (!s) return setTimeout(show, 500);
      // na Clareira, o aviso dela; no título, acima do JOGAR (longe do nome do jogo)
      const msg = tr("Progresso recuperado do Play Games");
      s.time.delayedCall(600, () => (s._toast ? s._toast(msg) : s.playBtn ? cloudToast(s, msg, s.playBtn.x, s.playBtn.y - 70) : cloudToast(s, msg)));
    };
    show();
  }
}
