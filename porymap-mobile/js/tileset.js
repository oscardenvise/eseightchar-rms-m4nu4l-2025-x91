// Tileset loading and metatile rasterisation.
//
// A map block references a metatile; a metatile stacks 8 (or 12, for triple-layer
// projects) 8x8 tiles, each with its own palette and flip flags. We rasterise
// every metatile once into a single atlas canvas so drawing a map is just a run
// of drawImage calls out of one texture.

import { decodeIndexedPNG } from './png.js';

const TILE = 8;
const METATILE = 16;
export const ATLAS_COLS = 16;

/** Parses a JASC-PAL file (the format the decomp projects store palettes in). */
export function parseJascPalette(text) {
  const lines = text.split(/\r?\n/);
  if (!/^JASC-PAL/.test(lines[0] || '')) throw new Error('Ogiltig .pal-fil (saknar JASC-PAL-huvud)');
  const count = parseInt(lines[2], 10) || 16;
  const colors = [];
  for (let i = 0; i < count; i++) {
    const parts = (lines[3 + i] || '').trim().split(/\s+/);
    colors.push([parseInt(parts[0], 10) | 0, parseInt(parts[1], 10) | 0, parseInt(parts[2], 10) | 0]);
  }
  while (colors.length < 16) colors.push([0, 0, 0]);
  return colors;
}

export class Tileset {
  constructor(fields) {
    Object.assign(this, {
      label: '',
      path: '',
      tiles: null,          // { width, height, indices }
      numTiles: 0,
      palettes: [],         // palettes[i] = 16 x [r,g,b]
      metatiles: new Uint16Array(0),
      attributes: new Uint32Array(0),
      attrSize: 2,
      tilesPerMetatile: 8,
      numMetatiles: 0,
    }, fields);
  }

  static async load(project, label) {
    const path = project.tilesetPath(label);

    const png = await decodeIndexedPNG(await project.readBytes(`${path}/tiles.png`));
    const numTiles = Math.floor(png.width / TILE) * Math.floor(png.height / TILE);

    const palettes = [];
    for (let i = 0; i < 16; i++) {
      const palPath = `${path}/palettes/${String(i).padStart(2, '0')}.pal`;
      if (!project.has(palPath)) { palettes.push(null); continue; }
      try {
        palettes.push(parseJascPalette(await project.readText(palPath)));
      } catch {
        palettes.push(null);
      }
    }

    const metatileBytes = await project.readBytes(`${path}/metatiles.bin`);
    // Dual-layer metatiles are 16 bytes; triple-layer projects use 24. Both sizes
    // divide some file lengths, so the project config wins when it says so.
    const tilesPerMetatile = project.tripleLayerMetatiles ? 12
      : metatileBytes.length % 16 === 0 ? 8
      : metatileBytes.length % 24 === 0 ? 12 : 8;
    const metatiles = new Uint16Array(
      metatileBytes.buffer.slice(metatileBytes.byteOffset, metatileBytes.byteOffset + metatileBytes.length));
    const numMetatiles = Math.floor(metatiles.length / tilesPerMetatile);

    let attributes = new Uint32Array(numMetatiles);
    let attrSize = 2;
    const attrPath = `${path}/metatile_attributes.bin`;
    if (project.has(attrPath)) {
      const raw = await project.readBytes(attrPath);
      attrSize = project.attributeSizeOverride
        ?? (numMetatiles > 0 && Math.round(raw.length / numMetatiles) >= 4 ? 4 : 2);
      const view = new DataView(raw.buffer, raw.byteOffset, raw.length);
      for (let i = 0; i < numMetatiles; i++) {
        const off = i * attrSize;
        if (off + attrSize > raw.length) break;
        attributes[i] = attrSize === 4 ? view.getUint32(off, true)
          : attrSize === 1 ? view.getUint8(off)
          : view.getUint16(off, true);
      }
    }

    return new Tileset({
      label, path, tiles: png, numTiles, palettes,
      metatiles, attributes, attrSize, tilesPerMetatile, numMetatiles,
    });
  }
}

/**
 * A primary + secondary tileset pair, which is what a single map layout uses.
 * Handles the index split between the two and owns the rendered atlas.
 */
export class TilesetPair {
  constructor(primary, secondary, constants) {
    this.primary = primary;
    this.secondary = secondary;
    this.constants = constants;
    this.tilesPerMetatile = Math.max(primary.tilesPerMetatile, secondary.tilesPerMetatile);
    this.numMetatiles = constants.numMetatilesInPrimary + secondary.numMetatiles;
    this.atlas = null;
    this._atlasBuilt = false;
  }

