// Efeitos de cada peça de cosmético (catálogo em Cosmetics.js, texturas em art/CosmeticFX.js).
// Cada peça é uma fábrica (ctx) => { kill?(x, y, big), update?(time, hero), awaken?(x, y), look? }.
// ctx.host é o palco — a partida ou a prévia do Guarda-roupa —, então o MESMO código serve aos dois.
// Atrasos sempre por ctx.host.delay (a prévia cancela ao trocar de peça) e todo onComplete confere
// .active: a prévia destrói os objetos da peça antiga com tweens ainda rodando.
//
// Regras (docs/COSMETICOS.md, "Regras de legibilidade"):
//  · a libertação SOMA ao efeito do elemento e respeita o orçamento ctx.take() (matança em massa
//    nunca vira nuvem por cima das gemas e do baú);
//  · libertação colada no herói solta metade e para LONGE dele (o herói nunca some);
//  · o Despertar troca os tons (look) mas mantém a forma: a aura continua dizendo "desperto";
//  · emissores reaproveitados, pools fixos, teto de partículas vivas (celular fraco).
import { PAL } from "../art/Palette.js";
import { CHITA } from "../art/CosmeticFX.js";

const PX = 3; // = GAME.PIXEL_SCALE
const DEG = 180 / Math.PI;
const UP = -Math.PI / 2;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- ferramentas
function emitter(ctx, tex, cfg, layer = "air") {
  const e = ctx.scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
  ctx.host.put(e, layer);
  e._defSpeed = cfg.speed;
  return e;
}

// Partículas num cone (dir em radianos, spread em graus). Phaser 4: setEmitterAngle/setParticleSpeed
// ignoram faixas; recarregar o operador é o que muda cone e velocidade (igual ao WeaponFX.burst).
// tint = lista → uma a uma sorteando a cor (setParticleTint só aceita UMA cor)
function burst(ctx, e, x, y, n, dir = UP, spread = 120, speed = null, tint = null) {
  const count = Math.max(1, Math.round(n * ctx.q));
  const a = dir * DEG;
  e.ops.angle.loadConfig({ angle: { min: a - spread / 2, max: a + spread / 2 } });
  e.ops.speedX.loadConfig({ speed: speed ?? e._defSpeed }, "speed");
  e.ops.speedY.active = false;
  e.radial = true;
  if (Array.isArray(tint)) {
    for (let i = 0; i < count; i++) {
      e.setParticleTint(tint[(Math.random() * tint.length) | 0]);
      e.emitParticleAt(x, y, 1);
    }
    return;
  }
  if (tint != null) e.setParticleTint(tint);
  e.emitParticleAt(x, y, count);
}

// Pool fixo de imagens/sprites: devolve uma livre ou a mais velha (nada é criado por golpe)
function pool(ctx, tex, max, layer, sprite = false) {
  const list = [];
  return () => {
    let o = list.find((it) => !it.visible);
    if (!o) {
      if (list.length >= max) o = list.reduce((a, it) => (it._bornAt < a._bornAt ? it : a));
      else {
        o = (sprite ? ctx.scene.add.sprite(0, 0, tex) : ctx.scene.add.image(0, 0, tex)).setVisible(false);
        ctx.host.put(o, layer);
        list.push(o);
      }
    }
    ctx.scene.tweens.killTweensOf(o);
    o._bornAt = ctx.host.now;
    return o;
  };
}

// Pousar no chão: o que termina a queda fica um pouco no chão e desbota
function lander(ctx, tex, { max = 40, hold = [1600, 2600], sx = 0.8, sy = 0.55, alpha = 0.95 } = {}) {
  const get = pool(ctx, tex, max, "ground");
  return (x, y, angle, tint = null, frame = 0) => {
    if (!ctx.host.inView(x, y)) return;
    const o = get();
    o.setTexture(tex, frame).setPosition(x, y).setScale(PX * sx, PX * sy).setAngle(angle).setAlpha(alpha).setVisible(true);
    if (tint != null) o.setTint(tint);
    else o.clearTint();
    ctx.scene.tweens.add({ targets: o, alpha: 0, delay: rnd(hold[0], hold[1]), duration: 600, onComplete: () => o.active && o.setVisible(false) });
  };
}

