// Loja (docs/COSMETICOS.md, "Estratégia de preços"): os três degraus lado a lado, o do meio em destaque.
//   Sem anúncios (R$ 14,90) · PACOTE FUNDADOR (R$ 19,90: tudo + exclusivos, só na janela de lançamento) ·
//   Kits (R$ 4,90 cada, abrem o Guarda-roupa)
// O pacote no meio custa pouco mais que o "Sem anúncios" sozinho e traz tudo: é a escolha óbvia (âncora
// "separado sai por" com os preços da própria loja). Quem já tem o "Sem anúncios" vê a versão sem ele;
// depois da janela (produto desativado no Play Console) entra o Pacote Apoiador, sem os exclusivos.
// Abre pela ★ da Clareira e pelo botão LOJA do título — nunca no meio da partida, nunca sozinha.
import { CSS } from "../art/Palette.js";
import { text, Button, vw, vh, drawFrame, haptic } from "./Theme.js";
import { Modal, fitTo } from "./Widgets.js";
import { cloudToast } from "./CloudSaveUI.js";
import { openNoAds } from "./NoAdsModal.js";
import { openWardrobe } from "./WardrobeModal.js";
import { COSM_KITS, kitPieces, Wardrobe, cosmeticsOn } from "../systems/Cosmetics.js";
import { registerCosmeticFX } from "../art/CosmeticFX.js";
import { Billing } from "../systems/Billing.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { COSMETICS, STORE } from "../config.js";
import { DEBUG } from "../systems/Platform.js";
import { locale, tr } from "../i18n/i18n.js";

// Loja de verdade ligada? (no app, com os produtos à venda)
const realShop = () => COSMETICS.SHOP && Billing.available();
// Loja disponível (a de verdade ou a simulada do modo de teste)
export const shopOn = () => cosmeticsOn() && (realShop() || DEBUG);

// Preços da loja simulada (modo de teste) = os planejados para o Play Console
const SIM = { noAds: 14.9, kit: 4.9, fundador: 19.9, fundador_lite: 9.9, apoiador: 24.9 };
const brl = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v); // loja simulada (BRL)
const money = (v, currency) => {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
  } catch {
    return null;
  }
};
const packPrice = (k) => (realShop() ? Billing.packPrice(k) || null : DEBUG ? brl(SIM[k]) : null);
const noAdsPrice = () => (realShop() ? Billing.price || null : DEBUG ? brl(SIM.noAds) : null);
const kitPriceStr = () => (realShop() ? Billing.kitPrice("ipe") || null : DEBUG ? brl(SIM.kit) : null);
// "Separado sai por": soma com os números da loja (mesma moeda), ou a simulada
function partsValue(k) {
  if (!realShop()) return DEBUG ? brl((STORE.PACKS[k].noAds ? SIM.noAds : 0) + STORE.PACKS[k].kits.length * SIM.kit) : null;
  const v = Billing.packPartsValue(k);
  return v ? money(v.value, v.currency) : null;
}
// "Você economiza N%" (loja de verdade: com os números dela; simulada: com os preços planejados)
function savePct(k) {
  if (realShop()) return Billing.packSavePct(k);
  if (!DEBUG) return null;
  const P = STORE.PACKS[k];
  return Math.floor((1 - SIM[k] / ((P.noAds ? SIM.noAds : 0) + P.kits.length * SIM.kit)) * 100);
}
const owns = (k) => Wardrobe.ownsPack(k);

// Qual pacote mostrar no meio: Fundador (completo ou "sem o Sem anúncios") enquanto à venda; depois, Apoiador
function pickPack() {
  const founder = Wardrobe.isFounder();
  const hasNoAds = AdService.noAds && !owns("fundador");
  if (founder) return { key: owns("fundador") ? "fundador" : "fundador_lite", owned: true };
  const key = hasNoAds ? "fundador_lite" : "fundador";
  if (packPrice(key)) return { key, owned: false };
  if (!owns("apoiador") && packPrice("apoiador") && !hasNoAds) return { key: "apoiador", owned: false };
  return null;
}

// Data do fim da janela do Fundador no idioma do jogador
function untilStr() {
  const [y, mo, d] = COSMETICS.FOUNDER_UNTIL;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, mo - 1, d));
}

