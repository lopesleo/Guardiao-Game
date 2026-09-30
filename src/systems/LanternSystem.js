// Lanternas de cogumelo: brotam pela mata perto do jogador (fora da tela),
// iluminam o caminho e, ao serem tocadas, quebram e derrubam um item:
//   fruta (cura) · Vácuo de Seiva (puxa todas as gemas) ·
//   Relógio da Mata (congela tudo) · Sopro Ancestral (limpa a tela).
// Dá motivo para andar pelo mapa e momentos de alívio no meio da horda.
import { LANTERN, GAME, ARENA } from "../config.js";
import { Analytics } from "./Analytics.js";

const S = GAME.PIXEL_SCALE;

const ITEMS = {
  fruit: { tex: "px_item_fruit", glow: 0xe8434f, name: "Caju" },
  vacuum: { tex: "px_item_vacuum", glow: 0x9ccf62, name: "Vácuo de Seiva" },
  clock: { tex: "px_item_clock", glow: 0x5cc8ff, name: "Relógio da Mata" },
  breath: { tex: "px_item_breath", glow: 0xffe58f, name: "Sopro Ancestral" },
};

function pickWeighted(table) {
  const total = table.reduce((s, d) => s + d.w, 0);
  let r = Math.random() * total;
  for (const d of table) if ((r -= d.w) <= 0) return d.id;
  return table[0].id;
}

export class LanternSystem {
  constructor(scene) {
    this.scene = scene;
    this.list = []; // lanternas vivas
    this.items = []; // itens no chão
    this._nextSpawn = LANTERN.FIRST_MS;
    this.timeStopUntil = 0;
    this._lastFreezeSweep = 0;
  }

