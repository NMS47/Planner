# Calendario personal oculto ("nosotros") — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un segundo calendario ("personal", slug `nosotros`) accesible solo vía `?p=nosotros` en la URL, invisible en toda navegación normal, que comparte el mismo `planboard-data.json` público pero en un bucket de datos aislado (`cards`, `placements`, `idCounter`, `dayTasks` propios, sin panel de materias).

**Architecture:** `planboard-data.json` gana una clave opcional `personal` con la misma forma que los datos de trabajo top-level. Al bootear, `app.js` resuelve una variable `activeProject` (`'work'` | `'personal'`) leyendo `?p=nosotros` de la URL o `sessionStorage` (persiste mientras la pestaña esté abierta, nunca entre pestañas nuevas). Dos funciones puras (`extractProjectBucket` / `mergeProjectBucket`) leen y escriben el bucket correcto sin tocar el otro. El guardado a GitHub hace `GET` del archivo remoto completo antes de `PUT` para nunca pisar el bucket inactivo.

**Tech Stack:** Vanilla JS (sin build, sin test runner), `sessionStorage`, `localStorage`, GitHub Contents API.

## Global Constraints

- Slug fijo y único: `nosotros` (parámetro `?p=nosotros`). No se construye un selector ni un sistema genérico de múltiples proyectos.
- El calendario personal NO tiene panel de materias/filtro — el ítem de menú correspondiente se oculta en modo personal.
- Nivel de secreto aceptado explícitamente por el usuario: ocultar de la navegación casual únicamente. Sin encriptación, sin repo privado. El código y el JSON siguen siendo públicos.
- `sessionStorage` (no `localStorage`) para recordar el proyecto activo — así una pestaña/ventana nueva sin el parámetro siempre cae en `'work'`.
- Un `planboard-data.json` remoto sin la clave `personal` debe seguir funcionando exactamente igual que hoy (retrocompatibilidad total con el archivo actual).
- Guardar en GitHub desde un proyecto nunca debe sobreescribir los datos del otro proyecto en el mismo archivo.
- No hay test runner en el proyecto — la verificación de funciones puras se hace pegando `console.assert(...)` en la consola del navegador (mismo patrón ya usado en `docs/superpowers/plans/2026-06-29-drag-reorganizar-actividades.md`); la verificación de flujo completo (fetch/DOM/GitHub) es manual en el navegador.

---

## Task 1: HTML — Indicador de modo personal y link de salida

**Files:**
- Modify: `index.html` líneas 28–32 (header, después de `#sync-status`) y línea 55 (ítem de menú de materias)

**Interfaces:**
- Produces: `#personal-mode-indicator` (oculto por defecto), `#hm-filter-materia` (id nuevo en el botón existente de filtro por materia)

- [ ] **Step 1: Agregar el indicador de modo personal en el header**

En `index.html`, localizar (líneas 28–32):

```html
  <div id="sync-status" style="font-size:10px;font-family:'DM Mono',monospace;padding:3px 10px;border-radius:20px;border:1px solid var(--border);color:var(--muted);display:flex;align-items:center;gap:5px">
    <span id="sync-dot" style="width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block"></span>
    <span id="sync-text">Cargando...</span>
  </div>
  <div class="hdr-right">
```

Reemplazar con:

```html
  <div id="sync-status" style="font-size:10px;font-family:'DM Mono',monospace;padding:3px 10px;border-radius:20px;border:1px solid var(--border);color:var(--muted);display:flex;align-items:center;gap:5px">
    <span id="sync-dot" style="width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block"></span>
    <span id="sync-text">Cargando...</span>
  </div>
  <div id="personal-mode-indicator" style="display:none;font-size:10px;font-family:'DM Mono',monospace;padding:3px 10px;border-radius:20px;border:1px solid var(--border);color:var(--accent);align-items:center;gap:8px">
    <span>Nosotros</span>
    <a href="#" onclick="exitPersonalMode();return false;" style="color:var(--muted);text-decoration:underline">← Volver a trabajo</a>
  </div>
  <div class="hdr-right">
```

