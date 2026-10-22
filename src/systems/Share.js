// Compartilhar uma imagem (o cartão da partida, ui/ShareCardModal.js) ou só texto e link (o convite, Invite.js):
//   · app Android: grava o PNG na pasta de cache com o @capacitor/filesystem (base64) e abre a folha de compartilhar
//     do Android pelo @capacitor/share (arquivo + texto com o link). Fechar a folha sem escolher = "cancel";
//   · navegador: navigator.share com o arquivo quando o navegador aceita (celular, Edge/Chrome no Windows);
//     senão, baixa o PNG.
// Os plugins são lidos como os outros do jogo (window.Capacitor.Plugins): no navegador eles não existem.
import { isNative } from "./Platform.js";
import { SHARE } from "../config.js";

const plugin = (name) => window.Capacitor?.Plugins?.[name] ?? null;

export const toBlob = (canvas) =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png_failed"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error ?? new Error("read_failed"));
    r.readAsDataURL(blob);
  });

// O Capacitor rejeita com "Share canceled" quando a folha fecha sem escolha; o navegador, com AbortError
const isCancel = (e) => e?.name === "AbortError" || /cancel/i.test(String(e?.message ?? e ?? ""));

export const Share = {
  // Como este aparelho compartilha: "native" (folha do Android), "web" (navigator.share com arquivo) ou
  // "download" (baixa a imagem). Decide o rótulo do botão
  mode() {
    if (isNative() && plugin("Share") && plugin("Filesystem")) return "native";
    try {
      const probe = new File([new Uint8Array(8)], SHARE.FILE, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [probe] })) return "web";
    } catch {}
    return "download";
  },

  // blob = o PNG pronto (gerado antes do toque: o navegador só abre a folha logo depois de um gesto).
  // Devolve "shared" | "cancel" | "download"; erro de verdade = exceção
  async image(blob, { text, title, dialogTitle } = {}) {
    const mode = this.mode();
    if (mode === "native") {
      const data = await toBase64(blob);
      const { uri } = await plugin("Filesystem").writeFile({ path: SHARE.FILE, data, directory: "CACHE" });
      try {
        await plugin("Share").share({ title, text, files: [uri], dialogTitle: dialogTitle ?? title });
        return "shared";
      } catch (e) {
        if (isCancel(e)) return "cancel";
        throw e;
      }
    }
    if (mode === "web") {
      const file = new File([blob], SHARE.FILE, { type: "image/png" });
      try {
        await navigator.share({ files: [file], text, title });
        return "shared";
      } catch (e) {
        if (isCancel(e)) return "cancel";
        throw e;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = SHARE.FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "download";
  },

  // Só texto e link (o convite, systems/Invite.js): não precisa de arquivo, então basta o @capacitor/share no app;
  // no navegador, navigator.share sem arquivo. "copy" = nenhum dos dois (computador): quem chama copia o link
  textMode() {
    if (isNative() && plugin("Share")) return "native";
    return typeof navigator !== "undefined" && navigator.share ? "web" : "copy";
  },

  // Abre a folha com { title, text, url }. Devolve { result: "shared" | "cancel", app } (app = o pacote escolhido
  // no Android, com.whatsapp…, quando ele diz); erro de verdade = exceção. Sem folha nenhuma: exceção "no_share"
  async text({ title, text, url, dialogTitle } = {}) {
    const mode = this.textMode();
    try {
      if (mode === "native") {
        const r = await plugin("Share").share({ title, text, url, dialogTitle: dialogTitle ?? title });
        return { result: "shared", app: String(r?.activityType ?? "").slice(0, 60) };
      }
      if (mode === "web") {
        await navigator.share({ title, text, url });
        return { result: "shared", app: "" };
      }
    } catch (e) {
      if (isCancel(e)) return { result: "cancel", app: "" };
      throw e;
    }
    throw new Error("no_share");
  },

  // Área de transferência: a API nova e, se ela recusar (WebView antiga, sem foco), o jeito antigo. true = copiou
  async copy(s) {
    try {
      await navigator.clipboard.writeText(s);
      return true;
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = s;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  },
};
