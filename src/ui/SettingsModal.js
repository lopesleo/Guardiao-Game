// Modal de Opções — compartilhado entre Menu e Pausa. Em ABAS (como o Mural), para caber no
// celular sem nada sobrepor: Áudio e tela · Jogo · Privacidade. A aba aberta é lembrada na
// sessão (trocar fonte/tamanho reinicia a cena e reabre na mesma aba).
import { Settings } from "../systems/Settings.js";
import { Notify } from "../systems/Notify.js";
import { News } from "../systems/News.js";
import { Telemetry } from "../systems/Telemetry.js";
import { AdMobBridge } from "../systems/AdMobBridge.js";
import { CloudSave } from "../systems/CloudSave.js";
import { cloudToast } from "./CloudSaveUI.js";
import { Billing } from "../systems/Billing.js";
import { openNoAds } from "./NoAdsModal.js";
import { CSS } from "../art/Palette.js";
import { text, Button, FONTS, TEXT_SIZES, LANG_FONT, vh } from "./Theme.js";
import { Modal, Slider, Toggle } from "./Widgets.js";
import { ZOOMS } from "./Zoom.js";
import { JOY_SIZES, refreshJoysticks } from "./VirtualJoystick.js";

const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
import { tr, lang, LANGS, setLang, locale } from "../i18n/i18n.js";

let lastTab = "tela";