- [ ] **Step 2: Agregar id al ítem de menú de filtro por materia**

En `index.html`, localizar (línea 55):

```html
        <button class="hm-item" onclick="openFilterModal();closeHamburger()">🔍 Filtrar por materia</button>
```

Reemplazar con:

```html
        <button class="hm-item" id="hm-filter-materia" onclick="openFilterModal();closeHamburger()">🔍 Filtrar por materia</button>
```

- [ ] **Step 3: Verificar estructura HTML**

Abrir `index.html` en el navegador (o DevTools → Elements) y confirmar:
- `#personal-mode-indicator` existe en el header, con `style="display:none..."`.
- `#hm-filter-materia` existe como id del botón "🔍 Filtrar por materia".
- No hay errores de sintaxis en la consola.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: HTML para indicador de calendario personal oculto"
```

---

## Task 2: JS — Resolución de proyecto activo

**Files:**
- Modify: `app.js` — insertar después de la línea 11 (`let dayModal = { open: false, y: null, m: null, d: null, editMode: false };`)
- Modify: `app.js` — dentro del listener `DOMContentLoaded` (buscar `loadMaterias();`, línea ~2060)

**Interfaces:**
- Produces:
  - `activeProject: 'work' | 'personal'` (variable de módulo)
  - `resolveActiveProject(search: string, storedProject: string|null): 'work'|'personal'`
  - `getCacheKey(): string` — `'planboard_cache'` o `'planboard_cache_personal'`
  - `exitPersonalMode(): void`

- [ ] **Step 1: Agregar resolución de `activeProject` después de la línea 11**

En `app.js`, localizar la línea 11:

```js
let dayModal = { open: false, y: null, m: null, d: null, editMode: false };
```

Agregar DESPUÉS de esa línea (insertar el bloque siguiente):

```js

// ── PROYECTO ACTIVO (work / personal) ──────────────────────────────────────────
// El calendario personal ("nosotros") es un segundo bucket de datos, oculto de
// toda navegación normal. Solo se activa con ?p=nosotros en la URL, o si ya
// estaba activo en esta misma pestaña (sessionStorage). Una pestaña nueva sin
// el parámetro siempre vuelve a 'work'.
function resolveActiveProject(search, storedProject) {
  const params = new URLSearchParams(search);
  if (params.get('p') === 'nosotros') return 'personal';
  if (storedProject === 'personal') return 'personal';
  return 'work';
}

let activeProject = resolveActiveProject(location.search, sessionStorage.getItem('planboard_active_project'));
if (activeProject === 'personal') {
  try { sessionStorage.setItem('planboard_active_project', 'personal'); } catch(e) {}
}

function getCacheKey() {
  return activeProject === 'personal' ? 'planboard_cache_personal' : 'planboard_cache';
}

function exitPersonalMode() {
  try { sessionStorage.removeItem('planboard_active_project'); } catch(e) {}
  location.href = location.pathname;
}
```

- [ ] **Step 2: Mostrar el indicador y ocultar el filtro de materias en modo personal**

En `app.js`, localizar dentro de `document.addEventListener('DOMContentLoaded', ...)` (buscar el texto exacto, línea ~2060 antes de este cambio):

```js
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('readonly');
  if (typeof sidebarOpen !== 'undefined' && sidebarOpen) toggleSidebar();
  loadMaterias();
  loadMateriaResponsables();
  renderQuickChips();
```

Reemplazar con:

```js
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('readonly');
  if (typeof sidebarOpen !== 'undefined' && sidebarOpen) toggleSidebar();
  loadMaterias();
  loadMateriaResponsables();
  renderQuickChips();

  if (activeProject === 'personal') {
    document.title = 'Nosotros';
    const hm = document.getElementById('hm-filter-materia');
    if (hm) hm.style.display = 'none';
    const ind = document.getElementById('personal-mode-indicator');
    if (ind) ind.style.display = 'flex';
  }
