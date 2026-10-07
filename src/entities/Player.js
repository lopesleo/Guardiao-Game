// Player — Guardião da Floresta.
// Diferenciais: Despertar (R) e Dash (Shift/Space).
import { LinkSet } from '../systems/Links.js';
import { PLAYER, GAME, COLORS, RESONANCE } from '../config.js';
import { HERO_STEPS } from '../art/Hero.js';
import { PAL } from '../art/Palette.js';
import { registerAuraFX, AURA_H } from '../art/AuraFX.js';

import { tr } from "../i18n/i18n.js";

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, heroId = 'guardian') {
    super(scene, x, y, `hero_${heroId}`, 0);
    this.heroId = heroId;
    this.play(`${heroId}_idle`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(GAME.PIXEL_SCALE);
    this.setCollideWorldBounds(true);
    this.body.setCircle(6, 6, 14); // corpo na altura dos pés (quadro 24×28)
    this.body.setMaxSpeed(PLAYER.SPEED_BASE * 6); // permitir dash
    this._hurtUntil = 0; // quadro de "golpe sofrido" (Hero.js) até este instante
    // Aura do Despertar: fogo espiritual dourado desenhado ATRÁS do herói (AuraFX.js)
    registerAuraFX(scene);
    this.aura = scene.add.sprite(x, y, 'fx_awaken_aura', 0).setOrigin(0.5, (AURA_H - 3) / AURA_H).setScale(GAME.PIXEL_SCALE).setAlpha(0.85).setVisible(false);
    // Pisadas: nos quadros em que o pé toca o chão sobe poeira (ou gota/brilho de quem flutua)
    this._steps = HERO_STEPS[heroId] ?? null;
    this._puffs = [];
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim, frame) => {
      if (this._steps?.frames.includes(Number(frame.textureFrame))) this._stepFx();
    });

    // Sombra "blob" no chão (segue em update)
    this.shadow = scene.add
      .image(x, y, "px_shadow")
      .setScale(GAME.PIXEL_SCALE * 1.15, GAME.PIXEL_SCALE)
      .setDepth(4);
    // Luz suave sob o herói — destaca o Guardião no chão escuro da floresta
    this.light = scene.add
      .image(x, y, "fx_glow")
      .setScale(2.6, 1.6)
      .setTint(0xfff2c0)
      .setAlpha(0.13)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5);

    // Stats
    this.maxHp     = PLAYER.HP_BASE;
    this.hp        = this.maxHp;
    this.speed     = PLAYER.SPEED_BASE;
    this.cdMult    = 1.0;
    this.areaMult  = 1.0;
    this.extraProj = 0;
    this.pickupRadius = PLAYER.PICKUP_RADIUS;

    this.level = 1;
    this.xp    = 0;

    this.invulnUntil = 0;
    this.weapons = [];
    this.facingX = 1;
    // Última direção de movimento (Sopro Flamejante mira pra onde você anda)
    this.lastMoveX = 1;
    this.lastMoveY = 0;
    this.isMoving = false;

    // Despertar (default DESTRAVADO até GameScene checar)
    this.awakenUnlocked = true;
    this.awakenMeter = 0;
    this.awakenedUntil = 0;
    this.awakenLockUntil = 0;

    // Dash (default DESTRAVADO até GameScene checar)
    this.dashUnlocked = true;
    this.dashUntil = 0;
    this.dashCdUntil = 0;
    this.dashDirX = 1; this.dashDirY = 0;
    this._rootedUntil = 0;   // preso por raízes (imóvel) — dash não quebra
    this._grabSlowUntil = 0; // área de raízes agarrando: anda devagar, precisa dashar pra sair
    // Forças externas dos chefes: sucção (por quadro) e empurrão (decai sozinho)
    this._pullX = 0;
    this._pullY = 0;
    this._shove = null; // { vx, vy, t0, ms }

    // Passivas acumuláveis
    this.lifestealPct = 0;
    this.regenPerSec = 0;
    this._regenAcc = 0;
    this.critChance = 0.08;   // 8% base
    this.critMult = 2.0;      // 2x dano
    this.dmgTakenMult = 1;    // Casca de Carvalho (armadura %)
    this.links = new LinkSet(this); // laços de dupla (systems/Links.js)
    this.luck = 0;            // Trevo da Sorte (+% drops)

    // Multiplicadores de bênçãos (setados via BLESSINGS.apply)
    this._xpMult = 1;
    this._awakenGainMult = 1;
    this._dashCdMult = 1;
    this._blessingDmgMult = 1;
  }

  // Cura por roubo de vida — chamado nos sites de dano em GameScene.
  lifestealFrom(dmg) {
    if (this.lifestealPct <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + dmg * this.lifestealPct);
  }

  // Cura/refill direto (usado por pickups).
  healHp(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  refillAwaken(amount) {
    if (this.scene.time.now < this.awakenLockUntil) return;
    this.awakenMeter = Math.min(this.awakenMax, this.awakenMeter + amount);
  }

  addWeapon(weapon) {
    this.weapons.push(weapon);
    weapon.owner = this;
    this.recomputeResonance();
  }

  // Arma do arsenal pela chave BASE (a evolução responde pela base dela)
  weaponOf(baseKey) {
    return this.weapons.find((w) => (w.baseKey ?? w.key) === baseKey) ?? null;
  }

  // Ressonância elemental (ver RESONANCE): recalcula quando o arsenal muda.
  recomputeResonance() {
    this.links.recompute(); // laços dependem do mesmo arsenal
    const count = { fire: 0, ice: 0, bolt: 0, wind: 0 };
    for (const w of this.weapons) if (w.def?.element in count) count[w.def.element]++;
    const prev = this.resonance ?? { fire: 1, ice: 1, bolt: 1, wind: 1 };
    const prevPrism = this.prism ?? 1;
    this.resonance = {};
    for (const el of Object.keys(count)) this.resonance[el] = 1 + RESONANCE.PER_EXTRA_WEAPON * Math.max(0, count[el] - 1);
    // Prisma: TRÊS elementos diferentes no arsenal (quaisquer três dos quatro)
    this.prism = Object.values(count).filter((n) => n > 0).length >= 3 ? RESONANCE.PRISM_REACTION : 1;
    // Avisa só quando algo MELHOROU (não na carga inicial)
    if (this._resReady) {
      for (const el of Object.keys(count)) {
        if (this.resonance[el] > prev[el]) {
          const pct = Math.round((this.resonance[el] - 1) * 100);
          this.scene._toast?.(tr("RESSONÂNCIA DE {0}: +{1}% de dano", RESONANCE.NAMES[el], pct), 2400, "#ffe58f");
          this.scene.sound.play("sfx_levelup", { volume: 0.4, rate: 1.4 });
        }
      }
      if (this.prism > prevPrism) {
        this.scene._toast?.(tr("PRISMA! Reações +{0}%", Math.round((this.prism - 1) * 100)), 2600, "#e8ccff");
        this.scene.sound.play("sfx_levelup", { volume: 0.5, rate: 1.1 });
      }
    }
    this._resReady = true;
  }

  // Multiplicador de dano de arma: bênçãos × ressonância do elemento da arma
  dmgMultFor(element) {
    return this._blessingDmgMult * (this.resonance?.[element] ?? 1);
  }

  takeDamage(dmg) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil) return false;
    if (this.scene._god) return false; // debug (G): imune a TUDO (antes só ao encostão)
    this.hp = Math.max(0, this.hp - dmg * this.dmgTakenMult);
    this.invulnUntil = now + PLAYER.INVULN_MS;
    this._hitFx(now);
    this.scene.feel?.hurt(dmg * this.dmgTakenMult);
    return true;
  }

  _hitFx() {
    this._hurtUntil = this.scene.time.now + 150; // pose de dor (olhos fechados, corpo para trás)
    this.scene.sound.play('sfx_player_hit', { volume: 0.7 });
    this.setTint(0xff5a6e);
    this.scene.time.delayedCall(120, () => {
      if (this.isAwakened()) this.setTint(0xffd96b);
      else this.clearTint();
    });
  }

  gainXp(amount) {
    this.xp += amount * this._xpMult;
    const need = PLAYER.XP_PER_LEVEL(this.level);
    if (this.xp >= need) {
      this.xp -= need;
      this.level += 1;
      this.scene.events.emit('player:levelup', this.level);
      this.scene.sound.play('sfx_levelup', { volume: 0.6 });
    }
  }

  // --- Despertar ---
  get awakenMax() { return PLAYER.AWAKEN_METER_MAX(this.level); }
  isAwakened() { return this.scene.time.now < this.awakenedUntil; }
  awakenReady() {
    if (!this.awakenUnlocked) return false;
    const now = this.scene.time.now;
    return this.awakenMeter >= this.awakenMax && now >= this.awakenLockUntil && !this.isAwakened();
  }
  addAwakenMeter(amount) {
    if (this.scene.time.now < this.awakenLockUntil) return;
    this.awakenMeter = Math.min(this.awakenMax, this.awakenMeter + amount * this._awakenGainMult);
  }
  tryActivateAwaken() {
    if (!this.awakenReady()) return false;
    const now = this.scene.time.now;
    this.awakenedUntil = now + PLAYER.AWAKEN_DURATION_MS;
    this.awakenMeter = 0;
    this.awakenLockUntil = this.awakenedUntil + PLAYER.AWAKEN_CD_AFTER_MS;
    // Feedback
    this.setTint(0xffd96b);
    this.scene.cameras.main.shake(300, 0.012);
    this.scene.cameras.main.flash(180, 240, 200, 80);
    // O despertar: onda dourada de trovão saindo do herói, anel, vaga-lumes subindo
    const fx = this.scene.fx;
    if (fx) {
      const fy = this.y + this.displayHeight * 0.42;
      fx.thunderRing(this.x, fy, 10, 230, 520, [PAL.white, PAL.yel3, PAL.yel2, PAL.g5], 0.6);
      fx.ring(this.x, fy, 0xffffff, 8, 150, 360, 0.6, 0.9);
      fx.burst('glow', this.x, this.y, 22, -Math.PI / 2, 140, { min: 60, max: 220 });
      fx.burst('ember', this.x, fy, 14, -Math.PI / 2, 120, { min: 80, max: 200 });
      fx.light(this.x, this.y, 320, 0xffe58f, 600, 1);
    }
    this.scene.sound.play('sfx_boss_roar', { volume: 0.55, rate: 1.25 });
    return true;
  }
  _endAwakenedIfNeeded() {
    if (this.awakenedUntil && this.scene.time.now >= this.awakenedUntil && this.awakenedUntil > 0) {
      this.awakenedUntil = -1; // sentinel: já encerrou
      this.clearTint();
    }
  }

  // --- Raízes (controle do boss) ---
  isRooted() { return this.scene.time.now < this._rootedUntil; }
  root(durMs) { this._rootedUntil = this.scene.time.now + durMs; }
  isGrabbed() { return this.scene.time.now < this._grabSlowUntil; }
  grabSlow(durMs) { this._grabSlowUntil = this.scene.time.now + durMs; }

  // --- Forças dos chefes ---
  // Sucção (Bocarra do Mapinguari): somada só neste quadro; andar contra ela vence
  addPull(vx, vy) { this._pullX += vx; this._pullY += vy; }
  // Empurrão (coice, investida): velocidade que cai a zero em ms
  shove(vx, vy, ms = 220) { this._shove = { vx, vy, t0: this.scene.time.now, ms }; }

  // --- Dash ---
  isDashing() { return this.scene.time.now < this.dashUntil; }
  dashReady() { return this.dashUnlocked && this.scene.time.now >= this.dashCdUntil; }
  tryDash(dirX, dirY) {
    if (!this.dashUnlocked) return false;
    if (this.isRooted()) return false; // preso pelas raízes — o dash é pra DESVIAR antes, não quebrar
    if (!this.dashReady()) return false;
    const now = this.scene.time.now;
    let dx = dirX, dy = dirY;
    if (Math.abs(dx) + Math.abs(dy) < 0.05) { dx = this.facingX; dy = 0; }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len; this.dashDirY = dy / len;
    this.dashUntil = now + PLAYER.DASH_DURATION_MS;
    this.dashCdUntil = now + PLAYER.DASH_CD_MS * this._dashCdMult;
    this.invulnUntil = Math.max(this.invulnUntil, now + PLAYER.DASH_INVULN_MS);
    // trilha + SFX whoosh real
    this._dashTrail();
    if (this.heroId === 'guardian') this._backwardTracks();
    this.scene.sound.play('sfx_dash', { volume: 0.5 });
    return true;
  }

  // Curupira: os pés virados para trás deixam pegadas apontando para o lado
  // OPOSTO de onde ele foi (a lenda: quem segue o rastro se perde)
  _backwardTracks() {
    const scene = this.scene;
    const dx = this.dashDirX,
      dy = this.dashDirY;
    const rot = Math.atan2(-dy, -dx) + Math.PI / 2; // dedos para trás
    for (let i = 0; i < 4; i++) {
      scene.time.delayedCall(i * 45, () => {
        const side = i % 2 ? 6 : -6;
        const x = this.x - dy * side,
          y = this.y + this.displayHeight * 0.42 + dx * side;
        const f = scene.add.image(x, y, 'px_foot').setScale(3).setRotation(rot).setAlpha(0.9).setDepth(5);
        scene.tweens.add({ targets: f, alpha: 0, delay: 1400, duration: 900, onComplete: () => f.destroy() });
      });
    }
  }

  // Dash: fantasmas do POOL (antes: 4 sprites criados e destruídos por dash), poeira na
  // arrancada e lufadas de vento correndo no sentido do dash
  _dashTrail() {
    const scene = this.scene;
    const fx = scene.fx;
    const fy = this.y + this.displayHeight * 0.44;
    const back = Math.atan2(-this.dashDirY, -this.dashDirX);
    fx?.burst('smoke', this.x, fy, 5, back, 70, { min: 40, max: 110 });
    fx?.burst('gust', this.x, this.y, 6, back + Math.PI, 30, { min: 260, max: 420 });
    for (let i = 0; i < 4; i++) {
      scene.time.delayedCall(i * 30, () => {
        const g = fx?.ghost(this.texture.key, this.x, this.y, 0, this.scale, i % 2 ? 0x9fdcff : 0xffffff, 230, 0.55 - i * 0.08, this.frame.name);
        g?.img.setFlipX(this.flipX).setDepth(this.depth - 1);
      });
    }
  }

  update(time, dt, input) {
    // Regen passivo (acumula frações de HP por dt)
    if (this.regenPerSec > 0 && this.hp < this.maxHp) {
      this._regenAcc += this.regenPerSec * (dt / 1000);
      if (this._regenAcc >= 1) {
        const amt = Math.floor(this._regenAcc);
        this.hp = Math.min(this.maxHp, this.hp + amt);
        this._regenAcc -= amt;
      }
    }

    // Despertar trigger
    if (input.consumeAwaken()) this.tryActivateAwaken();
    this._endAwakenedIfNeeded();

    // Dash trigger
    if (input.consumeDash()) this.tryDash(input.move.x, input.move.y);

    // Movimento
    let speedMult = 1;
    if (this.isAwakened()) speedMult *= PLAYER.AWAKEN_SPEED_MULT;

    if (this.isDashing()) {
      const sp = this.speed * PLAYER.DASH_SPEED_MULT;
      this.setVelocity(this.dashDirX * sp, this.dashDirY * sp);
    } else if (this.isRooted()) {
      this.setVelocity(0, 0); // preso — devia ter desviado da área com o dash a tempo
      if (input.move.x !== 0) this.facingX = Math.sign(input.move.x);
    } else {
      // Raízes agarrando: anda muito devagar (o dash ignora o slow e te tira a tempo)
      const mv = speedMult * (this.isGrabbed() ? 0.32 : 1);
      const vx = input.move.x * this.speed * mv;
      const vy = input.move.y * this.speed * mv;
      this.setVelocity(vx, vy);
      if (input.move.x !== 0) this.facingX = Math.sign(input.move.x);
    }
    // Forças dos chefes (não valem no Dash nem preso pelas raízes)
    if (!this.isDashing() && !this.isRooted()) {
      let ex = this._pullX,
        ey = this._pullY;
      const sh = this._shove;
      if (sh) {
        const k = 1 - (time - sh.t0) / sh.ms;
        if (k <= 0) this._shove = null;
        else {
          ex += sh.vx * k;
          ey += sh.vy * k;
        }
      }
      if (ex || ey) this.setVelocity(this.body.velocity.x + ex, this.body.velocity.y + ey);
    }
    this._pullX = 0;
    this._pullY = 0;
    this.setFlipX(this.facingX < 0);
    // Anima: dash > golpe > andando > parado (troca só quando muda, pra não reiniciar
    // o ciclo). Ao parar, a respiração começa "assentando" (corpo desce) em vez de
    // estalar para a pose em pé; o passo acompanha a velocidade real.
    const state = this.isDashing() ? 'dash' : time < this._hurtUntil ? 'hurt' : this.isMoving ? 'walk' : 'idle';
    const anim = `${this.heroId}_${state}`;
    if (this.anims.currentAnim?.key !== anim) {
      const wasWalking = this.anims.currentAnim?.key === `${this.heroId}_walk`;
      this.play(state === 'idle' && wasWalking ? { key: anim, startFrame: 1 } : anim);
    }
    const v = this.body.velocity;
    this.anims.timeScale = state === 'walk' ? Phaser.Math.Clamp(Math.hypot(v.x, v.y) / PLAYER.SPEED_BASE, 0.7, 1.6) : 1;

    this.isMoving = Math.abs(input.move.x) + Math.abs(input.move.y) > 0.1;
    if (this.isMoving) {
      this.lastMoveX = input.move.x;
      this.lastMoveY = input.move.y;
    }

    // Armas (cooldown reduzido durante despertar)
    for (const w of this.weapons) w.update(time, dt);

    // Depth-sort por Y (offset +10000 garante sempre acima do floor deco)
    this.setDepth(this.y + this.displayHeight * 0.45 + 10000);
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.46);
    this.light.setPosition(this.x, this.y + this.displayHeight * 0.3);
    const awake = this.isAwakened();
    if (awake !== this.aura.visible) {
      this.aura.setVisible(awake);
      if (awake) this.aura.play('fx_awaken_aura');
      else this.aura.stop();
    }
    if (awake) {
      this.aura.setPosition(this.x, this.y + this.displayHeight * 0.44).setDepth(this.depth - 0.5);
      // fagulhas douradas subindo enquanto desperto
      if (time >= (this._auraSparkAt ?? 0)) {
        this._auraSparkAt = time + 90;
        this.scene.fx?.burst('glow', this.x + (Math.random() - 0.5) * 40, this.y + 10, 1, -Math.PI / 2, 30, { min: 30, max: 80 });
      }
    }
  }

  // Efeito da pisada (pool de 6 imagens; nada é criado por passo)
  _stepFx() {
    const st = this._steps;
    if (!this.visible || !this.scene.cameras.main.worldView.contains(this.x, this.y)) return;
    let o = this._puffs.find((p) => !p.visible);
    if (!o) {
      if (this._puffs.length >= 6) return;
      o = this.scene.add.image(0, 0, 'px_puff').setVisible(false);
      this._puffs.push(o);
    }
    const S = GAME.PIXEL_SCALE;
    const back = -this.facingX * (st.back ? -1 : 1); // para onde a poeira é chutada
    const feet = this.y + this.displayHeight * 0.44;
    const kind = st.kind;
    const big = kind === 'land';
    o.setTexture(kind === 'drop' || kind === 'glint' ? 'px_dot2' : 'px_puff')
      .setTint(kind === 'drop' ? PAL.ice3 : kind === 'glint' ? PAL.yel3 : kind === 'land' ? PAL.wnd2 : PAL.n4)
      .setBlendMode(kind === 'glint' || kind === 'drop' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setPosition(this.x + back * S * (kind === 'dust' ? 3 : 1), feet - (kind === 'glint' || kind === 'drop' ? S * 2 : 0))
      .setScale(kind === 'dust' || big ? S * 0.35 : S * 0.6)
      .setAlpha(big ? 0.5 : 0.38)
      .setDepth(this.depth - 1)
      .setVisible(true);
    const rise = kind === 'glint' || kind === 'drop';
    this.scene.tweens.add({
      targets: o,
      x: o.x + back * S * (rise ? 0 : big ? 4 : 3),
      y: o.y - S * (rise ? 5 : 1.5),
      scale: rise ? S * 0.3 : S * (big ? 0.9 : 0.6),
      alpha: 0,
      duration: rise ? 520 : big ? 380 : 320,
      ease: 'Quad.easeOut',
      onComplete: () => o.setVisible(false),
    });
  }

  // Multiplicador de cooldown final (usado por Weapon.cooldown)
  get effectiveCdMult() {
    return this.cdMult * (this.isAwakened() ? PLAYER.AWAKEN_CD_MULT : 1);
  }

  isDead() { return this.hp <= 0; }
}
