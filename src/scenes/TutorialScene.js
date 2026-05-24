// Tutorial COMO JOGAR — páginas com animações.
import { COLORS, GAME } from '../config.js';

const F  = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function sharp(scene, x, y, str, opts) {
  return scene.add.text(Math.round(x), Math.round(y), str, opts).setResolution(2);
}

export class TutorialScene extends Phaser.Scene {
  constructor() { super('TutorialScene'); }

  create() {
    this.W = GAME.WIDTH; this.H = GAME.HEIGHT;
    this.cx = this.W / 2;
    this.cameras.main.setBackgroundColor(0x0a1410);

    // BG gradiente
    const grad = this.add.graphics();
    grad.fillStyle(0x152820, 1); grad.fillRect(0, 0, this.W, this.H);
    grad.fillStyle(0x000000, 0.5); grad.fillRect(0, this.H * 0.6, this.W, this.H * 0.4);

    // Título fixo
    sharp(this, this.cx, 36, 'COMO JOGAR', {
      fontFamily: F, fontSize: '32px', fontStyle: 'bold', color: '#d9b25c',
    }).setOrigin(0.5);

    // Estado
    this.pageIdx = 0;
    this.pages = [
      this._pageMovement.bind(this),
      this._pageAwakenDash.bind(this),
      this._pageReactions.bind(this),
      this._pageChests.bind(this),
      this._pageMeta.bind(this),
    ];
    this.pageContainer = null;
    this._renderPage();

    // Botões navegação (fixos)
    this.prevBtn = this._navButton(120, this.H - 50, '< ANTERIOR', () => this._goto(this.pageIdx - 1));
    this.nextBtn = this._navButton(this.W - 120, this.H - 50, 'PRÓXIMO >', () => this._goto(this.pageIdx + 1));
    this._backBtn = this._navButton(this.cx, this.H - 50, 'VOLTAR AO MENU', () => this.scene.start('MenuScene'));

    // Indicador de página
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

    // Dots
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
      this.tweens.killTweensOf(this.pageContainer);
      this.pageContainer.destroy(true);
    }
    if (this._pageTimers) { this._pageTimers.forEach(t => t.remove()); }
    this._pageTimers = [];
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

  // ===== PÁGINAS =====

