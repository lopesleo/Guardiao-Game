// Liga o AdMob (anúncios PREMIADOS opcionais) e o consentimento (UMP) ao jogo, só no app Android.
// Ordem no boot do app:  1) consentimento (UMP)  2) inicializa o SDK de anúncios  3) registra o
// "provider" no AdService.  No navegador nada disso roda (AdService libera o bônus direto).
//
// MODO DE TESTE: com ADS.TESTING = true o app usa os anúncios de TESTE do Google (nunca clique em
// anúncio real com a sua conta: risco de suspensão). Troque para false só no build de loja.
import { ADS, ADMOB } from "../config.js";
import { isNative } from "./Platform.js";
import { AdService } from "./AdService.js";
import { Analytics } from "./Analytics.js";
import { Settings } from "./Settings.js";
import { Telemetry } from "./Telemetry.js";

const plugin = () => window.Capacitor?.Plugins?.AdMob;

let state = { ready: false, consent: "UNKNOWN", busy: false, step: "não iniciado", error: "" };

// Status do UMP: NOT_REQUIRED (fora da Europa) e OBTAINED (já respondeu) liberam anúncios
const canRequestAds = (status) => status === "NOT_REQUIRED" || status === "OBTAINED";

async function askConsent(AdMob) {
  // ADS.TEST_EEA força a geografia "Europa" para você ver o formulário no aparelho de teste
  const opts = ADS.TESTING && ADS.TEST_EEA ? { debugGeography: 1 } : {};
  let info = await AdMob.requestConsentInfo(opts);
  if (info?.isConsentFormAvailable && info.status === "REQUIRED") info = await AdMob.showConsentForm();
  return info?.status ?? "UNKNOWN";
}

// Um anúncio premiado: resolve true só se o jogador GANHOU a recompensa (assistiu até o fim)
function showRewarded(placement) {
  const AdMob = plugin();
  const adId = ADMOB.UNITS[placement];
  if (!AdMob || !adId || state.busy) return Promise.resolve(false);
  state.busy = true;
  return new Promise((resolve) => {
    const handles = [];
    let rewarded = false;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      handles.forEach((h) => h?.remove?.());
      state.busy = false;
      resolve(ok);
    };
    (async () => {
      try {
        state.step = "anúncio";
        handles.push(await AdMob.addListener("onRewardedVideoAdReward", () => (rewarded = true)));
        handles.push(await AdMob.addListener("onRewardedVideoAdDismissed", () => finish(rewarded)));
        handles.push(await AdMob.addListener("onRewardedVideoAdFailedToShow", () => finish(false)));
        await AdMob.prepareRewardVideoAd({ adId, isTesting: ADS.TESTING });
        await AdMob.showRewardVideoAd();
      } catch (e) {
        state.error = String(e?.message ?? e); // aparece em Opções (ex.: "no fill")
        finish(rewarded); // sem anúncio disponível (falha ao carregar) = sem recompensa
      }
    })();
  });
}

export const AdMobBridge = {
  available: () => isNative() && !!plugin(),
  get consent() {
    return state.consent;
  },
  get ready() {
    return state.ready;
  },
  // Texto curto para a tela de Opções: ajuda a descobrir por que o anúncio não aparece
  statusText() {
    if (!isNative()) return "só no app";
    if (!plugin()) return "plugin AdMob ausente";
    if (state.ready) return ADS.TESTING ? "pronto (teste)" : "pronto";
    if (state.error) return `erro em ${state.step}: ${state.error}`.slice(0, 60);
    return state.step;
  },
  // O jogador pode rever a escolha de consentimento (obrigatório oferecer na Europa)
  async reviewConsent() {
    const AdMob = plugin();
    if (!AdMob) return;
    try {
      await AdMob.resetConsentInfo();
      state.consent = await askConsent(AdMob);
      Analytics.track("consent_review", { status: state.consent });
    } catch {}
  },

  async install() {
    if (!this.available()) return;
    const AdMob = plugin();
    state.error = "";
    try {
      state.step = "consentimento";
      state.consent = await askConsent(AdMob);
      Analytics.track("consent_status", { status: state.consent });
      // Europa/UK/Suíça: o uso de dados começa DESLIGADO (o jogador liga em Opções se quiser)
      if (state.consent !== "NOT_REQUIRED" && !Settings.get("telemetryEeaInit")) {
        Settings.set("telemetryEeaInit", true);
        Telemetry.setEnabled(false);
      }
      if (!canRequestAds(state.consent)) {
        state.step = `sem consentimento (${state.consent})`;
        return; // sem permissão: nenhum anúncio é oferecido
      }
      state.step = "iniciando SDK";
      await AdMob.initialize({ initializeForTesting: ADS.TESTING });
      AdService.setProvider({ show: showRewarded });
      state.ready = true;
      state.step = "pronto";
    } catch (e) {
      state.error = String(e?.message ?? e);
      Analytics.track("admob_init_fail", { step: state.step, msg: state.error.slice(0, 80) });
    }
  },
};
