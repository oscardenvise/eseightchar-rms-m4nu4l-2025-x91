// Builds a small, self-contained demo project in memory, laid out exactly like a
// decomp checkout. It goes through the same ZIP loader as a real project, so the
// demo doubles as an end-to-end test of the whole import path.

import { ZipWriter, deflateRaw } from './zip.js';

const PALETTE = [
  [0, 0, 0],        // 0 backdrop
  [47, 107, 57],    // 1 grass dark
  [63, 143, 74],    // 2 grass
  [88, 171, 92],    // 3 grass light
  [179, 154, 99],   // 4 path dark
  [216, 192, 140],  // 5 path
  [237, 220, 176],  // 6 path light
  [42, 90, 168],    // 7 water dark
  [61, 127, 208],   // 8 water
  [127, 180, 234],  // 9 water light
  [30, 74, 43],     // 10 tree dark
  [43, 107, 57],    // 11 tree
  [192, 74, 60],    // 12 roof
  [239, 226, 200],  // 13 wall
  [111, 183, 224],  // 14 window
  [16, 24, 32],     // 15 outline
];

const TILES_PER_ROW = 16;
const TILE = 8;

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** Encodes an 8-bit indexed PNG (colour type 3) — the format tiles.png uses. */
async function encodeIndexedPNG(width, height, indices, palette) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    raw.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  const deflated = await deflateRaw(raw);
  const zlib = new Uint8Array(2 + deflated.length + 4);
  zlib[0] = 0x78; zlib[1] = 0x01;
  zlib.set(deflated, 2);
  new DataView(zlib.buffer).setUint32(2 + deflated.length, adler32(raw));

  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, width);
  iv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 3;

  const plte = new Uint8Array(palette.length * 3);
  palette.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('IDAT', zlib),
    chunk('IEND', new Uint8Array(0)),
  ];
  let total = 0;
  for (const p of parts) total += p.length;
  const png = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { png.set(p, o); o += p.length; }
  return png;
}

function jascPalette(colors) {
  const rows = [];
  for (let i = 0; i < 16; i++) {
    const c = colors[i] || [0, 0, 0];
    rows.push(`${c[0]} ${c[1]} ${c[2]}`);
  }
  return `JASC-PAL\r\n0100\r\n16\r\n${rows.join('\r\n')}\r\n`;
}

// A tiny deterministic hash, so the generated texture is stable between runs.
const noise = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Paints the demo tile sheet: 16 tiles across, one row of 8 px per tile row. */
function buildTiles() {
  const cols = TILES_PER_ROW;
  const rows = 4;
  const width = cols * TILE;
  const height = rows * TILE;
  const px = new Uint8Array(width * height);

  const put = (tileIndex, fn) => {
    const tx = (tileIndex % cols) * TILE;
    const ty = Math.floor(tileIndex / cols) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) px[(ty + y) * width + tx + x] = fn(x, y) & 0x0f;
    }
  };

  put(0, () => 0);                                                   // empty / transparent
  put(1, (x, y) => (noise(x, y, 1) > 0.82 ? 1 : noise(x, y, 2) > 0.6 ? 3 : 2)); // grass
  put(2, (x, y) => (noise(x, y, 7) > 0.7 ? 3 : 2));                  // grass variant
  put(3, (x, y) => (noise(x, y, 3) > 0.8 ? 4 : noise(x, y, 4) > 0.55 ? 6 : 5)); // path
  put(4, (x, y) => (noise(x + y * 3, y, 9) > 0.75 ? 9 : (y + x) % 5 === 0 ? 7 : 8)); // water
  put(5, (x, y) => (y < 2 ? 2 : noise(x, y, 5) > 0.5 ? 4 : 5));      // grass-to-path edge (top)
  put(6, (x, y) => (x < 2 ? 2 : noise(x, y, 6) > 0.5 ? 4 : 5));      // grass-to-path edge (left)
  // tree canopy, 2x2 tiles
  const canopy = (qx, qy) => (x, y) => {
    const gx = qx * TILE + x - TILE + 0.5;
    const gy = qy * TILE + y - TILE + 0.5;
    const d = Math.hypot(gx, gy * 1.15);
    if (d > 7.4) return 0;
    if (d > 6.4) return 15;
    return noise(x + qx * 8, y + qy * 8, 11) > 0.55 ? 10 : 11;
  };
  put(7, canopy(0, 0));
  put(8, canopy(1, 0));
  put(9, canopy(0, 1));
  put(10, canopy(1, 1));
  put(11, (x, y) => (y < 3 ? 0 : x >= 3 && x <= 4 ? 10 : 0));        // trunk
  put(12, (x, y) => (y === 0 || x === 0 ? 15 : y < 4 ? 12 : 12));    // roof
  put(13, (x, y) => (x === 0 || y === 7 ? 15 : 13));                 // wall
  put(14, (x, y) => (x >= 2 && x <= 5 && y >= 2 && y <= 5 ? (x === 2 || x === 5 || y === 2 || y === 5 ? 15 : 14) : 13)); // window
  put(15, (x, y) => (x >= 2 && x <= 5 && y >= 1 ? (x === 2 || x === 5 ? 15 : 4) : 13)); // door
  put(16, (x, y) => (noise(x, y, 21) > 0.86 ? 12 : noise(x, y, 22) > 0.86 ? 6 : 2)); // flowers
  put(17, (x, y) => (y === 3 || (x === 1 && y > 2) ? 15 : y > 3 ? 2 : 0)); // fence
  put(18, (x, y) => (noise(x, y, 31) > 0.7 ? 6 : 5));                // sand

  return { width, height, indices: px };
}

