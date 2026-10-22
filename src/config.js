// Balanceamento central. Tweak aqui, sem caçar números no código.
// Fórmulas paramétricas decididas no design (D16).
import { tr, localize } from "./i18n/i18n.js";

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE: 16,
  PIXEL_SCALE: 3, // sprite 16x16 renderizado como 48x48
  WORLD_RADIUS: 3400, // arena circular: 2× a ÁREA de antes (raio 2400). Subir muito pesa no aparelho fraco (decoração cresce com a área)
  MAX_ENEMIES_ALIVE: 80, // cap de pooling (D18)
  // Duração-base (7 min): é nela que o roteiro, as waves e a curva de spawn foram calibrados.
  // A duração real vem do Perigo (DIFFICULTY[].durationS); o jogo "estica" a curva por
  // pace = RUN_DURATION_S / durationS, então 10 min = a mesma jornada, mais devagar.
  RUN_DURATION_S: 420,
  // Teto de quadros por segundo. Telas de 90/120 Hz (o S23 rodava a partida a 120) gastam o dobro de
  // CPU, GPU e bateria para um jogo de pixel-art que não ganha nada com isso; esquenta e o aparelho
  // baixa o clock. 0 = sem teto. O tempo de jogo não muda (src/systems/FrameLimit.js).
  FPS_LIMIT: 60,
};

// Desempenho em aparelho fraco: tetos e ritmos que não mudam o jogo, só o custo dele
export const PERF = {
  // Números de dano: objetos criados de saída por estilo [cor, crítico, quantos] e teto total
  // (passou do teto, reaproveita um de outro estilo trocando o estilo — 3 redesenhos em vez de 1)
  DMG_NUMBER_PREWARM: [["#ffffff", false, 8], ["#ff9966", false, 6], ["#9ad4ff", false, 4], ["#d8a8ff", false, 4], ["#b8f0dc", false, 2], ["#ffd96b", true, 6]],
  DMG_NUMBER_CAP: 120,
  // Conquistas: abates e reações pedem a checagem; ela roda no máximo 1 vez por este intervalo
  // (a que ficar pendente sai no fim do intervalo, na pausa ou no fim da partida)
  ACHIEVEMENT_CHECK_MS: 1000,
  // Gemas de XP no chão: acima do teto, as mais longe do herói se fundem na vizinha mais próxima
  // (mais perto do herói) com o XP SOMADO — nada se perde. Conferido a cada GEM_CAP_CHECK_MS.
  GEM_CAP: 150,
  GEM_CAP_CHECK_MS: 250,
};

// Níveis de dificuldade ("Perigo") — ver docs/META_LOOP.md (Fase 1).
// Multiplicadores GLOBAIS aplicados sobre as fórmulas paramétricas (D16):
//   HP/dano de inimigo, taxa de spawn e recompensa em moedas.
// Cada nível libera o seguinte ao ser VENCIDO (boss morto). rewardMult é ACHATADO
// (econ. 2026-10): spawn × duração já pagam mais moedas por minuto nos Perigos altos;
// com 3,0× o Pesadelo rendia 4,2× o Aprendiz por minuto e esgotava a loja em dias.
// O grande prêmio para subir é firstClear: moedas pagas UMA vez, na 1ª vitória.
// durationS = tempo até o chefe nascer: 7 min nos Perigos iniciais, até 10 min no Pesadelo
// (novato = partida curta; veterano = mais profundidade).
export const DIFFICULTY = [
  { id: 0, name: "Aprendiz",   hpMult: 0.85, dmgMult: 0.85, spawnMult: 0.9,  rewardMult: 1.0,  firstClear: 150,  durationS: 420 },
  { id: 1, name: "Guardião",   hpMult: 1.0,  dmgMult: 1.0,  spawnMult: 1.0,  rewardMult: 1.15, firstClear: 300,  durationS: 420 },
  { id: 2, name: "Veterano",   hpMult: 1.25, dmgMult: 1.2,  spawnMult: 1.15, rewardMult: 1.35, firstClear: 600,  durationS: 480 },
  { id: 3, name: "Implacável", hpMult: 1.6,  dmgMult: 1.45, spawnMult: 1.3,  rewardMult: 1.6,  firstClear: 1000, durationS: 540 },
  { id: 4, name: "Pesadelo",   hpMult: 2.1,  dmgMult: 1.8,  spawnMult: 1.5,  rewardMult: 1.9,  firstClear: 1500, durationS: 600 },
];

export const PLAYER = {
  HP_BASE: 100,
  SPEED_BASE: 160,
  // Estilo Megabonk: MENOS níveis por partida (~15 aos 7:00, eram ~22) e cada carta pesa
  // mais (ver UpgradeSystem e PASSIVES). O 1º nível continua rápido (~4 abates).
  XP_PER_LEVEL: (lvl) => Math.floor(5 + lvl * 5 + lvl * lvl * 3),
  PICKUP_RADIUS: 36,
  INVULN_MS: 350, // i-frames pós-dano — menor = tick de dano de contato mais rápido
  // Despertar (★ DIFERENCIAL) — max escala com level pra evitar spam em late game
  AWAKEN_METER_MAX: (lvl) => 100 + (lvl - 1) * 25,
  AWAKEN_GAIN_REACTION: 12, // por reação elemental disparada (era 25)
  AWAKEN_GAIN_KILL: 1, // por inimigo morto
  AWAKEN_DURATION_MS: 6000,
  AWAKEN_CD_AFTER_MS: 1500, // pequeno alongamento pra evitar back-to-back
  AWAKEN_CD_MULT: 0.4,
  AWAKEN_SPEED_MULT: 1.4,
  // Dash
  DASH_SPEED_MULT: 4.5,
  DASH_DURATION_MS: 180,
  DASH_INVULN_MS: 280,
  DASH_CD_MS: 4000,
};

export const ENEMY = {
  // wave = floor(t / 30); a cada 30s sobe a wave
  // Curva: começo mais suave, late-game duro
  HP: (wave) => 12 + 6 * wave,
  // Estilo Vampire Survivors: ~8% da vida por batida no começo (era 2 + 1.6*wave, 2%).
  DMG: (wave) => 8 + 1.4 * wave,
  // Velocidades subidas (lobo 95→145, goblin 60→105): player (160) não pode
  // mais correr de TODO mundo de graça — kiting trivial era um exploit.
  SPEED_WOLF: 145,
  SPEED_CROW: 140,
  SPEED_GOBLIN: 105,
  SPAWN_RATE: (t) => 0.6 + t / 75,
  XP_VALUE: 3,
};

export const BOSS = {
  HP: 2000,
  PHASE2_AT_HP_PCT: 0.5,
  // O chefe tem de bater mais forte que o inimigo comum do fim da partida
  // (8 + 1,4 × onda ≈ 28 na onda 14). Antes: 12 e 8 fixos no código, ignorando esta config.
  DMG_MELEE: 40,
  DMG_PROJECTILE: 24, // × multiplicador de dano do Perigo

  SPEED: 60,
  ROAR_DURATION_MS: 1500,

  // Couraça da Podridão: com vida fixa, uma build forte (~300 de dano/s no alvo, nível 15)
  // libertava o chefe em ~7 s, antes de ver um golpe. O chefe mede o dano que vem levando
  // (média móvel de TAU_S) e, acima do ritmo de referência (vida ÷ TARGET_S), resiste ao
  // excesso: dano efetivo = ref × (ritmo/ref)^KEEP. Quem bate mais vence antes, mas sempre
  // há luta. KEEP 0,25 → 0,45 (05/10/2026): com 0,25 uma build 8× mais forte vencia só 1,7×
  // mais rápido (60 s → 35 s) e a build boa não se sentia; agora ~35 dano/s → ~60 s,
  // ~120 → ~34 s, ~300 → ~22 s (uns 6 golpes, fúria incluída). O ponto fraco (EXPOSTO)
  // multiplica DEPOIS da couraça: desviar continua valendo. Quando ela segura mais que
  // (1 − SHOW_BELOW) do golpe, o número sai cinza, o chefe pisca cinza-pedra e solta lascas
  // da Podridão (no máximo a cada FX_MS).
  ARMOR: { TARGET_S: 60, KEEP: 0.45, TAU_S: 3, SHOW_BELOW: 0.75, FX_MS: 220 },
};

// Golpes especiais dos chefes (ver docs/CHEFES.md). Regras de JUSTIÇA que valem para todos:
//  · todo golpe avisa antes, com forma própria (círculo, cone, faixa, anel com brecha, leque)
//    e som próprio; o aviso e o golpe andam no MESMO relógio (hit-stop/congelar pausam os dois);
//  · todo golpe dá para evitar SÓ ANDANDO (o Dash é desbloqueável); o Dash facilita;
//  · um golpe por vez: o próximo só começa depois que o anterior termina (+ fôlego);
//  · golpes grandes deixam o chefe EXPOSTO (ponto fraco): leva mais dano por um instante.
// Dano: "× dano" multiplica o dano de contato do chefe (que já tem Perigo e onda embutidos).
export const BOSS_FIGHT = {
  EXPOSED_MULT: 1.5, // dano recebido com o ponto fraco à mostra
  DODGE_AWAKEN: 6, // desviar de um golpe enche o Despertar (reação dá 12)
  DODGE_FEEDBACK_GAP_MS: 500,
  // "Desviou de tudo": nenhum golpe especial acertou (com pelo menos MIN_SPECIALS tentados)
  FLAWLESS_MIN_SPECIALS: 3,
  FLAWLESS_WOOD: { MINIBOSS: 1, BOSS: 2 },
  ENGAGE_DIST: 560, // minichefe só usa especial dentro da tela (nunca de fora da visão)
  AIM_BIAS: 0.4, // mira automática: o chefe "conta" como se estivesse a 40% da distância
  // Horda ao nascer o chefe: antes sumia TODA e a luta ficava vazia e fácil. Ele espanta os
  // de tiro (tiro somado aos avisos dos golpes deixaria de ser "evitável andando"), os do
  // lugar onde chega (CLEAR_R) e o excesso: ficam os MAX_ALIVE mais perto do herói. Não nasce
  // horda nova na luta (lab 2026-10-02: com reforço contínuo os lobos "comiam" a mira
  // automática e builds fracas levavam 2–5 min); os reforços são os que o chefe invoca.
  ADDS: { MAX_ALIVE: 8, CLEAR_R: 300, RANGED: ["goblin", "crow", "mage"] },

  MULA: {
    GAP_MS: [1700, 1100], // fôlego entre golpes (fase 1, fase 2 abaixo de 50%)
    CHARGE: { windupMs: 800, rewindMs: 620, len: 520, width: 92, speed: 680, dmg: 1.3, chain: [1, 3], exposedMs: 900 },
    TRAIL: { every: 34, r: 24, lifeMs: 2400, tickMs: 400, dmg: 0.22 }, // rastro de fogo do galope
    KICK: { windupMs: 850, range: 150, halfAngle: 0.8, dmg: 1.5, push: 110, exposedMs: 500 },
    EMBERS: { windupMs: 1000, staggerMs: 130, n: [5, 7], r: 54, sep: 2.25, spread: 240, dmg: 1.0, fireMs: 1800 },
  },
  SECO: {
    GAP_MS: [1900, 1300],
    DRAIN: { warnMs: 760, channelMs: 1800, r: 190, tickMs: 300, dmg: 0.12, heal: 3, exposedMs: 1800 },
    BURROW: { sinkMs: 560, travelMs: 1500, speed: 150, warnMs: 820, r: 108, dmg: 1.0, exposedMs: 1700 },
    VINES: { windupMs: 900, len: 540, width: 54, dmg: 0.7, liveMs: 520, secondDelayMs: 650 },
  },
  MAPI: {
    GAP_MS: [1500, 900],
    SLAM: { windupMs: 760, r: 180, dmg: 1.0 },
    ROOTS: { warnMs: 1100, r: 95, rootMs: 1200, slamDelayMs: 450 },
    LUNGE: { windupMs: 800, len: 420, width: 120, speed: 640, dmg: 1.0, exposedMs: 1000 },
    MAW: { openMs: 520, inhaleMs: 1900, pull: 92, r: 100, dmg: 1.4, exposedMult: 1.7 },
    SCREAM: { windupMs: 950, rings: [3, 4], everyMs: 820, speed: 290, maxR: 900, band: 24, gap: 1.35, shift: 0.75, shiftPx: 80, dmg: 0.75 },
    GAZE: { windupMs: 1250, sweepMs: 1150, arc: 1.7, len: 600, blind: 80, startPx: 90, halfWidth: 0.075, dmg: 1.3, exposedMs: 1300 },
    FAN: { windupMs: 720, n: 7, spread: 0.16, speed: 230 },
  },
  // Caboclo d'Água (chefe da Caatinga): o rio que ele traz para o sertão
  CABOCLO: {
    GAP_MS: [1500, 950],
    // Cheia: faixas paralelas de água na direção do herói (fúria: depois, outra em cruz)
    CHEIA: { windupMs: 1050, crossWindupMs: 800, lanes: [3, 4], width: 84, period: 210, back: 240, len: 1150, liveMs: 520, dmg: 0.9 },
    // Rebojo: redemoinhos que puxam (devagar: andar sempre vence) e engolem quem ficar
    REBOJO: { warnMs: 1400, n: [3, 4], r: 84, sep: 235, pull: 58, pullR: 150, dmg: 1.0 },
    // Arrastão: investida em faixa. Na CARRANCA ele se espanta: fica exposto bem mais tempo
    ARRASTAO: { windupMs: 850, len: 560, width: 112, speed: 660, dmg: 1.1, exposedMs: 800, scaredMs: 2600, scaredMult: 1.8 },
    // Pedras do Rio: pedras caem onde o herói está, uma atrás da outra
    PEDRADA: { warnMs: 820, n: [3, 5], everyMs: 430, r: 62, dmg: 0.8 },
    // Tromba d'Água (fúria): coluna d'água que persegue devagar e estoura no fim
    TROMBA: { windupMs: 800, chaseMs: 3400, speed: 112, r: 46, splashWarnMs: 850, splashR: 110, dmg: 0.5, splashDmg: 1.0, exposedMs: 1400 },
    // Carrancas: figuras de proa que espantam o Caboclo (lenda do São Francisco)
    CARRANCAS: { n: 3, dist: 270, r: 34, respawnMs: 9000, far: 760, minBoss: 150 },
  },
};

// Elementos & reações (D11, D21)
export const ELEMENT = { FIRE: "fire", ICE: "ice", BOLT: "bolt", WIND: "wind" };

export const STATUS = {
  FIRE: { duration: 4000, tickMs: 500, dmgPerTick: 1 },
  ICE: { duration: 3000, slowFactor: 0.5, damageAmp: 1.35 },
  BOLT: { duration: 2000, tickMs: 125, dmgPerTick: 0.5 },
  // Vento: "ventado" — mais leve (−15% de velocidade) e o vento o arrasta para longe do herói
  WIND: { duration: 2200, slowFactor: 0.85, drift: 38 },
};

