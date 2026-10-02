// Balanceamento central. Tweak aqui, sem caçar números no código.
// Fórmulas paramétricas decididas no design (D16).

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
};

// Níveis de dificuldade ("Perigo") — ver docs/META_LOOP.md (Fase 1).
// Multiplicadores GLOBAIS aplicados sobre as fórmulas paramétricas (D16):
//   HP/dano de inimigo, taxa de spawn e recompensa em moedas.
// Cada nível libera o seguinte ao ser VENCIDO (boss morto). reward cresce mais
// rápido que a dificuldade pra financiar os sinks de meta-progressão.
// durationS = tempo até o chefe nascer: 7 min nos Perigos iniciais, até 10 min no Pesadelo
// (novato = partida curta; veterano = mais profundidade).
export const DIFFICULTY = [
  { id: 0, name: "Aprendiz",   hpMult: 0.85, dmgMult: 0.85, spawnMult: 0.9,  rewardMult: 1.0,  durationS: 420 },
  { id: 1, name: "Guardião",   hpMult: 1.0,  dmgMult: 1.0,  spawnMult: 1.0,  rewardMult: 1.25, durationS: 420 },
  { id: 2, name: "Veterano",   hpMult: 1.25, dmgMult: 1.2,  spawnMult: 1.15, rewardMult: 1.6,  durationS: 480 },
  { id: 3, name: "Implacável", hpMult: 1.6,  dmgMult: 1.45, spawnMult: 1.3,  rewardMult: 2.1,  durationS: 540 },
  { id: 4, name: "Pesadelo",   hpMult: 2.1,  dmgMult: 1.8,  spawnMult: 1.5,  rewardMult: 3.0,  durationS: 600 },
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
  COIN_DROP_CHANCE: 0.05,
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
};

// Elementos & reações (D11, D21)
export const ELEMENT = { FIRE: "fire", ICE: "ice", BOLT: "bolt" };

export const STATUS = {
  FIRE: { duration: 4000, tickMs: 500, dmgPerTick: 1 },
  ICE: { duration: 3000, slowFactor: 0.5, damageAmp: 1.35 },
  BOLT: { duration: 2000, tickMs: 125, dmgPerTick: 0.5 },
};

export const REACTION = {
  // FIRE + ICE => Vapor: nuvem ESCALDANTE que causa dano contínuo na área (não dá mais slow)
  VAPOR: {
    color: 0xffc8a0,
    radius: 80,
    duration: 2200, // era 3000: nuvens não têm cap de concorrência, encurtar evita carpete de DoT
    dmgPerTick: 5,
    tickMs: 300,
    label: "VAPOR!",
  },
  // CONGELADO + BOLT => Cristal: o inimigo congelado ESTILHAÇA em lascas curtas (dano BAIXO)
  CRYSTAL: {
    color: 0x9fe8ff,
    radius: 70,
    dmg: 20, // era 12
    selfDmg: 0, // era 14: auto-dano > dano fazia a reação ter EV negativo (armadilha)
    shards: 8,
    label: "CRISTAL!",
  },
  // FIRE + BOLT => Sobrecarga: a recompensa em ÁREA — corrente forte entre muitos inimigos
  OVERLOAD: {
    color: 0xffe24c,
    jumps: 6,
    dmgPerJump: 16,
    jumpRange: 220,
    label: "SOBRECARGA!",
  },
};

