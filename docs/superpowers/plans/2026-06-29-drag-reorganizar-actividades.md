# Drag & Drop para reorganizar actividades — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar drag-and-drop en la vista semanal (modo edición) para mover actividades individuales o días completos a otro día, con flechas de navegación durante el drag y confirmación con selector de fecha editable.

**Architecture:** Se extiende el HTML5 Drag API ya existente en el proyecto. Un objeto global `weekDrag` mantiene el estado del drag activo. Al soltar sobre una columna de día, se abre un modal de confirmación con `<input type="date">` pre-cargado con el destino, editable. Las flechas de navegación semanal se muestran durante el drag y avanzan/retroceden la semana con un delay de 700 ms.

**Tech Stack:** Vanilla JS, HTML5 Drag API, CSS existente en `styles.css`.

## Global Constraints

- Solo activo cuando `_editorMode === true`
- No aplica a la vista mensual ni al modal de día
- En ambas vistas semanales (grid y lista)
- `dateKey(y, m, d)` usa mes 0-indexed y produce `"YYYY-MM-DD"` — mismo formato que `input[type=date]`, así que el valor del input es directamente usable como clave
- `shiftWeek(delta)` existe en app.js (línea 1999) y hace `renderWeekModal()` internamente
- No romper el click existente para abrir el modal de día

---

## Task 1: CSS — Estilos para drag, flechas y modal de confirmación

**Files:**
- Modify: `styles.css` (append al final, después de línea 915)

**Interfaces:**
- Produces: clases `.wdrag-source`, `.wdrag-over`, `.week-drag-arrow`, `.week-drag-arrow-prev`, `.week-drag-arrow-next`, `.wg-day-drag-handle`, `.move-confirm-overlay`, `.move-confirm-modal` y sus hijos

- [ ] **Step 1: Agregar CSS al final de styles.css**

Abrir `styles.css` y agregar después de la última línea (`}`):

```css

/* ── DRAG & DROP SEMANAL ────────────────────────────────────────────────── */

/* Columna origen durante drag (semi-transparente) */
.wdrag-source { opacity: 0.45; }

/* Columna/celda destino con hover */
.wdrag-over {
  background: rgba(212,232,90,0.08) !important;
  outline: 2px dashed rgba(212,232,90,0.5) !important;
  outline-offset: -2px;
  border-radius: 4px;
}

/* Handle para arrastrar día completo */
.wg-day-drag-handle {
  display: inline-block;
  cursor: grab;
  font-size: 14px;
  color: var(--muted);
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1;
  margin-left: 4px;
  vertical-align: middle;
  user-select: none;
}
.wg-day-drag-handle:hover { color: var(--text); background: rgba(255,255,255,0.06); }
.wg-day-drag-handle:active { cursor: grabbing; }

/* Elementos arrastrables en semana */
.wg-event[draggable="true"],
.wg-untimed-chip[draggable="true"],
.wl-task[draggable="true"] { cursor: grab; }
.wg-event[draggable="true"]:hover,
.wg-untimed-chip[draggable="true"]:hover,
.wl-task[draggable="true"]:hover { outline: 1px solid rgba(212,232,90,0.3); }
.wg-event.dragging,
.wg-untimed-chip.dragging,
.wl-task.dragging { opacity: 0.3; }

/* Flechas de navegación durante drag (superpuestas al week-modal) */
.week-modal { position: relative; } /* asegura contexto de posicionamiento */
.week-drag-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 200;
  display: none; /* mostradas en JS al inicio del drag */
  align-items: center;
  justify-content: center;
  background: rgba(20,20,28,0.95);
  border: 1px solid rgba(212,232,90,0.4);
  color: var(--accent);
  padding: 14px 6px;
  border-radius: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  cursor: default;
  pointer-events: all;
  transition: background 0.15s;
}
.week-drag-arrow:hover { background: rgba(212,232,90,0.12); }
.week-drag-arrow-prev { left: 4px; }
.week-drag-arrow-next { right: 4px; }

/* Modal de confirmación de movimiento */
.move-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.move-confirm-modal {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 24px;
  min-width: 300px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mcm-title {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: var(--text);
}
.mcm-name {
  font-size: 12px;
  color: var(--accent);
  font-family: 'DM Mono', monospace;
  padding: 6px 10px;
  background: rgba(212,232,90,0.08);
  border-radius: 6px;
  border-left: 3px solid var(--accent);
}
.mcm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: var(--muted);
}
.mcm-arrow { color: var(--accent); font-size: 14px; }
.mcm-date-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 5px 8px;
  outline: none;
}
.mcm-date-input:focus { border-color: var(--accent); }
.mcm-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}
.mcm-btn {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
  background: transparent;
  color: var(--muted);
  transition: all 0.15s;
}
.mcm-btn.confirm {
  background: rgba(212,232,90,0.12);
  border-color: rgba(212,232,90,0.4);
  color: var(--accent);
}
.mcm-btn:hover { opacity: 0.8; }
```

