// Janela do CARTÃO DA PARTIDA (só na tela de fim de partida, nunca durante a ação): o verso do cartão aparece na
// hora, respirando, enquanto a frente é desenhada (art/ShareCard.js — o cartão só nasce aqui); quando fica pronta,
// o cartão vira, um brilho passa por ele e faíscas saem das bordas. COMPARTILHAR abre a folha do Android (app) ou
// a do navegador; sem ela, BAIXAR IMAGEM. Analytics: share_card { action: open | shared | cancel | fail, mode, biome }.
import { CHARACTERS, BIOMES } from "../config.js";
import { renderShareCard, renderCardBack, renderShine, scaleCanvas, shareMessage, CARD_W, CARD_H } from "../art/ShareCard.js";
import { Share, toBlob } from "../systems/Share.js";
import { Analytics } from "../systems/Analytics.js";
import { cosmeticsOn, Wardrobe } from "../systems/Cosmetics.js";
import { PAL, CSS } from "../art/Palette.js";
import { makeVine } from "../art/TitleArt.js";
import { text, Button, drawFrame, vw, vh, haptic } from "./Theme.js";
import { Modal, fitTo } from "./Widgets.js";
import { tr } from "../i18n/i18n.js";

const ADD = Phaser.BlendModes.ADD;
const MIN_BACK_MS = 650; // o verso fica à vista pelo menos isto (a virada não acontece "do nada")
let seq = 0;

// Os dados da tela de fim de partida → o que o cartão mostra (tudo verdadeiro, da partida)
export function cardInfo(d) {
  const mode = d.endlessS > 0 ? "eterna" : d.won ? "vitoria" : d.quit ? "recuo" : "derrota";
  const biomeId = d.biomeId ?? "amazonia";
  const biome = d.biome ?? BIOMES[biomeId];
  const ch = CHARACTERS.find((c) => c.id === d.character) ?? CHARACTERS[0];
  const on = cosmeticsOn();
  const worn = on ? Wardrobe.active() : {};
  return {
    mode,
    biomeId,
    bossName: biome?.bossName ?? BIOMES.amazonia.bossName,
    character: ch.id,
    charName: ch.name,
    diffName: d.difficulty?.name ?? "",
    elapsedMs: d.elapsedMs ?? 0,
    kills: d.kills ?? 0,
    level: d.level ?? 1,
    byType: d.reactionsByType ?? {},
    weapons: (d.weapons ?? []).filter((w) => w?.key),
    dmgShare: d.dmgShare ?? null,
    score: d.score ?? 0,
    scoreRecord: !!d.scoreRecord,
    endlessS: d.endlessS ?? 0,
    endlessRecord: !!d.endlessRecord,
    founder: on && Wardrobe.isFounder(),
    cosmetics: { kill: worn.kill ?? null, trail: worn.trail ?? null, awaken: worn.awaken ?? null },
    seed: 97 + ((d.kills ?? 0) % 89) + Math.floor((d.elapsedMs ?? 0) / 1000) * 7,
  };
}

