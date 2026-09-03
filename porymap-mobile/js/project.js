// Reads a pokeemerald / pokefirered / pokeruby decompilation project out of a
// ZIP archive. Only the files a map editor needs are ever decompressed.

import { ZipReader } from './zip.js';

export const FALLBACK_CONSTANTS = {
  numTilesInPrimary: 512,
  numMetatilesInPrimary: 512,
  numPalsInPrimary: 6,
};

const DEFAULT_MASKS = { metatile: 0x03ff, collision: 0x0c00, elevation: 0xf000 };

const shiftOf = (mask) => {
  if (!mask) return 0;
  let s = 0;
  while (((mask >> s) & 1) === 0) s++;
  return s;
};

/**
 * Encodes/decodes the 16-bit block words in map.bin. The masks are configurable
 * because ROM hacks routinely widen the metatile id field.
 */
export class BlockCodec {
  constructor(masks = {}) {
    this.masks = { ...DEFAULT_MASKS, ...masks };
    this.shifts = {
      metatile: shiftOf(this.masks.metatile),
      collision: shiftOf(this.masks.collision),
      elevation: shiftOf(this.masks.elevation),
    };
    this.maxCollision = this.masks.collision >> this.shifts.collision;
    this.maxElevation = this.masks.elevation >> this.shifts.elevation;
  }

  metatile(block) { return (block & this.masks.metatile) >> this.shifts.metatile; }
  collision(block) { return (block & this.masks.collision) >> this.shifts.collision; }
  elevation(block) { return (block & this.masks.elevation) >> this.shifts.elevation; }

  pack(metatile, collision, elevation) {
    return (((metatile << this.shifts.metatile) & this.masks.metatile)
      | ((collision << this.shifts.collision) & this.masks.collision)
      | ((elevation << this.shifts.elevation) & this.masks.elevation)) >>> 0;
  }

  withMetatile(block, metatile) { return this.pack(metatile, this.collision(block), this.elevation(block)); }
  withCollision(block, collision) { return this.pack(this.metatile(block), collision, this.elevation(block)); }
  withElevation(block, elevation) { return this.pack(this.metatile(block), this.collision(block), elevation); }
}

export const BLOCK = new BlockCodec();

