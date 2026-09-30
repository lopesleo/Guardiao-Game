// Paleta ÚNICA do jogo (floresta ao entardecer). Toda arte procedural, UI e FX
// saem daqui — é o que amarra os assets de fontes diferentes num visual só.
// Tons escolhidos pra casar com o contorno ameixa-escuro do pack de criaturas.

export const PAL = {
  // Contorno / tinta
  ink: 0x1a1420,
  inkSoft: 0x2a2233,

  // Verdes (grama/folhagem) — rampa escuro → claro
  g0: 0x14261c,
  g1: 0x1d3a26,
  g2: 0x28522f,
  g3: 0x356b37,
  g4: 0x4a8a3f,
  g5: 0x6aab4a,
  g6: 0x9ccf62,

  // Verde-azulado (folhagem fria, sombras de copa)
  t0: 0x10201f,
  t1: 0x18342e,
  t2: 0x22493c,
  t3: 0x2f6450,

  // Terra / madeira
  n0: 0x2b1b17,
  n1: 0x45281f,
  n2: 0x62392a,
  n3: 0x875237,
  n4: 0xb07a4f,

  // Palha (telhados de sapê) e barro (fornos, fogão, ninho)
  straw0: 0x6e4f24,
  straw1: 0x9a7438,
  straw2: 0xc49a52,
  straw3: 0xe3c37e,
  clay0: 0x5e3320,
  clay1: 0x8a5230,
  clay2: 0xa86a3e,
  clay3: 0xc88a5a,

  // Pedra
  s0: 0x262a33,
  s1: 0x3b4150,
  s2: 0x59606f,
  s3: 0x7f8796,
  s4: 0xb3bac4,

  // Quentes
  red0: 0x5c1a24,
  red1: 0x9c2a35,
  red2: 0xe8434f,
  red3: 0xff8a8a,
  org1: 0xc4511e,
  org2: 0xff7a3c,
  org3: 0xffb36b,
  yel1: 0xc7922b,
  yel2: 0xf2c14e,
  yel3: 0xffe58f,
  cream: 0xf4ecd6,
  white: 0xffffff,

  // Frios
  ice0: 0x1f3b66,
  ice1: 0x2f6fb3,
  ice2: 0x5cc8ff,
  ice3: 0xbfeaff,
  pur0: 0x3a1f5c,
  pur1: 0x6b3fa0,
  pur2: 0xc78cff,
  pur3: 0xe8ccff,
  pink: 0xff7eb6,

  // UI
  uiBg: 0x0f1a16,
  uiPanel: 0x16241f,
  uiPanel2: 0x1f3329,
  uiLine: 0x0a100e,
  uiGold: 0xe0b458,
  uiGoldHi: 0xf6dd8c,
  uiGoldLo: 0x7a5a24,
  txt: 0xf4ecd6,
  txtMuted: 0x9fb4a4,
  txtDim: 0x8aa08f, // contraste ≥ 4,5:1 sobre os painéis (era 0x5d7266, ~2,6:1)
};

// "#rrggbb" a partir do número — pra estilos de texto do Phaser
export const hex = (n) => "#" + n.toString(16).padStart(6, "0");

// Cores CSS prontas (texto)
export const CSS = {
  txt: hex(PAL.txt),
  muted: hex(PAL.txtMuted),
  dim: hex(PAL.txtDim),
  gold: hex(PAL.yel2),
  goldHi: hex(PAL.yel3),
  ink: hex(PAL.ink),
  red: hex(PAL.red2),
  redHi: hex(PAL.red3),
  green: hex(PAL.g6),
  fire: hex(PAL.org2),
  ice: hex(PAL.ice2),
  bolt: hex(PAL.pur2),
};

// Cor por elemento (mesma em HUD, cartas, FX e números de dano)
export const ELEMENT_COLOR = {
  fire: PAL.org2,
  ice: PAL.ice2,
  bolt: PAL.pur2,
};
