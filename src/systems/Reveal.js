// Ordem de descobertas da Clareira — por PROGRESSO do jogador, nunca por dia
// (ver docs/RITMO_E_APRESENTACAO.md). A Clareira começa em ruínas; cada
// construção aparece quando passa a ser útil, com uma fala curta da Anciã.
// Quem já tem progresso vê tudo revelado (ninguém regride).
import { META } from "../config.js";
import { tr } from "../i18n/i18n.js";

const lvl = (d, id) => d.builds?.[id]?.level ?? 1;

export const REVEALS = [
  {
    id: "shrine",
    when: (d) => (d.runsPlayed || 0) >= 2 || Object.values(d.blessingRanks || {}).some((r) => r > 0) || (d.unlockedAbilities || []).length > 0 || lvl(d, "shrine") > 1,
    line: tr("O Santuário despertou! Aqui as moedas viram bênçãos que ficam para sempre."),
  },
  {
    id: "forge",
    when: (d) => (d.runsPlayed || 0) >= 3 || (d.unlockedWeapons || []).some((k) => META.WEAPON_UNLOCK_ORDER.includes(k)) || lvl(d, "forge") > 1,
    line: tr("A Forja voltou a arder. Junte moedas e forje armas novas."),
  },
  {
    id: "nest",
    when: (d) => (d.wood || 0) > 0 || ["fire", "shrine", "forge"].some((id) => lvl(d, id) > 1),
    line: tr("Um João-de-barro! Com Madeira Ancestral, ele reconstrói a Clareira."),
  },
  {
    id: "garden",
    when: (d) => (d.runsPlayed || 0) >= 3 || !!d.garden?.tutorialDone || lvl(d, "garden") > 1,
    line: tr("A horta voltou a brotar! Plante uma cenoura e veja crescer."),
  },
  {
    id: "kitchen",
    when: (d) => (d.stats?.harvests || 0) >= 1 || (d.cooked || []).length > 0,
    line: tr("A cozinha acendeu! Transforme a colheita num prato e coma antes da próxima partida."),
  },
  {
    id: "pond",
    when: (d) => (d.stats?.mealsEaten || 0) >= 1 || (d.stats?.fishCaught || 0) > 0,
    line: tr("O lago voltou a ter vida! Vá até o trapiche e jogue a linha."),
  },
  {
    id: "board",
    when: (d) => (d.runsPlayed || 0) >= 4 || (d.achievements || []).length > 0,
    line: tr("O Mural guarda cada feito seu na floresta."),
  },
  {
    id: "chest",
    when: (d) => (d.revealed || []).includes("board") && (d.runsPlayed || 0) >= 5,
    line: tr("Todo dia a floresta deixa um presente aqui, junto ao fogo. Abra o baú!"),
  },
  {
    // O Caboclo d'Água libertado manda peixes do São Francisco para o Lago (at: onde a cena acontece)
    id: "riverfish",
    at: "pond",
    when: (d) => (d.revealed || []).includes("pond") && (d.winsByBiome?.caatinga || 0) > 0,
    line: tr("O Caboclo d'Água agradeceu: peixes do São Francisco chegaram ao Lago! Surubim, curimatã, piau…"),
  },
  {
    // Biomas (docs/BIOMAS.md): vencer o Mapinguari mostra o caminho para o sertão
    id: "trail",
    when: (d) => (d.wins || 0) > 0,
    line: tr("O vento trouxe areia do sertão… O João-de-barro pode abrir uma trilha até a Caatinga."),
  },
  {
    // Clareira da Caatinga (docs/COSMETICOS.md): a conquista "Mandacaru em Flor" (Pesadelo na Caatinga) faz o
    // mandacaru da trilha florir e a Anciã aponta o Guarda-roupa (fx: a cena da flor abrindo, no lugar das gotas)
    id: "sertao",
    at: "trail",
    fx: "bloom",
    when: (d) => (d.achievements || []).includes("mandacaru_flor"),
    line: tr("O mandacaru floriu na seca: é sinal de chuva! O sertão também pode morar aqui. Veja no Guarda-roupa."),
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
