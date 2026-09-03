// Wires the DOM together: project loading, the metatile picker, the collision
// and event panels, persistence and export.

import { Project } from './project.js';
import { MapDocument, EVENT_GROUPS } from './mapdoc.js';
import { MapView, BLOCK_PX } from './mapview.js';
import { Viewport } from './viewport.js';
import { Editor, TOOLS } from './editor.js';
import { ZipWriter } from './zip.js';
import { buildDemoProjectZip, DEMO_METATILE_NAMES } from './demo.js';
import { saveSession, loadSession, clearSession } from './storage.js';

const PICKER_CELL = 32;
const $ = (id) => document.getElementById(id);

const EVENT_TEMPLATES = {
  object_events: (x, y) => ({
    graphics_id: 'OBJ_EVENT_GFX_BOY_1', x, y, elevation: 3,
    movement_type: 'MOVEMENT_TYPE_FACE_DOWN', movement_range_x: 0, movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NONE', trainer_sight_or_berry_tree_id: '0',
    script: '', flag: '0',
  }),
  warp_events: (x, y) => ({ x, y, elevation: 0, dest_map: 'MAP_NONE', dest_warp_id: '0' }),
  coord_events: (x, y) => ({
    type: 'trigger', x, y, elevation: 3, var: 'VAR_TEMP_1', var_value: '0', script: '',
  }),
  bg_events: (x, y) => ({
    type: 'sign', x, y, elevation: 0,
    player_facing_dir: 'BG_EVENT_PLAYER_FACING_ANY', script: '',
  }),
};

export class App {
  constructor() {
    this.project = null;
    this.doc = null;
    this.projectName = '';
    this.sourceBlob = null;
    this.eventFilter = 'all';
    this.picker = { ids: [], cols: 8, rows: 0, sel: null };

    this.canvas = $('mapCanvas');
    this.viewport = new Viewport(this.canvas, {
      onChange: () => this.view.invalidate(),
      shouldDraw: () => !!this.doc && this.editor.shouldDraw(),
      onStrokeStart: (world) => { this.editor.strokeStart(world); this.updateCoords(world); },
      onStrokeMove: (world) => { this.editor.strokeMove(world); this.updateCoords(world); },
      onStrokeEnd: () => { this.editor.strokeEnd(); this.refreshDirtyState(); },
      onStrokeCancel: () => this.editor.strokeCancel(),
      onHover: (world) => { this.editor.hover(world); this.updateCoords(world); },
    });
    this.view = new MapView(this.canvas, this.viewport);
    this.editor = new Editor(this.view);
    this.editor.onStatus = (text) => this.toast(text);
    this.editor.onPick = (id) => this.selectMetatile(id, true);
    this.editor.onSelectEvent = () => this.renderEventPanel();

    this._bindUI();
    this._buildTools();
    this._buildCollisionControls();
    this._buildEventTabs();
    this._observeResize();
  }

  // ---------- chrome ----------

  toast(text, ms = 1900) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  loading(text) {
    const el = $('loading');
    if (text) {
      $('loadingText').textContent = text;
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  }

  _observeResize() {
    const resize = () => {
      this.viewport.resize();
      this.layoutPicker();
      this.view.invalidate();
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(this.canvas);
    requestAnimationFrame(resize);
  }

  _bindUI() {
    $('menuBtn').addEventListener('click', () => this.toggleSheet(true));
    $('closeSheetBtn').addEventListener('click', () => this.toggleSheet(false));
    $('scrim').addEventListener('click', () => this.toggleSheet(false));

    $('undoBtn').addEventListener('click', () => this.undo());
    $('redoBtn').addEventListener('click', () => this.redo());
    $('saveBtn').addEventListener('click', () => this.saveChanges());

    $('zoomInBtn').addEventListener('click', () => { this.viewport.zoomBy(1.35); });
    $('zoomOutBtn').addEventListener('click', () => { this.viewport.zoomBy(1 / 1.35); });
    $('zoomFitBtn').addEventListener('click', () => this.fitMap());

    const pick = () => $('fileInput').click();
    $('openZipBtn').addEventListener('click', pick);
    $('openZipBtn2').addEventListener('click', pick);
    $('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) await this.loadProjectFromBlob(file, file.name.replace(/\.zip$/i, ''));
    });

    $('demoBtn').addEventListener('click', () => this.loadDemo());
    $('loadDemoBtn').addEventListener('click', () => this.loadDemo());
    $('exportChangedBtn').addEventListener('click', () => this.exportChanged());
    $('exportAllBtn').addEventListener('click', () => this.exportAll());
    $('forgetBtn').addEventListener('click', () => this.forgetSession());

    for (const btn of document.querySelectorAll('.mode-btn')) {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    }
    for (const btn of document.querySelectorAll('.layers .glyph-btn')) {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        this.view.options[layer] = !this.view.options[layer];
        btn.classList.toggle('active', this.view.options[layer]);
        this.view.invalidate();
      });
    }

