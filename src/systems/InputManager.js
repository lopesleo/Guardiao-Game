// Input unificado: teclado (D1) + joystick virtual (D2).
// Resto do código só lê .move.x / .move.y (já normalizado em [-1, 1]).

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.move = { x: 0, y: 0 };
    this.mutePressed = false;

    // Teclado
    const kb = scene.input.keyboard;
    this.keys = kb.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      upA: 'UP', downA: 'DOWN', leftA: 'LEFT', rightA: 'RIGHT',
      mute: 'M',
      awaken: 'R',
      dash: 'SHIFT',
      dashAlt: 'SPACE',
    });

    // Edge triggers
    this.awakenPressed = false;
    this.dashPressed = false;
    kb.on('keydown-R', () => { this.awakenPressed = true; });
    kb.on('keydown-SHIFT', () => { this.dashPressed = true; });
    kb.on('keydown-SPACE', () => { this.dashPressed = true; });

    // Joystick virtual (criado externamente em D2; placeholder por ora)
    this.joystickVec = { x: 0, y: 0 };

    kb.on('keydown-M', () => { scene.sound.mute = !scene.sound.mute; });
  }

  update() {
    let x = 0, y = 0;
    if (this.keys.left.isDown  || this.keys.leftA.isDown)  x -= 1;
    if (this.keys.right.isDown || this.keys.rightA.isDown) x += 1;
    if (this.keys.up.isDown    || this.keys.upA.isDown)    y -= 1;
    if (this.keys.down.isDown  || this.keys.downA.isDown)  y += 1;

    // joystick sobrepõe se ativo
    if (Math.abs(this.joystickVec.x) + Math.abs(this.joystickVec.y) > 0.05) {
      x = this.joystickVec.x;
      y = this.joystickVec.y;
    }

    // Normaliza (diagonal não fica mais rápida)
    const mag = Math.hypot(x, y);
    if (mag > 0) { x /= mag; y /= mag; }
    this.move.x = x;
    this.move.y = y;
  }

  // Consumir flags de edge (uma chamada zera).
  consumeAwaken() { const v = this.awakenPressed; this.awakenPressed = false; return v; }
  consumeDash()   { const v = this.dashPressed;   this.dashPressed   = false; return v; }
}