- [ ] **Step 2: Verificar visualmente**

Abrir el planner en el navegador, abrir DevTools → Elements, confirmar que las clases nuevas existen en `<head>` vía el link a `styles.css`. No debería haber errores en consola.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: clases CSS para drag-and-drop semanal y modal de confirmación"
```

---

## Task 2: HTML — Flechas de navegación y modal de confirmación

**Files:**
- Modify: `index.html` líneas 206–221 (dentro de `.week-modal`) y antes del `</body>` (línea 306)

**Interfaces:**
- Produces: elementos `#wda-prev`, `#wda-next` (flechas), `#move-confirm-overlay`, `#mcm-title`, `#mcm-name`, `#mcm-source-label`, `#mcm-target-date`

- [ ] **Step 1: Agregar flechas dentro de `.week-modal`**

En `index.html`, localizar (líneas 206–221):

```html
  <div class="week-modal">
    <div class="week-modal-header">
      <div class="week-modal-title" id="wm-title">Semana</div>
      <div class="week-modal-nav">
        <button class="day-nav-arrow" onclick="shiftWeek(-1)">◀</button>
        <button class="day-nav-arrow" onclick="shiftWeek(1)">▶</button>
        <button class="export-btn" id="wm-view-toggle" onclick="toggleWeekView()" title="Cambiar vista" style="padding:4px 10px;font-size:11px">⊞ Grid</button>
        <button class="export-btn" onclick="exportWeek('jpg')" title="Descargar JPG" style="padding:4px 10px;font-size:11px">⬇ JPG</button>
        <button class="export-btn" onclick="exportWeek('print')" title="PDF blanco para imprimir" style="padding:4px 10px;font-size:11px">🖨 Imprimir</button>
        <button class="export-btn" onclick="exportWeekPES()" title="Exportar datos para PES" style="padding:4px 10px;font-size:11px;color:#4dffd2;border-color:#4dffd2">⬇ PES</button>
        <button class="day-modal-close" onclick="closeWeekModal()">✕</button>
      </div>
    </div>
    <div class="week-modal-body" id="wm-body"></div>
  </div>
```

Reemplazar con:

```html
  <div class="week-modal">
    <div class="week-modal-header">
      <div class="week-modal-title" id="wm-title">Semana</div>
      <div class="week-modal-nav">
        <button class="day-nav-arrow" onclick="shiftWeek(-1)">◀</button>
        <button class="day-nav-arrow" onclick="shiftWeek(1)">▶</button>
        <button class="export-btn" id="wm-view-toggle" onclick="toggleWeekView()" title="Cambiar vista" style="padding:4px 10px;font-size:11px">⊞ Grid</button>
        <button class="export-btn" onclick="exportWeek('jpg')" title="Descargar JPG" style="padding:4px 10px;font-size:11px">⬇ JPG</button>
        <button class="export-btn" onclick="exportWeek('print')" title="PDF blanco para imprimir" style="padding:4px 10px;font-size:11px">🖨 Imprimir</button>
        <button class="export-btn" onclick="exportWeekPES()" title="Exportar datos para PES" style="padding:4px 10px;font-size:11px;color:#4dffd2;border-color:#4dffd2">⬇ PES</button>
        <button class="day-modal-close" onclick="closeWeekModal()">✕</button>
      </div>
    </div>
    <button class="week-drag-arrow week-drag-arrow-prev" id="wda-prev"
      ondragenter="onWeekDragArrowEnter(event,-1)" ondragleave="onWeekDragArrowLeave()">
      ◀ SEM ANT
    </button>
    <button class="week-drag-arrow week-drag-arrow-next" id="wda-next"
      ondragenter="onWeekDragArrowEnter(event,1)" ondragleave="onWeekDragArrowLeave()">
      SEM SIG ▶
    </button>
    <div class="week-modal-body" id="wm-body"></div>
  </div>
```

