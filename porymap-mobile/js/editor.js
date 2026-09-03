// Editing tools operating on the open MapDocument.

import { EVENT_GROUPS } from './mapdoc.js';

export const TOOLS = {
  pencil: { label: 'Pensel', icon: '✏️' },
  fill: { label: 'Fyll', icon: '🪣' },
  replace: { label: 'Ersätt alla', icon: '✨' },
  pick: { label: 'Pipett', icon: '💧' },
  pan: { label: 'Panorera', icon: '✋' },
};

export const MODES = {
  metatiles: 'Metatiles',
  collision: 'Kollision',
  events: 'Events',
};

export class Editor {
  constructor(view) {
    this.view = view;
    this.mode = 'metatiles';
    this.tool = 'pencil';
    this.brush = { w: 1, h: 1, ids: Uint16Array.from([1]) };
    this.collisionBrush = { collision: 0, elevation: 3 };
    this.selectedEvent = null;
    this.onPick = null;        // (metatileId) => void
    this.onSelectEvent = null; // (selection|null) => void
    this.onStatus = null;      // (text) => void
    this._origin = null;
    this._eventDrag = null;
    this._eventSnapshot = null;
  }

  get doc() { return this.view.doc; }

  setBrush(ids, w, h) {
    this.brush = { w, h, ids: Uint16Array.from(ids) };
  }

  shouldDraw() { return this.tool !== 'pan'; }

  // --- stroke lifecycle ----------------------------------------------------

  strokeStart(world) {
    const doc = this.doc;
    if (!doc) return;
    const block = this.view.worldToBlock(world);

    if (this.mode === 'events') return this._eventStrokeStart(block);

    if (this.tool === 'pick') {
      this._pick(block);
      return;
    }

    this._origin = block;
    doc.beginStroke(TOOLS[this.tool].label);

    if (this.tool === 'fill') this._floodFill(block);
    else if (this.tool === 'replace') this._replaceAll(block);
    else this._stamp(block);

    this._updateCursor(block);
    this.view.invalidate();
  }

  strokeMove(world) {
    const doc = this.doc;
    if (!doc) return;
    const block = this.view.worldToBlock(world);
    this._updateCursor(block);

    if (this.mode === 'events') {
      this._eventStrokeMove(block);
      this.view.invalidate();
      return;
    }
    if (this.tool === 'pencil') this._stamp(block);
    this.view.invalidate();
  }

  strokeEnd() {
    const doc = this.doc;
    if (!doc) return;
    if (this.mode === 'events') return this._eventStrokeEnd();
    doc.endStroke();
    this._origin = null;
    this.view.invalidate();
  }

  strokeCancel() {
    const doc = this.doc;
    if (!doc) return;
    if (this.mode === 'events') {
      this._eventDrag = null;
      this._eventSnapshot = null;
      return;
    }
    // Revert the accidental dab that a starting pinch gesture painted.
    if (doc.endStroke()) doc.undo();
    this._origin = null;
    this.view.invalidate();
  }

  hover(world) {
    if (!this.doc) return;
    this._updateCursor(this.view.worldToBlock(world));
    this.view.invalidate();
  }

  _updateCursor(block) {
    const size = this.mode === 'metatiles' && this.tool === 'pencil'
      ? { w: this.brush.w, h: this.brush.h }
      : { w: 1, h: 1 };
    this.view.cursor = { x: block.x, y: block.y, ...size };
  }

  // --- metatile / collision painting ---------------------------------------

  _valueFor(x, y, block) {
    const doc = this.doc;
    if (this.mode === 'collision') {
      return doc.codec.pack(doc.codec.metatile(block), this.collisionBrush.collision, this.collisionBrush.elevation);
    }
    const ox = this._origin ? this._origin.x : x;
    const oy = this._origin ? this._origin.y : y;
    const bx = ((x - ox) % this.brush.w + this.brush.w) % this.brush.w;
    const by = ((y - oy) % this.brush.h + this.brush.h) % this.brush.h;
    const id = this.brush.ids[by * this.brush.w + bx];
    return doc.codec.withMetatile(block, id);
  }