/** metatiles.bin entries: 8 tiles each (4 bottom-layer, 4 top-layer). */
function buildMetatiles(defs) {
  const data = new Uint16Array(defs.length * 8);
  defs.forEach((def, i) => {
    for (let t = 0; t < 8; t++) data[i * 8 + t] = def.tiles[t] ?? 0;
  });
  return new Uint8Array(data.buffer);
}

const tile = (id, { xflip = false, yflip = false, pal = 0 } = {}) =>
  (id & 0x3ff) | (xflip ? 0x400 : 0) | (yflip ? 0x800 : 0) | ((pal & 0xf) << 12);

const flat = (t) => [t, t, t, t, 0, 0, 0, 0];

const PRIMARY_METATILES = [
  { name: 'Tom', tiles: flat(tile(0)), behavior: 0 },
  { name: 'Gräs', tiles: flat(tile(1)), behavior: 0 },
  { name: 'Gräs 2', tiles: flat(tile(2)), behavior: 0 },
  { name: 'Stig', tiles: flat(tile(3)), behavior: 0 },
  { name: 'Vatten', tiles: flat(tile(4)), behavior: 0x10 },
  { name: 'Sand', tiles: flat(tile(18)), behavior: 0 },
  { name: 'Blommor', tiles: flat(tile(16)), behavior: 0 },
  { name: 'Högt gräs', tiles: [...flat(tile(1)).slice(0, 4), tile(16), tile(16), tile(16), tile(16)], behavior: 0x02 },
  { name: 'Stigkant N', tiles: flat(tile(5)), behavior: 0 },
  { name: 'Stigkant V', tiles: flat(tile(6)), behavior: 0 },
  { name: 'Stigkant Ö', tiles: [tile(6, { xflip: true }), tile(6, { xflip: true }), tile(6, { xflip: true }), tile(6, { xflip: true }), 0, 0, 0, 0], behavior: 0 },
  { name: 'Stigkant S', tiles: [tile(5, { yflip: true }), tile(5, { yflip: true }), tile(5, { yflip: true }), tile(5, { yflip: true }), 0, 0, 0, 0], behavior: 0 },
  { name: 'Trädkrona V', tiles: [tile(1), tile(1), tile(1), tile(1), tile(7), tile(8), tile(9), tile(10)], behavior: 0 },
  { name: 'Trädstam', tiles: [tile(1), tile(1), tile(1), tile(1), tile(11), tile(11, { xflip: true }), tile(1), tile(1)], behavior: 0 },
  { name: 'Staket', tiles: [tile(1), tile(1), tile(1), tile(1), tile(17), tile(17), 0, 0], behavior: 0 },
  { name: 'Vattenkant', tiles: [tile(4), tile(4), tile(4), tile(4), tile(5, { yflip: true }), tile(5, { yflip: true }), 0, 0], behavior: 0x10 },
];

