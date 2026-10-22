// Limite de vozes por som. A horda caindo de uma vez (Sopro Ancestral: até 80 abates no mesmo quadro;
// estilhaço do Cristal) tocava o MESMO som N vezes no mesmo instante: as ondas iguais somam em fase
// (60 abates = +10,8 dBFS, estouro) e cada voz custa nós de áudio. Aqui: no máximo `max` cópias do som
// começando a cada `ms`; o excesso não cria voz e "engrossa" a última do mesmo quadro
// (volume × √n — n sons sem fase em comum somam assim — com teto).
export class VoiceGate {
  // table: { chave: { max, ms }, DEFAULT: { max, ms } } · mergeMax: teto do engrossar
  constructor(table, mergeMax = 1.6) {
    this.table = table;
    this.mergeMax = mergeMax;
    this.st = new Map();
  }
  _state(key) {
    let s = this.st.get(key);
    if (!s) this.st.set(key, (s = { t0: -Infinity, n: 0, extra: 0, voice: null, vol: 0, frame: -1 }));
    return s;
  }
  // true = pode tocar. false = descartado (veja merge())
  admit(key, now) {
    const lim = this.table[key] ?? this.table.DEFAULT;
    if (!lim) return true;
    const s = this._state(key);
    if (now - s.t0 >= lim.ms) {
      s.t0 = now;
      s.n = 0;
    }
    if (s.n < lim.max) {
      s.n++;
      return true;
    }
    return false;
  }
  // A voz que acabou de começar (para o excesso do mesmo quadro engrossar)
  started(key, voice, vol, frame) {
    const s = this._state(key);
    if (s.frame !== frame) s.extra = 0;
    s.voice = voice;
    s.vol = vol;
    s.frame = frame;
  }
  // Excesso descartado: devolve { voice, gain } se dá para engrossar a última voz (mesmo quadro)
  merge(key, frame) {
    const s = this.st.get(key);
    if (!s?.voice || s.frame !== frame) return null;
    s.extra++;
    return { voice: s.voice, gain: s.vol * Math.min(this.mergeMax, Math.sqrt(1 + s.extra)) };
  }
}
