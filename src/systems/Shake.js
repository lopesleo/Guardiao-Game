// Tremor de câmera por CAMADAS (modelo de "trauma"), no lugar do tremor do Phaser, que:
//   · sorteava um deslocamento novo a cada quadro, com a mesma força do começo ao fim, e parava seco
//     (chiado em vez de pancada);
//   · ignorava um tremor novo enquanto outro rodava — numa horda, o tremorzinho de um abate ou de um
//     crítico engolia o golpe que o herói levava ou a pancada do chefe (medido: 17 em 40 s de fim de partida).
// Agora cada pedido vira uma camada com o próprio envelope: sustenta e, nos últimos DECAY_MS, decai como
// (1 − p)^POW (curto = só decai: pancada; longo = ronco que continua ronco). Vale a MAIOR camada viva
// (nada engole nada) e o deslocamento segue duas senoides de frequências diferentes, com fase sorteada
// por tremor: liso, sem chiado. Os ~35 pontos do jogo que chamam cameras.main.shake(duração, força)
// continuam iguais. A opção "Tremor de tela" segue no gancho de Settings.js (desligada = nenhum tremor).
import { FEEL } from "../config.js";

const TAU = Math.PI * 2;

// Envelope de uma camada: sustenta até os últimos DECAY_MS e então cai como (1 − p)^POW
function layerEnv(l) {
  const S = FEEL.SHAKE;
  const dec = Math.min(l.d, S.DECAY_MS);
  const left = l.d - l.t;
  if (left >= dec) return 1;
  return Math.pow(Math.max(0, left / dec), S.POW);
}
const layerAmp = (l) => Math.max(l.ix, l.iy) * layerEnv(l);

export function installShake() {
  const Shake = Phaser.Cameras?.Scene2D?.Effects?.Shake;
  const proto = Shake?.prototype;
  if (!proto || proto.__guardiaoShake) return false;
  proto.__guardiaoShake = true;
  const EV = Phaser.Cameras.Scene2D.Events;

  proto.start = function (duration = 100, intensity = 0.05, force = false, callback = null, context) {
    const ix = typeof intensity === "number" ? intensity : intensity.x;
    const iy = typeof intensity === "number" ? intensity : intensity.y;
    const L = (this._layers ||= []);
    if (!this.isRunning) {
      L.length = 0;
      this._elapsed = 0;
      this.duration = 0;
    }
    // A pancada que passa a mandar começa no PICO, para um lado sorteado (o quadro do golpe é o mais forte);
    // o eixo y entra com fase solta. Uma camada mais fraca só soma ao que já está rodando
    let cur = 0;
    for (const l of L) cur = Math.max(cur, layerAmp(l));
    if (!this.isRunning || Math.max(ix, iy) > cur) {
      const s = Math.random() < 0.5 ? -1 : 1;
      this._t = 0;
      this._ph = [(s * TAU) / 4, (s * TAU) / 4, Math.random() * TAU, Math.random() * TAU];
    }
    // passou do teto de camadas: sai a que tem menos força restante
    if (L.length >= FEEL.SHAKE.LAYERS) {
      let k = 0;
      for (let i = 1; i < L.length; i++) if (layerAmp(L[i]) < layerAmp(L[k])) k = i;
      L.splice(k, 1);
    }
    L.push({ d: Math.max(1, duration), t: 0, ix, iy });
    // o que o resto do Phaser (e quem lê o efeito) espera ver
    this.isRunning = true;
    this.duration = Math.max(this.duration - this._elapsed, duration) + this._elapsed;
    this.intensity.set(ix, iy);
    if (callback) {
      this._onUpdate = callback;
      this._onUpdateScope = context ?? this.camera.scene;
    }
    this.camera.emit(EV.SHAKE_START, this.camera, this, duration, intensity);
    return this.camera;
  };

  proto.update = function (time, delta) {
    if (!this.isRunning) return;
    const L = this._layers;
    let ax = 0,
      ay = 0,
      left = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const l = L[i];
      l.t += delta;
      if (l.t >= l.d) {
        L.splice(i, 1);
        continue;
      }
      const e = layerEnv(l);
      if (l.ix * e > ax) ax = l.ix * e;
      if (l.iy * e > ay) ay = l.iy * e;
      if (l.d - l.t > left) left = l.d - l.t;
    }
    this._elapsed += delta;
    if (!L.length) return this.effectComplete();
    this.duration = this._elapsed + left;
    this.progress = this._elapsed / this.duration;
    this._onUpdate?.call(this._onUpdateScope, this.camera, this.progress);
    const S = FEEL.SHAKE;
    const cam = this.camera;
    const t = this._t; // o 1º quadro de uma pancada cai em t = 0: no pico
    this._t += delta / 1000;
    const ph = this._ph;
    // duas senoides por eixo (0,6 + 0,4): pico ±1, desenho que não se repete
    const nx = 0.6 * Math.sin(TAU * S.HZ[0] * t + ph[0]) + 0.4 * Math.sin(TAU * S.HZ[1] * t + ph[1]);
    const ny = 0.6 * Math.sin(TAU * S.HZ[0] * 1.13 * t + ph[2]) + 0.4 * Math.sin(TAU * S.HZ[1] * 0.91 * t + ph[3]);
    const k = S.PEAK * cam.zoom;
    this._offsetX = nx * ax * cam.width * k;
    this._offsetY = ny * ay * cam.height * k;
    if (cam.roundPixels) {
      this._offsetX = Math.round(this._offsetX);
      this._offsetY = Math.round(this._offsetY);
    }
  };

  const reset = proto.reset;
  proto.reset = function () {
    if (this._layers) this._layers.length = 0;
    return reset.call(this);
  };
  const complete = proto.effectComplete;
  proto.effectComplete = function () {
    if (this._layers) this._layers.length = 0;
    return complete.call(this);
  };
  return true;
}