// Como cada status aparece no inimigo (ElementalSystem._updateTint): tinta OVERLAY numa cor da PALETA (chave de PAL;
// k escurece a cor). O modo vai por vértice: custo zero. O OVERLAY recolore o bicho inteiro no elemento e guarda o
// desenho: nos tons escuros multiplica por 2×cor (o contorno de tinta continua escuro, só puxa para o elemento) e nos
// claros clareia na mesma proporção — o sombreado e o olho ficam. Medido nos 15 monstros × 6 ambientes (início,
// noite e chefe dos dois biomas; 21/10/2026), contra o bicho sem status:
//  - presença (ΔE médio por pixel): 17–25 em média (era 5–13 com MULTIPLY, que só escurecia e sumia no escuro);
//  - contorno (L* do corpo − L* do contorno) ≥ 100% do original e sombreado (variação de cor no corpo) ≥ 88%, no
//    pior caso. ADD forte estoura e SCREEN comprime o contraste: os dois viravam um borrão pastel.
// O raio PULSA entre tint e pulse×pulseK (PULSE_MS): para quem confunde azul e roxo (protanopia/deuteranopia), raio,
// gelo e congelado se separam pelo movimento e pela luz — o gelo é azul e parado, o congelado é claro e imóvel (a
// animação para), o raio vibra.
// (MULTIPLY_TWO e HARD_LIGHT não desenham neste Phaser 4.2.1: o shader compara o modo com == e 6/7 chegam com
// erro de arredondamento — o bicho sai sem tinta. OVERLAY (5) desenha. Ficar nos modos 0–5.)
// glow: cor da luz do inimigo no mapa de luz (Lighting), no lugar da luz da corrupção e mais fraca que ela; no
// máximo GLOW_MAX por quadro (numa horda em chamas o resto fica com a luz de sempre: ilumina sem pintar o cenário)
export const STATUS_LOOK = {
  fire: { mode: "OVERLAY", tint: "org2", glow: 0xff8a3c },
  ice: { mode: "OVERLAY", tint: "ice2", glow: 0x5cc8ff },
  bolt: { mode: "OVERLAY", tint: "pur2", pulse: "pur3", glow: 0xc78cff },
  wind: { mode: "OVERLAY", tint: "wnd2", glow: 0x7fd9bd },
  frozen: { mode: "OVERLAY", tint: "white", glow: 0x9fe8ff },
  PULSE_MS: 420, // período da vibração do raio (≈2,4 Hz: abaixo de 3 Hz, sem risco de fotossensibilidade)
  GLOW_R: 56, // raio da luz do inimigo com status (a da corrupção: 58)
  GLOW_A: 0.34, // força dessa luz (a da corrupção: 0,4)
  GLOW_MAX: 8, // teto de luzes de status por quadro
};

// Libertação do chefe (GameScene._freeBoss), o clímax de toda vitória. Tempos em ms, um depois do outro; a soma
// é quando a escolha da Noite Eterna abre
export const LIBERATION = {
  GRIP_MS: 220, // a Podridão toma o corpo inteiro (silhueta chapada na cor dela) e ele inspira
  HEAT_MS: 520, // a silhueta esquenta da Podridão até virar luz
  REVEAL_MS: 980, // estalo: a luz se apaga (passando pelo verde-vida) e revela a lenda na cor natural
  STAY_MS: 330, // a lenda livre respira
  LEAVE_MS: 550, // e volta para a mata (sobe e some)
  SEEP_MS: 30, // um esporo escapa a cada tanto enquanto a Podridão esquenta
  BURST: 96, // revoada de esporos no estalo
  LIFE: [1100, 1900], // vida de cada esporo
  PUSH: 0.5, // força do GravityWell NEGATIVO no peito do chefe: empurra os esporos para fora (cai com o
  // quadrado da distância: forte no corpo, quase nada a dois palmos)
};

// Dano das reações FIXO (só × Prisma), por decisão medida em 13/10/2026: elas já fazem 25–60% do
// dano na horda em qualquer minuto e Perigo. Ver docs/BALANCING.md antes de escalar ou cortar.
export const REACTION = {
  // Fôlego por inimigo depois de reagir: os status pegam, mas só reagem de novo depois disto
  LOCK_MS: 900,
  // FIRE + ICE => Vapor: nuvem ESCALDANTE que causa dano contínuo na área (não dá mais slow)
  VAPOR: {
    color: 0xffc8a0,
    radius: 80,
    duration: 2200, // era 3000: nuvens não têm cap de concorrência, encurtar evita carpete de DoT
    dmgPerTick: 4,
    tickMs: 300,
    mergeDist: 0.8, // Vapor novo a menos de 0,8 raio de uma nuvem viva só a renova
    label: "VAPOR!",
  },
  // GELO + RAIO => Cristal: o inimigo ESTILHAÇA em lascas que ferem quem está perto.
  // CONGELADO + raio = estilhaço forte (frozenMult / frozenRadiusMult).
  CRYSTAL: {
    color: 0x9fe8ff,
    radius: 76,
    dmg: 20,
    selfDmg: 14, // o próprio alvo também quebra
    frozenMult: 1.8,
    frozenRadiusMult: 1.3,
    shards: 8,
    label: "CRISTAL!",
  },
  // FIRE + BOLT => Sobrecarga: a recompensa em ÁREA — corrente forte entre muitos inimigos
  // ---- reações do VENTO ----
  // FOGO + VENTO => Labareda: o vento espalha a chama para os vizinhos
  LABAREDA: {
    color: 0xffa040,
    dmg: 12,
    spread: 5, // vizinhos que pegam fogo
    radius: 120,
    label: "LABAREDA!",
  },
  // GELO + VENTO => Geada: rajada fria em volta; deixa lento e congela quem já estava gelado
  GEADA: {
    color: 0xd2fbe9,
    dmg: 10,
    radius: 96,
    slow: 0.4,
    slowMs: 1500,
    freezeMs: 900,
    label: "GEADA!",
  },
  // RAIO + VENTO => Temporal: o vento arma a tempestade e raios caem do céu em volta
  TEMPORAL: {
    color: 0x9fe3ff,
    strikes: 3,
    dmg: 12,
    radius: 170,
    label: "TEMPORAL!",
  },
  OVERLOAD: {
    color: 0xffe24c,
    jumps: 4, // era 6: com armas de área (Redemoinho, Sopro) virava 70% do dano
    dmgPerJump: 13,
    jumpRange: 220,
    label: "SOBRECARGA!",
  },
};