  /** Which tileset owns this metatile id, and the local index within it. */
  _locate(id) {
    const split = this.constants.numMetatilesInPrimary;
    if (id < split) return id < this.primary.numMetatiles ? { ts: this.primary, local: id } : null;
    const local = id - split;
    return local < this.secondary.numMetatiles ? { ts: this.secondary, local } : null;
  }

  isValidMetatile(id) { return this._locate(id) !== null; }

  attribute(id) {
    const at = this._locate(id);
    return at ? at.ts.attributes[at.local] : 0;
  }

  behavior(id) {
    const at = this._locate(id);
    if (!at) return 0;
    const attr = at.ts.attributes[at.local];
    return at.ts.attrSize === 4 ? attr & 0x1ff : attr & 0xff;
  }

  layerType(id) {
    const at = this._locate(id);
    if (!at) return 0;
    const attr = at.ts.attributes[at.local];
    return at.ts.attrSize === 4 ? (attr >>> 29) & 0x3 : (attr >>> 12) & 0xf;
  }

  palette(index) {
    const fromPrimary = index < this.constants.numPalsInPrimary;
    const source = fromPrimary ? this.primary : this.secondary;
    return source.palettes[index] || this.primary.palettes[index] || this.secondary.palettes[index] || null;
  }

  /** Copies one 8x8 tile into an RGBA buffer, honouring flips and transparency. */
  _blitTile(out, outWidth, dx, dy, tileEntry, opaqueZero) {
    const tileId = tileEntry & 0x03ff;
    const xflip = (tileEntry & 0x0400) !== 0;
    const yflip = (tileEntry & 0x0800) !== 0;
    const palIndex = (tileEntry >> 12) & 0x0f;
    const palette = this.palette(palIndex);
    if (!palette) return;

    const split = this.constants.numTilesInPrimary;
    const fromPrimary = tileId < split;
    const ts = fromPrimary ? this.primary : this.secondary;
    const localTile = fromPrimary ? tileId : tileId - split;
    const img = ts.tiles;
    if (!img) return;
    const tilesPerRow = Math.floor(img.width / TILE) || 1;
    if (localTile >= ts.numTiles) return;
    const tx = (localTile % tilesPerRow) * TILE;
    const ty = Math.floor(localTile / tilesPerRow) * TILE;

    for (let y = 0; y < TILE; y++) {
      const sy = ty + (yflip ? TILE - 1 - y : y);
      for (let x = 0; x < TILE; x++) {
        const sx = tx + (xflip ? TILE - 1 - x : x);
        const index = img.indices[sy * img.width + sx];
        if (index === 0 && !opaqueZero) continue;
        const color = palette[index] || palette[0];
        const o = ((dy + y) * outWidth + (dx + x)) * 4;
        out[o] = color[0];
        out[o + 1] = color[1];
        out[o + 2] = color[2];
        out[o + 3] = 255;
      }
    }
  }

  /** Rasterises every metatile into one atlas canvas, ATLAS_COLS metatiles wide. */
  buildAtlas() {
    if (this._atlasBuilt) return this.atlas;
    const rows = Math.ceil(this.numMetatiles / ATLAS_COLS);
    const width = ATLAS_COLS * METATILE;
    const height = Math.max(1, rows * METATILE);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    const image = ctx.createImageData(width, height);
    const data = image.data;

    const layers = this.tilesPerMetatile / 4;
    for (let id = 0; id < this.numMetatiles; id++) {
      const at = this._locate(id);
      if (!at) continue;
      const { ts, local } = at;
      const base = local * ts.tilesPerMetatile;
      const slotX = (id % ATLAS_COLS) * METATILE;
      const slotY = Math.floor(id / ATLAS_COLS) * METATILE;
      const tsLayers = ts.tilesPerMetatile / 4;
      for (let layer = 0; layer < Math.min(layers, tsLayers); layer++) {
        for (let t = 0; t < 4; t++) {
          const entry = ts.metatiles[base + layer * 4 + t];
          if (entry === undefined) continue;
          this._blitTile(
            data, width,
            slotX + (t % 2) * TILE,
            slotY + Math.floor(t / 2) * TILE,
            entry,
            layer === 0);
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    this.atlas = canvas;
    this._atlasBuilt = true;
    return canvas;
  }

  atlasSlot(id) {
    return { sx: (id % ATLAS_COLS) * METATILE, sy: Math.floor(id / ATLAS_COLS) * METATILE };
  }

  static async loadForLayout(project, layout) {
    const [primary, secondary] = await Promise.all([
      Tileset.load(project, layout.primary_tileset || layout.tileset_primary),
      Tileset.load(project, layout.secondary_tileset || layout.tileset_secondary),
    ]);
    return new TilesetPair(primary, secondary, project.constants);
  }
}
