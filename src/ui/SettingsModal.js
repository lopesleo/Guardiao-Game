// Modal de Opções — compartilhado entre Menu e Pausa.
import { Settings } from "../systems/Settings.js";
import { CSS } from "../art/Palette.js";
import { text, Button } from "./Theme.js";
import { Modal, Slider, Toggle } from "./Widgets.js";

export function openSettings(scene, o = {}) {
  const m = new Modal(scene, { title: "OPÇÕES", w: 620, h: o.onReset ? 620 : 540 });
  let y = m.top + 30;
  const row = (label, widget) => {
    m.add(text(scene, -m.w / 2 + 50, y, label, { size: 22, origin: [0, 0.5] }));
    widget.setPosition(m.w / 2 - 150, y);
    m.add(widget);
    y += 64;
  };
  row("Música", new Slider(scene, 0, 0, 200, Settings.get("music"), (v) => Settings.set("music", v)));
  row(
    "Efeitos",
    new Slider(scene, 0, 0, 200, Settings.get("sfx"), (v) => {
      Settings.set("sfx", v);
      if (!scene._sfxPreview || scene.time.now - scene._sfxPreview > 150) {
        scene._sfxPreview = scene.time.now;
        scene.sound.play("sfx_coin", { volume: 0.5 });
      }
    }),
  );
  row("Vibração", new Toggle(scene, 0, 0, Settings.get("haptics"), (v) => Settings.set("haptics", v)));
  row("Tremor de tela", new Toggle(scene, 0, 0, Settings.get("shake"), (v) => Settings.set("shake", v)));
  row("Números de dano", new Toggle(scene, 0, 0, Settings.get("dmgNumbers"), (v) => {
    Settings.set("dmgNumbers", v);
    o.onDmgNumbers?.(v);
  }));
  row("Iluminação dinâmica", new Toggle(scene, 0, 0, Settings.get("lighting"), (v) => Settings.set("lighting", v)));
  if (o.onReset) {
    m.add(new Button(scene, 0, m.h / 2 - 50, 300, 50, "APAGAR PROGRESSO", o.onReset, { size: 18, style: "danger", color: CSS.redHi }));
  }
  return m;
}