/** gTileset_BattleFrontierOutsideWest -> battle_frontier_outside_west */
export function tilesetLabelToDirName(label) {
  return label
    .replace(/^gTileset_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export class Project {
  constructor(zip, root) {
    this.zip = zip;
    this.root = root;
    this.constants = { ...FALLBACK_CONSTANTS };
    this.groups = [];
    this.maps = new Map();       // map name -> { name, group, jsonPath }
    this.layouts = new Map();    // layout id -> layout object
    this.tilesetDirs = new Map();// snake_case dir name -> path inside project
    this.dirty = new Map();      // project-relative path -> Uint8Array
    this.baseGame = 'okänt';
    this.config = new Map();     // porymap.project.cfg
    this.blocks = new BlockCodec();
    this.tripleLayerMetatiles = false;
    this.attributeSizeOverride = null;
  }

  static async fromBlob(blob, onProgress = () => {}) {
    onProgress('Läser arkivet…');
    const zip = await ZipReader.fromBlob(blob);
    const marker = 'data/layouts/layouts.json';
    let root = null;
    for (const name of zip.names()) {
      if (name.endsWith(marker)) {
        const candidate = name.slice(0, name.length - marker.length);
        if (root === null || candidate.length < root.length) root = candidate;
      }
    }
    if (root === null) {
      // The user may have zipped the `data` folder's contents directly.
      for (const name of zip.names()) {
        if (name.endsWith('layouts/layouts.json')) {
          root = name.slice(0, name.length - 'layouts/layouts.json'.length);
          break;
        }
      }
      if (root === null) {
        throw new Error(
          'Hittade ingen data/layouts/layouts.json i arkivet. ' +
          'Zippa hela decomp-mappen (eller åtminstone dess data-mapp).');
      }
    }
    const project = new Project(zip, root);
    await project._load(onProgress);
    return project;
  }

  /** Resolves a project-relative path to a path inside the archive. */
  resolve(path) {
    const direct = this.root + path;
    if (this.zip.has(direct)) return direct;
    const stripped = this.root + path.replace(/^data\//, '');
    if (this.zip.has(stripped)) return stripped;
    return direct;
  }

  has(path) { return this.zip.has(this.resolve(path)); }

  async readBytes(path) {
    if (this.dirty.has(path)) return this.dirty.get(path);
    return this.zip.read(this.resolve(path));
  }

  async readText(path) {
    const bytes = await this.readBytes(path);
    return new TextDecoder().decode(bytes);
  }

  async readJSON(path) { return JSON.parse(await this.readText(path)); }

  write(path, bytes) { this.dirty.set(path, bytes); }

  writeText(path, text) { this.dirty.set(path, new TextEncoder().encode(text)); }

  get isDirty() { return this.dirty.size > 0; }

  async _load(onProgress) {
    onProgress('Läser konstanter…');
    await this._loadConstants();
    await this._loadPorymapConfig();

    onProgress('Läser layouter…');
    const layouts = await this.readJSON('data/layouts/layouts.json');
    for (const layout of layouts.layouts || []) {
      if (layout && layout.id) this.layouts.set(layout.id, layout);
    }
    this.layoutsTableLabel = layouts.layouts_table_label;

    onProgress('Läser kartgrupper…');
    const groups = await this.readJSON('data/maps/map_groups.json');
    this.mapGroupsRaw = groups;
    for (const groupName of groups.group_order || []) {
      const mapNames = groups[groupName] || [];
      this.groups.push({ name: groupName, maps: mapNames.slice() });
      for (const mapName of mapNames) {
        this.maps.set(mapName, { name: mapName, group: groupName, jsonPath: `data/maps/${mapName}/map.json` });
      }
    }

    onProgress('Indexerar tilesets…');
    this._indexTilesets();

    if (this.baseGame !== 'okänt') return;
    if (this.maps.has('LittlerootTown')) this.baseGame = 'pokeemerald / pokeruby';
    else if (this.maps.has('PalletTown')) this.baseGame = 'pokefirered';
  }

  async _loadConstants() {
    if (!this.has('include/fieldmap.h')) return;
    try {
      const src = await this.readText('include/fieldmap.h');
      const grab = (name) => {
        const m = src.match(new RegExp(`#define\\s+${name}\\s+\\(?\\s*(0x[0-9a-fA-F]+|\\d+)`));
        return m ? Number(m[1]) : null;
      };
      const tiles = grab('NUM_TILES_IN_PRIMARY');
      const metatiles = grab('NUM_METATILES_IN_PRIMARY');
      const pals = grab('NUM_PALS_IN_PRIMARY');
      if (tiles) this.constants.numTilesInPrimary = tiles;
      if (metatiles) this.constants.numMetatilesInPrimary = metatiles;
      if (pals) this.constants.numPalsInPrimary = pals;
    } catch {
      /* Constants are optional; the defaults match every mainline decomp. */
    }
  }

  async _loadPorymapConfig() {
    if (!this.has('porymap.project.cfg')) return;
    try {
      const text = await this.readText('porymap.project.cfg');
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m) this.config.set(m[1].toLowerCase(), m[2]);
      }
      for (const [key, value] of this.config) {
        if (key.includes('triple_layer')) this.tripleLayerMetatiles = value === '1' || value === 'true';
      }
      const version = this.config.get('base_game_version');
      if (version) this.baseGame = version;

      const attrSize = Number(this.config.get('metatile_attributes_size'));
      if (attrSize === 1 || attrSize === 2 || attrSize === 4) this.attributeSizeOverride = attrSize;

      const num = (key) => {
        const raw = this.config.get(key);
        if (raw === undefined) return undefined;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      };
      const masks = {
        metatile: num('block_metatile_id_mask'),
        collision: num('block_collision_mask'),
        elevation: num('block_elevation_mask'),
      };
      const provided = Object.fromEntries(Object.entries(masks).filter(([, v]) => v !== undefined));
      if (Object.keys(provided).length) this.blocks = new BlockCodec(provided);
    } catch {
      /* An unreadable config never blocks opening the project. */
    }
  }

  _indexTilesets() {
    const re = /(?:^|\/)data\/tilesets\/(primary|secondary)\/([^/]+)\/metatiles\.bin$/;
    for (const name of this.zip.names()) {
      const m = name.match(re);
      if (m) this.tilesetDirs.set(m[2], `data/tilesets/${m[1]}/${m[2]}`);
    }
  }

  tilesetPath(label) {
    const dir = tilesetLabelToDirName(label);
    const path = this.tilesetDirs.get(dir);
    if (!path) throw new Error(`Hittade inget tileset för ${label} (letade efter mappen "${dir}")`);
    return path;
  }

  async loadMapHeader(mapName) {
    const entry = this.maps.get(mapName);
    if (!entry) throw new Error(`Okänd karta: ${mapName}`);
    if (!entry.header) entry.header = await this.readJSON(entry.jsonPath);
    return entry.header;
  }

  layoutForMap(header) {
    const layout = this.layouts.get(header.layout);
    if (!layout) throw new Error(`Kartan refererar till en okänd layout: ${header.layout}`);
    return layout;
  }
}
