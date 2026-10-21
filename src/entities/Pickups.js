// Pickups em pixel-art: gema de XP, moeda, coração e orbe de Despertar.
// Nascem com um "pulinho" (arco) e são puxados por ímã ao chegar perto.
// Sem corpo Arcade: a coleta é por distância (GameScene) e o corpo só servia para andar com a
// velocidade do ímã. Na horda eram centenas de corpos no mundo da física (pré/pós-passo de cada um
// a cada quadro). O passo agora é move(), chamado pela cena depois do update (POST_UPDATE, onde a
// física aplicava o passo) com a velocidade do quadro anterior e o timeScale da física (o hit-stop e
// a câmera lenta da morte seguram as gemas como antes): mesmo voo, mesmos quadros de coleta.
import { ENEMY, GAME } from "../config.js";

const S = GAME.PIXEL_SCALE;

class Pickup extends Phaser.GameObjects.Sprite {
  constructor(scene, texture, o = {}) {
    super(scene, -9999, -9999, texture, 0);
    scene.add.existing(this);
    this.setScale(S);
    this.vx = 0; // velocidade do ímã (px/s)
    this.vy = 0;
    this._mvx = 0; // a que vale no passo deste quadro (a do quadro anterior, como no Arcade)
    this._mvy = 0;
    this.magnetSpeed = o.magnet ?? 340;
    this.magnetMult = o.magnetMult ?? 4;
    this.anim = o.anim ?? null;
    this.glowTint = o.glow ?? null;
    if (this.glowTint != null) {
      this.glow = scene.add
        .image(0, 0, "fx_glow")
        .setScale(o.glowScale ?? 0.55)
        .setTint(this.glowTint)
        .setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
    }
    this.setActive(false).setVisible(false);
    this._hop = null;
  }

  spawn(x, y) {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.vx = this.vy = this._mvx = this._mvy = 0;
    this.setDepth(y + 9000);
    this._pulled = false;
    if (this.anim) {
      // Quadro inicial aleatório (dessincroniza o brilho), limitado ao tamanho
      // da animação — orbe tem só 2 quadros; quadro inexistente quebrava o loop.
      const n = this.scene.anims.get(this.anim)?.frames.length ?? 1;
      this.play({ key: this.anim, startFrame: Math.floor(Math.random() * n) });
    }
    this.glow?.setVisible(true);
    // Pulinho de saída: arco rápido pra cima e quique
    this._hop?.stop();
    this._baseY = y;
    this.y = y;
    this._hop = this.scene.tweens.add({
      targets: this,
      y: { from: y, to: y - 14 },
      duration: 140,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  pickup() {
    this._hop?.stop();
    this.stop();
    this.setActive(false).setVisible(false);
    this.vx = this.vy = this._mvx = this._mvy = 0;
    this.glow?.setVisible(false);
  }

  update(time, dt, player) {
    if (!this.active) return;
    this._mvx = this.vx; // o passo deste quadro usa a velocidade do anterior (move)
    this._mvy = this.vy;
    if (this.glow) {
      this.glow.setPosition(this.x, this.y);
      this.glow.setAlpha(0.35 + Math.sin(time / 220 + this.x) * 0.15);
    }
    if (!player?.active) return;
    const dx = player.x - this.x,
      dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    const reach = player.pickupRadius * this.magnetMult;
    // Uma vez puxado, não solta mais (evita gema "orbitando" no limite)
    if (this._pulled || d < reach) {
      this._pulled = true;
      this._hop?.stop();
      const sp = this.magnetSpeed + Math.max(0, 260 - d) * 1.5;
      this.vx = (dx / (d || 1)) * sp;
      this.vy = (dy / (d || 1)) * sp;
    } else this.vx = this.vy = 0;
  }

  // Passo do movimento (a cena chama depois do update de tudo, onde a física aplicava o dela)
  move(dt) {
    if (!this._mvx && !this._mvy) return;
    const k = dt / 1000 / (this.scene.physics.world.timeScale || 1);
    this.x += this._mvx * k;
    this.y += this._mvy * k;
  }
}

// tier: 0 verde (normal), 1 azul (×5), 2 dourada (×20) — usado por baús e pela fusão de gemas
const GEM_TIERS = [
  ["px_gem", "gem_shine", 1],
  ["px_gem_blue", "gem_blue_shine", 5],
  ["px_gem_gold", "gem_gold_shine", 20],
];

export class XPGem extends Pickup {
  constructor(scene) {
    super(scene, "px_gem", { anim: "gem_shine", magnet: 360 });
    this.xpValue = ENEMY.XP_VALUE;
  }
  spawn(x, y, tier = 0) {
    const T = GEM_TIERS[tier] ?? GEM_TIERS[0];
    this.setTexture(T[0]);
    this.anim = T[1];
    this.xpValue = ENEMY.XP_VALUE * T[2];
    super.spawn(x, y);
  }
  // Fusão (teto de gemas no chão, PERF.GEM_CAP): esta gema fica com o XP da outra, somado, e vai
  // para o centro de massa do XP das duas (o XP não "anda" para perto do herói). A cor acompanha
  // o valor, na escala das gemas de baú (azul a partir de ×5, dourada de ×20).
  absorb(other) {
    const total = this.xpValue + other.xpValue;
    const k = other.xpValue / total;
    this.setPosition(this.x + (other.x - this.x) * k, this.y + (other.y - this.y) * k);
    this.xpValue = total;
    const mult = this.xpValue / ENEMY.XP_VALUE;
    const T = GEM_TIERS[mult >= 20 ? 2 : mult >= 5 ? 1 : 0];
    if (this.anim !== T[1]) {
      this.setTexture(T[0]);
      this.anim = T[1];
      this.play({ key: T[1], startFrame: Math.floor(Math.random() * (this.scene.anims.get(T[1])?.frames.length ?? 1)) });
    }
  }
}

export class CoinPickup extends Pickup {
  constructor(scene) {
    super(scene, "px_coin", { anim: "coin_spin", magnet: 320, magnetMult: 5, glow: 0xf2c14e, glowScale: 0.45 });
  }
}

export class HeartPickup extends Pickup {
  constructor(scene) {
    super(scene, "px_heart", { magnet: 300, glow: 0xe8434f, glowScale: 0.55 });
  }
  update(time, dt, player) {
    if (this.active) this.setScale(S * (1 + Math.sin(time / 160) * 0.08));
    super.update(time, dt, player);
  }
}

// Madeira Ancestral: material das obras da Clareira (rara; ímã forte)
export class WoodPickup extends Pickup {
  constructor(scene) {
    super(scene, "px_wood", { magnet: 340, magnetMult: 5, glow: 0xffc86b, glowScale: 0.7 });
  }
}

// Semente rara (planta mágica da Horta): cai só depois que a Horta apareceu
export class SeedPickup extends Pickup {
  constructor(scene) {
    super(scene, "ico_seed", { magnet: 340, magnetMult: 5, glow: 0xffe58f, glowScale: 0.7 });
  }
}

export class AwakenOrb extends Pickup {
  constructor(scene) {
    super(scene, "px_awaken", { anim: "awaken_spark", magnet: 320, glow: 0xffe58f, glowScale: 0.7 });
  }
}
