// ★ DIFERENCIAL ★ — Status elementais e reações automáticas.
// 4 status: fire, ice, bolt, wind. Quando 2+ coexistem no mesmo inimigo, dispara reação.
// Pares: fogo+gelo Vapor · gelo+raio Cristal · fogo+raio Sobrecarga ·
//        fogo+vento Labareda · gelo+vento Geada · raio+vento Temporal.
import { STATUS, STATUS_LOOK, REACTION, COLORS, PLAYER, ELEMENT } from "../config.js";
import { text } from "../ui/Theme.js";
import { hex, PAL } from "../art/Palette.js";
import { tr } from "../i18n/i18n.js";

// STATUS_LOOK (chaves da paleta) → { mode, tint, tint2, ramp } prontos para o Phaser; resolvido uma vez
const _looks = {};
const dim = (c, k) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
const mixC = (a, b, t) => {
  const ch = (c, s) => (c >> s) & 255;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
const PULSE_STEPS = 16;
function statusLook(key) {
  if (!_looks[key]) {
    const L = STATUS_LOOK[key];
    const tint = dim(PAL[L.tint], L.k ?? 1);
    _looks[key] = {
      mode: Phaser.TintModes[L.mode],
      tint,
      tint2: L.dark ? PAL[L.dark] : 0,
      // vibração (raio): cores da tinta ao longo do pulso, pré-calculadas
      ramp: L.pulse ? Array.from({ length: PULSE_STEPS + 1 }, (_, i) => mixC(tint, dim(PAL[L.pulse], L.pulseK ?? 1), i / PULSE_STEPS)) : null,
    };
  }
  return _looks[key];
}
// Status que manda na cor (congelado > fogo > gelo > raio > vento) — também decide a cor da luz do inimigo
export function dominantStatus(enemy) {
  const st = enemy.statuses;
  return enemy._frozenVisual ? "frozen" : st.fire ? "fire" : st.ice ? "ice" : st.bolt ? "bolt" : st.wind ? "wind" : null;
}

// Reações por COEXISTÊNCIA de status — as três funcionam do mesmo jeito: dois
// elementos no mesmo inimigo. CRISTAL antes exigia o inimigo CONGELADO (na prática
// só a Aura congelava, e Orbe/Granizo + Raio nunca reagiam); agora gelo + raio já
// estilhaça, e congelado + raio estilhaça MAIS FORTE (recompensa por congelar).
const REACTION_MAP = {
  "fire+ice": "VAPOR",
  "ice+fire": "VAPOR",
  "fire+bolt": "OVERLOAD",
  "bolt+fire": "OVERLOAD",
  "ice+bolt": "CRYSTAL",
  "bolt+ice": "CRYSTAL",
  "fire+wind": "LABAREDA",
  "wind+fire": "LABAREDA",
  "ice+wind": "GEADA",
  "wind+ice": "GEADA",
  "bolt+wind": "TEMPORAL",
  "wind+bolt": "TEMPORAL",
};

export class ElementalSystem {
  constructor(scene) {
    this.scene = scene;
    this.lastTickAt = 0;
    this.tickInterval = 100;
    this._pulsing = new Set(); // inimigos com tinta que vibra (raio)
    this._glow = { r: STATUS_LOOK.GLOW_R, a: STATUS_LOOK.GLOW_A, color: 0 }; // reaproveitado (sem lixo por quadro)
    // Cooldown global por tipo de reação (evita spam visual quando muitas armas)
    this.lastReactionAt = { VAPOR: 0, CRYSTAL: 0, OVERLOAD: 0, LABAREDA: 0, GEADA: 0, TEMPORAL: 0 };
    this.reactionCdMs = 350; // 1 reação do mesmo tipo a cada 350ms
  }

  // Chamado quando uma arma atinge um inimigo.
  applyStatus(enemy, element) {
    if (!element || !enemy?.active) return;
    const now = this.scene.time.now;
    const def = STATUS[element.toUpperCase()];
    if (!def) return;

    const prev = enemy.statuses[element];
    enemy.statuses[element] = {
      until: now + def.duration,
      def,
      lastTickAt: prev?.lastTickAt ?? now,
      since: prev?.since ?? now, // reapplicar não "rejuvenesce": decide a ordem das reações
      src: this.scene._hitSrc ?? null, // arma que aplicou (assistência da reação)
    };
    enemy._lastEl = element; // a morte "fala" a língua do último elemento

    // Tinta visual baseada no status dominante
    this._updateTint(enemy);

    // CRISTAL forte: raio num inimigo CONGELADO estilhaça mesmo sem o status de gelo
    if (element === ELEMENT.BOLT && enemy.isFrozen?.(now) && now >= (enemy._reactUntil ?? 0)) {
      this._rxBy = [...new Set([enemy.statuses.ice?.src, this.scene._hitSrc].filter(Boolean))];
      delete enemy.statuses.bolt;
      delete enemy.statuses.ice;
      enemy._reactUntil = now + REACTION.LOCK_MS;
      this._updateTint(enemy);
      this._shatter(enemy, REACTION.CRYSTAL, true);
      return;
    }

    // Checa reação por coexistência de status
    this._checkReaction(enemy, element);
  }

  // Cor de repouso do inimigo: congelado > fogo > gelo > raio > vento (STATUS_LOOK no config). Chamado ao
  // pegar/perder status, ao congelar/descongelar e no fim do pisca-branco de dano (que usa FILL)
  _updateTint(enemy) {
    const key = dominantStatus(enemy);
    const look = key && statusLook(key);
    if (look) enemy.setTint(look.tint).setTint2(look.tint2).setTintMode(look.mode);
    else enemy.clearTint();
    if (look?.ramp) {
      enemy._pulsePh ??= Math.random() * Math.PI * 2; // cada um vibra no seu tempo
      this._pulsing.add(enemy);
    } else this._pulsing.delete(enemy);
  }

  // Luz do inimigo com status no mapa de luz (Lighting): cor do elemento; null = a luz da corrupção
  glowOf(enemy) {
    const key = dominantStatus(enemy);
    if (!key) return null;
    this._glow.color = STATUS_LOOK[key].glow;
    return this._glow;
  }

  // A cada quadro: só os que vibram (raio) — poucos, e a tinta é por vértice (sem custo de desenho)
  _pulse(time) {
    if (!this._pulsing.size) return;
    const w = (Math.PI * 2) / STATUS_LOOK.PULSE_MS;
    for (const e of this._pulsing) {
      const key = e.active && dominantStatus(e);
      const look = key && statusLook(key);
      if (!look?.ramp) {
        this._pulsing.delete(e);
        continue;
      }
      if (e.tintMode !== look.mode) continue; // pisca-branco de dano (FILL) em curso: ele devolve a cor
      const s = 0.5 - 0.5 * Math.cos(time * w + e._pulsePh);
      e.setTint(look.ramp[Math.round(s * s * PULSE_STEPS)]); // pico curto e descida longa: estalo, não respiração
    }
  }

  // Fôlego por inimigo (REACTION.LOCK_MS): logo depois de reagir, os status ainda
  // pegam mas não reagem. Sem isso, a Aura (gelo em todo o bando a cada 1,2 s) +
  // qualquer fogo virava Vapor em todo golpe e as outras reações sumiam.
  _checkReaction(enemy, incoming = null) {
    const keys = Object.keys(enemy.statuses);
    if (keys.length < 2) return;
    const now = this.scene.time.now;
    if (now < (enemy._reactUntil ?? 0)) return;

    // O elemento que CHEGOU reage com o que já estava lá há mais tempo
    // (antes: a ordem das chaves decidia, e o Vapor sempre ganhava o gelo)
    const a = incoming && enemy.statuses[incoming] ? incoming : null;
    const others = keys.filter((k) => k !== a).sort((x, y) => enemy.statuses[x].since - enemy.statuses[y].since);
    const pairs = a ? others.map((o) => [a, o]) : others.flatMap((x, i) => others.slice(i + 1).map((y) => [x, y]));
    for (const [x, y] of pairs) {
      const reactionKey = REACTION_MAP[`${x}+${y}`];
      if (!reactionKey) continue;
      // Assistência: as armas que puseram os dois elementos (a mesma arma pode ter posto os dois)
      this._rxBy = [...new Set([enemy.statuses[x]?.src, enemy.statuses[y]?.src].filter(Boolean))];
      // Consome os status do par (evita disparo contínuo)
      delete enemy.statuses[x];
      delete enemy.statuses[y];
      enemy._reactUntil = now + REACTION.LOCK_MS;
      this._updateTint(enemy);
      if (reactionKey === "CRYSTAL") this._shatter(enemy, REACTION.CRYSTAL, enemy.isFrozen?.(now));
      else this._trigger(enemy, reactionKey);
      return;
    }
  }

  _trigger(enemy, reactionKey) {
    const def = REACTION[reactionKey];
    const scene = this.scene;

    // Conquistas (Fase 3): conta TODA reação mecânica, mesmo com visual em CD
    scene.meta?.recordReaction(reactionKey);
    scene._checkAchievementsSoon?.(); // no máx. 1×/s (GameScene)

    // Anti-spam: cooldown por TIPO de reação (não mostra texto se foi disparado <350ms atrás)
    const now = scene.time.now;
    const onCd = now - this.lastReactionAt[reactionKey] < this.reactionCdMs;
    this.lastReactionAt[reactionKey] = now;

    // Aplica efeito mecânico SEMPRE (dano continua), mas suprime visual se em CD
    if (onCd) {
      // Aplica só o efeito mecânico, sem texto/shake/SFX
      const areaMult = scene.player?.areaMult ?? 1;
      this._mechanic(reactionKey, enemy, def, areaMult, false);
      return;
    }

    scene.lighting?.flash(enemy.x, enemy.y, 280, def.color, 450, 1);
    // Texto flutuante BIG (D21)
    this._label(enemy.x, enemy.y, def.label, def.color);
    scene._hint?.("reaction", tr("REAÇÃO! Dois elementos no mesmo inimigo\ncausam efeitos extras. Combine armas!"));

    // Screenshake leve
    scene.cameras.main.shake(120, 0.005);

    // Alimenta o medidor de Despertar
    scene.player?.addAwakenMeter(PLAYER.AWAKEN_GAIN_REACTION);

    // Área é amplificada pelo modificador de área do player (passiva)
    const areaMult = this.scene.player?.areaMult ?? 1;
    // SFX distintos por reação (re-uso impacts existentes com pitch diferente)
    const SFX = { VAPOR: "sfx_react_vapor", OVERLOAD: "sfx_react_overload", LABAREDA: "sfx_react_labareda", GEADA: "sfx_react_geada", TEMPORAL: "sfx_react_temporal" };
    scene.sound.play(SFX[reactionKey], { volume: 0.5 });
    this._mechanic(reactionKey, enemy, def, areaMult, true);
  }

  // Efeito mecânico de cada reação (fx = mostrar o espetáculo; em recarga, só o dano)
  _mechanic(key, enemy, def, areaMult, fx) {
    if (key === "VAPOR") this._vapor(enemy, def, areaMult);
    else if (key === "OVERLOAD") this._overload(enemy, def, areaMult);
    else if (key === "LABAREDA") this._labareda(enemy, def, areaMult, fx);
    else if (key === "GEADA") this._geada(enemy, def, areaMult, fx);
    else if (key === "TEMPORAL") this._temporal(enemy, def, areaMult, fx);
  }

  // Alvos vivos perto de (x, y), mais perto primeiro (inimigos; chefe à parte)
  _near(x, y, r, skip = null, n = 99) {
    const list = [];
    const rSq = r * r;
    this.scene.enemyPool.forEachActive((e) => {
      if (!e.active || e === skip) return;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 <= rSq) list.push({ e, d2 });
    });
    list.sort((a, b) => a.d2 - b.d2);
    return list.slice(0, n).map((o) => o.e);
  }

  // src = fonte no livro de dano (rx_labareda, rx_geada, rx_temporal); by = dupla da assistência
  _hurt(e, dmg, fx, fy, src, by = null) {
    const scene = this.scene;
    scene._dmgSrc = src;
    scene._dmgAssist = by;
    scene._hitSrc = null; // a chama/geada que a reação espalhar não é de nenhuma arma
    const died = e.takeDamage(dmg * (scene.player?.prism ?? 1), null, fx, fy);
    if (died) scene._onEnemyDeath(e);
    return died;
  }

  // LABAREDA (fogo + vento): um redemoinho de fogo irrompe no alvo e o vento arranca
  // línguas de fogo da coluna até os vizinhos — a chama "pega" quando a língua chega
  _labareda(enemy, def, areaMult, fx) {
    const scene = this.scene;
    const by = this._rxBy;
    const x = enemy.x,
      y = enemy.y;
    const R = def.radius * areaMult;
    const feet = (e) => e.y + (e.displayHeight || 40) * 0.42;
    const fxOn = fx && scene.fx;
    if (fxOn) scene.fx.fireWhirl(x, feet(enemy), R);
    this._hurt(enemy, def.dmg, x, y, "rx_labareda", by);
    const near = this._near(x, y, R, enemy, def.spread);
    near.forEach((e, i) => {
      const catchFire = () => {
        this._hurt(e, def.dmg * 0.6, x, y, "rx_labareda", by);
        if (e.active) this.applyStatus(e, "fire"); // a chama "pega" (pode reagir de novo noutro par)
      };
      if (!fxOn) return catchFire();
      // O inimigo é de pool: só vale se ainda for o mesmo quando a língua chegar
      const life = e._life;
      scene.fx.fireWisp(x, y - 40 - (i % 3) * 14, e, 90 + i * 55, () => {
        if (!e.active || e._life !== life) return;
        scene.fx.ignite(e.x, feet(e));
        catchFire();
      });
    });
  }

  // GEADA (gelo + vento): rajada fria em volta — dano, lentidão forte e congela quem já estava gelado
  _geada(enemy, def, areaMult, fx) {
    const scene = this.scene;
    const by = this._rxBy;
    const now = scene.time.now;
    const x = enemy.x,
      y = enemy.y;
    const R = def.radius * areaMult;
    const hit = [enemy, ...this._near(x, y, R, enemy)];
    for (const e of hit) {
      const wasCold = !!e.statuses?.ice || e === enemy;
      if (this._hurt(e, def.dmg, x, y, "rx_geada", by)) continue;
      if (e.miniBoss) continue;
      e._bindUntil = now + def.slowMs;
      e._bindSlow = def.slow;
      if (wasCold && e.freeze && !e.isFrozen(now) && now >= e._freezeLockUntil) e.freeze(now, def.freezeMs, 2400);
    }
    if (!fx) return;
    scene.fx?.frostGust(x, y + 4, R); // lufada de neve em espiral (desenhada)
    scene.fx?.ring(x, y + 4, 0xffffff, 10, R, 280, 0.6, 0.7);
    scene.fx?.burst("frost", x, y, 16, null, 360, { min: 80, max: 220 });
    scene.fx?.burst("streak", x, y, 10, null, 360, { min: 160, max: 320 }, [0xffffff, 0xd2fbe9, 0xbfeaff]);
    scene.fx?.decal("fx_frost", x, y + 6, R * 0.6, 1800, 0.6);
  }

  // TEMPORAL (raio + vento): raios caem do céu em quem está em volta
  _temporal(enemy, def, areaMult, fx) {
    const scene = this.scene;
    const by = this._rxBy;
    const targets = [enemy, ...this._near(enemy.x, enemy.y, def.radius * areaMult, enemy, def.strikes - 1)];
    targets.forEach((e, i) => {
      scene.time.delayedCall(i * 90, () => {
        if (!e.active) return;
        if (fx || i === 0) {
          this._drawBolt(e.x + 24 - i * 12, e.y - 260, e.x, e.y - 4, def.color, 5);
          scene.fx?.strikeMark(e.x, e.y + 10, [PAL.white, PAL.ice3, PAL.wnd2, PAL.ice1]);
        }
        this._hurt(e, def.dmg, e.x, e.y - 30, "rx_temporal", by);
      });
    });
    if (fx) scene.cameras.main.shake(140, 0.005);
  }

  // VAPOR = nuvem ESCALDANTE: dano contínuo (DoT) na área. Não causa mais slow.
  _vapor(enemy, def, areaMult = 1) {
    const scene = this.scene;
    const by = this._rxBy; // a nuvem tica por 2 s: guarda quem a montou
    const now = scene.time.now;
    const cx = enemy.x,
      cy = enemy.y;
    const radius = def.radius * areaMult;
    const radiusSq = radius * radius;
    // Nuvens NÃO se empilham: perto de uma nuvem viva, só renova a duração dela.
    // (Antes 20+ nuvens sobrepostas no mesmo bando somavam o dano — o Vapor
    // chegava a 2/3 do dano da partida.)
    this._clouds = (this._clouds || []).filter((c) => c.until > now);
    const near = this._clouds.find((c) => (c.x - cx) ** 2 + (c.y - cy) ** 2 < (c.r * def.mergeDist) ** 2);
    if (near) {
      near.until = Math.max(near.until, now + def.duration * 0.6);
      return;
    }
    const cloud = { x: cx, y: cy, r: radius, until: now + def.duration };
    this._clouds.push(cloud);
    this._cloudFx(cx, cy, radius, def.color, def.duration);

    const tickDmg = def.dmgPerTick * (scene.player?.prism ?? 1);
    const applyDmg = () => {
      if (!scene.enemyPool) return;
      scene.enemyPool.forEachActive((e) => {
        const dx = e.x - cx,
          dy = e.y - cy;
        if (dx * dx + dy * dy <= radiusSq) {
          scene._dmgSrc = "rx_vapor";
          scene._dmgAssist = by;
          const died = e.takeDamage(tickDmg, null, null, null, false, true);
          if (died) scene._onEnemyDeath(e);
        }
      });
      if (scene.boss?.active) {
        const dx = scene.boss.x - cx,
          dy = scene.boss.y - cy;
        if (dx * dx + dy * dy <= radiusSq) {
          scene._dmgSrc = "rx_vapor";
          scene._dmgAssist = by;
          const died = scene.boss.takeDamage(tickDmg);
          if (died) scene._onBossDeath();
        }
      }
    };
    applyDmg();
    const ev = scene.time.addEvent({
      delay: def.tickMs,
      loop: true,
      callback: () => {
        if (scene.time.now > cloud.until) return ev.remove();
        applyDmg();
      },
    });
  }

  // Nuvem de vapor DESENHADA (src/art/ReactionFX.js) — sem WeaponFX, os puffs antigos
  _cloudFx(cx, cy, radius, color, duration) {
    const scene = this.scene;
    if (scene.fx) {
      scene.fx.steamCloud(cx, cy, radius, duration);
      scene.fx.burst("smoke", cx, cy - 10, 3, -Math.PI / 2, 100, { min: 20, max: 60 });
      return;
    }
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
  // Reaproveitados por rótulo+cor: um texto novo era um canvas e uma textura novos a cada reação
  _label(x, y, str, color) {
    const scene = this.scene;
    const key = `${str}|${color}`;
    const pool = (this._labels ||= new Map());
    let free = pool.get(key);
    if (!free) pool.set(key, (free = []));
    let t = free.pop();
    if (t) t.setPosition(Math.round(x), Math.round(y - 26)).setAlpha(1).setVisible(true);
    else {
      t = text(scene, x, y - 26, str, {
        size: 22,
        color: hex(color),
        origin: 0.5,
        stroke: true,
        strokeW: 5,
      }).setDepth(60000);
    }
    t.setScale(0.4);
    scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: "Back.easeOut" });
    scene.tweens.add({
      targets: t,
      y: y - 70,
      alpha: 0,
      delay: 350,
      duration: 600,
      onComplete: () => {
        t.setVisible(false);
        free.push(t);
      },
    });
  }

  // CRISTAL = o inimigo CONGELADO leva raio e ESTILHAÇA: lascas curtas em todas as
  // direções, DANO BAIXO. É recompensa de combo (Aura congela → Raio quebra), não dano bruto.
  _shatter(target, def, frozen = false) {
    const scene = this.scene;
    const now = scene.time.now;
    // Conquistas (Fase 3): Cristal não passa por _trigger, conta aqui
    scene.meta?.recordReaction("CRYSTAL");
    scene._checkAchievementsSoon?.(); // no máx. 1×/s (GameScene)
    // Anti-spam por TIPO
    if (now - this.lastReactionAt.CRYSTAL < this.reactionCdMs) {
      // ainda aplica mecânica, sem texto/shake
      this._shatterMechanic(target, def, false, frozen);
      return;
    }
    this.lastReactionAt.CRYSTAL = now;
    this._shatterMechanic(target, def, true, frozen);
  }

  _shatterMechanic(target, def, showFx, frozen = false) {
    const scene = this.scene;
    const by = this._rxBy;
    const cx = target.x, cy = target.y;
    const areaMult = scene.player?.areaMult ?? 1;
    const fm = frozen ? def.frozenMult : 1; // congelado: estilhaço maior e mais forte
    const radius = def.radius * areaMult * (frozen ? def.frozenRadiusMult : 1);
    const radiusSq = radius * radius;

    // O alvo "quebra": leva um golpe de estilhaçamento (e perde o congelamento)
    target._frozenUntil = 0;
    target._freezeLockUntil = scene.time.now + 2000; // breve imunidade pós-quebra
    scene._dmgSrc = "rx_crystal";
    scene._dmgAssist = by;
    const tdied = target.takeDamage(def.selfDmg * fm * (scene.player?.prism ?? 1), null);
    if (tdied) scene._onEnemyDeath(target);

    // O gelo quebra: lascas voando + estalo + anel de geada no chão
    const fx = scene.fx;
    if (fx) {
      fx.crystalBurst(cx, cy + 10, frozen); // o gelo BROTA no alvo e estilhaça
      fx.burst("shard", cx, cy - 6, (def.shards ?? 8) + 4, null, 360, { min: 140, max: 320 });
      fx.burst("frost", cx, cy, 10, null, 360, { min: 30, max: 120 });
      fx.star(cx, cy - 6, 0xffffff, 0.8, showFx ? 3.2 : 2, 160, Math.PI / 4);
      fx.ring(cx, cy + 4, 0xbfeaff, 10, radius, 260);
      fx.decal("fx_frost", cx, cy + 6, radius * 0.55, 1600, 0.55);
    }

    // Dano BAIXO em área curta nos vizinhos
    scene.enemyPool.forEachActive((e) => {
      if (e === target) return;
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= radiusSq) {
        scene._dmgSrc = "rx_crystal";
        scene._dmgAssist = by;
        const died = e.takeDamage(def.dmg * fm * (scene.player?.prism ?? 1), null);
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
    const by = this._rxBy;
    const visited = new Set([enemy]);
    let prev = enemy;
    const reach = (def.jumpRange ?? 200) * areaMult;
    const jumpMaxSq = reach * reach;
    // Flash no ponto de origem — marca a Sobrecarga como "a recompensa em área"
    scene.fx?.thunderRing(enemy.x, enemy.y + 6, 8, 74 * areaMult, 300, [PAL.white, PAL.yel3, PAL.yel2, PAL.org1], 0.6);
    scene.fx?.light(enemy.x, enemy.y, 200, def.color, 300, 1);
    scene.fx?.burst("zap", enemy.x, enemy.y, 12);
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
      scene._dmgSrc = "rx_overload";
      scene._dmgAssist = by;
      const died = best.takeDamage(def.dmgPerJump * (scene.player?.prism ?? 1), null, prev.x, prev.y);
      scene.fx?.impact(best.x, best.y - 6, "bolt", { power: 1 });
      if (died) scene._onEnemyDeath(best);
      visited.add(best);
      prev = best;
    }
  }

  _drawBolt(x1, y1, x2, y2, color, width = 3) {
    const scene = this.scene;
    // Raio em pixel com galhos (WeaponFX); o antigo (linhas lisas) fica de reserva
    if (scene.fx) {
      scene.fx.bolt(x1, y1, x2, y2, color, Math.max(2, Math.round(width * 0.75)), width >= 5 ? 3 : 2);
      scene.fx.burst("zap", x2, y2, 4 + width);
      scene.fx.star(x2, y2, 0xffffff, 0.5, 1.6, 110, Math.PI / 4);
      return;
    }
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

  // Matéria dos status (só na tela): quem queima solta brasa, quem está
  // eletrizado estala, quem está gelado cintila. Ritmo próprio por inimigo.
  _statusFx(e, time, view) {
    const fx = this.scene.fx;
    const st = e.statuses;
    if (!fx || time < (e._stFxAt ?? 0) || !view.contains(e.x, e.y)) return;
    const h = e.displayHeight;
    const x = e.x + (Math.random() - 0.5) * e.displayWidth * 0.5,
      y = e.y - h * (0.1 + Math.random() * 0.35);
    if (st.fire) {
      fx.burst("ember", x, y, 1, -Math.PI / 2, 60, { min: 20, max: 60 });
      e._stFxAt = time + 260;
    } else if (st.bolt) {
      fx.burst("zap", x, y, 2, null, 360, { min: 60, max: 140 });
      e._stFxAt = time + 300;
    } else if (st.ice) {
      fx.burst("frost", x, y, 1, null, 360, { min: 0, max: 20 });
      e._stFxAt = time + 380;
    } else if (st.wind) {
      fx.burst("gust", x, y, 1, Math.atan2(e.y - (this.scene.player?.y ?? e.y), e.x - (this.scene.player?.x ?? e.x)), 40);
      e._stFxAt = time + 240;
    }
  }

  // Tick periódico — processa expiração + DoT de fire/bolt
  tick(time) {
    this._pulse(time);
    if (time - this.lastTickAt < this.tickInterval) return;
    this.lastTickAt = time;
    const scene = this.scene;
    const view = scene.cameras.main.worldView;

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
          scene._dmgSrc = `st_${k}`; // queimadura/choque (status)
          const died = enemy.takeDamage(s.def.dmgPerTick, null, null, null, false, true);
          if (died) {
            scene._onEnemyDeath(enemy);
            break;
          }
        }
      }
      if (changed) this._updateTint(enemy);
      if (enemy.active) this._statusFx(enemy, time, view);
    });
  }
}
