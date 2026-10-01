// ★ DIFERENCIAL ★ — Status elementais e reações automáticas.
// 3 status: fire, ice, bolt. Quando 2+ coexistem no mesmo inimigo, dispara reação.
import { STATUS, REACTION, COLORS, PLAYER, ELEMENT } from "../config.js";
import { text } from "../ui/Theme.js";
import { hex } from "../art/Palette.js";

// Reações por COEXISTÊNCIA de status. (gelo+bolt NÃO está aqui: CRISTAL agora é
// "inimigo CONGELADO leva raio → estilhaça", tratado em applyStatus.)
const REACTION_MAP = {
  "fire+ice": "VAPOR",
  "ice+fire": "VAPOR",
  "fire+bolt": "OVERLOAD",
  "bolt+fire": "OVERLOAD",
};

export class ElementalSystem {
  constructor(scene) {
    this.scene = scene;
    this.lastTickAt = 0;
    this.tickInterval = 100;
    // Cooldown global por tipo de reação (evita spam visual quando muitas armas)
    this.lastReactionAt = { VAPOR: 0, CRYSTAL: 0, OVERLOAD: 0 };
    this.reactionCdMs = 350; // 1 reação do mesmo tipo a cada 350ms
  }

  // Chamado quando uma arma atinge um inimigo.
  applyStatus(enemy, element) {
    if (!element || !enemy?.active) return;
    const now = this.scene.time.now;
    const def = STATUS[element.toUpperCase()];
    if (!def) return;

    enemy.statuses[element] = {
      until: now + def.duration,
      def,
      lastTickAt: now,
    };

    // Tinta visual baseada no status dominante
    this._updateTint(enemy);

    // CRISTAL: raio (bolt) num inimigo CONGELADO → estilhaça (quebra + lascas curtas)
    if (element === ELEMENT.BOLT && enemy.isFrozen?.(now)) {
      this._shatter(enemy, REACTION.CRYSTAL);
      return;
    }

    // Checa reação por coexistência de status (Vapor / Sobrecarga)
    this._checkReaction(enemy);
  }

  _updateTint(enemy) {
    if (enemy.statuses.fire) enemy.setTint(0xff9966);
    else if (enemy.statuses.ice) enemy.setTint(0x9ad4ff);
    else if (enemy.statuses.bolt) enemy.setTint(0xd8a8ff);
    else enemy.clearTint();
  }

