// Ranking (Google Play Games; src/systems/Leaderboards.js): dois rankings (Pontuação · Maior Perigo), cada um
// com a semana e o de sempre. Lista os primeiros, a linha do jogador destacada (e a posição dele embaixo, se
// estiver fora da lista) e a conta dos pontos. A janela tem altura fixa para não pular quando os dados chegam;
// trocar de aba reabre a janela, e a lista vem do cache por 1 min.
import { RANKING } from "../config.js";
import { Leaderboards, perigoName } from "../systems/Leaderboards.js";
import { Analytics } from "../systems/Analytics.js";
import { text, drawFrame, Button, vh, textPx, PAL, CSS, hex } from "./Theme.js";
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

export function openRanking(scene, o = {}) {
  const board = BOARDS.some(([id]) => id === o.board) && Leaderboards.has(o.board) ? o.board : Leaderboards.has(last.board) ? last.board : "score";
  const span = o.span ?? last.span;
  last = { board, span };
  Analytics.track("rank_open", { board, span, from: o.from ?? "" });

  const ROW = Math.max(34, textPx(18) + 14);
  const N = RANKING.TOP + 2; // a lista + "…" + a linha do jogador, se estiver fora
  const W = 760;
  const m = new Modal(scene, { title: tr("RANKING"), w: W, h: vh(scene), onClose: o.onClose });
  let y = m.top + 8;

  // Abas: o ranking à esquerda, o período à direita
  const boards = BOARDS.filter(([id]) => Leaderboards.has(id));
  const bw = Math.min(168, (m.w - 70) / (boards.length + SPANS.length) - 10);
  const tab = (x, label, on, go) =>
    m.add(new Button(scene, x, y + 22, bw, 44, label, () => !on && (m.close(), openRanking(scene, { ...o, ...go })), { size: 16, style: on ? "gold" : "dark", color: on ? CSS.goldHi : CSS.muted }));
  const all = [...boards.map(([id, l]) => [l(), id === board, { board: id }]), ...SPANS.map(([id, l]) => [l(), id === span, { span: id }])];
  const totalW = all.length * bw + (all.length - 1) * 10 + 26;
  all.forEach(([label, on, go], i) => {
    const gap = i >= boards.length ? 26 : 0; // separa os dois grupos
    tab(-totalW / 2 + bw / 2 + i * (bw + 10) + gap, label, on, go);
  });
  y += 56;

  // Área da lista (altura fixa)
  const listTop = y,
    listH = N * ROW + 12;
  // fundo verde-escuro (o dos botões) com listras alternadas: o olho segue a linha do nome até os pontos
  const lg = m.add(scene.add.graphics());
  drawFrame(lg, -m.w / 2 + 28, listTop, m.w - 56, listH, "button", { flat: true });
  lg.fillStyle(PAL.ink, 0.22);
  for (let i = 1; i < RANKING.TOP; i += 2) lg.fillRect(-m.w / 2 + 40, listTop + 6 + ROW * i, m.w - 80, ROW);
  const body = m.add(scene.add.container(0, 0));
  const status = (msg, button) => {
    body.removeAll(true);
    totalT?.setText("");
    // com botão, o texto cresce para cima dele (duas linhas não encostam no botão)
    const t = text(scene, 0, listTop + listH / 2 + (button ? 2 : 0), msg, { size: 20, color: CSS.muted, origin: button ? [0.5, 1] : 0.5, align: "center", wrap: m.w - 120 });
    body.add(t);
    if (button) body.add(new Button(scene, 0, listTop + listH / 2 + 40, 340, 52, button.label, button.go, { size: 20, style: "primary", color: CSS.goldHi }));
    m.add(body); // o que nasce depois também fica preso à tela (scrollFactor 0)
  };
  y = listTop + listH + 6;
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
  // colunas: troféu, posição (largura da maior posição da lista: "37位", "第1.234名"), nome, pontos
  const ICON_X = -m.w / 2 + 58;
  let rankR = ICON_X + 40,
    nameX = rankR + 16;
  const columns = (ranks) => {
    const probe = text(scene, 0, 0, rankOf(Math.max(...ranks, 10)), { size: 18 });
    rankR = ICON_X + 26 + probe.width;
    nameX = rankR + 16;
    probe.destroy();
  };
  const row = (i, s, gap = false) => {
    const ry = listTop + 6 + ROW * (i + 0.5);
    if (s.me) {
      const g = scene.add.graphics();
      drawFrame(g, -m.w / 2 + 36, ry - ROW / 2 + 1, m.w - 72, ROW - 2, "gold", { alpha: 0.85, noRivets: true });
      body.add(g);
    }
    // os três primeiros ganham o troféu na cor da medalha (ouro, prata, bronze)
    const podium = s.rank >= 1 && s.rank <= 3;
    if (podium) body.add(scene.add.image(ICON_X, ry, "ico_trophy").setScale(2).setTint(MEDAL_TINT[s.rank - 1]));
    const color = s.me ? CSS.goldHi : podium ? MEDAL[s.rank - 1] : CSS.txt;
    const rk = text(scene, rankR, ry, rankOf(s.rank), { size: 18, color, origin: [1, 0.5] });
    const val = text(scene, m.w / 2 - 54, ry, valueOf(s.score), { size: 18, color: s.me ? CSS.goldHi : CSS.txt, origin: [1, 0.5] });
    // a linha do jogador fora da lista vem sem nome (o Play Games só dá a posição): "Você"
    const name = s.me ? (s.name ? tr("{0} (você)", s.name) : tr("Você")) : s.name || "—";
    const nm = text(scene, nameX, ry, name, { size: 18, color: s.me ? CSS.goldHi : CSS.muted, origin: [0, 0.5] });
    clip(nm, m.w / 2 - 54 - val.width - 24 - nameX);
    body.add([rk, nm, val]);
    if (gap) body.add(text(scene, 0, ry - ROW, "· · ·", { size: 18, color: CSS.dim, origin: 0.5 }));
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
    columns([...list.map((s) => s.rank), me?.rank ?? 0]);
    list.forEach((s, i) => row(i, s));
    // fora da lista (ou a lista pública não mostra o jogador): a linha "Você" embaixo, ou no topo se a lista
    // veio vazia
    if (me && !list.some((s) => s.me)) row(list.length ? list.length + 1 : 0, { rank: me.rank, score: me.score, me: true, name: "" }, list.length > 0);
    totalT.setText(stuck || (data.total > 0 ? tr("{0} jogadores neste período", fmt(data.total)) : ""));
    totalT.setColor(stuck ? CSS.muted : CSS.dim);
    clip(totalT, m.w - 80);
    m.add(body);
  };

  const fetch = (fresh = false) => {
    status(tr("Carregando o ranking…"));
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
