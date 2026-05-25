// Joystick virtual via nipplejs (carregado globalmente em index.html).
// Só ativa em devices touch. Atualiza inputManager.joystickVec.
export class VirtualJoystick {
  constructor(inputManager) {
    this.input = inputManager;
    this.manager = null;
    this.zone = null;
    this._onFsChange = null;

    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    if (typeof nipplejs === 'undefined') return;

    const zone = document.createElement('div');
    zone.style.cssText = 'position:fixed;left:0;bottom:0;width:50%;height:50%;z-index:10;pointer-events:auto;';
    this.zone = zone;
    this._mount(); // anexa no elemento certo (fullscreen ativo OU body)

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

    // Ao entrar/sair de fullscreen, o joystick precisa estar DENTRO do elemento
    // em fullscreen, senão some e não recebe toque (não dá pra andar no mobile).
    this._onFsChange = () => this._mount();
    document.addEventListener('fullscreenchange', this._onFsChange);
    document.addEventListener('webkitfullscreenchange', this._onFsChange);
  }

  // Anexa a zona do joystick ao elemento em fullscreen (se houver) ou ao body.
  _mount() {
    if (!this.zone) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    const parent = fsEl && fsEl !== document.body ? fsEl : document.body;
    if (this.zone.parentNode !== parent) parent.appendChild(this.zone);
  }

  destroy() {
    if (this._onFsChange) {
      document.removeEventListener('fullscreenchange', this._onFsChange);
      document.removeEventListener('webkitfullscreenchange', this._onFsChange);
      this._onFsChange = null;
    }
    try { this.manager?.destroy(); } catch {}
    this.manager = null;
    this.zone?.remove();
    this.zone = null;
  }
}
