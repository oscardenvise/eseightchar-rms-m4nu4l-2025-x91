// A single open map: its block data, border, events and edit history.

import { TilesetPair } from './tileset.js';

function bytesToU16(bytes) {
  const count = Math.floor(bytes.length / 2);
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) out[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
  return out;
}

function u16ToBytes(words) {
  const out = new Uint8Array(words.length * 2);
  for (let i = 0; i < words.length; i++) {
    out[i * 2] = words[i] & 0xff;
    out[i * 2 + 1] = (words[i] >> 8) & 0xff;
  }
  return out;
}

export const EVENT_GROUPS = [
  { key: 'object_events', label: 'Objekt', short: 'O', color: '#4ea1ff' },
  { key: 'warp_events', label: 'Varp', short: 'V', color: '#ffb340' },
  { key: 'coord_events', label: 'Utlösare', short: 'U', color: '#c06cff' },
  { key: 'bg_events', label: 'Skyltar', short: 'S', color: '#3ecf8e' },
];

export class MapDocument {
  constructor({ project, name, header, layout, tilesets, blocks, border }) {
    this.project = project;
    this.name = name;
    this.header = header;
    this.layout = layout;
    this.tilesets = tilesets;
    this.codec = project.blocks;
    this.width = layout.width;
    this.height = layout.height;
    this.blocks = blocks;
    this.borderWidth = layout.border_width || 2;
    this.borderHeight = layout.border_height || 2;
    this.border = border;

    this.history = [];
    this.future = [];
    this._stroke = null;
    this.changedBlocks = new Set();
    this.blocksModified = false;
    this.borderModified = false;
    this.eventsModified = false;
    this.listeners = new Set();
  }

  static async open(project, mapName, onProgress = () => {}) {
    onProgress('Läser kartdata…');
    const header = await project.loadMapHeader(mapName);
    const layout = project.layoutForMap(header);

    const blockBytes = await project.readBytes(layout.blockdata_filepath);
    const blocks = bytesToU16(blockBytes);
    const expected = layout.width * layout.height;
    if (blocks.length < expected) {
      const padded = new Uint16Array(expected);
      padded.set(blocks.subarray(0, Math.min(blocks.length, expected)));
      onProgress('Varning: map.bin är kortare än layoutens storlek');
      return MapDocument._finish(project, mapName, header, layout, padded, onProgress);
    }
    return MapDocument._finish(project, mapName, header, layout, blocks.subarray(0, expected), onProgress);
  }

