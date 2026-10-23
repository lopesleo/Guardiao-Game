// Ambientação da Clareira: trilhas de terra ligando a fogueira a cada lugar,
// varal de bandeirinhas com luzinhas sobre o terreiro, rede, espantalho,
// capim balançando, folhas caindo, faíscas da forja, brilho do santuário e
// vinheta. Nada aqui tem regra de jogo — é só o lugar ficar vivo.
// Mixin da CampScene (Object.assign).
import { GAME, SEASONS } from "../config.js";
import { PAL } from "../art/Palette.js";
import { ScreenVignette, mixColor } from "../art/Gradients.js";
import { paintGround, FLAG_COUNT } from "../art/CampDecor.js";
import { morphoFlight } from "../art/CampAncestral.js";
import { SERTAO_PATH } from "../art/CampSertao.js";
import { sertaoSkyAt, HORIZON } from "./CampSertao.js";
import { Clock } from "../systems/Clock.js";
import { tr } from "../i18n/i18n.js";
import { Wardrobe, cosmeticsOn } from "../systems/Cosmetics.js";

const S = GAME.PIXEL_SCALE;
const D_NIGHT = 50000;
const HUB = { x: 0, y: 70, r: 175 }; // terreiro em volta da fogueira

// Data comemorativa de hoje (ou null). ?festa=<id> força uma (só com ?debug=1)
export function currentSeason(date = Clock.date()) {
  const q = new URLSearchParams(location.search);
  if (q.get("debug") === "1" && q.get("festa")) return SEASONS.find((s) => s.id === q.get("festa")) || null;
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return SEASONS.find((s) => md >= s.from[0] * 100 + s.from[1] && md <= s.to[0] * 100 + s.to[1]) || null;
}

// Céu pela hora REAL do aparelho: cor da camada de "noite" (multiply) e quanto
// as luzes (fogueira, luzinhas, lamparina, lua, vaga-lumes) aparecem (k).
const SKY = [
  [0, 0x5a6a9a, 1],
  [5, 0x5a6a9a, 1],
  [6.5, 0xc8a0b0, 0.55], // amanhecer rosado
  [8, 0xffffff, 0],
  [16.5, 0xffffff, 0],
  [18, 0xf2b890, 0.35], // fim de tarde dourado
  [19.3, 0x8c78aa, 0.8], // anoitecer roxo
  [20.5, 0x5a6a9a, 1],
  [24, 0x5a6a9a, 1],
];
const lerpColor = (a, b, t) => {
  const ch = (c, s) => (c >> s) & 255;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};
export function skyAt(hour) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0, k0] = SKY[i],
      [h1, c1, k1] = SKY[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = (hour - h0) / (h1 - h0 || 1);
      return { color: lerpColor(c0, c1, t), k: k0 + (k1 - k0) * t };
    }
  }
  return { color: SKY[0][1], k: 1 };
}

// Áreas reservadas (sem cogumelo/flor/capim soltos): horta, lago, celeiro,
// cozinha e o terreiro da fogueira
const RESERVED = [
  [-170, 250, 210, 500],
  [360, -40, 740, 210],
  [-400, 260, -200, 480],
  [200, 280, 420, 480],
];
export const decorFree = (x, y) => !RESERVED.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);

