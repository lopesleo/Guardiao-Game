// Modal de Opções — compartilhado entre Menu e Pausa.
import { Settings } from "../systems/Settings.js";
import { Notify } from "../systems/Notify.js";
import { Telemetry } from "../systems/Telemetry.js";
import { AdMobBridge } from "../systems/AdMobBridge.js";
import { CSS } from "../art/Palette.js";
import { text, Button, FONTS, TEXT_SIZES } from "./Theme.js";
import { Modal, Slider, Toggle } from "./Widgets.js";

export function openSettings(scene, o = {}) {
  const rows = 8 + (Notify.available() ? 1 : 0) + (Telemetry.available() ? 1 : 0) + (AdMobBridge.available() ? 1 : 0);
  const STEP = 54;
  const m = new Modal(scene, { title: "OPÇÕES", w: 680, h: 120 + rows * STEP + (o.onReset ? 76 : 0) });
  let y = m.top + 24;
  const row = (label, widget) => {
    m.add(text(scene, -m.w / 2 + 50, y, label, { size: 22, origin: [0, 0.5] }));
    widget.setPosition(m.w / 2 - 150, y);
    m.add(widget);
    y += STEP;
  };
  // Fonte / tamanho: textos já criados não mudam sozinhos — na Clareira/Título a cena
  // recomeça e reabre as Opções; na Pausa (partida em andamento) vale na próxima tela.
  const applyLook = () => {
    if (o.restartable) {
      scene.registry.set("reopenSettings", true);
      scene.scene.restart();
    } else scene._toast?.("Vale a partir da próxima tela");
  };
  const cycle = (label, keys, get, set) => {
    const b = new Button(scene, 0, 0, 220, 44, label(get()), () => {
      const i = (keys.indexOf(get()) + 1) % keys.length;
      set(keys[i]);
      b.setLabel(label(keys[i]));
      applyLook();
    }, { size: 20, style: "button" });
    return b;
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
  row("Fonte", cycle((k) => FONTS[k].label, Object.keys(FONTS), () => Settings.get("font"), (k) => Settings.set("font", k)));
  row("Tamanho do texto", cycle((i) => TEXT_SIZES[i].label, TEXT_SIZES.map((_, i) => i), () => Settings.get("textSize"), (i) => Settings.set("textSize", i)));
  row("Vibração", new Toggle(scene, 0, 0, Settings.get("haptics"), (v) => Settings.set("haptics", v)));
  row("Tremor de tela", new Toggle(scene, 0, 0, Settings.get("shake"), (v) => Settings.set("shake", v)));
  row("Números de dano", new Toggle(scene, 0, 0, Settings.get("dmgNumbers"), (v) => {
    Settings.set("dmgNumbers", v);
    o.onDmgNumbers?.(v);
  }));
  row("Iluminação dinâmica", new Toggle(scene, 0, 0, Settings.get("lighting"), (v) => {
    Settings.set("lighting", v);
    o.onLighting?.(v); // aplica na partida em andamento (vindo da Pausa)
  }));
  if (Notify.available())
    row("Avisos (baú e colheita)", new Toggle(scene, 0, 0, Notify.enabled(), (v) => (v ? Notify.enable() : Notify.disable())));
  if (Telemetry.available())
    row("Dados de uso e erros", new Toggle(scene, 0, 0, Telemetry.enabled(), (v) => Telemetry.setEnabled(v)));
  if (AdMobBridge.available())
    row("Consentimento de anúncios", new Button(scene, 0, 0, 200, 36, "REVER", () => AdMobBridge.reviewConsent(), { size: 16 }));
  if (o.onReset) {
    m.add(new Button(scene, 0, m.h / 2 - 46, 300, 50, "APAGAR PROGRESSO", o.onReset, { size: 18, style: "danger", color: CSS.redHi }));
  }
  return m;
}