  static async _finish(project, mapName, header, layout, blocks, onProgress) {
    const bw = layout.border_width || 2;
    const bh = layout.border_height || 2;
    let border = new Uint16Array(bw * bh);
    if (layout.border_filepath && project.has(layout.border_filepath)) {
      const raw = bytesToU16(await project.readBytes(layout.border_filepath));
      border.set(raw.subarray(0, Math.min(raw.length, border.length)));
    }

    onProgress('Läser tilesets…');
    const tilesets = await TilesetPair.loadForLayout(project, layout);

    return new MapDocument({
      project, name: mapName, header, layout,
      tilesets, blocks: new Uint16Array(blocks), border,
    });
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(detail) { for (const fn of this.listeners) fn(detail); }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  index(x, y) { return y * this.width + x; }
  blockAt(x, y) { return this.inBounds(x, y) ? this.blocks[this.index(x, y)] : 0; }
  metatileAt(x, y) { return this.codec.metatile(this.blockAt(x, y)); }
  collisionAt(x, y) { return this.codec.collision(this.blockAt(x, y)); }
  elevationAt(x, y) { return this.codec.elevation(this.blockAt(x, y)); }

  borderBlockAt(x, y) {
    const bx = ((x % this.borderWidth) + this.borderWidth) % this.borderWidth;
    const by = ((y % this.borderHeight) + this.borderHeight) % this.borderHeight;
    return this.border[by * this.borderWidth + bx] || 0;
  }

  // --- editing -------------------------------------------------------------

  beginStroke(label = 'Redigering') {
    if (this._stroke) this.endStroke();
    this._stroke = { label, changes: new Map(), border: new Map() };
  }

  setBlock(x, y, value) {
    if (!this.inBounds(x, y)) return false;
    const i = this.index(x, y);
    const before = this.blocks[i];
    if (before === value) return false;
    if (this._stroke && !this._stroke.changes.has(i)) this._stroke.changes.set(i, before);
    this.blocks[i] = value;
    this.changedBlocks.add(i);
    this.blocksModified = true;
    return true;
  }

  setBorderBlock(x, y, value) {
    if (x < 0 || y < 0 || x >= this.borderWidth || y >= this.borderHeight) return false;
    const i = y * this.borderWidth + x;
    const before = this.border[i];
    if (before === value) return false;
    if (this._stroke && !this._stroke.border.has(i)) this._stroke.border.set(i, before);
    this.border[i] = value;
    this.borderModified = true;
    return true;
  }

  endStroke() {
    const stroke = this._stroke;
    this._stroke = null;
    if (!stroke || (stroke.changes.size === 0 && stroke.border.size === 0)) return false;

    const after = new Map();
    for (const i of stroke.changes.keys()) after.set(i, this.blocks[i]);
    const borderAfter = new Map();
    for (const i of stroke.border.keys()) borderAfter.set(i, this.border[i]);

    this._push({
      label: stroke.label,
      undo: () => this._applyBlockMap(stroke.changes, stroke.border),
      redo: () => this._applyBlockMap(after, borderAfter),
    });
    return true;
  }

  _applyBlockMap(blockMap, borderMap) {
    for (const [i, value] of blockMap) {
      this.blocks[i] = value;
      this.changedBlocks.add(i);
    }
    if (blockMap.size) this.blocksModified = true;
    for (const [i, value] of borderMap) this.border[i] = value;
    if (borderMap.size) this.borderModified = true;
    this._emit({ type: 'blocks' });
  }

  /** Records an arbitrary change (used for event edits) on the same undo stack. */
  recordEventChange(label, before, after) {
    const restore = (snapshot) => {
      for (const group of EVENT_GROUPS) {
        if (snapshot[group.key] === undefined) delete this.header[group.key];
        else this.header[group.key] = JSON.parse(JSON.stringify(snapshot[group.key]));
      }
      this.eventsModified = true;
      this._emit({ type: 'events' });
    };
    this._push({ label, undo: () => restore(before), redo: () => restore(after) });
    this.eventsModified = true;
  }

  snapshotEvents() {
    const snap = {};
    for (const group of EVENT_GROUPS) {
      if (this.header[group.key] !== undefined) snap[group.key] = JSON.parse(JSON.stringify(this.header[group.key]));
    }
    return snap;
  }

  _push(entry) {
    this.history.push(entry);
    if (this.history.length > 200) this.history.shift();
    this.future.length = 0;
    this._emit({ type: 'history' });
  }

  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.future.length > 0; }

  undo() {
    const entry = this.history.pop();
    if (!entry) return false;
    entry.undo();
    this.future.push(entry);
    this._emit({ type: 'history' });
    return true;
  }

  redo() {
    const entry = this.future.pop();
    if (!entry) return false;
    entry.redo();
    this.history.push(entry);
    this._emit({ type: 'history' });
    return true;
  }

  // --- saving --------------------------------------------------------------

  get isModified() { return this.blocksModified || this.borderModified || this.eventsModified; }

  /** Writes pending changes into the project's dirty-file map. */
  save() {
    const written = [];
    if (this.blocksModified) {
      this.project.write(this.layout.blockdata_filepath, u16ToBytes(this.blocks));
      written.push(this.layout.blockdata_filepath);
      this.blocksModified = false;
    }
    if (this.borderModified && this.layout.border_filepath) {
      this.project.write(this.layout.border_filepath, u16ToBytes(this.border));
      written.push(this.layout.border_filepath);
      this.borderModified = false;
    }
    if (this.eventsModified) {
      const path = this.project.maps.get(this.name).jsonPath;
      this.project.writeText(path, JSON.stringify(this.header, null, 2) + '\n');
      written.push(path);
      this.eventsModified = false;
    }
    return written;
  }

  events(groupKey) {
    const list = this.header[groupKey];
    return Array.isArray(list) ? list : [];
  }

  allEvents() {
    const out = [];
    for (const group of EVENT_GROUPS) {
      this.events(group.key).forEach((event, index) => out.push({ group, index, event }));
    }
    return out;
  }
}
