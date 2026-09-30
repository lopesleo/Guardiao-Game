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
    id: "board",
    when: (d) => (d.runsPlayed || 0) >= 4 || (d.achievements || []).length > 0,
    line: "O Mural guarda cada feito seu na floresta.",
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
