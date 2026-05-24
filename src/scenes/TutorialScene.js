// Tutorial COMO JOGAR — páginas com DEMOS usando as CLASSES REAIS do jogo.
import { COLORS, GAME, PLAYER } from '../config.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemies.js';
import { Projectile, Staff, AuraWeapon, ChainLightning, BoomerangProj } from '../entities/Weapons.js';
import { Pool } from '../systems/Pool.js';
import { ElementalSystem } from '../systems/ElementalSystem.js';

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

    this.events.on('shutdown', () => this._teardownDemoArena());
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
    if (this.pageContainer) {
      if (this._demoTimers) this._demoTimers.forEach(t => t.remove());
      if (this._demoTweens) this._demoTweens.forEach(t => t.stop());
      if (this._demoTickHandler) this.events.off('update', this._demoTickHandler);
      this._teardownDemoArena();
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
  // DEMO ARENA — instancia as classes REAIS do jogo
  // ============================================================
  _setupDemoArena(cx, cy) {
    // World bounds locais (não interferem com nada)
    this.physics.world.setBounds(cx - 1000, cy - 1000, 2000, 2000);

    // Pools (this.scene.enemyPool / projectilePool etc. referenciados pelas armas)
    this.enemyPool = new Pool(() => {
      const e = new Enemy(this, -9999, -9999);
      e.deactivate();
      return e;
    }, 8);
    this.projectilePool = new Pool(() => new Projectile(this), 12);
    this.boomerPool     = new Pool(() => new BoomerangProj(this), 4);
    this.elemental      = new ElementalSystem(this);

    // Player real
    this.player = new Player(this, cx, cy);
    this.player.setDepth(20);
    // Substitui update do player: não lê input, só atualiza armas + depth
    const self = this;
    this.player.update = function(time, dt) {
      // Despertar pode terminar
      if (this.awakenedUntil > 0 && time >= this.awakenedUntil) {
        this.awakenedUntil = -1;
        this.clearTint();
        if (self._awakenGlow) self._awakenGlow.setAlpha(0);
      }
      for (const w of this.weapons) w.update(time, dt);
      this.setDepth(20);
    };

    // Glow opcional pro Despertar (criado quando ativa)
    this._awakenGlow = null;
  }

  _teardownDemoArena() {
    if (!this.player) return;
    // Destrói player + armas
    try { this.player.weapons.forEach(w => { if (w.gfx) w.gfx.destroy(); }); } catch (e) {}
    try { this.player.destroy(); } catch (e) {}
    this.player = null;
    // Limpa pools (destrói todos os objetos)
    [this.enemyPool, this.projectilePool, this.boomerPool].forEach(pool => {
      if (!pool) return;
      pool.available.forEach(o => o.destroy?.());
      pool.inUse.forEach(o => o.destroy?.());
    });
    this.enemyPool = null; this.projectilePool = null; this.boomerPool = null;
    this.elemental = null;
    if (this._awakenGlow) { this._awakenGlow.destroy(); this._awakenGlow = null; }
  }

  // Spawna inimigos que CAMINHAM lentamente até o player (realismo do jogo)
  _spawnDemoEnemies(positions, wave = 0, opts = {}) {
    const { chase = true, speed = 30 } = opts;
    const list = [];
    for (const pos of positions) {
      const e = this.enemyPool.acquire();
      e.activate(pos.x, pos.y, 'wolf', wave);
      if (chase) {
        e.speed = speed; // bem devagar pra demo controlado
        // mantém o update padrão do Enemy (chase player)
      } else {
        e.body.enable = false;
        e.update = () => {};
      }
      list.push(e);
    }
    return list;
  }

  // ⚠ CRÍTICO: AuraWeapon e ChainLightning chamam scene._showDmg ao acertar.
  // Sem este no-op, javascript trava nessa linha e NÃO aplica o status,
  // o que impede as reações de dispararem.
  _showDmg() { /* no-op no tutorial */ }

  // Callback usado por ElementalSystem (Cristal, Sobrecarga, Aura) quando matam
  _onEnemyDeath(enemy) {
    if (!enemy || !enemy.active) return;
    this.tweens.add({
      targets: enemy, alpha: 0, scale: GAME.PIXEL_SCALE * 0.4, duration: 200,
      onComplete: () => {
        enemy.deactivate();
        this.enemyPool.release(enemy);
      },
    });
  }

  // Tick do update: roda PLAYER (aura/auto-fire) + ENEMIES (chase) + projéteis + colisões + elemental
  _runDemoTick(time, dt) {
    if (!this.player || !this.projectilePool) return;
    this.player.update(time, dt);
    // Inimigos chasing
    this.enemyPool.forEachActive(e => {
      if (e.update && typeof e.update === 'function') e.update(time, dt, this.player);
    });
    // Projéteis e colisões
    this.projectilePool.forEachActive(p => {
      p.update(time);
      if (!p.active) { this.projectilePool.release(p); return; }
      this.enemyPool.forEachActive(e => {
        if (!p.active || !e.active) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) {
          e.takeDamage(p.dmg, p.element, p.x, p.y);
          p.kill();
          this.projectilePool.release(p);
          if (e.hp <= 0) this._onEnemyDeath(e);
        }
      });
    });
    this.elemental.tick(time);
  }

  // ============================================================
  // PÁGINA 1 — Movimento (animação simples, sem classes reais)
  // ============================================================
  _pageMovement() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '1 · Movimento e Combate', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    const demoCx = cx, demoCy = 280;
    c.add(this.add.rectangle(demoCx, demoCy, 480, 280, 0x0a1410, 0.85).setStrokeStyle(2, 0xd9b25c, 0.6));
    c.add(this.add.tileSprite(demoCx, demoCy, 460, 260, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.7));

    const hero = this.add.image(demoCx, demoCy, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.5);
    c.add(hero);

    const keysX = cx + 320;
    const keyDefs = [
      { k: 'W', dx: 0,  dy: -1, kx: keysX,      ky: demoCy - 30 },
      { k: 'A', dx: -1, dy: 0,  kx: keysX - 30, ky: demoCy },
      { k: 'S', dx: 0,  dy: 1,  kx: keysX,      ky: demoCy + 30 },
      { k: 'D', dx: 1,  dy: 0,  kx: keysX + 30, ky: demoCy },
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

    const moveRange = 90;
    const seq = ['W', 'D', 'S', 'A'];
    let idx = 0;
    const step = () => {
      const k = seq[idx];
      const def = keyDefs.find(d => d.k === k);
      for (const kk of Object.keys(keyBoxes)) {
        keyBoxes[kk].box.setFillStyle(0x1a2820); keyBoxes[kk].lbl.setColor('#e8f0e6');
      }
      keyBoxes[k].box.setFillStyle(0xffd96b); keyBoxes[k].lbl.setColor('#0a1410');
      if (def.dx !== 0) hero.setFlipX(def.dx < 0);
      this._demoTweens.push(this.tweens.add({
        targets: hero, x: demoCx + def.dx * moveRange, y: demoCy + def.dy * moveRange,
        duration: 600, ease: 'Sine.easeInOut',
        onComplete: () => {
          this._demoTweens.push(this.tweens.add({
            targets: hero, x: demoCx, y: demoCy, duration: 400, ease: 'Sine.easeInOut',
          }));
        },
      }));
      idx = (idx + 1) % seq.length;
    };
    step();
    this._demoTimers.push(this.time.addEvent({ delay: 1200, loop: true, callback: step }));

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
  // PÁGINA 2 — Despertar com PLAYER REAL atacando
  // ============================================================
  _pageAwakenDash() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '2 · Despertar e Dash', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    // DASH demo compacto em cima
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

    // DESPERTAR — usa classes REAIS
    const aY = 360;
    c.add(this.add.rectangle(cx, aY, 800, 240, 0x0a1410, 0.85).setStrokeStyle(2, 0xffd96b, 0.7));
    c.add(this.add.tileSprite(cx, aY, 780, 220, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.45));

    c.add(sharp(this, cx - 380, aY - 105, '★  R · DESPERTAR', {
      fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx - 380, aY - 85, 'Encha o medidor matando. R = berserker 6s (2.5× ataque).', {
      fontFamily: F, fontSize: '12px', color: '#e8f0e6',
    }));

    // Setup demo arena REAL
    const heroX = cx - 280, heroY = aY + 20;
    this._setupDemoArena(heroX, heroY);
    this.player.addWeapon(new Staff(this));

    // Glow para o Despertar
    this._awakenGlow = this.add.circle(heroX, heroY, 32, 0xffd96b, 0).setDepth(19);
    c.add(this._awakenGlow);

    // Tecla R
    const rBox = this.add.rectangle(heroX, heroY - 50, 36, 36, 0x1a2820, 1).setStrokeStyle(2, 0xd9b25c, 0.6);
    const rLbl = sharp(this, heroX, heroY - 50, 'R', { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#e8f0e6' }).setOrigin(0.5);
    c.add(rBox); c.add(rLbl);

    // Bar de Despertar visual
    const barW = 600;
    const barBg = this.add.rectangle(cx, aY + 100, barW, 14, 0x000000, 0.7).setStrokeStyle(1, 0xd9b25c, 0.7);
    const barFill = this.add.rectangle(cx - barW/2 + 2, aY + 100, 0, 10, 0xd9b25c).setOrigin(0, 0.5);
    const barLbl = sharp(this, cx, aY + 100, '', { fontFamily: F, fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
    c.add(barBg); c.add(barFill); c.add(barLbl);

    // Posições — inimigos vêm de longe e caminham até o player
    const enemyPositions = [
      { x: cx + 200, y: aY - 40 }, { x: cx + 260, y: aY + 30 },
      { x: cx + 320, y: aY - 30 }, { x: cx + 280, y: aY + 60 },
    ];
    let currentEnemies = this._spawnDemoEnemies(enemyPositions, 0, { chase: true, speed: 25 });

    // Tick handler
    const tick = (time, dt) => {
      this._runDemoTick(time, dt);

      // Se todos morreram, espera + respawna
      const aliveCount = currentEnemies.filter(e => e.active).length;
      if (aliveCount === 0 && !this._awaitingRespawn) {
        this._awaitingRespawn = true;
        this.time.delayedCall(800, () => {
          currentEnemies = this._spawnDemoEnemies(enemyPositions, 0, { chase: true, speed: 25 });
          this._awaitingRespawn = false;
        });
      }

      // Atualiza barra visual
      const pct = this.player.awakenMeter / this.player.awakenMax;
      barFill.width = (barW - 4) * pct;
      if (this.player.isAwakened()) {
        const remain = Math.max(0, this.player.awakenedUntil - time);
        barFill.fillColor = 0xffe88a;
        barFill.width = (barW - 4) * (remain / PLAYER.AWAKEN_DURATION_MS);
        barLbl.setText(`DESPERTADO  ${(remain / 1000).toFixed(1)}s`).setColor('#ffe88a');
        // glow pulsante
        if (this._awakenGlow) {
          this._awakenGlow.setAlpha(0.45 + Math.sin(time / 100) * 0.2);
          this._awakenGlow.setScale(1 + Math.sin(time / 100) * 0.15);
        }
      } else if (this.player.awakenReady()) {
        barFill.fillColor = 0xffd96b;
        barLbl.setText('PRESSIONE R').setColor('#ffe88a');
      } else {
        barFill.fillColor = 0xd9b25c;
        barLbl.setText('').setColor('#fff');
      }
    };
    this._demoTickHandler = tick;
    this.events.on('update', tick);

    // A cada kill de inimigo, addAwakenMeter já é chamado pelo Player? NÃO!
    // No GameScene é o _onEnemyDeath que faz this.player.addAwakenMeter(...).
    // Vou hookar isso aqui também:
    const origOnDeath = this._onEnemyDeath.bind(this);
    this._onEnemyDeath = (e) => {
      origOnDeath(e);
      if (this.player) this.player.addAwakenMeter(28); // ganho forte pra demo encher rápido
    };

    // Quando bar enche, ativa Despertar + pisca R
    const checkAwaken = () => {
      if (this.player && this.player.awakenReady()) {
        this.player.tryActivateAwaken();
        rBox.setFillStyle(0xffd96b); rLbl.setColor('#0a1410');
        this.time.delayedCall(400, () => { rBox.setFillStyle(0x1a2820); rLbl.setColor('#e8f0e6'); });
        // Texto flutuante
        const txt = sharp(this, heroX, heroY - 80, '★ DESPERTAR ★', {
          fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#ffd96b',
          stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);
        c.add(txt);
        this.tweens.add({ targets: txt, y: heroY - 110, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
      }
    };
    this._demoTimers.push(this.time.addEvent({ delay: 200, loop: true, callback: checkAwaken }));
  }

  // ============================================================
  // PÁGINA 3 — Reações com ARMAS REAIS (Staff + Aura + Chain)
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

    const ax = cx, ay = 340;
    const arenaBorder = this.add.rectangle(ax, ay, 820, 320, 0x0a1410, 0.88).setStrokeStyle(3, 0xd9b25c, 0.7);
    c.add(arenaBorder);
    c.add(this.add.tileSprite(ax, ay, 800, 300, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.5));

    const reactionLbl = sharp(this, ax, ay - 130, '', {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#ffd96b',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    c.add(reactionLbl);
    const reactionDesc = sharp(this, ax, ay - 108, '', {
      fontFamily: F, fontSize: '12px', color: '#e8f0e6',
    }).setOrigin(0.5);
    c.add(reactionDesc);

    // Setup demo arena REAL com player
    const heroX = ax - 200, heroY = ay + 20;
    this._setupDemoArena(heroX, heroY);

    // Posições — DENTRO do raio da Aura (110px) pra reações dispararem
    // imediatamente. Distâncias do player: ~65-100px.
    const enemyPositions = [
      { x: heroX + 60,  y: ay - 50 },
      { x: heroX + 95,  y: ay + 35 },
      { x: heroX + 75,  y: ay - 25 },
      { x: heroX + 85,  y: ay + 65 },
    ];

    // Helper: troca as armas do player
    const setWeapons = (weaponClasses) => {
      // Remove armas atuais (e seus gfx)
      for (const w of this.player.weapons) {
        if (w.gfx) w.gfx.destroy();
      }
      this.player.weapons = [];
      // Adiciona novas
      for (const WClass of weaponClasses) {
        this.player.addWeapon(new WClass(this));
      }
    };

    // Helper: dispara as armas em sequência manualmente
    const fireWeapon = (idx) => {
      const w = this.player.weapons[idx];
      if (!w) return;
      // Força disparo ignorando cooldown
      w.lastFireAt = 0;
      w._fire(this.time.now);
    };

    // Ciclo de demos — armas auto-disparam na cooldown delas (igual jogo real)
    const demos = [
      () => {
        reactionLbl.setText('Cajado 🔥  +  Aura ❄️  =  VAPOR').setColor('#9ad4ff');
        reactionDesc.setText('Cajado dispara projétil · Aura é círculo persistente ao redor do player');
        arenaBorder.setStrokeStyle(3, 0x9ad4ff, 0.8);
        setWeapons([Staff, AuraWeapon]);
        this._spawnDemoEnemies(enemyPositions, 0, { chase: false });
      },
      () => {
        reactionLbl.setText('Aura ❄️  +  Raio ⚡  =  CRISTAL').setColor('#5cc8ff');
        reactionDesc.setText('Aura ao redor + Raio Encadeado salta entre inimigos');
        arenaBorder.setStrokeStyle(3, 0x5cc8ff, 0.8);
        setWeapons([AuraWeapon, ChainLightning]);
        this._spawnDemoEnemies(enemyPositions, 0, { chase: false });
      },
      () => {
        reactionLbl.setText('Cajado 🔥  +  Raio ⚡  =  SOBRECARGA').setColor('#d98cff');
        reactionDesc.setText('Cajado dispara · Raio Encadeado adiciona o segundo elemento');
        arenaBorder.setStrokeStyle(3, 0xd98cff, 0.8);
        setWeapons([Staff, ChainLightning]);
        this._spawnDemoEnemies(enemyPositions, 0, { chase: false });
      },
    ];

    let demoIdx = 0;
    const runNext = () => {
      this.enemyPool.forEachActive(e => {
        e.deactivate();
        this.enemyPool.release(e);
      });
      demos[demoIdx]();
      demoIdx = (demoIdx + 1) % demos.length;
    };
    runNext();
    this._demoTimers.push(this.time.addEvent({ delay: 5500, loop: true, callback: runNext }));

    // Tick handler real
    this._demoTickHandler = (time, dt) => this._runDemoTick(time, dt);
    this.events.on('update', this._demoTickHandler);
  }

  // ============================================================
  // PÁGINA 4 — Baús
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

  // Phaser chama isso automaticamente
  _drawBolt() { /* não usado mais */ }
}
