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
import { tr } from "../i18n/i18n.js";

const plugin = () => window.Capacitor?.Plugins?.AdMob;

// privacy: o Google pede um botão de "opções de privacidade" para este jogador? (REQUIRED só onde há
// mensagem publicada no AdMob — a europeia/GDPR e a dos estados dos EUA (10/10/2026); no Brasil vem NOT_REQUIRED)
let state = { ready: false, consent: "UNKNOWN", privacy: "UNKNOWN", busy: false, step: "idle", error: "" };

// Status do UMP: NOT_REQUIRED (fora da Europa) e OBTAINED (já respondeu) liberam anúncios
const canRequestAds = (status) => status === "NOT_REQUIRED" || status === "OBTAINED";

// Teste: ADS.TEST_EEA finge que o aparelho está na Europa. Num celular de verdade o Google só
// aceita isso se o aparelho estiver em ADS.TEST_DEVICE_IDS (emulador já conta como de teste)
const consentOpts = () =>
  ADS.TESTING && ADS.TEST_EEA ? { debugGeography: 1, testDeviceIdentifiers: ADS.TEST_DEVICE_IDS ?? [] } : {};

const remember = (info) => {
  if (info?.privacyOptionsRequirementStatus) state.privacy = info.privacyOptionsRequirementStatus;
  return info;
};

async function askConsent(AdMob) {
  let info = remember(await AdMob.requestConsentInfo(consentOpts()));
  if (info?.isConsentFormAvailable && info.status === "REQUIRED") info = remember(await AdMob.showConsentForm());
  return info?.status ?? "UNKNOWN";
}

// Liga o SDK e passa a servir anúncios (no boot ou logo depois de o jogador consentir)
async function startAds(AdMob) {
  state.step = "sdk";
  // maxAdContentRating vale para todos os pedidos de anúncio a partir daqui (público 13+)
  await AdMob.initialize({ initializeForTesting: ADS.TESTING, maxAdContentRating: ADS.MAX_AD_RATING });
  AdService.setProvider({ show: showRewarded });
  state.ready = true;
  state.error = "";
  state.step = "ready";
}

// Som do jogo durante o anúncio: o anúncio abre uma tela própria DENTRO do app, então o Android não
// avisa "app em segundo plano" e a música continuaria tocando por baixo do anúncio
function gameAudio(on) {
  const snd = window.game?.sound;
  const ctx = snd?.context;
  if (!snd) return;
  // Phaser 4: o update() do som religa o AudioContext suspenso a cada quadro enquanto o jogo
  // "tem foco"; marcar como sem foco durante o anúncio impede a música de voltar sozinha
  snd.gameLostFocus = !on;
  if (!ctx) return snd[on ? "resumeAll" : "pauseAll"]?.();
  if (!on && ctx.state === "running") ctx.suspend().catch(() => {});
  if (on && ctx.state === "suspended" && !snd.locked) ctx.resume().catch(() => {});
}

// Nova tentativa de ligar os anúncios ao voltar ao app (no máximo uma por minuto)
const RETRY_MS = 60000;
let installing = null,
  retryHooked = false,
  lastTry = 0;

// Sem rede o carregamento pode demorar muito: passado esse tempo, desiste (o jogador é avisado)
const LOAD_TIMEOUT_MS = 12000;
// Depois de fechar, quanto tempo esperar pelo aviso de recompensa que chega atrasado
const REWARD_GRACE_MS = 600;