```

- [ ] **Step 3: Verificar en consola**

Abrir el planner sin parámetro (`index.html`), abrir la consola y ejecutar:

```js
typeof resolveActiveProject   // "function"
typeof exitPersonalMode       // "function"
activeProject                 // "work"
getCacheKey()                 // "planboard_cache"
resolveActiveProject('?p=nosotros', null)   // "personal"
resolveActiveProject('', 'personal')        // "personal"
resolveActiveProject('', null)              // "work"
resolveActiveProject('?p=otracosa', null)   // "work"
```

Todos los resultados deben coincidir con el comentario. Después, abrir el planner con `index.html?p=nosotros`: el título de la pestaña debe cambiar a "Nosotros", debe aparecer el indicador "Nosotros · ← Volver a trabajo" en el header, y el ítem "🔍 Filtrar por materia" no debe estar en el menú hamburguesa. Click en "← Volver a trabajo" debe recargar la página sin el parámetro y sin el indicador.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: resolucion de proyecto activo (work/personal) via ?p=nosotros"
```

---

## Task 3: JS — Funciones puras de bucket de datos

**Files:**
- Modify: `app.js` — insertar inmediatamente después de la función `exitPersonalMode` agregada en el Task 2

**Interfaces:**
- Consumes: nada (funciones puras, sin dependencias externas)
- Produces:
  - `extractProjectBucket(fullData: object, project: 'work'|'personal'): {cards, placements, idCounter, dayTasks}`
  - `mergeProjectBucket(fullData: object, project: 'work'|'personal', bucket: {cards, placements, idCounter, dayTasks}): object`

- [ ] **Step 1: Agregar las funciones de bucket**

En `app.js`, localizar el final de la función agregada en el Task 2:

```js
function exitPersonalMode() {
  try { sessionStorage.removeItem('planboard_active_project'); } catch(e) {}
  location.href = location.pathname;
}
```

Agregar DESPUÉS de esa función:

```js

function extractProjectBucket(fullData, project) {
  const data = (fullData && typeof fullData === 'object') ? fullData : {};
  if (project === 'personal') {
    const p = (data.personal && typeof data.personal === 'object') ? data.personal : {};
    return {
      cards: p.cards || [],
      placements: p.placements || [],
      idCounter: p.idCounter || 0,
      dayTasks: p.dayTasks || {}
    };
  }
  return {
    cards: data.cards || [],
    placements: data.placements || [],
    idCounter: data.idCounter || 0,
    dayTasks: data.dayTasks || {}
  };
}

function mergeProjectBucket(fullData, project, bucket) {
  const data = (fullData && typeof fullData === 'object') ? { ...fullData } : {};
  if (project === 'personal') {
    data.personal = {
      cards: bucket.cards,
      placements: bucket.placements,
      idCounter: bucket.idCounter,
      dayTasks: bucket.dayTasks
    };
  } else {
    data.cards = bucket.cards;
    data.placements = bucket.placements;
    data.idCounter = bucket.idCounter;
    data.dayTasks = bucket.dayTasks;
  }
  return data;
}
```

- [ ] **Step 2: Verificar en consola**

Abrir el planner en el navegador, abrir la consola y pegar:

