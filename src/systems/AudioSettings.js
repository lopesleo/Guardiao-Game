// Volume mestre persistente (localStorage). Aplica em scene.sound.volume,
// que é o gerenciador de áudio GLOBAL do Phaser — vale pra todas as cenas.
const KEY = 'guardiao_volume_v1';

export function loadVolume() {
  try {
    const v = parseFloat(localStorage.getItem(KEY));
    return isNaN(v) ? 0.7 : Math.max(0, Math.min(1, v));
  } catch {
    return 0.7;
  }
}

export function saveVolume(v) {
  try { localStorage.setItem(KEY, String(v)); } catch {}
}

// Aplica o volume salvo ao gerenciador de áudio da cena (global).
export function applyVolume(scene) {
  scene.sound.volume = loadVolume();
}
