// Roteiro da partida: eventos com hora marcada que quebram a monotonia do
// spawn contínuo — enxames, cercos e mini-chefes (com baú dourado garantido).
// Cada evento é anunciado na faixa central do HUD.
import { GAME } from "../config.js";
import { CSS } from "../art/Palette.js";

// t = segundos de partida
const SCRIPT = [
  { t: 45, type: "swarm", n: 14, kind: "bee", msg: "ENXAME DE VESPAS!" },
  { t: 95, type: "miniboss", kind: "alpha", msg: "O LOBO ALFA CHEGOU!" },
  { t: 150, type: "ring", n: 20, kinds: ["wolf"], msg: "CERCO!" },
  { t: 205, type: "swarm", n: 22, kind: "bee", msg: "ENXAME DE VESPAS!" },
  { t: 255, type: "miniboss", kind: "elder", msg: "O OGRO ANCIÃO DESPERTA!" },
  { t: 300, type: "ring", n: 26, kinds: ["wolf", "goblin", "shroom"], msg: "CERCO!" },
  { t: 350, type: "swarm", n: 30, kind: "bee", msg: "A COLMEIA SE ENFURECE!" },
];

export class RunEvents {
  constructor(scene) {
    this.scene = scene;
    this.idx = 0;
  }

  update() {
    const s = this.scene;
    if (s.boss) return;
    const t = s.elapsedMs / 1000;
    while (this.idx < SCRIPT.length && t >= SCRIPT[this.idx].t) {
      this._run(SCRIPT[this.idx]);
      this.idx++;
    }
  }

  _wave() {
    return Math.floor(this.scene.elapsedMs / 30000);
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
    const p = s.player;
    s.hud.showBossBanner(ev.msg, ev.type === "miniboss" ? CSS.goldHi : CSS.redHi);
    s.sound.play("sfx_boss_roar", { volume: 0.4, rate: ev.type === "miniboss" ? 0.8 : 1.3 });
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
      const a = Math.random() * Math.PI * 2;
      const e = this._spawn(p.x + Math.cos(a) * R * 0.8, p.y + Math.sin(a) * R * 0.8, "wolf", ev.kind);
      if (e) {
        s.hud.setBossActive(e, e.miniBoss);
        cam.shake(350, 0.01);
      }
    }
  }
}