export function openShareCard(scene, d) {
  const info = cardInfo(d);
  const track = (action, extra = {}) => Analytics.track("share_card", { action, mode: info.mode, biome: info.biomeId, ...extra });
  track("open");
  const id = ++seq;
  const keys = { back: `sharecard_back_${id}`, front: `sharecard_front_${id}`, shine: `sharecard_shine_${id}` };
  const W = vw(scene),
    H = vh(scene);
  const mw = Math.min(960, W - 40),
    mh = Math.min(690, H - 16);
  let closed = false;
  let blob = null;
  let busy = false;
  const m = new Modal(scene, {
    title: tr("CARTÃO DA PARTIDA"),
    w: mw,
    h: mh,
    onClose: () => {
      closed = true;
      // as texturas da prévia saem com a janela (a imagem grande já foi solta quando o PNG ficou pronto)
      scene.time.delayedCall(0, () => Object.values(keys).forEach((k) => scene.textures.exists(k) && scene.textures.remove(k)));
    },
  });

  // Prévia (4:5) à esquerda, ações à direita
  const top = m.top + 4,
    bottom = m.h / 2 - 26;
  const ch = Math.floor(bottom - top);
  const cw = Math.round((ch * CARD_W) / CARD_H);
  const cx = Math.round(-m.w / 2 + 36 + cw / 2),
    cy = Math.round((top + bottom) / 2);
  const colL = cx + cw / 2 + 40,
    colR = m.w / 2 - 36;
  const colW = colR - colL,
    colX = Math.round((colL + colR) / 2);

  // sombra do cartão (a moldura do jogo em tinta, deslocada) e a luz que pulsa atrás enquanto espera
  const shadowG = m.add(scene.add.graphics());
  drawFrame(shadowG, cx - cw / 2 + 10, cy - ch / 2 + 12, cw, ch, { border: PAL.ink, body: PAL.ink, hi: PAL.ink, lo: PAL.ink }, { alpha: 0.5, flat: true });
  const halo = m.add(scene.add.image(cx, cy, "fx_glow").setScale((cw / 64) * 1.5, (ch / 64) * 1.3).setTint(PAL.yel2).setAlpha(0.1).setBlendMode(ADD));
  scene.textures.addCanvas(keys.back, renderCardBack(cw, ch));
  const card = m.add(scene.add.container(cx, cy));
  const face = scene.add.image(0, 0, keys.back).setScrollFactor(0);
  card.add(face);
  const breathe = scene.tweens.add({ targets: card, scaleX: 1.012, scaleY: 1.012, duration: 950, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  const haloPulse = scene.tweens.add({ targets: halo, alpha: 0.2, duration: 950, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

  // Coluna das ações: a chamada (pelo desfecho), o cipó, o recado (muda com o estado), COMPARTILHAR (ou BAIXAR
  // IMAGEM), FECHAR e a nota de que a imagem leva o link do jogo
  const how = Share.mode();
  const call = info.mode === "vitoria" || info.mode === "eterna" ? tr("Mostre a sua vitória!") : info.mode === "derrota" ? tr("Desafie os amigos a ir mais longe!") : tr("Mostre a sua partida para os amigos!");
  const head = m.add(text(scene, colX, cy - 205, call, { size: 28, color: CSS.goldHi, origin: 0.5, align: "center", wrap: colW, stroke: true }));
  if (head.height > 96) head.setScale(96 / head.height);
  if (!scene.textures.exists("sharecard_vine")) makeVine(71).register(scene, "sharecard_vine");
  m.add(scene.add.image(colX, cy - 148, "sharecard_vine").setScale(3));
  const say = m.add(text(scene, colX, cy - 98, tr("Preparando o cartão…"), { size: 18, color: CSS.muted, origin: 0.5, align: "center", wrap: colW }));
  const waiting = scene.tweens.add({ targets: say, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  const setSay = (str, color = CSS.muted) => {
    waiting.stop();
    say.setAlpha(1).setScale(1).setText(str).setColor(color);
    if (say.height > 76) say.setScale(76 / say.height);
  };
  const shareLabel = how === "download" ? tr("BAIXAR IMAGEM") : tr("COMPARTILHAR");
  const shareBtn = m.add(new Button(scene, colX, cy - 10, colW, 78, shareLabel, () => doShare(), { size: 26, style: "primary", color: CSS.goldHi, icon: "ico_share", iconScale: 3 }));
  if (shareBtn.label) fitTo(shareBtn.label, colW - 100);
  shareBtn.setEnabled(false);
  const closeBtn = m.add(new Button(scene, colX, cy + 82, colW, 60, tr("FECHAR"), () => m.close(), { size: 22, style: "dark" }));
  if (closeBtn.label) fitTo(closeBtn.label, colW - 40);
  const note = m.add(text(scene, colX, cy + 150, tr("A imagem vai com o link do jogo."), { size: 16, color: CSS.dim, origin: [0.5, 0], align: "center", wrap: colW }));
  if (note.height > 60) note.setScale(60 / note.height);

  // Gera a frente (no próximo quadro: a janela aparece antes) e vira o cartão quando ela fica pronta
  const opened = scene.time.now;
  const t0 = performance.now();
  scene.time.delayedCall(30, async () => {
    try {
      const big = await renderShareCard(scene, info);
      if (closed) return;
      blob = await toBlob(big);
      const ms = Math.round(performance.now() - t0);
      if (closed) return;
      scene.textures.addCanvas(keys.front, scaleCanvas(big, cw, ch));
      scene.textures.addCanvas(keys.shine, renderShine(ch));
      big.width = big.height = 0; // solta os 5,8 MB do cartão grande (o PNG já está no blob)
      m._cardMs = ms;
      const wait = Math.max(0, MIN_BACK_MS - (scene.time.now - opened));
      scene.time.delayedCall(wait, () => !closed && flip());
    } catch (e) {
      if (closed) return;
      track("fail", { stage: "render", error: String(e?.message ?? e).slice(0, 80) });
      setSay(tr("Não deu para montar o cartão. Tente de novo."), CSS.redHi);
    }
  });

  // A virada: o verso fecha (escala horizontal até zero), a frente abre com um quique, o brilho passa e as
  // faíscas saem das bordas — tudo em interpolação contínua (nada de quadro trocando aos trancos)
  function flip() {
    breathe.stop();
    haloPulse.stop();
    card.setScale(1);
    scene.tweens.add({ targets: halo, alpha: 0.32, duration: 200, ease: "Sine.easeOut" });
    scene.tweens.add({
      targets: card,
      scaleX: 0,
      scaleY: 1.04,
      y: cy - 12,
      duration: 190,
      ease: "Quad.easeIn",
      onComplete: () => {
        if (closed) return;
        face.setTexture(keys.front);
        scene.sound.play("sfx_ui_card", { volume: 0.55 });
        haptic(18);
        scene.tweens.add({ targets: card, scaleX: 1, scaleY: 1, y: cy, duration: 420, ease: "Back.easeOut", onComplete: () => !closed && reveal() });
        scene.tweens.add({ targets: halo, alpha: 0.12, duration: 900, ease: "Sine.easeOut" });
      },
    });
    scene.tweens.add({ targets: shadowG, alpha: 0.4, duration: 190, yoyo: true, ease: "Quad.easeIn" });
  }

  function reveal() {
    // brilho inclinado atravessando a frente (recortado nas bordas do cartão a cada quadro)
    const shine = scene.add.image(0, 0, keys.shine).setOrigin(0, 0.5).setBlendMode(ADD).setScrollFactor(0);
    card.add(shine);
    const sw = shine.width;
    const o = { x: -cw / 2 - sw };
    const clip = () => {
      shine.x = o.x;
      const a = Math.max(0, -cw / 2 - o.x),
        b = Math.min(sw, cw / 2 - o.x);
      if (b <= a) shine.setVisible(false);
      else shine.setVisible(true).setCrop(a, 0, b - a, ch);
    };
    clip();
    scene.tweens.add({ targets: o, x: cw / 2, duration: 760, ease: "Sine.easeInOut", onUpdate: clip, onComplete: () => shine.destroy() });
    scene.sound.play("sfx_coin", { volume: 0.25, rate: 1.25 });
    // faíscas: saem das bordas, sobem e apagam (cores dos elementos e o dourado)
    const tints = [PAL.yel3, PAL.yel2, PAL.org3, PAL.ice3, PAL.g6, PAL.pur3];
    for (let i = 0; i < 26; i++) {
      const edge = i % 4;
      const u = Math.random();
      const sx = cx + (edge === 0 ? -cw / 2 : edge === 1 ? cw / 2 : (u - 0.5) * cw);
      const sy = cy + (edge === 2 ? -ch / 2 : edge === 3 ? ch / 2 : (u - 0.5) * ch);
      const dx = edge === 0 ? -1 : edge === 1 ? 1 : (u - 0.5) * 0.6;
      const dy = edge === 2 ? -1 : edge === 3 ? 0.5 : -0.4;
      const s = m.add(scene.add.image(sx, sy, "px_dot2").setScale(2 + (i % 3)).setTint(tints[i % tints.length]).setBlendMode(ADD));
      const r = 30 + Math.random() * 60;
      scene.tweens.add({ targets: s, x: sx + dx * r, y: sy + dy * r - 20 - Math.random() * 30, alpha: 0, scale: 0.6, duration: 700 + Math.random() * 600, delay: Math.random() * 180, ease: "Cubic.easeOut", onComplete: () => s.destroy() });
    }
    setSay(how === "download" ? tr("Salve a imagem e poste onde quiser.") : tr("Poste no grupo, no status ou nos stories."), CSS.txt);
    shareBtn.setEnabled(true);
    scene.tweens.add({ targets: shareBtn, scale: { from: 1.08, to: 1 }, duration: 320, ease: "Back.easeOut" });
  }

  async function doShare() {
    if (busy || !blob || closed) return;
    busy = true;
    shareBtn.setEnabled(false);
    try {
      const res = await Share.image(blob, { text: shareMessage(info), title: tr("Guardião da Floresta"), dialogTitle: tr("Compartilhar o cartão") });
      if (res === "cancel") track("cancel", { via: how });
      else track("shared", { via: how });
      if (!closed && res !== "cancel") setSay(res === "download" ? tr("Imagem salva. É só postar!") : tr("Valeu por espalhar a floresta!"), CSS.goldHi);
    } catch (e) {
      track("fail", { via: how, error: String(e?.message ?? e).slice(0, 80) });
      if (!closed) setSay(tr("Não deu para compartilhar. Tente de novo."), CSS.redHi);
    }
    busy = false;
    if (!closed) shareBtn.setEnabled(true);
  }

  return m;
}
