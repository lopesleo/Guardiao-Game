// Laboratório da pesca: mesma física de CampPond._fishStep, com jogadores simulados de reflexo
// humano (enxergam o peixe com atraso de REACT quadros, antecipam pela velocidade da zona e erram
// um pouco). Mostra a taxa de captura por peixe e nível do Lago.
//   node tools/pesca-lab.mjs                       → valores atuais (perfis novato e casual)
//   SK=novato,casual,bom N=2000 node tools/pesca-lab.mjs
//   SO_NOVO=1 NOVO='{"DRAIN":0.0025}' node tools/pesca-lab.mjs   → testa uma proposta
import { FISHING } from "../src/config.js";
const N = +(process.env.N ?? 3000);
function run(F, fish, zone, skill) {
  const rnd = Math.random, ri = (a, b) => a + Math.floor(rnd() * (b - a));
  const d = fish.diff, barH = Math.round(zone * F.TRACK);
  const f = { move: fish.move, barH, barPos: F.TRACK - barH, barSpeed: 0, pos: 508, target: ((100 - d) / 100) * 548, speed: 0, fsa: 0, prog: F.START };
  const hist = [];
  let held = false, nextDecide = 0;
  for (let t = 0; t < 60 * 120 && f.prog > 0 && f.prog < 1; t++) {
    hist.push(f.pos);
    const seen = hist[Math.max(0, hist.length - 1 - skill.react)];
    if (t >= nextDecide) {
      const barC = f.barPos - 32 + barH / 2 + 2;
      const err = seen - (barC + f.barSpeed * skill.lead) + (rnd() - 0.5) * skill.noise;
      held = err < 0;
      nextDecide = t + skill.tap; // o polegar não troca a cada quadro
    }
    // --- física (cópia de _fishStep) ---
    if (rnd() < (d * (f.move === "smooth" ? 20 : 1)) / 4000 && (f.move !== "smooth" || f.target === -1)) {
      const pct = Math.min(99, d + ri(10, 45)) / 100;
      f.target = f.pos + ri(-Math.floor(f.pos), Math.floor(548 - f.pos)) * pct;
    }
    if (f.move === "floater") f.fsa = Math.max(f.fsa - 0.01, -1.5);
    else if (f.move === "sinker") f.fsa = Math.min(f.fsa + 0.01, 1.5);
    if (Math.abs(f.pos - f.target) > 3 && f.target !== -1) {
      const accel = (f.target - f.pos) / (ri(10, 30) + (100 - Math.min(100, d)));
      f.speed += (accel - f.speed) / 5;
    } else if (f.move !== "smooth" && rnd() < d / 2000) f.target = f.pos + (rnd() < 0.5 ? ri(-100, -50) : ri(50, 101));
    else f.target = -1;
    if (f.move === "dart" && rnd() < d / 1000) f.target = f.pos + (rnd() < 0.5 ? ri(-100 - d * 2, -50) : ri(50, 101 + d * 2));
    f.target = Math.max(-1, Math.min(f.target, 548));
    f.pos = Math.max(0, Math.min(f.pos + f.speed + f.fsa, F.FISH_MAX));
    let inBar = f.pos + 12 <= f.barPos - 32 + barH && f.pos - 16 >= f.barPos - 32;
    if (f.pos >= 548 - barH && f.barPos >= F.TRACK - barH - 4) inBar = true;
    let g = held ? -F.GRAVITY : F.GRAVITY;
    if (held && (f.barPos === 0 || f.barPos === F.TRACK - barH)) f.barSpeed = 0;
    if (inBar) g *= F.IN_BAR_GRAVITY;
    f.barSpeed += g; f.barPos += f.barSpeed;
    if (f.barPos + barH > F.TRACK) { f.barPos = F.TRACK - barH; f.barSpeed = -f.barSpeed * F.BOUNCE; }
    else if (f.barPos < 0) { f.barPos = 0; f.barSpeed = -f.barSpeed * F.BOUNCE; }
    f.prog = Math.max(0, Math.min(1, f.prog + (inBar ? F.FILL : -F.DRAIN)));
  }
  return f.prog >= 1;
}
const SKILLS = { novato: { react: 24, lead: 5, noise: 140, tap: 10 }, casual: { react: 18, lead: 10, noise: 60, tap: 6 }, bom: { react: 12, lead: 12, noise: 30, tap: 4 } };
export function table(F, label) {
  const ids = Object.keys(F.FISH);
  console.log(`\n${label}`);
  for (const [sk, skill] of Object.entries(SKILLS).filter(([k]) => (process.env.SK ?? "novato,casual").split(",").includes(k))) {
    for (let lv = 1; lv <= 3; lv++) {
      const zone = F.LEVELS[lv].zone;
      const row = ids.map((id) => { let ok = 0; for (let i = 0; i < N; i++) ok += run(F, F.FISH[id], zone, skill); return `${id.slice(0, 7)} ${String(Math.round((ok / N) * 100)).padStart(3)}%`; });
      console.log(`${sk.padEnd(6)} lago ${lv}: ${row.join(" · ")}`);
    }
  }
}
if (!process.env.SO_NOVO) table(FISHING, "ATUAL");
const NOVO = JSON.parse(process.env.NOVO ?? "null");
if (NOVO) table({ ...FISHING, ...NOVO, FISH: FISHING.FISH }, "PROPOSTA " + JSON.stringify(NOVO));
