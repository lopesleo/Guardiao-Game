// Ordem de descobertas da Clareira — por PROGRESSO do jogador, nunca por dia
// (ver docs/RITMO_E_APRESENTACAO.md). A Clareira começa em ruínas; cada
// construção aparece quando passa a ser útil, com uma fala curta da Anciã.
// Quem já tem progresso vê tudo revelado (ninguém regride).
import { META } from "../config.js";

const lvl = (d, id) => d.builds?.[id]?.level ?? 1;

export const REVEALS = [
  {
    id: "shrine",
    when: (d) => (d.runsPlayed || 0) >= 2 || Object.values(d.blessingRanks || {}).some((r) => r > 0) || (d.unlockedAbilities || []).length > 0 || lvl(d, "shrine") > 1,
    line: "O Santuário despertou! Aqui as moedas viram bênçãos que ficam para sempre.",
  },
  {
    id: "forge",
    when: (d) => (d.runsPlayed || 0) >= 3 || (d.unlockedWeapons || []).some((k) => META.WEAPON_UNLOCK_ORDER.includes(k)) || lvl(d, "forge") > 1,
    line: "A Forja voltou a arder. Junte moedas e forje armas novas.",
  },
  {
    id: "nest",
    when: (d) => (d.wood || 0) > 0 || ["fire", "shrine", "forge"].some((id) => lvl(d, id) > 1),
    line: "Um João-de-barro! Com Madeira Ancestral, ele reconstrói a Clareira.",
  },
  {
    id: "garden",
    when: (d) => (d.runsPlayed || 0) >= 3 || !!d.garden?.tutorialDone || lvl(d, "garden") > 1,
    line: "A horta voltou a brotar! Plante uma cenoura e veja crescer.",
  },
  {
    id: "kitchen",
    when: (d) => (d.stats?.harvests || 0) >= 1 || (d.cooked || []).length > 0,
    line: "A cozinha acendeu! Transforme a colheita num prato e coma antes da próxima partida.",
  },
  {
    id: "pond",
    when: (d) => (d.stats?.mealsEaten || 0) >= 1 || (d.stats?.fishCaught || 0) > 0,
    line: "O lago voltou a ter vida! Vá até o trapiche e jogue a linha.",
  },
  {
    id: "board",
    when: (d) => (d.runsPlayed || 0) >= 4 || (d.achievements || []).length > 0,
    line: "O Mural guarda cada feito seu na floresta.",
  },
  {
    id: "chest",
    when: (d) => (d.revealed || []).includes("board") && (d.runsPlayed || 0) >= 5,
    line: "Todo dia a floresta deixa um presente aqui, junto ao fogo. Abra o baú!",
  },
  {
    id: "tree",
    when: (d) => (d.revealed || []).includes("chest") && (d.runsPlayed || 0) >= 6,
    line: "A Samaúma acordou! De hora em hora ela pode abençoar a sua próxima partida.",
  },
];

export function isRevealed(id, data) {
  const r = REVEALS.find((r) => r.id === id);
  return !r || r.when(data);
}

// Revelações ainda não apresentadas (na ordem).
// 1ª visita à Clareira: jogador NOVO chega depois de jogar (runsPlayed ≥ 1) e
// vê cada revelação como cena; save ANTIGO visita antes de qualquer partida
// nesta versão (runsPlayed 0) e recebe as atuais em silêncio (sem 4 cenas).
export function pendingReveals(data) {
  if (!Array.isArray(data.revealed))
    data.revealed = (data.runsPlayed || 0) >= 1 ? [] : REVEALS.filter((r) => r.when(data)).map((r) => r.id);
  return REVEALS.filter((r) => r.when(data) && !data.revealed.includes(r.id));
}