// Armas base + evoluções (D14)
export const WEAPONS = {
  STAFF: {
    name: "Cajado",
    element: ELEMENT.FIRE,
    baseDmg: 7,
    cooldown: 1100,
    range: 280,
    projSpeed: 300,
  },
  // Aura Gélida: campo de CONTROLE. Dano de chip + slow; quem fica 1s dentro CONGELA.
  AURA: {
    name: "Aura Gélida",
    element: ELEMENT.ICE,
    baseDmg: 2,
    cooldown: 1200,
    range: 120,
    freezeAfterMs: 900,
    freezeMs: 1300,
    freezeImmuneMs: 3000,
  },
  BOOMER: {
    name: "Bumerangue",
    element: ELEMENT.FIRE,
    baseDmg: 4,
    cooldown: 1600,
    range: 240,
    projSpeed: 280,
  },
  // Raio: dano ALTO focado em 1 alvo. (A "corrente" agora é a reação Sobrecarga: fogo+raio.)
  CHAIN: {
    name: "Raio Concentrado",
    element: ELEMENT.BOLT,
    baseDmg: 15,
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
    element: ELEMENT.FIRE,
    evolvesFrom: "STAFF",
    partner: "AURA",
    baseDmg: 12,
    cooldown: 850,
    range: 300,
    projSpeed: 320,
    cloud: { radius: 55, dmgPerTick: 4, tickMs: 300, duration: 1400, color: 0xffc8a0 },
  },
  // Sobrecarga Eterna: o raio volta a ENCADEAR — acerta o alvo prioritário e
  // salta entre inimigos próximos com dano decrescente, aplicando bolt em todos.
  OVERLOAD_X: {
    name: "Sobrecarga Eterna",
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
  // Fênix: o bumerangue deixa um RASTRO DE CHAMAS no trajeto — zonas que
  // queimam (dano + status fire) quem cruza o caminho.
  PHOENIX: {
    name: "Fênix",
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
    element: ELEMENT.FIRE,
    baseDmg: 6,
    cooldown: 1250,
    range: 165,
    halfAngle: 0.62, // ~35°
  },
  // Geleira (Orbe Lv5 + Aura): orbes maiores, 2 extras, e CONGELAM ao tocar.
  GLACIER: {
    name: "Geleira Viva",
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
  // Inferno (Sopro Lv5 + Bumerangue): cone largo que deixa o chão em chamas.
  INFERNO: {
    name: "Inferno",
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
    element: ELEMENT.BOLT,
    baseDmg: 3, // por tique (tique lento: muitos inimigos piscando a 3×/s viravam ruído)
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
  // RAIO a cada tique → dispara SOBRECARGA sozinho.
  FIRE_WHIRL: {
    name: "Redemoinho de Brasa",
    element: ELEMENT.BOLT,
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
};

export const MAX_WEAPON_LEVEL = 5;

// Personagens jogáveis — cada um começa com uma arma e tem um viés de stats.
// Sprite = textura hero_<id> (arte própria, src/art/Hero.js). mods aplicados no início da run.
export const CHARACTERS = [
  {
    id: "guardian",
    name: "Curupira",
    title: "Guardião da mata",
    weapon: "STAFF",
    cost: 0,
    perk: "Equilibrado, sem fraquezas. Bom para aprender.",
    mods: {},
  },
  {
    id: "huntress",
    name: "Caipora",
    title: "Protetora dos bichos",
    weapon: "BOOMER",
    cost: 120,
    perk: "+12% velocidade · +8% crítico · −10% vida",
    mods: { speed: 1.12, crit: 0.08, hp: 0.9 },
  },
  {
    id: "druid",
    name: "Iara",
    title: "Senhora das águas",
    weapon: "AURA",
    cost: 180,
    perk: "+20% área · +1 Vida/s · −15% velocidade",
    mods: { area: 1.2, regen: 1, speed: 0.85 },
  },
  {
    id: "shaman",
    name: "Saci",
    title: "Redemoinho travesso",
    weapon: "CHAIN",
    cost: 260,
    perk: "−15% recarga · +15% dano · −25% vida",
    mods: { cd: 0.85, dmg: 1.15, hp: 0.75 },
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
        name: `+${v}% Vida máxima`,
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
      return { name: `+${v}% Velocidade`, apply: (p) => (p.speed *= 1 + v / 100) };
    },
  },
  {
    id: "cooldown",
    label: "Ritmo Ancestral",
    desc: "Todas as armas disparam mais vezes.",
    roll: () => {
      const v = r(12, 24);
      return { name: `−${v}% Recarga`, apply: (p) => (p.cdMult *= 1 - v / 100) };
    },
  },
  {
    id: "area",
    label: "Raízes Largas",
    desc: "Auras, nuvens, reações e bumerangues alcançam mais longe.",
    roll: () => {
      const v = r(15, 35);
      return { name: `+${v}% Área`, apply: (p) => (p.areaMult *= 1 + v / 100) };
    },
  },
  {
    id: "proj",
    label: "Galhos Extras",
    desc: "+1 projétil/alvo no Cajado e no Raio.",
    roll: () => ({ name: "+1 Projétil", apply: (p) => (p.extraProj += 1) }),
  },
  {
    id: "lifesteal",
    label: "Sede da Mata",
    desc: "Parte do dano causado vira cura.",
    roll: () => {
      const v = r(4, 10);
      return { name: `+${v}% Roubo de vida`, apply: (p) => (p.lifestealPct += v / 100) };
    },
  },
  {
    id: "regen",
    label: "Musgo Curativo",
    desc: "Regenera vida continuamente.",
    roll: () => {
      const v = rf(0.8, 2.6);
      return { name: `+${v} Vida/s`, apply: (p) => (p.regenPerSec += v) };
    },
  },
  {
    id: "crit",
    label: "Olho de Falcão",
    desc: "Críticos causam dano dobrado e empurram.",
    roll: () => {
      const v = r(8, 15);
      return { name: `+${v}% Crítico`, apply: (p) => (p.critChance += v / 100) };
    },
  },
  {
    id: "magnet",
    label: "Ímã de Seiva",
    desc: "Puxa gemas e moedas de mais longe.",
    roll: () => {
      const v = r(45, 75);
      return { name: `+${v}% Coleta`, apply: (p) => (p.pickupRadius *= 1 + v / 100) };
    },
  },
  {
    id: "armor",
    label: "Casca de Carvalho",
    desc: "Reduz todo dano recebido (máx. 50%).",
    roll: () => {
      const v = r(9, 15);
      return { name: `−${v}% Dano recebido`, apply: (p) => (p.dmgTakenMult = Math.max(0.5, p.dmgTakenMult * (1 - v / 100))) };
    },
  },
  {
    id: "luck",
    label: "Trevo da Sorte",
    desc: "Mais moedas, corações e orbes caindo.",
    roll: () => {
      const v = r(22, 38);
      return { name: `+${v}% Sorte`, apply: (p) => (p.luck += v / 100) };
    },
  },
];

// Ressonância elemental: armas do MESMO elemento se reforçam (+15% de dano por arma extra
// daquele elemento); ter os TRÊS elementos monta o Prisma (reações +30%). Especializar ou
// misturar é a escolha de build.
export const RESONANCE = {
  PER_EXTRA_WEAPON: 0.15,
  PRISM_REACTION: 1.3,
  NAMES: { fire: "FOGO", ice: "GELO", bolt: "RAIO" },
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
          gain: `+${g}% Dano`,
          cost: `Em troca: −${c}% Vida máxima`,
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
          gain: `+${g}% Velocidade`,
          cost: `Em troca: +${c}% Dano recebido`,
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
          gain: `+${g}% XP`,
          cost: `Em troca: −${c}% Velocidade`,
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
          gain: `−${g}% Recarga`,
          cost: `Em troca: −${c}% Vida máxima`,
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
          gain: `−${g}% Dano recebido`,
          cost: `Em troca: −${c}% Velocidade`,
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
// "extra_banish"). A bênção da Samaúma pode dar mais um.
export const CARDS = {
  BANISH_BASE: 1,
  BANISH_PER_SHRINE_LEVEL: 0,
};

// Roleta da Samaúma (Clareira): por anúncio premiado, sorteia UMA bênção para a próxima
// partida. Recarrega de hora em hora (relógio confiável). Fatias de peso igual, todas boas.
export const TREE = {
  COOLDOWN_MIN: 60,
  // mods: dmg/hp/speed multiplicam; xp, pickup (ímã) e coins também; banish soma; guard
  // multiplica o dano sofrido. Cores da paleta (Palette.js).
  SLICES: [
    { id: "dmg", label: "+20% DANO", short: "Dano +20%", color: 0xe8434f, mods: { dmg: 1.2 } },
    { id: "xp", label: "+30% XP", short: "XP +30%", color: 0x5cc8ff, mods: { xp: 1.3 } },
    { id: "coins", label: "+40% MOEDAS", short: "Moedas +40%", color: 0xf2c14e, mods: { coins: 1.4 } },
    { id: "hp", label: "+25% VIDA", short: "Vida +25%", color: 0x9ccf62, mods: { hp: 1.25 } },
    { id: "banish", label: "+1 BANIR", short: "+1 banimento", color: 0xc78cff, mods: { banish: 1 } },
    { id: "magnet", label: "+60% ÍMÃ", short: "Ímã +60%", color: 0xff7eb6, mods: { pickup: 1.6 } },
    { id: "speed", label: "+15% VELOC.", short: "Velocidade +15%", color: 0xff7a3c, mods: { speed: 1.15 } },
    { id: "guard", label: "+15% DEFESA", short: "Dano sofrido -15%", color: 0xb3bac4, mods: { guard: 0.85 } },
  ],
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

// Bestiário das LENDAS (aba do Mural). Cada ficha: quem é no jogo + a ORIGEM
// da lenda (cuidado de representação: citar a origem — ver TEMA_FOLCLORE.md).
// char = liberada junto com o guardião; as outras, ao encontrá-las na mata.
export const LEGENDS = [
  { id: "curupira", char: "guardian", name: "Curupira", sprite: ["hero_guardian", 0, 2.2], role: "Guardião da mata · fogo",
    origin: "Lenda de origem tupi, registrada já no século XVI. Protege as matas e os bichos; os pés virados para trás deixam rastros que confundem os caçadores." },
  { id: "caipora", char: "huntress", name: "Caipora", sprite: ["hero_huntress", 0, 2.2], role: "Protetora dos bichos · bumerangue",
    origin: "Do tupi ka'apora, \"habitante do mato\". Protetora dos animais contra a caça em excesso; em muitas regiões anda montada num porco-do-mato." },
  { id: "iara", char: "druid", name: "Iara", sprite: ["hero_druid", 0, 2.2], role: "Senhora das águas · gelo",
    origin: "Do tupi y-îara, \"senhora das águas\". Vive nos rios da Amazônia e encanta com seu canto; a lenda somou traços europeus e africanos com o tempo." },
  { id: "saci", char: "shaman", name: "Saci", sprite: ["hero_shaman", 0, 2.2], role: "Redemoinho travesso · raio",
    origin: "Nasceu do Jaxy Jaterê guarani e ganhou traços africanos e europeus ao longo dos séculos. Esperto e brincalhão, vive dentro dos redemoinhos de vento." },
  { id: "mula", name: "Mula sem Cabeça", sprite: ["mon_alpha", 0, 2.2], role: "Minichefe · investidas em chamas",
    origin: "Lenda de origem ibérica espalhada pelo interior do Brasil: uma mula que solta fogo pelo pescoço e galopa pelos campos em noites escuras." },
  { id: "corposeco", name: "Corpo-Seco", sprite: ["mon_elder", 0, 2], role: "Minichefe · lento e resistente",
    origin: "Contada no interior do Sudeste: alguém tão cruel em vida que nem a terra o aceitou, e ficou seco, vagando. Aqui, a Podridão o levantou." },
  { id: "mapinguari", name: "Mapinguari", sprite: ["mon_boss", 4, 1.2], role: "Chefe · corrompido pela Podridão",
    origin: "Gigante da Amazônia, peludo, com um olho na testa e a boca na barriga. Há quem ligue a lenda às preguiças-gigantes extintas. Vencê-lo o liberta." },
];

// Obras da Clareira (níveis das construções): custam moedas + Madeira Ancestral
// e levam tempo real, feitas pelo João-de-barro (1 obra por vez). Partidas
// adiantam a obra; faltando FREE_FINISH_MIN ou menos, conclui com um toque.
export const BUILD = {
  // índice = nível ATUAL → custo e tempo para subir ao próximo
  STEPS: [
    null,
    { coins: 40, wood: 2, min: 0 },
    { coins: 120, wood: 5, min: 5 },
    { coins: 280, wood: 10, min: 60 },
    { coins: 550, wood: 18, min: 240 },
  ],
  RUN_SPEEDUP_MIN: 10, // cada partida adianta a obra em 10 min…
  RUN_SPEEDUP_PER_MIN: 1, // …+1 min por minuto sobrevivido
  FREE_FINISH_MIN: 2, // menor que a obra mais curta (5 min), senão ela vira instantânea
  AD_SPEEDUP_MIN: 30, // anúncio opcional (desligado junto com ADS.ENABLED)
  // O que cada nível libera
  FORGE_WEAPON_LEVEL: { BOOMER: 1, CHAIN: 2, FIREFLY: 2, ORB: 3, HAIL: 3, FLAME: 4, WHIRL: 4 }, // Forja nv mínimo
  // Vagas de arma na partida por nível da Forja (como o Megabonk: começa com 2 e chega a 4).
  // O herói já nasce com 1, então o nível 1 dá 1 escolha; cada vaga nova vem de obra.
  FORGE_WEAPON_SLOTS: [0, 2, 2, 3, 4],
  FIRE_CHARACTER_LEVEL: { huntress: 2, druid: 3, shaman: 4 }, // Fogueira nv → guardião
};
// Santuário nv N → bênçãos até o rank N
export const BUILDINGS = {
  fire: { name: "Fogueira", max: 4 },
  shrine: { name: "Santuário", max: 5 },
  forge: { name: "Forja", max: 4 },
  garden: { name: "Horta", max: 4 }, // nível → canteiros (GARDEN.PLOTS) e plantas
  pond: { name: "Lago", max: 3 }, // nível → vara melhor e mais peixes (FISHING.LEVELS)
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
  PLOTS: [0, 2, 4, 6, 9], // canteiros por nível da Horta (obra do João-de-barro)
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
  },
  NEEDS: {
    water: "Com sede! Toque para regar.",
    weed: "Erva daninha! Toque para arrancar.",
    pest: "Lagarta! Toque para tirar.",
  },
  // Sementes raras caem nas partidas (só depois que a Horta apareceu)
  SEEDS: { MINIBOSS: 1, GOLDEN_CHEST: 1, BOSS: 2 },
};

// Hábito diário (M4 — ver docs/PRE_LANCAMENTO.md §2). "Dia" = data LOCAL do
// aparelho. Missões: 3 por dia (2 da floresta + 1 da Clareira quando houver),
// sorteadas pela data; n = alvos possíveis; needs = só quando o jogador já
// conhece aquilo. Nada vende poder: o prêmio é moeda, madeira, semente.
export const DAILY = {
  MISSIONS: [
    { id: "kills", text: "Abata {n} criaturas", stat: "kills", n: [150, 300, 500], coins: 50 },
    { id: "reactions", text: "Dispare {n} reações elementais", stat: "reactions", n: [15, 30, 50], coins: 50 },
    { id: "vapor", text: "Faça {n} Vapores (fogo + gelo)", stat: "VAPOR", n: [8, 15], coins: 60 },
    { id: "crystal", text: "Faça {n} Cristais (gelo + raio)", stat: "CRYSTAL", n: [5, 10], coins: 60, needs: (d) => (d.unlockedWeapons || []).includes("CHAIN") },
    { id: "overload", text: "Faça {n} Sobrecargas (fogo + raio)", stat: "OVERLOAD", n: [5, 10], coins: 60, needs: (d) => (d.unlockedWeapons || []).includes("CHAIN") },
    { id: "survive", text: "Sobreviva {n} minutos numa partida", stat: "minutes", n: [3, 5], coins: 50, max: true },
    { id: "runs", text: "Jogue {n} partidas", stat: "runs", n: [2, 3], coins: 40 },
    { id: "chests", text: "Abra {n} baús na floresta", stat: "chests", n: [2, 4], coins: 50 },
    { id: "lanterns", text: "Quebre {n} lanternas de cogumelo", stat: "lanterns", n: [3, 6], coins: 40 },
    { id: "boss", text: "Vença o Mapinguari", stat: "wins", n: [1], coins: 120, needs: (d) => (d.wins || 0) > 0 },
    // Da Clareira
    { id: "harvest", text: "Colha {n} vezes na horta", stat: "harvest", n: [2, 4], coins: 40, camp: true, needs: (d) => (d.revealed || []).includes("garden") },
    { id: "fish", text: "Pesque {n} peixes no lago", stat: "fish", n: [2, 3], coins: 40, camp: true, needs: (d) => (d.revealed || []).includes("pond") },
    { id: "cook", text: "Cozinhe {n} prato{s}", stat: "cook", n: [1, 2], coins: 40, camp: true, needs: (d) => (d.revealed || []).includes("kitchen") },
  ],
  ALL_BONUS: { coins: 80, wood: 2 }, // completar as 3 do dia
  // Presente de dias seguidos (volta ao 1 depois do 7º ou se pular um dia)
  STREAK: [{ coins: 40 }, { coins: 60 }, { wood: 2 }, { coins: 90 }, { seeds: 1, coins: 40 }, { coins: 120 }, { coins: 200, wood: 5, seeds: 2 }],
  // Baú diário junto à fogueira: 1 grátis por dia + 1 com anúncio (opcional)
  CHEST: { coins: [30, 80], woodChance: 0.4, seedChance: 0.25 },
};

// Datas comemorativas (calendário REAL): decoração temática na Clareira só
// na época. mês/dia inclusivos. Ex.: festa junina + julina = bandeirinhas.
export const SEASONS = [{ id: "junina", name: "Festa Junina", from: [6, 1], to: [7, 31] }];

// Lago da Clareira (M3): pesca no chão (trapiche) + minijogo de um polegar:
// segurar sobe a zona verde, soltar desce; manter o peixe dentro enche a barra.
// O lago "descansa": tem poucos peixes e repõe com o tempo real (sem cronômetro
// na cara — bolhas na água mostram que há peixe). Horário REAL muda quem aparece.
export const FISHING = {
  // nível do Lago (obra) → zona verde (fração da barra) e peixes no lago
  LEVELS: [null, { zone: 0.26, cap: 4 }, { zone: 0.31, cap: 6 }, { zone: 0.36, cap: 8 }],
  REGEN_MIN: 20, // o lago repõe 1 peixe a cada 20 min
  BITE_S: [1.2, 3.5], // espera pela fisgada
  HOOK_S: 1.2, // tempo para puxar depois do "!"
  // Física do minijogo = BobberBar do Stardew Valley (valores por quadro a 60 Hz,
  // pista de 568 unidades; a zona é a fração `zone` da pista).
  STEP_HZ: 60,
  TRACK: 568,
  FISH_MAX: 532, // o peixe anda de 0 a 532 (o ícone tem 32 de folga)
  START: 0.3, // progresso inicial
  FILL: 0.002, // por quadro com o peixe na zona (~8 s para encher de 0 a 1)
  DRAIN: 0.003, // por quadro com o peixe fora (~5,5 s para esvaziar)
  GRAVITY: 0.25, // segurando sobe (−), soltando cai (+)
  IN_BAR_GRAVITY: 0.6, // com o peixe dentro, a zona pesa 40% menos
  BOUNCE: 2 / 3, // a zona quica nas bordas com 2/3 da velocidade
  // diff = dificuldade (0–100) · move: mixed · smooth (suave) · dart (arrancadas) · sinker (afunda) · floater (sobe)
  // w = peso no sorteio; day/night = só nesse horário (6h–18h é dia)
  FISH: {
    lambari: { name: "Lambari", move: "mixed", diff: 15, w: 30, cm: [8, 16] },
    cara: { name: "Cará", move: "mixed", diff: 25, w: 22, cm: [10, 22] },
    tilapia: { name: "Tilápia", move: "smooth", diff: 35, w: 18, cm: [18, 42] },
    traira: { name: "Traíra", move: "dart", diff: 60, w: 14, cm: [25, 60], night: true },
    pacu: { name: "Pacu", move: "sinker", diff: 55, w: 11, cm: [30, 70] },
    tucunare: { name: "Tucunaré", move: "dart", diff: 70, w: 7, cm: [30, 80], day: true },
    dourado: { name: "Dourado", move: "mixed", diff: 78, w: 3, cm: [50, 100], day: true },
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
  TOUCH_R: 34,
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
    tree_spin: "ca-app-pub-7068898840847782/7068468581",
  },
  // Intersticial: pronto e DESLIGADO (começamos sem, como o Vampire Survivors; ver PRE_LANCAMENTO 1.7)
  INTERSTITIAL: "ca-app-pub-7068898840847782/5930646735",
};

export const ADS = {
  ENABLED: true, // ligado: no app só aparece com o AdMob pronto e consentimento ok (ver AdService.canShow)
  TESTING: true, // anúncios de TESTE do Google. Troque para false SÓ no build de loja
  TEST_EEA: false, // true = simula a Europa para ver o formulário de consentimento (só com TESTING)
  REVIVE_HP_PCT: 0.5, // volta com metade da vida
  REVIVE_INVULN_MS: 3000,
  REVIVE_CLEAR_RADIUS: 280, // onda que empurra/fere quem está em volta
  REVIVE_OFFER_S: 8, // tempo para decidir antes de encerrar a partida
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
  COIN_BOSS_LOSS: 10,
  WEAPON_UNLOCK_COST: { BOOMER: 30, CHAIN: 60, FIREFLY: 90, ORB: 140, HAIL: 150, FLAME: 180, WHIRL: 220 },
  WEAPON_UNLOCK_ORDER: ["BOOMER", "CHAIN", "FIREFLY", "ORB", "HAIL", "FLAME", "WHIRL"], // Aura já vem liberada
  ABILITY_UNLOCK_COST: { DASH: 50, AWAKEN: 80 },
};

// Bênçãos persistentes — trilhas de 5 ranks (Fase 2, ver docs/META_LOOP.md).
// Compradas no menu; `apply(player, rank)` é chamado uma vez no início da run e
// aplica o efeito CUMULATIVO do rank atingido. Custo do rank R = costs[R-1].
export const MAX_BLESSING_RANK = 5;

export const BLESSINGS = [
  {
    id: "hp1",
    name: "Vigor da Mata",
    desc: "+15 HP máximo por rank",
    costs: [40, 70, 120, 200, 320],
    apply: (p, rank) => {
      p.maxHp += 15 * rank;
      p.hp = p.maxHp;
    },
  },
  {
    id: "spd1",
    name: "Pés Ligeiros",
    desc: "+6% velocidade por rank",
    costs: [60, 100, 170, 290, 490],
    apply: (p, rank) => {
      p.speed *= Math.pow(1.06, rank);
    },
  },
  {
    id: "dmg1",
    name: "Cólera Antiga",
    desc: "+8% dano de arma por rank",
    costs: [90, 150, 255, 435, 740],
    apply: (p, rank) => {
      p._blessingDmgMult = (p._blessingDmgMult || 1) * Math.pow(1.08, rank);
    },
  },
  {
    id: "pickup",
    name: "Olhar de Coruja",
    desc: "+25% raio de coleta por rank",
    costs: [50, 85, 145, 245, 415],
    apply: (p, rank) => {
      p.pickupRadius *= Math.pow(1.25, rank);
    },
  },
  {
    id: "awaken1",
    name: "Eco do Despertar",
    desc: "+15% ganho de Despertar por rank",
    costs: [80, 135, 230, 390, 665],
    apply: (p, rank) => {
      p._awakenGainMult = (p._awakenGainMult || 1) * Math.pow(1.15, rank);
    },
  },
  {
    id: "dash1",
    name: "Sopro do Vento",
    desc: "−10% recarga do dash por rank",
    costs: [70, 120, 200, 340, 580],
    apply: (p, rank) => {
      p._dashCdMult = (p._dashCdMult || 1) * Math.pow(0.9, rank);
    },
  },
  {
    id: "xp1",
    name: "Sabedoria",
    desc: "+10% XP por rank",
    costs: [100, 170, 290, 490, 830],
    apply: (p, rank) => {
      p._xpMult = (p._xpMult || 1) * Math.pow(1.1, rank);
    },
  },
  {
    id: "crit1",
    name: "Olhar do Caçador",
    desc: "+6% chance de crítico por rank",
    costs: [90, 150, 255, 435, 740],
    apply: (p, rank) => {
      p.critChance += 0.06 * rank;
    },
  },
];

// Tesouro Ancestral — sink INFINITO (Fase 2). +2% dano geral por nível; custo
// cresce 1,15× por compra. Auto-limita pelo custo, nunca esgota: moeda nunca
// vira lixo. Aplicado via _blessingDmgMult no início da run.
export const ANCESTRAL = {
  DMG_PER_LEVEL: 0.02,
  BASE_COST: 100,
  COST_GROWTH: 1.15,
  cost: (level) => Math.floor(100 * Math.pow(1.15, level)),
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
  // — Armas —
  { id: "wmax_staff", name: "Cajado Ancestral", desc: "Leve o Cajado ao nível 5", check: weaponMax("STAFF") },
  { id: "wmax_boomer", name: "Retorno Perfeito", desc: "Leve o Bumerangue ao nível 5", check: weaponMax("BOOMER") },
  { id: "wmax_chain", name: "Tempestade Viva", desc: "Leve o Raio Concentrado ao nível 5", check: weaponMax("CHAIN") },
  { id: "wmax_aura", name: "Inverno Eterno", desc: "Leve a Aura Gélida ao nível 5", check: weaponMax("AURA") },
  { id: "arsenal", name: "Arsenal Completo", desc: "Tenha 4 armas numa mesma partida", check: (c) => !!c.run && c.run.weapons.length >= 4 },
  { id: "evolve_first", name: "Metamorfose", desc: "Evolua uma arma", check: (c) => !!c.run && c.run.weapons.some((w) => w.evolved) },
  // — Reações (cumulativo entre runs) —
  { id: "vapor_100", name: "Mestre do Vapor", desc: "Dispare a reação Vapor 100 vezes", check: (c) => (c.reactions.VAPOR || 0) >= 100, prog: (c) => [c.reactions.VAPOR || 0, 100] },
  { id: "crystal_100", name: "Quebra-Gelo", desc: "Dispare a reação Cristal 100 vezes", check: (c) => (c.reactions.CRYSTAL || 0) >= 100, prog: (c) => [c.reactions.CRYSTAL || 0, 100] },
  { id: "overload_100", name: "Eletricista", desc: "Dispare a reação Sobrecarga 100 vezes", check: (c) => (c.reactions.OVERLOAD || 0) >= 100, prog: (c) => [c.reactions.OVERLOAD || 0, 100] },
  // — Meta-progressão —
  { id: "bless_max", name: "Bênção Suprema", desc: "Maximize uma trilha de Bênção (rank 5)", check: (c) => c.maxBlessingRank >= MAX_BLESSING_RANK },
  { id: "ancestral_10", name: "Herdeiro Ancestral", desc: "Tesouro Ancestral no nível 10", check: (c) => c.ancestralLevel >= 10, prog: (c) => [c.ancestralLevel, 10] },
  { id: "coins_2000", name: "Tesoureiro da Mata", desc: "Ganhe 2.000 moedas no total", check: (c) => c.totalCoinsEarned >= 2000, prog: (c) => [c.totalCoinsEarned, 2000] },
  { id: "kills_1000", name: "Ceifador do Bosque", desc: "Abata 1.000 inimigos no total", check: (c) => c.totalKills >= 1000, prog: (c) => [c.totalKills, 1000] },
  // — Desafios (condições de vitória variantes) —
  { id: "survive_10min", name: "Maratonista", desc: "Sobreviva 10:00 numa partida", check: (c) => !!c.run && c.run.timeMs >= 600000 },
  { id: "fast_win", name: "Execução Rápida", desc: "Vença em menos de 8:00", check: (c) => !!c.run && c.run.won && c.run.timeMs < 480000 },
  { id: "pacifist_hp", name: "Osso Duro", desc: "Vença no Perigo Veterano+ sem passivo de HP", check: (c) => !!c.run && c.run.won && c.run.difficultyId >= 2 && !c.run.tookHpPassive },
  { id: "solo_staff", name: "Purista", desc: "Vença usando apenas o Cajado", check: (c) => !!c.run && c.run.won && c.run.weapons.length === 1 && c.run.weapons[0].key === "STAFF" },
  { id: "mono_fire", name: "Piromante", desc: "Vença com 2+ armas, todas de fogo", check: monoWin(ELEMENT.FIRE) },
  { id: "mono_ice", name: "Coração de Geada", desc: "Vença com 2+ armas, todas de gelo", check: monoWin(ELEMENT.ICE) },
  { id: "mono_bolt", name: "Filho do Trovão", desc: "Vença com 2+ armas, todas de raio", check: monoWin(ELEMENT.BOLT) },
];

export const COLORS = {
  FIRE: 0xff7a3c,
  ICE: 0x5cc8ff,
  BOLT: 0xd98cff,
  GOLD: 0xd9b25c,
  INK: 0xe8f0e6,
  BG: 0x0a0e0a,
  DANGER: 0xff5a6e,
  XP: 0x6fcf6f,
};
