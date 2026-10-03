// Redemoinhos de poeira — o perigo do terreno da Caatinga (BIOMES.caatinga.hazard).
// Andam devagar pelo mapa. No herói: só EMPURRAM em espiral (sem dano; andar sempre
// vence). Nos inimigos: deixam VENTADO — o fogo do herói vira Labareda, o gelo vira
// Geada, o raio vira Temporal. O sertão ajuda quem sabe usar o vento.
// Somem quando o chefe chega (a luta tem as regras dela).
import { GAME, DUST_DEVIL } from "../config.js";

const TAU = Math.PI * 2;
const S = GAME.PIXEL_SCALE;

export class DustDevils {
  constructor(scene) {
    this.s = scene;
    this.list = [];
    this.next = DUST_DEVIL.firstMs;
  }

  update(time, dt) {
    const s = this.s,
      K = DUST_DEVIL;
    if (s.boss?.active) {
      if (this.list.length) this.clear();
      return;
    }
    const tRun = Math.min(1, s.elapsedMs / (s.runDurationS * 1000));
    if (s.elapsedMs >= this.next && this.list.length < K.max) {
      this._spawn();
      this.next = s.elapsedMs + K.everyMs[0] + (K.everyMs[1] - K.everyMs[0]) * tRun;
    }
    const p = s.player;
    for (const d of this.list) {
      d.age += dt;
      // anda em linha com uma ondulação; dá meia-volta perto da borda
      d.a += Math.sin(d.age / 900 + d.seed) * 0.012;
      d.x += Math.cos(d.a) * K.speed * (dt / 1000);
      d.y += Math.sin(d.a) * K.speed * (dt / 1000);
      const life = Math.min(1, d.age / 700, (K.lifeMs - d.age) / 700);
      this._draw(d, time, Math.max(0, life));
      if (life <= 0.2) continue;
      // herói: espiral para fora (tangente + um pouco para longe)
      if (p?.active && !p.isDashing?.()) {
        const dx = p.x - d.x,
          dy = p.y - d.y,
          L = Math.hypot(dx, dy);
        if (L < K.r && L > 1) {
          const k = (1 - L / K.r) * K.push * life;
          p.addPull?.((-dy / L) * k + (dx / L) * k * 0.6, (dx / L) * k + (dy / L) * k * 0.6);
        }
      }
      // inimigos: ventados (uma vez por segundo cada)
      s.enemyPool.forEachActive((e) => {
        if (e.miniBoss || (e._dustAt ?? 0) > time) return;
        const dx = e.x - d.x,
          dy = e.y - d.y;
        if (dx * dx + dy * dy < K.r * K.r) {
          e._dustAt = time + 1000;
          s.elemental?.applyStatus(e, "wind");
        }
      });
    }
    const dead = this.list.filter((d) => d.age >= K.lifeMs);
    if (dead.length) {
      dead.forEach((d) => this._destroy(d));
      this.list = this.list.filter((d) => d.age < K.lifeMs);
    }
  }

  // Nasce na borda da tela e atravessa perto do herói (dá para ver chegando)
  _spawn() {
    const s = this.s,
      p = s.player,
      cam = s.cameras.main;
    const a = Math.random() * TAU;
    const R = Math.max(cam.width, cam.height) * 0.55;
    const x = p.x + Math.cos(a) * R,
      y = p.y + Math.sin(a) * R;
    const toward = Math.atan2(p.y - y, p.x - x) + (Math.random() - 0.5) * 0.7;
    const motes = [];
    for (let i = 0; i < 26; i++) {
      const im = s.add.image(x, y, i % 5 ? "px_puff" : "px_dot2").setTint([0xe8d0a0, 0xd0b07a, 0xb8966a][i % 3]).setAlpha(0);
      motes.push({ im, h: (i % 13) / 12, ph: Math.random() * TAU, skirt: i >= 20 });
    }
    const shadow = s.add.image(x, y, "px_shadow").setScale(5, S).setAlpha(0).setDepth(4);
    this.list.push({ x, y, a: toward, age: 0, seed: Math.random() * 10, motes, shadow });
    s.sound.play("sfx_whoosh", { volume: 0.25, rate: 0.6 });
  }

  // Coluna de poeira: anéis que giram e alargam para cima (funil)
  _draw(d, time, life) {
    const H = 120;
    d.shadow.setPosition(d.x, d.y + 4).setAlpha(0.45 * life);
    for (const m of d.motes) {
      const ang = time / (m.skirt ? 220 : 140) + m.ph + m.h * 4;
      // saia de poeira no chão (larga e baixa) + funil que alarga para cima
      const rad = m.skirt ? 40 + Math.sin(time / 300 + m.ph) * 6 : 8 + m.h * 36;
      const x = d.x + Math.cos(ang) * rad,
        y = (m.skirt ? d.y - 4 : d.y - m.h * H) + Math.sin(ang) * rad * (m.skirt ? 0.35 : 0.28);
      const front = Math.sin(ang) > 0;
      m.im
        .setPosition(x, y)
        .setScale(S * (m.skirt ? 1.1 : 0.8 + m.h * 0.9))
        .setAlpha((front ? 0.95 : 0.6) * life)
        .setDepth(front ? d.y + 10010 : d.y + 9990);
    }
  }

  _destroy(d) {
    d.motes.forEach((m) => m.im.destroy());
    d.shadow.destroy();
  }

  clear() {
    this.list.forEach((d) => this._destroy(d));
    this.list = [];
  }
}