  _stamp(block) {
    const doc = this.doc;
    const w = this.mode === 'metatiles' ? this.brush.w : 1;
    const h = this.mode === 'metatiles' ? this.brush.h : 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const x = block.x + dx;
        const y = block.y + dy;
        if (!doc.inBounds(x, y)) continue;
        doc.setBlock(x, y, this._valueFor(x, y, doc.blockAt(x, y)));
      }
    }
  }

  _matches(block, target) {
    const doc = this.doc;
    return this.mode === 'collision'
      ? doc.codec.collision(block) === doc.codec.collision(target)
        && doc.codec.elevation(block) === doc.codec.elevation(target)
      : doc.codec.metatile(block) === doc.codec.metatile(target);
  }

  _floodFill(start) {
    const doc = this.doc;
    if (!doc.inBounds(start.x, start.y)) return;
    const target = doc.blockAt(start.x, start.y);
    const first = this._valueFor(start.x, start.y, target);
    if (this._matches(target, first) && this.brush.w === 1 && this.brush.h === 1
      && this.mode === 'metatiles' && doc.codec.metatile(target) === doc.codec.metatile(first)) return;

    const seen = new Uint8Array(doc.width * doc.height);
    const stack = [start.x, start.y];
    let painted = 0;
    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      if (!doc.inBounds(x, y)) continue;
      const i = doc.index(x, y);
      if (seen[i]) continue;
      seen[i] = 1;
      if (!this._matches(doc.blocks[i], target)) continue;
      doc.setBlock(x, y, this._valueFor(x, y, doc.blocks[i]));
      painted++;
      if (painted > doc.width * doc.height) break;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    this.onStatus?.(`Fyllde ${painted} rutor`);
  }

  _replaceAll(start) {
    const doc = this.doc;
    if (!doc.inBounds(start.x, start.y)) return;
    const target = doc.blockAt(start.x, start.y);
    let painted = 0;
    for (let y = 0; y < doc.height; y++) {
      for (let x = 0; x < doc.width; x++) {
        const i = doc.index(x, y);
        if (!this._matches(doc.blocks[i], target)) continue;
        if (doc.setBlock(x, y, this._valueFor(x, y, doc.blocks[i]))) painted++;
      }
    }
    this.onStatus?.(`Ersatte ${painted} rutor`);
  }

  _pick(block) {
    const doc = this.doc;
    if (!doc.inBounds(block.x, block.y)) return;
    const value = doc.blockAt(block.x, block.y);
    if (this.mode === 'collision') {
      this.collisionBrush = { collision: doc.codec.collision(value), elevation: doc.codec.elevation(value) };
      this.onStatus?.(`Hämtade kollision ${this.collisionBrush.collision}, höjd ${this.collisionBrush.elevation}`);
    } else {
      const id = doc.codec.metatile(value);
      this.setBrush([id], 1, 1);
      this.onPick?.(id);
      this.onStatus?.(`Hämtade metatile 0x${id.toString(16).toUpperCase().padStart(3, '0')}`);
    }
    this.tool = 'pencil';
  }

  // --- events --------------------------------------------------------------

  eventAt(block) {
    const doc = this.doc;
    for (let g = EVENT_GROUPS.length - 1; g >= 0; g--) {
      const group = EVENT_GROUPS[g];
      const list = doc.events(group.key);
      for (let i = list.length - 1; i >= 0; i--) {
        if (Number(list[i].x) === block.x && Number(list[i].y) === block.y) {
          return { key: group.key, index: i, event: list[i] };
        }
      }
    }
    return null;
  }

  selectEvent(selection) {
    this.selectedEvent = selection;
    this.view.selectedEvent = selection ? { key: selection.key, index: selection.index } : null;
    this.onSelectEvent?.(selection);
    this.view.invalidate();
  }

  _eventStrokeStart(block) {
    const hit = this.eventAt(block);
    if (hit) {
      this.selectEvent(hit);
      this._eventSnapshot = this.doc.snapshotEvents();
      this._eventDrag = { key: hit.key, index: hit.index, moved: false };
    } else {
      this.selectEvent(null);
      this._eventDrag = null;
    }
    this.view.cursor = { x: block.x, y: block.y, w: 1, h: 1 };
    this.view.invalidate();
  }

  _eventStrokeMove(block) {
    const drag = this._eventDrag;
    if (!drag) return;
    const doc = this.doc;
    if (!doc.inBounds(block.x, block.y)) return;
    const event = doc.events(drag.key)[drag.index];
    if (!event) return;
    if (Number(event.x) === block.x && Number(event.y) === block.y) return;
    event.x = block.x;
    event.y = block.y;
    drag.moved = true;
  }

  _eventStrokeEnd() {
    const drag = this._eventDrag;
    this._eventDrag = null;
    if (drag && drag.moved && this._eventSnapshot) {
      this.doc.recordEventChange('Flytta event', this._eventSnapshot, this.doc.snapshotEvents());
      this.onSelectEvent?.(this.selectedEvent);
    }
    this._eventSnapshot = null;
    this.view.invalidate();
  }
}
