// Stato della tastiera e del mouse, letto una volta per frame dalle scene.

const BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;

    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.mouseHeld = false;
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked && e.button === 0) {
        this.pressed.add('Mouse0');
        this.mouseHeld = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseHeld = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  lock() {
    if (!this.locked) this.canvas.requestPointerLock?.()?.catch?.(() => {});
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
