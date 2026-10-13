// Modal de Opções — compartilhado entre Menu e Pausa. Em ABAS (como o Mural), para caber no
// celular sem nada sobrepor: Áudio e tela · Jogo · Privacidade. A aba aberta é lembrada na
// sessão (trocar fonte/tamanho reinicia a cena e reabre na mesma aba).
import { Settings } from "../systems/Settings.js";
import { Notify } from "../systems/Notify.js";
import { Telemetry } from "../systems/Telemetry.js";
import { AdMobBridge } from "../systems/AdMobBridge.js";
import { CloudSave } from "../systems/CloudSave.js";
import { cloudToast } from "./CloudSaveUI.js";
import { CSS } from "../art/Palette.js";
import { text, Button, FONTS, TEXT_SIZES, LANG_FONT } from "./Theme.js";
import { Modal, Slider, Toggle } from "./Widgets.js";
import { tr, lang, LANGS, setLang, locale } from "../i18n/i18n.js";

let lastTab = "tela";

export function openSettings(scene, o = {}) {
  const privacyRows = (Telemetry.available() ? 1 : 0) + (AdMobBridge.available() ? 1 : 0);
  const tabs = [
    ["tela", tr("ÁUDIO E TELA")],
    ["jogo", tr("JOGO")],
  ];
  if (privacyRows || o.onReset) tabs.push(["dados", tr("PRIVACIDADE")]);
  const want = o.tab ?? lastTab;
  const tab = tabs.some(([id]) => id === want) ? want : "tela";
  lastTab = tab;

  const STEP = 62;
  const m = new Modal(scene, { title: tr("OPÇÕES"), w: 760, h: 560 });

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
    } else scene._toast?.(tr("Vale a partir da próxima tela"));
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
    row(tr("Música"), new Slider(scene, 0, 0, 220, Settings.get("music"), (v) => Settings.set("music", v)));
    row(
      tr("Efeitos"),
      new Slider(scene, 0, 0, 220, Settings.get("sfx"), (v) => {
        Settings.set("sfx", v);
        if (!scene._sfxPreview || scene.time.now - scene._sfxPreview > 150) {
          scene._sfxPreview = scene.time.now;
          scene.sound.play("sfx_coin", { volume: 0.5 });
        }
      }),
    );
    row(tr("Fonte"), cycle((k) => FONTS[k].label, Object.keys(FONTS), () => Settings.get("font"), (k) => Settings.set("font", k)));
    row(tr("Tamanho do texto"), cycle((i) => TEXT_SIZES[i].label, TEXT_SIZES.map((_, i) => i), () => Settings.get("textSize"), (i) => Settings.set("textSize", i)));
    row(
      tr("Iluminação dinâmica"),
      new Toggle(scene, 0, 0, Settings.get("lighting"), (v) => {
        Settings.set("lighting", v);
        o.onLighting?.(v); // aplica na partida em andamento (vindo da Pausa)
      }),
      tr("Desligue se o celular esquentar ou travar"),
    );
  } else if (tab === "jogo") {
    row(tr("Idioma"), new Button(scene, 0, 0, 220, 44, LANGS.find((l) => l.id === lang).label, () => pickLanguage(scene), { size: 20, family: LANG_FONT }), "Language · Idioma");
    row(tr("Vibração"), new Toggle(scene, 0, 0, Settings.get("haptics"), (v) => Settings.set("haptics", v)));
    row(tr("Tremor de tela"), new Toggle(scene, 0, 0, Settings.get("shake"), (v) => Settings.set("shake", v)), tr("Também desliga as pausas de impacto"));
    row(
      tr("Números de dano"),
      new Toggle(scene, 0, 0, Settings.get("dmgNumbers"), (v) => {
        Settings.set("dmgNumbers", v);
        o.onDmgNumbers?.(v);
      }),
    );
    if (Notify.available())
      row(tr("Avisos"), new Toggle(scene, 0, 0, Notify.enabled(), (v) => (v ? Notify.enable() : Notify.disable())), tr("Baú do dia e colheita pronta"));
    if (CloudSave.available() && CloudSave.state !== "off") cloudRow(scene, m, o, row);
  } else {
    if (Telemetry.available())
      row(tr("Dados de uso e erros"), new Toggle(scene, 0, 0, Telemetry.enabled(), (v) => Telemetry.setEnabled(v)), tr("Ajuda a melhorar o jogo · anônimo"));
    if (AdMobBridge.available()) {
      // Rever o consentimento só existe onde o Google tem mensagem para a região (Europa e estados dos EUA);
      // nos outros lugares o botão fica apagado e a dica explica o porquê
      const privacy = AdMobBridge.privacy;
      const hint = { REQUIRED: tr("Mude sua escolha quando quiser"), NOT_REQUIRED: tr("Não é exigido na sua região") }[privacy] ?? tr("Precisa de internet");
      const review = new Button(scene, 0, 0, 220, 44, tr("REVER"), async () => {
        review.setEnabled(false);
        await AdMobBridge.reviewConsent();
        if (!review.active) return;
        review.setEnabled(true);
        st.setText(tr("Anúncios: {0}", AdMobBridge.statusText()));
      }, { size: 18 });
      review.setEnabled(privacy === "REQUIRED");
      row(tr("Consentimento de anúncios"), review, hint);
      // Linha discreta de estado dos anúncios (toque tenta de novo se algo falhou)
      const st = m.add(text(scene, -m.w / 2 + 56, y - 8, tr("Anúncios: {0}", AdMobBridge.statusText()), { size: 14, color: CSS.muted, origin: [0, 0.5] }));
      if (!AdMobBridge.ready) {
        st.setInteractive({ useHandCursor: true }).on("pointerup", async () => {
          st.setText(tr("Anúncios: tentando…"));
          await AdMobBridge.install();
          if (!st.active) return;
          st.setText(tr("Anúncios: {0}", AdMobBridge.statusText()));
          // a tentativa pode ter descoberto a região: reabre para o botão de consentimento refletir
          if (AdMobBridge.privacy !== privacy) {
            m.close();
            openSettings(scene, { ...o, tab: "dados" });
          }
        });
      }
    }
    if (o.onReset) {
      const what = CloudSave.connected()
        ? tr("Apaga moedas, bênçãos, armas, conquistas e a Clareira deste aparelho e do Play Games")
        : tr("Apaga moedas, bênçãos, armas, conquistas e a Clareira deste aparelho");
      m.add(text(scene, 0, m.h / 2 - 104, what, { size: 14, color: CSS.muted, origin: 0.5 }));
      m.add(new Button(scene, 0, m.h / 2 - 60, 320, 52, tr("APAGAR PROGRESSO"), o.onReset, { size: 18, style: "danger", color: CSS.redHi }));
    }
  }
  return m;
}

