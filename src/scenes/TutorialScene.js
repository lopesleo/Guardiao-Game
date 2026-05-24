// Tutorial COMO JOGAR — páginas com DEMOS animados reais (não mockups).
import { COLORS, GAME } from '../config.js';

const F = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class TutorialScene extends Phaser.Scene {
  constructor() { super('TutorialScene'); }

  create() {
    this.W = GAME.WIDTH; this.H = GAME.HEIGHT;
    this.cx = this.W / 2;
    this.cameras.main.setBackgroundColor(0x0a1410);

    const grad = this.add.graphics();
    grad.fillStyle(0x152820, 1); grad.fillRect(0, 0, this.W, this.H);
    grad.fillStyle(0x000000, 0.5); grad.fillRect(0, this.H * 0.6, this.W, this.H * 0.4);

    sharp(this, this.cx, 36, 'COMO JOGAR', {
      fontFamily: F, fontSize: '32px', fontStyle: 'bold', color: '#d9b25c',
    }).setOrigin(0.5);

    this.pageIdx = 0;
    this.pages = [
      this._pageMovement.bind(this),
      this._pageAwakenDash.bind(this),
      this._pageReactions.bind(this),
      this._pageChests.bind(this),
      this._pageMeta.bind(this),
    ];
    this._renderPage();

    this.prevBtn = this._navButton(120, this.H - 50, '< ANTERIOR', () => this._goto(this.pageIdx - 1));
    this.nextBtn = this._navButton(this.W - 120, this.H - 50, 'PRÓXIMO >', () => this._goto(this.pageIdx + 1));
    this._navButton(this.cx, this.H - 50, 'VOLTAR AO MENU', () => this.scene.start('MenuScene'));
    this.pageDots = this.add.container(this.cx, this.H - 90);
    this._updateNav();

    this.input.keyboard.on('keydown-LEFT',  () => this._goto(this.pageIdx - 1));
    this.input.keyboard.on('keydown-RIGHT', () => this._goto(this.pageIdx + 1));
    this.input.keyboard.on('keydown-ESC',   () => this.scene.start('MenuScene'));
  }

  _goto(i) {
    if (i < 0 || i >= this.pages.length) return;
    this.pageIdx = i;
    this._renderPage();
    this._updateNav();
    this.sound.play('sfx_ui_click', { volume: 0.3 });
  }

  _updateNav() {
    this.prevBtn.bg.setVisible(this.pageIdx > 0);
    this.prevBtn.txt.setVisible(this.pageIdx > 0);
    this.nextBtn.bg.setVisible(this.pageIdx < this.pages.length - 1);
    this.nextBtn.txt.setVisible(this.pageIdx < this.pages.length - 1);

    this.pageDots.removeAll(true);
    const dotGap = 20;
    const startX = -(this.pages.length - 1) * dotGap / 2;
    for (let i = 0; i < this.pages.length; i++) {
      const dot = this.add.circle(startX + i * dotGap, 0, i === this.pageIdx ? 6 : 4,
        i === this.pageIdx ? 0xd9b25c : 0x4a5a4a);
      this.pageDots.add(dot);
    }
  }

  _renderPage() {
    // Cleanup
    if (this.pageContainer) {
      if (this._demoTimers) this._demoTimers.forEach(t => t.remove());
      if (this._demoTweens) this._demoTweens.forEach(t => t.stop());
      if (this._demoTickHandler) this.events.off('update', this._demoTickHandler);
      this.pageContainer.destroy(true);
    }
    this._demoTimers = [];
    this._demoTweens = [];
    this._demoTickHandler = null;
    this.pageContainer = this.add.container(0, 0);
    this.pages[this.pageIdx]();
  }

  _navButton(x, y, label, onClick) {
    const w = 180, h = 44;
    const bg = this.add.rectangle(x, y, w, h, 0x0a1410, 0.95)
                    .setStrokeStyle(2, 0xd9b25c, 0.8).setInteractive({ useHandCursor: true });
    const txt = sharp(this, x, y, label, {
      fontFamily: F, fontSize: '15px', fontStyle: 'bold', color: '#e8f0e6',
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setFillStyle(0x1a3a20); this.sound.play('sfx_ui_hover', { volume: 0.2 }); });
    bg.on('pointerout',  () => bg.setFillStyle(0x0a1410));
    bg.on('pointerdown', () => { this.sound.play('sfx_ui_click', { volume: 0.4 }); onClick(); });
    return { bg, txt };
  }

  // ============================================================
  // PÁGINA 1 — WASD movimento real (sprite anda em quadrado)
  // ============================================================
  _pageMovement() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '1 · Movimento e Combate', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    // Arena de demo (retângulo bordado)
    const demoCx = cx, demoCy = 280;
    c.add(this.add.rectangle(demoCx, demoCy, 480, 280, 0x0a1410, 0.85).setStrokeStyle(2, 0xd9b25c, 0.6));
    // Grama dentro
    c.add(this.add.tileSprite(demoCx, demoCy, 460, 260, 'town_tiles', 0).setOrigin(0.5).setScale(1).setAlpha(0.7));

    // Player sprite
    const hero = this.add.image(demoCx, demoCy, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.5);
    c.add(hero);

    // Keys WASD na direita do demo
    const keysX = cx + 320;
    const keyDefs = [
      { k: 'W', dx: 0,   dy: -1, kx: keysX,      ky: demoCy - 30 },
      { k: 'A', dx: -1,  dy: 0,  kx: keysX - 30, ky: demoCy },
      { k: 'S', dx: 0,   dy: 1,  kx: keysX,      ky: demoCy + 30 },
      { k: 'D', dx: 1,   dy: 0,  kx: keysX + 30, ky: demoCy },
    ];
    const keyBoxes = {};
    for (const def of keyDefs) {
      const box = this.add.rectangle(def.kx, def.ky, 36, 36, 0x1a2820, 1).setStrokeStyle(2, 0xd9b25c, 0.6);
      const lbl = sharp(this, def.kx, def.ky, def.k, {
        fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#e8f0e6',
      }).setOrigin(0.5);
      c.add(box); c.add(lbl);
      keyBoxes[def.k] = { box, lbl };
    }

    // Animação: percorre WASD em loop, hero anda na arena
    const moveRange = 90;
    const seq = ['W', 'D', 'S', 'A'];
    let idx = 0;
    const step = () => {
      const k = seq[idx];
      const def = keyDefs.find(d => d.k === k);
      // Highlight key
      for (const kk of Object.keys(keyBoxes)) {
        keyBoxes[kk].box.setFillStyle(0x1a2820); keyBoxes[kk].lbl.setColor('#e8f0e6');
      }
      keyBoxes[k].box.setFillStyle(0xffd96b); keyBoxes[k].lbl.setColor('#0a1410');
      // Move hero
      if (def.dx !== 0) hero.setFlipX(def.dx < 0);
      this._demoTweens.push(this.tweens.add({
        targets: hero,
        x: demoCx + def.dx * moveRange,
        y: demoCy + def.dy * moveRange,
        duration: 600, ease: 'Sine.easeInOut',
        onComplete: () => {
          this._demoTweens.push(this.tweens.add({
            targets: hero,
            x: demoCx, y: demoCy,
            duration: 400, ease: 'Sine.easeInOut',
          }));
        },
      }));
      idx = (idx + 1) % seq.length;
    };
    step();
    this._demoTimers.push(this.time.addEvent({ delay: 1200, loop: true, callback: step }));

    // Texto explicativo abaixo
    c.add(sharp(this, cx, 440,
      'WASD ou setas para mover. Ataque é AUTOMÁTICO no inimigo mais próximo.',
      { fontFamily: F, fontSize: '15px', color: '#e8f0e6', align: 'center', wordWrap: { width: 800 } }
    ).setOrigin(0.5));
    c.add(sharp(this, cx, 475,
      'Mate inimigos para ganhar XP — cada level oferece 3 cartas de upgrade.',
      { fontFamily: F, fontSize: '13px', color: '#93a89a', align: 'center', wordWrap: { width: 800 } }
    ).setOrigin(0.5));
  }

  // ============================================================
  // PÁGINA 2 — Despertar (player atacando + berserker) + Dash
  // ============================================================
  _pageAwakenDash() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '2 · Despertar e Dash', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    // ===== DASH DEMO (faixa superior) =====
    const dashY = 160;
    c.add(this.add.rectangle(cx, dashY, 800, 95, 0x0a1410, 0.85).setStrokeStyle(2, 0xd9b25c, 0.6));
    c.add(this.add.tileSprite(cx - 220, dashY, 360, 75, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.45));
    c.add(sharp(this, cx + 30, dashY - 22, '⚡ SHIFT · DASH', {
      fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx + 30, dashY + 2, 'Esquiva 280ms invul · CD 4s', { fontFamily: F, fontSize: '12px', color: '#e8f0e6' }));
    c.add(sharp(this, cx + 30, dashY + 22, 'Use SHIFT ou SPACE', { fontFamily: F, fontSize: '11px', color: '#93a89a' }));

    const dashHero = this.add.image(cx - 360, dashY, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.3);
    c.add(dashHero);
    const shiftBox = this.add.rectangle(cx - 220, dashY - 28, 70, 24, 0x1a2820, 1).setStrokeStyle(2, 0xd9b25c, 0.6);
    const shiftLbl = sharp(this, cx - 220, dashY - 28, 'SHIFT', { fontFamily: F, fontSize: '12px', fontStyle: 'bold', color: '#e8f0e6' }).setOrigin(0.5);
    c.add(shiftBox); c.add(shiftLbl);

    const dashStep = () => {
      shiftBox.setFillStyle(0xffd96b); shiftLbl.setColor('#0a1410');
      this.time.delayedCall(150, () => { shiftBox.setFillStyle(0x1a2820); shiftLbl.setColor('#e8f0e6'); });
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 35, () => {
          const ghost = this.add.image(dashHero.x, dashHero.y, 'dungeon_tiles', 84)
                            .setScale(GAME.PIXEL_SCALE * 1.3).setAlpha(0.5);
          c.add(ghost);
          this.tweens.add({ targets: ghost, alpha: 0, duration: 250, onComplete: () => ghost.destroy() });
        });
      }
      this._demoTweens.push(this.tweens.add({
        targets: dashHero, x: cx - 100, duration: 180, ease: 'Cubic.easeOut',
        onComplete: () => this.time.delayedCall(800, () => { dashHero.x = cx - 360; }),
      }));
    };
    dashStep();
    this._demoTimers.push(this.time.addEvent({ delay: 2200, loop: true, callback: dashStep }));

    // ===== DESPERTAR DEMO REAL (faixa principal) =====
    const aY = 360;
    c.add(this.add.rectangle(cx, aY, 800, 240, 0x0a1410, 0.85).setStrokeStyle(2, 0xffd96b, 0.7));
    c.add(this.add.tileSprite(cx, aY, 780, 220, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.45));

    c.add(sharp(this, cx - 380, aY - 105, '★  R · DESPERTAR', {
      fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx - 380, aY - 85, 'Encha o medidor matando. R = berserker 6s (2.5× ataque).', {
      fontFamily: F, fontSize: '12px', color: '#e8f0e6',
    }));

    // Player na esquerda
    const heroX = cx - 280, heroY = aY + 20;
    const hero = this.add.image(heroX, heroY, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.4);
    const heroGlow = this.add.circle(heroX, heroY, 32, 0xffd96b, 0).setDepth(hero.depth - 1);
    c.add(heroGlow); c.add(hero);

    // Tecla R
    const rBox = this.add.rectangle(heroX, heroY - 50, 36, 36, 0x1a2820, 1).setStrokeStyle(2, 0xd9b25c, 0.6);
    const rLbl = sharp(this, heroX, heroY - 50, 'R', { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#e8f0e6' }).setOrigin(0.5);
    c.add(rBox); c.add(rLbl);

    // Bar de Despertar abaixo da arena
    const barW = 600;
    const barBg = this.add.rectangle(cx, aY + 100, barW, 14, 0x000000, 0.7).setStrokeStyle(1, 0xd9b25c, 0.7);
    const barFill = this.add.rectangle(cx - barW/2 + 2, aY + 100, 0, 10, 0xd9b25c).setOrigin(0, 0.5);
    const barLbl = sharp(this, cx, aY + 100, '', { fontFamily: F, fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
    c.add(barBg); c.add(barFill); c.add(barLbl);

    // Estado do demo
    const state = { meter: 0, awakening: false, awakenUntil: 0, attackCd: 800, lastAttack: 0, enemies: [] };

    const respawnEnemies = () => {
      // limpa
      state.enemies.forEach(e => e.sprite?.destroy());
      state.enemies = [];
      for (let i = 0; i < 4; i++) {
        const ex = cx + 60 + (i % 2) * 80;
        const ey = aY - 30 + Math.floor(i / 2) * 60;
        const sp = this.add.image(ex + 100, ey, 'creatures', 139).setScale(GAME.PIXEL_SCALE * 1.0).setAlpha(0);
        c.add(sp);
        this.tweens.add({ targets: sp, x: ex, alpha: 1, duration: 350, delay: i * 60 });
        // bobbing
        const tw = this.tweens.add({ targets: sp, y: ey - 4, duration: 700 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this._demoTweens.push(tw);
        state.enemies.push({ sprite: sp, hp: 2 });
      }
    };
    respawnEnemies();

    // Função: player ataca o inimigo vivo mais próximo
    const attackNearest = () => {
      const alive = state.enemies.filter(e => e.hp > 0 && e.sprite.active);
      if (alive.length === 0) {
        // todos mortos → respawna
        this.time.delayedCall(400, () => respawnEnemies());
        return;
      }
      const t = alive[0];
      // pequeno projétil laranja
      const p = this.add.circle(heroX, heroY, 6, 0xff7a3c, 1).setStrokeStyle(2, 0xffe6b8, 1);
      c.add(p);
      this.tweens.add({
        targets: p, x: t.sprite.x, y: t.sprite.y, duration: 220, ease: 'Linear',
        onComplete: () => {
          p.destroy();
          t.hp -= 1;
          // hit flash
          t.sprite.setTintFill(0xffffff);
          this.time.delayedCall(60, () => t.sprite.active && t.sprite.clearTint());
          if (t.hp <= 0) {
            // morre
            this.tweens.add({ targets: t.sprite, alpha: 0, scale: GAME.PIXEL_SCALE * 0.4, duration: 180,
              onComplete: () => t.sprite.destroy() });
            // enche medidor
            state.meter = Math.min(100, state.meter + 28);
          }
        },
      });
    };

    // Tick de update do demo (usa scene events update event)
    const tickHandler = () => {
      const now = this.time.now;
      if (now - state.lastAttack >= state.attackCd) {
        state.lastAttack = now;
        attackNearest();
      }
      if (state.awakening) {
        if (now >= state.awakenUntil) {
          // termina despertar
          state.awakening = false;
          state.attackCd = 800;
          state.meter = 0;
          hero.clearTint();
          heroGlow.setFillStyle(0xffd96b, 0);
        }
      } else if (state.meter >= 100) {
        // ativa despertar
        state.awakening = true;
        state.attackCd = 280;
        state.awakenUntil = now + 3000;
        hero.setTint(0xffd96b);
        heroGlow.setFillStyle(0xffd96b, 0.45);
        // pisca R
        rBox.setFillStyle(0xffd96b); rLbl.setColor('#0a1410');
        this.time.delayedCall(400, () => { rBox.setFillStyle(0x1a2820); rLbl.setColor('#e8f0e6'); });
        // flash e shake
        this.cameras.main.shake(150, 0.005);
        // texto DESPERTAR
        const txt = sharp(this, heroX, heroY - 80, '★ DESPERTAR ★', {
          fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#ffd96b',
          stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);
        c.add(txt);
        this.tweens.add({ targets: txt, y: heroY - 110, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
      }
      // atualiza bar
      const pct = Math.max(0, Math.min(1, state.meter / 100));
      barFill.width = (barW - 4) * pct;
      if (state.awakening) {
        const remain = Math.max(0, state.awakenUntil - now);
        barFill.fillColor = 0xffe88a;
        barFill.width = (barW - 4) * (remain / 3000);
        barLbl.setText(`DESPERTADO  ${(remain / 1000).toFixed(1)}s`).setColor('#ffe88a');
      } else if (state.meter >= 100) {
        barFill.fillColor = 0xffd96b;
        barLbl.setText('PRESSIONE R').setColor('#ffe88a');
      } else {
        barFill.fillColor = 0xd9b25c;
        barLbl.setText('').setColor('#fff');
      }
      // pulsa glow se acordado
      if (state.awakening) {
        const s = 1 + Math.sin(now / 100) * 0.2;
        heroGlow.setScale(s);
      } else {
        heroGlow.setScale(1);
      }
    };

    this._demoTickHandler = tickHandler;
    this.events.on('update', tickHandler);
  }

  // ============================================================
  // PÁGINA 3 — TODAS as reações em ciclo (Vapor → Cristal → Sobrecarga)
  // ============================================================
  _pageReactions() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '3 · Reações Elementais ★', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));
    c.add(sharp(this, cx, 128,
      '2 elementos diferentes no mesmo inimigo = REAÇÃO automática',
      { fontFamily: F, fontSize: '13px', color: '#e8f0e6', align: 'center' }
    ).setOrigin(0.5));

    // ARENA principal
    const ax = cx, ay = 340;
    const arenaBorder = this.add.rectangle(ax, ay, 820, 320, 0x0a1410, 0.88).setStrokeStyle(3, 0xd9b25c, 0.7);
    c.add(arenaBorder);
    c.add(this.add.tileSprite(ax, ay, 800, 300, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.5));

    // Label da reação atual (topo da arena)
    const reactionLbl = sharp(this, ax, ay - 130, '', {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#ffd96b',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    c.add(reactionLbl);
    const reactionDesc = sharp(this, ax, ay - 108, '', {
      fontFamily: F, fontSize: '12px', color: '#e8f0e6',
    }).setOrigin(0.5);
    c.add(reactionDesc);

    // Player na esquerda
    const heroX = ax - 320, heroY = ay + 20;
    const hero = this.add.image(heroX, heroY, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.3);
    c.add(hero);

    // Helpers
    const elemColors = { fire: 0xff7a3c, ice: 0x5cc8ff, bolt: 0xd98cff };
    const elemTints  = { fire: 0xff9966, ice: 0x9ad4ff, bolt: 0xd8a8ff };

    const spawnEnemies = (count) => {
      const list = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI - Math.PI / 2;
        const ex = ax + 60 + Math.cos(angle) * 80;
        const ey = ay + Math.sin(angle) * 60;
        const sp = this.add.image(ex + 150, ey, 'creatures', 139).setScale(GAME.PIXEL_SCALE * 1.1).setAlpha(0);
        c.add(sp);
        this.tweens.add({ targets: sp, x: ex, alpha: 1, duration: 350, delay: i * 60 });
        list.push(sp);
      }
      return list;
    };

    const shootAtAll = (enemies, color, onAllHit) => {
      let hits = 0;
      enemies.forEach((e, i) => {
        this.time.delayedCall(i * 80, () => {
          const p = this.add.circle(heroX, heroY, 7, color, 1).setStrokeStyle(2, 0xffe6b8, 0.8);
          c.add(p);
          this.tweens.add({
            targets: p, x: e.x, y: e.y, duration: 220, ease: 'Linear',
            onComplete: () => {
              p.destroy();
              hits++;
              if (hits === enemies.length && onAllHit) onAllHit();
            },
          });
        });
      });
    };

    const reactionText = (x, y, label, color) => {
      const t = sharp(this, x, y - 40, label, {
        fontFamily: F, fontSize: '22px', fontStyle: 'bold', color,
        stroke: '#000', strokeThickness: 5,
      }).setOrigin(0.5);
      c.add(t);
      this.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
    };

    const killEnemies = (enemies) => {
      enemies.forEach((e, i) => {
        this.time.delayedCall(i * 70, () => {
          if (!e.active) return;
          this.tweens.add({ targets: e, alpha: 0, scale: GAME.PIXEL_SCALE * 0.4, duration: 220,
            onComplete: () => e.destroy() });
        });
      });
    };

    // ===== Ciclo de demos =====
    const demos = [
      // VAPOR (fire + ice)
      () => {
        reactionLbl.setText('🔥 + ❄️  =  VAPOR').setColor('#9ad4ff');
        reactionDesc.setText('Nuvem que lentifica área 3s (sem dano direto)');
        arenaBorder.setStrokeStyle(3, 0x9ad4ff, 0.8);
        const enemies = spawnEnemies(4);
        this.time.delayedCall(600, () => {
          shootAtAll(enemies, elemColors.fire, () => {
            enemies.forEach(e => e.setTint(elemTints.fire));
          });
        });
        this.time.delayedCall(1400, () => {
          shootAtAll(enemies, elemColors.ice, () => {
            // VAPOR: nuvem azul-clara expandindo
            const center = enemies[Math.floor(enemies.length / 2)];
            const cloud = this.add.circle(center.x, center.y, 30, 0xb8d4ff, 0.5).setDepth(50);
            c.add(cloud);
            this.tweens.add({ targets: cloud, radius: 120, alpha: 0, duration: 1500, onComplete: () => cloud.destroy() });
            reactionText(center.x, center.y, 'VAPOR!', '#b8d4ff');
            this.sound.play('sfx_hit', { volume: 0.35, rate: 0.6, detune: -600 });
            // inimigos ficam azul-claros (efeito de lentidão visual)
            enemies.forEach(e => e.setTint(0x9ad4ff));
            // tween de wobble lento
            enemies.forEach((e, i) => {
              this.tweens.add({ targets: e, scaleX: GAME.PIXEL_SCALE * 0.95, scaleY: GAME.PIXEL_SCALE * 1.1,
                                duration: 600, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
            });
            this.time.delayedCall(1800, () => killEnemies(enemies));
          });
        });
      },
      // CRISTAL (ice + bolt)
      () => {
        reactionLbl.setText('❄️ + ⚡  =  CRISTAL ESTILHAÇADO').setColor('#5cc8ff');
        reactionDesc.setText('Explosão em anel + congela inimigos 1s');
        arenaBorder.setStrokeStyle(3, 0x5cc8ff, 0.8);
        const enemies = spawnEnemies(4);
        this.time.delayedCall(600, () => {
          shootAtAll(enemies, elemColors.ice, () => enemies.forEach(e => e.setTint(elemTints.ice)));
        });
        this.time.delayedCall(1400, () => {
          shootAtAll(enemies, elemColors.bolt, () => {
            const center = enemies[Math.floor(enemies.length / 2)];
            // anel expansivo
            const ring = this.add.circle(center.x, center.y, 8, 0x5cc8ff, 0).setStrokeStyle(5, 0x5cc8ff, 1).setDepth(60);
            c.add(ring);
            this.tweens.add({ targets: ring, radius: 130, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
            reactionText(center.x, center.y, 'CRISTAL!', '#5cc8ff');
            this.sound.play('sfx_pickup', { volume: 0.5, rate: 1.6, detune: 400 });
            // congelados = tint azul forte + paradinhos
            enemies.forEach(e => { e.setTint(0x4a9eff); this.tweens.killTweensOf(e); });
            this.cameras.main.shake(120, 0.006);
            this.time.delayedCall(1500, () => killEnemies(enemies));
          });
        });
      },
      // SOBRECARGA (fire + bolt)
      () => {
        reactionLbl.setText('🔥 + ⚡  =  SOBRECARGA').setColor('#d98cff');
        reactionDesc.setText('Corrente elétrica salta entre 4 inimigos');
        arenaBorder.setStrokeStyle(3, 0xd98cff, 0.8);
        const enemies = spawnEnemies(4);
        this.time.delayedCall(600, () => {
          shootAtAll(enemies, elemColors.fire, () => enemies.forEach(e => e.setTint(elemTints.fire)));
        });
        this.time.delayedCall(1400, () => {
          shootAtAll(enemies, elemColors.bolt, () => {
            // SOBRECARGA: bolts entre inimigos em sequência
            for (let i = 0; i < enemies.length - 1; i++) {
              this.time.delayedCall(i * 100, () => {
                this._drawBolt(enemies[i].x, enemies[i].y, enemies[i + 1].x, enemies[i + 1].y, 0xd98cff);
                if (enemies[i + 1].active) {
                  enemies[i + 1].setTintFill(0xffffff);
                  this.time.delayedCall(80, () => enemies[i + 1].active && enemies[i + 1].clearTint());
                }
              });
            }
            reactionText(enemies[Math.floor(enemies.length / 2)].x, enemies[0].y, 'SOBRECARGA!', '#d98cff');
            this.sound.play('sfx_levelup', { volume: 0.35, rate: 1.4, detune: 300 });
            this.cameras.main.shake(150, 0.007);
            this.time.delayedCall(900, () => killEnemies(enemies));
          });
        });
      },
    ];

    let demoIdx = 0;
    const runNext = () => {
      demos[demoIdx]();
      demoIdx = (demoIdx + 1) % demos.length;
    };
    runNext();
    this._demoTimers.push(this.time.addEvent({ delay: 4500, loop: true, callback: runNext }));
  }

  _shootProjectile(fromX, fromY, toX, toY, color, onHit) {
    const p = this.add.circle(fromX, fromY, 8, color, 1).setStrokeStyle(2, 0xffffff, 0.7);
    this.pageContainer.add(p);
    this.tweens.add({
      targets: p, x: toX, y: toY, duration: 250, ease: 'Linear',
      onComplete: () => {
        p.destroy();
        if (onHit) onHit();
      },
    });
  }

  _drawBolt(x1, y1, x2, y2, color) {
    const g = this.add.graphics();
    this.pageContainer.add(g);
    g.lineStyle(3, color, 1);
    const segs = 6;
    g.beginPath(); g.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      g.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * 12,
               y1 + (y2 - y1) * t + (Math.random() - 0.5) * 12);
    }
    g.lineTo(x2, y2); g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
  }

  // ============================================================
  // PÁGINA 4 — Baús com 4 tipos
  // ============================================================
  _pageChests() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '4 · Baús e Mímico', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));
    c.add(sharp(this, cx, 130,
      'Encoste no baú e aperte [E] para abrir. 4 tipos possíveis:',
      { fontFamily: F, fontSize: '14px', color: '#e8f0e6', align: 'center' }
    ).setOrigin(0.5));

    const types = [
      { x: cx - 360, frame: 89, color: '#6fcf6f', label: 'NORMAL',  desc: 'Gemas + moedas + chance coração/orbe',  pct: '75%' },
      { x: cx - 120, frame: 91, color: '#ffd96b', label: 'DOURADO', desc: '+30 moedas + carta grátis (jackpot!)',  pct: '6%'  },
      { x: cx + 120, frame: 89, color: '#ff8898', label: 'TRAP',    desc: '4 elites (2× HP, 1.4× tamanho)',         pct: '12%' },
      { x: cx + 360, frame: 92, color: '#ff3333', label: 'MÍMICO',  desc: '1 super elite (4× HP, 1.7×, 2× dano)',   pct: '7%'  },
    ];
    for (const t of types) {
      const sp = this.add.image(t.x, 230, 'dungeon_tiles', t.frame).setScale(GAME.PIXEL_SCALE * 1.8);
      c.add(sp);
      const tw = this.tweens.add({ targets: sp, y: 222, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this._demoTweens.push(tw);
      c.add(sharp(this, t.x, 290, t.label, { fontFamily: F, fontSize: '15px', fontStyle: 'bold', color: t.color }).setOrigin(0.5));
      c.add(sharp(this, t.x, 312, t.pct,   { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0.5));
      c.add(sharp(this, t.x, 340, t.desc,  { fontFamily: F, fontSize: '11px', color: '#e8f0e6', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0));
    }

    // Demo abrindo um baú (mímico)
    c.add(sharp(this, cx, 440, '⚠  Mímico vira sprite com língua e libera 1 monstro super forte.',
      { fontFamily: F, fontSize: '13px', color: '#ff8898', align: 'center' }).setOrigin(0.5));
    c.add(sharp(this, cx, 465, 'Bônus: tocar baú DOURADO = 8-bit win jingle.',
      { fontFamily: F, fontSize: '12px', color: '#ffd96b', align: 'center' }).setOrigin(0.5));
  }

  // ============================================================
  // PÁGINA 5 — Meta
  // ============================================================
  _pageMeta() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '5 · Progressão Entre Runs', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    const sections = [
      { y: 170, icon: '💰', title: 'MOEDAS', text: 'Inimigos dropam 5%. Boss dá 50 bônus. Acumulam entre runs.' },
      { y: 260, icon: '🔓', title: 'DESBLOQUEAR ARMAS', text: 'Gaste moedas para liberar Bumerangue, Raio Encadeado e Aura Gélida.' },
      { y: 350, icon: '✨', title: 'BÊNÇÃOS', text: 'Buffs PERMANENTES em TODA run: +HP, +velocidade, +dano, regen, crítico…' },
      { y: 440, icon: '🏆', title: 'BOSS AOS 7:00', text: 'O ANCIÃO desperta. 2 fases, invoca aliados. Vença para 50 moedas.' },
    ];
    for (const s of sections) {
      c.add(this.add.rectangle(cx, s.y, 820, 72, 0x0a1410, 0.7).setStrokeStyle(2, 0xd9b25c, 0.5));
      c.add(sharp(this, cx - 390, s.y, s.icon, { fontFamily: F, fontSize: '32px' }).setOrigin(0, 0.5));
      c.add(sharp(this, cx - 340, s.y - 12, s.title, { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#ffd96b' }).setOrigin(0, 0.5));
      c.add(sharp(this, cx - 340, s.y + 14, s.text, { fontFamily: F, fontSize: '12px', color: '#e8f0e6', wordWrap: { width: 740 } }).setOrigin(0, 0.5));
    }

    c.add(sharp(this, cx, 530, 'Boa caçada, Guardião!',
      { fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#6fcf6f', align: 'center' }
    ).setOrigin(0.5));
  }
}