export function openSettings(scene, o = {}) {
  const privacyRows = (Telemetry.available() ? 1 : 0) + (AdMobBridge.available() ? 1 : 0) + (Billing.available() ? 1 : 0);
  const tabs = [
    ["tela", tr("ÁUDIO E TELA")],
    ["jogo", tr("JOGO")],
    ["controles", tr("CONTROLES")],
  ];
  if (privacyRows || o.onReset) tabs.push(["dados", tr("PRIVACIDADE")]);
  const want = o.tab ?? lastTab;
  const tab = tabs.some(([id]) => id === want) ? want : "tela";
  lastTab = tab;

  const STEP = 62;
  // Montada com a altura máxima e encolhida no fim (fitContent): 560 de sempre, mais alta só quando o
  // conteúdo pede (japonês/chinês com texto "Muito grande")
  const m = new Modal(scene, { title: tr("OPÇÕES"), w: 760, h: vh(scene) });
  const BASE_BOTTOM = m.top + 490; // fundo da janela de 560

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

  // Linhas de cima para baixo: cada uma tem no mínimo STEP de altura e cresce se o nome + a dica não
  // couberem (japonês/chinês com texto "Muito grande" ficam bem mais altos e encostavam na linha vizinha)
  let rowTop = m.top + 104 - STEP / 2;
  const row = (label, widget, hint) => {
    const x = -m.w / 2 + 56;
    const lab = m.add(text(scene, x, 0, label, { size: 22, origin: [0, 0] }));
    // controles alinhados pela borda DIREITA (mesma margem do texto à esquerda)
    // meia-largura de cada tipo ("w" no Phaser é coordenada, não largura): slider 220 + alça,
    // interruptor 84, botões 220
    const half = widget instanceof Slider ? 122 : widget instanceof Toggle ? 42 : 110;
    // a dica quebra antes de chegar ao controle
    const room = m.w / 2 - 56 - 2 * half - 20 - x;
    const hn = hint ? m.add(text(scene, x, 0, hint, { size: 14, color: CSS.muted, origin: [0, 0], wrap: room })) : null;
    const h = lab.height + (hn ? hn.height + 2 : 0);
    const step = Math.max(STEP, h + 14);
    const cy = rowTop + step / 2;
    lab.setY(Math.round(cy - h / 2));
    hn?.setY(Math.round(cy - h / 2 + lab.height + 2));
    widget.setPosition(m.w / 2 - 56 - half, cy);
    m.add(widget);
    rowTop += step;
  };

  // Fonte / tamanho: textos já criados não mudam sozinhos — na Clareira/Título a cena
  // recomeça e reabre as Opções; na Pausa (partida em andamento) vale na próxima tela.
  const applyLook = () => {
    if (o.restartable) {
      scene.registry.set("reopenSettings", true);
      scene.scene.restart();
    } else scene._toast?.(tr("Vale a partir da próxima tela"));
  };
  // apply: o que fazer depois de trocar (padrão: recomeçar a tela, como fonte e tamanho)
  const cycle = (label, keys, get, set, apply = applyLook) => {
    const b = new Button(scene, 0, 0, 220, 44, label(get()), () => {
      const i = (keys.indexOf(get()) + 1) % keys.length;
      set(keys[i]);
      b.setLabel(label(keys[i]));
      apply();
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
    // Zoom: vale na hora (na partida pela Pausa, na Clareira direto), sem reiniciar a cena
    const zb = new Button(scene, 0, 0, 220, 44, ZOOMS[Settings.get("zoom")]?.label ?? ZOOMS[0].label, () => {
      const i = ((Settings.get("zoom") ?? 0) + 1) % ZOOMS.length;
      Settings.set("zoom", i);
      zb.setLabel(ZOOMS[i].label);
      o.onZoom?.();
    }, { size: 20, style: "button" });
    row(tr("Zoom"), zb, tr("Mundo maior; vê menos ao redor"));
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
    // Fotossensibilidade: vale na hora (o gancho do flash lê a opção a cada clarão)
    row(tr("Clarões suaves"), new Toggle(scene, 0, 0, Settings.get("softFlash"), (v) => Settings.set("softFlash", v)), tr("Flashes de tela bem mais fracos (fotossensibilidade)"));
    row(
      tr("Números de dano"),
      new Toggle(scene, 0, 0, Settings.get("dmgNumbers"), (v) => {
        Settings.set("dmgNumbers", v);
        o.onDmgNumbers?.(v);
      }),
    );
    if (Notify.available())
      row(tr("Avisos"), new Toggle(scene, 0, 0, Notify.enabled(), (v) => (v ? Notify.enable() : Notify.disable())), tr("Baú do dia e colheita pronta"));
    if (News.available()) row(tr("Novidades"), new Toggle(scene, 0, 0, News.enabled(), (v) => News.setEnabled(v)), tr("Versões novas e eventos · poucas vezes por mês"));
    if (CloudSave.available() && CloudSave.state !== "off") cloudRow(scene, m, o, row);
  } else if (tab === "controles") {
    // Joystick (só no toque): modo e tamanho valem na hora; o lado move também Dash, Despertar e o
    // botão de ação, então segue a regra da fonte (recomeça a tela ou vale na próxima)
    if (isTouch) {
      const modes = { dynamic: tr("Flutuante"), static: tr("Fixo") };
      row(tr("Joystick"), cycle((k) => modes[k], Object.keys(modes), () => Settings.get("joyMode"), (k) => Settings.set("joyMode", k), refreshJoysticks), tr("Fixo fica sempre no canto da tela"));
      const sides = { left: tr("Esquerda"), right: tr("Direita") };
      row(tr("Lado do joystick"), cycle((k) => sides[k], Object.keys(sides), () => Settings.get("joySide"), (k) => Settings.set("joySide", k)), tr("Direita para canhotos: os botões trocam de lado"));
      row(tr("Tamanho do joystick"), cycle((i) => JOY_SIZES[i].label, JOY_SIZES.map((_, i) => i), () => Settings.get("joySize"), (i) => Settings.set("joySize", i), refreshJoysticks));
    }
    row(tr("Pesca assistida"), new Toggle(scene, 0, 0, Settings.get("fishAssist"), (v) => Settings.set("fishAssist", v)), tr("Zona verde maior e o peixe escapa mais devagar"));
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
      const st = m.add(text(scene, -m.w / 2 + 56, rowTop - 6, tr("Anúncios: {0}", AdMobBridge.statusText()), { size: 14, color: CSS.muted, origin: [0, 0] }));
      rowTop += st.height + 2; // a linha de estado ocupa o espaço logo abaixo
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
    // Compra "Sem anúncios": o botão mostra o preço (ou ATIVO) e abre a janela com os detalhes
    if (Billing.available()) {
      const label = () => (Billing.owned ? tr("ATIVO") : Billing.pending ? tr("PENDENTE") : Billing.price || tr("VER"));
      const b = new Button(scene, 0, 0, 220, 44, label(), () => {
        openNoAds(scene, { from: "options", onClose: () => b.active && b.setLabel(label()) });
      }, { size: 18, style: Billing.owned ? "dark" : "button", color: Billing.owned ? CSS.goldHi : undefined });
      row(tr("Sem anúncios"), b, Billing.owned ? tr("Obrigado pelo apoio!") : tr("Prêmios sem assistir · compra única"));
    }
    if (o.onReset) {
      const what = CloudSave.connected()
        ? tr("Apaga moedas, bênçãos, armas, conquistas e a Clareira deste aparelho e do Play Games")
        : tr("Apaga moedas, bênçãos, armas, conquistas e a Clareira deste aparelho");
      // no pé da janela (ou logo abaixo das linhas, se elas forem mais longe)
      const ry = Math.max(rowTop + 24, BASE_BOTTOM - 104);
      const wt = m.add(text(scene, 0, ry, what, { size: 14, color: CSS.muted, origin: [0.5, 0], align: "center", wrap: m.w - 80 }));
      m.add(new Button(scene, 0, ry + wt.height + 36, 320, 52, tr("APAGAR PROGRESSO"), o.onReset, { size: 18, style: "danger", color: CSS.redHi }));
      rowTop = ry + wt.height + 62;
    }
  }
  m.fitContent(Math.max(rowTop + 16, BASE_BOTTOM));
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