// Progresso na nuvem (Play Games): entrar na conta, ou ver quando salvou e salvar já
function cloudRow(scene, m, o, row) {
  const st = CloudSave.state;
  const reopen = () => {
    if (!m._closed) m.close();
    openSettings(scene, { ...o, tab: "jogo" });
  };
  if (st === "ready") {
    const at = new Date(CloudSave.lastSync).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const b = new Button(scene, 0, 0, 220, 44, tr("SALVAR AGORA"), async () => {
      b.setEnabled(false);
      CloudSave.touch();
      await CloudSave.flush();
      if (b.active) reopen();
    }, { size: 18 });
    row(tr("Progresso na nuvem"), b, tr("Salvo no Play Games às {0}", at));
  } else if (st === "checking" || st === "ask") {
    const b = new Button(scene, 0, 0, 220, 44, tr("CONECTAR"), () => {}, { size: 18 });
    b.setEnabled(false);
    row(tr("Progresso na nuvem"), b, tr("Conferindo o Play Games…"));
  } else {
    const b = new Button(scene, 0, 0, 220, 44, tr("CONECTAR"), async () => {
      b.setEnabled(false);
      const ok = await CloudSave.signIn();
      if (!b.active) return;
      if (ok) reopen();
      else {
        b.setEnabled(true);
        cloudToast(scene, tr("Não foi possível entrar no Play Games"));
      }
    }, { size: 18 });
    row(tr("Progresso na nuvem"), b, st === "error" ? tr("Sem conexão com o Play Games") : tr("Guarda seu progresso na conta Google"));
  }
}

// Escolha de idioma: cada nome no próprio idioma; trocar recarrega o jogo (o progresso fica)
function pickLanguage(scene) {
  const m = new Modal(scene, { title: tr("IDIOMA"), w: 520, h: 110 + LANGS.length * 64 });
  LANGS.forEach((l, i) => {
    const on = l.id === lang;
    m.add(
      new Button(scene, 0, m.top + 40 + i * 64, 360, 52, l.label, () => (on ? m.close() : setLang(l.id)), {
        size: 22,
        family: LANG_FONT, // 日本語/简体中文/繁體中文 aparecem mesmo com o jogo em outro idioma
        style: on ? "gold" : "dark",
        color: on ? CSS.goldHi : CSS.txt,
      }),
    );
  });
}