// Um anúncio premiado. Resolve "ok" só se o jogador GANHOU a recompensa (assistiu até o fim);
// "cancelled" = fechou antes; "unavailable" = não carregou (sem rede, sem anúncio no momento…)
function showRewarded(placement) {
  const AdMob = plugin();
  const adId = ADMOB.UNITS[placement];
  if (state.busy) return Promise.resolve("busy");
  if (!AdMob || !adId) return Promise.resolve("unavailable");
  state.busy = true;
  return new Promise((resolve) => {
    const handles = [];
    let rewarded = false;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      handles.forEach((h) => h?.remove?.());
      state.busy = false;
      gameAudio(true);
      resolve(result);
    };
    const timer = setTimeout(() => {
      state.error = "timeout";
      finish("unavailable");
    }, LOAD_TIMEOUT_MS);
    (async () => {
      try {
        // A recompensa SÓ sai com o aviso de "ganhou" do SDK (assistiu até o fim). Alguns anúncios
        // avisam "ganhou" logo DEPOIS de "fechou": após fechar, espera um instante antes de dar
        // como cancelado — sem isso quem assistiu tudo ficava sem a recompensa
        let dismissed = false;
        handles.push(
          await AdMob.addListener("onRewardedVideoAdReward", () => {
            rewarded = true;
            if (dismissed) finish("ok");
          }),
        );
        handles.push(
          await AdMob.addListener("onRewardedVideoAdDismissed", () => {
            dismissed = true;
            if (rewarded) finish("ok");
            else setTimeout(() => finish(rewarded ? "ok" : "cancelled"), REWARD_GRACE_MS);
          }),
        );
        handles.push(await AdMob.addListener("onRewardedVideoAdFailedToShow", () => finish("unavailable")));
        await AdMob.prepareRewardVideoAd({ adId, isTesting: ADS.TESTING });
        if (done) return; // demorou demais: o jogador já foi avisado, não abre o anúncio depois
        clearTimeout(timer); // carregou: daqui em diante o tempo é do jogador assistindo
        gameAudio(false); // silencia o jogo só quando o anúncio vai mesmo aparecer
        await AdMob.showRewardVideoAd();
      } catch (e) {
        state.error = String(e?.message ?? e); // aparece em Opções (ex.: "no fill")
        finish(rewarded ? "ok" : "unavailable");
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
  // "REQUIRED" | "NOT_REQUIRED" | "UNKNOWN" — se o botão de rever o consentimento vale para este jogador
  get privacy() {
    return state.privacy;
  },
  // Texto curto para a tela de Opções: ajuda a descobrir por que o anúncio não aparece
  statusText() {
    if (!isNative()) return tr("só no app");
    if (!plugin()) return tr("indisponíveis neste aparelho");
    if (state.ready) return ADS.TESTING ? tr("prontos (teste)") : tr("prontos");
    if (state.step === "no-consent") return tr("sem consentimento · toque para tentar de novo");
    if (state.error) return tr("falharam ({0}) · toque para tentar de novo", state.error.slice(0, 32));
    return tr("iniciando…");
  },
  // Opções de privacidade do Google (rever o consentimento). Só existe onde há mensagem de
  // consentimento (privacy = REQUIRED); depois da escolha, liga os anúncios se ficaram liberados.
  async reviewConsent() {
    const AdMob = plugin();
    if (!AdMob || state.privacy !== "REQUIRED") return false;
    try {
      await AdMob.showPrivacyOptionsForm();
      const info = remember(await AdMob.requestConsentInfo(consentOpts()));
      state.consent = info?.status ?? state.consent;
      Analytics.track("consent_review", { status: state.consent });
      if (!state.ready && canRequestAds(state.consent)) await startAds(AdMob);
      return true;
    } catch (e) {
      state.error = String(e?.message ?? e);
      return false;
    }
  },

  // Boot do app. Se falhar (sem internet na abertura, por exemplo), tenta de novo sozinho quando
  // o jogador volta ao app — sem isso as ofertas sumiriam até reabrir o jogo
  async install() {
    if (!this.available() || state.ready || installing) return installing ?? undefined;
    installing = this._install().finally(() => (installing = null));
    if (!retryHooked) {
      retryHooked = true;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden || state.ready || Date.now() - lastTry < RETRY_MS) return;
        this.install();
      });
    }
    return installing;
  },

  async _install() {
    const AdMob = plugin();
    lastTry = Date.now();
    state.error = "";
    try {
      state.step = "consent";
      state.consent = await askConsent(AdMob);
      Analytics.track("consent_status", { status: state.consent, privacy: state.privacy });
      // Europa/UK/Suíça: o uso de dados começa DESLIGADO (o jogador liga em Opções se quiser)
      if (state.consent !== "NOT_REQUIRED" && !Settings.get("telemetryEeaInit")) {
        Settings.set("telemetryEeaInit", true);
        Telemetry.setEnabled(false);
      }
      if (!canRequestAds(state.consent)) {
        state.step = "no-consent";
        return; // sem permissão: nenhum anúncio é oferecido
      }
      await startAds(AdMob);
    } catch (e) {
      state.error = String(e?.message ?? e);
      Analytics.track("admob_init_fail", { step: state.step, msg: state.error.slice(0, 80) });
    }
  },
};