```js
console.assert(JSON.stringify(extractProjectBucket({cards:[1]}, 'work')) === JSON.stringify({cards:[1],placements:[],idCounter:0,dayTasks:{}}), 'FALLA: extractProjectBucket work');
console.assert(JSON.stringify(extractProjectBucket({personal:{cards:[2]}}, 'personal')) === JSON.stringify({cards:[2],placements:[],idCounter:0,dayTasks:{}}), 'FALLA: extractProjectBucket personal');
console.assert(JSON.stringify(extractProjectBucket({}, 'personal')) === JSON.stringify({cards:[],placements:[],idCounter:0,dayTasks:{}}), 'FALLA: extractProjectBucket personal vacio');
console.assert(JSON.stringify(mergeProjectBucket({cards:[1],other:'x'}, 'personal', {cards:[9],placements:[],idCounter:1,dayTasks:{}})) === JSON.stringify({cards:[1],other:'x',personal:{cards:[9],placements:[],idCounter:1,dayTasks:{}}}), 'FALLA: mergeProjectBucket personal no preserva work');
console.assert(JSON.stringify(mergeProjectBucket({personal:{cards:[9]}}, 'work', {cards:[5],placements:[],idCounter:2,dayTasks:{}})) === JSON.stringify({personal:{cards:[9]},cards:[5],placements:[],idCounter:2,dayTasks:{}}), 'FALLA: mergeProjectBucket work no preserva personal');
console.log('OK si no aparecio ningun "FALLA" arriba');
```

