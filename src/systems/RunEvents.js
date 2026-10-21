// Roteiro da partida: eventos com hora marcada que quebram a monotonia do
// spawn contínuo — enxames, cercos e mini-chefes (com baú dourado garantido).
// Cada evento é anunciado na faixa central do HUD.
import { GAME, ENDLESS } from "../config.js";
import { CSS } from "../art/Palette.js";
import { tr } from "../i18n/i18n.js";

// t = segundos de partida
const SCRIPT = [
  { t: 70, type: "swarm", n: 10, kind: "bee", msg: tr("ENXAME DE VESPAS!") },
  { t: 150, type: "miniboss", kind: "alpha", msg: tr("A MULA SEM CABEÇA GALOPA!") },
  { t: 170, type: "ring", n: 18, kinds: ["wolf"], msg: tr("CERCO!") },
  { t: 222, type: "swarm", n: 18, kind: "bee", msg: tr("ENXAME DE VESPAS!") },
  { t: 268, type: "miniboss", kind: "elder", msg: tr("O CORPO-SECO SE LEVANTA!") },
  { t: 318, type: "ring", n: 24, kinds: ["wolf", "goblin", "shroom"], msg: tr("CERCO!") },
  { t: 362, type: "swarm", n: 26, kind: "bee", msg: tr("A COLMEIA SE ENFURECE!") },
];

export class RunEvents {
  constructor(scene) {
    this.scene = scene;
    this.idx = 0;
  }

  update() {
    const s = this.scene;
    if (s.boss) return;
    const t = (s.elapsedMs * s.pace) / 1000; // roteiro no tempo virtual
    while (this.idx < SCRIPT.length && t >= SCRIPT[this.idx].t) {
      this._run(SCRIPT[this.idx]);
      this.idx++;
    }
    // Noite Eterna: o roteiro volta em ciclo, cada vez maior
    if (s.endless) {
      this._nextEndless ??= t + 20;
      if (t >= this._nextEndless) {
        this._nextEndless = t + ENDLESS.EVENT_EVERY_S;
        const k = (this._endlessCount = (this._endlessCount || 0) + 1);
        const cycle = [
          { type: "swarm", n: 24, kind: "bee", msg: tr("A COLMEIA DA NOITE!") },
          { type: "ring", n: 28, kinds: ["wolf", "goblin", "brute"], msg: tr("CERCO NA ESCURIDÃO!") },
          { type: "miniboss", kind: k % 2 ? "alpha" : "elder", again: true, msg: k % 2 ? tr("A MULA SEM CABEÇA VOLTOU!") : tr("OUTRO CORPO-SECO SE ERGUE!") },
        ];
        const ev = cycle[(k - 1) % cycle.length];
        this._run({ ...ev, n: ev.n ? Math.round(ev.n * (1 + 0.15 * Math.floor(k / 3))) : ev.n });
      }
    }
  }

  _wave() {
    return this.scene.waveIndex();
  }

  _spawn(x, y, kind, elite = false) {
    const pool = this.scene.enemyPool;
    // Eventos podem estourar um pouco o teto (são picos intencionais)
    if (pool.size >= GAME.MAX_ENEMIES_ALIVE + 30) return null;
    const e = pool.acquire();
    e.activate(x, y, kind, this._wave(), elite);
    return e;
  }

  _run(ev) {
    const s = this.scene;
    // Tamanho do evento acompanha o Perigo escolhido
    ev = { ...ev, n: Math.round((ev.n ?? 0) * (s.diff?.spawnMult ?? 1)) };
    const p = s.player;
    const mini = ev.type === "miniboss" ? s.biome?.minis?.[ev.kind] : null; // minichefe próprio do bioma
    s.hud.showBossBanner(mini ? (ev.again ? mini.again : mini.msg) : ev.msg, ev.type === "miniboss" ? CSS.goldHi : CSS.redHi);
    s.sound.play("sfx_boss_roar", { volume: 0.4, rate: ev.type === "miniboss" ? 0.8 : 1.3, alert: true });
    const cam = s.cameras.main;
    const R = Math.max(cam.width, cam.height) * 0.55;

    if (ev.type === "swarm") {
      // Enxame chega de UM lado (dá pra correr pro outro)
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < ev.n; i++) {
        const a = base + (Math.random() - 0.5) * 0.9;
        const d = R + Math.random() * 120;
        this._spawn(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, ev.kind);
      }
    } else if (ev.type === "ring") {
      // Cerco: anel completo fechando — o dash ou uma brecha salvam
      const r = Math.min(R, 520);
      for (let i = 0; i < ev.n; i++) {
        const a = (i / ev.n) * Math.PI * 2;
        const k = ev.kinds[i % ev.kinds.length];
        this._spawn(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, k);
      }
    } else if (ev.type === "miniboss") {
      const mini = s.biome?.minis?.[ev.kind];
      s.meta?.markLegend?.(mini?.legend ?? (ev.kind === "alpha" ? "mula" : "corposeco"));
      const a = Math.random() * Math.PI * 2;
      const e = this._spawn(p.x + Math.cos(a) * R * 0.8, p.y + Math.sin(a) * R * 0.8, "wolf", ev.kind);
      if (e) {
        s.hud.setBossActive(e, e.miniBoss);
        cam.shake(350, 0.01);
      }
    }
  }
}