// Armas base + evoluções (D14)
export const WEAPONS = {
  STAFF: {
    name: "Cajado",
    desc: "Bola de fogo no inimigo mais próximo.",
    icon: "ico_staff",
    mods: ["dmg", "cd", "proj"], // melhorias que as cartas sorteiam
    unlock: { start: true },
    element: ELEMENT.FIRE,
    baseDmg: 10, // era 7: alvo único precisa render no chefe (laboratório de equilíbrio)
    cooldown: 1100,
    range: 210, // era 280: atirava em inimigo quase na borda da tela
    projSpeed: 300,
  },
  // Aura Gélida: campo de CONTROLE. Dano de chip + slow; quem fica 1s dentro CONGELA.
  AURA: {
    name: "Aura Gélida",
    desc: "Campo gélido: dano contínuo e congela quem demora dentro.",
    icon: "ico_aura",
    mods: ["dmg", "cd", "range"],
    unlock: { start: true },
    element: ELEMENT.ICE,
    baseDmg: 2,
    cooldown: 1200,
    range: 120,
    freezeAfterMs: 900,
    freezeMs: 1300,
    freezeImmuneMs: 3000,
  },
  // Vara Encantada (da Caipora): a lenda dá a ela uma vara mágica; aqui ela vem
  // acesa em brasa, gira, atravessa o bando e volta para a mão.
  BOOMER: {
    name: "Vara Encantada",
    desc: "A vara da Caipora, acesa em brasa: gira, atravessa e volta.",
    icon: "ico_boomer",
    mods: ["dmg", "cd", "range"],
    unlock: { forge: 1, cost: 30 },
    element: ELEMENT.FIRE,
    baseDmg: 3, // era 4: atravessa o bando e queima todos (era o mais forte no bando)
    cooldown: 1600,
    range: 240,
    projSpeed: 280,
  },
  // Raio: dano ALTO focado em 1 alvo. (A "corrente" agora é a reação Sobrecarga: fogo+raio.)
  CHAIN: {
    name: "Raio Concentrado",
    desc: "Raio de dano alto; prefere alvos já afetados.",
    icon: "ico_bolt",
    mods: ["dmg", "cd", "proj"],
    unlock: { forge: 2, cost: 60 },
    element: ELEMENT.BOLT,
    baseDmg: 20, // era 15: o melhor contra o chefe, fraco no bando
    cooldown: 1800,
    range: 190,
  },
  // ===== EVOLUÇÕES (Fase 4 do meta-loop — feature nº1 do gênero) =====
  // Receita: arma-âncora (evolvesFrom) no Lv5 + parceira (partner) na run →
  // carta ★ EVOLUÇÃO garantida no próximo level-up. A evolução SUBSTITUI a
  // âncora, herda os multiplicadores comprados e fica em nível MAX.
  // Tempestade de Vapor: projéteis de fogo que EXPLODEM em nuvem escaldante
  // (mini-Vapor) no impacto — o Cajado vira dano em área.
  VAPOR_STORM: {
    name: "Tempestade de Vapor",
    reaction: "VAPOR", // a reação sai por código próprio da arma (não via also)
    desc: "As bolas de fogo EXPLODEM em nuvem escaldante no impacto.",
    icon: "ico_cloud_hot",
    element: ELEMENT.FIRE,
    evolvesFrom: "STAFF",
    partner: "AURA",
    baseDmg: 12,
    cooldown: 850,
    range: 240, // era 300 (acompanha o Cajado, 280 → 210)
    projSpeed: 320,
    cloud: { radius: 55, dmgPerTick: 4, tickMs: 300, duration: 1400, color: 0xffc8a0 },
  },
  // Sobrecarga Eterna: o raio volta a ENCADEAR — acerta o alvo prioritário e
  // salta entre inimigos próximos com dano decrescente, aplicando bolt em todos.
  OVERLOAD_X: {
    name: "Sobrecarga Eterna",
    desc: "O raio SALTA em cadeia entre até 5 inimigos.",
    icon: "ico_bolt_gold",
    element: ELEMENT.BOLT,
    evolvesFrom: "CHAIN",
    partner: "STAFF",
    baseDmg: 22,
    cooldown: 1500,
    range: 220,
    jumps: 4, // saltos além do 1º alvo
    jumpRange: 210,
    falloff: 0.75, // dano por salto
  },
  // Coração do Inverno: a aura pulsa uma NOVA de estilhaços periódica que
  // causa dano + aplica gelo num raio bem maior — gelo finalmente OFENSIVO.
  WINTER_HEART: {
    name: "Coração do Inverno",
    desc: "A aura pulsa NOVAS de estilhaços que congelam de longe.",
    icon: "ico_heart_ice",
    element: ELEMENT.ICE,
    evolvesFrom: "AURA",
    partner: "CHAIN",
    baseDmg: 3,
    cooldown: 1100,
    range: 130,
    freezeAfterMs: 800,
    freezeMs: 1400,
    freezeImmuneMs: 2800,
    nova: { everyMs: 2800, dmg: 14, radiusMult: 2.2, shards: 12 },
  },
  // Boitatá (a cobra de fogo que guarda a mata): a vara deixa um RASTRO DE CHAMAS no trajeto — zonas que
  // queimam (dano + status fire) quem cruza o caminho.
  PHOENIX: {
    name: "Boitatá",
    desc: "A vara vira a cobra de fogo: RASTRO DE CHAMAS pelo caminho.",
    icon: "ico_flame_pink",
    element: ELEMENT.FIRE,
    evolvesFrom: "BOOMER",
    partner: "STAFF",
    baseDmg: 7,
    cooldown: 1300,
    range: 260,
    trail: { everyMs: 150, radius: 42, dmgPerTick: 3, tickMs: 300, ticks: 3 },
  },
  // Orbe Gélido: orbes de gelo GIRAM ao redor do player (defesa passiva).
  // cooldown = intervalo mínimo entre acertos no MESMO inimigo.
  ORB: {
    name: "Orbe Gélido",
    desc: "Orbes de gelo giram ao seu redor e resfriam quem tocam.",
    icon: "ico_orb",
    mods: ["dmg", "proj"],
    plus: "+1 Orbe",
    unlock: { forge: 3, cost: 300, deed: { stat: "VAPOR", n: 60, text: "Faça {n} Vapores (fogo + gelo)" } },
    element: ELEMENT.ICE,
    baseDmg: 5,
    cooldown: 650,
    range: 88, // raio da órbita
    count: 2,
    spin: 2.6, // rad/s
    hitRadius: 26,
  },
  // Sopro Flamejante: cone de fogo na direção em que o player anda.
  FLAME: {
    name: "Sopro Flamejante",
    desc: "Sopro de fogo em cone na direção em que você anda.",
    icon: "ico_flame",
    mods: ["dmg", "cd", "range"],
    unlock: { forge: 4, cost: 600, deed: { stat: "win1", n: 1, text: "Vença o Mapinguari no Perigo Guardião ou acima" } },
    element: ELEMENT.FIRE,
    baseDmg: 6,
    cooldown: 1250,
    range: 165,
    halfAngle: 0.62, // ~35°
  },
  // Geleira (Orbe Lv5 + Aura): orbes maiores, 2 extras, e CONGELAM ao tocar.
  GLACIER: {
    name: "Geleira Viva",
    desc: "Os orbes crescem e CONGELAM na hora quem tocam.",
    icon: "ico_orb_frost",
    element: ELEMENT.ICE,
    evolvesFrom: "ORB",
    partner: "AURA",
    baseDmg: 9,
    cooldown: 550,
    range: 104,
    count: 4,
    spin: 3.0,
    hitRadius: 34,
    freezeMs: 1100,
    freezeImmuneMs: 2600,
  },
  // Inferno (Sopro Lv5 + Vara Encantada): cone largo que deixa o chão em chamas.
  INFERNO: {
    name: "Inferno",
    desc: "O sopro vira um INFERNO que deixa o chão em chamas.",
    icon: "ico_flame_red",
    element: ELEMENT.FIRE,
    evolvesFrom: "FLAME",
    partner: "BOOMER",
    baseDmg: 10,
    cooldown: 1000,
    range: 220,
    halfAngle: 0.85,
    trail: { radius: 40, dmgPerTick: 4, tickMs: 300, ticks: 4 },
  },
  // ===== Leva 2: 3 por elemento (ver docs/ARMAS_E_COMBOS.md) =====
  // Vaga-lumes: enxame TELEGUIADO — cada um persegue um inimigo diferente.
  // DPS total ~ Raio Concentrado, mas espalhado (bom contra bando, fraco no chefe).
  FIREFLY: {
    name: "Vaga-lumes",
    desc: "Vaga-lumes teleguiados caçam inimigos diferentes.",
    icon: "ico_firefly",
    mods: ["dmg", "cd", "proj"],
    plus: "+1 Vaga-lume",
    unlock: { forge: 2, cost: 150, deed: { stat: "kills", n: 1500, text: "Abata {n} criaturas" } },
    element: ELEMENT.BOLT,
    baseDmg: 4,
    cooldown: 1500,
    range: 300, // busca de alvo
    count: 3,
    speed: 300,
    turn: 7, // rad/s de curva
    lifeMs: 2600,
    hitRadius: 18,
  },
  // Granizo: pedras caem do céu em inimigos AO ACASO na tela (dano em área + gelo).
  // Quem já estava resfriado CONGELA — combina com Aura/Orbe e prepara o Cristal.
  HAIL: {
    name: "Granizo",
    desc: "Granizo cai em inimigos pela tela; congela quem já está gelado.",
    icon: "ico_hail",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Pedra",
    unlock: { forge: 3, cost: 400, deed: { stat: "CRYSTAL", n: 40, text: "Faça {n} Cristais (gelo + raio)" } },
    element: ELEMENT.ICE,
    baseDmg: 6,
    cooldown: 2000,
    range: 320,
    count: 2,
    radius: 44,
    fallMs: 450,
    freezeMs: 900,
    freezeImmuneMs: 2600,
  },
  // Redemoinho (do Saci): funil que nasce no inimigo mais próximo, anda atrás do
  // bando e PUXA quem está perto. Dano por tique em área. Controle de multidão.
  WHIRL: {
    name: "Redemoinho",
    desc: "Redemoinho de vento do Saci: persegue o bando e puxa todos para o centro.",
    icon: "ico_whirl_wind",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Redemoinho",
    unlock: { forge: 4, cost: 900, deed: { stat: "OVERLOAD", n: 60, text: "Faça {n} Sobrecargas (fogo + raio)" } },
    element: ELEMENT.WIND, // o redemoinho do Saci é VENTO (era raio)
    baseDmg: 2, // por tique; era 3 (2× o dano das outras armas de área no bando)
    cooldown: 3800,
    range: 260,
    count: 1,
    radius: 54,
    durationMs: 3200,
    tickMs: 520,
    speed: 80,
    pull: 45, // px/s puxando para o centro
  },
  // Revoada (Vaga-lumes Lv5 + Orbe): mais vaga-lumes; cada um que acerta se DIVIDE
  // em 2 filhotes (uma vez) que caçam outros alvos.
  SWARM: {
    name: "Revoada",
    desc: "Mais vaga-lumes; cada um que acerta se DIVIDE em dois.",
    icon: "ico_firefly_gold",
    element: ELEMENT.BOLT,
    evolvesFrom: "FIREFLY",
    partner: "ORB",
    baseDmg: 6,
    cooldown: 1250,
    range: 340,
    count: 5,
    speed: 340,
    turn: 8,
    lifeMs: 3000,
    hitRadius: 20,
    split: { n: 2, dmgMult: 0.6 },
  },
  // Tempestade de Granizo (Granizo Lv5 + Raio): mais pedras e maiores, que congelam
  // na hora; um congelado da área leva um raio do céu → CRISTAL dentro da própria arma.
  HAILSTORM: {
    name: "Tempestade de Granizo",
    reaction: "CRYSTAL", // a reação sai por código próprio da arma (não via also)
    desc: "Pedras que CONGELAM na hora, e um RAIO do céu as estilhaça.",
    icon: "ico_hail_storm",
    element: ELEMENT.ICE,
    evolvesFrom: "HAIL",
    partner: "CHAIN",
    baseDmg: 9,
    cooldown: 1600,
    range: 360,
    count: 4,
    radius: 54,
    fallMs: 380,
    freezeMs: 1100,
    freezeImmuneMs: 2400,
    freezeOnHit: true, // a pedra da evolução congela direto (sem precisar resfriar antes)
    strike: { max: 1, dmg: 10 }, // raio por pedra (só em congelado) → Cristal
  },
  // Redemoinho de Brasa (Redemoinho Lv5 + Sopro): funil maior que alterna FOGO e
  // VENTO a cada tique → dispara LABAREDA sozinho.
  FIRE_WHIRL: {
    name: "Redemoinho de Brasa",
    reaction: "LABAREDA", // a reação sai por código próprio da arma (não via also)
    desc: "Funil de BRASA: alterna fogo e vento e causa LABAREDA.",
    icon: "ico_whirl_fire",
    element: ELEMENT.WIND,
    evolvesFrom: "WHIRL",
    partner: "FLAME",
    baseDmg: 4,
    cooldown: 3200,
    range: 300,
    count: 1,
    radius: 70,
    durationMs: 4400,
    tickMs: 420,
    speed: 95,
    pull: 70,
  },
  // ===== Leva 3: 5 por elemento (ver docs/ARMAS_E_COMBOS.md) =====
  // Açoite de Urtiga (Comadre Fulozinha): golpe CORPO A CORPO em arco na direção do
  // inimigo mais próximo; queima e empurra. Estilo de risco: rende perto do chefe.
  LASH: {
    name: "Açoite de Urtiga",
    desc: "Açoite da Comadre Fulozinha: estala em arco de perto, queima e empurra.",
    icon: "ico_lash",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Açoite",
    unlock: { forge: 4, cost: 1000, deed: { stat: "miniBosses", n: 6, text: "Derrote {n} minichefes" } },
    element: ELEMENT.FIRE,
    baseDmg: 10,
    cooldown: 1000,
    range: 118, // alcance do chicote
    halfAngle: 1.05, // ~60° para cada lado
    push: 34, // empurrão (px) em quem não é chefe/minichefe
  },
  // Bola de Ouro (Mãe-do-Ouro): bola dourada que RICOCHETEIA de inimigo em inimigo.
  GOLDBALL: {
    name: "Bola de Ouro",
    desc: "A bola de fogo da Mãe-do-Ouro ricocheteia de inimigo em inimigo.",
    icon: "ico_goldball",
    mods: ["dmg", "cd", "proj"],
    plus: "+1 Bola",
    unlock: { forge: 4, cost: 1100, deed: { stat: "chests", n: 40, text: "Abra {n} baús" } },
    element: ELEMENT.BOLT,
    baseDmg: 6,
    cooldown: 1600,
    range: 260,
    speed: 430,
    bounces: 4, // acertos depois do primeiro
    bounceRange: 230,
  },
  // Miragem (Anhangá): uma ilusão do veado branco que ATRAI o bando (iscas); quem
  // encosta esfria; no fim ela se desfaz numa explosão de geada.
  MIRAGE: {
    name: "Miragem",
    desc: "Ilusão do Anhangá: atrai o bando, esfria quem encosta e estoura em geada.",
    icon: "ico_mirage",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Miragem",
    unlock: { forge: 4, cost: 1200, deed: { stat: "flawless", n: 2, text: "Desvie de tudo em {n} lutas de chefe" } },
    element: ELEMENT.ICE,
    baseDmg: 2, // por tique em quem encosta
    cooldown: 4200,
    range: 170, // distância em que a ilusão aparece
    count: 1,
    lureR: 230,
    durationMs: 3200,
    tickMs: 600,
    touchR: 40,
    burst: { dmg: 8, r: 86 },
  },
  // Fogueira de São João: ARMADILHA fixa — planta fogueiras no caminho que queimam
  // quem passa. Até `max` acesas ao mesmo tempo.
  BONFIRE: {
    name: "Fogueira de São João",
    desc: "Planta fogueiras no caminho que queimam quem passa.",
    icon: "ico_bonfire",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Fogueira",
    unlock: { forge: 2, cost: 500 },
    element: ELEMENT.FIRE,
    baseDmg: 2.5, // por tique
    cooldown: 2300,
    range: 9999,
    radius: 48,
    durationMs: 5200,
    tickMs: 500,
    max: 3,
  },
  // Boleadeira (gaúcha): três pedras numa corda que AMARRAM até 3 inimigos juntos
  // (puxa um para o outro e quase não andam) e esfriam.
  BOLAS: {
    name: "Boleadeira",
    desc: "Três pedras na corda: amarram até 3 inimigos juntos e esfriam.",
    icon: "ico_bolas",
    mods: ["dmg", "cd", "proj"],
    plus: "+1 Boleadeira",
    unlock: { forge: 3, cost: 700, deed: { stat: "CRYSTAL", n: 80, text: "Faça {n} Cristais (gelo + raio)" } },
    element: ELEMENT.ICE,
    baseDmg: 8,
    cooldown: 2000,
    range: 270,
    count: 1,
    speed: 380,
    bindR: 80,
    bindN: 3,
    bindMs: 1500,
    bindSlow: 0.2, // velocidade dos amarrados
  },
  // Tambor do Trovão: ONDA em anel que sai do herói, acerta cada um uma vez e empurra.
  DRUM: {
    name: "Tambor do Trovão",
    desc: "Onda de trovão em anel: acerta todos em volta e empurra.",
    icon: "ico_drum",
    mods: ["dmg", "cd", "range"],
    unlock: { forge: 3, cost: 850, deed: { stat: "OVERLOAD", n: 100, text: "Faça {n} Sobrecargas (fogo + raio)" } },
    element: ELEMENT.BOLT,
    baseDmg: 4.5,
    cooldown: 2800,
    range: 150, // raio final da onda
    growMs: 360,
    push: 26,
  },
  // ----- evoluções da leva 3 (cada uma faz uma reação SOZINHA) -----
  // Laçada de Urtiga (Açoite + Boleadeira): a ponta do açoite enlaça com geada →
  // fogo + gelo = VAPOR em quem leva a ponta.
  LACADA: {
    name: "Laçada de Urtiga",
    desc: "A ponta do açoite enlaça com geada: fogo + gelo = VAPOR.",
    icon: "ico_lash_ice",
    also: ["ice"], // aplica também este elemento: a reação sai sozinha
    element: ELEMENT.FIRE,
    evolvesFrom: "LASH",
    partner: "BOLAS",
    baseDmg: 14,
    cooldown: 850,
    range: 150,
    halfAngle: 1.3,
    push: 40,
    tipFrac: 0.45, // fração externa do alcance que leva gelo também
    bindMs: 700,
  },
  // Minuano (Boleadeira + Tambor): o vento frio do Sul com trovão — os amarrados levam
  // um raio pouco depois → gelo + raio = CRISTAL.
  MINUANO: {
    name: "Minuano",
    desc: "Vento frio com trovão: os amarrados levam um raio = CRISTAL.",
    icon: "ico_bolas_storm",
    also: ["bolt"], // aplica também este elemento: a reação sai sozinha
    element: ELEMENT.ICE,
    evolvesFrom: "BOLAS",
    partner: "DRUM",
    baseDmg: 9,
    cooldown: 1900,
    range: 300,
    count: 2,
    speed: 420,
    bindR: 95,
    bindN: 4,
    bindMs: 1800,
    bindSlow: 0.15,
    zap: { delayMs: 450, dmg: 10 },
  },
  // Trovão de Brasa (Tambor + Açoite): batida dupla; cada onda é fogo E raio →
  // SOBRECARGA no anel.
  BRASA_TROVAO: {
    name: "Trovão de Brasa",
    desc: "Batida dupla de fogo e raio: SOBRECARGA no anel.",
    icon: "ico_drum_fire",
    also: ["fire"], // aplica também este elemento: a reação sai sozinha
    element: ELEMENT.BOLT,
    evolvesFrom: "DRUM",
    partner: "LASH",
    baseDmg: 10,
    cooldown: 2000,
    range: 215,
    growMs: 380,
    push: 34,
    double: true,
  },
  // Arraial (Fogueira + Bola de Ouro): fogueiras maiores que soltam FOGOS dourados
  // (raio) em quem está perto → fogo + raio = SOBRECARGA.
  ARRAIAL: {
    name: "Arraial",
    desc: "Fogueiras maiores soltam FOGOS dourados: fogo + raio = SOBRECARGA.",
    icon: "ico_bonfire_gold",
    also: ["bolt"], // aplica também este elemento: a reação sai sozinha
    element: ELEMENT.FIRE,
    evolvesFrom: "BONFIRE",
    partner: "GOLDBALL",
    baseDmg: 6,
    cooldown: 1900,
    range: 9999,
    radius: 58,
    durationMs: 6000,
    tickMs: 400,
    max: 4,
    fireworks: { everyMs: 900, dmg: 8, r: 190 },
  },
  // Ouro Encantado (Bola de Ouro + Miragem): a bola vira ouro gelado — cada ricochete
  // é gelo E raio → CRISTAL em quem ela acerta.
  OURO_ENCANTADO: {
    name: "Ouro Encantado",
    desc: "Ouro gelado: cada ricochete é gelo + raio = CRISTAL.",
    icon: "ico_goldball_ice",
    also: ["ice"], // aplica também este elemento: a reação sai sozinha
    element: ELEMENT.BOLT,
    evolvesFrom: "GOLDBALL",
    partner: "MIRAGE",
    baseDmg: 9,
    cooldown: 1350,
    range: 290,
    speed: 470,
    bounces: 6,
    bounceRange: 250,
  },
  // Visagem (Miragem + Fogueira): duas aparições na fumaça; quem encosta esfria e, no
  // fim, elas estouram em fogo E geada → VAPOR.
  VISAGEM: {
    name: "Visagem",
    desc: "Duas aparições na fumaça que estouram em fogo + geada = VAPOR.",
    icon: "ico_mirage_fire",
    also: ["fire"], // aplica também este elemento: a reação sai sozinha
    element: ELEMENT.ICE,
    evolvesFrom: "MIRAGE",
    partner: "BONFIRE",
    baseDmg: 4,
    cooldown: 3600,
    range: 190,
    count: 2,
    lureR: 260,
    durationMs: 3600,
    tickMs: 450,
    touchR: 52,
    burst: { dmg: 16, r: 104 },
  },
  // ===== VENTO (4º elemento): Redemoinho + 3 armas novas =====
  // Assobio: o assobio das lendas — onda em cone que corre, empurra e deixa "ventado".
  ASSOBIO: {
    name: "Assobio da Mata",
    desc: "O assobio das lendas: onda de vento em cone que empurra o bando.",
    icon: "ico_assobio",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Onda",
    unlock: { forge: 2, cost: 350 },
    element: ELEMENT.WIND,
    baseDmg: 4,
    cooldown: 1700,
    range: 230,
    halfAngle: 0.6,
    travelMs: 420,
    push: 42,
  },
  // Folhas ao Vento: folhas cortantes numa espiral que abre a partir do herói.
  FOLHAS: {
    name: "Folhas ao Vento",
    desc: "Folhas cortantes giram numa espiral que abre a partir de você.",
    icon: "ico_folhas",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+2 Folhas",
    unlock: { forge: 3, cost: 650, deed: { stat: "LABAREDA", n: 40, text: "Faça {n} Labaredas (fogo + vento)" } },
    element: ELEMENT.WIND,
    baseDmg: 3,
    cooldown: 2000,
    range: 190,
    count: 6,
    lifeMs: 1700,
    spin: 3.2,
  },
  // Cata-vento: torre plantada que gira e sopra rajadas que atravessam o bando.
  CATAVENTO: {
    name: "Cata-vento",
    desc: "Planta um cata-vento que gira e sopra rajadas no bando.",
    icon: "ico_catavento",
    mods: ["dmg", "cd", "range", "proj"],
    plus: "+1 Cata-vento",
    unlock: { forge: 4, cost: 950, deed: { stat: "GEADA", n: 40, text: "Faça {n} Geadas (gelo + vento)" } },
    element: ELEMENT.WIND,
    baseDmg: 3.5,
    cooldown: 3400,
    range: 280,
    max: 2,
    durationMs: 8000,
    everyMs: 1000,
    speed: 360,
    push: 18,
  },
  // Vento Sul (Assobio + Granizo): o assobio gelado do sul — duas ondas largas → GEADA.
  VENTO_SUL: {
    name: "Vento Sul",
    desc: "Assobio gelado: duas ondas largas de vento e gelo = GEADA.",
    icon: "ico_assobio_ice",
    also: ["ice"],
    element: ELEMENT.WIND,
    evolvesFrom: "ASSOBIO",
    partner: "HAIL",
    baseDmg: 9,
    cooldown: 1250,
    range: 270,
    halfAngle: 0.9,
    travelMs: 440,
    push: 48,
    waves: 2,
  },
  // Ventania (Folhas + Vaga-lumes): mais folhas, carregadas de raio → TEMPORAL.
  VENTANIA: {
    name: "Ventania",
    desc: "Mais folhas, carregadas de raio: vento + raio = TEMPORAL.",
    icon: "ico_folhas_bolt",
    also: ["bolt"],
    element: ELEMENT.WIND,
    evolvesFrom: "FOLHAS",
    partner: "FIREFLY",
    baseDmg: 4,
    cooldown: 1600,
    range: 220,
    count: 10,
    lifeMs: 1800,
    spin: 3.6,
  },
  // Cata-vento de Brasa (Cata-vento + Fogueira): o cata-vento abana o fogo → LABAREDA.
  CATAVENTO_BRASA: {
    name: "Cata-vento de Brasa",
    desc: "O cata-vento abana o fogo: rajadas em brasa = LABAREDA.",
    icon: "ico_catavento_fire",
    also: ["fire"],
    element: ELEMENT.WIND,
    evolvesFrom: "CATAVENTO",
    partner: "BONFIRE",
    baseDmg: 8,
    cooldown: 2800,
    range: 300,
    max: 3,
    durationMs: 9000,
    everyMs: 700,
    speed: 380,
    push: 20,
  },
};

