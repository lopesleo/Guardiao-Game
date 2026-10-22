// Painéis de meta-progressão (Bênçãos, Arsenal, Conquistas, Guia, Opções,
// Créditos, Personagens) compartilhados pela tela de título e pela Clareira.
// Uso: Object.assign(MinhaCena.prototype, MetaPanels). A cena precisa ter
// this.meta (MetaProgression), this.W/this.H, this._modals e this._refreshAll().
import { META, BLESSINGS, MAX_BLESSING_RANK, ACHIEVEMENTS, CHARACTERS, WEAPONS, BUILD, BUILDINGS, LEGENDS } from "../config.js";
import { fmtDuration } from "../systems/Builds.js";
import { AdService } from "../systems/AdService.js";
import { Analytics } from "../systems/Analytics.js";
import { Review } from "../systems/Review.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { WEAPON_DESC } from "../systems/UpgradeSystem.js";
import { text, drawFrame, Button, haptic } from "./Theme.js";
import { Modal, ScrollList } from "./Widgets.js";
import { openSettings } from "./SettingsModal.js";
import { applyZoom } from "./Zoom.js";
import { joyRight } from "./VirtualJoystick.js";
import { tr, fmt } from "../i18n/i18n.js";

const BLESSING_ICON = {
  hp1: "ico_heart",
  spd1: "ico_dash_green",
  dmg1: "ico_sword",
  pickup: "ico_magnet",
  awaken1: "ico_star",
  dash1: "ico_dash",
  xp1: "ico_gem",
  crit1: "ico_crit",
};

