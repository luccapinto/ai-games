// input.js — teclado, mouse e pointer lock.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.firing = false;
    this.locked = false;
    this.jumpAskedAt = 0;
    this.sensitivity = 0.0022;
    this.onLockChange = null;
    this.onEscape = null;

    this._onKeyDown = (e) => {
      const k = e.code;
      this.keys[k] = true;
      // e.repeat vem true quando o sistema repete a tecla por ela estar
      // pressionada. Sem esse filtro o pulo dispara em rajada.
      if (k === 'Space' && !e.repeat) this.jumpAskedAt = performance.now();
      // evita scroll da pagina com espaco e setas
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };

    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };

    this._onMouseDown = (e) => { if (e.button === 0) this.firing = true; };
    this._onMouseUp = (e) => { if (e.button === 0) this.firing = false; };

    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.firing = false;
      if (this.onLockChange) this.onLockChange(this.locked);
    };

    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.firing = false; });
  }

  requestLock() {
    if (this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }

  releaseLock() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  // Consome o movimento acumulado do mouse no frame.
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  isDown(code) { return !!this.keys[code]; }

  // Eixo de movimento normalizado (-1..1).
  moveAxis() {
    let x = 0, z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    return { x, z };
  }

  isSprinting() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }

  consumeJump() {
    // Janela de 150ms: o pulo pedido um pouco antes de tocar o chao ainda vale,
    // e cada aperto conta uma vez so. Antes a tecla era lida como estado, e o
    // auto-repeat do teclado rearmava ela: segurar espaco dava 6 pulos em 3s.
    if (this.jumpAskedAt && performance.now() - this.jumpAskedAt < 150) {
      this.jumpAskedAt = 0;
      return true;
    }
    return false;
  }
}