// ---------------------------------------------------------------------------
// TABELAS DERIVADAS DAS FICHAS — não edite à mão: tudo sai de WEAPONS[k]
// (desc/icon/mods/plus/unlock). Ver docs/CONTEUDO.md.
// ---------------------------------------------------------------------------
// Estatísticas acumuladas que um FEITO (deed) pode pedir — ver MetaProgression.deedProgress
export const DEED_STATS = ["kills", "win1", "VAPOR", "CRYSTAL", "OVERLOAD", "LABAREDA", "GEADA", "TEMPORAL", "miniBosses", "chests", "flawless"];
export const BASE_WEAPON_KEYS = Object.keys(WEAPONS).filter((k) => !WEAPONS[k].evolvesFrom);
export const EVOLUTION_KEYS = Object.keys(WEAPONS).filter((k) => WEAPONS[k].evolvesFrom);
// Forjáveis em ordem de preço (é a ordem da lista da Forja)
const FORGEABLE = BASE_WEAPON_KEYS.filter((k) => WEAPONS[k].unlock?.cost != null).sort(
  (a, b) => WEAPONS[a].unlock.cost - WEAPONS[b].unlock.cost,
);
const unlockTable = (f) => Object.fromEntries(FORGEABLE.map((k) => [k, f(WEAPONS[k].unlock)]).filter(([, v]) => v != null));
export const STARTER_WEAPONS = BASE_WEAPON_KEYS.filter((k) => WEAPONS[k].unlock?.start);

// LAÇOS (combos de dupla): basta ter as duas armas (base ou evoluída) na partida.
// Sem carta, sem custo: o jogo avisa quando liga. Cada efeito vive na arma que muda.
export const LINKS = [
  { id: "corredeira", a: "WHIRL", b: "AURA", name: "Corredeira", desc: "Quem o redemoinho puxa para dentro da aura congela na hora." },
  { id: "olho", a: "WHIRL", b: "HAIL", name: "Olho do Furacão", desc: "O granizo cai dentro do redemoinho." },
  { id: "saojoao", a: "FIREFLY", b: "BONFIRE", name: "Noite de São João", desc: "Vaga-lume que passa pela fogueira acende: metade dos golpes dele também queima." },
  { id: "isca", a: "MIRAGE", b: "BOLAS", name: "Isca e Laço", desc: "A boleadeira mira quem a miragem atraiu e amarra pelo dobro do tempo." },
  { id: "rufar", a: "DRUM", b: "LASH", name: "Rufar da Mata", desc: "Cada batida do tambor estala um açoite a mais." },
  { id: "correnteza", a: "GOLDBALL", b: "WHIRL", name: "Ouro na Correnteza", desc: "A bola de ouro que cruza o redemoinho ganha 2 ricochetes." },
  { id: "brasa", a: "STAFF", b: "BONFIRE", name: "Brasa de São João", desc: "A fogueira mais perto também atira a bola de fogo do Cajado." },
  { id: "trovoada", a: "CHAIN", b: "DRUM", name: "Trovoada", desc: "O Raio causa +60% em quem a onda do tambor acabou de acertar." },
  { id: "rastro", a: "BOOMER", b: "MIRAGE", name: "Rastro Falso", desc: "Onde a vara faz a volta, fica uma miragem curta que atrai o bando." },
  { id: "avivar", a: "ASSOBIO", b: "FLAME", name: "Avivar o Fogo", desc: "O assobio aviva o sopro: o cone do Sopro Flamejante fica 30% maior." },
  { id: "ciranda", a: "FOLHAS", b: "WHIRL", name: "Ciranda", desc: "Folha que cruza o redemoinho gira com ele e corta 50% mais." },
  { id: "temporuim", a: "CATAVENTO", b: "HAIL", name: "Tempo Ruim", desc: "O granizo cai perto dos cata-ventos." },
  { id: "derretido", a: "FLAME", b: "GOLDBALL", name: "Ouro Derretido", desc: "A bola de ouro que passa pelo sopro pega fogo: metade dos ricochetes também queima." },
];

export const MAX_WEAPON_LEVEL = 5;

// Personagens jogáveis — cada um começa com uma arma e tem um viés de stats.
// Sprite = textura hero_<id> (arte própria, src/art/Hero.js). mods aplicados no início da run.
export const CHARACTERS = [
  // Ficha do guardião (tudo que o jogo precisa saber dele mora aqui):
  //   weapon = arma inicial (chave de WEAPONS) · mods = viés de stats na partida
  //   unlock = { start } | { fire: nv da Fogueira } (chega sozinho) | { fire, deed } (feito + moedas = cost)
  //   legend = ficha do bestiário (Mural) — a origem da lenda (ver TEMA_FOLCLORE.md)
  //   Arte: hero_<id> em src/art/Hero.js e as poses de queda em src/art/HeroRig.js
  {
    id: "guardian",
    name: "Curupira",
    title: "Guardião da mata",
    weapon: "STAFF",
    cost: 0,
    perk: "Equilibrado, sem fraquezas. Bom para aprender.",
    mods: {},
    unlock: { start: true },
    legend: { id: "curupira", role: "Guardião da mata · fogo",
      origin: "Lenda de origem tupi, registrada já no século XVI. Protege as matas e os bichos; os pés virados para trás deixam rastros que confundem os caçadores." },
  },
  {
    id: "huntress",
    name: "Caipora",
    title: "Protetora dos bichos",
    weapon: "BOOMER",
    cost: 250,
    perk: "+12% velocidade · +8% crítico · −10% vida",
    mods: { speed: 1.12, crit: 0.08, hp: 0.9 },
    unlock: { fire: 2 },
    legend: { id: "caipora", role: "Protetora dos bichos · vara encantada",
      origin: "Do tupi ka'apora, \"habitante do mato\". Protetora dos animais contra a caça em excesso; em muitas regiões anda montada num porco-do-mato." },
  },
  {
    id: "druid",
    name: "Iara",
    title: "Senhora das águas",
    weapon: "AURA",
    cost: 600,
    perk: "+20% área · +1 Vida/s · −15% velocidade",
    mods: { area: 1.2, regen: 1, speed: 0.85 },
    unlock: { fire: 3 },
    legend: { id: "iara", role: "Senhora das águas · gelo",
      origin: "Do tupi y-îara, \"senhora das águas\". Vive nos rios da Amazônia e encanta com seu canto; a lenda somou traços europeus e africanos com o tempo." },
  },
  {
    id: "shaman",
    name: "Saci",
    title: "Redemoinho travesso",
    weapon: "WHIRL", // a lenda: o Saci viaja dentro do redemoinho (antes começava com o Raio)
    cost: 1200,
    perk: "−15% recarga · +15% dano · −25% vida",
    mods: { cd: 0.85, dmg: 1.15, hp: 0.75 },
    unlock: { fire: 4 },
    legend: { id: "saci", role: "Redemoinho travesso · vento",
      origin: "Nasceu do Jaxy Jaterê guarani e ganhou traços africanos e europeus ao longo dos séculos. Esperto e brincalhão, vive dentro dos redemoinhos de vento." },
  },
  // Leva 3: Fogueira nv 4 + FEITO acumulado + moedas (cost)
  {
    id: "fulozinha",
    name: "Comadre Fulozinha",
    title: "Guardiã do Nordeste",
    weapon: "LASH",
    cost: 1600,
    perk: "+25% vida · +6% velocidade (luta de perto)",
    mods: { hp: 1.25, speed: 1.06 },
    unlock: { fire: 4, deed: { stat: "miniBosses", n: 15, text: "Derrote {n} minichefes (Mula e Corpo-Seco)" } },
    legend: { id: "fulozinha", role: "Guardiã do Nordeste · açoite de urtiga",
      origin: "Lenda de Pernambuco e do Nordeste: cabocla miúda de cabelos negros compridos, vestida de branco. Protege a mata e os bichos, assobia, dá pistas falsas e açoita com urtiga quem desrespeita a floresta." },
  },
  {
    id: "maedoouro",
    name: "Mãe-do-Ouro",
    title: "Guardiã das serras",
    weapon: "GOLDBALL",
    cost: 2000,
    perk: "+50% sorte · +10% crítico · −10% vida",
    mods: { luck: 0.5, crit: 0.1, hp: 0.9 },
    unlock: { fire: 4, deed: { stat: "chests", n: 80, text: "Abra {n} baús na floresta" } },
    legend: { id: "maedoouro", role: "Guardiã das serras · bola de ouro",
      origin: "Contada no interior do Sudeste, Centro-Oeste e Nordeste: bola de fogo que voa nas noites sem lua e vira mulher de cabelos dourados. Guarda o ouro das serras e dos rios para que não seja arrancado." },
  },
  {
    id: "anhanga",
    name: "Anhangá",
    title: "Veado branco da caça",
    weapon: "MIRAGE",
    cost: 2400,
    perk: "+18% velocidade · +10% área · −15% vida",
    mods: { speed: 1.18, area: 1.1, hp: 0.85 },
    unlock: { fire: 4, deed: { stat: "flawless", n: 4, text: "Desvie de tudo em {n} lutas de chefe" } },
    legend: { id: "anhanga", role: "Protetor da caça · miragem",
      origin: "Do tupi: espírito protetor dos bichos, que aparece como um veado branco de olhos de fogo e engana com ilusões quem caça sem respeito. Os missionários o chamaram de demônio; na origem, é guardião." },
  },
];

// Upgrades passivos (level-up). roll() retorna { name, apply } com valor aleatório.
const r = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const rf = (min, max) => +(min + Math.random() * (max - min)).toFixed(2);

// Valores das passivas ~1,5x o de antes: menos cartas, cada uma mais marcante.
// Máximo de passivas DIFERENTES por partida. Cheio, as cartas só oferecem as que
// o jogador já tem — escolher vira decisão de build (como armas têm 6 espaços).
export const PASSIVE_SLOTS = 4;

// label: nome curto (título da carta) · desc: o que faz, em linguagem de jogador.
export const PASSIVES = [
  {
    id: "hp",
    label: "Seiva Vital",
    desc: "Vida máxima maior — o bônus já chega curado.",
    roll: () => {
      const v = r(15, 35);
      return {
        name: tr("+{0}% Vida máxima", v),
        apply: (p) => {
          const gain = p.maxHp * (v / 100);
          p.maxHp += gain;
          p.hp = Math.min(p.maxHp, p.hp + gain);
        },
      };
    },
  },
  {
    id: "speed",
    label: "Passo do Vento",
    desc: "Corra mais rápido que a horda.",
    roll: () => {
      const v = r(12, 24);
      return { name: tr("+{0}% Velocidade", v), apply: (p) => (p.speed *= 1 + v / 100) };
    },
  },
  {
    id: "cooldown",
    label: "Ritmo Ancestral",
    desc: "Todas as armas disparam mais vezes.",
    roll: () => {
      const v = r(12, 24);
      return { name: tr("−{0}% Recarga", v), apply: (p) => (p.cdMult *= 1 - v / 100) };
    },
  },
  {
    id: "area",
    label: "Raízes Largas",
    desc: "Auras, nuvens, reações e a vara alcançam mais longe.",
    roll: () => {
      const v = r(15, 35);
      return { name: tr("+{0}% Área", v), apply: (p) => (p.areaMult *= 1 + v / 100) };
    },
  },
  {
    // vale para TODA arma que tem melhoria de +1 (mods com "proj"); só 1 vez por partida
    id: "proj",
    label: "Galhos Extras",
    desc: "+1 projétil em todas as armas que ganham +1 nas cartas. Só 1 vez.",
    once: true,
    roll: () => ({ name: tr("+1 Projétil"), apply: (p) => (p.extraProj += 1) }),
  },
  {
    id: "lifesteal",
    label: "Sede da Mata",
    desc: "Parte do dano causado vira cura.",
    roll: () => {
      const v = r(4, 10);
      return { name: tr("+{0}% Roubo de vida", v), apply: (p) => (p.lifestealPct += v / 100) };
    },
  },
  {
    id: "regen",
    label: "Musgo Curativo",
    desc: "Regenera vida continuamente.",
    roll: () => {
      const v = rf(0.8, 2.6);
      return { name: tr("+{0} Vida/s", v), apply: (p) => (p.regenPerSec += v) };
    },
  },
  {
    id: "crit",
    label: "Olho de Falcão",
    desc: "Críticos causam dano dobrado e empurram.",
    roll: () => {
      const v = r(8, 15);
      return { name: tr("+{0}% Crítico", v), apply: (p) => (p.critChance += v / 100) };
    },
  },
  {
    id: "magnet",
    label: "Ímã de Seiva",
    desc: "Puxa gemas e moedas de mais longe.",
    roll: () => {
      const v = r(45, 75);
      return { name: tr("+{0}% Coleta", v), apply: (p) => (p.pickupRadius *= 1 + v / 100) };
    },
  },
  {
    id: "armor",
    label: "Casca de Carvalho",
    desc: "Reduz todo dano recebido (máx. 50%).",
    roll: () => {
      const v = r(9, 15);
      return { name: tr("−{0}% Dano recebido", v), apply: (p) => (p.dmgTakenMult = Math.max(0.5, p.dmgTakenMult * (1 - v / 100))) };
    },
  },
  {
    id: "luck",
    label: "Trevo da Sorte",
    desc: "Mais moedas, corações e orbes caindo.",
    roll: () => {
      const v = r(22, 38);
      return { name: tr("+{0}% Sorte", v), apply: (p) => (p.luck += v / 100) };
    },
  },
];

// Ressonância elemental: armas do MESMO elemento se reforçam (+15% de dano por arma extra
// daquele elemento); ter os TRÊS elementos monta o Prisma (reações +30%). Especializar ou
// misturar é a escolha de build.
export const RESONANCE = {
  PER_EXTRA_WEAPON: 0.15,
  PRISM_REACTION: 1.3,
  NAMES: { fire: tr("FOGO"), ice: tr("GELO"), bolt: tr("RAIO"), wind: tr("VENTO") },
};