  _pageMovement() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 110, '1 · Movimento e Combate', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    // Player sprite idle
    const hero = this.add.image(cx, 250, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 2.2);
    c.add(hero);
    this.tweens.add({ targets: hero, y: 240, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // WASD keys piscando
    const keyOpts = (active) => ({
      fontFamily: F, fontSize: '18px', fontStyle: 'bold',
      color: active ? '#0a1410' : '#e8f0e6',
      backgroundColor: active ? '#ffd96b' : '#1a2820',
      padding: { x: 12, y: 8 },
    });
    const drawKeys = (highlightIdx) => {
      ['W', 'A', 'S', 'D'].forEach((k, i) => {
        const px = cx - 200 + i * 60;
        const py = 360;
        const t = sharp(this, px, py, k, keyOpts(i === highlightIdx)).setOrigin(0.5);
        c.add(t);
      });
    };
    let frame = 0;
    drawKeys(frame);
    const timer = this.time.addEvent({ delay: 400, loop: true, callback: () => {
      frame = (frame + 1) % 5;
      // Clear last 4 children (keys)
      for (let i = 0; i < 4; i++) c.last.destroy();
      drawKeys(frame === 4 ? -1 : frame);
    }});
    this._pageTimers.push(timer);

    c.add(sharp(this, cx, 430,
      'WASD ou setas para mover. O ataque é AUTOMÁTICO no inimigo mais próximo.',
      { fontFamily: F, fontSize: '15px', color: '#e8f0e6', align: 'center', wordWrap: { width: 700 } }
    ).setOrigin(0.5));
    c.add(sharp(this, cx, 480,
      'Mate inimigos para ganhar XP. Cada level-up oferece 3 cartas de upgrade.',
      { fontFamily: F, fontSize: '13px', color: '#93a89a', align: 'center', wordWrap: { width: 700 } }
    ).setOrigin(0.5));
  }

  _pageAwakenDash() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 110, '2 · Despertar e Dash', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    // Painel Despertar
    c.add(this.add.rectangle(cx, 220, 720, 130, 0x0a1410, 0.7).setStrokeStyle(2, 0xd9b25c, 0.7));
    c.add(sharp(this, cx - 350 + 20, 175, '★  R · DESPERTAR', {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx - 350 + 20, 210,
      'Enche o medidor matando inimigos e disparando reações.',
      { fontFamily: F, fontSize: '14px', color: '#e8f0e6', wordWrap: { width: 680 } }
    ));
    c.add(sharp(this, cx - 350 + 20, 240,
      'Quando cheio, pressione R para entrar em modo berserker:',
      { fontFamily: F, fontSize: '13px', color: '#93a89a' }
    ));
    c.add(sharp(this, cx - 350 + 20, 262,
      '• Armas atiram 2.5× mais rápido por 6 segundos.',
      { fontFamily: F, fontSize: '13px', color: '#93a89a' }
    ));
    // Bar animada do Despertar
    const awBg = this.add.rectangle(cx, 310, 600, 20, 0x000000, 0.6).setStrokeStyle(1, 0xd9b25c, 0.7);
    const awFill = this.add.rectangle(cx - 298, 310, 0, 14, 0xd9b25c).setOrigin(0, 0.5);
    c.add(awBg); c.add(awFill);
    const tw1 = this.tweens.add({ targets: awFill, width: 594, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: () => { awFill.fillColor = awFill.width > 580 ? 0xffe88a : 0xd9b25c; } });

    // Painel Dash
    c.add(this.add.rectangle(cx, 430, 720, 110, 0x0a1410, 0.7).setStrokeStyle(2, 0xd9b25c, 0.7));
    c.add(sharp(this, cx - 350 + 20, 390, '⚡  SHIFT · DASH', {
      fontFamily: F, fontSize: '18px', fontStyle: 'bold', color: '#ffd96b',
    }));
    c.add(sharp(this, cx - 350 + 20, 422,
      'Esquiva rápida com 280ms de invulnerabilidade.',
      { fontFamily: F, fontSize: '14px', color: '#e8f0e6' }
    ));
    c.add(sharp(this, cx - 350 + 20, 448,
      'Cooldown de 4 segundos. Use SHIFT ou SPACE.',
      { fontFamily: F, fontSize: '13px', color: '#93a89a' }
    ));
    // Mini hero dashando
    const dashHero = this.add.image(cx + 220, 430, 'dungeon_tiles', 84).setScale(GAME.PIXEL_SCALE * 1.6);
    c.add(dashHero);
    const tw2 = this.tweens.add({ targets: dashHero, x: cx + 290, alpha: 0.6, duration: 400, yoyo: true, repeat: -1, ease: 'Cubic.easeOut' });

    this._pageTweens = [tw1, tw2];
  }

  _pageReactions() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 110, '3 · Reações Elementais ★', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    c.add(sharp(this, cx, 145,
      'Cada arma tem um elemento. 2 elementos diferentes no mesmo inimigo = REAÇÃO!',
      { fontFamily: F, fontSize: '14px', color: '#e8f0e6', align: 'center', wordWrap: { width: 800 } }
    ).setOrigin(0.5));

    const reactions = [
      { y: 220, a: '🔥', b: '❄️', name: 'VAPOR',      desc: 'Nuvem que lentifica área 3s',                color: '#9ad4ff' },
      { y: 320, a: '❄️', b: '⚡', name: 'CRISTAL',    desc: 'Explosão em anel + congela 1s',              color: '#5cc8ff' },
      { y: 420, a: '🔥', b: '⚡', name: 'SOBRECARGA', desc: 'Corrente elétrica entre 4 inimigos',        color: '#d98cff' },
    ];

    for (const r of reactions) {
      const row = this.add.rectangle(cx, r.y, 760, 80, 0x0a1410, 0.7).setStrokeStyle(2, 0xd9b25c, 0.5);
      c.add(row);
      // Elemento A
      const eA = sharp(this, cx - 320, r.y, r.a, { fontFamily: F, fontSize: '36px' }).setOrigin(0.5);
      const plus = sharp(this, cx - 240, r.y, '+', { fontFamily: F, fontSize: '32px', fontStyle: 'bold', color: '#93a89a' }).setOrigin(0.5);
      const eB = sharp(this, cx - 160, r.y, r.b, { fontFamily: F, fontSize: '36px' }).setOrigin(0.5);
      const arrow = sharp(this, cx - 80, r.y, '=', { fontFamily: F, fontSize: '32px', fontStyle: 'bold', color: '#93a89a' }).setOrigin(0.5);
      const nm = sharp(this, cx + 20, r.y - 8, r.name, { fontFamily: F, fontSize: '20px', fontStyle: 'bold', color: r.color }).setOrigin(0, 0.5);
      const dc = sharp(this, cx + 20, r.y + 14, r.desc, { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0, 0.5);
      c.add([eA, plus, eB, arrow, nm, dc]);
      // pulse A and B
      const tw = this.tweens.add({ targets: [eA, eB], scale: 1.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    c.add(sharp(this, cx, 500, 'DICA: combine armas de elementos diferentes para disparar reações constantes.',
      { fontFamily: F, fontSize: '13px', color: '#ffd96b', align: 'center', wordWrap: { width: 800 } }
    ).setOrigin(0.5));
  }

  _pageChests() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 110, '4 · Baús e Mímico', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    c.add(sharp(this, cx, 150,
      'Baús aparecem pelo mapa. Encoste neles e pressione [E] para abrir.',
      { fontFamily: F, fontSize: '15px', color: '#e8f0e6', align: 'center' }
    ).setOrigin(0.5));

    // 4 tipos lado a lado
    const types = [
      { x: cx - 360, frame: 89, color: '#6fcf6f', label: 'NORMAL',  desc: 'Gemas + moedas + chance de coração e orbe.',           pct: '75%' },
      { x: cx - 120, frame: 91, color: '#ffd96b', label: 'DOURADO', desc: '+30 moedas extras + carta grátis. Jackpot 8-bit!',     pct: '6%' },
      { x: cx + 120, frame: 89, color: '#ff8898', label: 'TRAP',    desc: '4 inimigos ELITE (2× HP, 1.4× tamanho).',              pct: '12%' },
      { x: cx + 360, frame: 92, color: '#ff3333', label: 'MÍMICO',  desc: '1 inimigo SUPER ELITE (4× HP, 1.7×, 2× dano).',        pct: '7%' },
    ];
    for (const t of types) {
      const sp = this.add.image(t.x, 240, 'dungeon_tiles', t.frame).setScale(GAME.PIXEL_SCALE * 2);
      c.add(sp);
      c.add(sharp(this, t.x, 305, t.label, { fontFamily: F, fontSize: '15px', fontStyle: 'bold', color: t.color }).setOrigin(0.5));
      c.add(sharp(this, t.x, 326, t.pct, { fontFamily: F, fontSize: '12px', color: '#93a89a' }).setOrigin(0.5));
      c.add(sharp(this, t.x, 360, t.desc, { fontFamily: F, fontSize: '11px', color: '#e8f0e6', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0));
      // bobbing
      this.tweens.add({ targets: sp, y: 232, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    c.add(sharp(this, cx, 470,
      '⚠ MÍMICO te confronta com sprite de língua para fora. Tome cuidado.',
      { fontFamily: F, fontSize: '13px', color: '#ff8898', align: 'center' }
    ).setOrigin(0.5));
  }

  _pageMeta() {
    const c = this.pageContainer;
    const cx = this.cx;

    c.add(sharp(this, cx, 110, '5 · Progressão Entre Runs', {
      fontFamily: F, fontSize: '22px', fontStyle: 'bold', color: '#ffd96b',
    }).setOrigin(0.5));

    const sections = [
      { y: 180, icon: '💰', title: 'MOEDAS', text: 'Inimigos dropam 5% das vezes. Boss dá 50 bônus. Acumulam entre runs.' },
      { y: 270, icon: '🔓', title: 'DESBLOQUEAR ARMAS', text: 'Gaste moedas no menu para liberar Bumerangue, Raio Encadeado e Aura Gélida.' },
      { y: 360, icon: '✨', title: 'BÊNÇÃOS', text: 'Buffs PERMANENTES que se aplicam em TODA run: +HP, +velocidade, +dano, regen, crítico, e mais.' },
      { y: 450, icon: '🏆', title: 'BOSS AOS 7 MINUTOS', text: 'O ANCIÃO desperta. 2 fases. Vença para 50 moedas e tela de vitória.' },
    ];

    for (const s of sections) {
      c.add(this.add.rectangle(cx, s.y, 800, 70, 0x0a1410, 0.7).setStrokeStyle(2, 0xd9b25c, 0.5));
      c.add(sharp(this, cx - 380, s.y, s.icon, { fontFamily: F, fontSize: '30px' }).setOrigin(0, 0.5));
      c.add(sharp(this, cx - 330, s.y - 10, s.title, { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#ffd96b' }).setOrigin(0, 0.5));
      c.add(sharp(this, cx - 330, s.y + 14, s.text, { fontFamily: F, fontSize: '12px', color: '#e8f0e6', wordWrap: { width: 730 } }).setOrigin(0, 0.5));
    }

    c.add(sharp(this, cx, 520, 'Boa caçada, Guardião!',
      { fontFamily: F, fontSize: '16px', fontStyle: 'bold', color: '#6fcf6f', align: 'center' }
    ).setOrigin(0.5));
  }
}
