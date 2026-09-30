// Painéis de meta-progressão (Bênçãos, Arsenal, Conquistas, Guia, Opções,
// Créditos, Personagens) compartilhados pela tela de título e pela Clareira.
// Uso: Object.assign(MinhaCena.prototype, MetaPanels). A cena precisa ter
// this.meta (MetaProgression), this.W/this.H, this._modals e this._refreshAll().
import { META, BLESSINGS, MAX_BLESSING_RANK, ACHIEVEMENTS, CHARACTERS, WEAPONS, BUILD, BUILDINGS, LEGENDS } from "../config.js";
import { fmtDuration } from "../systems/Builds.js";
import { AdService } from "../systems/AdService.js";
import { PAL, CSS, hex } from "../art/Palette.js";
import { WEAPON_ICON } from "../art/Icons.js";
import { WEAPON_DESC } from "../systems/UpgradeSystem.js";
import { text, drawFrame, Button, haptic } from "./Theme.js";
import { Modal, ScrollList } from "./Widgets.js";
import { openSettings } from "./SettingsModal.js";

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
      o = { icon: "ico_trophy", name: `${name} · NÍVEL ${lv} (MÁXIMO)`, desc: "Construção completa.", style: "green", nameColor: CSS.green };
    } else if (job && job.id === id) {
      const rem = b.remainingMs();
      const free = b.canFinishFree();
      o = {
        icon: "ico_hourglass",
        name: `EM OBRA → NÍVEL ${job.to}`,
        desc: `${b.nextPerk(id)} · ${free ? "pronta para concluir" : "cada partida adianta a obra"}`,
        right: free ? "CONCLUIR" : fmtDuration(rem),
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
      const time = step.min ? fmtDuration(step.min * 60000) : "na hora";
      const right = { busy: "JOÃO OCUPADO", coins: "FALTAM MOEDAS", wood: "FALTA MADEIRA" }[blk] ?? "CONSTRUIR";
      o = {
        icon: "ico_wood",
        name: `MELHORAR PARA O NÍVEL ${lv + 1}  ·  ${time}`,
        desc: `${b.nextPerk(id)} · ${step.coins} moedas + ${step.wood} madeira`,
        right,
        rightColor: blk ? CSS.dim : CSS.goldHi,
        nameColor: blk ? CSS.txt : CSS.goldHi,
        style: blk ? "dark" : "gold",
        onTap: blk
          ? null
          : () => {
              const r = b.start(id);
              if (!r) return;
              this._buyFx();
              if (r.done) this._onBuildDone?.(r);
              else this._onBuildStarted?.(r);
              reopen();
            },
      };
    }
    list.addRow(this._shopRow(o));
    // Anúncio opcional: adiantar a obra em andamento (desligado com ADS.ENABLED)
    if (job && job.id === id && !b.canFinishFree() && AdService.canShow("build_speed")) {
      list.addRow(
        this._shopRow({
          h: 56,
          icon: "ico_play",
          name: `ADIANTAR ${BUILD.AD_SPEEDUP_MIN} MIN`,
          desc: "Assista a um anúncio (opcional)",
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

  // Cabeçalho de seção dentro de uma lista
  _section(list, label, color = CSS.goldHi) {
    list.addRow({ h: 36, build: (c, w) => c.add(text(this, w / 2, 20, label, { size: 18, color, origin: 0.5 })) });
  },

  // Ninho do João-de-barro: todas as obras num lugar só
  _showWorks() {
    const m = new Modal(this, { title: "JOÃO-DE-BARRO", subtitle: "O construtor da Clareira · uma obra por vez", w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showWorks();
    };
    for (const id of this._workIds?.() ?? ["fire", "shrine", "forge"]) {
      this._section(list, `${BUILDINGS[id].name.toUpperCase()} · NÍVEL ${this.builds.level(id)}`);
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
    return list;
  },

  _shopRow(o) {
    const scene = this;
    return {
      h: o.h ?? 74,
      onTap: o.onTap,
      build(c, w) {
        const g = scene.add.graphics();
        const draw = (hover) => {
          g.clear();
          drawFrame(g, 0, 0, w, o.h ?? 74, hover && o.onTap ? { ...(o.styleObj ?? {}), border: PAL.uiGoldHi, body: PAL.uiPanel2, hi: 0x2b463a, lo: PAL.uiLine } : o.style ?? "dark", { noRivets: true });
        };
        draw(false);
        this.hover = draw;
        c.add(g);
        const hh = (o.h ?? 74) / 2;
        if (o.icon) c.add(scene.add.image(40, hh, o.icon, o.iconFrame ?? 0).setScale(o.iconScale ?? 3).setAlpha(o.dim ? 0.45 : 1));
        c.add(text(scene, 74, hh - 13, o.name, { size: 20, color: o.nameColor ?? CSS.txt, origin: [0, 0.5] }));
        c.add(text(scene, 74, hh + 13, o.desc, { size: 14, color: CSS.muted, origin: [0, 0.5], shadow: false, wrap: w - 300 }));
        if (o.pips != null) {
          for (let i = 0; i < o.pipsMax; i++)
            c.add(scene.add.rectangle(w - 250 + i * 18, hh, 12, 12, i < o.pips ? PAL.yel2 : PAL.inkSoft).setStrokeStyle(3, PAL.ink));
        }
        if (o.right) {
          const rc = scene.add.container(w - 20, hh);
          const rt = text(scene, 0, 0, o.right, { size: 20, color: o.rightColor ?? CSS.goldHi, origin: [1, 0.5], stroke: true });
          rc.add(rt);
          if (o.rightIcon) rc.add(scene.add.image(-rt.width - 18, 0, o.rightIcon).setScale(2.5));
          c.add(rc);
        }
      },
    };
  },

  _buyFx() {
    this.sound.play("sfx_coin_cascade", { volume: 0.5 });
    haptic(30);
  },

  _showBlessings() {
    const m = new Modal(this, { title: "SANTUÁRIO", subtitle: "Bênçãos e dons permanentes — valem para todos os guardiões", w: 860, h: 640 });
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
    section("DONS DA FLORESTA");
    const gifts = [
      { key: "DASH", name: "Dash", icon: "ico_dash", desc: "Esquiva rápida e invulnerável (SHIFT / botão)" },
      { key: "AWAKEN", name: "Despertar", icon: "ico_star", desc: "Modo fúria: armas disparam 2,5× mais rápido" },
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
          right: has ? "LIBERADO" : String(cost),
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
    section("BÊNÇÃOS");
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
          right: cost == null ? "MÁX" : capped ? `SANTUÁRIO NV ${rank + 1}` : String(cost),
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
        name: "Tesouro Ancestral",
        desc: `+2% de dano geral por nível · Nível ${this.meta.ancestralLevel} (sem limite)`,
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
    const m = new Modal(this, { title: "FORJA", subtitle: "Forje armas novas: elas passam a aparecer nas cartas de nível", w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showArsenal();
    };
    const elName = { fire: "Fogo", ice: "Gelo", bolt: "Raio" };
    this._buildRow(list, "forge", reopen);
    this._section(list, "ARMAS");
    const rows = [
      { kind: "weapon", key: "STAFF", cost: 0 },
      { kind: "weapon", key: "AURA", cost: 0 },
      ...META.WEAPON_UNLOCK_ORDER.map((k) => ({ kind: "weapon", key: k, cost: META.WEAPON_UNLOCK_COST[k] })),
    ];
    for (const r of rows) {
      const has = r.kind === "weapon" ? r.cost === 0 || this.meta.isUnlocked(r.key) : this.meta.hasAbility(r.key);
      const allowed = !this.builds || r.cost === 0 || this.builds.forgeAllows(r.key);
      const can = !has && allowed && this.meta.coins >= r.cost;
      const def = WEAPONS[r.key];
      list.addRow(
        this._shopRow({
          icon: r.icon ?? WEAPON_ICON[r.key],
          name: r.name ?? `${def.name}  ·  ${elName[def.element]}`,
          desc: r.desc ?? WEAPON_DESC[r.key],
          right: has ? "FORJADA" : allowed ? String(r.cost) : `FORJA NV ${BUILD.FORGE_WEAPON_LEVEL[r.key]}`,
          rightIcon: has || !allowed ? null : "ico_coin",
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
      build: (c, w) => c.add(text(this, w / 2, 24, "RECEITAS DE EVOLUÇÃO", { size: 18, color: hex(PAL.pur3), origin: 0.5 })),
    });
    for (const [k, d] of Object.entries(WEAPONS)) {
      if (!d.evolvesFrom) continue;
      list.addRow(
        this._shopRow({
          h: 62,
          icon: WEAPON_ICON[k],
          name: d.name,
          desc: `${WEAPONS[d.evolvesFrom].name} nível 5 + ${WEAPONS[d.partner].name}`,
          style: "purple",
        }),
      );
    }
  },

  // Mural: abas Conquistas | Lendas (bestiário)
  _showBoard(tab = "conquistas") {
    const done = this.meta.data.achievements;
    const seen = LEGENDS.filter((l) => this._legendSeen(l)).length;
    const m = new Modal(this, {
      title: "MURAL",
      subtitle: tab === "lendas" ? `Lendas da mata encontradas: ${seen} de ${LEGENDS.length}` : `Conquistas: ${done.length} de ${ACHIEVEMENTS.length}`,
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
    tabBtn(-128, "conquistas", "CONQUISTAS");
    tabBtn(128, "lendas", "LENDAS");
    const list = this._modalList(m, m.top + 58);
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
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, 118, ok ? "gold" : "dark", { noRivets: true });
          c.add(g);
          const [tex, frame, sc] = l.sprite;
          const img = this.add.image(58, 62, tex, frame).setScale(sc);
          if (!ok) img.setTintFill(0x1a1420).setAlpha(0.6);
          c.add(img);
          c.add(text(this, 120, 22, ok ? l.name : "???", { size: 21, color: ok ? CSS.goldHi : CSS.dim, origin: [0, 0.5] }));
          c.add(text(this, 120, 44, ok ? l.role : "Encontre na floresta para conhecer esta lenda.", { size: 14, color: ok ? CSS.green : CSS.dim, origin: [0, 0.5] }));
          if (ok) c.add(text(this, 120, 62, l.origin, { size: 14, color: CSS.muted, origin: [0, 0], wrap: w - 140, shadow: false }));
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
    const m = new Modal(this, { title: "GUIA DA FLORESTA", w: 880, h: 640 });
    const list = this._modalList(m);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const sections = [
      ["ico_dash", "Movimento", touch ? "Arraste o polegar na metade esquerda da tela para andar. O ataque é automático." : "WASD ou setas para andar. O ataque é automático — posicione-se."],
      ["ico_gem", "Nível", "Colete gemas verdes para subir de nível e escolher 1 de 3 cartas: novas armas, melhorias ou passivas."],
      ["ico_staff", "Elementos", "Cada arma aplica um elemento: Fogo, Gelo ou Raio. Dois elementos no mesmo inimigo disparam uma REAÇÃO."],
      ["ico_cloud", "Vapor (Fogo + Gelo)", "Nuvem escaldante que causa dano contínuo na área."],
      ["ico_aura", "Cristal (Congelado + Raio)", "O inimigo congelado estilhaça e fere quem está perto."],
      ["ico_bolt_gold", "Sobrecarga (Fogo + Raio)", "Corrente elétrica que salta entre vários inimigos."],
      ["ico_star", "Despertar", "Reações enchem a barra dourada. Ative para disparar tudo muito mais rápido por alguns segundos."],
      ["ico_chest", "Baús", "Encoste num baú para abri-lo: tesouro, jackpot dourado… ou uma armadilha (e o temido mímico)."],
      ["ico_heart_ice", "Evoluções", "Arma no nível 5 + a arma parceira na mesma partida = carta de EVOLUÇÃO garantida. Veja as receitas na Forja da Clareira."],
      ["ico_skull", "O Mapinguari", "Aos 7:00 o gigante da mata desperta, tomado pela Podridão. Vença-o para libertá-lo e liberar o próximo Perigo."],
      ["ico_coin", "A Clareira", "Entre partidas: Santuário (bênçãos e dons), Forja (armas), Fogueira (guardiões), Mural (conquistas). A trilha ao norte leva à floresta."],
    ];
    if ((this.meta.data.revealed || []).includes("garden"))
      sections.push(["ico_sprout", "Horta", "Plante na Clareira: as plantas crescem em tempo real, mesmo com o jogo fechado. Regue, arranque o mato e tire as lagartas para colher com qualidade Ouro — nada morre, só perde qualidade. Sementes raras caem dos minichefes, do baú dourado e do Mapinguari."]);
    for (const [icon, name, desc] of sections) {
      list.addRow({
        h: 84,
        build: (c, w) => {
          const g = this.add.graphics();
          drawFrame(g, 0, 0, w, 84, "dark", { noRivets: true });
          c.add(g);
          c.add(this.add.image(40, 42, icon).setScale(3));
          c.add(text(this, 80, 20, name, { size: 20, color: CSS.goldHi, origin: [0, 0.5] }));
          c.add(text(this, 80, 38, desc, { size: 15, color: CSS.muted, origin: [0, 0], wrap: w - 100, shadow: false }));
        },
      });
    }
  },

  _showSettings() {
    openSettings(this, { onReset: () => this._confirmReset() });
  },

  _confirmReset() {
    const m = new Modal(this, { title: "APAGAR TUDO?", style: "danger", w: 560, h: 330 });
    m.add(text(this, 0, -30, "Moedas, bênçãos, armas, personagens,\nconquistas e recordes serão perdidos.", { size: 18, align: "center", origin: 0.5, color: CSS.txt }));
    m.add(
      new Button(this, -125, 90, 220, 54, "APAGAR", () => {
        this.meta.reset();
        this.scene.restart();
      }, { style: "danger", color: CSS.redHi, size: 20 }),
    );
    m.add(new Button(this, 125, 90, 220, 54, "CANCELAR", () => m.close(), { size: 20 }));
  },

  _showCredits() {
    const m = new Modal(this, { title: "CRÉDITOS", w: 820, h: 620 });
    const list = this._modalList(m);
    const lines = [
      ["Design, código e arte procedural", "Leonardo Lopes"],
      ["Arte", "Heróis, criaturas, cenário, ícones e efeitos: arte própria, gerada por código"],
      ["Fonte", "Jersey 15 — The Soft Type Project Authors (OFL 1.1)"],
      ["Música e efeitos sonoros", "Compostos e sintetizados por código para este jogo"],
      ["Motor", "Phaser 3 (MIT) · nipplejs (MIT)"],
    ];
    for (const [a, b] of lines) {
      list.addRow({
        h: 70,
        build: (c, w) => {
          c.add(text(this, 0, 12, a, { size: 18, color: CSS.goldHi }));
          c.add(text(this, 0, 38, b, { size: 15, color: CSS.muted, wrap: w - 10, shadow: false }));
        },
      });
    }
  },

  // Guardiões (na Clareira: pela Fogueira). Escolher troca na hora; os
  // bloqueados mostram o preço.
  _showCharacters() {
    const m = new Modal(this, { title: "FOGUEIRA", subtitle: "Quem vai proteger a floresta hoje?", w: 860, h: 640 });
    const list = this._modalList(m);
    const reopen = () => {
      m.close();
      this._refreshAll();
      this._showCharacters();
    };
    this._buildRow(list, "fire", reopen);
    this._section(list, "GUARDIÕES");
    for (const c of CHARACTERS) {
      const owned = this.meta.hasCharacter(c.id);
      const sel = this.meta.selectedCharacter === c.id;
      const needLv = BUILD.FIRE_CHARACTER_LEVEL[c.id];
      // Sem Clareira (this.builds), mantém a compra antiga por moedas
      const can = !owned && !this.builds && this.meta.coins >= c.cost;
      list.addRow(
        this._shopRow({
          h: 84,
          icon: `hero_${c.id}`,
          iconScale: 2.2,
          dim: !owned,
          name: `${c.name}  ·  ${c.title}`,
          nameColor: sel ? CSS.goldHi : CSS.txt,
          desc: `Começa com ${WEAPONS[c.weapon].name}. ${c.perk}`,
          right: sel ? "ESCOLHIDO" : owned ? "ESCOLHER" : this.builds ? `FOGUEIRA NV ${needLv}` : String(c.cost),
          rightIcon: owned || this.builds ? null : "ico_coin",
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
