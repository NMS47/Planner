# Calendario personal oculto ("nosotros")

## Contexto

El planner actual es una SPA sin backend (`index.html` + `app.js` + `styles.css`). Todo el
estado (`cards`, `placements`, `dayTasks`, `idCounter`) vive en variables globales de
`app.js`, se cachea en `localStorage` (`planboard_cache`) y se sincroniza contra un único
archivo `planboard-data.json` en el repo público `nms47/Planner` de GitHub, leído sin
autenticación vía `raw.githubusercontent.com` y escrito vía la API de contents con un
Personal Access Token guardado en `localStorage` ("modo editor").

El usuario quiere un segundo calendario, de uso personal (con su esposa), que:
- No aparezca en ningún menú o UI de la app normal (nada de dropdown "elegí proyecto").
- Se acceda solo escribiendo manualmente `?p=nosotros` en la URL.
- Persista mientras la pestaña del navegador siga abierta (sessionStorage), sin necesidad
  de repetir el parámetro en cada refresco, pero vuelva al calendario de trabajo en
  cualquier pestaña/ventana nueva que no lleve el parámetro.

### Nivel de secreto (decisión explícita del usuario)

El repo de GitHub es **público** — `raw.githubusercontent.com/nms47/Planner/main/planboard-data.json`
devuelve 200 sin autenticación, y `app.js` (con el nombre del parámetro `p=nosotros`
incluido) también es público y está en el historial de git para siempre.

Se eligió explícitamente el nivel de protección más simple: **ocultar de la navegación
casual únicamente**. Esto NO es seguridad real — es no-descubrimiento. Alguien que:
- lea el código fuente de `app.js`, o
- abra `planboard-data.json` directamente, o
- revise el historial de commits de git,

va a poder ver el contenido del calendario personal en texto plano. Se documenta acá para
que quede explícito y no sea sorpresa más adelante. Si en el futuro se necesita protección
real, las alternativas descartadas fueron: encriptar el bucket con una passphrase (Web
Crypto) o mover el calendario personal a un repo privado aparte con su propio token.

## Alcance

Un único calendario personal predefinido, con slug fijo `nosotros`. No se construye un
sistema genérico de múltiples proyectos — sería sobre-ingeniería para un caso de uso de
"un calendario de trabajo + un calendario personal fijo". Si en el futuro hace falta un
tercer calendario oculto, se generaliza en ese momento.

El calendario personal tiene: `cards`, `placements`, `dayTasks`, `idCounter` — igual que
el de trabajo. **No tiene** panel de materias/filtro por materia (es un concepto
específico de los cursos militares que no aplica a uso personal); ese ítem del menú
hamburguesa y el modal/dashboard asociado quedan ocultos en modo personal.

## Arquitectura

### Estructura de datos

`planboard-data.json` gana una clave nueva y opcional `personal`, con la misma forma que
el bucket de trabajo (menos materias, que nunca estuvieron en este JSON):

```json
{
  "cards": [...],
  "placements": [...],
  "idCounter": 856,
  "dayTasks": {...},
  "personal": {
    "cards": [],
    "placements": [],
    "idCounter": 0,
    "dayTasks": {}
  }
}
```

Un `planboard-data.json` sin la clave `personal` (el archivo actual, hoy) sigue
funcionando exactamente igual que ahora — el bucket personal se trata como vacío hasta
que se guarde algo en él.

### Detección del proyecto activo

Nueva variable de módulo `activeProject` (`'work'` | `'personal'`), determinada una sola
vez al boot, antes de `bootApp()`:

1. Si `location.search` tiene `p=nosotros` → `activeProject = 'personal'` y se guarda
   `sessionStorage.setItem('planboard_active_project', 'personal')`.
2. Si no está en la URL pero `sessionStorage.getItem('planboard_active_project') === 'personal'`
   → `activeProject = 'personal'` (sobrevive a refrescos F5 en la misma pestaña).
3. En cualquier otro caso → `activeProject = 'work'` (comportamiento actual, sin cambios).