// Tratos da Mata: de vez em quando uma das 3 cartas é um TRATO — poder grande em troca de
// um custo (a Mata cobra). Aparece a partir do nível MIN_LEVEL, no máximo MAX_PER_RUN por
// partida, cada trato uma vez só. Decisão de risco, nunca obrigatória (dá para recusar,
// trocar ou banir). Os custos NÃO são "desvantagem fingida": mexem de verdade na build.
export const PACTS = {
  CHANCE: 0.22, // chance por mesa de cartas gerada
  MIN_LEVEL: 3,
  MAX_PER_RUN: 3,
  LIST: [
    {
      id: "javali",
      label: "Fúria do Javali",
      icon: "ico_flame_red",
      desc: "A Mata empresta a fúria do javali, mas cobra o seu vigor.",
      roll: () => {
        const g = r(30, 45), c = r(18, 26);
        return {
          gain: tr("+{0}% Dano", g),
          cost: tr("Em troca: −{0}% Vida máxima", c),
          apply: (p) => {
            p._blessingDmgMult *= 1 + g / 100;
            p.maxHp *= 1 - c / 100;
            p.hp = Math.min(p.hp, p.maxHp);
          },
        };
      },
    },
    {
      id: "pes_virados",
      label: "Pés Virados",
      icon: "ico_dash_green",
      desc: "Passos que ninguém segue, mas qualquer golpe pesa mais.",
      roll: () => {
        const g = r(22, 32), c = r(15, 22);
        return {
          gain: tr("+{0}% Velocidade", g),
          cost: tr("Em troca: +{0}% Dano recebido", c),
          apply: (p) => {
            p.speed *= 1 + g / 100;
            p.dmgTakenMult *= 1 + c / 100;
          },
        };
      },
    },
    {
      id: "fome",
      label: "Fome da Mata",
      icon: "ico_clover",
      desc: "A floresta devora a Podridão e te dá o que ela leva, mas você fica pesado.",
      roll: () => {
        const g = r(45, 65), c = r(12, 18);
        return {
          gain: tr("+{0}% XP", g),
          cost: tr("Em troca: −{0}% Velocidade", c),
          apply: (p) => {
            p._xpMult *= 1 + g / 100;
            p.speed *= 1 - c / 100;
          },
        };
      },
    },
    {
      id: "mao_pesada",
      label: "Mão Pesada",
      icon: "ico_hourglass",
      desc: "As armas disparam sem parar, mas o corpo cobra o preço.",
      roll: () => {
        const g = r(26, 34), c = r(18, 24);
        return {
          gain: tr("−{0}% Recarga", g),
          cost: tr("Em troca: −{0}% Vida máxima", c),
          apply: (p) => {
            p.cdMult *= 1 - g / 100;
            p.maxHp *= 1 - c / 100;
            p.hp = Math.min(p.hp, p.maxHp);
          },
        };
      },
    },
    {
      id: "casca_espessa",
      label: "Casca Espessa",
      icon: "ico_shield",
      desc: "A pele vira casca de árvore. Aguenta muito mais, mas pesa.",
      roll: () => {
        const g = r(28, 38), c = r(15, 20);
        return {
          gain: tr("−{0}% Dano recebido", g),
          cost: tr("Em troca: −{0}% Velocidade", c),
          apply: (p) => {
            p.dmgTakenMult = Math.max(0.4, p.dmgTakenMult * (1 - g / 100));
            p.speed *= 1 - c / 100;
          },
        };
      },
    },
  ],
};

// Santuários da Floresta (ver ShrineSystem): pontos de interesse espalhados pelo mapa.
export const SHRINE = {
  COUNT: { charge: 4, greed: 2, challenge: 3 },
  MIN_FROM_CENTER: 700, // não nascem em cima do ponto de partida
  MIN_SPACING: 900,
  TOUCH_R: 56,
  CHARGE_R: 120, // raio para carregar o santuário da Carga
  CHARGE_MS: 3000, // tempo parado dentro do raio
  CHARGE_BUFF: { DMG: 1.25, SPEED: 1.15, MS: 40000 },
  GREED: { MS: 60000, SPAWN_MULT: 1.35, LUCK: 1 }, // LUCK = soma na sorte de drops (dobra a chance)
  CHALLENGE: { ELITES: 4 },
  TYPES: {
    charge: { name: "Santuário da Carga", short: "CARGA", hint: "Fique perto para carregar", color: 0x9ccf62, css: "#9ccf62" },
    greed: { name: "Santuário da Ganância", short: "GANÂNCIA", hint: "Mais moedas, mais inimigos", color: 0xf2c14e, css: "#f2c14e" },
    challenge: { name: "Santuário do Desafio", short: "DESAFIO", hint: "Derrote os elites: baú dourado", color: 0xe8434f, css: "#e8434f" },
  },
};

// Controle das cartas de nível: trocar (1× por nível, grátis) e BANIR (tirar a carta da
// partida inteira). 1 banimento grátis por partida + 1 extra por anúncio (AdService
// "extra_banish").
export const CARDS = {
  BANISH_BASE: 1,
  BANISH_PER_SHRINE_LEVEL: 0,
  // TROCAR cartas também é escasso (era 1 grátis a CADA nível — sempre à mão, a escolha
  // perdia peso): saldo por PARTIDA + 1 extra por anúncio (AdService "extra_reroll")
  REROLL_BASE: 2,
  // +1 projétil é MARCO de nível (como no Vampire Survivors): sai só ao subir a arma
  // para estes níveis. Nos outros, a carta sorteia dano, recarga ou alcance. Medido:
  // +1 projétil vale 2–3× uma carta de dano — sorteado a qualquer nível, decidia a run.
  PROJ_LEVELS: [3, 5],
};

// Entrada na floresta (continuação da saída da Clareira): o guardião chega
// andando pela trilha e a mata se fecha atrás dele antes de a partida começar.
// Distâncias medidas a partir da BORDA SUL da arena (y = WORLD_RADIUS).
export const INTRO = {
  START_OFF: -70, // nasce FORA da arena (abaixo da borda)…
  END_OFF: 300, // …e anda até 300px para dentro
  GATE_OFF: 150, // brecha na muralha de árvores, fechada pelos arbustos
  PATH_HALF: 60, // meia-largura da trilha
  WALK_MULT: 0.95,
  CLOSE_MS: 750, // tempo da mata fechando até o controle voltar
};

// Área JOGÁVEL = face de dentro da muralha de árvores. As árvores da borda ficam
// de 30 a 140 px para dentro da borda do mundo e NÃO têm colisão: o limite
// físico precisa ficar antes delas, senão dá para andar por dentro da mata e
// contornar a entrada. Sul = linha dos arbustos que fecham a entrada.
export const ARENA = {
  minX: -GAME.WORLD_RADIUS + 220,
  maxX: GAME.WORLD_RADIUS - 220,
  minY: -GAME.WORLD_RADIUS + 150,
  maxY: GAME.WORLD_RADIUS - INTRO.GATE_OFF,
};

// Noite Eterna (Modo Infinito): oferecida ao libertar o Mapinguari. A força cresce
// de forma composta a cada minuto; eventos voltam em ciclo.
export const ENDLESS = {
  HP_GROWTH_PER_MIN: 0.25, // +25% vida dos inimigos por minuto (composto)
  DMG_GROWTH_PER_MIN: 0.12, // +12% dano por minuto (composto)
  SPAWN_MULT: 1.2,
  COINS_PER_MIN: 15, // bônus por minuto sobrevivido na Noite Eterna
  EVENT_EVERY_S: 45, // um evento (enxame/cerco/minichefe) a cada 45 s
};

// A Podridão na borda da tela (src/world/Podridao.js): avança com o relógio da partida, fecha
// quando o chefe nasce e recua quando ele é libertado. A vida baixa é um pulso desta MESMA camada
// (uma vinheta só, um ritmo só).
export const PODRIDAO = {
  RES: 3, // 1 pixel da textura = 1 pixel de arte (3 px de tela): a Podridão é pixel art como o resto
  HZ: 10, // redesenho da textura (a borda anda devagar)
  HZ_PULSE: 30, // durante o pulso da vida baixa (o avanço precisa ser liso)
  START: 0.06, // quanto já há de Podridão no começo da partida (0..1)
  CURVE: 1.35, // avanço ao longo da partida (> 1 = acelera perto do chefe)
  // distância da frente até a borda, em fração da ALTURA da tela (a mesma em todas as bordas):
  // nível 0 → nível 1 (chefe). Com 0,105 o forte (alfa ≥ 0,5) fica nos ~8–10% de fora; só a
  // ponta dos tentáculos, fina e translúcida, entra mais
  FRONT: [0.012, 0.105],
  FREED: -0.2, // chefe libertado: a frente recua para além da borda (some de vez)
  ENDLESS_S: 240, // Noite Eterna: a Podridão volta e fecha de novo em 4 min
  EASE_MS: 900, // suavização ao mudar de alvo (chefe nasce / é libertado: ~2–3 s até assentar)
  // ruído: quanto empurra a frente (tentáculos), em fração do alcance; < a frente da rampa (0,5),
  // senão nasceriam ilhas de Podridão no meio da tela
  NOISE: 0.45,
  NOISE_MEAN: 0.35, // média do ruído depois da potência (o alcance compensa)
  NOISE_POW: 1.6, // > 1: picos mais raros = tentáculos compridos aqui e ali, não ondas iguais
  NOISE_PX: 90, // tamanho de uma célula do ruído em px de tela
  NOISE_FLOW: 0.3, // velocidade com que os tentáculos mudam de forma
  LOW_HP: 0.3, // abaixo disso a Podridão pulsa
  BEAT_MS: [1050, 700], // período do pulso: 30% → 0% de vida
  BOSS_AMB_MS: 1600, // a luz ambiente do chefe entra (e sai) em ~1,6 s, sem salto
};

// Rankings do Google Play Games (src/systems/Leaderboards.js; docs/PLAY_STORE.md, "Rankings"). Só partidas SOLO:
// o coop, quando vier, terá ranking próprio (em dupla a pontuação sobe demais). Os IDs vêm do Play Games (o
// `npm run play:rankings -- criar` preenche); vazio = ranking desligado.
export const RANKING = {
  IDS: { score: "CgkIw9zJpO0JEAIQBQ", perigo: "CgkIw9zJpO0JEAIQBg" },
  // Pontos da partida = (abates × KILL + VICTORY se venceu) × multiplicador do Perigo (índice = Perigo). Na Noite
  // Eterna os abates continuam contando. Pontos só de jogar: nada à venda muda a conta.
  KILL: 10,
  VICTORY: 5000,
  PERIGO_MULT: [1, 1.3, 1.7, 2.2, 3],
  SCORE_MAX: 5000000, // teto aceito pelo Play Games (pontuação adulterada acima disso é recusada)
  TOP: 10, // quantos aparecem na lista (mais a linha do jogador, se estiver fora)
};

// Bestiário das LENDAS (aba do Mural). Cada ficha: quem é no jogo + a ORIGEM
// da lenda (cuidado de representação: citar a origem — ver TEMA_FOLCLORE.md).
// char = liberada junto com o guardião; as outras, ao encontrá-las na mata.
export const LEGENDS = [
  // guardiões: saem das fichas de CHARACTERS (legend)
  ...CHARACTERS.map((c) => ({ id: c.legend.id, char: c.id, name: c.name, sprite: [`hero_${c.id}`, 0, 2.2], role: c.legend.role, origin: c.legend.origin })),
  { id: "mula", name: "Mula sem Cabeça", sprite: ["mon_alpha", 0, 2.2], role: "Minichefe · galope em chamas, coice e chuva de brasas",
    origin: "Lenda de origem ibérica espalhada pelo interior do Brasil: uma mula que solta fogo pelo pescoço e galopa pelos campos em noites escuras." },
  { id: "corposeco", name: "Corpo-Seco", sprite: ["mon_elder", 0, 2], role: "Minichefe · seca a vida, foge pela terra, solta cipós",
    origin: "Contada no interior do Sudeste: alguém tão cruel em vida que nem a terra o aceitou, e ficou seco, vagando. Aqui, a Podridão o levantou." },
  { id: "mapinguari", name: "Mapinguari", sprite: ["mon_boss", 4, 1.2], role: "Chefe · bocarra na barriga, grito e o olho da Podridão",
    origin: "Gigante da Amazônia, peludo, com um olho na testa e a boca na barriga. Há quem ligue a lenda às preguiças-gigantes extintas. Vencê-lo o liberta." },
  { id: "cabra", name: "Cabra Cabriola", sprite: ["mon_cabra", 0, 2.2], role: "Minichefe da Caatinga · galope em chamas, coice e brasas",
    origin: "Assombração de origem ibérica contada em Pernambuco: uma cabra que salta e solta fogo pelos olhos. Aqui, a Podridão a tomou; vencida, volta a ser só uma cabra do sertão." },
  { id: "caboclo", name: "Caboclo d'Água", sprite: ["mon_caboclo", 4, 1.3], role: "Chefe da Caatinga · cheia, rebojo e arrastão; foge das carrancas",
    origin: "Guardião do Rio São Francisco: vira canoas de quem maltrata o rio. Os barqueiros punham carrancas na proa para espantá-lo. A Podridão o trouxe para o sertão seco." },
];

// Biomas (mapas) — ver docs/BIOMAS.md. UMA ficha por bioma: o cenário (ForestWorld),
// a luz, a troca de arte dos inimigos, o perigo do terreno, o chefe e a música saem daqui.
// Desbloqueio: unlock.trail = nível da obra "Trilha" (João-de-barro) que abre o caminho.
export const BIOMES = {
  amazonia: {
    name: "Floresta Amazônica",
    desc: "A mata fechada da Clareira. O Mapinguari espera no fim.",
    env: "envKeys",
    bg: 0x1d3926,
    // ambiente da luz: fim de tarde → noite → chefe
    light: { dusk: [0xd6, 0xce, 0xd8], night: [0x4a, 0x4e, 0x74], boss: [0x3e, 0x34, 0x5e] },
    ambient: { fireflies: 14, leaves: 9, leafTint: 0xe0a050, shaft: 0xfff2b0, dust: 0 },
    looks: {},
    boss: "mapinguari",
    bossName: "Mapinguari",
    wake: "O Mapinguari corrompido desperta…",
    freed: "O Mapinguari está livre da Podridão. A floresta respira.",
    music: "music_gameplay",
    bossMusic: "music_boss",
  },
  caatinga: {
    name: "Caatinga",
    desc: "O sertão seco: mandacarus, lajedos e redemoinhos de poeira. O Caboclo d'Água trouxe o rio.",
    env: "envKeysCaatinga",
    bg: 0x8c6a42,
    light: { dusk: [0xf0, 0xd2, 0xae], night: [0x56, 0x4a, 0x6c], boss: [0x34, 0x44, 0x66] }, // sol forte → noite quente → o rio (azul)
    ambient: { fireflies: 3, leaves: 4, leafTint: 0xb89060, shaft: 0xffd890, dust: 18 },
    // arte do sertão no lugar da mata: lobo → calango, corvo → carcará, cogumelo → cabeça-de-frade
    looks: { wolf: "calango", crow: "carcara", shroom: "frade", alpha: "cabra" },
    // minichefe próprio (mesmos golpes da Mula; Corpo-Seco continua: "A Seca" é do sertão)
    minis: { alpha: { legend: "cabra", name: "CABRA CABRIOLA", msg: "A CABRA CABRIOLA SALTA!", again: "A CABRA CABRIOLA VOLTOU!", rage: "A CABRA DISPARA!" } },
    // lanternas: candeeiros de barro no lugar dos cogumelos
    lantern: { tex: "px_candeeiro", broken: "px_candeeiro_broken", anim: "candeeiro_glow", color: 0xffb36b, spark: 0xffe58f, hint: "Candeeiros de barro guardam presentes do sertão.\nEncoste para quebrar!" },
    hazard: "dust",
    wallPines: 1, // muralha: mais juazeiro e árvore seca, menos mandacaru
    boss: "caboclo",
    bossName: "Caboclo d'Água",
    wake: "O rio sobe no sertão… o Caboclo d'Água desperta!",
    freed: "O Caboclo d'Água está livre. O rio volta para o São Francisco.",
    music: "music_caatinga",
    bossMusic: "music_boss_caatinga",
    unlock: { trail: 2, won: "amazonia" },
  },
};
export const BIOME_IDS = Object.keys(BIOMES);