// Colado no herói? → direção para longe dele (senão null)
function away(ctx, x, y, r = 80) {
  const h = ctx.host.hero();
  if (!h) return null;
  const dx = x - h.x,
    dy = y - h.y;
  return dx * dx + dy * dy < r * r ? Math.atan2(dy, dx) : null;
}

// Libertação padrão de uma peça: pede ao orçamento, joga para cima (ou para longe do herói)
function release(ctx, e, x, y, want, opts = {}) {
  const n = ctx.take(want);
  if (n <= 0) return 0;
  const off = away(ctx, x, y);
  if (off != null) burst(ctx, e, x, y - 6, Math.ceil(n / 2), off, 90, opts.awaySpeed ?? { min: 80, max: 150 }, opts.tint);
  else burst(ctx, e, x, y - 6, n, UP, opts.spread ?? 140, null, opts.tint);
  return n;
}

// Rastro: a cada `ms` uma partícula atrás dos pés; no início do dash, um punhado jogado para trás
function trail(ctx, e, ms, { dashN = 7, speed = { min: 10, max: 35 }, dashSpeed = { min: 60, max: 170 }, tint = null, lift = 0 } = {}) {
  let at = 0,
    wasDash = false;
  return (time, p) => {
    const feet = p.y + p.displayHeight * 0.4;
    const dashing = p.isDashing?.();
    if (dashing && !wasDash) burst(ctx, e, p.x, feet - 8, dashN, Math.atan2(-p.dashDirY, -p.dashDirX), 70, dashSpeed, tint);
    wasDash = dashing;
    const v = p.body?.velocity;
    if (!v || Math.hypot(v.x, v.y) < 40 || time < at) return;
    at = time + ms / Math.max(0.3, ctx.q);
    const back = Math.atan2(-v.y, -v.x);
    burst(ctx, e, p.x + Math.cos(back) * 6, feet - lift, 1, back - Math.PI / 4, 60, speed, tint);
  };
}

// Pétala/bandeirinha que "bate" ao cair: o lado visível encolhe e volta enquanto gira
const flutter = (s) => ({ onEmit: () => PX * s, onUpdate: (p, k, t) => PX * s * Math.abs(Math.cos(t * 9 + (p._ph ??= Math.random() * 6))) + 0.6 });
// Pena em pêndulo: balança de um lado para o outro enquanto desce
const pendulum = { onEmit: () => 0, onUpdate: (p, k, t) => (p._r0 ??= rnd(-30, 30)) + Math.sin(t * 10 + (p._ph ??= Math.random() * 6)) * 48 };
// Some só no fim da vida (fica inteira enquanto cai)
const lateFade = (from = 0.75) => ({ onEmit: () => 1, onUpdate: (p, k, t) => (t < from ? 1 : (1 - t) / (1 - from)) });

// Despertar: partículas que sobem de um anel em volta do herói e se afastam (nunca cobrem o herói)
function awakeRing(ctx, e, every, r = 44, tint = null) {
  let at = 0;
  return (time, p) => {
    if (!p.isAwakened?.() || time < at) return;
    at = time + every / Math.min(1, ctx.q);
    const a = (time / 300) % (Math.PI * 2);
    const out = Math.atan2(Math.sin(a) * 0.6 - 0.8, Math.cos(a));
    e.ops.angle.loadConfig({ angle: { min: out * DEG - 15, max: out * DEG + 15 } });
    if (tint) e.setParticleTint(tint[(Math.random() * tint.length) | 0]);
    e.emitParticleAt(p.x + Math.cos(a) * r, p.y + p.displayHeight * 0.4 - 6 + Math.sin(a) * 18, 1);
  };
}

