// Teste do CARTÃO DA PARTIDA (art/ShareCard.js, ui/ShareCardModal.js, systems/Share.js) num navegador de verdade:
//   · nativo: Share e Filesystem FALSOS (window.Capacitor.Plugins) — fim de partida de verdade → toque no
//     COMPARTILHAR → o verso vira para a frente → COMPARTILHAR grava o PNG (base64, pasta de cache, 1080×1350) e
//     abre a folha com o arquivo e o texto com o link (utm_source=share); cancelar e falhar (gravar, abrir a folha);
//     fechar a janela solta as texturas da prévia; Analytics share_card (open, shared, cancel, fail)
//   · navegador: navigator.share com o arquivo (e o cancelamento); sem ele, BAIXAR IMAGEM baixa o PNG
//   · lugar: o botão não encosta em JOGAR DE NOVO, CLAREIRA nem DOBRAR MOEDAS (915×412 e 1280×720, texto
//     "Muito grande" em japonês) e a janela cabe na tela
//   · modos: o cartão nasce em todos os desfechos, nos 2 biomas e nos 6 idiomas, sem erro
//
//   npm i --no-save playwright-core        (usa o Edge instalado, headless)
//   npm run test:cartao                    (ou: node tools/test-cartao.mjs)
//
// Variáveis: ONLY=nome,nome  LAB_URL=… (servidor já rodando)  SHOTS=pasta (capturas)
import { chromium } from "playwright-core";
import { startLabServer } from "./lab-server.mjs";

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SHOTS = process.env.SHOTS || "";
const server = process.env.LAB_URL ? null : await startLabServer();
const URL = process.env.LAB_URL || server.url;
const browser = await chromium.launch({
  executablePath: process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});

// Roda no navegador antes do jogo. cfg.native: o app com Share/Filesystem falsos; cfg.web: navigator.share falso
// ("ok", "cancel" ou null = sem navigator.share)
function fake(cfg) {
  const F = (window.__share = { writes: [], shares: [], writeFail: false, shareResult: "ok", webShares: [], webResult: cfg.web ?? null });
  for (const [k, v] of Object.entries(cfg.local || {})) localStorage.setItem(k, JSON.stringify(v));
  if (cfg.native)
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: {
        AdMob: {
          requestConsentInfo: async () => ({ status: "NOT_REQUIRED", privacyOptionsRequirementStatus: "NOT_REQUIRED" }),
          initialize: async () => {},
          addListener: async () => ({ remove() {} }),
          prepareRewardVideoAd: async () => {},
          showRewardVideoAd: async () => {},
        },
        Filesystem: {
          writeFile: async (o) => {
            F.writes.push({ path: o.path, directory: o.directory, size: o.data.length, head: o.data.slice(0, 40) });
            if (F.writeFail) throw new Error("disk_full");
            return { uri: "file:///data/user/0/com.lopesleo.guardiao/cache/" + o.path };
          },
        },
        Share: {
          canShare: async () => ({ value: true }),
          share: async (o) => {
            F.shares.push(o);
            if (F.shareResult === "cancel") throw new Error("Share canceled");
            if (F.shareResult === "fail") throw new Error("activity_not_found");
            return { activityType: "com.whatsapp" };
          },
        },
      },
    };
  else {
    // navegador: o navigator.share do aparelho (ou nenhum)
    if (F.webResult) {
      navigator.canShare = (d) => !!d?.files?.length;
      navigator.share = async (d) => {
        F.webShares.push({ n: d.files?.length ?? 0, type: d.files?.[0]?.type, size: d.files?.[0]?.size, text: d.text });
        if (F.webResult === "cancel") throw new DOMException("Share canceled", "AbortError");
      };
    } else {
      try {
        delete Navigator.prototype.share;
        delete Navigator.prototype.canShare;
      } catch {}
      navigator.share = undefined;
      navigator.canShare = undefined;
    }
  }
}