export function openShop(scene, o = {}) {
  registerCosmeticFX(scene);
  if (!o.again) Analytics.track("shop_view", { from: o.from ?? "?" });
  let reopening = false;
  const m = new Modal(scene, { title: tr("LOJA"), w: Math.min(1120, vw(scene) - 40), h: vh(scene), onClose: () => !reopening && o.onClose?.() });
  const reopen = () => {
    if (m._closed) return;
    reopening = true;
    m.close();
    scene._modalMemo = { title: tr("LOJA"), scroll: 0, at: Date.now() };
    openShop(scene, { ...o, again: true });
  };
  const pack = pickPack();
  const cols = pack ? 3 : 2;
  const CW = Math.min(330, (m.w - 80 - (cols - 1) * 24) / cols);
  const top = m.top + 14;
  // Altura dos cartões: a mesma nos três, cresce com o texto (idioma, texto grande). Molduras e botões
  // ficam para o fim, quando já se sabe onde o conteúdo terminou
  let CH = 400,
    low = 0;
  const later = [];
  const xs = cols === 3 ? [-(CW + 24), 0, CW + 24] : [-(CW + 24) / 2, (CW + 24) / 2];
  const order = cols === 3 ? ["noads", "pack", "kits"] : ["noads", "kits"];
  const card = (x, featured) => {
    const g = m.add(scene.add.graphics());
    later.push(() => drawFrame(g, x - CW / 2, top + (featured ? 0 : 16), CW, CH - (featured ? 0 : 16), featured ? "gold" : "dark"));
  };
  const title = (x, y, str, size) => fitTo(m.add(text(scene, x, y, str, { size, color: CSS.goldHi, origin: [0.5, 0] })), CW - 30).displayHeight;
  const line = (x, y, icon, str, color = CSS.txt, size = 15, frame) => {
    let ix = x - CW / 2 + 30;
    if (icon) {
      const img = scene.add.image(ix, y + 10, icon, frame ?? 0);
      img.setScale(Math.max(1, Math.floor(Math.min(28 / img.width, 22 / img.height, 3))));
      m.add(img);
    }
    const t = m.add(text(scene, ix + 24, y, str, { size, color, origin: [0, 0], wrap: CW - 76 }));
    return t.height + 8;
  };
  order.forEach((kind, i) => {
    const x = xs[i];
    if (kind === "noads") {
      card(x, false);
      let y = top + 34;
      m.add(scene.add.image(x, y + 26, "ico_star").setScale(5));
      y += 66;
      y += title(x, y, tr("Sem anúncios"), 22) + 12;
      y += line(x, y, "ico_check", tr("Os prêmios dos anúncios saem na hora, sem assistir nada."));
      y += line(x, y, "ico_heart", tr("Apoia um jogo independente feito no Brasil."));
      low = Math.max(low, y);
      const on = AdService.noAds;
      const price = noAdsPrice();
      later.push(() => m.add(new Button(scene, x, top + CH - 46, CW - 50, 54, on ? tr("ATIVO") : price ? tr("COMPRAR · {0}", price) : tr("VER"), () => {
        if (on) return;
        reopening = true;
        m.close();
        openNoAds(scene, { from: "shop", onClose: () => openShop(scene, { ...o, again: true }) });
      }, { size: 18, style: on ? "dark" : "button", color: on ? CSS.goldHi : undefined, enabled: !on })));
    } else if (kind === "pack") {
      card(x, true);
      const key = pack.key;
      const P = STORE.PACKS[key];
      const founder = P.founder;
      // faixa no topo
      const ribbon = scene.add.graphics();
      drawFrame(ribbon, x - CW / 2 + 30, top - 16, CW - 60, 34, "primary");
      m.add(ribbon);
      m.add(fitTo(text(scene, x, top + 1, pack.owned ? tr("JÁ É SEU") : tr("MELHOR VALOR"), { size: 15, color: CSS.goldHi, origin: 0.5 }), CW - 80));
      let y = top + 32;
      y += title(x, y, founder ? tr("Pacote Fundador") : tr("Pacote Apoiador"), 24) + 4;
      if (founder && !pack.owned) {
        y += fitTo(m.add(text(scene, x, y, tr("Só até {0}", untilStr()), { size: 14, color: CSS.muted, origin: [0.5, 0] })), CW - 30).displayHeight + 8;
      }
      if (P.noAds) y += line(x, y, "ico_star", tr("Sem anúncios"));
      else if (founder) y += line(x, y, "ico_check", tr("Você já tem o Sem anúncios"), CSS.muted);
      // os 4 kits (ícones lado a lado)
      Object.keys(COSM_KITS).forEach((k, j) => {
        const p = kitPieces(k)[0];
        const img = scene.add.image(x - CW / 2 + 42 + j * 34, y + 12, p.icon, p.frame ?? 0);
        img.setScale(Math.max(1, Math.floor(Math.min(28 / img.width, 24 / img.height, 3))));
        if (p.tint != null) img.setTint(p.tint);
        m.add(img);
      });
      y += 30;
      y += line(x, y, null, tr("Os 4 kits de cosméticos ({0} peças)", P.kits.length * 3));
      if (founder) {
        y += line(x, y, "ico_ancestral", tr("Clareira Ancestral (exclusiva)"), CSS.goldHi);
        y += line(x, y, "ico_fundador", tr("Insígnia de Fundador"), CSS.goldHi);
      }
      y += 4;
      const price = packPrice(key);
      const parts = partsValue(key);
      if (!pack.owned && parts) {
        y += fitTo(m.add(text(scene, x, y, tr("Separado sai por {0}", parts), { size: 15, color: CSS.muted, origin: [0.5, 0] })), CW - 30).displayHeight + 4;
        // a economia em número (só a soma do que também se vende avulso: os exclusivos ficam de bônus)
        const pct = savePct(key);
        if (pct >= 10) y += title(x, y, tr("Você economiza {0}%", pct), 18) + 4;
      }
      low = Math.max(low, y);
      const label = pack.owned ? tr("COMPRADO") : Wardrobe.ownsPack(key) ? tr("COMPRADO") : Billing.packPending(key) ? tr("PENDENTE") : price ? tr("COMPRAR · {0}", price) : tr("EM BREVE");
      later.push(() => {
        const buy = m.add(new Button(scene, x, top + CH - 46, CW - 40, 60, label, async () => {
          if (pack.owned || !price || Billing.packPending(key)) return;
          buy.setEnabled(false);
          const r = realShop() ? await Billing.buyPack(key) : (Wardrobe.devBuyPack(key), "ok");
          if (!buy.active) return;
          Analytics.track(realShop() ? "pack_buy_ui" : "pack_buy_test", { pack: key, result: r });
          if (r === "ok") {
            // o momento bom: fechar a Loja e ver a Clareira virar a Ancestral (dá para voltar no Guarda-roupa)
            if (founder) Wardrobe.equip("camp", "ancestral");
            scene.sound.play("sfx_coin", { volume: 0.7 });
            haptic(30);
            cloudToast(scene, founder ? tr("Pacote Fundador liberado! A Clareira Ancestral já está em uso.") : tr("Obrigado pelo apoio! Tudo liberado."));
            return reopen();
          }
          if (r === "pending") {
            cloudToast(scene, tr("Pagamento pendente: libera assim que o Google confirmar."));
            return reopen();
          }
          buy.setEnabled(true);
          if (r === "unavailable") cloudToast(scene, tr("Não foi possível concluir a compra."));
        }, { size: 20, style: pack.owned ? "dark" : "primary", color: CSS.goldHi, enabled: !pack.owned }));
      });
    } else {
      card(x, false);
      let y = top + 34;
      Object.keys(COSM_KITS).forEach((k, j) => {
        const p = kitPieces(k)[0];
        const img = scene.add.image(x + (j - 1.5) * 44, y + 26, p.icon, p.frame ?? 0);
        img.setScale(Math.max(1, Math.floor(Math.min(36 / img.width, 30 / img.height, 4))));
        if (p.tint != null) img.setTint(p.tint);
        m.add(img);
      });
      y += 66;
      y += title(x, y, tr("Kits de cosméticos"), 22) + 12;
      y += line(x, y, "ico_check", tr("3 peças cada: libertação, rastro e Despertar."));
      y += line(x, y, "ico_check", tr("Só aparência: não muda dano, vida nem moedas."));
      const kp = kitPriceStr();
      if (kp) {
        const t = m.add(text(scene, x, y + 4, tr("{0} cada", kp), { size: 18, color: CSS.goldHi, origin: [0.5, 0] }));
        y += t.height + 8;
      }
      low = Math.max(low, y);
      later.push(() => m.add(new Button(scene, x, top + CH - 46, CW - 50, 54, tr("VER KITS"), () => {
        reopening = true;
        m.close();
        openWardrobe(scene, { tab: "kits", from: "shop", onClose: () => o.onClose?.() });
      }, { size: 18, style: "button" })));
    }
  });
  // o conteúdo mais comprido + respiro + o botão
  CH = Math.max(CH, Math.ceil(low - top) + 96);
  later.forEach((f) => f());
  let y = top + CH + 14;
  if (DEBUG && !realShop()) {
    const t = m.add(text(scene, 0, y, tr("Loja simulada (modo de teste): nada é cobrado."), { size: 13, color: CSS.muted, origin: [0.5, 0] }));
    y += t.height;
  }
  m.fitContent(y + 18);
  return m;
}