    this._bindDrawerHandle();

    $('brushResetBtn').addEventListener('click', () => {
      const id = this.editor.brush.ids[0] ?? 0;
      this.selectMetatile(id, false);
    });

    $('mapSearch').addEventListener('input', () => this.renderMapList());
    $('addEventBtn').addEventListener('click', () => this.addEvent());
    $('deleteEventBtn').addEventListener('click', () => this.deleteEvent());

    this._bindPicker();
    this._bindBorderStrip();

    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? this.redo() : this.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveChanges();
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.doc?.isModified) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  /** The handle both collapses the drawer on a tap and resizes it on a drag. */
  _bindDrawerHandle() {
    const handle = $('drawerHandle');
    const drawer = $('drawer');
    let start = null;

    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture?.(e.pointerId);
      start = { y: e.clientY, height: drawer.getBoundingClientRect().height, moved: false };
      drawer.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (e) => {
      if (!start) return;
      const delta = start.y - e.clientY;
      if (Math.abs(delta) > 6) start.moved = true;
      if (!start.moved) return;
      const max = window.innerHeight * 0.72;
      const height = Math.max(26, Math.min(max, start.height + delta));
      drawer.classList.remove('collapsed');
      drawer.style.height = `${height}px`;
      this.viewport.resize();
      this.layoutPicker();
    });

    const end = (e) => {
      if (!start) return;
      const wasDrag = start.moved;
      start = null;
      drawer.classList.remove('dragging');
      handle.releasePointerCapture?.(e.pointerId);
      if (!wasDrag) {
        drawer.style.height = '';
        drawer.classList.toggle('collapsed');
      }
      requestAnimationFrame(() => { this.viewport.resize(); this.layoutPicker(); });
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  toggleSheet(open) {
    $('sheet').classList.toggle('open', open);
    $('sheet').setAttribute('aria-hidden', String(!open));
    $('scrim').classList.toggle('open', open);
  }

  _buildTools() {
    const host = $('tools');
    host.innerHTML = '';
    this.toolButtons = new Map();
    for (const [key, tool] of Object.entries(TOOLS)) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn' + (key === this.editor.tool ? ' active' : '');
      btn.textContent = tool.icon;
      btn.title = tool.label;
      btn.setAttribute('aria-label', tool.label);
      btn.addEventListener('click', () => this.setTool(key));
      host.appendChild(btn);
      this.toolButtons.set(key, btn);
    }
  }

  setTool(key) {
    this.editor.tool = key;
    for (const [name, btn] of this.toolButtons) btn.classList.toggle('active', name === key);
  }

  setMode(mode) {
    this.editor.mode = mode;
    for (const btn of document.querySelectorAll('.mode-btn')) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    }
    for (const panel of ['metatiles', 'collision', 'events']) {
      $(`panel-${panel}`).classList.toggle('hidden', panel !== mode);
    }
    this.view.options.collision = mode === 'collision';
    if (mode === 'events') {
      this.view.options.events = true;
      document.querySelector('.layers [data-layer="events"]')?.classList.add('active');
    }
    $('drawer').classList.remove('collapsed');
    this.view.invalidate();
    requestAnimationFrame(() => this.viewport.resize());
  }

  // ---------- project ----------

  async loadDemo() {
    this.loading('Bygger demoprojekt…');
    try {
      const blob = await buildDemoProjectZip();
      await this.loadProjectFromBlob(blob, 'Demoprojekt');
    } catch (err) {
      this.loading(null);
      this.fail(err);
    }
  }

  async loadProjectFromBlob(blob, name, { restoredDirty = null, restoreMap = null } = {}) {
    this.loading('Öppnar projekt…');
    try {
      const project = await Project.fromBlob(blob, (text) => this.loading(text));
      if (restoredDirty) {
        for (const [path, bytes] of restoredDirty) project.dirty.set(path, bytes);
      }
      this.project = project;
      this.projectName = name || 'Projekt';
      this.sourceBlob = blob;
      this.toggleSheet(false);
      $('emptyState').classList.add('hidden');
      this.renderProjectInfo();
      this.renderMapList();

      const first = restoreMap && project.maps.has(restoreMap)
        ? restoreMap
        : project.groups[0]?.maps[0] ?? [...project.maps.keys()][0];
      if (first) await this.openMap(first);
      else this.toast('Projektet innehåller inga kartor');

      $('exportChangedBtn').disabled = false;
      $('exportAllBtn').disabled = false;
      await this.persist();
    } catch (err) {
      this.fail(err);
    } finally {
      this.loading(null);
    }
  }

  fail(err) {
    console.error(err);
    this.loading(null);
    this.toast(err?.message ? `Fel: ${err.message}` : 'Något gick fel', 5200);
  }

  async openMap(mapName) {
    if (!this.project) return;
    if (this.doc?.isModified) this.doc.save();
    this.loading(`Öppnar ${mapName}…`);
    try {
      const doc = await MapDocument.open(this.project, mapName, (text) => this.loading(text));
      this.doc = doc;
      doc.onChange(() => this.refreshDirtyState());
      this.view.setDocument(doc);
      this.editor.selectedEvent = null;

      $('coords').textContent = '';
      $('mapTitle').textContent = mapName;
      const layout = doc.layout;
      $('mapSubtitle').textContent =
        `${layout.width}×${layout.height} · ${String(layout.primary_tileset || '').replace(/^gTileset_/, '')}` +
        ` + ${String(layout.secondary_tileset || '').replace(/^gTileset_/, '')}`;

      this.layoutPicker();
      this.selectMetatile(this.firstUsableMetatile(), true);
      this.fitMap();
      this.renderMapList();
      this.renderEventPanel();
      this.renderBorderStrip();
      this.renderMapProperties();
      this.refreshDirtyState();
      await this.persist();
    } catch (err) {
      this.fail(err);
    } finally {
      this.loading(null);
    }
  }

  firstUsableMetatile() {
    const doc = this.doc;
    if (!doc) return 0;
    for (let id = 1; id < doc.tilesets.numMetatiles; id++) {
      if (doc.tilesets.isValidMetatile(id)) return id;
    }
    return 0;
  }

  fitMap() {
    if (!this.doc) return;
    this.viewport.fitTo(this.view.worldWidth, this.view.worldHeight, 20);
    this.view.invalidate();
  }

  renderProjectInfo() {
    const p = this.project;
    if (!p) { $('projectInfo').textContent = 'Inget projekt öppet.'; return; }
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    $('projectInfo').innerHTML =
      `<b>${escapeHTML(this.projectName)}</b><br>` +
      `Bas: ${escapeHTML(p.baseGame)} · ${plural(p.maps.size, 'karta', 'kartor')}` +
      ` · ${plural(p.layouts.size, 'layout', 'layouter')} · ${plural(p.tilesetDirs.size, 'tileset', 'tilesets')}<br>` +
      `Metatiles i primärt tileset: ${p.constants.numMetatilesInPrimary}`;
  }

  renderMapList() {
    const host = $('mapList');
    host.innerHTML = '';
    if (!this.project) return;
    const query = $('mapSearch').value.trim().toLowerCase();
    for (const group of this.project.groups) {
      const matches = group.maps.filter((m) => !query || m.toLowerCase().includes(query));
      if (!matches.length) continue;
      const label = document.createElement('div');
      label.className = 'map-group';
      label.textContent = group.name.replace(/^gMapGroup_/, '');
      host.appendChild(label);
      for (const name of matches) {
        const btn = document.createElement('button');
        btn.className = 'map-item' + (this.doc?.name === name ? ' active' : '');
        btn.textContent = name;
        btn.addEventListener('click', async () => {
          this.toggleSheet(false);
          await this.openMap(name);
        });
        host.appendChild(btn);
      }
    }
  }

  // ---------- metatile picker ----------

  layoutPicker() {
    const doc = this.doc;
    const canvas = $('pickerCanvas');
    if (!doc) { canvas.width = 0; canvas.height = 0; return; }

    const available = (canvas.parentElement.clientWidth || 320) - 2;
    const cols = Math.max(4, Math.min(24, Math.floor(available / PICKER_CELL)));
    const ids = [];
    const primaryCount = doc.tilesets.primary.numMetatiles;
    for (let i = 0; i < primaryCount; i++) ids.push(i);
    while (ids.length % cols !== 0) ids.push(null);
    const base = doc.project.constants.numMetatilesInPrimary;
    for (let i = 0; i < doc.tilesets.secondary.numMetatiles; i++) ids.push(base + i);

    const rows = Math.ceil(ids.length / cols);
    this.picker = { ids, cols, rows, sel: this.picker.sel };

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${cols * PICKER_CELL}px`;
    canvas.style.height = `${rows * PICKER_CELL}px`;
    canvas.width = cols * PICKER_CELL * dpr;
    canvas.height = rows * PICKER_CELL * dpr;
    this.renderPicker();
  }

  renderPicker() {
    const doc = this.doc;
    const canvas = $('pickerCanvas');
    if (!doc || !canvas.width) return;
    const { ids, cols } = this.picker;
    const dpr = canvas.width / (cols * PICKER_CELL);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#090c11';
    ctx.fillRect(0, 0, cols * PICKER_CELL, this.picker.rows * PICKER_CELL);

    const atlas = doc.tilesets.atlas;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const x = (i % cols) * PICKER_CELL;
      const y = Math.floor(i / cols) * PICKER_CELL;
      if (id === null || !doc.tilesets.isValidMetatile(id)) {
        ctx.fillStyle = '#11161f';
        ctx.fillRect(x, y, PICKER_CELL, PICKER_CELL);
        continue;
      }
      const { sx, sy } = doc.tilesets.atlasSlot(id);
      ctx.drawImage(atlas, sx, sy, BLOCK_PX, BLOCK_PX, x, y, PICKER_CELL, PICKER_CELL);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < cols; c++) { ctx.moveTo(c * PICKER_CELL, 0); ctx.lineTo(c * PICKER_CELL, this.picker.rows * PICKER_CELL); }
    for (let r = 1; r < this.picker.rows; r++) { ctx.moveTo(0, r * PICKER_CELL); ctx.lineTo(cols * PICKER_CELL, r * PICKER_CELL); }
    ctx.stroke();

    const sel = this.picker.sel;
    if (sel) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      ctx.strokeRect(sel.x * PICKER_CELL + 1, sel.y * PICKER_CELL + 1,
        sel.w * PICKER_CELL - 2, sel.h * PICKER_CELL - 2);
    }
  }

  _bindPicker() {
    const canvas = $('pickerCanvas');
    let anchor = null;
    let selecting = false;
    let holdTimer = null;

    const cellAt = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(this.picker.cols - 1, Math.floor((e.clientX - rect.left) / PICKER_CELL))),
        y: Math.max(0, Math.min(this.picker.rows - 1, Math.floor((e.clientY - rect.top) / PICKER_CELL))),
      };
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.doc) return;
      anchor = cellAt(e);
      selecting = e.pointerType === 'mouse';
      this.applyPickerSelection(anchor, anchor);
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        selecting = true;
        canvas.setPointerCapture?.(e.pointerId);
        this.toast('Dra för att välja flera metatiles');
      }, 260);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!anchor || !selecting) return;
      e.preventDefault();
      this.applyPickerSelection(anchor, cellAt(e));
    });

    const end = () => {
      clearTimeout(holdTimer);
      anchor = null;
      selecting = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
  }

  applyPickerSelection(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x) + 1;
    const h = Math.abs(a.y - b.y) + 1;
    const ids = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const index = (y + dy) * this.picker.cols + (x + dx);
        const id = this.picker.ids[index];
        ids.push(id === null || id === undefined ? 0 : id);
      }
    }
    this.picker.sel = { x, y, w, h };
    this.editor.setBrush(ids, w, h);
    this.renderPicker();
    this.updateMetatileInfo(ids[0], w, h);
    if (this.editor.tool === 'pick') this.setTool('pencil');
  }

  selectMetatile(id, scrollIntoView) {
    const index = this.picker.ids.indexOf(id);
    if (index < 0) {
      this.editor.setBrush([id], 1, 1);
      this.picker.sel = null;
      this.renderPicker();
      this.updateMetatileInfo(id, 1, 1);
      return;
    }
    const x = index % this.picker.cols;
    const y = Math.floor(index / this.picker.cols);
    this.applyPickerSelection({ x, y }, { x, y });
    if (scrollIntoView) {
      const scroller = $('pickerCanvas').parentElement;
      const top = y * PICKER_CELL;
      if (top < scroller.scrollTop || top > scroller.scrollTop + scroller.clientHeight - PICKER_CELL) {
        scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2);
      }
    }
  }

  updateMetatileInfo(id, w, h) {
    const doc = this.doc;
    if (!doc) return;
    const hex = `0x${id.toString(16).toUpperCase().padStart(3, '0')}`;
    const behavior = doc.tilesets.behavior(id);
    const name = DEMO_METATILE_NAMES.get(id);
    const source = id < doc.project.constants.numMetatilesInPrimary ? 'primär' : 'sekundär';
    $('metatileInfo').textContent =
      `${hex} · ${source}${name ? ` · ${name}` : ''} · beteende 0x${behavior.toString(16).toUpperCase()}`;
    $('brushResetBtn').textContent = `${w}×${h}`;
  }

  // ---------- border strip ----------

  renderBorderStrip() {
    const doc = this.doc;
    const canvas = $('borderCanvas');
    if (!doc) { canvas.width = 0; canvas.height = 0; return; }
    const cell = 26;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${doc.borderWidth * cell}px`;
    canvas.style.height = `${doc.borderHeight * cell}px`;
    canvas.width = doc.borderWidth * cell * dpr;
    canvas.height = doc.borderHeight * cell * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#090c11';
    ctx.fillRect(0, 0, doc.borderWidth * cell, doc.borderHeight * cell);
    for (let y = 0; y < doc.borderHeight; y++) {
      for (let x = 0; x < doc.borderWidth; x++) {
        const id = doc.codec.metatile(doc.border[y * doc.borderWidth + x] || 0);
        if (!doc.tilesets.isValidMetatile(id)) continue;
        const { sx, sy } = doc.tilesets.atlasSlot(id);
        ctx.drawImage(doc.tilesets.atlas, sx, sy, BLOCK_PX, BLOCK_PX, x * cell, y * cell, cell, cell);
      }
    }
  }

  _bindBorderStrip() {
    const canvas = $('borderCanvas');
    canvas.addEventListener('pointerdown', (e) => {
      const doc = this.doc;
      if (!doc) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cell = rect.width / doc.borderWidth;
      const x = Math.floor((e.clientX - rect.left) / cell);
      const y = Math.floor((e.clientY - rect.top) / cell);
      const id = this.editor.brush.ids[0] ?? 0;
      doc.beginStroke('Kant');
      doc.setBorderBlock(x, y, doc.codec.withMetatile(doc.borderBlockAt(x, y), id));
      doc.endStroke();
      this.renderBorderStrip();
      this.view.renderBorder();
      this.view.invalidate();
      this.refreshDirtyState();
    });
  }

  // ---------- map properties ----------

  renderMapProperties() {
    const host = $('mapProps');
    host.innerHTML = '';
    const doc = this.doc;
    if (!doc) return;

    for (const [key, value] of Object.entries(doc.header)) {
      // Arrays, objects and nulls (connections, events) have their own UI or no
      // meaningful text representation.
      if (value === null || typeof value === 'object') continue;
      if (key === 'id' || key === 'name' || key === 'layout') {
        const row = document.createElement('div');
        row.className = 'row';
        const label = document.createElement('label');
        label.textContent = key;
        const readonly = document.createElement('input');
        readonly.value = String(value);
        readonly.readOnly = true;
        row.append(label, readonly);
        host.appendChild(row);
        continue;
      }

      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('label');
      label.textContent = key;
      label.title = key;
      let input;
      if (typeof value === 'boolean') {
        input = document.createElement('select');
        for (const option of ['true', 'false']) {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        }
        input.value = String(value);
      } else {
        input = document.createElement('input');
        input.type = typeof value === 'number' ? 'number' : 'text';
        input.value = String(value);
        input.autocapitalize = 'off';
        input.autocomplete = 'off';
        input.spellcheck = false;
      }
      input.addEventListener('change', () => {
        if (typeof value === 'boolean') doc.header[key] = input.value === 'true';
        else if (typeof value === 'number') doc.header[key] = Number(input.value) || 0;
        else doc.header[key] = input.value;
        doc.eventsModified = true;
        this.refreshDirtyState();
        this.toast(`${key} = ${doc.header[key]}`);
      });
      row.append(label, input);
      host.appendChild(row);
    }
  }

  // ---------- collision ----------

  _buildCollisionControls() {
    const collisions = $('collisionButtons');
    const elevations = $('elevationButtons');
    collisions.innerHTML = '';
    elevations.innerHTML = '';
    this.collisionButtons = [];
    this.elevationButtons = [];

    for (let value = 0; value <= 3; value++) {
      const btn = document.createElement('button');
      btn.textContent = String(value);
      btn.title = value === 0 ? 'Passerbar' : 'Blockerad';
      btn.addEventListener('click', () => {
        this.editor.collisionBrush.collision = value;
        this._syncCollisionButtons();
      });
      collisions.appendChild(btn);
      this.collisionButtons.push(btn);
    }
    for (let value = 0; value <= 15; value++) {
      const btn = document.createElement('button');
      btn.textContent = String(value);
      btn.addEventListener('click', () => {
        this.editor.collisionBrush.elevation = value;
        this._syncCollisionButtons();
      });
      elevations.appendChild(btn);
      this.elevationButtons.push(btn);
    }
    this._syncCollisionButtons();
  }

  _syncCollisionButtons() {
    const { collision, elevation } = this.editor.collisionBrush;
    this.collisionButtons.forEach((b, i) => b.classList.toggle('active', i === collision));
    this.elevationButtons.forEach((b, i) => b.classList.toggle('active', i === elevation));
  }

  // ---------- events ----------

  _buildEventTabs() {
    const host = $('eventTabs');
    host.innerHTML = '';
    const tabs = [{ key: 'all', label: 'Alla' }, ...EVENT_GROUPS.map((g) => ({ key: g.key, label: g.label }))];
    this.eventTabButtons = new Map();
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = 'chip' + (tab.key === this.eventFilter ? ' active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        this.eventFilter = tab.key;
        for (const [key, b] of this.eventTabButtons) b.classList.toggle('active', key === this.eventFilter);
        this.renderEventPanel();
      });
      host.appendChild(btn);
      this.eventTabButtons.set(tab.key, btn);
    }
  }

  renderEventPanel() {
    const list = $('eventList');
    const form = $('eventForm');
    list.innerHTML = '';
    form.innerHTML = '';
    const doc = this.doc;
    const selection = this.editor.selectedEvent;
    $('deleteEventBtn').disabled = !selection;

    if (!doc) { $('eventInfo').textContent = 'Ingen karta öppen'; return; }

    const groups = EVENT_GROUPS.filter((g) => this.eventFilter === 'all' || this.eventFilter === g.key);
    let count = 0;
    for (const group of groups) {
      doc.events(group.key).forEach((event, index) => {
        count++;
        const row = document.createElement('div');
        const active = selection && selection.key === group.key && selection.index === index;
        row.className = 'event-row' + (active ? ' active' : '');
        row.innerHTML =
          `<span class="dot" style="background:${group.color}"></span>` +
          `<span class="label">${escapeHTML(describeEvent(group.key, event))}</span>` +
          `<span class="pos">${Number(event.x)},${Number(event.y)}</span>`;
        row.addEventListener('click', () => {
          this.editor.selectEvent({ key: group.key, index, event });
          this.centerOnEvent(event);
        });
        list.appendChild(row);
      });
    }

    $('eventInfo').textContent = selection
      ? `${EVENT_GROUPS.find((g) => g.key === selection.key).label} #${selection.index}`
      : `${count} event i den här kartan`;

    if (!selection) return;
    const event = doc.events(selection.key)[selection.index];
    if (!event) { this.editor.selectEvent(null); return; }

    for (const [key, value] of Object.entries(event)) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('label');
      label.textContent = key;
      label.title = key;
      let input;
      if (typeof value === 'boolean') {
        input = document.createElement('select');
        for (const option of ['true', 'false']) {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        }
        input.value = String(value);
      } else {
        input = document.createElement('input');
        input.type = typeof value === 'number' ? 'number' : 'text';
        input.value = value === null ? '' : String(value);
        input.autocapitalize = 'off';
        input.autocomplete = 'off';
        input.spellcheck = false;
      }
      let before = null;
      input.addEventListener('focus', () => { before = doc.snapshotEvents(); });
      input.addEventListener('change', () => {
        const snapshot = before || doc.snapshotEvents();
        const target = doc.events(selection.key)[selection.index];
        if (!target) return;
        if (typeof value === 'boolean') target[key] = input.value === 'true';
        else if (typeof value === 'number') target[key] = Number(input.value) || 0;
        else target[key] = input.value;
        doc.recordEventChange(`Ändra ${key}`, snapshot, doc.snapshotEvents());
        before = null;
        this.view.invalidate();
        this.renderEventPanel();
        this.refreshDirtyState();
      });
      row.append(label, input);
      form.appendChild(row);
    }
  }

  centerOnEvent(event) {
    const x = (Number(event.x) + 0.5) * BLOCK_PX;
    const y = (Number(event.y) + 0.5) * BLOCK_PX;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.viewport.centerOn(x, y);
    this.view.invalidate();
  }

  addEvent() {
    const doc = this.doc;
    if (!doc) return;
    const key = this.eventFilter === 'all' ? 'object_events' : this.eventFilter;
    const center = this.viewport.toWorld(
      window.innerWidth / 2, this.canvas.getBoundingClientRect().top + this.canvas.clientHeight / 2);
    const block = this.view.worldToBlock(center);
    const x = Math.max(0, Math.min(doc.width - 1, block.x));
    const y = Math.max(0, Math.min(doc.height - 1, block.y));

    const snapshot = doc.snapshotEvents();
    if (!Array.isArray(doc.header[key])) doc.header[key] = [];
    const template = doc.events(key).length
      ? { ...doc.events(key)[doc.events(key).length - 1], x, y }
      : EVENT_TEMPLATES[key](x, y);
    doc.header[key].push(template);
    doc.recordEventChange('Lägg till event', snapshot, doc.snapshotEvents());

    this.setMode('events');
    this.editor.selectEvent({ key, index: doc.events(key).length - 1, event: template });
    this.renderEventPanel();
    this.refreshDirtyState();
    this.view.invalidate();
    this.toast(`Nytt event på ${x},${y}`);
  }

  deleteEvent() {
    const doc = this.doc;
    const selection = this.editor.selectedEvent;
    if (!doc || !selection) return;
    const snapshot = doc.snapshotEvents();
    doc.header[selection.key].splice(selection.index, 1);
    doc.recordEventChange('Ta bort event', snapshot, doc.snapshotEvents());
    this.editor.selectEvent(null);
    this.renderEventPanel();
    this.refreshDirtyState();
    this.view.invalidate();
    this.toast('Event borttaget');
  }

  // ---------- history, saving, export ----------

  undo() {
    if (!this.doc?.undo()) return;
    this._afterHistoryStep();
  }

  redo() {
    if (!this.doc?.redo()) return;
    this._afterHistoryStep();
  }

  _afterHistoryStep() {
    this.view.renderAllBlocks();
    this.view.renderBorder();
    this.view.invalidate();
    this.renderEventPanel();
    this.renderBorderStrip();
    this.refreshDirtyState();
  }

  refreshDirtyState() {
    const doc = this.doc;
    $('undoBtn').disabled = !doc?.canUndo;
    $('redoBtn').disabled = !doc?.canRedo;
    const dirty = !!doc?.isModified || !!this.project?.isDirty;
    $('saveBtn').disabled = !doc;
    $('saveBtn').classList.toggle('dirty', dirty);
  }

  updateCoords(world) {
    const doc = this.doc;
    if (!doc) return;
    const block = this.view.worldToBlock(world);
    if (!doc.inBounds(block.x, block.y)) { $('coords').textContent = `${block.x},${block.y} (utanför)`; return; }
    const value = doc.blockAt(block.x, block.y);
    const id = doc.codec.metatile(value);
    $('coords').textContent =
      `${block.x},${block.y}  mt 0x${id.toString(16).toUpperCase().padStart(3, '0')}` +
      `  koll ${doc.codec.collision(value)}  höjd ${doc.codec.elevation(value)}`;
  }

  async saveChanges() {
    const doc = this.doc;
    if (!doc) return;
    const written = doc.save();
    await this.persist();
    this.refreshDirtyState();
    this.toast(written.length
      ? `Sparat: ${written.map((p) => p.split('/').pop()).join(', ')}`
      : 'Inget nytt att spara');
  }

  async persist() {
    if (!this.project || !this.sourceBlob) return;
    await saveSession({
      name: this.projectName,
      blob: this.sourceBlob,
      dirty: [...this.project.dirty.entries()],
      lastMap: this.doc?.name ?? null,
      savedAt: Date.now(),
    });
  }

  async restoreSession() {
    const session = await loadSession();
    if (!session?.blob) return false;
    await this.loadProjectFromBlob(session.blob, session.name, {
      restoredDirty: session.dirty,
      restoreMap: session.lastMap,
    });
    if (session.dirty?.length) this.toast(`Återställde ${session.dirty.length} ändrade filer`);
    return true;
  }

  async forgetSession() {
    await clearSession();
    this.toast('Sparat projekt borttaget. Ändringar i minnet finns kvar tills du laddar om.');
  }

  async exportChanged() {
    const project = this.project;
    if (!project) return;
    if (this.doc?.isModified) this.doc.save();
    if (!project.dirty.size) { this.toast('Inga ändrade filer att exportera'); return; }
    this.loading('Packar ändringar…');
    try {
      const zip = new ZipWriter();
      for (const [path, bytes] of project.dirty) zip.add(path, bytes);
      const blob = await zip.toBlob();
      await this.deliver(blob, `${slug(this.projectName)}-andringar.zip`);
      this.toast(`Exporterade ${project.dirty.size} filer`);
    } catch (err) {
      this.fail(err);
    } finally {
      this.loading(null);
      this.refreshDirtyState();
    }
  }

  async exportAll() {
    const project = this.project;
    if (!project) return;
    if (this.doc?.isModified) this.doc.save();

    let total = 0;
    for (const entry of project.zip.entries.values()) total += entry.size;
    const mb = total / (1024 * 1024);
    if (mb > 300 && !confirm(
      `Projektet packar upp till ungefär ${Math.round(mb)} MB. ` +
      'Att bygga om hela arkivet i telefonen kan slut på minnet. Fortsätta ändå?')) return;

    this.loading('Packar hela projektet…');
    try {
      const zip = new ZipWriter();
      const names = project.zip.names();
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const relative = name.startsWith(project.root) ? name.slice(project.root.length) : name;
        const bytes = project.dirty.get(relative) ?? await project.zip.read(name);
        zip.add(name, bytes);
        if (i % 200 === 0) this.loading(`Packar ${i}/${names.length}…`);
      }
      const blob = await zip.toBlob();
      await this.deliver(blob, `${slug(this.projectName)}.zip`);
    } catch (err) {
      this.fail(err);
    } finally {
      this.loading(null);
    }
  }

  /** Hands the file to the OS: the share sheet on iOS, a download elsewhere. */
  async deliver(blob, filename) {
    const file = new File([blob], filename, { type: 'application/zip' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

function describeEvent(key, event) {
  if (key === 'object_events') return String(event.graphics_id || 'objekt').replace(/^OBJ_EVENT_GFX_/, '');
  if (key === 'warp_events') return `→ ${String(event.dest_map || '?').replace(/^MAP_/, '')}`;
  if (key === 'coord_events') return String(event.script || event.var || 'utlösare');
  return String(event.script || event.type || 'skylt');
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt';
}
