// Joystick virtual via nipplejs (carregado globalmente em index.html).
// Só ativa em devices touch. Atualiza inputManager.joystickVec.
export class VirtualJoystick {
  constructor(inputManager) {
    this.input = inputManager;
    this.manager = null;

    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    if (typeof nipplejs === 'undefined') return;

    const zone = document.createElement('div');
    zone.style.cssText = 'position:fixed;left:0;bottom:0;width:50%;height:50%;z-index:5;pointer-events:auto;';
    document.body.appendChild(zone);

    this.manager = nipplejs.create({
      zone,
      mode: 'dynamic',
      color: '#d9b25c',
      size: 120,
    });

    this.manager.on('move', (_, data) => {
      const a = data.angle?.radian ?? 0;
      const f = Math.min(1, (data.force ?? 0) / 1);
      this.input.joystickVec.x = Math.cos(a) * f;
      this.input.joystickVec.y = -Math.sin(a) * f; // nipplejs y é invertido vs canvas
    });
    this.manager.on('end', () => {
      this.input.joystickVec.x = 0;
      this.input.joystickVec.y = 0;
    });
  }
}
