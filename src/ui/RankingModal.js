// Ranking (Google Play Games; src/systems/Leaderboards.js): dois rankings (Pontuação · Maior Perigo), cada um
// com a semana e o de sempre. Os três primeiros num PÓDIO (pedestais de pedra da Clareira, ResultArt.js, com o
// troféu de ouro, prata e bronze; o 1º com brilho), do 4º ao 10º na lista ao lado, a linha do jogador destacada
// (embaixo, se estiver fora da lista) e a conta dos pontos. O pódio sobe e a lista desliza ao abrir. Com até 3
// no período, só o pódio no meio. A área tem altura fixa para não pular quando os dados chegam; trocar de aba
// reabre a janela, e a lista vem do cache por 1 min.
import { RANKING } from "../config.js";
import { Leaderboards, perigoName } from "../systems/Leaderboards.js";
import { Analytics } from "../systems/Analytics.js";
import { makePedestal } from "../art/ResultArt.js";
import { text, drawFrame, Button, vw, vh, textPx, PAL, CSS, hex } from "./Theme.js";
import { Modal } from "./Widgets.js";
import { tr, fmt } from "../i18n/i18n.js";

const BOARDS = [
  ["score", () => tr("PONTUAÇÃO")],
  ["perigo", () => tr("MAIOR PERIGO")],
];
const SPANS = [
  ["week", () => tr("ESTA SEMANA")],
  ["all", () => tr("DE SEMPRE")],
];
const MEDAL = [hex(PAL.yel3), hex(PAL.s4), hex(PAL.clay3)]; // 1º, 2º e 3º
const MEDAL_TINT = [0xffffff, PAL.s4, PAL.clay3]; // o troféu já é dourado: prata e bronze por cima dele
const TRIM = [[PAL.yel1, PAL.yel3], [PAL.s3, PAL.s4], [PAL.clay2, PAL.clay3]];
const PED_H = [40, 29, 21]; // altura dos pedestais (pixel de arte) do 1º ao 3º
const PX = 3; // escala da arte do pódio
const PODIUM_W = 500; // largura do pódio (coluna da esquerda)
let last = { board: "score", span: "week" };

// Encurta com "…" até caber (nome de jogador pode ser comprido ou ter letra que a fonte não tem)
function clip(t, room) {
  if (t.width <= room) return t;
  let s = t.text;
  while (s.length > 1 && t.width > room) {
    s = s.slice(0, -1);
    t.setText(s.trimEnd() + "…");
  }
  return t;
}

// Nome no pódio: encolhe um pouco antes de cortar (os 3 primeiros são os nomes que mais importam na janela)
function fitName(t, room) {
  if (t.width <= room) return t;
  const k = Math.max(0.72, room / t.width);
  t.setScale(k);
  return clip(t, room / k);
}

const pedestal = (scene, place) => {
  const key = `rank_pedestal_${place}`;
  if (!scene.textures.exists(key)) makePedestal(PED_H[place], TRIM[place]).register(scene, key);
  return key;
};