// Objeto que acompanha o herói enquanto ele está desperto (asas, varal): aparece, segue e some
function awakeProp(ctx, tex, animKey, layer, place, size = 0.85) {
  const o = ctx.scene.add.sprite(0, 0, tex, 0).setVisible(false);
  ctx.host.put(o, layer);
  let on = false;
  return {
    show() {
      ctx.scene.tweens.killTweensOf(o);
      on = true;
      o.setVisible(true).setAlpha(1).setScale(0, PX * size);
      if (animKey) o.play(animKey);
      ctx.scene.tweens.add({ targets: o, scaleX: PX * size, duration: 320, ease: "Back.easeOut" });
    },
    update(time, p) {
      if (!on) return;
      place(o, p, time);
      if (layer === "back") ctx.host.behind(o, p);
      if (!p.isAwakened?.()) {
        on = false;
        ctx.scene.tweens.add({ targets: o, alpha: 0, scaleX: PX * 0.4, duration: 260, onComplete: () => o.active && o.setVisible(false).stop() });
      }
    },
  };
}

// Visual do Despertar (mesmo formato do AWAKEN_GOLD do Player): troca todos os tons do dourado
const look = (aura, tint, flash, ring, light, sparks) => ({ tint, aura: `fx_awaken_aura_${aura}`, flash, ring, light, sparks });

// ---------------------------------------------------------------- recursos dos kits
function ipePetals(ctx) {
  return ctx.shared("ipe", () => {
    const land = lander(ctx, "cos_petal", { max: 48 });
    const e = emitter(ctx, "cos_petal", {
      speed: { min: 50, max: 120 },
      gravityY: 55,
      lifespan: { min: 1300, max: 2000 },
      rotate: { min: 0, max: 360 },
      scaleY: PX * 0.8,
      scaleX: flutter(0.8),
      maxAliveParticles: 90,
      deathCallback: (p) => land(p.x, p.y, p.angle), // acabou a queda: pousa no chão
    });
    return { e };
  });
}
// Flor de ipê que brota onde a Podridão saiu: cresce com um pulo, brilha rosa fraco e murcha
function ipeBlooms(ctx) {
  return ctx.shared("ipe_bloom", () => {
    const get = pool(ctx, "cos_bloom", 20, "ground");
    return (x, y, size = 1, jitter = 0.3) => {
      const b = get();
      const s = PX * size * (1 - jitter / 2 + Math.random() * jitter);
      b.setPosition(x, y).setScale(0).setAlpha(1).setAngle(Math.random() * 72).setVisible(true);
      ctx.host.light(x, y, 70 * size, PAL.pink, 2200, 0.5); // a flor fica abaixo do mapa de luz: sem isto sumiria à noite
      ctx.scene.tweens.add({ targets: b, scale: s, angle: b.angle + 25, duration: 260, ease: "Back.easeOut" });
      ctx.scene.tweens.add({ targets: b, scale: s * 0.6, alpha: 0, delay: rnd(1500, 2000), duration: 500, ease: "Quad.easeIn", onComplete: () => b.active && b.setVisible(false) });
    };
  });
}
function painas(ctx) {
  return ctx.shared("paina", () =>
    emitter(ctx, "cos_paina", {
      speed: { min: 15, max: 45 },
      gravityY: -16, // sobe devagar, como paina de verdade
      accelerationX: { min: -14, max: 14 }, // o vento leva para um lado
      lifespan: { min: 2200, max: 3200 },
      rotate: { min: -25, max: 25 }, // o tufo fica de pé (a semente pende embaixo)
      scale: { onEmit: () => PX * 0.8, onUpdate: (p, k, t) => PX * 0.8 * (1 + 0.08 * Math.sin(t * 14 + (p._ph ??= Math.random() * 6))) },
      alpha: lateFade(0.7),
      maxAliveParticles: 70,
    }),
  );
}
function pods(ctx) {
  return ctx.shared("pod", () => {
    const get = pool(ctx, "cos_pod", 8, "ground", true);
    return (x, y, s = 1) => {
      const o = get();
      o.setPosition(x, y).setScale(PX * 0.6 * s).setAlpha(1).setAngle(rnd(-20, 20)).setVisible(true).play("cos_pod_open");
      ctx.scene.tweens.add({ targets: o, scale: PX * s, duration: 160, ease: "Back.easeOut" });
      ctx.scene.tweens.add({ targets: o, alpha: 0, delay: 650, duration: 400, onComplete: () => o.active && o.setVisible(false) });
    };
  });
}
function feathers(ctx) {
  return ctx.shared("feather", () => {
    const land = lander(ctx, "cos_feather", { max: 30, sx: 0.8, sy: 0.7 });
    return emitter(ctx, "cos_feather", {
      speed: { min: 30, max: 80 },
      gravityY: 38,
      lifespan: { min: 1500, max: 2200 },
      rotate: pendulum,
      scale: PX * 0.95,
      alpha: lateFade(0.8),
      maxAliveParticles: 60,
      deathCallback: (p) => land(p.x, p.y, p.angle),
    });
  });
}
// Corujinha que sai voando: sobe em diagonal para longe do herói, batendo as asas, e some no alto
function owls(ctx) {
  return ctx.shared("owl", () => {
    const get = pool(ctx, "cos_owl", 5, "air", true);
    return (x, y, dir) => {
      const o = get();
      const dist = rnd(140, 180);
      o.setPosition(x, y - 10).setScale(PX * 0.55).setAlpha(1).setAngle(0).setVisible(true).play("cos_owl_fly");
      ctx.scene.tweens.add({ targets: o, x: x + Math.cos(dir) * dist, y: y - 10 + Math.sin(dir) * dist, scale: PX * 0.95, duration: 1150, ease: "Sine.easeOut" });
      ctx.scene.tweens.add({ targets: o, alpha: 0, delay: 820, duration: 330, onComplete: () => o.active && o.setVisible(false).stop() });
    };
  });
}
function flags(ctx) {
  return ctx.shared("flag", () => {
    const land = lander(ctx, "cos_flag", { max: 40, sx: 0.9, sy: 0.7 });
    return emitter(ctx, "cos_flag", {
      frame: [0, 1],
      speed: { min: 50, max: 120 },
      gravityY: 45,
      lifespan: { min: 1400, max: 2000 },
      rotate: { min: -30, max: 30 },
      scaleY: PX,
      scaleX: flutter(1),
      maxAliveParticles: 80,
      deathCallback: (p) => land(p.x, p.y, p.angle, p.tint, p.frame?.name ?? 0),
    });
  });
}

