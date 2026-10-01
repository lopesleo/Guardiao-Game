// Modal de Opções — compartilhado entre Menu e Pausa. Em ABAS (como o Mural), para caber no
// celular sem nada sobrepor: Áudio e tela · Jogo · Privacidade. A aba aberta é lembrada na
// sessão (trocar fonte/tamanho reinicia a cena e reabre na mesma aba).
import { Settings } from "../systems/Settings.js";
import { Notify } from "../systems/Notify.js";
import { Telemetry } from "../systems/Telemetry.js";
import { AdMobBridge } from "../systems/AdMobBridge.js";
import { CSS } from "../art/Palette.js";
import { text, Button, FONTS, TEXT_SIZES } from "./Theme.js";
import { Modal, Slider, Toggle } from "./Widgets.js";

let lastTab = "tela";

export function openSettings(scene, o = {}) {
  const privacyRows = (Telemetry.available() ? 1 : 0) + (AdMobBridge.available() ? 1 : 0);
  const tabs = [
    ["tela", "ÁUDIO E TELA"],
    ["jogo", "JOGO"],
  ];
  if (privacyRows || o.onReset) tabs.push(["dados", "PRIVACIDADE"]);
  const want = o.tab ?? lastTab;
  const tab = tabs.some(([id]) => id === want) ? want : "tela";
  lastTab = tab;

  const STEP = 62;
  const m = new Modal(scene, { title: "OPÇÕES", w: 760, h: 560 });

  // Abas
  const tabW = Math.min(230, (m.w - 60) / tabs.length - 12);
  tabs.forEach(([id, label], i) => {
    const x = (i - (tabs.length - 1) / 2) * (tabW + 14);
    m.add(
      new Button(scene, x, m.top + 24, tabW, 46, label, () => {
        if (tab === id) return;
        m.close();
        openSettings(scene, { ...o, tab: id });
      }, { size: 17, style: tab === id ? "gold" : "dark", color: tab === id ? CSS.goldHi : CSS.muted }),
    );
  });

  let y = m.top + 104;
  const row = (label, widget, hint) => {
    m.add(text(scene, -m.w / 2 + 56, hint ? y - 10 : y, label, { size: 22, origin: [0, 0.5] }));
    if (hint) m.add(text(scene, -m.w / 2 + 56, y + 16, hint, { size: 14, color: CSS.muted, origin: [0, 0.5] }));
    // controles alinhados pela borda DIREITA (mesma margem do texto à esquerda)
    // meia-largura de cada tipo ("w" no Phaser é coordenada, não largura): slider 220 + alça,
    // interruptor 84, botões 220
    const half = widget instanceof Slider ? 122 : widget instanceof Toggle ? 42 : 110;
    widget.setPosition(m.w / 2 - 56 - half, y);
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

  if (tab === "tela") {
    row("Música", new Slider(scene, 0, 0, 220, Settings.get("music"), (v) => Settings.set("music", v)));
    row(
      "Efeitos",
      new Slider(scene, 0, 0, 220, Settings.get("sfx"), (v) => {
        Settings.set("sfx", v);
        if (!scene._sfxPreview || scene.time.now - scene._sfxPreview > 150) {
          scene._sfxPreview = scene.time.now;
          scene.sound.play("sfx_coin", { volume: 0.5 });
        }
      }),
    );
    row("Fonte", cycle((k) => FONTS[k].label, Object.keys(FONTS), () => Settings.get("font"), (k) => Settings.set("font", k)));
    row("Tamanho do texto", cycle((i) => TEXT_SIZES[i].label, TEXT_SIZES.map((_, i) => i), () => Settings.get("textSize"), (i) => Settings.set("textSize", i)));
    row(
      "Iluminação dinâmica",
      new Toggle(scene, 0, 0, Settings.get("lighting"), (v) => {
        Settings.set("lighting", v);
        o.onLighting?.(v); // aplica na partida em andamento (vindo da Pausa)
      }),
      "Desligue se o celular esquentar ou travar",
    );
  } else if (tab === "jogo") {
    row("Vibração", new Toggle(scene, 0, 0, Settings.get("haptics"), (v) => Settings.set("haptics", v)));
    row("Tremor de tela", new Toggle(scene, 0, 0, Settings.get("shake"), (v) => Settings.set("shake", v)), "Também desliga as pausas de impacto");
    row(
      "Números de dano",
      new Toggle(scene, 0, 0, Settings.get("dmgNumbers"), (v) => {
        Settings.set("dmgNumbers", v);
        o.onDmgNumbers?.(v);
      }),
    );
    if (Notify.available())
      row("Avisos", new Toggle(scene, 0, 0, Notify.enabled(), (v) => (v ? Notify.enable() : Notify.disable())), "Baú do dia e colheita pronta");
  } else {
    if (Telemetry.available())
      row("Dados de uso e erros", new Toggle(scene, 0, 0, Telemetry.enabled(), (v) => Telemetry.setEnabled(v)), "Ajuda a melhorar o jogo · anônimo");
    if (AdMobBridge.available()) {
      row("Consentimento de anúncios", new Button(scene, 0, 0, 220, 44, "REVER", () => AdMobBridge.reviewConsent(), { size: 18 }), "Mude sua escolha quando quiser");
      // Linha discreta de estado dos anúncios (toque tenta de novo se algo falhou)
      const st = m.add(text(scene, -m.w / 2 + 56, y - 8, `Anúncios: ${AdMobBridge.statusText()}`, { size: 14, color: CSS.muted, origin: [0, 0.5] }));
      if (!AdMobBridge.ready) {
        st.setInteractive({ useHandCursor: true }).on("pointerup", async () => {
          st.setText("Anúncios: tentando…");
          await AdMobBridge.install();
          st.setText(`Anúncios: ${AdMobBridge.statusText()}`);
        });
      }
    }
    if (o.onReset) {
      m.add(text(scene, 0, m.h / 2 - 104, "Apaga moedas, bênçãos, armas, conquistas e a Clareira deste aparelho", { size: 14, color: CSS.muted, origin: 0.5 }));
      m.add(new Button(scene, 0, m.h / 2 - 60, 320, 52, "APAGAR PROGRESSO", o.onReset, { size: 18, style: "danger", color: CSS.redHi }));
    }
  }
  return m;
}