- [ ] **Step 2: Agregar modal de confirmación antes de `</body>`**

En `index.html`, localizar (líneas 304–306):

```html
<button id="editor-unlock" onclick="toggleEditorMode()" title=""></button>
<script src="app.js" defer></script>
</body>
```

Reemplazar con:

```html
<button id="editor-unlock" onclick="toggleEditorMode()" title=""></button>

<!-- ── MOVE CONFIRM MODAL ──────────────────────────────────────────────── -->
<div class="move-confirm-overlay" id="move-confirm-overlay" style="display:none" onclick="onMoveOverlayClick(event)">
  <div class="move-confirm-modal">
    <div class="mcm-title" id="mcm-title">Mover actividad</div>
    <div class="mcm-name" id="mcm-name"></div>
    <div class="mcm-row">
      <span id="mcm-source-label"></span>
      <span class="mcm-arrow">→</span>
      <input type="date" id="mcm-target-date" class="mcm-date-input">
    </div>
    <div class="mcm-buttons">
      <button class="mcm-btn cancel" onclick="closeMoveConfirmModal()">Cancelar</button>
      <button class="mcm-btn confirm" onclick="confirmMoveModal()">Confirmar →</button>
    </div>
  </div>
</div>

<script src="app.js" defer></script>
</body>
```

- [ ] **Step 3: Verificar estructura HTML**

Abrir DevTools → Elements y confirmar:
- `#wda-prev` y `#wda-next` existen como hijos de `.week-modal`
- `#move-confirm-overlay` existe al final del body
- No hay errores de sintaxis en la consola

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: HTML para flechas de navegación drag y modal de confirmación de movimiento"
```

---

## Task 3: JS — Estado global y funciones utilitarias

**Files:**
- Modify: `app.js`
  - Línea 7: agregar `weekDrag` state
  - Después de línea 1192 (`function removePlacement...`): agregar todas las funciones utilitarias

**Interfaces:**
- Produces:
  - `weekDrag: { active: boolean, taskId: number|null, sourceKey: string|null, moveAll: boolean }`
  - `_weekDragArrowTimer: number|null`
  - `showWeekDragArrows(): void`
  - `hideWeekDragArrows(): void`
  - `onWeekDragArrowEnter(e: DragEvent, delta: number): void`
  - `onWeekDragArrowLeave(): void`
  - `fmtDateFromKey(key: string): string` — "2026-06-29" → "29 Junio 2026"
  - `openMoveConfirmModal(targetKey: string): void`
  - `closeMoveConfirmModal(): void`
  - `onMoveOverlayClick(e: MouseEvent): void`
  - `confirmMoveModal(): void`
  - `executeMoveTask(taskId: number, sourceKey: string, targetKey: string): void`
  - `executeMoveDay(sourceKey: string, targetKey: string): void`

- [ ] **Step 1: Agregar `weekDrag` en la línea de estado (línea 7)**

En `app.js`, localizar la línea 7:

```js
let calDrag = { active: false, startY: null, startM: null, startD: null };
```

Reemplazar con:

```js
let calDrag = { active: false, startY: null, startM: null, startD: null };
let weekDrag = { active: false, taskId: null, sourceKey: null, moveAll: false };
let _weekDragArrowTimer = null;
```

- [ ] **Step 2: Agregar funciones utilitarias después de `removePlacement`**

En `app.js`, localizar la línea 1192:

```js
function removePlacement(id){placements=placements.filter(p=>p.id!==id);renderCalendar();renderLegend();persist();}
```

Agregar DESPUÉS de esa línea (insertar el bloque siguiente):

```js

