// ★ DIFERENCIAL ★ — Status elementais e reações automáticas.
// 3 status: fire, ice, bolt. Quando 2+ coexistem no mesmo inimigo, dispara reação.
import { STATUS, REACTION, COLORS, PLAYER } from '../config.js';

const REACTION_MAP = {
  'fire+ice':  'VAPOR',
  'ice+fire':  'VAPOR',
  'ice+bolt':  'CRYSTAL',
  'bolt+ice':  'CRYSTAL',
  'fire+bolt': 'OVERLOAD',
  'bolt+fire': 'OVERLOAD',
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

    // Checa reação imediatamente
    this._checkReaction(enemy);
  }

  _updateTint(enemy) {
    if (enemy.statuses.fire)      enemy.setTint(0xff9966);
    else if (enemy.statuses.ice)  enemy.setTint(0x9ad4ff);
    else if (enemy.statuses.bolt) enemy.setTint(0xd8a8ff);
    else                          enemy.clearTint();
  }

  _checkReaction(enemy) {
    const keys = Object.keys(enemy.statuses);
    if (keys.length < 2) return;

    // Pega os 2 primeiros status diferentes
    const [a, b] = keys;
    const reactionKey = REACTION_MAP[`${a}+${b}`];
    if (!reactionKey) return;

    // Consome os status (evita disparo contínuo)
    delete enemy.statuses[a];
    delete enemy.statuses[b];
    this._updateTint(enemy);

    this._trigger(enemy, reactionKey);
  }

  _trigger(enemy, reactionKey) {
    const def = REACTION[reactionKey];
    const scene = this.scene;

    // Anti-spam: cooldown por TIPO de reação (não mostra texto se foi disparado <350ms atrás)
    const now = scene.time.now;
    const onCd = now - this.lastReactionAt[reactionKey] < this.reactionCdMs;
    this.lastReactionAt[reactionKey] = now;

    // Aplica efeito mecânico SEMPRE (dano continua), mas suprime visual se em CD
    if (onCd) {
      // Aplica só o efeito mecânico, sem texto/shake/SFX
      const areaMult = scene.player?.areaMult ?? 1;
      if      (reactionKey === 'VAPOR')    this._vapor(enemy, def, areaMult);
      else if (reactionKey === 'CRYSTAL')  this._crystal(enemy, def, areaMult);
      else if (reactionKey === 'OVERLOAD') this._overload(enemy, def, areaMult);
      return;
    }

    // Texto flutuante BIG (D21)
    const txt = scene.add.text(enemy.x, enemy.y - 30, def.label, {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2000);
    scene.tweens.add({
      targets: txt,
      y: enemy.y - 80,
      alpha: 0,
      duration: 900,
      onComplete: () => txt.destroy(),
    });

    // Screenshake leve
    scene.cameras.main.shake(120, 0.005);

    // Alimenta o medidor de Despertar
    scene.player?.addAwakenMeter(PLAYER.AWAKEN_GAIN_REACTION);

    // Área é amplificada pelo modificador de área do player (passiva)
    const areaMult = this.scene.player?.areaMult ?? 1;
    // SFX distintos por reação (re-uso impacts existentes com pitch diferente)
    if (reactionKey === 'VAPOR') {
      scene.sound.play('sfx_hit', { volume: 0.4, rate: 0.6, detune: -600 });    // hiss grave
      this._vapor(enemy, def, areaMult);
    } else if (reactionKey === 'CRYSTAL') {
      scene.sound.play('sfx_pickup', { volume: 0.5, rate: 1.6, detune: 400 });  // estilhaço agudo
      this._crystal(enemy, def, areaMult);
    } else if (reactionKey === 'OVERLOAD') {
      scene.sound.play('sfx_levelup', { volume: 0.5, rate: 1.4, detune: 300 }); // zap eletrico
      this._overload(enemy, def, areaMult);
    }
  }

  _vapor(enemy, def, areaMult = 1) {
    const scene = this.scene;
    const cx = enemy.x, cy = enemy.y;
    const radius = def.radius * areaMult;
    const cloud = scene.add.circle(cx, cy, radius, def.color, 0.35).setDepth(50);
    scene.tweens.add({ targets: cloud, alpha: 0, scale: 1.2, duration: def.duration, onComplete: () => cloud.destroy() });

    const expireAt = scene.time.now + def.duration;
    const apply = () => {
      scene.enemyPool.forEachActive(e => {
        const dx = e.x - cx, dy = e.y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          e._vaporUntil = Math.max(e._vaporUntil || 0, expireAt);
        }
      });
    };
    apply();
    scene.time.addEvent({ delay: 200, repeat: Math.floor(def.duration / 200), callback: apply });
  }

  _crystal(enemy, def, areaMult = 1) {
    const scene = this.scene;
    const cx = enemy.x, cy = enemy.y;
    const radius = def.radius * areaMult;
    const ring = scene.add.circle(cx, cy, 6, def.color, 0).setStrokeStyle(4, def.color, 1).setDepth(60);
    scene.tweens.add({
      targets: ring, radius, alpha: 0, duration: 350,
      onComplete: () => ring.destroy(),
    });
    // Dano em área + CONGELAR (status ice 1s) os inimigos atingidos
    const freezeUntil = scene.time.now + 1000;
    scene.enemyPool.forEachActive(e => {
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const died = e.takeDamage(def.dmg, null);
        if (died) { scene._onEnemyDeath(e); return; }
        // Aplica/extende ice como freeze
        e.statuses.ice = { until: freezeUntil, def: STATUS.ICE, lastTickAt: scene.time.now };
        this._updateTint(e);
      }
    });
    // Boss também
    if (scene.boss?.active) {
      const dx = scene.boss.x - cx, dy = scene.boss.y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        scene.boss.statuses.ice = { until: freezeUntil, def: STATUS.ICE, lastTickAt: scene.time.now };
      }
    }
  }

  _overload(enemy, def, areaMult = 1) {
    const scene = this.scene;
    const visited = new Set([enemy]);
    let prev = enemy;
    const jumpMaxSq = (200 * areaMult) * (200 * areaMult);
    for (let i = 0; i < def.jumps; i++) {
      let best = null, bestSq = jumpMaxSq;
      scene.enemyPool.forEachActive(e => {
        if (visited.has(e)) return;
        const dx = e.x - prev.x, dy = e.y - prev.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) { bestSq = d2; best = e; }
      });
      if (!best) break;
      this._drawBolt(prev.x, prev.y, best.x, best.y, def.color);
      const died = best.takeDamage(def.dmgPerJump, null);
      if (died) scene._onEnemyDeath(best);
      visited.add(best);
      prev = best;
    }
  }

  _drawBolt(x1, y1, x2, y2, color) {
    const scene = this.scene;
    const g = scene.add.graphics().setDepth(60);
    g.lineStyle(3, color, 1);
    // zig-zag
    const segs = 6;
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 14;
      const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 14;
      g.lineTo(x, y);
    }
    g.lineTo(x2, y2);
    g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  // Tick periódico — processa expiração + DoT de fire/bolt
  tick(time) {
    if (time - this.lastTickAt < this.tickInterval) return;
    this.lastTickAt = time;
    const scene = this.scene;

    scene.enemyPool.forEachActive(enemy => {
      let changed = false;
      for (const k of Object.keys(enemy.statuses)) {
        const s = enemy.statuses[k];
        if (time >= s.until) {
          delete enemy.statuses[k];
          changed = true;
          continue;
        }
        // DoT
        if (s.def.dmgPerTick && s.def.tickMs && time - s.lastTickAt >= s.def.tickMs) {
          s.lastTickAt = time;
          const died = enemy.takeDamage(s.def.dmgPerTick, null);
          if (died) { scene._onEnemyDeath(enemy); break; }
        }
      }
      if (changed) this._updateTint(enemy);
    });
  }
}
