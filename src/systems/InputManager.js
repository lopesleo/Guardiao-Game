// Input unificado: teclado (D1) + joystick virtual (D2).
// Resto do código só lê .move.x / .move.y (já normalizado em [-1, 1]).

// Teclas de MOVIMENTO lidas na janela (não pelo teclado da cena): o teclado do
// Phaser não vê nada enquanto a cena está pausada (cartas de nível, pausa) — quem
// segurava D, escolhia a carta e voltava ficava PARADO até soltar e apertar de novo.
const held = new Set();
let listening = false;
function listenKeys() {
  if (listening) return;
  listening = true;
  window.addEventListener("keydown", (e) => held.add(e.code));
  window.addEventListener("keyup", (e) => held.delete(e.code));
  // Trocou de janela/aba: o keyup se perde — zera para não andar sozinho
  window.addEventListener("blur", () => held.clear());
  document.addEventListener("visibilitychange", () => document.hidden && held.clear());
}
const isHeld = (...codes) => codes.some((c) => held.has(c));

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.move = { x: 0, y: 0 };
    this.mutePressed = false;

    // Teclado
    listenKeys();
    const kb = scene.input.keyboard;
    this.keys = kb.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      upA: 'UP', downA: 'DOWN', leftA: 'LEFT', rightA: 'RIGHT',
      mute: 'M',
      awaken: 'R',
      dash: 'SHIFT',
      dashAlt: 'SPACE',
      interact: 'E',
    });

    // Edge triggers
    this.awakenPressed = false;
    this.dashPressed = false;
    this.interactPressed = false;
    kb.on('keydown-R', () => { this.awakenPressed = true; });
    kb.on('keydown-SHIFT', () => { this.dashPressed = true; });
    kb.on('keydown-SPACE', () => { this.dashPressed = true; });
    kb.on('keydown-E', () => { this.interactPressed = true; });

    // Joystick virtual (criado externamente em D2; placeholder por ora)
    this.joystickVec = { x: 0, y: 0 };

    kb.on('keydown-M', () => { scene.sound.mute = !scene.sound.mute; });
  }

  update() {
    let x = 0, y = 0;
    if (isHeld("KeyA", "ArrowLeft")) x -= 1;
    if (isHeld("KeyD", "ArrowRight")) x += 1;
    if (isHeld("KeyW", "ArrowUp")) y -= 1;
    if (isHeld("KeyS", "ArrowDown")) y += 1;

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
  consumeAwaken()   { const v = this.awakenPressed;   this.awakenPressed   = false; return v; }
  consumeDash()     { const v = this.dashPressed;     this.dashPressed     = false; return v; }
  consumeInteract() { const v = this.interactPressed; this.interactPressed = false; return v; }
}