const SECONDARY_METATILES = [
  { name: 'Tak V', tiles: flat(tile(12)), behavior: 0 },
  { name: 'Tak Ö', tiles: [tile(12, { xflip: true }), tile(12, { xflip: true }), tile(12, { xflip: true }), tile(12, { xflip: true }), 0, 0, 0, 0], behavior: 0 },
  { name: 'Vägg', tiles: flat(tile(13)), behavior: 0 },
  { name: 'Fönster', tiles: flat(tile(14)), behavior: 0 },
  { name: 'Dörr', tiles: flat(tile(15)), behavior: 0x60 },
];

const W = 28;
const H = 22;
const SECONDARY_BASE = 512;

function buildMap(codecPack) {
  const blocks = new Uint16Array(W * H);
  const set = (x, y, metatile, collision = 0, elevation = 3) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    blocks[y * W + x] = codecPack(metatile, collision, elevation);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) set(x, y, noise(x, y, 42) > 0.88 ? 2 : 1);
  }
  // a lake in the south-west
  for (let y = 15; y < H - 1; y++) {
    for (let x = 1; x < 9; x++) {
      const inside = Math.hypot((x - 5) / 4.4, (y - 18.5) / 3.4) < 1;
      if (inside) set(x, y, 4, 1, 3);
    }
  }
  // main road
  for (let y = 2; y < H - 2; y++) set(13, y, 3);
  for (let x = 4; x < W - 3; x++) set(x, 11, 3);
  for (let y = 2; y < H - 2; y++) set(14, y, 3);
  for (let x = 4; x < W - 3; x++) set(x, 12, 3);

  // house
  const hx = 17, hy = 5;
  set(hx, hy, SECONDARY_BASE + 0, 1); set(hx + 1, hy, SECONDARY_BASE + 1, 1);
  set(hx, hy + 1, SECONDARY_BASE + 2, 1); set(hx + 1, hy + 1, SECONDARY_BASE + 3, 1);
  set(hx, hy + 2, SECONDARY_BASE + 4, 0); set(hx + 1, hy + 2, SECONDARY_BASE + 2, 1);

  // trees along the north edge and a small grove
  for (let x = 1; x < W - 1; x += 2) { set(x, 1, 12, 1); set(x, 0, 12, 1); }
  for (const [tx, ty] of [[4, 5], [6, 6], [8, 4], [21, 15], [23, 16], [20, 17]]) {
    set(tx, ty, 12, 1);
    set(tx, ty + 1, 13, 1);
  }
  // flower patches and tall grass
  for (const [fx, fy] of [[10, 15], [11, 15], [10, 16], [18, 9], [19, 9]]) set(fx, fy, 6);
  for (let x = 17; x < 24; x++) for (let y = 12; y < 15; y++) if (noise(x, y, 55) > 0.35) set(x, y, 7);
  // fence beside the road
  for (let x = 4; x < 11; x++) set(x, 10, 14, 1);

  return new Uint8Array(blocks.buffer);
}

function buildBorder(codecPack) {
  const border = new Uint16Array(4);
  border.fill(codecPack(1, 0, 0));
  return new Uint8Array(border.buffer);
}

function attributes(defs) {
  const out = new Uint8Array(defs.length * 2);
  const view = new DataView(out.buffer);
  defs.forEach((d, i) => view.setUint16(i * 2, d.behavior & 0xff, true));
  return out;
}

