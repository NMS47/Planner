# Drag & Drop para reorganizar actividades — Diseño

**Fecha:** 2026-06-29  
**Estado:** Aprobado

---

## Resumen

Agregar funcionalidad de drag-and-drop en la vista semanal (modo edición) para mover actividades individuales o días completos a otro día, con navegación entre semanas durante el arrastre y confirmación con selector de fecha editable antes de ejecutar el movimiento.

---

## Contexto

El planner ya tiene drag-and-drop para proyectos (cards) sobre el calendario mensual, usando la HTML5 Drag API (`dragstart` / `dragover` / `drop`). Las actividades diarias (`dayTasks`) no tienen esta funcionalidad. Los datos de actividades se almacenan en `dayTasks[dateKey]` como arrays de objetos.

---

## Arquitectura

### Estado global nuevo

```js
let weekDrag = {
  active: false,
  taskId: null,      // id de la tarea individual, null si moveAll
  sourceKey: null,   // dateKey del día origen
  moveAll: false     // true cuando se arrastra el día completo
};
```

### Archivos afectados

- `app.js`: toda la lógica (renderWeekGridView, handlers drag, modal confirmación)
- `styles.css` (o el bloque `<style>` en `index.html`): estilos para drag-over, flechas, modal confirmación

---

## Componentes

### 1. Actividades arrastrables en vista semanal

Solo activo cuando `_editorMode === true`.

- Cada chip/fila de actividad en `renderWeekGridView` recibe `draggable="true"`.
- `dragstart`: setea `weekDrag.active`, `weekDrag.taskId`, `weekDrag.sourceKey`, `weekDrag.moveAll = false`. Agrega clase `wdrag-source` a la columna origen.
- `dragend`: limpia `weekDrag`, remueve clases visuales, oculta flechas de navegación.

### 2. Handle "mover día completo"

Solo visible en modo edición (`_editorMode`).

- Ícono `⠿` en el encabezado de cada columna de día en la vista semanal.
- `dragstart` sobre el handle: igual que actividad individual pero con `weekDrag.moveAll = true` y `weekDrag.taskId = null`.

### 3. Drop zones por columna

Cada columna de día en la vista semanal:

- `dragover`: `e.preventDefault()` + agrega clase `wdrag-over` (highlight visual).
- `dragleave`: remueve `wdrag-over`.
- `drop`: remueve `wdrag-over`, llama a `openMoveConfirmModal(targetKey)`.

No ejecuta el movimiento directamente — siempre pasa por el modal de confirmación.

### 4. Flechas de navegación durante el drag

Cuando `weekDrag.active === true`, se muestran dos botones superpuestos en los bordes de la vista semanal:

```
◀ Sem ant.                          Sem sig. ▶
```

- Se renderizan como elementos posicionados absolutamente sobre el modal semanal.
- Escuchan `dragenter`: inician un timer de **700 ms**. Si el cursor sigue sobre la flecha al vencer el timer, avanza/retrocede la semana y re-renderiza el modal (manteniendo `weekDrag.active`).
- `dragleave`: cancela el timer.
- Se ocultan en `dragend`.

### 5. Modal de confirmación con selector de fecha

Se muestra al hacer drop sobre cualquier columna de día.

```
┌──────────────────────────────────────┐
│  Mover actividad                     │
│                                      │
│  "Nombre de la actividad"            │
│  Lunes 29 jun  →  [ Martes 30 jun ▾ ]│
│                                      │
│  [Cancelar]          [Confirmar →]   │
└──────────────────────────────────────┘
```

Para día completo, el título dice: *"Mover todas las actividades del [día origen]"*.

- La fecha destino viene pre-cargada con el día donde se soltó (`targetKey`), representada como `<input type="date">` editable.
- El usuario puede cambiar la fecha a cualquier día (incluyendo semanas no visibles actualmente).
- **Confirmar**: ejecuta la mutación de datos → `persist()` → `renderWeekModal()` → `renderCalendar()` → cierra modal.
- **Cancelar**: cierra modal sin cambios.

---

## Lógica de datos

### Mover actividad individual

La conversión de `input[type=date]` (formato `"YYYY-MM-DD"`) a `dateKey` se hace así:

```js
function dateStrToKey(str) {
  const [y, m, d] = str.split('-').map(Number);
  return dateKey(y, m - 1, d); // month es 0-indexed en dateKey
}
```

```js
function executeMoveTask(taskId, sourceKey, targetDateStr) {
  const targetKey = dateStrToKey(targetDateStr);
  const idx = dayTasks[sourceKey].findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const [task] = dayTasks[sourceKey].splice(idx, 1);
  if (!dayTasks[targetKey]) dayTasks[targetKey] = [];
  dayTasks[targetKey].push(task);
  persist();
  renderWeekModal();
  renderCalendar();
}
```

### Mover día completo

```js
function executeMoveDay(sourceKey, targetDateStr) {
  const targetKey = dateStrToKey(targetDateStr);
  if (!dayTasks[targetKey]) dayTasks[targetKey] = [];
  dayTasks[targetKey].push(...(dayTasks[sourceKey] || []));
  dayTasks[sourceKey] = [];
  persist();
  renderWeekModal();
  renderCalendar();
}
```

En ambos casos, si el destino ya tiene tareas se **concatenan al final** (sin reemplazar).

---

## Estilos

Clases CSS nuevas mínimas:

| Clase | Uso |
|---|---|
| `.wdrag-source` | Columna origen durante drag (opacidad reducida) |
| `.wdrag-over` | Columna destino con hover durante drag (borde highlight) |
| `.week-nav-arrow` | Flechas de navegación superpuestas (izq/der) |
| `.move-confirm-modal` | Modal de confirmación |

---

## Restricciones

- La funcionalidad solo se activa cuando `_editorMode === true`.
- No aplica a la vista mensual ni al modal de día individual.
- El modal de confirmación es no-anidable (si ya hay uno abierto, el nuevo drag no abre otro).
- En móvil/touch: el HTML5 Drag API no funciona nativamente; queda fuera de scope (igual que el drag existente de proyectos).
