// WonderBlocks input: desktop (pointer-lock mouse + keyboard) and touch controls.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.lookDX = 0; this.lookDY = 0;
    this.wheel = 0;
    this.digit = 0;
    this.jumpHeld = false;
    this.breakHeld = false;   // held (mouse or touch button)
    this.breakEdge = false;   // pressed this frame
    this.placeEdge = false;   // pressed this frame
    this.sprintKey = false;
    this.locked = false;
    this.isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
    // touch state (written by UI touch controls)
    this.joy = { x: 0, y: 0, active: false };
    this.tap = null;          // {x,y} css px, tap-to-target
    this.onAction = {};       // {inventory, chat, menu, firstperson, mute} callbacks
    this.enabled = false;     // false while in menus
  }

  attach() {
    const cv = this.canvas;
    window.addEventListener('keydown', e => {
      if (e.repeat) { if (e.code === 'Space') this.jumpHeld = true; return; }
      this.keys[e.code] = true;
      if (e.code === 'Space') { this.jumpHeld = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprintKey = true;
      if (/^Digit[1-9]$/.test(e.code)) this.digit = +e.code.slice(5);
      if (e.code === 'KeyE' && this.onAction.inventory) this.onAction.inventory();
      if (e.code === 'Enter' && this.onAction.chat) this.onAction.chat();
      if (e.code === 'Escape' && this.onAction.menu) this.onAction.menu();
      if (e.code === 'KeyV' && this.onAction.firstperson) this.onAction.firstperson();
      if (e.code === 'KeyC' && this.onAction.crafting) this.onAction.crafting();
      if (e.code === 'KeyM' && this.onAction.mute) this.onAction.mute();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.jumpHeld = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprintKey = false;
    });
    window.addEventListener('blur', () => { this.keys = {}; this.jumpHeld = false; this.breakHeld = false; this.sprintKey = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
    });
    cv.addEventListener('click', () => {
      if (!this.isTouch && this.enabled && !this.locked) {
        cv.requestPointerLock && cv.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', e => {
      if (this.locked && this.enabled) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
    });
    document.addEventListener('mousedown', e => {
      if (!this.enabled || this.isTouch) return;
      if (e.target !== cv) return;
      if (!this.locked) return; // click is for acquiring lock
      if (e.button === 0) { this.breakHeld = true; this.breakEdge = true; }
      if (e.button === 2) { this.placeEdge = true; }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.breakHeld = false;
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('contextmenu', e => { if (e.target === cv) e.preventDefault(); });
    cv.addEventListener('wheel', e => {
      if (this.enabled) this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    // touch camera-drag on canvas (right side / anywhere not on controls)
    let lastT = null;
    cv.addEventListener('touchstart', e => {
      if (!this.enabled) return;
      const t = e.changedTouches[0];
      lastT = { x: t.clientX, y: t.clientY, id: t.identifier, moved: 0 };
    }, { passive: true });
    cv.addEventListener('touchmove', e => {
      if (!lastT) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lastT.id) {
          const dx = t.clientX - lastT.x, dy = t.clientY - lastT.y;
          lastT.moved += Math.abs(dx) + Math.abs(dy);
          this.lookDX += dx * 2.2; this.lookDY += dy * 2.2;
          lastT.x = t.clientX; lastT.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchend', e => {
      if (lastT) {
        for (const t of e.changedTouches) {
          if (t.identifier === lastT.id && lastT.moved < 14) {
            this.tap = { x: t.clientX, y: t.clientY }; // quick tap = target block
          }
        }
        lastT = null;
      }
    });
  }

  // movement vector from keys + joystick: {f, s}
  moveVec() {
    let f = 0, s = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) f += 1;
    if (this.keys.KeyS || this.keys.ArrowDown) f -= 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) s -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) s += 1;
    if (this.joy.active) { f += -this.joy.y; s += this.joy.x; }
    return { f, s };
  }

  consumeLook() {
    const dx = this.lookDX, dy = this.lookDY;
    this.lookDX = 0; this.lookDY = 0;
    return { dx, dy };
  }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  consumeDigit() { const d = this.digit; this.digit = 0; return d; }
  consumeBreakEdge() { const b = this.breakEdge; this.breakEdge = false; return b; }
  consumePlaceEdge() { const b = this.placeEdge; this.placeEdge = false; return b; }
  consumeTap() { const t = this.tap; this.tap = null; return t; }
}