/** @returns {Promise<Blob>} a ZIP containing the demo project. */
export async function buildDemoProjectZip() {
  const zip = new ZipWriter();
  const pack = (m, c, e) => ((m & 0x3ff) | ((c & 3) << 10) | ((e & 0xf) << 12)) >>> 0;

  const sheet = buildTiles();
  const png = await encodeIndexedPNG(sheet.width, sheet.height, sheet.indices, PALETTE);

  for (const [dir, defs, palIndices] of [
    ['data/tilesets/primary/general', PRIMARY_METATILES, [0, 1, 2, 3, 4, 5]],
    ['data/tilesets/secondary/demo_town', SECONDARY_METATILES, [6, 7, 8, 9, 10, 11, 12]],
  ]) {
    zip.add(`${dir}/tiles.png`, png);
    zip.add(`${dir}/metatiles.bin`, buildMetatiles(defs));
    zip.add(`${dir}/metatile_attributes.bin`, attributes(defs));
    for (const i of palIndices) {
      zip.addText(`${dir}/palettes/${String(i).padStart(2, '0')}.pal`, jascPalette(PALETTE));
    }
  }

  zip.add('data/layouts/DemoTown/map.bin', buildMap(pack));
  zip.add('data/layouts/DemoTown/border.bin', buildBorder(pack));
  zip.addText('data/layouts/layouts.json', JSON.stringify({
    layouts_table_label: 'gMapLayouts',
    layouts: [{
      id: 'LAYOUT_DEMO_TOWN',
      name: 'DemoTown_Layout',
      width: W,
      height: H,
      border_width: 2,
      border_height: 2,
      primary_tileset: 'gTileset_General',
      secondary_tileset: 'gTileset_DemoTown',
      border_filepath: 'data/layouts/DemoTown/border.bin',
      blockdata_filepath: 'data/layouts/DemoTown/map.bin',
    }],
  }, null, 2) + '\n');

  zip.addText('data/maps/map_groups.json', JSON.stringify({
    group_order: ['gMapGroup_Demo'],
    gMapGroup_Demo: ['DemoTown'],
  }, null, 2) + '\n');

  zip.addText('data/maps/DemoTown/map.json', JSON.stringify({
    id: 'MAP_DEMO_TOWN',
    name: 'DemoTown',
    layout: 'LAYOUT_DEMO_TOWN',
    music: 'MUS_ROUTE101',
    region_map_section: 'MAPSEC_LITTLEROOT_TOWN',
    requires_flash: false,
    weather: 'WEATHER_SUNNY',
    map_type: 'MAP_TYPE_TOWN',
    allow_cycling: true,
    allow_escaping: false,
    allow_running: true,
    show_map_name: true,
    floor_number: 0,
    battle_scene: 'MAP_BATTLE_SCENE_NORMAL',
    connections: null,
    object_events: [
      {
        graphics_id: 'OBJ_EVENT_GFX_BOY_1', x: 12, y: 13, elevation: 3,
        movement_type: 'MOVEMENT_TYPE_LOOK_AROUND', movement_range_x: 1, movement_range_y: 1,
        trainer_type: 'TRAINER_TYPE_NONE', trainer_sight_or_berry_tree_id: '0',
        script: 'DemoTown_EventScript_Boy', flag: '0',
      },
      {
        graphics_id: 'OBJ_EVENT_GFX_WOMAN_1', x: 19, y: 10, elevation: 3,
        movement_type: 'MOVEMENT_TYPE_FACE_DOWN', movement_range_x: 0, movement_range_y: 0,
        trainer_type: 'TRAINER_TYPE_NONE', trainer_sight_or_berry_tree_id: '0',
        script: 'DemoTown_EventScript_Woman', flag: '0',
      },
    ],
    warp_events: [
      { x: 17, y: 7, elevation: 0, dest_map: 'MAP_DEMO_TOWN_HOUSE', dest_warp_id: '0' },
    ],
    coord_events: [
      {
        type: 'trigger', x: 13, y: 3, elevation: 3,
        var: 'VAR_TEMP_1', var_value: '0', script: 'DemoTown_EventScript_Trigger',
      },
    ],
    bg_events: [
      {
        type: 'sign', x: 15, y: 11, elevation: 0,
        player_facing_dir: 'BG_EVENT_PLAYER_FACING_ANY', script: 'DemoTown_EventScript_Sign',
      },
    ],
  }, null, 2) + '\n');

  zip.addText('include/fieldmap.h', [
    '#ifndef GUARD_FIELDMAP_H',
    '#define GUARD_FIELDMAP_H',
    '',
    '#define NUM_TILES_IN_PRIMARY 512',
    '#define NUM_METATILES_IN_PRIMARY 512',
    '#define NUM_PALS_IN_PRIMARY 6',
    '',
    '#endif',
    '',
  ].join('\n'));

  zip.addText('porymap.project.cfg', [
    '[porymap]',
    'base_game_version=demo',
    'use_encounter_json=0',
    'metatile_attributes_size=2',
    '',
  ].join('\n'));

  return zip.toBlob();
}

export const DEMO_METATILE_NAMES = new Map([
  ...PRIMARY_METATILES.map((d, i) => [i, d.name]),
  ...SECONDARY_METATILES.map((d, i) => [SECONDARY_BASE + i, d.name]),
]);