  // Chamado pela GameScene a cada quadro (tempo de partida em ms)
  update(time, elapsedMs, player) {
    const s = this.scene;
    // Nascimento: 1 por vez, até o máximo
    if (elapsedMs >= this._nextSpawn) {
      this._nextSpawn = elapsedMs + LANTERN.SPAWN_MS;
      if (this.list.length < LANTERN.MAX) this._spawn(player);
    }
    // Lanternas: quebra ao toque; recicla as que ficaram muito para trás
    for (let i = this.list.length - 1; i >= 0; i--) {
      const l = this.list[i];
      const dx = player.x - l.x,
        dy = player.y - l.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < LANTERN.TOUCH_R * LANTERN.TOUCH_R) this._break(l, i);
      else if (d2 > LANTERN.DESPAWN_DIST * LANTERN.DESPAWN_DIST) {
        l.spr.destroy();
        this._killHalo(l);
        this.list.splice(i, 1);
      }
    }
    // Itens: pegos ao encostar (sem ímã — o jogador vai até eles)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.glow.setAlpha(0.35 + Math.sin(time / 200 + it.spr.x) * 0.15);
      const dx = player.x - it.spr.x,
        dy = player.y - it.spr.y;
      const r = Math.max(LANTERN.TOUCH_R, player.pickupRadius);
      if (time >= it.readyAt && dx * dx + dy * dy < r * r) {
        this._collect(it);
        this.items.splice(i, 1);
      } else if (time > it.expiresAt) {
        this._destroyItem(it);
        this.items.splice(i, 1);
      }
    }
    // Relógio da Mata: quem nascer durante o congelamento também para
    if (time < this.timeStopUntil && time - this._lastFreezeSweep > 250) {
      this._lastFreezeSweep = time;
      s.enemyPool.forEachActive((e) => {
        if (e.active && !e.isFrozen(time)) e.freeze(time, this.timeStopUntil - time, 0);
      });
    }
  }

  get timeStopped() {
    return this.scene.time.now < this.timeStopUntil;
  }

  _spawn(player) {
    const s = this.scene;
    const m = 60; // dentro da área jogável, fora da muralha de árvores
    for (let tries = 0; tries < 10; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const d = LANTERN.MIN_DIST + Math.random() * (LANTERN.MAX_DIST - LANTERN.MIN_DIST);
      const x = player.x + Math.cos(ang) * d,
        y = player.y + Math.sin(ang) * d;
      if (x < ARENA.minX + m || x > ARENA.maxX - m || y < ARENA.minY + m || y > ARENA.maxY - m) continue;
      if (this.list.some((l) => (l.x - x) ** 2 + (l.y - y) ** 2 < 300 * 300)) continue;
      const spr = s.add.sprite(x, y, "px_lantern", 0).setScale(S).setOrigin(0.5, 0.9);
      spr.setDepth(y + 10000);
      spr.play({ key: "lantern_glow", startFrame: Math.floor(Math.random() * 2) });
      // Halo aditivo nos chapéus: é o que faz a lanterna "chamar" de longe
      const halo = s.add
        .image(x, y - 12 * S, "fx_glow")
        .setScale(2.2)
        .setTint(0x5cc8ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(y + 10001)
        .setAlpha(0);
      s.tweens.add({ targets: halo, alpha: { from: 0.25, to: 0.55 }, scale: 2.6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      spr.setAlpha(0);
      s.tweens.add({ targets: spr, alpha: 1, duration: 600 });
      this.list.push({ x, y, spr, halo });
      return;
    }
  }

  _break(l, i) {
    const s = this.scene;
    this.list.splice(i, 1);
    this._killHalo(l);
    l.spr.stop();
    l.spr.setTexture("px_lantern_broken");
    s.tweens.add({ targets: l.spr, alpha: 0, delay: 2500, duration: 800, onComplete: () => l.spr.destroy() });
    // Estouro de esporos luminosos
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2;
      const p = s.add.image(l.x, l.y - 24, "px_dot2").setScale(3).setTint(0xbfeaff).setDepth(l.y + 10500);
      s.tweens.add({
        targets: p,
        x: l.x + Math.cos(a) * (30 + Math.random() * 30),
        y: l.y - 24 + Math.sin(a) * 30 - 20,
        alpha: 0,
        duration: 700,
        ease: "Cubic.easeOut",
        onComplete: () => p.destroy(),
      });
    }
    s.lighting?.flash(l.x, l.y - 20, 200, 0x5cc8ff, 400, 1);
    s.sound.play("sfx_chest_reel", { volume: 0.5, rate: 1.4 });
    this._dropItem(l.x, l.y, pickWeighted(LANTERN.DROPS));
    s._hint?.("lantern", "Lanternas de cogumelo guardam presentes da floresta.\nEncoste para quebrar!");
  }

  _killHalo(l) {
    if (!l.halo) return;
    this.scene.tweens.killTweensOf(l.halo);
    l.halo.destroy();
  }

  _dropItem(x, y, id) {
    const s = this.scene;
    const def = ITEMS[id];
    const glow = s.add.image(x, y, "fx_glow").setScale(0.7).setTint(def.glow).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    const spr = s.add.image(x, y, def.tex).setScale(S).setDepth(y + 9000);
    glow.setDepth(y + 8999);
    // Arremesso curto para o lado (o jogador VÊ o que ganhou antes de pegar)
    const ang = Math.random() * Math.PI * 2;
    const tx = x + Math.cos(ang) * 56,
      ty = y + Math.sin(ang) * 40;
    s.tweens.add({ targets: [spr, glow], x: tx, duration: 420, ease: "Linear" });
    s.tweens.add({ targets: [spr, glow], y: { from: y - 30, to: ty }, duration: 420, ease: "Bounce.easeOut" });
    s.tweens.add({ targets: spr, scale: S * 1.1, duration: 500, yoyo: true, repeat: -1, delay: 450, ease: "Sine.easeInOut" });
    this.items.push({ id, spr, glow, color: def.glow, readyAt: s.time.now + LANTERN.ITEM_READY_MS, expiresAt: s.time.now + LANTERN.ITEM_LIFETIME_MS });
  }

  _destroyItem(it) {
    this.scene.tweens.killTweensOf(it.spr);
    it.spr.destroy();
    it.glow.destroy();
  }

  _collect(it) {
    const s = this.scene;
    const p = s.player;
    const now = s.time.now;
    this._destroyItem(it);
    Analytics.track("lantern_item", { id: it.id, t: Math.floor(s.elapsedMs / 1000) });
    s._toast?.(ITEMS[it.id].name.toUpperCase() + "!", 1600, "#" + it.color.toString(16).padStart(6, "0"));
    if (it.id === "fruit") {
      const heal = Math.round(p.maxHp * LANTERN.FRUIT_HEAL_PCT);
      p.healHp(heal);
      s._showDmg?.(p.x, p.y - 10, heal, "heal");
      s.sound.play("sfx_pickup", { volume: 0.4, rate: 0.8 });
    } else if (it.id === "vacuum") {
      s.xpPool.forEachActive((g) => (g._pulled = true));
      s.sound.play("sfx_coin_cascade", { volume: 0.45, rate: 1.3 });
      s.lighting?.flash(p.x, p.y, 420, 0x9ccf62, 600, 1);
    } else if (it.id === "clock") {
      this.timeStopUntil = now + LANTERN.CLOCK_MS;
      this._lastFreezeSweep = 0;
      s.enemyPool.forEachActive((e) => e.active && e.freeze(now, LANTERN.CLOCK_MS, 0));
      s.cameras.main.flash(300, 150, 210, 255);
      s.sound.play("sfx_ice_attack", { volume: 0.7, rate: 0.6 });
    } else if (it.id === "breath") {
      const view = s.cameras.main.worldView;
      s.enemyPool.forEachActive((e) => {
        if (!e.active || !Phaser.Geom.Rectangle.Contains(view, e.x, e.y)) return;
        const tough = e.miniBoss || e._elite; // elites, mímicos e minichefes resistem
        const dmg = tough ? e.maxHp * LANTERN.BREATH_TOUGH_DMG_PCT : e.hp + 1;
        const died = e.takeDamage(dmg, null, p.x, p.y, true);
        if (died) s._onEnemyDeath(e);
      });
      s.cameras.main.flash(350, 255, 244, 200);
      s.cameras.main.shake(250, 0.01);
      s.sound.play("sfx_bolt_attack", { volume: 0.8, rate: 0.7 });
      s.lighting?.flash(p.x, p.y, 900, 0xfff0c0, 800, 1.4);
    }
  }

  // Luzes para o mapa de iluminação
  lights(add) {
    for (const l of this.list) add(l.x, l.y - 30, LANTERN.LIGHT_R, 0x5cc8ff, 0.8);
    for (const it of this.items) add(it.spr.x, it.spr.y, 90, it.color, 0.7);
  }
}