// ── WEEK DRAG & DROP ─────────────────────────────────────────────────────────

function showWeekDragArrows() {
  const prev = document.getElementById('wda-prev');
  const next = document.getElementById('wda-next');
  if (prev) prev.style.display = 'flex';
  if (next) next.style.display = 'flex';
}

function hideWeekDragArrows() {
  const prev = document.getElementById('wda-prev');
  const next = document.getElementById('wda-next');
  if (prev) prev.style.display = 'none';
  if (next) next.style.display = 'none';
  if (_weekDragArrowTimer !== null) {
    clearTimeout(_weekDragArrowTimer);
    _weekDragArrowTimer = null;
  }
}

function onWeekDragArrowEnter(e, delta) {
  e.preventDefault();
  if (_weekDragArrowTimer !== null) return;
  _weekDragArrowTimer = setTimeout(() => {
    _weekDragArrowTimer = null;
    if (weekDrag.active && weekModal.open) shiftWeek(delta);
  }, 700);
}

function onWeekDragArrowLeave() {
  if (_weekDragArrowTimer !== null) {
    clearTimeout(_weekDragArrowTimer);
    _weekDragArrowTimer = null;
  }
}

function fmtDateFromKey(key) {
  // key is "YYYY-MM-DD"
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function openMoveConfirmModal(targetKey) {
  const titleEl = document.getElementById('mcm-title');
  const nameEl  = document.getElementById('mcm-name');
  const srcEl   = document.getElementById('mcm-source-label');
  const dateIn  = document.getElementById('mcm-target-date');

  if (weekDrag.moveAll) {
    const tasks = dayTasks[weekDrag.sourceKey] || [];
    titleEl.textContent = 'Mover día completo';
    nameEl.textContent  = tasks.length + ' actividad' + (tasks.length !== 1 ? 'es' : '');
  } else {
    const tasks = dayTasks[weekDrag.sourceKey] || [];
    const task  = tasks.find(t => t.id === weekDrag.taskId);
    titleEl.textContent = 'Mover actividad';
    nameEl.textContent  = task ? task.name : '';
  }

  srcEl.textContent = fmtDateFromKey(weekDrag.sourceKey);
  dateIn.value      = targetKey;

  document.getElementById('move-confirm-overlay').style.display = 'flex';
}

function closeMoveConfirmModal() {
  document.getElementById('move-confirm-overlay').style.display = 'none';
}

function onMoveOverlayClick(e) {
  if (e.target === document.getElementById('move-confirm-overlay')) closeMoveConfirmModal();
}

function confirmMoveModal() {
  const targetKey = document.getElementById('mcm-target-date').value;
  if (!targetKey) return;
  if (weekDrag.moveAll) {
    executeMoveDay(weekDrag.sourceKey, targetKey);
  } else {
    executeMoveTask(weekDrag.taskId, weekDrag.sourceKey, targetKey);
  }
  closeMoveConfirmModal();
}

function executeMoveTask(taskId, sourceKey, targetKey) {
  const src = dayTasks[sourceKey] || [];
  const idx = src.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const [task] = src.splice(idx, 1);
  dayTasks[sourceKey] = src;
  if (!dayTasks[targetKey]) dayTasks[targetKey] = [];
  dayTasks[targetKey].push(task);
  persist();
  if (weekModal.open) renderWeekModal();
  renderCalendar();
}

function executeMoveDay(sourceKey, targetKey) {
  const src = dayTasks[sourceKey] || [];
  if (!dayTasks[targetKey]) dayTasks[targetKey] = [];
  dayTasks[targetKey].push(...src);
  dayTasks[sourceKey] = [];
  persist();
  if (weekModal.open) renderWeekModal();
  renderCalendar();
}
```

- [ ] **Step 3: Verificar en consola**

Abrir la app en el navegador, abrir consola y ejecutar:

```js
typeof weekDrag        // debe imprimir "object"
typeof executeMoveTask // debe imprimir "function"
typeof executeMoveDay  // debe imprimir "function"
typeof showWeekDragArrows // debe imprimir "function"
```

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: estado weekDrag y funciones utilitarias de movimiento de actividades"
```

---

## Task 4: JS — Drag en `renderWeekGridView`

**Files:**
- Modify: `app.js`, función `renderWeekGridView` (líneas ~2123–2306)

**Interfaces:**
- Consumes: `weekDrag` (Task 3), `showWeekDragArrows()` (Task 3), `hideWeekDragArrows()` (Task 3), `openMoveConfirmModal(targetKey)` (Task 3), `_editorMode` (línea 1920), `dateKey` (línea 563)
- Produces: eventos arrastrables en vista grid, columnas como drop zones, handle de día completo en headers

- [ ] **Step 1: Agregar drag handle en encabezados de día (dentro del `days.forEach` del header)**

En `app.js`, localizar en `renderWeekGridView` el bloque de encabezados de días (línea ~2182):

```js
  days.forEach(d => {
    const isToday = d.dt.getTime() === today.getTime();
    const th = document.createElement('div');
    th.className = 'wg-day-header';
    th.style.flex = '1';
    th.innerHTML = `<div class="wg-day-name">${DAY_NAMES[d.dt.getDay()]}</div>
      <div class="wg-day-num${isToday ? ' today' : ''}">${d.dt.getDate()}</div>`;
    th.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
    headerRow.appendChild(th);
  });
```

Reemplazar con:

```js
  days.forEach(d => {
    const isToday = d.dt.getTime() === today.getTime();
    const hdrKey = dateKey(d.dt.getFullYear(), d.dt.getMonth(), d.dt.getDate());
    const th = document.createElement('div');
    th.className = 'wg-day-header';
    th.style.flex = '1';
    th.innerHTML = `<div class="wg-day-name">${DAY_NAMES[d.dt.getDay()]}</div>
      <div class="wg-day-num${isToday ? ' today' : ''}">${d.dt.getDate()}</div>`;
    th.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
    if (_editorMode) {
      const handle = document.createElement('span');
      handle.className = 'wg-day-drag-handle';
      handle.title = 'Mover día completo';
      handle.textContent = '⠿';
      handle.draggable = true;
      handle.addEventListener('dragstart', e => {
        weekDrag.active   = true;
        weekDrag.taskId   = null;
        weekDrag.sourceKey = hdrKey;
        weekDrag.moveAll  = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'day:' + hdrKey);
        showWeekDragArrows();
      });
      handle.addEventListener('dragend', () => {
        weekDrag.active = false;
        hideWeekDragArrows();
      });
      th.appendChild(handle);
    }
    headerRow.appendChild(th);
  });
```

- [ ] **Step 2: Agregar drag a los chips sin hora (dentro del `days.forEach` de la untimed strip)**

Localizar en `renderWeekGridView` (línea ~2202):

```js
      d.untimed.forEach(({ t, origIdx }) => {
        const color = getTaskColor(t, COLORS[origIdx % COLORS.length]);
        const chip = document.createElement('div');
        chip.className = 'wg-untimed-chip' + (taskMatchesFilter(t) ? ' task-filtered' : '');
        chip.style.cssText = `background:${color}18;border-color:${color}`;
        chip.textContent = t.name;
        chip.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
        cell.appendChild(chip);
      });
```

Reemplazar con:

```js
      const untimedKey = dateKey(d.dt.getFullYear(), d.dt.getMonth(), d.dt.getDate());
      d.untimed.forEach(({ t, origIdx }) => {
        const color = getTaskColor(t, COLORS[origIdx % COLORS.length]);
        const chip = document.createElement('div');
        chip.className = 'wg-untimed-chip' + (taskMatchesFilter(t) ? ' task-filtered' : '');
        chip.style.cssText = `background:${color}18;border-color:${color}`;
        chip.textContent = t.name;
        chip.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
        if (_editorMode) {
          chip.draggable = true;
          chip.addEventListener('dragstart', e => {
            weekDrag.active    = true;
            weekDrag.taskId    = t.id;
            weekDrag.sourceKey = untimedKey;
            weekDrag.moveAll   = false;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(t.id));
            showWeekDragArrows();
            setTimeout(() => chip.classList.add('dragging'), 0);
          });
          chip.addEventListener('dragend', () => {
            chip.classList.remove('dragging');
            weekDrag.active = false;
            hideWeekDragArrows();
          });
        }
        cell.appendChild(chip);
      });
```

También agregar drop zone en la untimed cell. Localizar justo antes del `forEach` de untimed (donde se crea `cell`):

```js
      const cell = document.createElement('div');
      cell.className = 'wg-untimed-cell';
```

Reemplazar con:

```js
      const cell = document.createElement('div');
      cell.className = 'wg-untimed-cell';
      const untimedDropKey = dateKey(d.dt.getFullYear(), d.dt.getMonth(), d.dt.getDate());
      if (_editorMode) {
        cell.addEventListener('dragover', e => { if (!weekDrag.active) return; e.preventDefault(); cell.classList.add('wdrag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('wdrag-over'));
        cell.addEventListener('drop', e => { e.preventDefault(); cell.classList.remove('wdrag-over'); if (weekDrag.active) openMoveConfirmModal(untimedDropKey); });
      }
```

- [ ] **Step 3: Agregar drag a eventos timed y drop zone a columnas**

Localizar en `renderWeekGridView` el bloque de columnas de días (línea ~2268):

```js
  days.forEach(d => {
    const col = document.createElement('div');
    col.className = 'wg-day-col';
```

Reemplazar con:

```js
  days.forEach(d => {
    const col = document.createElement('div');
    col.className = 'wg-day-col';
    const colKey = dateKey(d.dt.getFullYear(), d.dt.getMonth(), d.dt.getDate());
    if (_editorMode) {
      col.addEventListener('dragover', e => { if (!weekDrag.active) return; e.preventDefault(); col.classList.add('wdrag-over'); });
      col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('wdrag-over'); });
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('wdrag-over'); if (weekDrag.active) openMoveConfirmModal(colKey); });
    }
```

Luego, localizar donde se crea cada evento (línea ~2287):

```js
      ev.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
      col.appendChild(ev);
```

Reemplazar con:

```js
      if (_editorMode) {
        ev.draggable = true;
        ev.addEventListener('dragstart', e => {
          e.stopPropagation();
          weekDrag.active    = true;
          weekDrag.taskId    = o.t.id;
          weekDrag.sourceKey = colKey;
          weekDrag.moveAll   = false;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(o.t.id));
          showWeekDragArrows();
          setTimeout(() => ev.classList.add('dragging'), 0);
        });
        ev.addEventListener('dragend', () => {
          ev.classList.remove('dragging');
          weekDrag.active = false;
          hideWeekDragArrows();
        });
      }
      ev.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
      col.appendChild(ev);
```

- [ ] **Step 4: Probar vista grid**

1. Activar modo editor (botón de candado).
2. Abrir vista semanal → cambiar a vista Grid (⊞ Grid).
3. Verificar que aparece `⠿` en los headers de día.
4. Arrastrar un evento: debe aparecer semi-transparente (`.dragging`).
5. Al hover sobre otra columna: debe aparecer outline amarillo.
6. Al soltar: debe aparecer el modal de confirmación con la fecha pre-cargada.
7. Probar Cancelar: sin cambios.
8. Probar Confirmar: la actividad debe desaparecer del día origen y aparecer en el destino.
9. Verificar drag del handle `⠿`: el modal debe decir "Mover día completo".

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: drag-and-drop en vista semanal grid (actividades individuales y día completo)"
```

---

## Task 5: JS — Drag en `renderWeekListView`

**Files:**
- Modify: `app.js`, función `renderWeekListView` (líneas ~2029–2117)

**Interfaces:**
- Consumes: `weekDrag` (Task 3), `showWeekDragArrows()` (Task 3), `hideWeekDragArrows()` (Task 3), `openMoveConfirmModal(targetKey)` (Task 3), `_editorMode`, `dateKey`
- Produces: chips `.wl-task` arrastrables, headers `.wl-day-header` como drop zones, handle `⠿` en headers

- [ ] **Step 1: Agregar drag handle y drop zone a headers de día**

En `renderWeekListView`, localizar el bloque de headers de día (línea ~2058):

```js
  days.forEach(d => {
    const isToday = d.dt.getTime() === today.getTime();
    const h = document.createElement('div');
    h.className = 'wl-day-header';
    h.innerHTML = `<div class="week-day-name">${DAY_NAMES[d.dt.getDay()]}</div>
      <div class="week-day-num${isToday ? ' today' : ''}">${d.dt.getDate()}</div>`;
    h.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
    matrix.appendChild(h);
  });
```

Reemplazar con:

```js
  days.forEach(d => {
    const isToday = d.dt.getTime() === today.getTime();
    const listHdrKey = dateKey(d.dt.getFullYear(), d.dt.getMonth(), d.dt.getDate());
    const h = document.createElement('div');
    h.className = 'wl-day-header';
    h.innerHTML = `<div class="week-day-name">${DAY_NAMES[d.dt.getDay()]}</div>
      <div class="week-day-num${isToday ? ' today' : ''}">${d.dt.getDate()}</div>`;
    h.addEventListener('click', () => { closeWeekModal(); openDayModal(d.dt); });
    if (_editorMode) {
      const handle = document.createElement('span');
      handle.className = 'wg-day-drag-handle';
      handle.title = 'Mover día completo';
      handle.textContent = '⠿';
      handle.draggable = true;
      handle.addEventListener('dragstart', e => {
        weekDrag.active    = true;
        weekDrag.taskId    = null;
        weekDrag.sourceKey = listHdrKey;
        weekDrag.moveAll   = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'day:' + listHdrKey);
        showWeekDragArrows();
      });
      handle.addEventListener('dragend', () => {
        weekDrag.active = false;
        hideWeekDragArrows();
      });
      h.appendChild(handle);
      h.addEventListener('dragover', e => { if (!weekDrag.active) return; e.preventDefault(); h.classList.add('wdrag-over'); });
      h.addEventListener('dragleave', () => h.classList.remove('wdrag-over'));
      h.addEventListener('drop', e => { e.preventDefault(); h.classList.remove('wdrag-over'); if (weekDrag.active) openMoveConfirmModal(listHdrKey); });
    }
    matrix.appendChild(h);
  });