Una pestaña/ventana nueva no hereda `sessionStorage` de otra pestaña, así que abrir el
sitio de cero sin el parámetro siempre cae en `'work'`.

### Carga y guardado de datos

- `applyData(fullData)` cambia para extraer el bucket correcto según `activeProject`:
  - `work` → como hoy, usa las claves top-level (`cards`, `placements`, `idCounter`, `dayTasks`).
  - `personal` → usa `fullData.personal` (con defaults vacíos si no existe la clave).
- La caché de `localStorage` se separa por proyecto: `planboard_cache` (trabajo, como hoy,
  sin tocar) vs `planboard_cache_personal` (nueva). Evita que un refresco offline en modo
  personal muestre datos de trabajo cacheados o viceversa.
- `saveToGithub()` cambia su flujo: ya hace un `GET` previo al `PUT` para obtener el `sha`
  de concurrencia — ese `GET` ahora también se usa para traer el JSON remoto completo.
  Se reemplaza *solo* la porción correspondiente a `activeProject` (top-level si es
  `work`, `personal.*` si es `personal`) y se conserva el resto del archivo tal cual vino
  del remoto, antes de hacer el `PUT`. Así guardar desde un modo nunca pisa al otro,
  incluso si hay ediciones remotas más recientes en el bucket que no está activo.
- `exportSession()` / `importSession()` (export/import manual de `.json`) operan sobre el
  bucket activo únicamente, igual que hoy operan sobre el único bucket que existe.

### UI

- Sin cambios visibles en modo `work` — ningún menú, botón ni indicio nuevo.
- En modo `personal`:
  - El ítem "🔍 Filtrar por materia" del menú hamburguesa no se renderiza, y el
    filter-banner/filter-dashboard/filter-modal quedan inertes (no hay materias que
    filtrar).
  - Aparece un link discreto "← Volver a trabajo" (limpia `sessionStorage` y navega a la
    URL sin query string) para poder salir sin editar la URL a mano.
  - Un indicador textual chico (ej. junto al badge de sync) tipo "Nosotros" para que el
    propio usuario tenga claro en qué calendario está — no es un selector, no lista nada,
    solo confirma el estado actual.

## Manejo de errores / casos borde

- `planboard-data.json` remoto sin clave `personal` → se trata como bucket vacío
  (`{cards:[], placements:[], idCounter:0, dayTasks:{}}`), no como error.
- Parámetro `?p=` con cualquier valor que no sea exactamente `nosotros` → se ignora,
  comportamiento igual a no tener el parámetro (no hay mensajes de error ni pistas de que
  existe un valor "correcto").
- Guardado en GitHub sin token guardado → mismo flujo actual (prompt de token), sin
  diferencias entre proyectos.
- Si el `GET` previo al guardado falla (sin conexión, rate limit) → se aborta el guardado
  con el mismo mensaje de error que ya existe hoy (`setSyncStatus('error', ...)`), para no
  arriesgar un `PUT` que pise el bucket inactivo con datos parciales.

## Testing

No hay suite de tests automatizados en el proyecto (es una SPA estática sin build ni test
runner). La verificación es manual, en navegador:

1. Abrir el sitio sin parámetro → calendario de trabajo idéntico a hoy, sin ítem de
   materias oculto, sin link "volver a trabajo".
2. Abrir `?p=nosotros` → calendario personal vacío la primera vez, sin panel de materias,
   con link de salida visible.
3. Crear una tarjeta/actividad en modo personal, guardar en GitHub, verificar en el JSON
   remoto que aparece bajo `personal` y que el bucket de trabajo no cambió.
4. Refrescar (F5) estando en `?p=nosotros` sin el query string en la URL de refresco →
   sigue en modo personal (sessionStorage).
5. Abrir una pestaña nueva del navegador sin parámetro → calendario de trabajo (no hereda
   sessionStorage de la otra pestaña).
6. Guardar una edición en modo trabajo → verificar que el bucket `personal` en GitHub no
   se pierde ni se sobreescribe.
