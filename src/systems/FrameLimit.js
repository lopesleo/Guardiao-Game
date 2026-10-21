// Teto de quadros por segundo (GAME.FPS_LIMIT) sem mexer no tempo de jogo.
//
// O Phaser 4.2.1 já tem o teto (config `fps: { limit }` → TimeStep.stepLimitFPS), mas entrega à cena
// o delta ACUMULADO e guarda o resto (`delta %= limite`): esse resto entra de novo no quadro seguinte.
// Simulando o código do vendor, o relógio, os tweens e a física correm 1,2× (tela de 144 Hz) a 1,6×
// (60 Hz) mais rápido que o tempo real — e 1,4× num aparelho que só faz 30 quadros. Aqui o "quando
// entregar um quadro" sai de uma fase acumulada (mesma cadência média do teto) e o delta entregue é o
// tempo que de fato passou desde o quadro anterior: a soma dos deltas = o tempo real, com ou sem teto.
export function installFrameLimitFix() {
  const TS = Phaser.Core?.TimeStep?.prototype;
  if (!TS || TS._phaserStepLimitFPS) return;
  TS._phaserStepLimitFPS = TS.stepLimitFPS; // o original, para o teste comparar
  TS.stepLimitFPS = function (time) {
    this.now = time;
    let d = Math.max(0, time - this.lastTime);
    this.rawDelta = d;
    this.time += d;
    if (this.smoothStep) d = this.smoothDelta(d);
    this._limPhase = (this._limPhase || 0) + d;
    this._limSince = (this._limSince || 0) + d;
    if (time >= this.nextFpsUpdate) this.updateFPS(time);
    // 10% de folga: o tique da tela oscila (16,4–16,9 ms a 60 Hz) e 2 × 8,333 fica a um fio de 16,667.
    // A fase pode ficar um pouco negativa (a folga usada volta no quadro seguinte): a média fica no teto.
    const rate = this._limitRate;
    if (this._limPhase >= rate * 0.9) {
      this._limPhase = Math.min(rate, Math.max(-0.1 * rate, this._limPhase - rate));
      this.delta = this._limSince;
      this._limSince = 0;
      this.framesThisSecond++; // actualFps = quadros entregues de verdade
      this.callback(time, this.delta);
    }
    this.lastTime = time;
    this.frame++;
  };
  const reset = TS.resetDelta;
  TS.resetDelta = function () {
    reset.call(this);
    this._limPhase = this._limSince = 0;
  };
}