let failures = 0;
const check = (ok, what, extra = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${what}${extra ? "  " + extra : ""}`);
  return ok;
};
const SET = (o = {}) => ({ guardiao_settings_v1: { music: 0, sfx: 0, qualityChecked: true, ...o } });

// Partida de verdade até a tela do resultado (pula a cena da 1ª queda: o save já viu)
async function toGameOver(t, { won = true, kills = 845 } = {}) {
  await t.page.evaluate(() => {
    const ti = window.game.scene.getScene("TitleScene");
    ti.meta.data.runsPlayed = 3;
    ti.meta.data.firstDefeatSeen = true;
    ti.meta._save();
    ti.scene.start("GameScene");
  });
  await t.page.waitForFunction(() => window.game.scene.getScene("GameScene")?.player && !window.game.scene.getScene("GameScene")._intro, null, { timeout: 60000 });
  await t.page.evaluate(
    ({ won, kills }) => {
      const g = window.game.scene.getScene("GameScene");
      g.hud.kills = kills;
      g._onGameOver(won, false, true);
    },
    { won, kills },
  );
  await t.page.waitForFunction(() => window.game.scene.isActive("GameOverScene") && window.game.scene.getScene("GameOverScene").shareBtn, null, { timeout: 30000 });
  await t.page.evaluate(() => window.game.scene.getScene("GameOverScene")._skip()); // tudo à vista (o relógio do headless anda devagar)
  await t.page.waitForTimeout(300);
}

// Clique de verdade (mouse) no centro de um objeto do Phaser
async function click(t, getter) {
  const p = await t.page.evaluate((src) => {
    const o = new Function("s", `return (${src})(s)`)(window.game.scene.getScene("GameOverScene"));
    if (!o) return null;
    const r = o.getBounds();
    const c = window.game.canvas.getBoundingClientRect();
    const b = window.game.scale.baseSize;
    return { x: c.left + (r.centerX * c.width) / b.width, y: c.top + (r.centerY * c.height) / b.height };
  }, getter.toString());
  if (!p) return false;
  await t.page.mouse.click(p.x, p.y);
  return true;
}
const modalButton = (label) => `(s) => { const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]); const m = s._modals.at(-1); return m && deep(m.root).find((o) => o.label?.text === ${JSON.stringify(label)}); }`;
const clickModal = (t, label) => click(t, modalButton(label));
const events = (t) => t.page.evaluate(() => window.guardiaoAnalytics.recent().filter((e) => e.name === "share_card").map((e) => ({ action: e.action, mode: e.mode, biome: e.biome, via: e.via, stage: e.stage })));
// A frente ficou pronta: COMPARTILHAR habilitado (o verso já virou)
const ready = (t) =>
  t.page.waitForFunction(
    () => {
      const s = window.game.scene.getScene("GameOverScene");
      const m = s._modals.at(-1);
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      return m && m._cardMs != null && deep(m.root).some((o) => o.ico?.texture?.key === "ico_share" && o.enabled);
    },
    null,
    { timeout: 30000, polling: 100 },
  );
const say = (t) =>
  t.page.evaluate(() => {
    const s = window.game.scene.getScene("GameOverScene");
    const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
    return deep(s._modals.at(-1).root).filter((o) => o.type === "Text").map((o) => o.text).join(" | ");
  });
const shareState = (t) => t.page.evaluate(() => JSON.parse(JSON.stringify(window.__share)));

// Largura × altura de um PNG em base64 (cabeçalho IHDR)
const pngSize = (b64) => {
  const b = Buffer.from(b64, "base64");
  return { png: b.slice(1, 4).toString() === "PNG", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const SCENARIOS = {
  // App Android: grava e abre a folha de compartilhar com o arquivo; cancelar; falhas; fechar solta as texturas
  async nativo(t) {
    await t.boot({ native: true });
    await toGameOver(t, { won: true });
    check(await click(t, (s) => s.shareBtn), "toque no COMPARTILHAR da tela do resultado");
    await t.page.waitForFunction(() => window.game.scene.getScene("GameOverScene")._modals.length === 1, null, { timeout: 5000 });
    const back = await t.page.evaluate(() => Object.keys(window.game.textures.list).filter((k) => k.startsWith("sharecard_")));
    check(back.some((k) => k.startsWith("sharecard_back_")), "a janela abre com o verso do cartão", back.join(","));
    await ready(t);
    const ms = await t.page.evaluate(() => window.game.scene.getScene("GameOverScene")._modals.at(-1)._cardMs);
    check(ms > 0 && ms < 4000, "a frente fica pronta e o cartão vira", `${ms} ms`);
    if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/cartao_nativo.png` });
    // compartilhar
    await clickModal(t, "COMPARTILHAR");
    await t.page.waitForFunction(() => window.__share.shares.length === 1, null, { timeout: 15000 });
    let F = await shareState(t);
    const w = F.writes[0];
    check(w?.directory === "CACHE" && /\.png$/.test(w.path), "grava o PNG na pasta de cache", JSON.stringify({ path: w?.path, dir: w?.directory }));
    check(/^iVBOR/.test(w?.head ?? ""), "o arquivo é PNG em base64", w?.head?.slice(0, 8));
    const sh = F.shares[0];
    check(sh.files?.length === 1 && sh.files[0].startsWith("file://") && sh.files[0].endsWith(w.path), "abre a folha com o arquivo", JSON.stringify(sh.files));
    check(/komedygames\.com\/guardiao\/\?utm_source=share/.test(sh.text ?? ""), "o texto leva o link com utm_source=share", sh.text);
    check(/Mapinguari/.test(sh.text ?? ""), "o texto conta a vitória (a lenda libertada)", sh.text);
    // o cabeçalho do PNG gravado (os 40 primeiros caracteres em base64 cobrem a largura e a altura)
    const sz = pngSize(w?.head ?? "");
    check(sz.png && sz.w === 1080 && sz.h === 1350, "o cartão gravado tem 1080×1350 (4:5)", JSON.stringify(sz) + ` ${Math.round((w?.size ?? 0) / 1365)} KB`);
    let ev = await events(t);
    check(ev[0]?.action === "open" && ev[0].mode === "vitoria" && ev[0].biome === "amazonia", "Analytics: open (modo e bioma)", JSON.stringify(ev[0]));
    check(ev.at(-1)?.action === "shared" && ev.at(-1).via === "native", "Analytics: shared", JSON.stringify(ev.at(-1)));
    check(/Valeu/.test(await say(t)), "agradece depois de compartilhar");
    // cancelar a folha
    await t.page.evaluate(() => (window.__share.shareResult = "cancel"));
    await t.page.waitForTimeout(200);
    await clickModal(t, "COMPARTILHAR");
    await t.page.waitForFunction(() => window.__share.shares.length === 2, null, { timeout: 15000 });
    await t.page.waitForTimeout(300);
    ev = await events(t);
    check(ev.at(-1)?.action === "cancel", "Analytics: cancel quando a folha fecha sem escolha", JSON.stringify(ev.at(-1)));
    const reenabled = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("GameOverScene");
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      return deep(s._modals.at(-1).root).find((o) => o.label?.text === "COMPARTILHAR")?.enabled;
    });
    check(reenabled === true, "o botão volta a funcionar depois de cancelar");
    // falha ao abrir a folha e ao gravar
    await t.page.evaluate(() => (window.__share.shareResult = "fail"));
    await clickModal(t, "COMPARTILHAR");
    await t.page.waitForFunction(() => window.__share.shares.length === 3, null, { timeout: 15000 });
    await t.page.waitForTimeout(300);
    ev = await events(t);
    check(ev.at(-1)?.action === "fail", "Analytics: fail quando a folha não abre", JSON.stringify(ev.at(-1)));
    check(/Tente de novo/.test(await say(t)), "avisa a falha na janela");
    await t.page.evaluate(() => Object.assign(window.__share, { shareResult: "ok", writeFail: true }));
    await clickModal(t, "COMPARTILHAR");
    await t.page.waitForFunction(() => window.__share.writes.length === 4, null, { timeout: 15000 });
    await t.page.waitForTimeout(300);
    F = await shareState(t);
    ev = await events(t);
    check(F.shares.length === 3 && ev.at(-1)?.action === "fail", "falha ao gravar: não abre a folha e registra fail", JSON.stringify(ev.at(-1)));
    // fechar: as texturas da prévia saem
    await clickModal(t, "FECHAR");
    await t.page.waitForTimeout(400);
    const left = await t.page.evaluate(() => ({ tex: Object.keys(window.game.textures.list).filter((k) => /^sharecard_(back|front|shine)_/.test(k)), modals: window.game.scene.getScene("GameOverScene")._modals.length }));
    check(left.modals === 0 && left.tex.length === 0, "FECHAR fecha a janela e solta as texturas da prévia", JSON.stringify(left));
    // fechar ANTES de a frente ficar pronta (VOLTAR do Android logo depois do toque) não quebra nada
    await click(t, (s) => s.shareBtn);
    await t.page.evaluate(() => window.guardiaoBack());
    await t.page.waitForTimeout(1500);
    const after = await t.page.evaluate(() => ({ tex: Object.keys(window.game.textures.list).filter((k) => /^sharecard_(back|front|shine)_/.test(k)), modals: window.game.scene.getScene("GameOverScene")._modals.length, active: window.game.scene.isActive("GameOverScene") }));
    check(after.modals === 0 && after.tex.length === 0 && after.active, "VOLTAR no meio da geração fecha limpo (sem textura sobrando)", JSON.stringify(after));
  },

  // Navegador: navigator.share com o arquivo; cancelar = AbortError
  async navegadorShare(t) {
    await t.boot({ web: "ok" });
    await toGameOver(t, { won: false });
    await click(t, (s) => s.shareBtn);
    await ready(t);
    await clickModal(t, "COMPARTILHAR");
    await t.page.waitForFunction(() => window.__share.webShares.length === 1, null, { timeout: 15000 });
    const F = await shareState(t);
    const s0 = F.webShares[0];
    check(s0.n === 1 && s0.type === "image/png" && s0.size > 50000, "navigator.share recebe o PNG", JSON.stringify(s0));
    check(/utm_source=share/.test(s0.text ?? "") && /Podridão/.test(s0.text ?? ""), "texto da derrota com o link", s0.text);
    let ev = await events(t);
    check(ev.at(-1)?.action === "shared" && ev.at(-1).via === "web" && ev.at(-1).mode === "derrota", "Analytics: shared pelo navegador", JSON.stringify(ev.at(-1)));
    await t.page.evaluate(() => (window.__share.webResult = "cancel"));
    // o navigator.share falso lê o resultado na hora do toque
    await t.page.evaluate(() => {
      navigator.share = async (d) => {
        window.__share.webShares.push({ n: d.files?.length ?? 0 });
        throw new DOMException("Share canceled", "AbortError");
      };
    });
    await clickModal(t, "COMPARTILHAR");
    await t.page.waitForFunction(() => window.__share.webShares.length === 2, null, { timeout: 15000 });
    await t.page.waitForTimeout(300);
    ev = await events(t);
    check(ev.at(-1)?.action === "cancel", "Analytics: cancel (AbortError)", JSON.stringify(ev.at(-1)));
  },

  // Sem navigator.share: o botão vira BAIXAR IMAGEM e baixa o PNG
  async navegadorBaixar(t) {
    await t.boot({ web: null });
    await toGameOver(t, { won: true });
    await click(t, (s) => s.shareBtn);
    await ready(t);
    const has = await t.page.evaluate(() => {
      const s = window.game.scene.getScene("GameOverScene");
      const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
      return deep(s._modals.at(-1).root).some((o) => o.label?.text === "BAIXAR IMAGEM");
    });
    check(has, "sem navigator.share: BAIXAR IMAGEM");
    const [dl] = await Promise.all([t.page.waitForEvent("download", { timeout: 15000 }), clickModal(t, "BAIXAR IMAGEM")]);
    check(/\.png$/.test(dl.suggestedFilename()), "baixa o PNG", dl.suggestedFilename());
    await t.page.waitForTimeout(300);
    const ev = await events(t);
    check(ev.at(-1)?.action === "shared" && ev.at(-1).via === "download", "Analytics: shared (download)", JSON.stringify(ev.at(-1)));
  },

  // O botão no lugar certo: na coluna da cena, sem encostar nos outros (celular deitado e PC; japonês grande)
  async lugar(t) {
    for (const [w, h, lang, ts] of [
      [915, 412, "pt", 0],
      [915, 412, "ja", 2],
      [1280, 720, "es", 0],
    ]) {
      await t.boot({ native: true, viewport: { width: w, height: h }, local: SET({ lang, textSize: ts }) });
      await toGameOver(t, { won: false });
      const r = await t.page.evaluate(() => {
        const s = window.game.scene.getScene("GameOverScene");
        const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
        const all = s.children.list.flatMap(deep);
        const box = (o) => {
          const b = o.getBounds();
          return { x: b.x, y: b.y, r: b.right, b: b.bottom };
        };
        // botões: o do cartão, JOGAR DE NOVO, CLAREIRA e (no painel) DOBRAR MOEDAS
        const btns = all.filter((o) => o.bw && o.h && o !== s.shareBtn && o.visible);
        const sb = s.shareBtn;
        const bb = { x: sb.x - sb.bw / 2, y: sb.y - sb.h / 2, r: sb.x + sb.bw / 2, b: sb.y + sb.h / 2 };
        const others = btns.map((o) => {
          const m = o.getWorldTransformMatrix();
          const k = m.scaleX;
          return { x: m.tx - (o.bw * k) / 2, y: m.ty - (o.h * k) / 2, r: m.tx + (o.bw * k) / 2, b: m.ty + (o.h * k) / 2, t: o.label?.text };
        });
        const hit = others.filter((o) => !(o.r <= bb.x - 4 || o.x >= bb.r + 4 || o.b <= bb.y - 4 || o.y >= bb.b + 4));
        return { bb, hit, W: s.scale.baseSize.width, H: s.scale.baseSize.height, panelX: s.L.px, label: sb.label?.text, labelW: sb.label ? sb.label.width * sb.label.scaleX : 0 };
      });
      check(r.hit.length === 0, `${w}×${h} ${lang}${ts ? " texto grande" : ""}: COMPARTILHAR não encosta em outro botão`, JSON.stringify(r.hit));
      check(r.bb.r <= r.panelX && r.bb.x >= 0 && r.bb.b <= r.H, `${w}×${h} ${lang}: fica na coluna da cena, dentro da tela`, JSON.stringify(r.bb));
      if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/cartao_lugar_${w}x${h}_${lang}.png` });
      await click(t, (s) => s.shareBtn);
      await ready(t);
      const fit = await t.page.evaluate(() => {
        const s = window.game.scene.getScene("GameOverScene");
        const m = s._modals.at(-1);
        const deep = (o) => (o.list ? [o, ...o.list.flatMap(deep)] : [o]);
        const texts = deep(m.root).filter((o) => o.type === "Text" && o.visible);
        const W = s.scale.baseSize.width,
          H = s.scale.baseSize.height;
        const out = texts.filter((o) => {
          const b = o.getBounds();
          return b.x < W / 2 - m.w / 2 || b.right > W / 2 + m.w / 2 || b.y < H / 2 - m.h / 2 || b.bottom > H / 2 + m.h / 2;
        });
        return { out: out.map((o) => o.text), mw: m.w, mh: m.h, W, H };
      });
      check(fit.out.length === 0 && fit.mh <= fit.H && fit.mw <= fit.W, `${w}×${h} ${lang}: a janela cabe e nenhum texto vaza`, JSON.stringify(fit.out));
      if (SHOTS) await t.page.screenshot({ path: `${SHOTS}/cartao_janela_${w}x${h}_${lang}.png` });
      await t.ctx.close();
      t.ctx = null;
    }
  },

  // O cartão nasce em todo desfecho, bioma e idioma (sem erro e no tamanho certo)
  async modos(t) {
    for (const lang of ["pt", "en", "es", "ja", "zh", "zht"]) {
      await t.boot({ native: true, local: SET({ lang }) });
      const r = await t.page.evaluate(async () => {
        const { renderShareCard } = await import("/src/art/ShareCard.js");
        const { cardInfo } = await import("/src/ui/ShareCardModal.js");
        const { DIFFICULTY, BIOMES } = await import("/src/config.js");
        const scene = window.game.scene.getScene("TitleScene");
        const out = [];
        for (const biomeId of ["amazonia", "caatinga"])
          for (const [won, quit, endlessS] of [[true, false, 0], [false, false, 0], [false, true, 0], [true, false, 75]]) {
            const d = { won, quit, endlessS, endlessRecord: endlessS > 0, biomeId, biome: BIOMES[biomeId], difficulty: DIFFICULTY[3], character: "fulozinha", level: 9, kills: 1234, elapsedMs: 330000, weapons: [{ key: "LASH", level: 5 }, { key: "FLAME", level: 3 }], dmgShare: { LASH: 70, FLAME: 30 }, reactionsByType: { LABAREDA: 12, VAPOR: 3 }, score: 9000, scoreRecord: won };
            const t0 = performance.now();
            const c = await renderShareCard(scene, cardInfo(d));
            const px = c.getContext("2d").getImageData(540, 140, 1, 1).data;
            out.push({ k: `${biomeId}/${cardInfo(d).mode}`, w: c.width, h: c.height, ms: Math.round(performance.now() - t0), lit: px[0] + px[1] + px[2] > 0 });
          }
        return out;
      });
      const bad = r.filter((x) => x.w !== 1080 || x.h !== 1350 || !x.lit);
      check(bad.length === 0 && r.length === 8, `${lang}: 8 cartões (4 desfechos × 2 biomas)`, `${Math.max(...r.map((x) => x.ms))} ms no pior ${JSON.stringify(bad)}`);
      await t.ctx.close();
      t.ctx = null;
    }
  },
};

async function run(name) {
  console.log(`\n== ${name} ==`);
  const errs = [];
  const t = {
    ctx: null,
    page: null,
    async boot(cfg = {}) {
      this.ctx = await browser.newContext({ viewport: cfg.viewport ?? { width: 915, height: 412 }, deviceScaleFactor: 1, locale: "pt-BR", serviceWorkers: "block", acceptDownloads: true });
      this.page = await this.ctx.newPage();
      this.page.on("pageerror", (e) => errs.push(e.message));
      this.page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
      await this.page.addInitScript(fake, { ...cfg, local: cfg.local ?? SET() });
      await this.page.goto(URL);
      await this.page.waitForFunction(() => window.game?.scene?.isActive("TitleScene"), null, { timeout: 120000 });
      await this.page.waitForTimeout(500);
    },
  };
  try {
    await SCENARIOS[name](t);
  } catch (e) {
    check(false, "cenário quebrou", e.message.split("\n")[0]);
  }
  check(errs.length === 0, "sem erros no console", errs.slice(0, 2).join(" | "));
  await t.ctx?.close();
}

for (const name of Object.keys(SCENARIOS)) if (!ONLY || ONLY.includes(name)) await run(name);
await browser.close();
server?.close();
console.log(failures ? `\n${failures} FALHA(S)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