// Redemoinhos de poeira (perigo do terreno da Caatinga): andam pelo mapa, empurram o
// herói (sem dano) e deixam VENTADO quem passa por eles — o fogo do herói vira Labareda.
export const DUST_DEVIL = { firstMs: 25000, everyMs: [16000, 9000], max: 2, r: 64, lifeMs: 9000, speed: 70, push: 150, enemyWindMs: 2500 };

// Obras da Clareira (níveis das construções): custam moedas + Madeira Ancestral
// e levam tempo real, feitas pelo João-de-barro (1 obra por vez). Partidas
// adiantam a obra; faltando FREE_FINISH_MIN ou menos, conclui com um toque.
export const BUILD = {
  // índice = nível ATUAL → custo e tempo para subir ao próximo
  STEPS: [
    null,
    { coins: 40, wood: 2, min: 0 },
    { coins: 250, wood: 6, min: 10 },
    { coins: 800, wood: 15, min: 120 },
    { coins: 2000, wood: 30, min: 480 },
  ],
  RUN_SPEEDUP_MIN: 10, // cada partida adianta a obra em 10 min…
  RUN_SPEEDUP_PER_MIN: 1, // …+1 min por minuto sobrevivido
  FREE_FINISH_MIN: 2, // menor que a obra mais curta (10 min), senão ela vira instantânea
  AD_SPEEDUP_MIN: 30, // anúncio opcional (desligado junto com ADS.ENABLED)
  // O que cada nível libera
  FORGE_WEAPON_LEVEL: unlockTable((u) => u.forge), // Forja nv mínimo (das fichas de WEAPONS)
  // Vagas de arma na partida por nível da Forja (como o Megabonk: começa com 2 e chega a 4).
  // O herói já nasce com 1, então o nível 1 dá 1 escolha; cada vaga nova vem de obra.
  FORGE_WEAPON_SLOTS: [0, 2, 2, 3, 4],
  // Fogueira nv → guardião que CHEGA sozinho (das fichas de CHARACTERS; os de feito são comprados)
  FIRE_CHARACTER_LEVEL: Object.fromEntries(CHARACTERS.filter((c) => c.unlock?.fire && !c.unlock.deed).map((c) => [c.id, c.unlock.fire])),
};
// Santuário nv N → bênçãos até o rank N
export const BUILDINGS = {
  fire: { name: "Fogueira", max: 4 },
  shrine: { name: "Santuário", max: 5 },
  forge: { name: "Forja", max: 4 },
  garden: { name: "Horta", max: 4 }, // nível → canteiros (GARDEN.PLOTS) e plantas
  pond: { name: "Lago", max: 3 }, // nível → vara melhor e mais peixes (FISHING.LEVELS)
  // nível → biomas abertos (BIOMES[id].unlock.trail); aparece depois de vencer o Mapinguari
  trail: { name: "Trilha do Sertão", max: 2, steps: [null, { coins: 600, wood: 10, min: 60 }] },
};

// Madeira Ancestral: material das obras da Clareira. Rara de propósito — as
// obras exigem JOGAR partidas, não só esperar.
export const WOOD = {
  MINIBOSS: 3, // por minichefe (Mula sem Cabeça, Corpo-Seco)
  GOLDEN_CHEST: 2, // baú dourado
  CHEST_CHANCE: 0.25, // baú comum: 25% de chance de 1
  BOSS: 6, // o Mapinguari
};

// Horta da Clareira (M3 — ver docs/VIDA_NA_CLAREIRA.md). Tempo REAL.
// Nada morre: descuidar só baixa a qualidade (0 comum · 1 prata · 2 ouro) e
// atrasa. Sempre há uma planta curta e uma longa (o jogador escolhe quando volta).
export const GARDEN = {
  PLOTS: [0, 2, 3, 4, 5], // canteiros por nível da Horta: cada obra do João-de-barro abre +1
  TUTORIAL_S: 30, // a 1ª cenoura cresce em 30 s (ver o ciclo antes de esperar)
  NEED_SLOW: 0.75, // com um cuidado pendente, a planta cresce a 75%
  NEED_GRACE: 0.2, // cuidar até 20% da duração depois do aviso não perde qualidade…
  NEED_GRACE_MIN_S: 120, // …e nunca menos de 2 min
  RIPE_KEEP_H: 12, // madura aguenta 12 h no pé; depois cai uma estrela
  QUALITY: ["Comum", "Prata", "Ouro"],
  // s = tempo de crescimento; lv = nível da Horta que libera; rare = semente
  // só vem das partidas (plantas mágicas, ligadas aos elementos)
  CROPS: {
    carrot: { name: "Cenoura", s: 5 * 60, needs: 1, yield: 2, lv: 1 },
    corn: { name: "Milho", s: 30 * 60, needs: 1, yield: 2, lv: 1 },
    cassava: { name: "Mandioca", s: 8 * 3600, needs: 1, yield: 4, lv: 1 },
    bean: { name: "Feijão", s: 60 * 60, needs: 2, yield: 3, lv: 2 },
    pumpkin: { name: "Abóbora", s: 4 * 3600, needs: 2, yield: 2, lv: 3 },
    pepper: { name: "Pimenta-de-brasa", s: 2 * 3600, needs: 2, yield: 2, lv: 1, rare: true, element: "fire" },
    frost: { name: "Flor-de-geada", s: 2 * 3600, needs: 2, yield: 2, lv: 1, rare: true, element: "ice" },
    thunder: { name: "Erva-do-trovão", s: 2 * 3600, needs: 2, yield: 2, lv: 1, rare: true, element: "bolt" },
    // Frutas do sertão: a semente só cai nas partidas da Caatinga (biome)
    umbu: { name: "Umbu", s: 3 * 3600, needs: 2, yield: 3, lv: 1, rare: true, biome: "caatinga" },
    caju: { name: "Caju", s: 3 * 3600, needs: 2, yield: 2, lv: 1, rare: true, biome: "caatinga" },
  },
  NEEDS: {
    water: "Com sede! Toque para regar.",
    weed: "Erva daninha! Toque para arrancar.",
    pest: "Lagarta! Toque para tirar.",
  },
  // Sementes raras caem nas partidas (só depois que a Horta apareceu)
  SEEDS: { MINIBOSS: 1, GOLDEN_CHEST: 1, BOSS: 2 },
  BIOME_SEED_CHANCE: 0.6, // num bioma com frutas próprias, 60% das sementes raras são dele
};

// Hábito diário (M4 — ver docs/PRE_LANCAMENTO.md §2). "Dia" = data LOCAL do
// aparelho. Missões: 3 por dia (2 da floresta + 1 da Clareira quando houver),
// sorteadas pela data; n = alvos possíveis; needs = só quando o jogador já
// conhece aquilo. Nada vende poder: o prêmio é moeda, madeira, semente.
// Valores dobrados na economia 2026-10 (os preços subiram ~5×; o hábito diário
// precisa pesar no bolso).
export const DAILY = {
  MISSIONS: [
    { id: "kills", text: "Abata {n} criaturas", stat: "kills", n: [150, 300, 500], coins: 100 },
    { id: "reactions", text: "Dispare {n} reações elementais", stat: "reactions", n: [15, 30, 50], coins: 100 },
    { id: "vapor", text: "Faça {n} Vapores (fogo + gelo)", stat: "VAPOR", n: [8, 15], coins: 120 },
    { id: "crystal", text: "Faça {n} Cristais (gelo + raio)", stat: "CRYSTAL", n: [5, 10], coins: 120, needs: (d) => (d.unlockedWeapons || []).includes("CHAIN") },
    { id: "overload", text: "Faça {n} Sobrecargas (fogo + raio)", stat: "OVERLOAD", n: [5, 10], coins: 120, needs: (d) => (d.unlockedWeapons || []).includes("CHAIN") },
    { id: "labareda", text: "Faça {n} Labaredas (fogo + vento)", stat: "LABAREDA", n: [5, 10], coins: 120, needs: (d) => (d.unlockedWeapons || []).includes("ASSOBIO") },
    { id: "survive", text: "Sobreviva {n} minutos numa partida", stat: "minutes", n: [3, 5], coins: 100, max: true },
    { id: "runs", text: "Jogue {n} partidas", stat: "runs", n: [2, 3], coins: 80 },
    { id: "chests", text: "Abra {n} baús na floresta", stat: "chests", n: [2, 4], coins: 100 },
    { id: "lanterns", text: "Quebre {n} lanternas de cogumelo", stat: "lanterns", n: [3, 6], coins: 80 },
    { id: "boss", text: "Vença o Mapinguari", stat: "wins", n: [1], coins: 240, needs: (d) => (d.wins || 0) > 0 },
    // Da Clareira
    { id: "harvest", text: "Colha {n} vezes na horta", stat: "harvest", n: [2, 4], coins: 80, camp: true, needs: (d) => (d.revealed || []).includes("garden") },
    { id: "fish", text: "Pesque {n} peixes no lago", stat: "fish", n: [2, 3], coins: 80, camp: true, needs: (d) => (d.revealed || []).includes("pond") },
    { id: "cook", text: "Cozinhe {n} prato{s}", stat: "cook", n: [1, 2], coins: 80, camp: true, needs: (d) => (d.revealed || []).includes("kitchen") },
  ],
  ALL_BONUS: { coins: 160, wood: 2 }, // completar as 3 do dia
  // Bônus de descanso: as primeiras partidas de cada dia rendem mais moedas.
  // Premia VOLTAR sem limitar quem quer jogar mais (nada de energia nem teto diário).
  RESTED: { RUNS: 2, MULT: 1.5 },
  // Presente de dias seguidos (volta ao 1 depois do 7º ou se pular um dia)
  STREAK: [{ coins: 80 }, { coins: 120 }, { wood: 2 }, { coins: 180 }, { seeds: 1, coins: 80 }, { coins: 240 }, { coins: 400, wood: 5, seeds: 2 }],
  // Baú diário junto à fogueira: 1 grátis por dia + 1 com anúncio (opcional)
  CHEST: { coins: [60, 160], woodChance: 0.4, seedChance: 0.25 },
};

// Datas comemorativas (calendário REAL): decoração temática na Clareira só
// na época. mês/dia inclusivos. Ex.: festa junina + julina = bandeirinhas.
export const SEASONS = [{ id: "junina", name: "Festa Junina", from: [6, 1], to: [7, 31] }];

// Lago da Clareira (M3): pesca no chão (trapiche) + minijogo de um polegar:
// segurar sobe a zona verde, soltar desce; manter o peixe dentro enche a barra.
// O lago "descansa": tem poucos peixes e repõe com o tempo real (sem cronômetro
// na cara — bolhas na água mostram que há peixe). Horário REAL muda quem aparece.
export const FISHING = {
  // nível do Lago (obra) → zona verde (fração da barra) e peixes no lago. Era 26/31/36% (largo
  // demais: quase todo peixe saía sem esforço); 20/24/28% ficou duro demais no celular — no
  // simulador (tools/pesca-lab.mjs), um novato no Lago 1 pegava o lambari 17% das vezes. Com
  // 22/26/30%, menos dreno e começo maior: ~48%; tucunaré, dourado e surubim continuam o desafio
  LEVELS: [null, { zone: 0.22, cap: 4 }, { zone: 0.26, cap: 6 }, { zone: 0.3, cap: 8 }],
  REGEN_MIN: 20, // o lago repõe 1 peixe a cada 20 min
  BITE_S: [1.2, 3.5], // espera pela fisgada
  HOOK_S: 1.5, // tempo para puxar depois do "!" (era 1,2: o toque no celular chega atrasado)
  // Pesca assistida (Opções → Controles; acessibilidade motora): zona verde maior, o peixe escapa
  // mais devagar e mais tempo para puxar. Quem joga continua sendo o jogador — só fica tolerante.
  // tools/pesca-lab.mjs, perfil "motor" (reação lenta, mão imprecisa), Lago 1: peixes comuns de
  // 1–10% para ~80%; Dourado e Surubim seguem raros (6–8%). Com 1,6/0,5 tudo saía 100% (sem jogo)
  ASSIST: { zone: 1.4, drain: 0.7, hook: 2 },
  // Física do minijogo = BobberBar do Stardew Valley (valores por quadro a 60 Hz,
  // pista de 568 unidades; a zona é a fração `zone` da pista).
  STEP_HZ: 60,
  TRACK: 568,
  FISH_MAX: 532, // o peixe anda de 0 a 532 (o ícone tem 32 de folga)
  START: 0.35, // progresso inicial (era 0,3)
  FILL: 0.002, // por quadro com o peixe na zona (~8 s para encher de 0 a 1)
  DRAIN: 0.0025, // por quadro com o peixe fora (~6,7 s para esvaziar; era 0,003)
  GRAVITY: 0.25, // segurando sobe (−), soltando cai (+)
  IN_BAR_GRAVITY: 0.6, // com o peixe dentro, a zona pesa 40% menos
  BOUNCE: 2 / 3, // a zona quica nas bordas com 2/3 da velocidade
  // diff = dificuldade (0–100) · move: mixed · smooth (suave) · dart (arrancadas) · sinker (afunda) · floater (sobe)
  // w = peso no sorteio; day/night = só nesse horário (6h–18h é dia)
  FISH: {
    lambari: { name: "Lambari", move: "mixed", diff: 22, w: 30, cm: [8, 16] },
    cara: { name: "Cará", move: "mixed", diff: 32, w: 22, cm: [10, 22] },
    tilapia: { name: "Tilápia", move: "smooth", diff: 35, w: 18, cm: [18, 42] },
    traira: { name: "Traíra", move: "dart", diff: 60, w: 14, cm: [25, 60], night: true },
    pacu: { name: "Pacu", move: "sinker", diff: 55, w: 11, cm: [30, 70] },
    tucunare: { name: "Tucunaré", move: "dart", diff: 70, w: 7, cm: [30, 80], day: true },
    dourado: { name: "Dourado", move: "mixed", diff: 78, w: 3, cm: [50, 100], day: true },
    // Do Rio São Francisco: chegam ao Lago depois que o Caboclo d'Água é libertado (biome)
    curimata: { name: "Curimatã", move: "smooth", diff: 30, w: 16, cm: [25, 55], biome: "caatinga" },
    piau: { name: "Piau", move: "mixed", diff: 45, w: 12, cm: [20, 45], biome: "caatinga" },
    surubim: { name: "Surubim", move: "sinker", diff: 82, w: 4, cm: [60, 140], night: true, biome: "caatinga" },
  },
};

