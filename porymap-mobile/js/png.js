// Indexed-PNG decoder.
//
// The browser can decode tiles.png on its own, but only into RGBA — and the map
// renderer needs the *palette indices*, because a tileset re-colours the same
// tiles through up to 13 different palettes. So we read the raw indexed data.

async function inflateZlib(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(data, width, height, bytesPerPixel, bytesPerRow) {
  const out = new Uint8Array(bytesPerRow * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = data[pos++];
    const row = y * bytesPerRow;
    const prev = row - bytesPerRow;
    for (let x = 0; x < bytesPerRow; x++) {
      const raw = data[pos++];
      const a = x >= bytesPerPixel ? out[row + x - bytesPerPixel] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bytesPerPixel && y > 0 ? out[prev + x - bytesPerPixel] : 0;
      let v;
      switch (filter) {
        case 0: v = raw; break;
        case 1: v = raw + a; break;
        case 2: v = raw + b; break;
        case 3: v = raw + ((a + b) >> 1); break;
        case 4: v = raw + paethPredictor(a, b, c); break;
        default: throw new Error(`Okänd PNG-filtertyp ${filter}`);
      }
      out[row + x] = v & 0xff;
    }
  }
  return out;
}

/**
 * @returns {{width:number, height:number, indices:Uint8Array, palette:Array<[number,number,number]>|null}}
 */
export async function decodeIndexedPNG(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== magic[i]) throw new Error('Inte en PNG-fil');
  }

  let p = 8;
  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  let palette = null;
  const idat = [];

  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const body = p + 8;
    if (type === 'IHDR') {
      width = view.getUint32(body);
      height = view.getUint32(body + 4);
      depth = bytes[body + 8];
      colorType = bytes[body + 9];
      interlace = bytes[body + 12];
    } else if (type === 'PLTE') {
      palette = [];
      for (let i = 0; i < len; i += 3) {
        palette.push([bytes[body + i], bytes[body + i + 1], bytes[body + i + 2]]);
      }
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(body, body + len));
    } else if (type === 'IEND') {
      break;
    }
    p = body + len + 4;
  }

  if (interlace !== 0) throw new Error('Interlacade PNG-filer stöds inte');
  if (colorType !== 3 && colorType !== 0) {
    throw new Error(`tiles.png måste vara indexerad (färgtyp 3), hittade färgtyp ${colorType}`);
  }

  let compressed;
  if (idat.length === 1) {
    compressed = idat[0];
  } else {
    let total = 0;
    for (const c of idat) total += c.length;
    compressed = new Uint8Array(total);
    let o = 0;
    for (const c of idat) { compressed.set(c, o); o += c.length; }
  }

  const raw = await inflateZlib(compressed);
  const bytesPerRow = Math.ceil((width * depth) / 8);
  const bpp = Math.max(1, Math.ceil(depth / 8));
  const rows = unfilter(raw, width, height, bpp, bytesPerRow);

  const indices = new Uint8Array(width * height);
  if (depth === 8) {
    for (let y = 0; y < height; y++) indices.set(rows.subarray(y * bytesPerRow, y * bytesPerRow + width), y * width);
  } else {
    const perByte = 8 / depth;
    const mask = (1 << depth) - 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = rows[y * bytesPerRow + ((x / perByte) | 0)];
        const shift = 8 - depth * ((x % perByte) + 1);
        indices[y * width + x] = (byte >> shift) & mask;
      }
    }
  }

  return { width, height, indices, palette };
}
