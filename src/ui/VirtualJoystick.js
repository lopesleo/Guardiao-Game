// Joystick virtual via nipplejs (carregado globalmente em index.html).
// Só ativa em devices touch. Atualiza inputManager.joystickVec.
// Acessibilidade (Opções → Controles): flutuante ou fixo, lado (canhoto) e tamanho.
import { Settings } from "../systems/Settings.js";
import { tr } from "../i18n/i18n.js";

export const JOY_SIZES = [
  { label: tr("Normal"), px: 120 },
  { label: tr("Grande"), px: 150 },
  { label: tr("Muito grande"), px: 180 },
];
export const joyRight = () => Settings.get("joySide") === "right";
// Faixa de cima sem joystick (fração da altura da tela): pausa, cronômetro e o topo da Clareira
export const JOY_TOP = 0.18;

// Joysticks vivos: modo e tamanho mudam na hora pelas Opções (até com a partida pausada)
const live = new Set();
export function refreshJoysticks() {
  for (const j of live) j._build();
}

export class VirtualJoystick {
  constructor(inputManager) {
    this.input = inputManager;
    this.manager = null;
    this.zone = null;
    this._onFsChange = null;

    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    if (typeof nipplejs === 'undefined') return;

    this.zone = document.createElement('div');
    this._mount(); // anexa no elemento certo (fullscreen ativo OU body)
    this._build();
    live.add(this);

    // Ao entrar/sair de fullscreen, o joystick precisa estar DENTRO do elemento
    // em fullscreen, senão some e não recebe toque (não dá pra andar no mobile).
    this._onFsChange = () => this._mount();
    document.addEventListener('fullscreenchange', this._onFsChange);
    document.addEventListener('webkitfullscreenchange', this._onFsChange);
  }

  // (Re)cria o nipplejs com as opções atuais. A metade da tela do lado escolhido, do pé até perto do topo:
  // a zona é uma camada por cima do jogo e bloqueia o toque embaixo dela, então fica livre só a faixa de
  // cima (JOY_TOP), onde estão a pausa e os botões/quadro da Clareira; dash, Despertar e o botão de ação
  // ficam na outra metade. (Antes era só o quarto de baixo: no celular o polegar "não pegava" no meio.)
  // "Fixo" deixa o joystick sempre no canto (quem tem pouca mobilidade não precisa achar onde ele nasce)
  _build() {
    const zone = this.zone;
    if (!zone) return;
    try { this.manager?.destroy(); } catch {}
    this.input.joystickVec.x = 0;
    this.input.joystickVec.y = 0;
    const right = joyRight();
    const size = (JOY_SIZES[Settings.get('joySize')] ?? JOY_SIZES[0]).px;
    const fixed = Settings.get('joyMode') === 'static';
    const enabled = zone.style.pointerEvents !== 'none';
    zone.style.cssText = `position:fixed;${right ? 'right' : 'left'}:0;top:${JOY_TOP * 100}%;bottom:0;width:50%;z-index:10;pointer-events:${enabled ? 'auto' : 'none'};visibility:${enabled ? 'visible' : 'hidden'};`;
    const edge = `${Math.round(size / 2 + 28)}px`;
    this.manager = nipplejs.create({
      zone,
      mode: fixed ? 'static' : 'dynamic',
      color: '#d9b25c',
      size,
      ...(fixed ? { position: { [right ? 'right' : 'left']: edge, bottom: edge } } : {}),
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

  // Liga/desliga o joystick sem destruí-lo. Desligado, a zona dele (canto inferior, FORA do
  // canvas) deixa o toque passar para o jogo — na pesca, o toque vale na tela inteira
  setEnabled(on) {
    this._active = on; // setActive() compara com o estado real, mesmo quando alguém chama este direto
    if (!this.zone) return;
    this.zone.style.pointerEvents = on ? 'auto' : 'none';
    this.zone.style.visibility = on ? 'visible' : 'hidden'; // o fixo some (não cobre a pesca nem menus)
    if (!on) {
      this.input.joystickVec.x = 0;
      this.input.joystickVec.y = 0;
    }
  }

  // Liga/desliga só quando muda (chamado a cada quadro pela cena)
  setActive(on) {
    if (on === this._active) return;
    this._active = on;
    this.setEnabled(on);
  }

  // Anexa a zona do joystick ao elemento em fullscreen (se houver) ou ao body.
  _mount() {
    if (!this.zone) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    const parent = fsEl && fsEl !== document.body ? fsEl : document.body;
    if (this.zone.parentNode !== parent) parent.appendChild(this.zone);
  }

  destroy() {
    live.delete(this);
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
