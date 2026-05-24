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
      this.pageContainer.destroy(true);
    }
    this._demoTimers = [];
    this._demoTweens = [];
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
  // PÁGINA 2 — Despertar + DASH com demo animado
  // ============================================================
  _pageAwakenDash() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '2 · Despertar e Dash', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    // ===== DESPERTAR (barra enchendo) =====
    c.add(this.add.rectangle(cx, 175, 800, 90, 0x0a1410, 0.85).setStrokeStyle(2, 0xd9b25c, 0.6));
    c.add(sharp(this, cx - 380, 150, '★  R · DESPERTAR', {
      fontFamily: F, fontSize: '17px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx - 380, 178,
      'Enche matando inimigos e disparando reações. Cheio → R = berserker 6s.',
      { fontFamily: F, fontSize: '13px', color: '#e8f0e6', wordWrap: { width: 760 } }
    ));
    const awBg = this.add.rectangle(cx, 210, 600, 18, 0x000000, 0.6).setStrokeStyle(1, 0xd9b25c, 0.7);
    const awFill = this.add.rectangle(cx - 298, 210, 0, 12, 0xd9b25c).setOrigin(0, 0.5);
    c.add(awBg); c.add(awFill);
    const tw1 = this.tweens.add({ targets: awFill, width: 594, duration: 2000, repeat: -1, yoyo: false,
      onUpdate: () => { awFill.fillColor = awFill.width > 580 ? 0xffe88a : 0xd9b25c; },
      onRepeat: () => { awFill.width = 0; },
    });
    this._demoTweens.push(tw1);

    // ===== DASH (demo real com trilha) =====
    c.add(this.add.rectangle(cx, 360, 800, 180, 0x0a1410, 0.85).setStrokeStyle(2, 0xd9b25c, 0.6));
    c.add(this.add.tileSprite(cx, 360, 780, 160, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.5));

    c.add(sharp(this, cx - 380, 290, '⚡  SHIFT · DASH', {
      fontFamily: F, fontSize: '17px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx - 380, 318,
      'Esquiva rápida com 280ms de invulnerabilidade. CD 4s.',
      { fontFamily: F, fontSize: '13px', color: '#e8f0e6' }
    ));

    // Hero que dasha repetidamente
    const dashHero = this.add.image(cx - 250, 380, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.4);
    c.add(dashHero);

    // Tecla SHIFT pisca durante o dash
    const shiftBox = this.add.rectangle(cx - 250, 330, 88, 30, 0x1a2820, 1).setStrokeStyle(2, 0xd9b25c, 0.6);
    const shiftLbl = sharp(this, cx - 250, 330, 'SHIFT', { fontFamily: F, fontSize: '14px', fontStyle: 'bold', color: '#e8f0e6' }).setOrigin(0.5);
    c.add(shiftBox); c.add(shiftLbl);

    const dashStep = () => {
      // pisca SHIFT
      shiftBox.setFillStyle(0xffd96b); shiftLbl.setColor('#0a1410');
      this.time.delayedCall(150, () => { shiftBox.setFillStyle(0x1a2820); shiftLbl.setColor('#e8f0e6'); });
      // ghosts trail
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 35, () => {
          const ghost = this.add.image(dashHero.x, dashHero.y, 'dungeon_tiles', 84)
                            .setScale(GAME.PIXEL_SCALE * 1.4).setAlpha(0.5);
          ghost.setFlipX(dashHero.flipX);
          c.add(ghost);
          this.tweens.add({ targets: ghost, alpha: 0, duration: 250, onComplete: () => ghost.destroy() });
        });
      }
      // movimenta hero rápido pra direita
      this._demoTweens.push(this.tweens.add({
        targets: dashHero, x: cx + 250, duration: 180, ease: 'Cubic.easeOut',
        onComplete: () => {
          this.time.delayedCall(800, () => {
            dashHero.x = cx - 250; // reset
          });
        },
      }));
    };
    dashStep();
    this._demoTimers.push(this.time.addEvent({ delay: 2200, loop: true, callback: dashStep }));

    // Rodapé
    c.add(sharp(this, cx, 470,
      'Bênção "Sopro do Vento" reduz cooldown do dash em 30%.',
      { fontFamily: F, fontSize: '12px', color: '#93a89a', align: 'center' }
    ).setOrigin(0.5));
  }

  // ============================================================
  // PÁGINA 3 — Reações com SOBRECARGA demo ao vivo
  // ============================================================
  _pageReactions() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 95, '3 · Reações Elementais ★', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    c.add(sharp(this, cx, 128,
      'Combinar 2 elementos no mesmo inimigo = REAÇÃO automática',
      { fontFamily: F, fontSize: '14px', color: '#e8f0e6', align: 'center' }
    ).setOrigin(0.5));

    // Lista das 3 reações compacta
    const reactions = [
      { a: '🔥', b: '❄️', name: 'VAPOR',      desc: 'Lentifica área 3s', color: '#9ad4ff' },
      { a: '❄️', b: '⚡', name: 'CRISTAL',    desc: 'Explosão + congela', color: '#5cc8ff' },
      { a: '🔥', b: '⚡', name: 'SOBRECARGA', desc: 'Corrente entre 4',  color: '#d98cff' },
    ];
    reactions.forEach((r, i) => {
      const y = 165 + i * 30;
      c.add(sharp(this, cx - 280, y, `${r.a} + ${r.b}  =`, { fontFamily: F, fontSize: '14px', color: '#e8f0e6' }).setOrigin(0, 0.5));
      c.add(sharp(this, cx - 140, y, r.name, { fontFamily: F, fontSize: '15px', fontStyle: 'bold', color: r.color }).setOrigin(0, 0.5));
      c.add(sharp(this, cx + 50, y, r.desc, { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0, 0.5));
    });

    // === DEMO ARENA: Sobrecarga ao vivo ===
    const ax = cx, ay = 360;
    c.add(this.add.rectangle(ax, ay, 760, 220, 0x0a1410, 0.85).setStrokeStyle(2, 0xd98cff, 0.7));
    c.add(this.add.tileSprite(ax, ay, 740, 200, 'town_tiles', 0).setOrigin(0.5).setAlpha(0.5));
    c.add(sharp(this, ax - 360, ay - 95, 'DEMO AO VIVO: SOBRECARGA (🔥 + ⚡)', {
      fontFamily: F, fontSize: '13px', fontStyle: 'bold', color: '#d98cff',
    }));

    // Player na esquerda do demo
    const heroX = ax - 280, heroY = ay + 10;
    const hero = this.add.image(heroX, heroY, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.2);
    c.add(hero);

    // Função que roda um ciclo: spawn enemies → atira fogo → atira raio → trigger SOBRECARGA → reset
    const runDemo = () => {
      // limpa inimigos anteriores se existirem
      if (this._demoEnemies) this._demoEnemies.forEach(e => e.destroy());
      this._demoEnemies = [];

      // spawna 4 inimigos em arco
      const enemies = [];
      for (let i = 0; i < 4; i++) {
        const ex = ax + 50 + i * 70;
        const ey = ay + (i % 2 ? 30 : -30);
        const e = this.add.image(ex + 200, ey, 'creatures', 139).setScale(GAME.PIXEL_SCALE * 1.1).setAlpha(0);
        c.add(e); enemies.push(e);
        // fade-in + slide-in
        this._demoTweens.push(this.tweens.add({ targets: e, x: ex, alpha: 1, duration: 400, delay: i * 80 }));
      }
      this._demoEnemies = enemies;

      // Após 600ms: primeiro projétil de FOGO no primeiro inimigo
      this.time.delayedCall(700, () => {
        const target = enemies[0];
        this._shootProjectile(heroX, heroY, target.x, target.y, 0xff7a3c, () => {
          // status fogo: tinta laranja
          enemies.forEach(e => e.setTint(0xff9966));
        });
      });

      // 1100ms: projétil de RAIO no primeiro inimigo
      this.time.delayedCall(1200, () => {
        const target = enemies[0];
        this._shootProjectile(heroX, heroY, target.x, target.y, 0xd98cff, () => {
          // SOBRECARGA! desenha bolts entre todos
          for (let i = 0; i < enemies.length - 1; i++) {
            const a = enemies[i], b = enemies[i + 1];
            this._drawBolt(a.x, a.y, b.x, b.y, 0xd98cff);
          }
          // texto SOBRECARGA flutuante
          const txt = sharp(this, target.x, target.y - 40, 'SOBRECARGA!', {
            fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
            stroke: '#000', strokeThickness: 4,
          }).setOrigin(0.5).setDepth(100);
          c.add(txt);
          this.tweens.add({ targets: txt, y: target.y - 80, alpha: 0, duration: 900, onComplete: () => txt.destroy() });
          // shake leve
          this.cameras.main.shake(150, 0.005);
          this.sound.play('sfx_levelup', { volume: 0.3, rate: 1.4, detune: 300 });
          // inimigos somem
          enemies.forEach((e, i) => {
            this.time.delayedCall(i * 80, () => {
              this.tweens.add({ targets: e, alpha: 0, scale: GAME.PIXEL_SCALE * 0.5, duration: 250 });
            });
          });
        });
      });
    };
    runDemo();
    this._demoTimers.push(this.time.addEvent({ delay: 4200, loop: true, callback: runDemo }));
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