```

- [ ] **Step 2: Hacer draggables las filas `.wl-task` dentro de `makeCell`**

En `renderWeekListView`, localizar la función `makeCell` (línea ~2068):

```js
  const makeCell = (dayObj, predicate) => {
    const cell = document.createElement('div');
    cell.className = 'wl-cell';
    dayObj.tasks.forEach((t, ti) => {
      if (!predicate(t)) return;
      const color = getTaskColor(t, COLORS[ti % COLORS.length]);
      const row = document.createElement('div');
      row.className = 'wl-task' + (taskMatchesFilter(t) ? ' task-filtered' : '');
      row.style.borderLeft = `3px solid ${color}`;
      row.style.background = color + '0f';
      const timeTxt = t.hasta ? `${formatearHora(t.desde)}–${formatearHora(t.hasta)}`
                              : (t.desde ? formatearHora(t.desde) : '');
      row.innerHTML = `
        <div class="week-task-name">${esc(t.name)}</div>
        ${timeTxt ? `<div class="week-task-time">${timeTxt}</div>` : ''}
        ${(t.responsable || t.apoyos) ? `<div class="week-task-people">${[t.responsable, t.apoyos].filter(Boolean).join(' · ')}</div>` : ''}`;
      row.addEventListener('click', () => { closeWeekModal(); openDayModal(dayObj.dt); });
      cell.appendChild(row);
    });
    return cell;
  };