export function openRanking(scene, o = {}) {
  const board = BOARDS.some(([id]) => id === o.board) && Leaderboards.has(o.board) ? o.board : Leaderboards.has(last.board) ? last.board : "score";
  const span = o.span ?? last.span;
  last = { board, span };
  Analytics.track("rank_open", { board, span, from: o.from ?? "" });

  const ROW = Math.max(36, textPx(18) + 16);
  const MW = Math.min(1160, vw(scene) - 40);
  const m = new Modal(scene, { title: tr("RANKING"), w: MW, h: vh(scene), onClose: o.onClose });
  let y = m.top + 8;
  const L = -m.w / 2 + 28,
    R = m.w / 2 - 28; // bordas de dentro

  // Abas: o ranking à esquerda, o período à direita
  const boards = BOARDS.filter(([id]) => Leaderboards.has(id));
  const bw = Math.min(190, (m.w - 70) / (boards.length + SPANS.length) - 10);
  const tab = (x, label, on, go) =>
    m.add(new Button(scene, x, y + 22, bw, 44, label, () => !on && (m.close(), openRanking(scene, { ...o, ...go })), { size: 16, style: on ? "gold" : "dark", color: on ? CSS.goldHi : CSS.muted }));
  const all = [...boards.map(([id, l]) => [l(), id === board, { board: id }]), ...SPANS.map(([id, l]) => [l(), id === span, { span: id }])];
  const totalW = all.length * bw + (all.length - 1) * 10 + 26;
  all.forEach(([label, on, go], i) => {
    const gap = i >= boards.length ? 26 : 0; // separa os dois grupos
    tab(-totalW / 2 + bw / 2 + i * (bw + 10) + gap, label, on, go);
  });
  y += 58;

  // Área do pódio e da lista (altura fixa): 7 linhas (4º ao 10º) + "· · ·" + a do jogador, ou o pódio inteiro
  const areaTop = y;
  const nameH = textPx(17) + textPx(20) + 8;
  const podiumH = PED_H[0] * PX + 3 * PX + 58 + nameH + 18;
  const listRows = RANKING.TOP - 3 + 2;
  const areaH = Math.max(podiumH, listRows * ROW + 14);
  const area = m.add(scene.add.graphics());
  drawFrame(area, L, areaTop, R - L, areaH, "button", { flat: true });
  const body = m.add(scene.add.container(0, 0));
  const floor = areaTop + areaH - 12; // chão do pódio
  y = areaTop + areaH + 8;
  const totalT = m.add(text(scene, 0, y, "", { size: 14, color: CSS.dim, origin: [0.5, 0] }));
  y += textPx(14) + 8;

  // A conta dos pontos (transparência: o jogador sabe o que faz subir)
  const foot =
    board === "score"
      ? tr("Só partidas solo. Pontos: abates × {0}, mais {1} pela vitória, × o Perigo (até ×{2}).", RANKING.KILL, fmt(RANKING.VICTORY), RANKING.PERIGO_MULT.at(-1))
      : tr("Só partidas solo. Vale o Perigo mais alto que você já venceu.");
  // linhas equilibradas: com texto grande a 2ª linha ficava com 1 ou 2 caracteres ("3。")
  const probe = text(scene, 0, 0, foot, { size: 15 });
  const lines = Math.max(1, Math.ceil(probe.width / (m.w - 80)));
  const wrap = Math.min(m.w - 80, Math.ceil(probe.width / lines) + 30);
  probe.destroy();
  const ft = m.add(text(scene, 0, y, foot, { size: 15, color: CSS.dim, origin: [0.5, 0], align: "center", wrap }));
  y += ft.height + 16;
  m.fitContent(y);

  const valueOf = (v) => (board === "perigo" ? perigoName(v) : fmt(v));
  // "1." (a fonte de pixel não tem o "º"); japonês e chinês: 1位 / 第1名
  // rank ≤ 0: o Play Games tem a pontuação do jogador mas não diz a posição
  const rankOf = (r) => (r > 0 ? tr("{0}.", fmt(r)) : "—");
  const nameOf = (s) => (s.me ? (s.name ? tr("{0} (você)", s.name) : tr("Você")) : s.name || "—");
  const enter = (objs, delay, { dx = 0, dy = 0, pop = false, dur = 360 } = {}) => {
    for (const ob of objs) {
      const x = ob.x,
        yy = ob.y,
        sx = ob.scaleX,
        sy = ob.scaleY,
        a = ob.alpha;
      ob.setAlpha(0).setPosition(x + dx, yy + dy);
      if (pop) ob.setScale(sx * 0.4, sy * 0.4);
      scene.tweens.add({ targets: ob, alpha: a, x, y: yy, scaleX: sx, scaleY: sy, delay, duration: dur, ease: pop ? "Back.easeOut" : "Cubic.easeOut" });
    }
  };

  // Pódio: 2º à esquerda, 1º no meio (mais alto), 3º à direita. dim: só as pedras apagadas (carregando, vazio)
  const podium = (top3, cx, dim = false) => {
    const gapX = 158;
    const order = [1, 0, 2]; // da esquerda para a direita
    order.forEach((place, k) => {
      const s = top3[place];
      const x = cx + (k - 1) * gapX;
      const ph = PED_H[place] * PX;
      const ped = scene.add.image(x, floor, pedestal(scene, place)).setOrigin(0.5, 1).setScale(PX);
      const shadow = scene.add.image(x, floor + 2, "px_shadow").setScale(9, 2.2).setAlpha(0.55);
      body.add([shadow, ped]);
      // o número entalhado é a posição de verdade (empate: dois "1")
      const num = text(scene, x, floor - ph / 2 + 10, String(s?.rank > 0 ? s.rank : place + 1), { size: 34, color: s ? MEDAL[place] : CSS.dim, origin: 0.5, stroke: true });
      body.add(num);
      const delay = 80 + (2 - place) * 140; // o 3º sobe primeiro, o 1º por último
      // lugar vago (ou o ranking carregando/vazio): só a pedra apagada, esperando alguém
      if (dim || !s) {
        for (const ob of [shadow, ped, num]) ob.setAlpha(ob.alpha * 0.3);
        return;
      }
      enter([ped, num], delay, { dy: 60, dur: 420 });
      enter([shadow], delay, { dur: 420 });
      // troféu na laje, e em cima dele o nome e os pontos
      const ty = floor - ph - 30;
      if (place === 0) {
        const glow = scene.add.image(x, ty, "fx_glow").setScale(3.4).setTint(PAL.yel2).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
        body.add(glow);
        enter([glow], delay + 260, { dur: 500 });
        scene.tweens.add({ targets: glow, scale: 4, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: delay + 800 });
        // brilhinhos em volta do troféu do 1º
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const st = scene.add.image(x + Math.cos(a) * 36, ty - 6 + Math.sin(a) * 26, "px_dot2").setScale(2).setTint(PAL.yel3).setAlpha(0);
          body.add(st);
          scene.tweens.add({ targets: st, alpha: { from: 0, to: 1 }, duration: 500, yoyo: true, repeat: -1, delay: delay + 700 + i * 260, hold: 120, repeatDelay: 900 });
        }
      }
      const tro = scene.add.image(x, ty, "ico_trophy").setScale(4).setTint(MEDAL_TINT[place]);
      const sc = text(scene, x, ty - 44, valueOf(s.score), { size: 20, color: MEDAL[place], origin: 0.5, stroke: true });
      const nm = text(scene, x, sc.y - textPx(20) / 2 - textPx(17) / 2 - 2, nameOf(s), { size: 17, color: s.me ? CSS.goldHi : CSS.txt, origin: 0.5 });
      fitName(nm, gapX - 10);
      if (sc.width > gapX - 10) sc.setScale((gapX - 10) / sc.width);
      if (s.me) {
        // o jogador no pódio: moldura dourada atrás do nome
        const mg = scene.add.graphics();
        drawFrame(mg, x - gapX / 2 + 4, nm.y - textPx(17) / 2 - 6, gapX - 8, textPx(17) + textPx(20) + 18, "gold", { alpha: 0.7, noRivets: true });
        body.add(mg); // antes do troféu e do texto: fica por baixo deles
        enter([mg], delay + 300, {});
      }
      body.add([tro, sc, nm]);
      enter([tro], delay + 220, { pop: true, dur: 420 });
      enter([sc, nm], delay + 300, { dy: 8 });
    });
  };

  // Linha da lista (4º em diante, e a do jogador)
  let rankR = 0,
    nameX = 0;
  const listL = L + PODIUM_W,
    listR = R - 12;
  const columns = (ranks) => {
    const p = text(scene, 0, 0, rankOf(Math.max(...ranks, 10)), { size: 18 });
    rankR = listL + 18 + p.width;
    nameX = rankR + 16;
    p.destroy();
  };
  const row = (i, s, gap = false, x0 = listL, x1 = listR) => {
    const ry = areaTop + 8 + ROW * (i + 0.5);
    const g = scene.add.graphics();
    if (s.me) drawFrame(g, x0, ry - ROW / 2 + 1, x1 - x0, ROW - 2, "gold", { alpha: 0.85, noRivets: true });
    else if (i % 2 === 0) g.fillStyle(PAL.ink, 0.22).fillRect(x0 + 4, ry - ROW / 2 + 2, x1 - x0 - 8, ROW - 4);
    const color = s.me ? CSS.goldHi : CSS.txt;
    const rk = text(scene, rankR, ry, rankOf(s.rank), { size: 18, color: s.me ? CSS.goldHi : CSS.muted, origin: [1, 0.5] });
    const val = text(scene, x1 - 16, ry, valueOf(s.score), { size: 18, color, origin: [1, 0.5] });
    // a linha do jogador fora da lista vem sem nome (o Play Games só dá a posição): "Você"
    const nm = text(scene, nameX, ry, nameOf(s), { size: 18, color: s.me ? CSS.goldHi : CSS.txt, origin: [0, 0.5] });
    clip(nm, x1 - 16 - val.width - 24 - nameX);
    body.add([g, rk, nm, val]);
    enter([g, rk, nm, val], 260 + i * 55, { dx: 26, dur: 320 });
    if (gap) {
      const dots = text(scene, (x0 + x1) / 2, ry - ROW, "· · ·", { size: 18, color: CSS.dim, origin: 0.5 });
      body.add(dots);
      enter([dots], 260 + i * 55, {});
    }
    return { nm, val };
  };

  const status = (msg, button, dim = true) => {
    body.removeAll(true);
    totalT?.setText("");
    // pedras do pódio apagadas no fundo: o lugar esperando alguém
    if (dim) podium([], 0, true);
    // com botão, o texto cresce para cima dele (duas linhas não encostam no botão)
    const cy = areaTop + areaH * 0.36;
    const t = text(scene, 0, cy + (button ? 2 : 0), msg, { size: 20, color: CSS.txt, origin: button ? [0.5, 1] : 0.5, align: "center", wrap: m.w - 160 });
    body.add(t);
    if (button) body.add(new Button(scene, 0, cy + 40, 360, 52, button.label, button.go, { size: 20, style: "primary", color: CSS.goldHi }));
    m.add(body); // o que nasce depois também fica preso à tela (scrollFactor 0)
    return t;
  };

  const show = (data) => {
    if (m._closed) return;
    body.removeAll(true);
    const list = (data?.scores || []).slice(0, RANKING.TOP);
    const me = data?.player;
    // a partida do jogador que não subiu (o envio falhou): o aviso diz, com o código do Play Games, em vez de
    // a lista parecer só vazia
    const stuck = !data?.pending ? "" : data.code ? tr("Sua última partida ainda não chegou ao Play Games (erro {0}).", data.code) : tr("Sua última partida ainda não chegou ao Play Games.");
    if (!list.length && !me) {
      if (stuck) status(stuck, { label: tr("TENTAR DE NOVO"), go: () => fetch(true) });
      else status(span === "week" ? tr("Ninguém pontuou nesta semana ainda. Que tal ser o primeiro?") : tr("Ninguém pontuou ainda. Que tal ser o primeiro?"));
      return;
    }
    // o pódio: os 3 primeiros da lista que estão mesmo entre os 3 primeiros (a lista vem em ordem)
    const top3 = [0, 1, 2].map((k) => (list[k] && list[k].rank >= 1 && list[k].rank <= 3 ? list[k] : null));
    const onPodium = new Set(top3.filter(Boolean));
    const rest = list.filter((s) => !onPodium.has(s));
    const meOut = me && !list.some((s) => s.me);
    // a lista ao lado só quando há alguém além do pódio (ou o jogador fora dela); senão o pódio fica no meio
    const wide = rest.length > 0 || meOut;
    const hidden = me && !(me.rank > 0) && !list.some((s) => s.me);
    // sem ninguém no pódio (só o jogador, sem posição): as pedras apagadas no fundo, esperando alguém
    if (onPodium.size) podium(top3, wide ? L + PODIUM_W / 2 : 0);
    else podium([], 0, true);
    let used = 0;
    let meRow = null;
    if (wide) {
      // sem pódio (só o jogador, sem posição): a linha dele ocupa a largura toda
      const full = !onPodium.size;
      const x0 = full ? L + 12 : listL,
        x1 = full ? R - 12 : listR;
      columns([...rest.map((s) => s.rank), me?.rank ?? 0]);
      if (full) {
        const p = text(scene, 0, 0, rankOf(Math.max(me?.rank ?? 0, 10)), { size: 18 });
        rankR = x0 + 18 + p.width;
        nameX = rankR + 16;
        p.destroy();
      }
      rest.forEach((s, i) => row(i, s, false, x0, x1));
      used = rest.length;
      // fora da lista (ou a lista pública não mostra o jogador): a linha "Você" embaixo, ou no topo sem lista
      if (meOut) {
        meRow = row(rest.length ? rest.length + 1 : 0, { rank: me.rank, score: me.score, me: true, name: "" }, rest.length > 0, x0, x1);
        used = rest.length ? rest.length + 2 : 1;
      }
    }
    // o Play Games tem a pontuação mas não diz a posição: o perfil do jogador está privado (só ele se vê; achado
    // no aparelho em 20/10, com "Tornar o perfil privado" ligado)
    const total = data.total === 1 ? tr("1 jogador neste período") : data.total > 0 ? tr("{0} jogadores neste período", fmt(data.total)) : "";
    const hint = hidden ? tr("Só você vê sua pontuação: deixe o perfil do Play Games público para aparecer.") : "";
    // com espaço na área (o comum: o jogador sozinho, sem posição), o aviso vai no quadro, abaixo da linha dele;
    // lista cheia, na linha de baixo
    const roomy = hint && used <= listRows - 3;
    if (roomy) {
      // logo abaixo da última linha (o pódio apagado ocupa o pé da área)
      const top = areaTop + 8 + ROW * used;
      const ht = text(scene, 0, top + 14, hint, { size: 18, color: CSS.txt, origin: [0.5, 0], align: "center", wrap: m.w - 160 });
      body.add(ht);
      enter([ht], 500, { dy: 6 });
    }
    totalT.setText(stuck || (hint && !roomy ? hint : total));
    totalT.setColor(stuck || (hint && !roomy) ? CSS.muted : CSS.dim);
    clip(totalT, m.w - 80);
    m.add(body);
    return meRow;
  };

  const fetch = (fresh = false) => {
    const t = status(tr("Carregando o ranking…"));
    scene.tweens.add({ targets: t, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    Leaderboards.scores(board, span, { fresh })
      .then(show)
      .catch((e) => {
        if (m._closed) return;
        if (e.reason === "signin")
          status(tr("Entre no Play Games para ver o ranking e aparecer nele."), {
            label: tr("ENTRAR NO PLAY GAMES"),
            go: async () => (await Leaderboards.signIn()) && fetch(true),
          });
        else status(tr("Sem conexão com o Play Games agora."), { label: tr("TENTAR DE NOVO"), go: () => fetch(true) });
      });
  };
  fetch(!!o.fresh);
  return m;
}