// Cozinha da Clareira (M3): colheita vira prato; comer 1 prato = bônus só na
// PRÓXIMA partida (o prato é consumido ao entrar na floresta). O bônus cresce
// com a qualidade dos ingredientes (média, arredondada para baixo).
// bonus: hp/speed/dmg/area/xp = +%; cd = −% de recarga; crit = +chance; regen = vida/s
export const KITCHEN = {
  QUALITY_MULT: [1, 1.2, 1.4], // Comum, Prata, Ouro (era 1,35/1,7: prato Ouro de dano valia ~70% de uma bênção maxada)
  RECIPES: [
    { id: "roast_carrot", name: "Cenoura Assada", food: "carrot", needs: { carrot: 2 }, bonus: { hp: 0.2 } },
    { id: "pamonha", name: "Pamonha", food: "corn", needs: { corn: 2 }, bonus: { speed: 0.1 } },
    { id: "tapioca", name: "Tapioca", food: "cassava", needs: { cassava: 2 }, bonus: { regen: 0.6 } },
    { id: "tropeiro", name: "Feijão Tropeiro", food: "bean", needs: { bean: 2, cassava: 1 }, bonus: { crit: 0.08 } },
    { id: "quibebe", name: "Quibebe", food: "pumpkin", needs: { pumpkin: 1, cassava: 1 }, bonus: { xp: 0.15 } },
    { id: "brasa", name: "Caldo de Brasa", food: "pepper", needs: { pepper: 1, corn: 1 }, bonus: { dmg: 0.11 } },
    { id: "geada", name: "Chá de Geada", food: "frost", needs: { frost: 1, carrot: 1 }, bonus: { area: 0.15 } },
    { id: "trovao", name: "Mingau do Trovão", food: "thunder", needs: { thunder: 1, cassava: 1 }, bonus: { cd: 0.1 } },
    // Com peixe (Lago)
    { id: "lambari_frito", name: "Lambari Frito", needs: { lambari: 3 }, bonus: { pickup: 0.3 } },
    { id: "pirao", name: "Pirão de Peixe", needs: { tilapia: 1, cassava: 2 }, bonus: { cd: 0.08 } },
    { id: "caldeirada", name: "Caldeirada", needs: { cara: 1, traira: 1, corn: 1 }, bonus: { regen: 0.9 } },
    { id: "pacu_assado", name: "Pacu Assado", needs: { pacu: 1, cassava: 1 }, bonus: { hp: 0.3 } },
    { id: "moqueca", name: "Moqueca de Tucunaré", needs: { tucunare: 1, carrot: 1, pepper: 1 }, bonus: { dmg: 0.15 } },
    { id: "dourado_brasa", name: "Dourado na Brasa", needs: { dourado: 1 }, bonus: { crit: 0.09 } },
    // Do sertão (frutas da Caatinga e peixes do São Francisco)
    { id: "umbuzada", name: "Umbuzada", food: "umbu", needs: { umbu: 2 }, bonus: { regen: 0.7 } },
    { id: "cajuina", name: "Cajuína", food: "caju", needs: { caju: 2 }, bonus: { xp: 0.18 } },
    { id: "curimata_assada", name: "Curimatã Assada", needs: { curimata: 2 }, bonus: { hp: 0.25 } },
    { id: "piau_frito", name: "Piau Frito", needs: { piau: 1, cassava: 1 }, bonus: { speed: 0.12 } },
    { id: "surubim_caju", name: "Surubim com Caju", needs: { surubim: 1, caju: 1 }, bonus: { crit: 0.1 } },
  ],
};

// Lanternas de cogumelo: brotam fora da tela, iluminam e derrubam um item ao
// serem tocadas. Pesos (w) = chance relativa de cada item.
export const LANTERN = {
  FIRST_MS: 25000, // primeira lanterna aos 25 s
  SPAWN_MS: 14000, // depois, uma nova a cada 14 s
  MAX: 4, // vivas ao mesmo tempo
  MIN_DIST: 520, // nascem fora da tela…
  MAX_DIST: 900, // …mas não longe demais
  DESPAWN_DIST: 1700, // muito para trás = some (recicla)
  // Toque: do CORPO do herói (altura das pernas) ao MEIO do cogumelo. Antes media do centro
  // do herói até a BASE do cogumelo com raio 34 — de baixo era preciso subir em cima dele
  TOUCH_R: 56,
  TOUCH_HERO_DY: 16, // corpo do herói: um pouco abaixo do centro do sprite
  TOUCH_CAP_DY: -12, // um pouco acima da base (o sprite é ancorado no pé): equilibra chegar por cima e por baixo
  LIGHT_R: 190,
  ITEM_LIFETIME_MS: 40000,
  ITEM_READY_MS: 650, // item recém-caído só pode ser pego depois de pousar
  DROPS: [
    { id: "fruit", w: 45 },
    { id: "vacuum", w: 25 },
    { id: "clock", w: 18 },
    { id: "breath", w: 12 },
  ],
  FRUIT_HEAL_PCT: 0.3,
  CLOCK_MS: 5000,
  BREATH_TOUGH_DMG_PCT: 0.25, // elites/minichefes perdem 25% da vida
};

// Anúncios premiados (sempre opcionais). ENABLED = false: tudo desenvolvido,
// mas nenhuma oferta aparece para o jogador. Para testar: ?ads=1 na URL.
// IDs do AdMob (conta do Leonardo). Não são segredos: vão dentro do app. Cada bloco é um
// anúncio PREMIADO e tem o mesmo nome do ponto de anúncio em AdService.PLACEMENTS.
// Para testar no aparelho use os IDs de teste do Google, não estes (risco de suspensão).
export const ADMOB = {
  APP_ID: "ca-app-pub-7068898840847782~4241412114",
  UNITS: {
    revive: "ca-app-pub-7068898840847782/3607735722",
    extra_card: "ca-app-pub-7068898840847782/6836709308",
    build_speed: "ca-app-pub-7068898840847782/1448651250",
    double_coins: "ca-app-pub-7068898840847782/9790000693",
    daily_chest: "ca-app-pub-7068898840847782/4481833690",
    extra_reroll: "ca-app-pub-7068898840847782/7024236554",
    extra_banish: "ca-app-pub-7068898840847782/6544975979",
  },
  // Intersticial: pronto e DESLIGADO (começamos sem, como o Vampire Survivors; ver PRE_LANCAMENTO 1.7)
  INTERSTITIAL: "ca-app-pub-7068898840847782/5930646735",
};

export const ADS = {
  ENABLED: true, // ligado: no app só aparece com o AdMob pronto e consentimento ok (ver AdService.canShow)
  TESTING: true, // anúncios de TESTE do Google. Não mexa à mão: o `npm run android:aab` (loja) liga os de verdade na cópia empacotada
  TEST_EEA: false, // true = simula a Europa para ver o formulário de consentimento (só com TESTING)
  // Celulares de teste do consentimento: sem isso o Google ignora o TEST_EEA num aparelho de verdade.
  // O código do aparelho aparece no logcat ao abrir o app: addTestDeviceHashedId("…")
  TEST_DEVICE_IDS: [],
  // Teto de classificação dos anúncios: o público inclui 13–15 anos (Play Console), então nada acima de
  // "Teen" (T). Valores do plugin: General, ParentalGuidance, Teen, MatureAudience
  MAX_AD_RATING: "Teen",
  REVIVE_HP_PCT: 0.5, // volta com metade da vida
  REVIVE_INVULN_MS: 3000,
  REVIVE_CLEAR_RADIUS: 280, // onda que empurra/fere quem está em volta
  REVIVE_OFFER_S: 8, // tempo para decidir antes de encerrar a partida
};

// Compras pela Play Store (ver systems/Billing.js). O id tem de ser IGUAL ao do produto criado no Play
// Console (Monetizar → Produtos → Produtos no app), como compra única (não consumível)
export const STORE = {
  NO_ADS: "sem_anuncios", // "Sem anúncios": prêmios dos anúncios sem assistir; R$ 14,90
  // Kits de cosméticos (docs/COSMETICOS.md): cada um é um produto único que libera as 3 peças do kit.
  // Os ids têm de ser IGUAIS aos do Play Console (criados na fase 2; não dá para reaproveitar depois)
  KITS: { ipe: "kit_ipe", paina: "kit_paineira", coruja: "kit_coruja", junina: "kit_junina" },
  // Pacotes: 1 compra libera várias coisas (docs/COSMETICOS.md, "Estratégia de preços"). A janela do
  // Fundador é controlada no Play Console (desativar o produto no fim; quem comprou mantém tudo). A lista
  // de kits é FIXA por produto: kit novo não entra de graça em pacote vendido antes dele
  PACKS: {
    fundador: { product: "pacote_fundador", noAds: true, kits: ["ipe", "paina", "coruja", "junina"], founder: true },
    // para quem já tem o "Sem anúncios" (o Play não faz "complete o conjunto")
    fundador_lite: { product: "pacote_fundador_kits", noAds: false, kits: ["ipe", "paina", "coruja", "junina"], founder: true },
    // depois da janela do Fundador: sem os exclusivos
    apoiador: { product: "pacote_apoiador", noAds: true, kits: ["ipe", "paina", "coruja", "junina"], founder: false },
  },
};

// Cosméticos (docs/COSMETICOS.md). Só aparência: nenhum muda dano, vida, moedas ou o que for de jogo.
export const COSMETICS = {
  ENABLED: true, // Guarda-roupa no build da loja (o modo de teste ?debug=1 sempre mostra) — ligado na 1.0.6
  SHOP: true, // kits e pacotes à venda pelo Play Billing (produtos ativos no Console desde 19/10/2026). Desligado = "Em breve"
  FOUNDER_UNTIL: [2027, 1, 31], // fim da janela do Pacote Fundador (só para MOSTRAR a data; quem vende é o Console)
  PETAL_BUDGET: 14, // partículas de libertação por janela de 120 ms, somando todas as mortes
  AMOUNTS: [0.5, 1, 1.6], // quantidade de pétalas: discreta, normal, cheia
};

// Drops aleatórios no chão (chance por kill)
export const DROPS = {
  COIN_CHANCE: 0.2, // 20%: playtest mostrou tudo comprado em ~25 partidas; alonga a progressão
  HEART_CHANCE: 0.05,
  AWAKEN_CHANCE: 0.018,
  HEART_HEAL: 20,
  AWAKEN_REFILL: 25,
};

// Baús (lootboxes) — animação real entre frames + mecânica mimic
export const CHEST = {
  SPRITE_TEXTURE: "obj_chest", // arte própria (src/art/Monsters.js)
  SPRITE_FRAME_CLOSED: 0,
  SPRITE_FRAME_HALF: 1,
  SPRITE_FRAME_OPEN: 2,
  SPRITE_FRAME_MIMIC: 3,
  INTERACT_RADIUS: 50,
  STARTING_COUNT: 5,
  KILL_DROP_EVERY: 50,
  // chances de tipo de loot (somam até 100%, resto = normal)
  TRAP_CHANCE: 0.12, // 12% — 4 inimigos elite
  GOLDEN_CHANCE: 0.06, // 6% — jackpot
  MIMIC_CHANCE: 0.07, // 7% — 1 mímico super forte
  // base loot (sempre)
  GEMS_MIN: 4,
  GEMS_MAX: 8,
  COINS_MIN: 2,
  COINS_MAX: 8,
  HEART_CHANCE_OPEN: 0.3,
  AWAKEN_CHANCE_OPEN: 0.3,
  // golden bonus
  GOLDEN_EXTRA_COINS: 40,
  // trap
  TRAP_ENEMY_COUNT: 6,
};

// Inimigos elite (spawnam da armadilha de baú)
export const ELITE = {
  HP_MULT: 2.0,
  SCALE_MULT: 1.6,
  CONTACT_RADIUS: 38,
  TINT: 0xff6666,
};

// Mímico (chest com língua) — inimigo único super forte
export const MIMIC = {
  HP_MULT: 9.0, // muito mais tanque
  HP_FLOOR: 380, // piso de HP: nunca trivial, mesmo spawnando cedo
  SCALE_MULT: 1.8,
  DMG_MULT: 3.0,
  SPEED: 115, // mais rápido que o lobo (95): persegue de verdade
  CONTACT_RADIUS: 52, // hitbox de contato maior (sprite gigante)
  TINT: 0xff3333,
};

// Meta-progressão
export const META = {
  STORAGE_KEY: "guardiao_save_v1",
  COIN_VALUE: 1,
  COIN_BOSS_WIN: 80,
  // Início barato (1ª compra logo na 1ª partida); o resto cresce com a Forja
  // Forja: preço, ordem e FEITOS saem das fichas de WEAPONS (unlock: { forge, cost, deed })
  WEAPON_UNLOCK_COST: unlockTable((u) => u.cost),
  WEAPON_UNLOCK_ORDER: FORGEABLE, // Cajado e Aura já vêm liberados (unlock.start)
  // Feitos da Forja (desbloqueio por desafio, como no Megabonk): as armas do meio em diante
  // pedem um feito ACUMULADO entre partidas. stat: "kills", "win1" (vitórias no Perigo
  // Guardião ou acima), "VAPOR"/"CRYSTAL"/"OVERLOAD" (reações), "miniBosses", "chests",
  // "flawless" (lutas de chefe sem levar golpe especial). Ver DEED_STATS.
  WEAPON_DEED: unlockTable((u) => u.deed),
  // Guardiões com feito (leva 3): sai das fichas de CHARACTERS (unlock.deed)
  CHARACTER_DEED: Object.fromEntries(CHARACTERS.filter((c) => c.unlock?.deed).map((c) => [c.id, c.unlock.deed])),
  ABILITY_UNLOCK_COST: { DASH: 50, AWAKEN: 100 },
};

// Bênçãos persistentes — trilhas de 10 ranks (Fase 2, ver docs/META_LOOP.md).
// Compradas no menu; `apply(player, rank)` é chamado uma vez no início da run e
// aplica o efeito CUMULATIVO do rank atingido. Custo-base do rank R = costs[R-1].
// Economia 2026-10: eram 5 ranks; viraram 10 com METADE do efeito cada (o máximo
// final é o mesmo). Mais degraus = a jornada fica longa sem o jogador ficar muitas
// partidas sem comprar nada. Preço cresce 1,5× por rank.
export const MAX_BLESSING_RANK = 10;
// Imposto de coleção (como os PowerUps do Vampire Survivors): cada rank já comprado,
// em QUALQUER trilha, encarece as bênçãos em TAX × o preço-base. A ordem de compra
// não importa e a curva final fica exponencial sem tabelas gigantes.
// 06/10/2026: 2% → 5% (receio de jornada curta demais para a retenção; o jogo é grátis
// e o fim é poder opcional). Só as bênçãos encarecem: armas, guardiões e obras iguais.
// Catálogo das bênçãos 147 mil → 269 mil moedas; último rank ~9,9 mil → ~19 mil.
export const BLESSING_TAX = 0.05;
export const blessingPrice = (base, ranksOwned) => Math.round((base * (1 + BLESSING_TAX * ranksOwned)) / 5) * 5;

export const BLESSINGS = [
  {
    id: "hp1",
    name: "Vigor da Mata",
    desc: "+8 HP máximo por rank",
    costs: [40, 60, 90, 135, 200, 305, 455, 685, 1025, 1540],
    apply: (p, rank) => {
      p.maxHp += 8 * rank;
      p.hp = p.maxHp;
    },
  },
  {
    id: "spd1",
    name: "Pés Ligeiros",
    desc: "+3% velocidade por rank",
    costs: [60, 90, 135, 200, 305, 455, 685, 1025, 1540, 2305],
    apply: (p, rank) => {
      p.speed *= Math.pow(1.03, rank);
    },
  },
  {
    id: "dmg1",
    name: "Cólera Antiga",
    desc: "+4% dano de arma por rank",
    costs: [90, 135, 200, 305, 455, 685, 1025, 1540, 2305, 3460],
    apply: (p, rank) => {
      p._blessingDmgMult = (p._blessingDmgMult || 1) * Math.pow(1.04, rank);
    },
  },
  {
    id: "pickup",
    name: "Olhar de Coruja",
    desc: "+12% raio de coleta por rank",
    costs: [50, 75, 110, 170, 255, 380, 570, 855, 1280, 1920],
    apply: (p, rank) => {
      p.pickupRadius *= Math.pow(1.12, rank);
    },
  },
  {
    id: "awaken1",
    name: "Eco do Despertar",
    desc: "+7% ganho de Despertar por rank",
    costs: [80, 120, 180, 270, 405, 610, 910, 1365, 2050, 3075],
    apply: (p, rank) => {
      p._awakenGainMult = (p._awakenGainMult || 1) * Math.pow(1.07, rank);
    },
  },
  {
    id: "dash1",
    name: "Sopro do Vento",
    desc: "−5% recarga do dash por rank",
    costs: [70, 105, 160, 235, 355, 530, 795, 1195, 1795, 2690],
    apply: (p, rank) => {
      p._dashCdMult = (p._dashCdMult || 1) * Math.pow(0.95, rank);
    },
  },
  {
    id: "xp1",
    name: "Sabedoria",
    desc: "+5% XP por rank",
    costs: [100, 150, 225, 340, 505, 760, 1140, 1710, 2565, 3845],
    apply: (p, rank) => {
      p._xpMult = (p._xpMult || 1) * Math.pow(1.05, rank);
    },
  },
  {
    id: "crit1",
    name: "Olhar do Caçador",
    desc: "+3% chance de crítico por rank",
    costs: [90, 135, 200, 305, 455, 685, 1025, 1540, 2305, 3460],
    apply: (p, rank) => {
      p.critChance += 0.03 * rank;
    },
  },
];