`console.assert` solo imprime algo si la aserción falla — el resultado esperado es ver únicamente el `console.log('OK...')` final, sin mensajes "FALLA".

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: funciones puras extractProjectBucket y mergeProjectBucket"
```

---

## Task 4: JS — Usar el bucket activo en boot y caché local

**Files:**
- Modify: `app.js` — `bootApp()` (línea ~1874, dentro del `try` del fetch a GitHub)
- Modify: `app.js` — `applyData()` (línea de `localStorage.setItem('planboard_cache', ...)`, ~1847)
- Modify: `app.js` — `loadLocalCache()` (~1854–1863)
- Modify: `app.js` — `saveSession()` (~1900–1903)
- Modify: `app.js` — `exportSession()` (~1909–1918)

**Interfaces:**
- Consumes: `activeProject` (Task 2), `getCacheKey()` (Task 2), `extractProjectBucket` (Task 3)

- [ ] **Step 1: Extraer el bucket correcto al bootear desde GitHub**

En `app.js`, dentro de `bootApp()`, localizar:

```js
      const resp = await fetch(GITHUB_JSON_URL + '?_=' + Date.now(), { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      applyData(data);
      setSyncStatus('github');
```

Reemplazar con:

```js
      const resp = await fetch(GITHUB_JSON_URL + '?_=' + Date.now(), { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      applyData(extractProjectBucket(data, activeProject));
      setSyncStatus('github');
```

- [ ] **Step 2: Cachear bajo la clave del proyecto activo en `applyData`**

En `app.js`, dentro de `applyData()`, localizar:

```js
  try { localStorage.setItem('planboard_cache', JSON.stringify({ cards, placements, idCounter, dayTasks, _ts: Date.now() })); } catch(e) {}
  renderCards(); renderCalendar(); renderLegend();
```

Reemplazar con:

```js
  try { localStorage.setItem(getCacheKey(), JSON.stringify({ cards, placements, idCounter, dayTasks, _ts: Date.now() })); } catch(e) {}
  renderCards(); renderCalendar(); renderLegend();
```

- [ ] **Step 3: Leer la caché local del proyecto activo**

En `app.js`, localizar:

```js
function loadLocalCache() {
  try {
    const raw = localStorage.getItem('planboard_cache')
             || localStorage.getItem('planboard_session'); // legacy key
    if (!raw) return false;
    const data = JSON.parse(raw);
    applyData(data);
    return cards.length > 0 || placements.length > 0;
  } catch(e) { return false; }
}
```

Reemplazar con:

```js
function loadLocalCache() {
  try {
    const raw = localStorage.getItem(getCacheKey())
             || (activeProject === 'work' ? localStorage.getItem('planboard_session') : null); // legacy key, solo trabajo
    if (!raw) return false;
    const data = JSON.parse(raw);
    applyData(data);
    return cards.length > 0 || placements.length > 0;
  } catch(e) { return false; }
}
```

- [ ] **Step 4: Guardar la sesión de trabajo bajo la clave correcta**

En `app.js`, localizar:

```js
function saveSession() {
  // Saves to localStorage as working cache
  try { localStorage.setItem('planboard_cache', JSON.stringify({ cards, placements, idCounter, dayTasks, _ts: Date.now() })); } catch(e) {}
}
```

Reemplazar con:

```js
function saveSession() {
  // Saves to localStorage as working cache (clave separada por proyecto activo)
  try { localStorage.setItem(getCacheKey(), JSON.stringify({ cards, placements, idCounter, dayTasks, _ts: Date.now() })); } catch(e) {}
}
```

- [ ] **Step 5: Nombrar el archivo exportado según el proyecto**

En `app.js`, localizar:

```js
function exportSession() {
  const data = JSON.stringify({ cards, placements, idCounter, dayTasks }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'planboard-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✓ planboard-data.json descargado — subilo a GitHub para publicar los cambios');
}
```

Reemplazar con:

```js
function exportSession() {
  const data     = JSON.stringify({ cards, placements, idCounter, dayTasks }, null, 2);
  const blob     = new Blob([data], { type: 'application/json' });
  const filename = activeProject === 'personal' ? 'planboard-data-nosotros.json' : 'planboard-data.json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✓ ' + filename + ' descargado — subilo a GitHub para publicar los cambios');
}
```

- [ ] **Step 6: Verificar en el navegador**

1. Abrir `index.html` (sin parámetro) → debe verse el calendario de trabajo igual que siempre (mismas tarjetas, mismo estado de sync).
2. Abrir `index.html?p=nosotros` → debe verse un calendario vacío (todavía no existe el bucket `personal` en GitHub), sin errores en consola, con el indicador "Nosotros" visible.
3. En DevTools → Application → Local Storage, confirmar que existe `planboard_cache` (trabajo) intacto y, tras cargar el modo personal, no se creó todavía `planboard_cache_personal` (recién se crea al persistir algo).
4. Activar modo editor (botón invisible `#editor-unlock`, esquina inferior donde ya existía antes), crear una tarjeta de prueba en modo personal, confirmar que aparece y que ahora sí existe `planboard_cache_personal` en Local Storage con esa tarjeta.
5. Refrescar (F5) sobre `index.html?p=nosotros` sin volver a escribir el parámetro manualmente (dejar que redirija solo la barra sin query) — como se navegó dentro de la misma pestaña, `sessionStorage` mantiene `activeProject = 'personal'`, así que la tarjeta de prueba debe seguir apareciendo.
6. Abrir una pestaña nueva del navegador con `index.html` (sin parámetro) → debe verse el calendario de trabajo, sin la tarjeta de prueba.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: usar bucket de proyecto activo en boot y cache local"
```

---

## Task 5: JS — Guardar en GitHub sin pisar el proyecto inactivo

**Files:**
- Modify: `app.js` — `saveToGithub()` (líneas ~1761–1797, dentro del `try`)

**Interfaces:**
- Consumes: `activeProject` (Task 2), `mergeProjectBucket` (Task 3)

- [ ] **Step 1: Traer el JSON remoto completo y fusionar solo el bucket activo**

En `app.js`, dentro de `saveToGithub()`, localizar:

```js
  setSyncStatus('loading');
  try {
    const getResp = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
    });
    const sha = getResp.ok ? (await getResp.json()).sha : null;

    const json    = JSON.stringify({ cards, placements, idCounter, dayTasks }, null, 2);
    const content = btoa(unescape(encodeURIComponent(json)));
```

Reemplazar con:

```js
  setSyncStatus('loading');
  try {
    const getResp = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
    });

    let sha = null;
    let remoteData = {};
    if (getResp.ok) {
      const getJson = await getResp.json();
      sha = getJson.sha;
      try {
        remoteData = JSON.parse(decodeURIComponent(escape(atob(getJson.content.replace(/\n/g, '')))));
      } catch(parseErr) {
        throw new Error('No se pudo leer el archivo remoto — guardado cancelado para no perder datos');
      }
    }

    const merged  = mergeProjectBucket(remoteData, activeProject, { cards, placements, idCounter, dayTasks });
    const json    = JSON.stringify(merged, null, 2);
    const content = btoa(unescape(encodeURIComponent(json)));
```

El resto de la función (construcción de `body`, `PUT`, manejo de errores) queda exactamente igual — no lo toques.

- [ ] **Step 2: Verificar el flujo completo contra el repo real**

Esto va a crear un commit real en el repo público `nms47/Planner` (mismo comportamiento que el guardado normal ya usa hoy). Usar un nombre de prueba fácil de identificar y limpiar después.

1. Con `index.html` (sin parámetro, modo trabajo) y modo editor activo: anotar cuántas `cards` hay hoy (Local Storage → `planboard_cache` o mirar el panel lateral).
2. Abrir `index.html?p=nosotros`, activar modo editor, crear una tarjeta "PRUEBA BORRAR" y guardar en GitHub (menú hamburguesa → ☁ Guardar en GitHub).
3. Abrir `https://raw.githubusercontent.com/nms47/Planner/main/planboard-data.json?_=` + cualquier número (para evitar caché) y confirmar:
   - Existe la clave `personal.cards` con la tarjeta "PRUEBA BORRAR".
   - Las claves top-level (`cards`, `placements`, `idCounter`, `dayTasks`) de trabajo tienen exactamente la misma cantidad de tarjetas que en el paso 1 — no se perdió ni se modificó nada de trabajo.
4. Volver a `index.html?p=nosotros`, borrar la tarjeta "PRUEBA BORRAR", guardar en GitHub de nuevo.
5. Volver a `index.html` (sin parámetro), hacer un cambio trivial reversible (por ejemplo, abrir y cerrar el modal de una tarjeta sin cambios) y guardar en GitHub — confirmar que el bucket `personal` (ahora vacío tras el paso 4) sigue presente en el JSON remoto y no desapareció.
6. En una pestaña nueva sin parámetro, confirmar una vez más que el calendario de trabajo se ve igual que antes de empezar todo este plan.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "fix: guardar en GitHub sin pisar el bucket del proyecto inactivo"
```

---

## Self-Review

**Spec coverage:**
- ✅ Bucket `personal` opcional en `planboard-data.json`, retrocompatible — Task 3 (`extractProjectBucket` con defaults) + Task 4 Step 6.1
- ✅ Activación vía `?p=nosotros` — Task 2 (`resolveActiveProject`)
- ✅ Persiste mientras la pestaña esté abierta, no entre pestañas nuevas — Task 2 (`sessionStorage`) + Task 4 Step 6.5-6.6
- ✅ Caché local separada por proyecto — Task 4 Steps 2–4
- ✅ Sin panel de materias en modo personal — Task 2 Step 2
- ✅ Link de salida "Volver a trabajo" — Task 1 Step 1 + Task 2 (`exitPersonalMode`)
- ✅ Guardado en GitHub nunca pisa el otro bucket — Task 5
- ✅ Nivel de secreto (solo ocultar de navegación casual, sin encriptar) — documentado en Global Constraints, ninguna tarea agrega encriptación ni repo privado (fuera de alcance, según decisión del usuario)

**Placeholder scan:** Ninguno — todos los pasos incluyen código completo y comandos exactos.

**Type consistency:** `activeProject` es siempre `'work'` o `'personal'` (string), producido por `resolveActiveProject` en Task 2 y consumido igual en Tasks 3, 4 y 5. El shape `{cards, placements, idCounter, dayTasks}` es idéntico en `extractProjectBucket` (retorno), `mergeProjectBucket` (parámetro `bucket`) y en las llamadas reales de Task 4/5 (`{ cards, placements, idCounter, dayTasks }` tomado de las variables globales existentes) — mismos cuatro campos, mismo orden, en todos los usos.