```

Reemplazar con:

```js
  const makeCell = (dayObj, predicate) => {
    const cell = document.createElement('div');
    cell.className = 'wl-cell';
    const cellKey = dateKey(dayObj.dt.getFullYear(), dayObj.dt.getMonth(), dayObj.dt.getDate());
    if (_editorMode) {
      cell.addEventListener('dragover', e => { if (!weekDrag.active) return; e.preventDefault(); cell.classList.add('wdrag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('wdrag-over'));
      cell.addEventListener('drop', e => { e.preventDefault(); cell.classList.remove('wdrag-over'); if (weekDrag.active) openMoveConfirmModal(cellKey); });
    }
    dayObj.tasks.forEach((t, ti) => {
      if (!predicate(t)) return;
      const color = getTaskColor(t, COLORS[ti % COLORS.length]);
      const row = document.createElement('div');
      row.className = 'wl-task' + (taskMatchesFilter(t) ? ' task-filtered' : '');
      row.style.borderLeft = `3px solid ${color}`;
      row.style.background = color + '0f';
      const timeTxt = t.hasta ? `${formatearHora(t.desde)}–${formatearHora(t.hasta)}`
                              : (t.desde ? formatearHora(t.desde) : '');
      row.innerHTML = `
        <div class="week-task-name">${esc(t.name)}</div>
        ${timeTxt ? `<div class="week-task-time">${timeTxt}</div>` : ''}
        ${(t.responsable || t.apoyos) ? `<div class="week-task-people">${[t.responsable, t.apoyos].filter(Boolean).join(' · ')}</div>` : ''}`;
      if (_editorMode) {
        row.draggable = true;
        row.addEventListener('dragstart', e => {
          e.stopPropagation();
          weekDrag.active    = true;
          weekDrag.taskId    = t.id;
          weekDrag.sourceKey = cellKey;
          weekDrag.moveAll   = false;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(t.id));
          showWeekDragArrows();
          setTimeout(() => row.classList.add('dragging'), 0);
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          weekDrag.active = false;
          hideWeekDragArrows();
        });
      }
      row.addEventListener('click', () => { closeWeekModal(); openDayModal(dayObj.dt); });
      cell.appendChild(row);
    });
    return cell;
  };
```

- [ ] **Step 3: Probar vista lista**

1. Con modo editor activo, abrir vista semanal en modo Lista (☰ Lista).
2. Verificar que aparece `⠿` en los headers de día.
3. Arrastrar una actividad sobre otro día: el header o celda destino debe resaltarse.
4. Al soltar: aparece el modal de confirmación.
5. Confirmar: la actividad se mueve y la vista se re-renderiza.
6. Probar con drag del handle `⠿`: mueve todas las actividades del día.
7. Probar las flechas `◀ SEM ANT` / `SEM SIG ▶` durante un drag: deben aparecer y, al mantener el cursor sobre ellas por ~700ms, cambiar la semana.

- [ ] **Step 4: Commit final**

```bash
git add app.js
git commit -m "feat: drag-and-drop en vista semanal lista + flechas de navegación entre semanas"
```

---

## Self-Review

**Spec coverage:**
- ✅ Drag en vista semanal (grid y lista) — Tasks 4 y 5
- ✅ Arrastrar actividad individual — Tasks 4 y 5
- ✅ Arrastrar día completo — Tasks 4 y 5 (handle `⠿`)
- ✅ Flechas de navegación durante drag — Task 2 (HTML) + Task 3 (JS)
- ✅ Auto-advance con 700ms delay — Task 3 (`onWeekDragArrowEnter`)
- ✅ Modal de confirmación — Task 2 (HTML) + Task 3 (JS)
- ✅ Fecha destino editable — Task 2 (`<input type="date">`) + Task 3 (`confirmMoveModal`)
- ✅ Solo en `_editorMode` — todas las condiciones tienen `if (_editorMode)`
- ✅ Merge (append) si destino tiene tareas — `executeMoveTask` / `executeMoveDay` usan `push`
- ✅ `persist()` + `renderWeekModal()` + `renderCalendar()` en cada mutación — Task 3

**Placeholder scan:** Ninguno.

**Type consistency:** `weekDrag.sourceKey` siempre es string `"YYYY-MM-DD"` producido por `dateKey`. `weekDrag.taskId` siempre es `number` (id de task). `targetKey` en `executeMoveTask`/`executeMoveDay` es string `"YYYY-MM-DD"` (valor de `input[type=date]`). Consistente en todos los tasks.