export const MetaPanels = {
  // Linha de OBRA no topo do painel de uma construção (só na Clareira, onde
  // existe this.builds): melhorar, acompanhar a obra, concluir, adiantar.
  _buildRow(list, id, reopen) {
    const b = this.builds;
    if (!b) return;
    const name = BUILDINGS[id].name.toUpperCase();
    const lv = b.level(id);
    const step = b.nextStep(id);
    const job = b.job;
    let o;
    if (!step) {
      o = { icon: "ico_trophy", name: tr("{0} · NÍVEL {1} (MÁXIMO)", name, lv), desc: tr("Construção completa."), style: "green", nameColor: CSS.green };
    } else if (job && job.id === id) {
      const rem = b.remainingMs();
      const free = b.canFinishFree();
      o = {
        icon: "ico_hourglass",
        name: tr("EM OBRA → NÍVEL {0}", job.to),
        desc: `${b.nextPerk(id)} · ${free ? tr("pronta para concluir") : tr("cada partida adianta a obra")}`,
        right: free ? tr("CONCLUIR") : fmtDuration(rem),
        rightColor: free ? CSS.green : CSS.gold,
        style: free ? "green" : "dark",
        onTap: free
          ? () => {
              const r = b.finishFree();
              if (r) {
                this._onBuildDone?.(r);
                reopen();
              }
            }
          : null,
      };
    } else {
      const blk = b.blocker(id);
      const time = step.min ? fmtDuration(step.min * 60000) : tr("na hora");
      const right = { busy: tr("JOÃO OCUPADO"), coins: tr("FALTAM MOEDAS"), wood: tr("FALTA MADEIRA") }[blk] ?? tr("CONSTRUIR");
      o = {
        icon: "ico_wood",
        name: tr("MELHORAR PARA O NÍVEL {0}  ·  {1}", lv + 1, time),
        desc: tr("{0} · {1} moedas + {2} madeira", b.nextPerk(id), step.coins, step.wood),
        right,
        rightColor: blk ? CSS.dim : CSS.goldHi,
        nameColor: blk ? CSS.txt : CSS.goldHi,
        style: blk ? "dark" : "gold",
        onTap: blk
          ? null
          : () =>
              this._confirmBuild({ id, from: lv, step, time }, () => {
                const r = b.start(id);
                if (!r) return;
                this._buyFx();
                if (r.done) this._onBuildDone?.(r);
                else this._onBuildStarted?.(r);
                reopen();
              }),
      };
    }
    list.addRow(this._shopRow(o));
    // Anúncio opcional: adiantar a obra em andamento (desligado com ADS.ENABLED)
    if (job && job.id === id && !b.canFinishFree() && AdService.canShow("build_speed")) {
      // uma vez por obra a cada visita (o painel se refaz a cada toque)
      if (this._buildAdSeen !== job) {
        this._buildAdSeen = job;
        Analytics.track("ad_offer_show", { placement: "build_speed" });
      }
      list.addRow(
        this._shopRow({
          h: 56,
          icon: AdService.icon,
          name: tr("ADIANTAR {0} MIN", BUILD.AD_SPEEDUP_MIN),
          desc: tr("Assista a um anúncio (opcional)"),
          style: "button",
          onTap: async () => {
            if (await AdService.rewarded("build_speed")) {
              b.advance(BUILD.AD_SPEEDUP_MIN * 60000);
              this._onBuildStarted?.(job);
              reopen();
            }
          },
        }),
      );
    }
  },

  // Confirmação antes de gastar moedas e madeira numa obra (evita toque sem querer)
  _confirmBuild({ id, from, step, time }, onYes) {
    const b = this.builds;
    const m = new Modal(this, { title: tr("CONSTRUIR?"), subtitle: tr("{0} · nível {1} → {2}", BUILDINGS[id].name, from, from + 1), w: 600, h: 400 });
    m.add(text(this, 0, -62, b.nextPerk(id), { size: 20, color: CSS.goldHi, origin: 0.5, align: "center", wrap: 520 }));
    m.add(text(this, 0, 4, tr("Custo: {0} moedas + {1} madeira\nTempo: {2}", step.coins, step.wood, time), { size: 19, align: "center", origin: 0.5, lineSpacing: 6 }));
    m.add(new Button(this, -135, 120, 240, 56, tr("CONSTRUIR"), () => (m.close(), onYes()), { size: 20, style: "primary" }));
    m.add(new Button(this, 135, 120, 240, 56, tr("VOLTAR"), () => m.close(), { size: 20 }));
  },

  // Cabeçalho de seção dentro de uma lista
  _section(list, label, color = CSS.goldHi) {
    list.addRow({ h: 36, build: (c, w) => c.add(text(this, w / 2, 20, label, { size: 18, color, origin: 0.5 })) });
  },

  // Ninho do João-de-barro: todas as obras num lugar só
  _showWorks() {
    const m = new Modal(this, { title: tr("JOÃO-DE-BARRO"), subtitle: tr("O construtor da Clareira · uma obra por vez"), w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showWorks();
    };
    for (const id of this._workIds?.() ?? ["fire", "shrine", "forge"]) {
      this._section(list, tr("{0} · NÍVEL {1}", BUILDINGS[id].name.toUpperCase(), this.builds.level(id)));
      this._buildRow(list, id, reopen);
    }
  },

  _modalList(m, rowsTop = null) {
    const W = this.W,
      H = this.H;
    const x = W / 2 - m.w / 2 + 30;
    const y = H / 2 + (rowsTop ?? m.top) + 6;
    const list = new ScrollList(this, x, y, m.w - 76, H / 2 + m.h / 2 - 24 - y, m.root.depth + 3);
    m.list = list;
    // Lista curta: depois que as linhas forem montadas (fim desta chamada), a
    // janela encolhe até o conteúdo — sem o vazio enorme embaixo (Obras, Celeiro…)
    queueMicrotask(() => {
      if (m._closed) return;
      m.fitToList?.();
      if (m.restoreScroll != null) list.setScroll(m.restoreScroll); // reaberta após compra: mesma posição
    });
    return list;
  },

  _shopRow(o) {
    const scene = this;
    return {
      h: o.h ?? 74,
      onTap: o.onTap,
      build(c, w) {
        // Rótulo da direita primeiro: o texto da esquerda fica com o espaço que sobra (com
        // tradução ou texto grande, "FALTA MADEIRA" e cia. encostavam na descrição)
        const rt = o.right ? text(scene, 0, 0, o.right, { size: 20, color: o.rightColor ?? CSS.goldHi, origin: [1, 0.5], stroke: true }) : null;
        if (rt && rt.width > w * 0.3) rt.setScale((w * 0.3) / rt.width);
        const rightW = Math.max(o.pips != null ? 250 : 0, rt ? rt.displayWidth + (o.rightIcon ? 40 : 0) + 20 : 0);
        const room = w - 74 - rightW - 24;
        // Textos: a altura da linha acompanha o tamanho do texto (acessibilidade)
        const name = text(scene, 74, 0, o.name, { size: 20, color: o.nameColor ?? CSS.txt, origin: [0, 0] });
        if (name.width > room) name.setScale(room / name.width);
        const desc = text(scene, 74, 0, o.desc, { size: 14, color: CSS.muted, origin: [0, 0], shadow: false, wrap: Math.min(w - 300, room) });
        const block = name.displayHeight + 3 + desc.height;
        const h = Math.max(o.h ?? 74, Math.ceil(block + 24));
        name.y = Math.round((h - block) / 2);
        desc.y = name.y + name.displayHeight + 3;
        const g = scene.add.graphics();
        const draw = (hover) => {
          g.clear();
          drawFrame(g, 0, 0, w, h, hover && o.onTap ? { ...(o.styleObj ?? {}), border: PAL.uiGoldHi, body: PAL.uiPanel2, hi: 0x2b463a, lo: PAL.uiLine } : o.style ?? "dark", { noRivets: true });
        };
        draw(false);
        this.hover = draw;
        c.add(g);
        const hh = h / 2;
        if (o.icon) c.add(scene.add.image(40, hh, o.icon, o.iconFrame ?? 0).setScale(o.iconScale ?? 3).setAlpha(o.dim ? 0.45 : 1));
        c.add([name, desc]);
        if (o.pips != null) {
          // Até 5 numa linha; mais que isso (bênçãos: 10 ranks) em duas linhas de 5,
          // ocupando a mesma largura (a direita da linha é do preço)
          const perRow = Math.min(5, o.pipsMax);
          const rows = Math.ceil(o.pipsMax / perRow);
          for (let i = 0; i < o.pipsMax; i++) {
            const row = Math.floor(i / perRow);
            const y = hh + (row - (rows - 1) / 2) * 17;
            c.add(scene.add.rectangle(w - 250 + (i % perRow) * 18, y, 12, 12, i < o.pips ? PAL.yel2 : PAL.inkSoft).setStrokeStyle(3, PAL.ink));
          }
        }
        if (rt) {
          const rc = scene.add.container(w - 20, hh);
          rc.add(rt);
          if (o.rightIcon) rc.add(scene.add.image(-rt.displayWidth - 18, 0, o.rightIcon).setScale(2.5));
          c.add(rc);
        }
        return h;
      },
    };
  },

  _buyFx() {
    this.sound.play("sfx_coin_cascade", { volume: 0.5 });
    haptic(30);
  },

  _showBlessings() {
    const m = new Modal(this, { title: tr("SANTUÁRIO"), subtitle: tr("Bênçãos e dons permanentes — valem para todos os guardiões"), w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showBlessings();
    };
    const section = (label, color = CSS.goldHi) => this._section(list, label, color);
    this._buildRow(list, "shrine", reopen);
    const cap = this.builds ? this.builds.shrineRankCap() : MAX_BLESSING_RANK;
    // Dons: habilidades ativas liberadas uma vez (antes ficavam na Forja)
    section(tr("DONS DA FLORESTA"));
    const gifts = [
      { key: "DASH", name: tr("Dash"), icon: "ico_dash", desc: tr("Esquiva rápida e invulnerável (SHIFT / botão)") },
      { key: "AWAKEN", name: tr("Despertar"), icon: "ico_star", desc: tr("Modo fúria: armas disparam 2,5× mais rápido") },
    ];
    for (const g of gifts) {
      const cost = META.ABILITY_UNLOCK_COST[g.key];
      const has = this.meta.hasAbility(g.key);
      const can = !has && this.meta.coins >= cost;
      list.addRow(
        this._shopRow({
          icon: g.icon,
          name: g.name,
          desc: g.desc,
          right: has ? tr("LIBERADO") : String(cost),
          rightIcon: has ? null : "ico_coin",
          rightColor: has ? CSS.green : can ? CSS.goldHi : CSS.dim,
          style: has ? "green" : can ? "button" : "dark",
          onTap: can
            ? () => {
                if (this.meta.unlockAbility(g.key, cost)) {
                  this._buyFx();
                  reopen();
                }
              }
            : null,
        }),
      );
    }
    section(tr("BÊNÇÃOS"));
    for (const b of BLESSINGS) {
      const rank = this.meta.blessingRank(b.id);
      const cost = this.meta.blessingNextCost(b);
      const capped = cost != null && rank >= cap; // Santuário ainda baixo
      const can = cost != null && !capped && this.meta.coins >= cost;
      list.addRow(
        this._shopRow({
          icon: BLESSING_ICON[b.id],
          name: b.name,
          desc: b.desc,
          pips: rank,
          pipsMax: MAX_BLESSING_RANK,
          right: cost == null ? tr("MÁX") : capped ? tr("SANTUÁRIO NV {0}", Math.ceil((rank + 1) / 2)) : String(cost),
          rightIcon: cost == null || capped ? null : "ico_coin",
          rightColor: cost == null ? CSS.green : can ? CSS.goldHi : CSS.dim,
          style: cost == null ? "green" : can ? "button" : "dark",
          onTap: can
            ? () => {
                if (this.meta.rankUpBlessing(b)) {
                  this._buyFx();
                  reopen();
                }
              }
            : null,
        }),
      );
    }
    const ac = this.meta.ancestralCost();
    const acan = this.meta.coins >= ac;
    list.addRow(
      this._shopRow({
        icon: "ico_trophy",
        name: tr("Tesouro Ancestral"),
        desc: tr("+2% de dano geral por nível · Nível {0} (sem limite)", this.meta.ancestralLevel),
        right: String(ac),
        rightIcon: "ico_coin",
        rightColor: acan ? CSS.goldHi : CSS.dim,
        nameColor: CSS.goldHi,
        style: acan ? "gold" : "dark",
        onTap: acan
          ? () => {
              if (this.meta.buyAncestral()) {
                this._buyFx();
                reopen();
              }
            }
          : null,
      }),
    );
  },

  _showArsenal() {
    const m = new Modal(this, { title: tr("FORJA"), subtitle: tr("Armas novas nas cartas de nível · vagas de arma na partida: {0}", this.builds ? this.builds.weaponSlots() : 2), w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showArsenal();
    };
    const elName = { fire: tr("Fogo"), ice: tr("Gelo"), bolt: tr("Raio"), wind: tr("Vento") };
    this._buildRow(list, "forge", reopen);
    this._section(list, tr("ARMAS"));
    const rows = [
      { kind: "weapon", key: "STAFF", cost: 0 },
      { kind: "weapon", key: "AURA", cost: 0 },
      ...META.WEAPON_UNLOCK_ORDER.map((k) => ({ kind: "weapon", key: k, cost: META.WEAPON_UNLOCK_COST[k] })),
    ];
    for (const r of rows) {
      const has = r.kind === "weapon" ? r.cost === 0 || this.meta.isUnlocked(r.key) : this.meta.hasAbility(r.key);
      const allowed = !this.builds || r.cost === 0 || this.builds.forgeAllows(r.key);
      // Feito da Forja ainda por cumprir: mostra o desafio e o progresso, sem deixar comprar
      const deed = has ? null : this.meta.weaponDeed(r.key);
      const deedOpen = deed && !deed.done;
      const can = !has && allowed && !deedOpen && this.meta.coins >= r.cost;
      const def = WEAPONS[r.key];
      list.addRow(
        this._shopRow({
          icon: r.icon ?? WEAPON_ICON[r.key],
          name: r.name ?? `${def.name}  ·  ${elName[def.element]}`,
          desc: deedOpen ? tr("{0}\nFeito para forjar: {1} ({2}/{3})", WEAPON_DESC[r.key], deed.text, fmt(deed.p), fmt(deed.n)) : r.desc ?? WEAPON_DESC[r.key],
          right: has ? tr("FORJADA") : !allowed ? tr("FORJA NV {0}", BUILD.FORGE_WEAPON_LEVEL[r.key]) : deedOpen ? tr("FALTA O FEITO") : String(r.cost),
          rightIcon: has || !allowed || deedOpen ? null : "ico_coin",
          rightColor: has ? CSS.green : can ? CSS.goldHi : CSS.dim,
          style: has ? "green" : can ? "button" : "dark",
          onTap: can
            ? () => {
                const ok = r.kind === "weapon" ? this.meta.unlock(r.key) : this.meta.unlockAbility(r.key, r.cost);
                if (ok) {
                  this._buyFx();
                  reopen();
                }
              }
            : null,
        }),
      );
    }
    // Evoluções: receitas visíveis (descoberta guiada)
    list.addRow({
      h: 40,
      build: (c, w) => c.add(text(this, w / 2, 24, tr("RECEITAS DE EVOLUÇÃO"), { size: 18, color: hex(PAL.pur3), origin: 0.5 })),
    });
    for (const [k, d] of Object.entries(WEAPONS)) {
      if (!d.evolvesFrom) continue;
      list.addRow(
        this._shopRow({
          h: 62,
          icon: WEAPON_ICON[k],
          name: d.name,
          desc: tr("{0} nível 5 + {1}", WEAPONS[d.evolvesFrom].name, WEAPONS[d.partner].name),
          style: "purple",
        }),
      );
    }
  },

  // Mural: abas Conquistas | Lendas (bestiário)
  _showBoard(tab = "conquistas") {
    const done = this.meta.data.achievements;
    const seen = LEGENDS.filter((l) => this._legendSeen(l)).length;
    const missions = !!this._daily?.();
    if (tab === "missoes" && !missions) tab = "conquistas"; // aba ainda não liberada
    const m = new Modal(this, {
      title: tr("MURAL"),
      subtitle: tab === "missoes" ? tr("Três missões por dia · o prêmio se pega aqui") : tab === "lendas" ? tr("Lendas da mata encontradas: {0} de {1}", seen, LEGENDS.length) : tr("Conquistas: {0} de {1}", ACHIEVEMENTS.filter((a) => done.includes(a.id)).length, ACHIEVEMENTS.length),
      w: 860,
      h: 640,
    });
    const tabY = m.top + 26;
    const tabBtn = (x, id, label) =>
      m.add(
        new Button(this, x, tabY, 240, 44, label, () => {
          if (tab === id) return;
          m.close();
          this._showBoard(id);
        }, { size: 18, style: tab === id ? "gold" : "dark", color: tab === id ? CSS.goldHi : CSS.muted }),
      );
    if (missions) {
      tabBtn(-250, "missoes", tr("MISSÕES"));
      tabBtn(0, "conquistas", tr("CONQUISTAS"));
      tabBtn(250, "lendas", tr("LENDAS"));
    } else {
      tabBtn(-128, "conquistas", tr("CONQUISTAS"));
      tabBtn(128, "lendas", tr("LENDAS"));
    }
    const list = this._modalList(m, m.top + 58);
    if (tab === "missoes" && missions)
      return this._fillMissions(list, () => {
        m.close();
        this._refreshAll();
        this._showBoard("missoes");
      });
    if (tab === "lendas") return this._fillLegends(list);
    this._fillAchievements(list);
  },

  _showAchievements() {
    this._showBoard("conquistas");
  },

  _legendSeen(l) {
    return l.char ? this.meta.hasCharacter(l.char) : (this.meta.data.legendsSeen || []).includes(l.id);
  },

  // Fichas das lendas: retrato, papel no jogo e ORIGEM da lenda
  _fillLegends(list) {
    for (const l of LEGENDS) {
      const ok = this._legendSeen(l);
      list.addRow({
        h: 118,
        build: (c, w) => {
          const t1 = text(this, 120, 12, ok ? l.name : "???", { size: 21, color: ok ? CSS.goldHi : CSS.dim, origin: [0, 0] });
          const t2 = text(this, 120, 12 + t1.height + 2, ok ? l.role : tr("Encontre na floresta para conhecer esta lenda."), { size: 14, color: ok ? CSS.green : CSS.dim, origin: [0, 0], wrap: w - 140 });
          const t3 = ok ? text(this, 120, t2.y + t2.height + 4, l.origin, { size: 14, color: CSS.muted, origin: [0, 0], wrap: w - 140, shadow: false }) : null;
          const h = Math.max(118, Math.ceil((t3 ? t3.y + t3.height : t2.y + t2.height) + 14));
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, h, ok ? "gold" : "dark", { noRivets: true });
          const [tex, frame, sc] = l.sprite;
          const img = this.add.image(58, h / 2, tex, frame).setScale(sc);
          if (!ok) img.setTint(0x1a1420).setTintMode(Phaser.TintModes.FILL).setAlpha(0.6);
          c.add([g, img, t1, t2]);
          if (t3) c.add(t3);
          return h;
        },
      });
    }
  },

  _fillAchievements(list) {
    const done = this.meta.data.achievements;
    const ctx = this.meta.buildAchievementCtx();
    // Desbloqueadas por último → mostra primeiro o que falta
    const sorted = ACHIEVEMENTS.slice().sort((a, b) => done.includes(a.id) - done.includes(b.id));
    for (const a of sorted) {
      const has = done.includes(a.id);
      let right = has ? "OK" : "";
      if (!has && a.prog) {
        const [cur, goal] = a.prog(ctx);
        right = `${Math.min(cur, goal)}/${goal}`;
      }
      list.addRow(
        this._shopRow({
          h: 64,
          icon: has ? "ico_trophy" : "ico_lock",
          name: a.name,
          nameColor: has ? CSS.goldHi : CSS.txt,
          desc: a.desc,
          right,
          rightColor: has ? CSS.green : CSS.gold,
          style: has ? "gold" : "dark",
        }),
      );
    }
  },

  _showGuide() {
    const m = new Modal(this, { title: tr("GUIA DA FLORESTA"), w: 880, h: 640 });
    const list = this._modalList(m);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const sections = [
      ["ico_dash", tr("Movimento"), touch ? (joyRight() ? tr("Arraste o polegar na metade direita da tela para andar. O ataque é automático.") : tr("Arraste o polegar na metade esquerda da tela para andar. O ataque é automático.")) :tr("WASD ou setas para andar. O ataque é automático — posicione-se.")],
      ["ico_gem", tr("Nível"), tr("Colete gemas verdes para subir de nível e escolher 1 de 3 cartas: novas armas, melhorias ou passivas.")],
      ["ico_staff", tr("Elementos"), tr("Cada arma aplica um elemento: Fogo, Gelo ou Raio. Dois elementos no mesmo inimigo disparam uma REAÇÃO.")],
      ["ico_cloud", tr("Vapor (Fogo + Gelo)"), tr("Nuvem escaldante que causa dano contínuo na área.")],
      ["ico_aura", tr("Cristal (Gelo + Raio)"), tr("O inimigo estilhaça e fere quem está perto. Congelado, o estilhaço é bem maior.")],
      ["ico_bolt_gold", tr("Sobrecarga (Fogo + Raio)"), tr("Corrente elétrica que salta entre vários inimigos.")],
      ["ico_star", tr("Despertar"), tr("Reações enchem a barra dourada. Ative para disparar tudo muito mais rápido por alguns segundos.")],
      ["ico_chest", tr("Baús"), tr("Encoste num baú para abri-lo: tesouro, jackpot dourado… ou uma armadilha (e o temido mímico).")],
      ["ico_heart_ice", tr("Evoluções"), tr("Arma no nível 5 + a arma parceira na mesma partida = carta de EVOLUÇÃO garantida. Veja as receitas na Forja da Clareira.")],
      ["ico_skull", tr("O Mapinguari"), tr("No fim da partida (7 a 10 min, conforme o Perigo) o gigante da mata desperta, tomado pela Podridão. Vença-o para libertá-lo e liberar o próximo Perigo.")],
      ["ico_coin", tr("A Clareira"), tr("Entre partidas: Santuário (bênçãos e dons), Forja (armas), Fogueira (guardiões), Mural (conquistas). A trilha ao norte leva à floresta.")],
    ];
    if ((this.meta.data.revealed || []).includes("garden"))
      sections.push(["ico_sprout", tr("Horta"), tr("Ande até um canteiro e use o botão de ação para plantar e cuidar; passe por cima do que está maduro para colher. As plantas crescem em tempo real, mesmo com o jogo fechado. Cuidar em dia dá qualidade Ouro — nada morre, só perde qualidade. A colheita fica no Celeiro. Sementes raras caem dos minichefes, do baú dourado e do Mapinguari.")]);
    if ((this.meta.data.revealed || []).includes("kitchen"))
      sections.push(["ico_dish_roast_carrot", tr("Cozinha"), tr("Transforme a colheita em pratos. Coma um antes de partir: o bônus vale só na próxima partida — ingredientes Ouro dão um bônus maior.")]);
    if ((this.meta.data.revealed || []).includes("pond"))
      sections.push(["ico_lambari", tr("Lago"), tr("No trapiche, jogue a linha e toque quando a boia afundar. Segure para subir a zona verde e solte para descer: mantenha o peixe dentro até a barra encher. Sem deixar o peixe sair = qualidade Ouro. O lago descansa depois de alguns peixes; bolhas na água mostram que eles voltaram.")]);
    for (const [icon, name, desc] of sections) {
      list.addRow({
        h: 84,
        build: (c, w) => {
          const t1 = text(this, 80, 0, name, { size: 20, color: CSS.goldHi, origin: [0, 0] });
          const t2 = text(this, 80, 0, desc, { size: 15, color: CSS.muted, origin: [0, 0], wrap: w - 100, shadow: false });
          const h = Math.max(84, Math.ceil(t1.height + 4 + t2.height + 24));
          t1.y = 12;
          t2.y = 12 + t1.height + 4;
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, h, "dark", { noRivets: true });
          c.add([g, this.add.image(40, h / 2, icon).setScale(3), t1, t2]);
          return h;
        },
      });
    }
  },

  _showSettings() {
    // Zoom na hora só na Clareira (D_HUD = onde começa a interface); a tela de título não tem mundo
    // para aproximar
    const onZoom = this.D_HUD ? () => applyZoom(this, this.D_HUD) : undefined;
    openSettings(this, { onReset: () => this._confirmReset(), restartable: true, onZoom });
  },

  // Depois de trocar fonte/tamanho a cena recomeça; este gancho reabre as Opções.
  _maybeReopenSettings() {
    if (!this.registry.get("reopenSettings")) return;
    this.registry.set("reopenSettings", false);
    this.time.delayedCall(150, () => this._showSettings());
  },

  _confirmReset() {
    const m = new Modal(this, { title: tr("APAGAR TUDO?"), style: "danger", w: 560, h: 330 });
    m.add(text(this, 0, -30, tr("Moedas, bênçãos, armas, personagens,\nconquistas e recordes serão perdidos."), { size: 18, align: "center", origin: 0.5, color: CSS.txt }));
    m.add(
      new Button(this, -125, 90, 220, 54, tr("APAGAR"), () => {
        this.meta.reset();
        this.scene.restart();
      }, { style: "danger", color: CSS.redHi, size: 20 }),
    );
    m.add(new Button(this, 125, 90, 220, 54, tr("CANCELAR"), () => m.close(), { size: 20 }));
  },

  _showCredits() {
    const m = new Modal(this, { title: tr("CRÉDITOS"), w: 820, h: 620 });
    const list = this._modalList(m);
    const lines = [
      [tr("Design, código e arte procedural"), "Leonardo Lopes"],
      [tr("Arte"), tr("Heróis, criaturas, cenário, ícones e efeitos: arte própria, gerada por código")],
      [tr("Fontes"), tr("Jersey 15 — The Soft Type Project Authors · Atkinson Hyperlegible — Braille Institute of America · Fusion Pixel — TakWolf (todas OFL 1.1)")],
      [tr("Música e efeitos sonoros"), tr("Compostos e sintetizados por código para este jogo")],
      [tr("Motor"), tr("Phaser 4 (MIT) · nipplejs (MIT)")],
    ];
    // Avaliar quando quiser: abre a página do jogo na Google Play (só no app; o pedido automático é Review.js)
    if (Review.available())
      list.addRow(this._shopRow({ icon: "ico_star", name: tr("AVALIAR NO GOOGLE PLAY"), desc: tr("Sua nota ajuda o jogo a chegar a mais gente."), style: "gold", nameColor: CSS.goldHi, onTap: () => Review.openStore("credits") }));
    for (const [a, b] of lines) {
      list.addRow({
        h: 70,
        build: (c, w) => {
          const t1 = text(this, 0, 8, a, { size: 18, color: CSS.goldHi });
          const t2 = text(this, 0, 8 + t1.height + 2, b, { size: 15, color: CSS.muted, wrap: w - 10, shadow: false });
          c.add([t1, t2]);
          return Math.max(70, Math.ceil(t2.y + t2.height + 10));
        },
      });
    }
  },

  // Guardiões (na Clareira: pela Fogueira). Escolher troca na hora; os
  // bloqueados mostram o preço.
  _showCharacters() {
    const m = new Modal(this, { title: tr("FOGUEIRA"), subtitle: tr("Quem vai proteger a floresta hoje?"), w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showCharacters();
    };
    this._buildRow(list, "fire", reopen);
    this._section(list, tr("GUARDIÕES"));
    for (const c of CHARACTERS) {
      const owned = this.meta.hasCharacter(c.id);
      const sel = this.meta.selectedCharacter === c.id;
      const needLv = c.unlock?.fire ?? BUILD.FIRE_CHARACTER_LEVEL[c.id];
      // Guardião de FEITO (leva 3): Fogueira no nível + feito cumprido + moedas
      const deed = owned ? null : this.meta.characterDeed(c.id);
      const fireOk = !this.builds || this.builds.level("fire") >= (needLv ?? 1);
      const deedOpen = !!deed && !deed.done;
      // Sem Clareira (this.builds), mantém a compra antiga por moedas
      const can = !owned && this.meta.coins >= c.cost && (deed ? fireOk && !deedOpen : !this.builds);
      const buyable = !owned && deed && fireOk && !deedOpen;
      list.addRow(
        this._shopRow({
          h: 84,
          icon: `hero_${c.id}`,
          iconScale: 2.2,
          dim: !owned,
          name: `${c.name}  ·  ${c.title}`,
          nameColor: sel ? CSS.goldHi : CSS.txt,
          desc: tr("Começa com {0}. {1}", WEAPONS[c.weapon].name, c.perk) + (deed && fireOk ? tr("\nFeito: {0} ({1}/{2})", deed.text, fmt(deed.p), fmt(deed.n)) : ""),
          right: sel ? tr("ESCOLHIDO") : owned ? tr("ESCOLHER") : !fireOk ? tr("FOGUEIRA NV {0}", needLv) : deedOpen ? tr("FALTA O FEITO") : buyable || !this.builds ? String(c.cost) : tr("FOGUEIRA NV {0}", needLv),
          rightIcon: owned || !fireOk || deedOpen || (this.builds && !buyable) ? null : "ico_coin",
          rightColor: sel ? CSS.green : owned ? CSS.txt : can ? CSS.goldHi : CSS.dim,
          style: sel ? "green" : owned || can ? "button" : "dark",
          onTap:
            sel || (!owned && !can)
              ? null
              : () => {
                  if (!owned) {
                    if (!this.meta.unlockCharacter(c.id, c.cost)) return;
                    this._buyFx();
                  }
                  this.meta.setSelectedCharacter(c.id);
                  this._onCharacterChanged?.(c.id);
                  reopen();
                },
        }),
      );
    }
  },
};
