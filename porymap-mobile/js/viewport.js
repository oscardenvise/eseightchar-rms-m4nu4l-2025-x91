// Pointer/gesture handling for the map canvas.
//
// One finger draws (or pans, in pan mode); two fingers always pinch-zoom and pan.
// If a second finger lands while a stroke is in progress the stroke is cancelled,
// so starting a zoom never leaves a stray painted block behind.

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 12;

export class Viewport {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.scale = 2;
    this.ox = 0;
    this.oy = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.pointers = new Map();
    this.mode = null; // 'stroke' | 'pan' | 'pinch'
    this._pinch = null;
    this._bind();
  }

  get cssWidth() { return this.canvas.clientWidth; }
  get cssHeight() { return this.canvas.clientHeight; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    const w = Math.max(1, Math.round(this.cssWidth * dpr));
    const h = Math.max(1, Math.round(this.cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this._changed();
  }

  toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.ox) / this.scale,
      y: (clientY - rect.top - this.oy) / this.scale,
    };
  }

  setScale(scale, anchorX, anchorY) {
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    const rect = this.canvas.getBoundingClientRect();
    const ax = anchorX === undefined ? rect.width / 2 : anchorX - rect.left;
    const ay = anchorY === undefined ? rect.height / 2 : anchorY - rect.top;
    const worldX = (ax - this.ox) / this.scale;
    const worldY = (ay - this.oy) / this.scale;
    this.scale = next;
    this.ox = ax - worldX * next;
    this.oy = ay - worldY * next;
    this._changed();
  }

  zoomBy(factor, anchorX, anchorY) { this.setScale(this.scale * factor, anchorX, anchorY); }

  panBy(dx, dy) {
    this.ox += dx;
    this.oy += dy;
    this._changed();
  }

  centerOn(worldX, worldY) {
    this.ox = this.cssWidth / 2 - worldX * this.scale;
    this.oy = this.cssHeight / 2 - worldY * this.scale;
    this._changed();
  }

  fitTo(worldW, worldH, padding = 24) {
    const sx = (this.cssWidth - padding * 2) / Math.max(1, worldW);
    const sy = (this.cssHeight - padding * 2) / Math.max(1, worldH);
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
    this.centerOn(worldW / 2, worldH / 2);
  }

  _changed() { this.handlers.onChange?.(); }

  _bind() {
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        const drawing = this.handlers.shouldDraw?.() ?? false;
        if (drawing && e.button === 0) {
          this.mode = 'stroke';
          this.handlers.onStrokeStart?.(this.toWorld(e.clientX, e.clientY), e);
        } else {
          this.mode = 'pan';
        }
      } else if (this.pointers.size === 2) {
        if (this.mode === 'stroke') this.handlers.onStrokeCancel?.();
        this.mode = 'pinch';
        this._pinch = this._pinchState();
      }
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        if (this.pointers.size === 0) this.handlers.onHover?.(this.toWorld(e.clientX, e.clientY));
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;

      if (this.mode === 'stroke') {
        this.handlers.onStrokeMove?.(this.toWorld(e.clientX, e.clientY), e);
      } else if (this.mode === 'pan') {
        this.panBy(dx, dy);
      } else if (this.mode === 'pinch' && this.pointers.size >= 2) {
        const next = this._pinchState();
        const prev = this._pinch;
        if (prev && next && prev.dist > 0) {
          this.panBy(next.cx - prev.cx, next.cy - prev.cy);
          this.setScale(this.scale * (next.dist / prev.dist), next.cx, next.cy);
        }
        this._pinch = next;
      }
      e.preventDefault();
    });

    const release = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.mode === 'stroke' && this.pointers.size === 0) this.handlers.onStrokeEnd?.();
      if (this.pointers.size < 2 && this.mode === 'pinch') {
        this.mode = this.pointers.size === 1 ? 'pan' : null;
        this._pinch = null;
      }
      if (this.pointers.size === 0) this.mode = null;
      e.preventDefault();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        this.zoomBy(Math.exp(-e.deltaY / 220), e.clientX, e.clientY);
      } else {
        this.panBy(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });

    // Safari fires gesture events for trackpad pinch on desktop.
    canvas.addEventListener('gesturestart', (e) => e.preventDefault());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pinchState() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return null;
    const rect = this.canvas.getBoundingClientRect();
    const [a, b] = pts;
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      rect,
    };
  }
}