// ---------------------------------------------------------------- as peças
export const PIECE_FX = {
  // ------------------------------------------------ grátis (simples)
  // Sementes: 3–4 sementinhas pulam e caem rápido (pesadas), ficam um instante no chão
  sementes(ctx) {
    const land = lander(ctx, "cos_seed", { max: 30, hold: [400, 800], sx: 1.3, sy: 1.3, alpha: 0.9 });
    const e = emitter(ctx, "cos_seed", {
      speed: { min: 90, max: 170 },
      gravityY: 430,
      lifespan: { min: 520, max: 760 },
      rotate: { min: 0, max: 360 },
      scale: PX * 1.3,
      maxAliveParticles: 60,
      deathCallback: (p) => land(p.x, p.y, p.angle),
    });
    return { kill: (x, y, big) => release(ctx, e, x, y, big ? 9 : 5, { spread: 110 }) };
  },
  // Pegadas: um pé de cada vez, virado para onde o herói anda; no dash há um vão (ele "voa")
  pegadas(ctx) {
    const get = pool(ctx, "cos_print", 26, "ground");
    let lx = null,
      ly = 0,
      acc = 0,
      side = 1;
    return {
      update(time, p) {
        if (lx == null) [lx, ly] = [p.x, p.y];
        const dx = p.x - lx,
          dy = p.y - ly;
        [lx, ly] = [p.x, p.y];
        if (p.isDashing?.()) return void (acc = 0);
        const d = Math.hypot(dx, dy);
        if (d < 0.01) return;
        acc += d;
        if (acc < 26) return;
        acc = 0;
        side = -side;
        const a = Math.atan2(dy, dx);
        const o = get();
        o.setPosition(p.x + Math.cos(a + Math.PI / 2) * 4 * side, p.y + p.displayHeight * 0.42 + Math.sin(a + Math.PI / 2) * 4 * side)
          .setAngle(a * DEG + 90)
          .setScale(PX * 0.8)
          .setAlpha(0.6)
          .setVisible(true);
        ctx.scene.tweens.add({ targets: o, alpha: 0, delay: 1400, duration: 900, onComplete: () => o.active && o.setVisible(false) });
      },
    };
  },
  // Folhas secas: uma folha desprende a cada passo e desce em pêndulo
  folhas(ctx) {
    const land = lander(ctx, "cos_dryleaf", { max: 30 });
    const e = emitter(ctx, "cos_dryleaf", {
      speed: { min: 10, max: 30 },
      gravityY: 50,
      lifespan: { min: 1200, max: 1700 },
      rotate: pendulum,
      scale: PX * 0.8,
      maxAliveParticles: 40,
      deathCallback: (p) => land(p.x, p.y, p.angle),
    });
    return { update: trail(ctx, e, 300, { dashN: 4 }) };
  },
  // Luar: só a troca de tons (aura prateada) — o simples
  luar: () => ({ look: look("luar", PAL.white, [205, 215, 235], [PAL.white, PAL.s4, PAL.s3, PAL.cream], PAL.s4, [PAL.white, PAL.s4, PAL.cream]) }),

  // ------------------------------------------------ Kit Ipê-rosa
  ipe_kill(ctx) {
    const { e } = ipePetals(ctx);
    const bloom = ipeBlooms(ctx);
    let bloomAt = -1e9;
    return {
      kill(x, y, big) {
        if (!release(ctx, e, x, y, big ? 14 : 7, { spread: big ? 200 : 140 })) return;
        if (ctx.host.now - bloomAt < 90) return; // no máximo uma flor nova a cada 90 ms
        bloomAt = ctx.host.now;
        bloom(x, y + 4, big ? 1.4 : 1);
      },
    };
  },
  ipe_trail(ctx) {
    return { update: trail(ctx, ipePetals(ctx).e, 170) };
  },
  ipe_awaken(ctx) {
    const { e } = ipePetals(ctx);
    const bloom = ipeBlooms(ctx);
    const rise = emitter(ctx, "cos_petal", {
      speed: { min: 70, max: 120 },
      gravityY: -30,
      lifespan: { min: 550, max: 800 },
      rotate: { min: 0, max: 360 },
      scale: { start: PX * 0.75, end: PX * 0.4 },
      alpha: { start: 1, end: 0 },
      maxAliveParticles: 24,
    });
    return {
      look: look("ipe", PAL.pinkHi, [255, 150, 200], [PAL.white, PAL.pinkHi, PAL.pink, PAL.cream], PAL.pink, [PAL.white, PAL.pinkHi, PAL.pink]),
      awaken(x, y) {
        burst(ctx, e, x, y - 10, 30, UP, 360, { min: 140, max: 320 });
        bloom(x, y + 2, 2.2, 0);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + Math.random() * 0.3; // uma onda de ipês saindo do herói
          ctx.host.delay(60 + i * 45, () => bloom(x + Math.cos(a) * 92, y + 2 + Math.sin(a) * 60, 1.1));
        }
      },
      update: awakeRing(ctx, rise, 140),
    };
  },

  // ------------------------------------------------ Kit Paineira
  paina_kill(ctx) {
    const e = painas(ctx);
    const pod = pods(ctx);
    let podAt = -1e9;
    return {
      kill(x, y, big) {
        const n = ctx.take(big ? 10 : 5);
        if (!n) return;
        const now = ctx.host.now;
        if (now - podAt >= 110) {
          podAt = now;
          pod(x, y, big ? 1.4 : 1);
        }
        // a paina sai do fruto um instante depois de ele estalar
        ctx.host.delay(110, () => {
          const off = away(ctx, x, y);
          burst(ctx, e, x, y - 4, off != null ? Math.ceil(n / 2) : n, off ?? UP, off != null ? 90 : 160, off != null ? { min: 40, max: 80 } : null);
        });
      },
    };
  },
  paina_trail(ctx) {
    return { update: trail(ctx, painas(ctx), 230, { dashN: 6, speed: { min: 8, max: 22 }, dashSpeed: { min: 40, max: 110 }, lift: 6 }) };
  },
  paina_awaken(ctx) {
    const e = painas(ctx);
    const pod = pods(ctx);
    const rise = emitter(ctx, "cos_paina", {
      speed: { min: 50, max: 90 },
      gravityY: -40,
      lifespan: { min: 900, max: 1300 },
      rotate: { min: -20, max: 20 },
      scale: { start: PX * 0.75, end: PX * 0.5 },
      alpha: { start: 1, end: 0 },
      maxAliveParticles: 20,
    });
    return {
      look: look("paina", PAL.cream, [250, 246, 236], [PAL.white, PAL.cream, PAL.s4, PAL.cream], PAL.cream, [PAL.white, PAL.cream]),
      awaken(x, y) {
        burst(ctx, e, x, y - 10, 26, UP, 360, { min: 50, max: 130 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4; // frutos estalando em roda
          ctx.host.delay(i * 70, () => pod(x + Math.cos(a) * 80, y + Math.sin(a) * 52, 1.2));
        }
      },
      update: awakeRing(ctx, rise, 170, 46),
    };
  },

  // ------------------------------------------------ Kit Coruja-buraqueira
  coruja_kill(ctx) {
    const e = feathers(ctx);
    const owl = owls(ctx);
    let owlAt = -1e9;
    return {
      kill(x, y, big) {
        const n = ctx.take(big ? 8 : 5);
        if (!n) return;
        const now = ctx.host.now;
        if (n >= 4 && now - owlAt >= 170) {
          owlAt = now;
          // sobe em diagonal, para longe do herói
          const off = away(ctx, x, y, 200);
          const dir = off != null ? Math.atan2(Math.min(-0.5, Math.sin(off)), Math.cos(off)) : UP + rnd(-0.9, 0.9);
          owl(x, y, dir);
        }
        const off = away(ctx, x, y);
        burst(ctx, e, x, y - 6, 2, off ?? UP, off != null ? 90 : 140);
      },
    };
  },
  coruja_trail(ctx) {
    return { update: trail(ctx, feathers(ctx), 290, { dashN: 5 }) };
  },
  coruja_awaken(ctx) {
    const e = feathers(ctx);
    const owl = owls(ctx);
    // asas NA FRENTE da aura e atrás do herói, maiores que a chama: abrem para fora dela
    const wings = awakeProp(ctx, "cos_wings", "cos_wings_beat", "back", (o, p, time) => {
      o.setPosition(p.x, p.y - p.displayHeight * 0.26 + Math.sin(time / 260) * 2).setFlipX(!!p.flipX);
    }, 1.15);
    return {
      look: look("coruja", PAL.straw3, [210, 170, 120], [PAL.cream, PAL.straw3, PAL.n4, PAL.n3], PAL.straw2, [PAL.cream, PAL.straw3, PAL.n4]),
      awaken(x, y) {
        wings.show();
        burst(ctx, e, x, y - 14, 18, UP, 360, { min: 60, max: 160 });
        owl(x - 10, y - 10, UP - 0.7);
        owl(x + 10, y - 10, UP + 0.7);
      },
      update: (time, p) => wings.update(time, p),
    };
  },

  // ------------------------------------------------ Kit Festa Junina
  junina_kill(ctx) {
    const e = flags(ctx);
    return { kill: (x, y, big) => release(ctx, e, x, y, big ? 12 : 6, { tint: CHITA }) };
  },
  junina_trail(ctx) {
    return { update: trail(ctx, flags(ctx), 250, { dashN: 6, tint: CHITA }) };
  },
  junina_awaken(ctx) {
    const e = flags(ctx);
    const varal = awakeProp(ctx, "cos_bunting", "cos_bunting_wave", "air", (o, p, time) => {
      o.setPosition(p.x, p.y - p.displayHeight * 0.86).setAngle(Math.sin(time / 380) * 5);
    }, 1);
    return {
      look: look("junina", PAL.cream, [255, 205, 170], [PAL.white, PAL.pinkHi, PAL.straw3, PAL.clay3], PAL.straw3, CHITA.slice(0, 4)),
      awaken(x, y) {
        varal.show();
        burst(ctx, e, x, y - 12, 26, UP, 140, { min: 120, max: 260 }, CHITA); // chuva de bandeirinhas
      },
      update: (time, p) => varal.update(time, p),
    };
  },
};