// Tesouro Ancestral — sink INFINITO (Fase 2). +2% dano geral por nível; custo
// cresce 1,15× por compra. Auto-limita pelo custo, nunca esgota: moeda nunca
// vira lixo. Aplicado via _blessingDmgMult no início da run. Base 100 → 250 na
// economia 2026-10 (com 100 ele ficava mais barato que as bênçãos do meio).
export const ANCESTRAL = {
  DMG_PER_LEVEL: 0.02,
  BASE_COST: 250,
  COST_GROWTH: 1.15,
  cost: (level) => Math.floor(ANCESTRAL.BASE_COST * Math.pow(ANCESTRAL.COST_GROWTH, level)),
};

// Conquistas (Fase 3 — ver docs/META_LOOP.md). Avaliadas por MetaProgression.
// check(c) recebe o contexto:
//   c = { wins, winsByDifficulty, maxDifficultyCleared, reactions, totalKills,
//         totalCoinsEarned, maxBlessingRank, ancestralLevel, run }
//   c.run = null fora de run; durante/fim de run =
//     { won, difficultyId, timeMs, weapons: [{ key, level, element }], tookHpPassive }
// prog(c) (opcional) retorna [atual, meta] pra mostrar progresso no menu.
// Adaptações sobre o spec original (impossíveis com as regras atuais):
//   · speedrun "< 6:00" → "vencer em < 8:00" (boss só nasce aos 7:00)
//   · mono-elemento: começou só com Piromante (só fogo) + Purista (só Cajado); com
//     3 armas por elemento e heróis que nascem com gelo (Iara) e raio (Saci),
//     mono-gelo e mono-raio viraram possíveis (leva 2 de armas).
const wonAt = (idx) => (c) => (c.winsByDifficulty[String(idx)] || 0) > 0;
const monoWin = (el) => (c) => !!c.run && c.run.won && c.run.weapons.length >= 2 && c.run.weapons.every((w) => w.element === el);
// baseKey cobre armas EVOLUÍDAS: a evolução substitui a âncora Lv5, então
// "Cajado no Lv5" também vale se a run terminar com Tempestade de Vapor.
const weaponMax = (key) => (c) =>
  !!c.run &&
  c.run.weapons.some(
    (w) => (w.key === key || w.baseKey === key) && w.level >= MAX_WEAPON_LEVEL,
  );

export const ACHIEVEMENTS = [
  // — Vitórias —
  { id: "win_first", name: "Guardião de Verdade", desc: "Vença sua primeira partida", check: (c) => c.wins > 0 },
  { id: "clear_d0", name: "Aprendiz Formado", desc: "Vença no Perigo Aprendiz", check: wonAt(0) },
  { id: "clear_d1", name: "Guardião da Floresta", desc: "Vença no Perigo Guardião", check: wonAt(1) },
  { id: "clear_d2", name: "Veterano de Guerra", desc: "Vença no Perigo Veterano", check: wonAt(2) },
  { id: "clear_d3", name: "Implacável", desc: "Vença no Perigo Implacável", check: wonAt(3) },
  { id: "clear_d4", name: "Senhor do Pesadelo", desc: "Vença no Perigo Pesadelo", check: wonAt(4) },
  // — Biomas —
  { id: "win_caatinga", name: "Cabra da Peste", desc: "Liberte o Caboclo d'Água na Caatinga", check: (c) => (c.winsByBiome?.caatinga || 0) > 0 },
  { id: "carrancas_10", name: "Mestre Carranqueiro", desc: "Espante o Caboclo d'Água com carrancas 10 vezes", check: (c) => (c.stats?.carrancas || 0) >= 10 },
  // — Armas —
  { id: "wmax_staff", name: "Cajado Ancestral", desc: "Leve o Cajado ao nível 5", check: weaponMax("STAFF") },
  { id: "wmax_boomer", name: "Retorno Perfeito", desc: "Leve a Vara Encantada ao nível 5", check: weaponMax("BOOMER") },
  { id: "wmax_chain", name: "Tempestade Viva", desc: "Leve o Raio Concentrado ao nível 5", check: weaponMax("CHAIN") },
  { id: "wmax_aura", name: "Inverno Eterno", desc: "Leve a Aura Gélida ao nível 5", check: weaponMax("AURA") },
  { id: "arsenal", name: "Arsenal Completo", desc: "Tenha 4 armas numa mesma partida", check: (c) => !!c.run && c.run.weapons.length >= 4 },
  { id: "evolve_first", name: "Metamorfose", desc: "Evolua uma arma", check: (c) => !!c.run && c.run.weapons.some((w) => w.evolved) },
  // — Reações (cumulativo entre runs) —
  { id: "vapor_100", name: "Mestre do Vapor", desc: "Dispare a reação Vapor 100 vezes", check: (c) => (c.reactions.VAPOR || 0) >= 100, prog: (c) => [c.reactions.VAPOR || 0, 100] },
  { id: "crystal_100", name: "Quebra-Gelo", desc: "Dispare a reação Cristal 100 vezes", check: (c) => (c.reactions.CRYSTAL || 0) >= 100, prog: (c) => [c.reactions.CRYSTAL || 0, 100] },
  { id: "overload_100", name: "Eletricista", desc: "Dispare a reação Sobrecarga 100 vezes", check: (c) => (c.reactions.OVERLOAD || 0) >= 100, prog: (c) => [c.reactions.OVERLOAD || 0, 100] },
  { id: "labareda_100", name: "Fogo Corredor", desc: "Dispare a reação Labareda 100 vezes", check: (c) => (c.reactions.LABAREDA || 0) >= 100, prog: (c) => [c.reactions.LABAREDA || 0, 100] },
  { id: "geada_100", name: "Sopro do Sul", desc: "Dispare a reação Geada 100 vezes", check: (c) => (c.reactions.GEADA || 0) >= 100, prog: (c) => [c.reactions.GEADA || 0, 100] },
  { id: "temporal_100", name: "Dono do Temporal", desc: "Dispare a reação Temporal 100 vezes", check: (c) => (c.reactions.TEMPORAL || 0) >= 100, prog: (c) => [c.reactions.TEMPORAL || 0, 100] },
  // — Meta-progressão —
  { id: "bless_max", name: "Bênção Suprema", desc: "Maximize uma trilha de Bênção (rank 10)", check: (c) => c.maxBlessingRank >= MAX_BLESSING_RANK },
  { id: "ancestral_10", name: "Herdeiro Ancestral", desc: "Tesouro Ancestral no nível 10", check: (c) => c.ancestralLevel >= 10, prog: (c) => [c.ancestralLevel, 10] },
  // Meta subida com a economia 2026-10 (2.000 saía em 2–3 partidas; 25.000 ≈ 8º dia do jogador médio)
  { id: "coins_25000", name: "Tesoureiro da Mata", desc: "Ganhe 25.000 moedas no total", check: (c) => c.totalCoinsEarned >= 25000, prog: (c) => [c.totalCoinsEarned, 25000] },
  { id: "kills_1000", name: "Ceifador do Bosque", desc: "Abata 1.000 inimigos no total", check: (c) => c.totalKills >= 1000, prog: (c) => [c.totalKills, 1000] },
  // — Desafios (condições de vitória variantes) —
  { id: "survive_10min", name: "Maratonista", desc: "Sobreviva 10:00 numa partida", check: (c) => !!c.run && c.run.timeMs >= 600000 },
  { id: "fast_win", name: "Execução Rápida", desc: "Vença em menos de 8:00", check: (c) => !!c.run && c.run.won && c.run.timeMs < 480000 },
  { id: "pacifist_hp", name: "Osso Duro", desc: "Vença no Perigo Veterano+ sem passivo de HP", check: (c) => !!c.run && c.run.won && c.run.difficultyId >= 2 && !c.run.tookHpPassive },
  { id: "solo_staff", name: "Purista", desc: "Vença usando apenas o Cajado", check: (c) => !!c.run && c.run.won && c.run.weapons.length === 1 && c.run.weapons[0].key === "STAFF" },
  { id: "mono_fire", name: "Piromante", desc: "Vença com 2+ armas, todas de fogo", check: monoWin(ELEMENT.FIRE) },
  { id: "mono_ice", name: "Coração de Geada", desc: "Vença com 2+ armas, todas de gelo", check: monoWin(ELEMENT.ICE) },
  { id: "mono_bolt", name: "Filho do Trovão", desc: "Vença com 2+ armas, todas de raio", check: monoWin(ELEMENT.BOLT) },
  { id: "mono_wind", name: "Filho do Vento", desc: "Vença com 2+ armas, todas de vento", check: monoWin(ELEMENT.WIND) },
];

// Áudio: mixagem por barramentos (src/audio/Mixer.js). O volume de cada som fica onde ele toca;
// aqui fica o que vale para GRUPOS de sons. Tudo em dB (o ouvido é logarítmico).
export const AUDIO = {
  // Barra de volume das Opções: vai de −SLIDER_DB dB (começo) a 0 dB (fim); só o zero é mudo.
  // A barra antiga era linear (0,7 = −3 dB): Settings converte o valor salvo uma vez, sem mudar o volume
  SLIDER_DB: 40,
  // Ganho fixo de cada barramento (dB), antes do volume do jogador
  BUS_DB: { music: 0, sfx: 0, ui: 0 },
  // Limitador na saída: rede de segurança contra estouro (não é o mixer)
  LIMITER: { THRESHOLD_DB: -6, KNEE_DB: 0, RATIO: 20, ATTACK_S: 0.003, RELEASE_S: 0.15 },
  // Vozes: no máximo `max` cópias do mesmo efeito começando a cada `ms` (src/audio/Voices.js). O excesso
  // não toca e engrossa a última voz do quadro (volume × √n, até MERGE_MAX). DEFAULT vale para os
  // efeitos sem linha própria. Fora do limite: música, interface e os AVISOS dos chefes ({ alert: true }
  // em sound.play), que nunca podem sumir (docs/CHEFES.md: dá para desviar de ouvido)
  VOICES: {
    DEFAULT: { max: 6, ms: 40 },
    sfx_death: { max: 4, ms: 40 },
    sfx_pickup: { max: 3, ms: 40 },
    sfx_coin: { max: 3, ms: 40 },
  },
  MERGE_MAX: 1.6,
  // Tomadas diferentes do mesmo som (Synth.js): sorteia uma, sem repetir a anterior
  VARIANTS: { sfx_death: ["sfx_death", "sfx_death_2", "sfx_death_3"] },
  // Variação de tom (± fração do rate, sorteada a cada toque) dos efeitos que soavam sempre iguais.
  // Ruído e batida aguentam ±5%; som com nota (sino, moeda) varia menos para não desafinar. De fora:
  // o que já varia ou cuja altura é informação (gemas em sequência sobem de tom, fanfarras)
  JITTER: {
    sfx_death: 0.05, sfx_player_hit: 0.04, sfx_dash: 0.04, sfx_whoosh: 0.05, sfx_fire_attack: 0.05,
    sfx_bolt_attack: 0.03, sfx_ice_attack: 0.02, sfx_folhas: 0.05, sfx_catavento: 0.05, sfx_bolas: 0.03,
    sfx_mirage: 0.015, sfx_coin: 0.015, sfx_react_vapor: 0.05, sfx_react_overload: 0.04,
    sfx_react_labareda: 0.05, sfx_react_temporal: 0.05, sfx_react_geada: 0.02, sfx_react_crystal: 0.02,
  },
  // Momentos (Mixer.setMoment). Pausa, cartas de nível, Reviver e a escolha da Noite Eterna abafam a
  // música e os efeitos da partida (passa-baixa + queda) e voltam ao retomar; a interface nunca abafa
  MUFFLE: { LP_HZ: 800, DB: -6, IN_S: 0.25, OUT_S: 0.3 },
  // Vida baixa: o coração bate (sfx_heartbeat_run, mais rápido perto do fim) e a música escurece um
  // pouco e FICA assim (nada de "respirar" a cada golpe ou reação). Entra abaixo de HP e só sai acima
  // de HP_OUT (histerese: curar 1 ponto e tomar 1 golpe não liga e desliga)
  DANGER: { HP: 0.3, HP_OUT: 0.36, BEAT_MS: [1250, 800], BEAT_VOL: 0.42, MUSIC_LP_HZ: 3000, MUSIC_DB: -2, IN_S: 0.8, OUT_S: 1.5 },
  // Troca de trilha (chegada do chefe, Noite Eterna): a atual afunda DIP_DB na hora (o rugido fica
  // sozinho) e some até a próxima barra de compasso (pelo menos MIN_FADE_BEATS tempos); a nova entra
  // num tempo forte (múltiplo de GRID_BEATS) da mesma grade, depois de ENTER_AFTER_S (o rugido)
  SWITCH: { DIP_DB: -12, DIP_S: 0.15, MIN_FADE_BEATS: 1, GRID_BEATS: 2, ROAR_S: 0.95 },
  // Morte: a fita para (rate 1 → RATE) com a música fechando no passa-baixa e sumindo em S segundos
  // (dentro da câmera lenta de 0,9 s); os efeitos abafam um pouco junto
  DEATH: { RATE: 0.5, LP_HZ: 450, SFX_LP_HZ: 1500, SFX_DB: -4, S: 0.85 },
};

export const COLORS = {
  FIRE: 0xff7a3c,
  ICE: 0x5cc8ff,
  BOLT: 0xd98cff,
  WIND: 0x7fd9bd,
  GOLD: 0xd9b25c,
  INK: 0xe8f0e6,
  BG: 0x0a0e0a,
  DANGER: 0xff5a6e,
  XP: 0x6fcf6f,
};

// Idioma: traduz no lugar os campos de TEXTO das fichas acima (nomes, descrições, falas)
// antes que qualquer outro módulo os leia. Ver src/i18n/i18n.js e docs/IDIOMAS.md.
localize([GAME, DIFFICULTY, PLAYER, ENEMY, BOSS, BOSS_FIGHT, ELEMENT, STATUS, REACTION, WEAPONS, DEED_STATS, LINKS, CHARACTERS, PASSIVES, RESONANCE, PACTS, SHRINE, CARDS, INTRO, ARENA, ENDLESS, LEGENDS, BIOMES, DUST_DEVIL, BUILD, BUILDINGS, WOOD, GARDEN, DAILY, SEASONS, FISHING, KITCHEN, LANTERN, ADMOB, ADS, DROPS, CHEST, ELITE, MIMIC, META, BLESSINGS, ANCESTRAL, ACHIEVEMENTS, COLORS]);
