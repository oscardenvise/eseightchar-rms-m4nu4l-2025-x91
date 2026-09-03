// Minimal ZIP reader/writer built on the platform's own compression streams.
// No dependencies, so the whole app stays installable offline.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function streamThrough(bytes, transform) {
  const src = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(src).arrayBuffer());
}

export async function inflateRaw(bytes) {
  return streamThrough(bytes, new DecompressionStream('deflate-raw'));
}

export async function deflateRaw(bytes) {
  return streamThrough(bytes, new CompressionStream('deflate-raw'));
}

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOC = 0x07064b50;
const SIG_CDIR = 0x02014b50;

/**
 * Reads a ZIP archive out of an ArrayBuffer. Entry data is decompressed lazily,
 * which matters a lot for decomp projects: a zipped pokeemerald checkout has
 * thousands of files but a map editor only ever touches a handful of them.
 */
export class ZipReader {
  constructor(buffer) {
    this.buf = buffer;
    this.view = new DataView(buffer);
    this.entries = new Map();
    this._readCentralDirectory();
  }

  static async fromBlob(blob) {
    return new ZipReader(await blob.arrayBuffer());
  }

  _findEOCD() {
    const { view } = this;
    const max = Math.min(view.byteLength, 0xffff + 22);
    for (let i = 22; i <= max; i++) {
      const off = view.byteLength - i;
      if (view.getUint32(off, true) === SIG_EOCD) return off;
    }
    throw new Error('Ingen ZIP-katalog hittades — är filen verkligen ett .zip-arkiv?');
  }

  _readCentralDirectory() {
    const { view } = this;
    const eocd = this._findEOCD();
    let count = view.getUint16(eocd + 10, true);
    let cdOffset = view.getUint32(eocd + 16, true);

    // ZIP64: the 32-bit fields saturate and the real values live in the EOCD64 record.
    if (count === 0xffff || cdOffset === 0xffffffff) {
      for (let i = eocd - 20; i >= 0; i--) {
        if (view.getUint32(i, true) === SIG_EOCD64_LOC) {
          const rec = Number(view.getBigUint64(i + 8, true));
          if (view.getUint32(rec, true) !== SIG_EOCD64) break;
          count = Number(view.getBigUint64(rec + 32, true));
          cdOffset = Number(view.getBigUint64(rec + 48, true));
          break;
        }
      }
    }

    const dec = new TextDecoder();
    let p = cdOffset;
    for (let i = 0; i < count; i++) {
      if (view.getUint32(p, true) !== SIG_CDIR) break;
      const flags = view.getUint16(p + 8, true);
      const method = view.getUint16(p + 10, true);
      const crc = view.getUint32(p + 16, true);
      let compSize = view.getUint32(p + 20, true);
      let size = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      let headerOffset = view.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(this.buf, p + 46, nameLen));

      if (size === 0xffffffff || compSize === 0xffffffff || headerOffset === 0xffffffff) {
        let e = p + 46 + nameLen;
        const end = e + extraLen;
        while (e + 4 <= end) {
          const id = view.getUint16(e, true);
          const len = view.getUint16(e + 2, true);
          if (id === 0x0001) {
            let q = e + 4;
            if (size === 0xffffffff) { size = Number(view.getBigUint64(q, true)); q += 8; }
            if (compSize === 0xffffffff) { compSize = Number(view.getBigUint64(q, true)); q += 8; }
            if (headerOffset === 0xffffffff) headerOffset = Number(view.getBigUint64(q, true));
            break;
          }
          e += 4 + len;
        }
      }

      if (!name.endsWith('/')) {
        this.entries.set(name, { name, method, crc, compSize, size, headerOffset, flags });
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  has(name) { return this.entries.has(name); }
  names() { return [...this.entries.keys()]; }

  async read(name) {
    const e = this.entries.get(name);
    if (!e) throw new Error(`Filen saknas i arkivet: ${name}`);
    const nameLen = this.view.getUint16(e.headerOffset + 26, true);
    const extraLen = this.view.getUint16(e.headerOffset + 28, true);
    const start = e.headerOffset + 30 + nameLen + extraLen;
    const raw = new Uint8Array(this.buf, start, e.compSize);
    if (e.method === 0) return raw.slice();
    if (e.method === 8) return inflateRaw(raw);
    throw new Error(`Komprimeringsmetod ${e.method} stöds inte (${name})`);
  }

  async readText(name) {
    return new TextDecoder().decode(await this.read(name));
  }

  async readJSON(name) {
    return JSON.parse(await this.readText(name));
  }
}

function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** Builds a ZIP archive in memory. Used for exporting edited project files. */
export class ZipWriter {
  constructor() { this.files = []; }

  add(name, bytes) {
    this.files.push({ name, bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes) });
  }

  addText(name, text) { this.add(name, new TextEncoder().encode(text)); }

  async toBlob() {
    const enc = new TextEncoder();
    const { time, date } = dosDateTime();
    const parts = [];
    const central = [];
    let offset = 0;

    for (const f of this.files) {
      const nameBytes = enc.encode(f.name);
      const crc = crc32(f.bytes);
      let data = f.bytes;
      let method = 0;
      if (f.bytes.length > 64) {
        const packed = await deflateRaw(f.bytes);
        if (packed.length < f.bytes.length) { data = packed; method = 8; }
      }

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 names
      lv.setUint16(8, method, true);
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, f.bytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      parts.push(local, data);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, SIG_CDIR, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, method, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, f.bytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + data.length;
    }

    let centralSize = 0;
    for (const c of central) centralSize += c.length;
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, SIG_EOCD, true);
    ev.setUint16(8, central.length, true);
    ev.setUint16(10, central.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
}