  _checkReaction(enemy) {
    const keys = Object.keys(enemy.statuses);
    if (keys.length < 2) return;

    // Procura QUALQUER par mapeado — não só os 2 primeiros. Com fogo+gelo+raio
    // juntos, pegar [a,b] = keys podia ler um par não-mapeado (ex.: ice+bolt) e
    // engolir silenciosamente uma reação válida (fire+ice / fire+bolt).
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const reactionKey = REACTION_MAP[`${keys[i]}+${keys[j]}`];
        if (!reactionKey) continue;

        // Consome os status do par (evita disparo contínuo)
        delete enemy.statuses[keys[i]];
        delete enemy.statuses[keys[j]];
        this._updateTint(enemy);
        this._trigger(enemy, reactionKey);
        return;
      }
    }
  }

  _trigger(enemy, reactionKey) {
    const def = REACTION[reactionKey];
    const scene = this.scene;

    // Conquistas (Fase 3): conta TODA reação mecânica, mesmo com visual em CD
    scene.meta?.recordReaction(reactionKey);
    scene._checkAchievements?.();

    // Anti-spam: cooldown por TIPO de reação (não mostra texto se foi disparado <350ms atrás)
    const now = scene.time.now;
    const onCd = now - this.lastReactionAt[reactionKey] < this.reactionCdMs;
    this.lastReactionAt[reactionKey] = now;

    // Aplica efeito mecânico SEMPRE (dano continua), mas suprime visual se em CD
    if (onCd) {
      // Aplica só o efeito mecânico, sem texto/shake/SFX
      const areaMult = scene.player?.areaMult ?? 1;
      if (reactionKey === "VAPOR") this._vapor(enemy, def, areaMult);
      else if (reactionKey === "OVERLOAD") this._overload(enemy, def, areaMult);
      return;
    }

    scene.lighting?.flash(enemy.x, enemy.y, 280, def.color, 450, 1);
    // Texto flutuante BIG (D21)
    this._label(enemy.x, enemy.y, def.label, def.color);
    scene._hint?.("reaction", "REAÇÃO! Dois elementos no mesmo inimigo\ncausam efeitos extras. Combine armas!");

    // Screenshake leve
    scene.cameras.main.shake(120, 0.005);

    // Alimenta o medidor de Despertar
    scene.player?.addAwakenMeter(PLAYER.AWAKEN_GAIN_REACTION);

    // Área é amplificada pelo modificador de área do player (passiva)
    const areaMult = this.scene.player?.areaMult ?? 1;
    // SFX distintos por reação (re-uso impacts existentes com pitch diferente)
    if (reactionKey === "VAPOR") {
      scene.sound.play("sfx_react_vapor", { volume: 0.5 }); // sibilo de vapor
      this._vapor(enemy, def, areaMult);
    } else if (reactionKey === "OVERLOAD") {
      scene.sound.play("sfx_react_overload", { volume: 0.55 }); // crepitar elétrico
      this._overload(enemy, def, areaMult);
    }
  }

  // VAPOR = nuvem ESCALDANTE: dano contínuo (DoT) na área. Não causa mais slow.
  _vapor(enemy, def, areaMult = 1) {
    const scene = this.scene;
    const cx = enemy.x,
      cy = enemy.y;
    const radius = def.radius * areaMult;
    const radiusSq = radius * radius;
    this._cloudFx(cx, cy, radius, def.color, def.duration);

    const tickDmg = def.dmgPerTick * (scene.player?.prism ?? 1);
    const applyDmg = () => {
      if (!scene.enemyPool) return;
      scene.enemyPool.forEachActive((e) => {
        const dx = e.x - cx,
          dy = e.y - cy;
        if (dx * dx + dy * dy <= radiusSq) {
          const died = e.takeDamage(tickDmg, null);
          if (died) scene._onEnemyDeath(e);
        }
      });
      if (scene.boss?.active) {
        const dx = scene.boss.x - cx,
          dy = scene.boss.y - cy;
        if (dx * dx + dy * dy <= radiusSq) {
          const died = scene.boss.takeDamage(tickDmg);
          if (died) scene._onBossDeath();
        }
      }
    };
    applyDmg();
    scene.time.addEvent({
      delay: def.tickMs,
      repeat: Math.floor(def.duration / def.tickMs),
      callback: applyDmg,
    });
  }

  // Nuvem em pixel-art: vários "puffs" que incham, sobem e somem + luz quente
  _cloudFx(cx, cy, radius, color, duration) {
    const scene = this.scene;
    const glow = scene.add
      .image(cx, cy, "fx_glow")
      .setScale((radius * 2.4) / 64)
      .setTint(color)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(50);
    scene.tweens.add({ targets: glow, alpha: 0, duration, onComplete: () => glow.destroy() });
    const n = Math.min(9, 4 + Math.round(radius / 20));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius * 0.7;
      const px = cx + Math.cos(a) * d,
        py = cy + Math.sin(a) * d;
      const s0 = (radius / 7) * (0.35 + Math.random() * 0.3);
      const puff = scene.add
        .image(px, py, "px_puff")
        .setScale(s0 * 0.5)
        .setTint(i % 2 ? 0xffffff : color)
        .setAlpha(0.55)
        .setDepth(py + 10002);
      scene.tweens.add({
        targets: puff,
        scale: s0,
        y: py - 18 - Math.random() * 16,
        alpha: 0,
        delay: Math.random() * 180,
        duration: duration * (0.6 + Math.random() * 0.4),
        ease: "Sine.easeOut",
        onComplete: () => puff.destroy(),
      });
    }
  }

  // Rótulo de reação ("VAPOR!") — pixel font, cor da reação, "pop" de escala
  _label(x, y, str, color) {
    const scene = this.scene;
    const t = text(scene, x, y - 26, str, {
      size: 22,
      color: hex(color),
      origin: 0.5,
      stroke: true,
      strokeW: 5,
    }).setDepth(60000);
    t.setScale(0.4);
    scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.easeOut" });
    scene.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 350, duration: 600, onComplete: () => t.destroy() });
  }

  // CRISTAL = o inimigo CONGELADO leva raio e ESTILHAÇA: lascas curtas em todas as
  // direções, DANO BAIXO. É recompensa de combo (Aura congela → Raio quebra), não dano bruto.
  _shatter(target, def) {
    const scene = this.scene;
    const now = scene.time.now;
    // Conquistas (Fase 3): Cristal não passa por _trigger, conta aqui
    scene.meta?.recordReaction("CRYSTAL");
    scene._checkAchievements?.();
    // Anti-spam por TIPO
    if (now - this.lastReactionAt.CRYSTAL < this.reactionCdMs) {
      // ainda aplica mecânica, sem texto/shake
      this._shatterMechanic(target, def, false);
      return;
    }
    this.lastReactionAt.CRYSTAL = now;
    this._shatterMechanic(target, def, true);
  }

  _shatterMechanic(target, def, showFx) {
    const scene = this.scene;
    const cx = target.x, cy = target.y;
    const areaMult = scene.player?.areaMult ?? 1;
    const radius = def.radius * areaMult;
    const radiusSq = radius * radius;

    // O alvo "quebra": leva um golpe de estilhaçamento (e perde o congelamento)
    target._frozenUntil = 0;
    target._freezeLockUntil = scene.time.now + 2000; // breve imunidade pós-quebra
    const tdied = target.takeDamage(def.selfDmg, null);
    if (tdied) scene._onEnemyDeath(target);

    // O gelo quebra: esguicha LASCAS-LOSANGO voando em todas as direções
    const n = def.shards ?? 8;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const ex = cx + Math.cos(ang) * radius;
      const ey = cy + Math.sin(ang) * radius;
      const shard = scene.add
        .image(cx, cy, "px_shard")
        .setScale(3)
        .setDepth(61)
        .setRotation(ang);
      scene.tweens.add({
        targets: shard,
        x: ex, y: ey, alpha: 0, rotation: ang + 0.6,
        duration: 280, ease: "Cubic.easeOut",
        onComplete: () => shard.destroy(),
      });
    }

    // Dano BAIXO em área curta nos vizinhos
    scene.enemyPool.forEachActive((e) => {
      if (e === target) return;
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= radiusSq) {
        const died = e.takeDamage(def.dmg * (scene.player?.prism ?? 1), null);
        if (died) scene._onEnemyDeath(e);
      }
    });

    if (!showFx) return;
    scene.lighting?.flash(cx, cy, 260, 0x9fe8ff, 350, 1);
    scene.sound.play("sfx_react_crystal", { volume: 0.55 }); // estilhaço de gelo
    scene.cameras.main.shake(90, 0.004);
    scene.player?.addAwakenMeter(PLAYER.AWAKEN_GAIN_REACTION);
    this._label(cx, cy, def.label, def.color);
  }

  _overload(enemy, def, areaMult = 1) {
    const scene = this.scene;
    const visited = new Set([enemy]);
    let prev = enemy;
    const reach = (def.jumpRange ?? 200) * areaMult;
    const jumpMaxSq = reach * reach;
    // Flash no ponto de origem — marca a Sobrecarga como "a recompensa em área"
    const flash = scene.add
      .image(enemy.x, enemy.y, "fx_glow")
      .setScale(0.5)
      .setTint(def.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(61);
    scene.tweens.add({
      targets: flash,
      scale: 2.2,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
    for (let i = 0; i < def.jumps; i++) {
      let best = null,
        bestSq = jumpMaxSq;
      scene.enemyPool.forEachActive((e) => {
        if (visited.has(e)) return;
        const dx = e.x - prev.x,
          dy = e.y - prev.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) {
          bestSq = d2;
          best = e;
        }
      });
      if (!best) break;
      // Raio da Sobrecarga é GROSSO e amarelo-elétrico (distinto do raio fino da arma)
      this._drawBolt(prev.x, prev.y, best.x, best.y, def.color, 6);
      const died = best.takeDamage(def.dmgPerJump * (scene.player?.prism ?? 1), null);
      if (died) scene._onEnemyDeath(best);
      visited.add(best);
      prev = best;
    }
  }

  _drawBolt(x1, y1, x2, y2, color, width = 3) {
    const scene = this.scene;
    const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
    // zig-zag (mesmos pontos pra halo e núcleo)
    const segs = 6;
    const pts = [[x1, y1]];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push([x1 + (x2 - x1) * t + (Math.random() - 0.5) * 16, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 16]);
    }
    pts.push([x2, y2]);
    const stroke = (w, c, a) => {
      g.lineStyle(w, c, a);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.strokePath();
    };
    stroke(width + 8, color, 0.25); // halo
    // Clarão do raio ilumina o entorno (origem e impacto)
    scene.lighting?.flash(x2, y2, 230 + width * 12, color, 170, 1);
    scene.lighting?.flash((x1 + x2) / 2, (y1 + y2) / 2, 160, color, 120, 0.6);
    stroke(width, color, 1);
    stroke(Math.max(1, width - 2), 0xffffff, 0.9); // núcleo quente
    // Faísca no ponto de impacto
    const sp = scene.add.image(x2, y2, "px_spark").setScale(3).setTint(color).setDepth(61);
    scene.tweens.add({ targets: sp, scale: 5, alpha: 0, duration: 200, onComplete: () => sp.destroy() });
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 250,
      onComplete: () => g.destroy(),
    });
  }

  // Tick periódico — processa expiração + DoT de fire/bolt
  tick(time) {
    if (time - this.lastTickAt < this.tickInterval) return;
    this.lastTickAt = time;
    const scene = this.scene;

    scene.enemyPool.forEachActive((enemy) => {
      let changed = false;
      for (const k of Object.keys(enemy.statuses)) {
        const s = enemy.statuses[k];
        if (time >= s.until) {
          delete enemy.statuses[k];
          changed = true;
          continue;
        }
        // DoT
        if (
          s.def.dmgPerTick &&
          s.def.tickMs &&
          time - s.lastTickAt >= s.def.tickMs
        ) {
          s.lastTickAt = time;
          const died = enemy.takeDamage(s.def.dmgPerTick, null);
          if (died) {
            scene._onEnemyDeath(enemy);
            break;
          }
        }
      }
      if (changed) this._updateTint(enemy);
    });
  }
}
