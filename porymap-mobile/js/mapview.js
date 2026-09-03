// Draws the open map: the block layer, the repeating border, and the overlays
// for grid, collision/elevation, events and connections.

import { EVENT_GROUPS } from './mapdoc.js';

const BLOCK_PX = 16;

const COLLISION_FILL = ['rgba(0,0,0,0)', 'rgba(255,56,56,0.42)', 'rgba(255,150,0,0.42)', 'rgba(190,80,255,0.42)'];

export class MapView {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewport = viewport;
    this.doc = null;
    this.layer = document.createElement('canvas');
    this.layerCtx = this.layer.getContext('2d');
    this.borderCanvas = document.createElement('canvas');
    this.borderPattern = null;
    this.options = { grid: false, collision: false, events: true, border: true, connections: true };
    this.cursor = null;          // { x, y, w, h }
    this.selectedEvent = null;   // { key, index }
    this._frame = null;
  }

  get worldWidth() { return this.doc ? this.doc.width * BLOCK_PX : 0; }
  get worldHeight() { return this.doc ? this.doc.height * BLOCK_PX : 0; }

  setDocument(doc) {
    this.doc = doc;
    this.selectedEvent = null;
    this.cursor = null;
    if (!doc) return;
    doc.tilesets.buildAtlas();
    this.layer.width = Math.max(1, doc.width * BLOCK_PX);
    this.layer.height = Math.max(1, doc.height * BLOCK_PX);
    this.layerCtx.imageSmoothingEnabled = false;
    this.renderAllBlocks();
    this.renderBorder();
    this.invalidate();
  }

  renderAllBlocks() {
    const doc = this.doc;
    if (!doc) return;
    this.layerCtx.clearRect(0, 0, this.layer.width, this.layer.height);
    for (let y = 0; y < doc.height; y++) {
      for (let x = 0; x < doc.width; x++) this._paintBlock(x, y);
    }
    doc.changedBlocks.clear();
  }

  _paintBlock(x, y) {
    const doc = this.doc;
    const id = doc.codec.metatile(doc.blocks[y * doc.width + x]);
    const ctx = this.layerCtx;
    const dx = x * BLOCK_PX;
    const dy = y * BLOCK_PX;
    if (!doc.tilesets.isValidMetatile(id)) {
      ctx.fillStyle = '#2a0d14';
      ctx.fillRect(dx, dy, BLOCK_PX, BLOCK_PX);
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(dx + 6, dy + 3, 4, 7);
      ctx.fillRect(dx + 6, dy + 12, 4, 2);
      return;
    }
    const { sx, sy } = doc.tilesets.atlasSlot(id);
    ctx.clearRect(dx, dy, BLOCK_PX, BLOCK_PX);
    ctx.drawImage(doc.tilesets.atlas, sx, sy, BLOCK_PX, BLOCK_PX, dx, dy, BLOCK_PX, BLOCK_PX);
  }

  renderBorder() {
    const doc = this.doc;
    if (!doc) return;
    const w = Math.max(1, doc.borderWidth) * BLOCK_PX;
    const h = Math.max(1, doc.borderHeight) * BLOCK_PX;
    this.borderCanvas.width = w;
    this.borderCanvas.height = h;
    const ctx = this.borderCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < doc.borderHeight; y++) {
      for (let x = 0; x < doc.borderWidth; x++) {
        const id = doc.codec.metatile(doc.border[y * doc.borderWidth + x] || 0);
        if (!doc.tilesets.isValidMetatile(id)) continue;
        const { sx, sy } = doc.tilesets.atlasSlot(id);
        ctx.drawImage(doc.tilesets.atlas, sx, sy, BLOCK_PX, BLOCK_PX, x * BLOCK_PX, y * BLOCK_PX, BLOCK_PX, BLOCK_PX);
      }
    }
    this.borderPattern = this.ctx.createPattern(this.borderCanvas, 'repeat');
  }

  /** Repaints only the blocks the document flagged as changed. */
  flushChangedBlocks() {
    const doc = this.doc;
    if (!doc || doc.changedBlocks.size === 0) return;
    for (const i of doc.changedBlocks) {
      this._paintBlock(i % doc.width, Math.floor(i / doc.width));
    }
    doc.changedBlocks.clear();
  }

  invalidate() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this.render();
    });
  }

  render() {
    const ctx = this.ctx;
    const vp = this.viewport;
    const dpr = vp.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, vp.cssWidth, vp.cssHeight);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, vp.cssWidth, vp.cssHeight);
    if (!this.doc) return;

    this.flushChangedBlocks();

    ctx.save();
    ctx.translate(vp.ox, vp.oy);
    ctx.scale(vp.scale, vp.scale);

    const view = {
      x0: -vp.ox / vp.scale,
      y0: -vp.oy / vp.scale,
      x1: (vp.cssWidth - vp.ox) / vp.scale,
      y1: (vp.cssHeight - vp.oy) / vp.scale,
    };

    if (this.options.border && this.borderPattern) {
      ctx.fillStyle = this.borderPattern;
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      ctx.fillStyle = 'rgba(6,10,16,0.45)';
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    }

    ctx.drawImage(this.layer, 0, 0);

    if (this.options.grid) this._drawGrid(ctx, view);
    if (this.options.collision) this._drawCollision(ctx, view);
    if (this.options.connections) this._drawConnections(ctx);
    if (this.options.events) this._drawEvents(ctx, view);
    this._drawMapOutline(ctx);
    this._drawCursor(ctx);

    ctx.restore();
  }

  _visibleBlockRange(view) {
    const doc = this.doc;
    return {
      x0: Math.max(0, Math.floor(view.x0 / BLOCK_PX)),
      y0: Math.max(0, Math.floor(view.y0 / BLOCK_PX)),
      x1: Math.min(doc.width - 1, Math.ceil(view.x1 / BLOCK_PX)),
      y1: Math.min(doc.height - 1, Math.ceil(view.y1 / BLOCK_PX)),
    };
  }

  _drawGrid(ctx, view) {
    if (this.viewport.scale * BLOCK_PX < 10) return;
    const doc = this.doc;
    ctx.save();
    ctx.lineWidth = 1 / this.viewport.scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    const r = this._visibleBlockRange(view);
    for (let x = r.x0; x <= r.x1 + 1; x++) {
      ctx.moveTo(x * BLOCK_PX, r.y0 * BLOCK_PX);
      ctx.lineTo(x * BLOCK_PX, (r.y1 + 1) * BLOCK_PX);
    }
    for (let y = r.y0; y <= r.y1 + 1; y++) {
      ctx.moveTo(r.x0 * BLOCK_PX, y * BLOCK_PX);
      ctx.lineTo((r.x1 + 1) * BLOCK_PX, y * BLOCK_PX);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawCollision(ctx, view) {
    const doc = this.doc;
    const r = this._visibleBlockRange(view);
    const showText = this.viewport.scale >= 1.1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(r.x0 * BLOCK_PX, r.y0 * BLOCK_PX,
      (r.x1 - r.x0 + 1) * BLOCK_PX, (r.y1 - r.y0 + 1) * BLOCK_PX);
    if (showText) {
      ctx.font = `bold ${9}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const block = doc.blocks[y * doc.width + x];
        const collision = doc.codec.collision(block);
        const elevation = doc.codec.elevation(block);
        const px = x * BLOCK_PX;
        const py = y * BLOCK_PX;
        if (collision) {
          ctx.fillStyle = COLLISION_FILL[Math.min(collision, COLLISION_FILL.length - 1)];
          ctx.fillRect(px, py, BLOCK_PX, BLOCK_PX);
        }
        if (showText) {
          ctx.fillStyle = elevation === 0 ? '#7fd1ff' : '#ffffff';
          ctx.fillText(elevation === 0 ? '·' : String(elevation), px + BLOCK_PX / 2, py + BLOCK_PX / 2 + 0.5);
        }
      }
    }
    ctx.restore();
  }

  _drawEvents(ctx, view) {
    const doc = this.doc;
    ctx.save();
    ctx.lineWidth = Math.max(0.6, 1.4 / this.viewport.scale);
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const group of EVENT_GROUPS) {
      const list = doc.events(group.key);
      for (let i = 0; i < list.length; i++) {
        const event = list[i];
        const x = Number(event.x) * BLOCK_PX;
        const y = Number(event.y) * BLOCK_PX;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x + BLOCK_PX < view.x0 || y + BLOCK_PX < view.y0 || x > view.x1 || y > view.y1) continue;
        const selected = this.selectedEvent && this.selectedEvent.key === group.key && this.selectedEvent.index === i;
        ctx.fillStyle = group.color + (selected ? 'ee' : '99');
        ctx.fillRect(x, y, BLOCK_PX, BLOCK_PX);
        ctx.strokeStyle = selected ? '#ffffff' : 'rgba(0,0,0,0.65)';
        ctx.strokeRect(x + 0.5, y + 0.5, BLOCK_PX - 1, BLOCK_PX - 1);
        if (this.viewport.scale >= 0.9) {
          ctx.fillStyle = '#08111c';
          ctx.fillText(group.short, x + BLOCK_PX / 2, y + BLOCK_PX / 2 + 0.5);
        }
      }
    }
    ctx.restore();
  }

  _drawConnections(ctx) {
    const doc = this.doc;
    const connections = Array.isArray(doc.header.connections) ? doc.header.connections : [];
    if (!connections.length) return;
    ctx.save();
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const c of connections) {
      const label = String(c.map || '').replace(/^MAP_/, '');
      const offset = Number(c.offset) || 0;
      const pad = 4;
      let x = 0, y = 0, align = 'left';
      if (c.direction === 'up') { x = offset * BLOCK_PX + pad; y = -10; }
      else if (c.direction === 'down') { x = offset * BLOCK_PX + pad; y = doc.height * BLOCK_PX + 10; }
      else if (c.direction === 'left') { x = -pad; y = offset * BLOCK_PX + 10; align = 'right'; }
      else if (c.direction === 'right') { x = doc.width * BLOCK_PX + pad; y = offset * BLOCK_PX + 10; }
      else continue;
      ctx.textAlign = align;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(label).width + 8;
      ctx.fillRect(align === 'right' ? x - w : x - 4, y - 8, w, 16);
      ctx.fillStyle = '#9fd0ff';
      ctx.fillText(label, x, y);
    }
    ctx.restore();
  }

  _drawMapOutline(ctx) {
    ctx.save();
    ctx.lineWidth = Math.max(1, 2 / this.viewport.scale);
    ctx.strokeStyle = 'rgba(126,180,255,0.85)';
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
    ctx.restore();
  }

  _drawCursor(ctx) {
    if (!this.cursor) return;
    const { x, y, w, h } = this.cursor;
    ctx.save();
    ctx.lineWidth = Math.max(1, 2 / this.viewport.scale);
    ctx.strokeStyle = '#ffe14d';
    ctx.strokeRect(x * BLOCK_PX + 0.5, y * BLOCK_PX + 0.5, w * BLOCK_PX - 1, h * BLOCK_PX - 1);
    ctx.restore();
  }

  worldToBlock(world) {
    return { x: Math.floor(world.x / BLOCK_PX), y: Math.floor(world.y / BLOCK_PX) };
  }
}

export { BLOCK_PX };