export const CampDecor = {
  // Chão pintado sob medida: terreiro + trilhas (chamado por _ground)
  _paintPaths(bounds) {
    // Rede de trilhas: troncos que saem do terreiro e se ramificam
    const W_ = { x: -300, y: 70 },
      E_ = { x: 290, y: 40 },
      S_ = { x: 10, y: 285 };
    const paths = [
      // a trilha da floresta (norte); no sertão ela afina até sumir na linha do horizonte
      this._sertao ? { x: 0, y: HORIZON + 4, w: 66, bend: 0.12 } : { x: 0, y: bounds.top - 260, w: 66, bend: 0.12, taper: false },
      { ...W_, w: 40, bend: 0.25 }, // tronco oeste
      { from: W_, x: -430, y: -110, w: 30, bend: -0.3 }, // Santuário
      { from: W_, x: -420, y: 300, w: 28, bend: 0.3 }, // Mural
      { from: W_, x: -600, y: 80, w: 20, bend: 0.2 }, // a rede
      { ...E_, w: 40, bend: -0.2 }, // tronco leste
      { from: E_, x: 440, y: -96, w: 30, bend: 0.3 }, // Forja
      { from: E_, x: 410, y: 84, w: 30, bend: -0.2 }, // trapiche do Lago
      { ...S_, w: 44, bend: 0.15 }, // tronco sul (Horta)
      { from: { x: -40, y: 250 }, x: -300, y: 490, w: 28, bend: -0.25 }, // Celeiro
      { from: { x: 70, y: 250 }, x: 300, y: 480, w: 28, bend: 0.25 }, // Cozinha
      { from: { x: 200, y: 360 }, x: 440, y: 312, w: 22, bend: -0.3 }, // ninho do João-de-barro
    ];
    const ground = paintGround(this, "camp_ground_paint", {
      x0: bounds.x0,
      y0: bounds.top - 300,
      w: bounds.w,
      h: bounds.h + 300,
      scale: S,
      hub: HUB,
      paths,
      colors: this._sertao ? SERTAO_PATH : undefined, // terra batida clara sobre o chão vermelho
    });
    this.add.image(bounds.x0, bounds.top - 300, "camp_ground_paint").setOrigin(0).setScale(S).setDepth(-9.5e5);
    return ground;
  },

  _decor() {
    // Clareira Ancestral (skin do Pacote Fundador, docs/COSMETICOS.md): troca a árvore, os bancos, a rede e o
    // varal do terreiro e põe o portal de lamparinas, os bichos, os cogumelos e a luz do fim de tarde
    this.morphos = []; // a cena é reaproveitada (trocar de skin recomeça): nada da rodada anterior
    this._shaftDefs = null;
    this._campfireSeats();
    // Bandeirinhas e luzinhas só na festa junina/julina (data real); na Ancestral, fora da festa, os esteios
    // entalhados do terreiro levam cordões de lamparinas de cabaça
    if ((this._seasonOverride ?? currentSeason()?.id) === "junina") this._bunting();
    else if (this._ancestral) this._lampStrings();
    // Rede listrada perto da mata, a oeste (na Ancestral, rede de varanda com franja; no sertão, a rede de varanda
    // colorida balançando no vento)
    const hx = -600,
      hy = 90;
    this.add.image(hx, hy + 4, "px_shadow").setScale(9, 3).setAlpha(0.45).setDepth(hy - 1);
    if (this._sertao) {
      const rede = this.add.sprite(hx, hy, "camp_sertao_hammock", 0).setOrigin(0.5, 1).setScale(S).setDepth(hy);
      let rf = 0;
      this.time.delayedCall(this._wind(hx) % 700, () => this.time.addEvent({ delay: 350, loop: true, callback: () => rede.active && rede.setFrame((rf = (rf + 1) % 6)) }));
    } else this.add.image(hx, hy, this._ancestral ? "camp_anc_hammock" : "camp_hammock").setOrigin(0.5, 1).setScale(S).setDepth(hy);
    this._solid(hx - 60, hy - 6, 14, 12);
    this._solid(hx + 60, hy - 6, 14, 12);
    // (o espantalho e o regador pertencem à horta: ver CampGarden, aparecem junto com ela)
    // Samaúma: a gigante da mata, marco da Clareira (a noroeste). Com a Clareira Ancestral (skin do
    // Pacote Fundador, docs/COSMETICOS.md) é o jequitibá ancestral no lugar, com a placa dos Fundadores
    const kx = -250,
      ky = -250;
    const big = this._ancestral;
    if (this._sertao) this._sertaoTree(kx, ky); // o juazeiro, o verde que resiste à seca
    else {
      this.add.image(kx, ky + 6, "px_shadow").setScale(big ? 26 : 18, big ? 8 : 6).setAlpha(0.5).setDepth(ky - 1);
      const kapok = this.add.image(kx, ky, big ? "camp_jequitiba" : "camp_kapok").setOrigin(0.5, 1).setScale(S).setDepth(ky);
      this._solid(kx, ky - 16, big ? 130 : 90, 28);
      this.tweens.add({ targets: kapok, scaleX: { from: S, to: S * 1.01 }, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    if (big) {
      this.add.image(kx + 150, ky + 34, "px_shadow").setScale(5, 2).setAlpha(0.4).setDepth(ky + 33);
      this.add.image(kx + 150, ky + 36, "camp_plaque").setOrigin(0.5, 1).setScale(S).setDepth(ky + 36);
      this._sunShafts(kx, ky);
      this._ancestralExtras(kx, ky);
    }
    // Vaga-lumes rondando a copa (entram no mesmo balé dos outros) — dourados e mais no jequitibá
    for (let k = 0; k < (big ? 18 : this._sertao ? 4 : 9); k++) {
      const x = kx + (Math.random() - 0.5) * (big ? 320 : 200),
        y = ky - (big ? 330 : 220) + Math.random() * (big ? 170 : 120);
      const g = this.add.image(x, y, "fx_glow").setScale(0.3).setTint(big ? 0xffd98a : 0xd8ffb0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 1);
      const c = this.add.image(x, y, "px_dot2").setScale(2).setTint(big ? 0xffe9b0 : 0xe8ffc8).setDepth(D_NIGHT + 1);
      this.flies.push({ g, c, ph: Math.random() * 7, ox: x, oy: y });
    }
    // Pedras com samambaia (nordeste) e helicônias perto das construções (no sertão: lajedo com xique-xique,
    // mandacarus com flor, coroas-de-frade e macambiras)
    if (this._sertao) this._sertaoPlants();
    else {
      this.add.image(230, -300, "camp_rocks").setOrigin(0.5, 1).setScale(S).setDepth(-300);
      this._solid(215, -318, 70, 24);
      for (const [x, y, t] of [[-360, -60, 0], [-500, -150, 1], [520, -60, 0], [360, -150, 1], [-330, 330, 1], [200, 470, 0], [-175, 530, 1], [560, 250, 0], [-650, 220, 0], [120, -250, 1]]) {
        const h = this.add.image(x, y, `camp_heliconia${t}`).setOrigin(0.5, 1).setScale(S).setDepth(y);
        this.tweens.add({ targets: h, angle: { from: -3, to: 3 }, duration: 2000 + Math.random() * 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 1000 });
      }
    }
    this._grassSway();
    this._ambientLife();
    if (this._sertao) {
      this._sertaoSky(); // o horizonte do sertão ao norte
      this._sertaoLife(); // calangos, asas-brancas, carcará, poeira
    }
    // Vinheta: foca o olhar no meio da tela (elipse no formato da tela; a força segue a hora)
    this.vignette = new ScreenVignette(this, { geom: () => ({ r0: 0.55, r1: 1.42 }), ellipse: true, color: PAL.night0, alpha: 0.55, depth: D_NIGHT + 3 });
    // Céu pela hora real (dia, entardecer, noite, amanhecer)
    this.time.delayedCall(0, () => this._applyTimeOfDay());
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this._applyTimeOfDay() });
  },

  // Clareira Ancestral: um cordão de lamparinas de cabaça entre os esteios de cima do terreiro (por cima da
  // fogueira) e uma lamparina em cada gancho dos esteios de baixo — nada cruza o meio do terreiro, por onde o
  // herói anda. Balançam, tremulam e acendem com a noite
  // O vento da Clareira passa em onda, de oeste para leste: tudo o que balança usa o mesmo ritmo (2,1 s) e este
  // atraso pela posição
  _wind(x) {
    return ((x + 400) / 800) * 1400;
  },

  // Lamparina de cabaça pendurada em (x, y): balança com o vento e a chama tremula. O brilho só nasce com
  // light() (o laço dos brilhos manda na opacidade, então o que ainda está escondido não pode ter brilho).
  _ancLamp(x, y, fr, depth) {
    x = Math.round(x / 3) * 3;
    y = Math.round(y / 3) * 3;
    const lamp = this.add.sprite(x, y, "camp_anc_lamp", fr).setOrigin(0.5, 0).setScale(S).setDepth(depth);
    const amp = 4 + Math.random() * 1.5;
    this.tweens.add({ targets: lamp, angle: { from: -amp, to: amp }, duration: 2100, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: this._wind(x) });
    let f = fr;
    this.time.addEvent({ delay: 200 + Math.random() * 180, loop: true, callback: () => lamp.setFrame((f ^= 1)) });
    const o = {
      lamp,
      glow: null,
      light: () => {
        if (o.glow) return o;
        o.glow = this.add.image(lamp.x, lamp.y + 30, "fx_glow").setScale(0.8).setTint(0xffc46a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D_NIGHT + 1);
        this.glows.push({ g: o.glow, base: 0.55, ph: Math.random() * 10 });
        return o;
      },
      // a lamparina do espantalho anda com o braço
      moveTo: (nx, ny) => {
        lamp.setPosition(nx, ny);
        o.glow?.setPosition(nx, ny + 30);
      },
    };
    return o;
  },

  _lampStrings() {
    const { poles, H } = this._terreiroPosts();
    const g = this.add.graphics().setDepth(D_NIGHT - 20);
    const lampAt = (x, y, fr) => this._ancLamp(x, y, fr, D_NIGHT - 19).light();
    // esteios de baixo: uma lamparina em cada gancho
    for (const i of [2, 3]) {
      const [x, y] = poles[i];
      lampAt(x - 16, y - 126, 0);
      lampAt(x + 16, y - 126, 1);
    }
    for (const [a, b, sag] of [[0, 1, 46]]) {
      const [x1, y1] = poles[a],
        [x2, y2] = poles[b];
      const p1 = { x: x1 + 15, y: y1 - H },
        p2 = { x: x2 - 15, y: y2 - H };
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const at = (u) => ({ x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u + Math.sin(u * Math.PI) * sag });
      g.fillStyle(PAL.n1, 1);
      for (let u = 0; u <= 1; u += 3 / len) {
        const q = at(u);
        g.fillRect(Math.round(q.x / 3) * 3, Math.round(q.y / 3) * 3, 3, 3);
      }
      const n = 7;
      for (let i = 1; i < n; i++) {
        const q = at(i / n);
        lampAt(q.x, q.y, i % 2);
      }
    }
  },

  // Clareira Ancestral: o que fica em volta da árvore e do terreiro — tapete de folhas de cobre, cogumelos
  // flor-de-coco (brilham à noite), o estandarte dos Fundadores ao vento, o tucano pousado num esteio e as
  // borboletas-azuis (de dia; à noite ficam os vaga-lumes)
  _ancestralExtras(kx, ky) {
    for (const [x, y, fr] of [
      [kx - 110, ky + 16, 0],
      [kx + 50, ky + 26, 1],
      [kx - 20, ky + 46, 2],
      [kx + 130, ky + 74, 0],
      [kx - 200, ky + 52, 1],
    ])
      if (!this.groundPaint?.onPath(x, y, 6)) this.add.image(x, y, "camp_anc_leaves", fr).setScale(S).setDepth(-9e5);
    for (const [x, y, fr] of [
      [kx - 150, ky + 30, 0],
      [kx + 100, ky + 40, 1],
      [kx - 60, ky + 64, 2],
      [-250, 0, 1],
      [258, 230, 0],
      [-560, 130, 2],
      [-290, 225, 0], // fora da sombra do espantalho da horta
    ]) {
      if (this.groundPaint?.onPath(x, y, 8) || !decorFree(x, y)) continue;
      this.add.image(x, y, "camp_anc_shrooms", fr).setOrigin(0.5, 1).setScale(S).setDepth(y);
      const gl = this._glow(x, y - 12, 0.55, 0x9cffb0, false);
      this.glows.push({ g: gl, base: 0.42, ph: Math.random() * 10, sp: 700, amp: 0.16 }); // respira (~4 s), não tremula
    }
    // estandarte dos Fundadores ao lado da placa, ao pé do jequitibá (o cantinho dos Fundadores)
    const bx = kx + 205,
      by = ky + 45;
    this.add.image(bx - 12, by + 2, "px_shadow").setScale(2.5, 1.5).setAlpha(0.4).setDepth(by - 1);
    const banner = this.add.sprite(bx, by, "camp_anc_banner", 0).setOrigin(0.5, 1).setScale(S).setDepth(by);
    let bf = 0;
    this.time.addEvent({ delay: 115, loop: true, callback: () => banner.setFrame((bf = (bf + 1) % 6)) }); // onda contínua
    this._solid(bx - 16, by - 4, 10, 8);
    // tucano-toco no esteio de baixo à direita (à vista de quem chega): respira, pisca (às vezes duas vezes), olha
    // para cima, alisa a pena do peito e vira de lado com um pulinho
    const tuY = 58;
    const tu = this.add.sprite(215, tuY, "camp_anc_toucan", 0).setOrigin(0.61, 14 / 16).setScale(S).setDepth(206);
    let busy = false,
      breath = 0;
    this.time.addEvent({ delay: 650, loop: true, callback: () => !busy && tu.active && tu.setFrame((breath ^= 1) ? 4 : 0) }); // respiração
    const pose = (fr, ms) => {
      busy = true;
      tu.setFrame(fr);
      this.time.delayedCall(ms, () => {
        if (!tu.active) return;
        tu.setFrame(0);
        busy = false;
      });
    };
    const mexe = () => {
      if (!tu.active) return;
      const r = Math.random();
      if (r < 0.4) {
        pose(1, 130);
        if (Math.random() < 0.35) this.time.delayedCall(260, () => tu.active && pose(1, 120)); // piscada dupla
      } else if (r < 0.62) pose(2, 700 + Math.random() * 500);
      else if (r < 0.8) {
        pose(3, 260); // alisa a pena: bico para baixo, duas bicadinhas
        this.time.delayedCall(420, () => tu.active && pose(3, 240));
      } else {
        // vira: pulinho de 3 px de arte e troca de lado lá em cima
        busy = true;
        tu.setFrame(0);
        this.tweens.add({ targets: tu, y: tuY - 9, duration: 110, ease: "Quad.easeOut", yoyo: true, onYoyo: () => tu.setFlipX(!tu.flipX), onComplete: () => { tu.y = tuY; busy = false; } });
      }
      this.time.delayedCall(1700 + Math.random() * 2600, mexe);
    };
    this.time.delayedCall(1200, mexe);
    // borboletas-azuis (de dia): voo em curvas com sombra no chão, planadas e pousos nos canteiros perto de casa
    this.morphos = [];
    for (const [mx, my] of [
      [-330, -80],
      [360, 150],
      [-150, -170],
    ]) {
      const perches = [];
      for (let k = 0; perches.length < 3 && k < 40; k++) {
        const px = mx + (Math.random() - 0.5) * 220,
          py = my + (Math.random() - 0.5) * 140;
        if (!this.groundPaint?.onPath(px, py, 10) && decorFree(px, py)) perches.push({ x: px, y: py });
      }
      const shadow = this.add.image(mx, my, "px_shadow").setDepth(my - 1);
      const m = this.add.sprite(mx, my, "camp_anc_morpho", 0).setScale(S);
      this.morphos.push(m, shadow);
      const fly = morphoFlight({ sprite: m, shadow, home: { x: mx, y: my }, radius: 100, scale: S, perches, depth: (y, alt) => y + 30 + alt });
      this.time.addEvent({ delay: 16, loop: true, callback: () => fly(this.time.now) });
    }
  },

  // Pólen dourado boiando dentro dos raios de sol (de dia, na Ancestral)
  _pollen() {
    const sh = this._shaftDefs?.[Math.floor(Math.random() * this._shaftDefs.length)];
    if (!sh) return;
    const a = (24 * Math.PI) / 180;
    const along = (0.15 + Math.random() * 0.6) * 256 * 3.4,
      across = (Math.random() - 0.5) * 48 * sh.w * 0.45;
    const x = sh.x + Math.sin(a) * along + Math.cos(a) * across,
      y = sh.y + Math.cos(a) * along - Math.sin(a) * across;
    const d = this.add.image(Math.round(x / 3) * 3, Math.round(y / 3) * 3, "px_dot1").setScale(3).setTint(0xfff0b0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(D_NIGHT - 4);
    this.tweens.add({ targets: d, alpha: 0.85, duration: 1100, yoyo: true, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: d, y: d.y + 30, duration: 2200, onComplete: () => d.destroy() });
    this.tweens.add({ targets: d, x: d.x + 18, duration: 2200, ease: (t) => t + Math.sin(t * Math.PI * 4) * 0.12 }); // zigue-zague leve
  },

  // Clareira Ancestral: o sol de fim de tarde entra pela copa do jequitibá (raios inclinados, do oeste) e
  // doura o canto de cima da tela. Ficam sob a camada da noite: de noite quase somem, como luz do sol
  _sunShafts(kx, ky) {
    this._shaftDefs = [];
    for (const [dx, w, a] of [[-150, 3.4, 0.5], [-10, 2.4, 0.38], [120, 3, 0.45], [300, 2, 0.3]]) {
      this._shaftDefs.push({ x: kx + dx, y: ky - 300, w });
      const r = this.add.image(kx + dx, ky - 300, "fx_shaft").setOrigin(0.5, 0).setScale(w, 3.4).setAngle(-24).setTint(0xffcf7a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setDepth(D_NIGHT - 4);
      this.tweens.add({ targets: r, alpha: a * 0.5, scaleX: w * 0.85, duration: 4200 + Math.random() * 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 2000 });
    }
    this.add.image(0, 0, "fx_glow").setScrollFactor(0).setDisplaySize(this.W * 1.3, this.H * 1.5).setTint(0xffb060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4).setDepth(D_NIGHT - 3);
  },

  // Aplica o céu da hora atual (chamado ao entrar e a cada 30 s)
  _applyTimeOfDay() {
    const now = Clock.date();
    const hour = this._hourOverride ?? now.getHours() + now.getMinutes() / 60;
    const sky = this._sertao ? sertaoSkyAt(hour) : skyAt(hour);
    // Clareira Ancestral: o fim de tarde dourado nunca acaba (de dia puxa para o dourado; à noite, um
    // pouco mais quente) e as luzes ficam sempre um pouco acesas
    if (this._ancestral) {
      sky.color = lerpColor(sky.color, 0xf2b890, sky.color === 0xffffff ? 0.55 : 0.2);
      sky.k = Math.max(sky.k, 0.32);
    }
    this._lightK = sky.k;
    for (const m of this.morphos ?? []) m.setVisible(sky.k < 0.6); // borboletas de dia; à noite, vaga-lumes
    // Céu em volta da fogueira: o fogo esquenta o terreiro e a borda da mata esfria (mais à noite: sky.k)
    const warm = mixColor(sky.color, PAL.yel3, 0.4 * sky.k),
      cold = mixColor(sky.color, PAL.night1, 0.42 * sky.k);
    this.sky.setColors(warm, sky.color, cold).setVisible(sky.color !== 0xffffff);
    this.vignette?.setAlpha(0.3 + 0.28 * sky.k);
    if (this._sertao) this._sertaoTime(hour, sky, cold); // horizonte, lua, sol, flores do mandacaru
    // Luzes paradas (ADD por cima da noite): guardam o alpha original (as que têm o próprio controle ficam de fora)
    for (const o of this.children.list) {
      if (o.blendMode !== Phaser.BlendModes.ADD || o.depth < D_NIGHT || o.depth > D_NIGHT + 5 || o._ownAlpha) continue;
      if (o._baseA == null) o._baseA = o.alpha;
      o.setAlpha(o._baseA * Math.max(sky.k, o._dayMin ?? 0));
    }
  },

  // Troncos de sentar em volta da fogueira
  _campfireSeats() {
    for (const [x, y, flip] of [
      [-122, 40, false],
      [8, 156, true],
      [92, -8, true],
    ]) {
      this.add.image(x, y + 4, "px_shadow").setScale(6, 2).setAlpha(0.5).setDepth(y - 1);
      this.add.image(x, y, this._ancestral ? "camp_anc_bench" : this._sertao ? "camp_sertao_log" : "camp_logseat").setOrigin(0.5, 1).setScale(S).setFlipX(flip).setDepth(y);
      this._solid(x, y - 10, 72, 14);
    }
  },

  // Varal de bandeirinhas cruzando o terreiro (festa junina), com luzinhas.
  // Só aparece na época (SEASONS no config)
  // Os quatro esteios dos cantos do terreiro (varal da festa; na Clareira Ancestral, esteios entalhados).
  // Devolve as posições e a altura do ponto onde o cordão amarra
  _terreiroPosts() {
    const poles = [
      [-215, -30],
      [215, -30],
      [215, 205],
      [-215, 205],
    ];
    const anc = this._ancestral;
    for (const [x, y] of poles) {
      this.add.image(x, y + 3, "px_shadow").setScale(anc ? 3.5 : 2.5, 2).setAlpha(0.5).setDepth(y - 1);
      this.add.image(x, y, anc ? "camp_anc_post" : "camp_pole").setOrigin(0.5, 1).setScale(S).setDepth(y);
      this._solid(x, y - 4, anc ? 18 : 12, 10);
    }
    return { poles, H: anc ? 129 : 96 }; // esteio entalhado: gancho a 43 px de arte do pé
  },

  _bunting() {
    const { poles, H } = this._terreiroPosts();
    const lines = [
      [0, 2, 46],
      [1, 3, 46],
      [0, 1, 26],
      [3, 2, 26],
    ];
    const g = this.add.graphics().setDepth(D_NIGHT - 20);
    let k = 0;
    for (const [a, b, sag] of lines) {
      const [x1, y1] = poles[a],
        [x2, y2] = poles[b];
      const p1 = { x: x1, y: y1 - H },
        p2 = { x: x2, y: y2 - H };
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const at = (u) => ({ x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u + Math.sin(u * Math.PI) * sag });
      // o barbante (pixels de 3 px)
      g.fillStyle(PAL.ink, 1);
      for (let u = 0; u <= 1; u += 3 / len) {
        const q = at(u);
        g.fillRect(Math.round(q.x / 3) * 3, Math.round(q.y / 3) * 3, 3, 3);
      }
      // bandeirinhas e, de vez em quando, uma luzinha
      const n = Math.floor(len / 24);
      for (let i = 1; i < n; i++) {
        const q = at(i / n);
        if (i % 4 === 0) {
          this.add.image(q.x, q.y, "camp_bulb").setOrigin(0.5, 0).setScale(S).setDepth(D_NIGHT - 19);
          const glow = this.add.image(q.x, q.y + 9, "fx_glow").setScale(0.55).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(D_NIGHT + 1);
          this.glows.push({ g: glow, base: 0.45, ph: Math.random() * 10 });
          continue;
        }
        const f = this.add.image(q.x, q.y, `camp_flag${k++ % FLAG_COUNT}`).setOrigin(0.5, 0).setScale(S).setDepth(D_NIGHT - 19);
        this.tweens.add({ targets: f, angle: { from: -7, to: 7 }, scaleY: { from: S, to: S * 0.9 }, duration: 700 + Math.random() * 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 800 });
      }
    }
  },

  // Touceiras de capim alto que balançam com o vento
  _grassSway() {
    const env = this.registry.get(this._sertao ? "envKeysCaatinga" : "envKeys");
    const atlas = this._sertao ? "env_caatinga" : "env";
    const rnd = new Phaser.Math.RandomDataGenerator(["capim"]);
    const spots = [
      [-640, -200], [-560, 300], [-300, 120], [-330, -300], [250, 200], [620, -300], [640, 330], [180, -330], [-120, -250], [-640, 460], [600, 470], [-450, 440],
    ];
    for (const [cx, cy] of spots) {
      for (let k = 0; k < 6; k++) {
        const x = cx + rnd.between(-40, 40),
          y = cy + rnd.between(-22, 22);
        if (this.groundPaint?.onPath(x, y, 10) || !decorFree(x, y)) continue;
        const t = this.add.image(x, y, atlas, rnd.pick(env.tufts)).setOrigin(0.5, 1).setScale(S).setDepth(y);
        // no sertão o capim seco deita para leste e balança na mesma onda do vento da Clareira
        if (this._sertao) this.tweens.add({ targets: t, angle: { from: -2, to: 9 }, duration: 1050, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: this._wind(x) % 2100 });
        else this.tweens.add({ targets: t, angle: { from: -4, to: 5 }, duration: 1400 + rnd.between(0, 900), yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: rnd.between(0, 1200) });
      }
      if (rnd.frac() < 0.7) {
        const f = this.add.image(cx + rnd.between(-20, 20), cy + 10, atlas, rnd.pick(env.flowers)).setOrigin(0.5, 1).setScale(S).setDepth(cy + 10);
        this.tweens.add({ targets: f, angle: { from: -3, to: 3 }, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
  },

  // Folhas caindo, faíscas da forja, luzinhas subindo do santuário
  _ambientLife() {
    this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        const cam = this.cameras.main;
        if (this._sertao) {
          // folhas secas e fiapos de capim levados pelo vento (de oeste para leste, rente ao chão, rolando)
          if (Math.random() < 0.5) {
            const wv = cam.worldView;
            const x = wv.x - 20,
              y = Math.max(HORIZON + 40, wv.y + Math.random() * wv.height);
            const kind = Math.random() < 0.5 ? "camp_sertao_folha" : "camp_sertao_folha2";
            const leaf = this.add.sprite(x, y, kind, Math.floor(Math.random() * 4)).setScale(S).setDepth(y + 30).play(kind);
            this.tweens.add({ targets: leaf, x: x + wv.width * (0.6 + Math.random() * 0.5), duration: 5200 + Math.random() * 2600, ease: "Sine.easeInOut", onComplete: () => leaf.destroy() });
            this.tweens.add({ targets: leaf, y: y - 18, duration: 600 + Math.random() * 300, yoyo: true, repeat: 4, ease: "Quad.easeOut" }); // quiques
            this.tweens.add({ targets: leaf, alpha: 0, delay: 4400, duration: 900 });
          }
        } else if (Math.random() < (this._ancestral ? 0.8 : 0.55)) {
          const wv = cam.worldView; // o que está na tela (menor com o zoom de acessibilidade)
          const x = wv.x + Math.random() * wv.width,
            y = wv.y - 20;
          const leaf = this.add.image(x, y, "px_leaf").setScale(S).setTint((this._ancestral ? [0xc88a5a, 0xc7922b, 0xe3c37e, 0x9ccf62] : [0x9ccf62, 0xc7922b, 0x6aab4a])[Math.floor(Math.random() * (this._ancestral ? 4 : 3))]).setDepth(D_NIGHT - 5); // Ancestral: folhas de cobre
          const drift = (Math.random() - 0.5) * 240;
          this.tweens.add({ targets: leaf, y: y + this.H * (0.6 + Math.random() * 0.5), x: x + drift, duration: 6000 + Math.random() * 3000, ease: "Sine.easeIn", onComplete: () => leaf.destroy() });
          this.tweens.add({ targets: leaf, angle: { from: -40, to: 40 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
          this.tweens.add({ targets: leaf, alpha: 0, delay: 4800, duration: 1500 });
        }
        if (this._ancestral && (this._lightK ?? 1) < 0.6) {
          this._pollen();
          this._pollen();
        }
        const forge = this.buildings.forge;
        if (forge?.shown && Math.random() < 0.8) {
          const s = this.add.image(forge.x - 44 + Math.random() * 10, forge.y - 40, "px_dot1").setScale(3).setTint(Math.random() < 0.5 ? 0xffb36b : 0xffe58f).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 2);
          this.tweens.add({ targets: s, y: s.y - 50 - Math.random() * 40, x: s.x + (Math.random() - 0.5) * 30, alpha: 0, duration: 900 + Math.random() * 500, onComplete: () => s.destroy() });
        }
        const shrine = this.buildings.shrine;
        if (shrine?.shown && Math.random() < 0.6) {
          const m = this.add.image(shrine.x + (Math.random() - 0.5) * 70, shrine.y - 30, "px_dot1").setScale(3).setTint(0xffe58f).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_NIGHT + 2);
          this.tweens.add({ targets: m, y: m.y - 70 - Math.random() * 30, alpha: { from: 0.9, to: 0 }, duration: 1800, ease: "Sine.easeOut", onComplete: () => m.destroy() });
        }
      },
    });
  },
};
