// Pó da morte e faíscas de crítico: imagens reaproveitadas e animadas aqui, sem tween nem
// criar/destruir. Antes cada abate criava 3 imagens + 3 tweens e destruía tudo ~0,3 s depois; tirar
// um objeto da lista de exibição (5 mil na partida) é uma busca linear, e numa matança eram centenas
// por quadro. A curva é a do tween de antes (Cubic.easeOut em x, y, alfa e escala) no mesmo relógio:
// tweens.timeScale (o hit-stop e a câmera lenta da morte seguram o pó junto com o resto).
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

export class Puffs {
  constructor(scene) {
    this.scene = scene;
    this.free = [];
    this.live = [];
    this.count = { poof: 0, spark: 0 }; // vivos por tipo (os tetos ficam com quem chama)
    this._onUpdate = (time, delta) => this.update(delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this._onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this._onUpdate));
  }

  // De (x0, y0, escala s0, alfa a0) até (x1, y1, s1, alfa 0) em ms
  spawn(tag, key, x0, y0, x1, y1, s0, s1, a0, tint, depth, ms) {
    let p = this.free.pop();
    if (!p) p = this.scene.add.image(x0, y0, key);
    else if (p.texture.key !== key) p.setTexture(key);
    p.setPosition(x0, y0).setScale(s0).setAlpha(a0).setTint(tint).setDepth(depth).setVisible(true);
    p._tag = tag;
    p._x0 = x0;
    p._y0 = y0;
    p._dx = x1 - x0;
    p._dy = y1 - y0;
    p._s0 = s0;
    p._ds = s1 - s0;
    p._a0 = a0;
    p._t = 0;
    p._fresh = true; // como o tween: o 1º quadro só põe na tela, a curva anda do 2º em diante
    p._ms = ms;
    this.count[tag]++;
    this.live.push(p);
  }

  update(delta) {
    const live = this.live;
    if (!live.length) return;
    const step = delta * (this.scene.tweens.timeScale ?? 1);
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if (p._fresh) {
        p._fresh = false;
        continue;
      }
      p._t += step;
      const u = p._t >= p._ms ? 1 : p._t / p._ms;
      const e = easeOut(u);
      p.x = p._x0 + p._dx * e;
      p.y = p._y0 + p._dy * e;
      p.setScale(p._s0 + p._ds * e);
      p.alpha = p._a0 * (1 - e);
      if (u >= 1) {
        p.setVisible(false);
        live[i] = live[live.length - 1];
        live.pop();
        this.free.push(p);
        this.count[p._tag]--;
      }
    }
  }
}
