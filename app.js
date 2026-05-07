let YEAR = 2026;
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_LABEL = ['L','M','M','J','V','S','D'];
const BASE_COLORS = ['#e8ff47','#ff6b6b','#47c8ff','#b8ff9f','#ffb347','#d1a3ff','#ff9dc6','#4dffd2','#ffd147','#ff7c7c'];

let cards = [], placements = [], idCounter = 0, dragCard = null, tempPhases = [], editingCardId = null;
let calDrag = { active: false, startY: null, startM: null, startD: null };
let dayTasks = {}; // key: "YYYY-MM-DD" → [{id, name, time, duration, desc}]
let dayModal = { open: false, y: null, m: null, d: null, editMode: false };

// ── MATERIAS / FILTER ────────────────────────────────────────────────────────
const DEFAULT_MATERIAS = ['AYN','AFM','CA','FIBU','BTP','CH','FIPA','GMA','Demol','NSF','Planto','MEB'];
let materias = [...DEFAULT_MATERIAS];
let activeFilter = null; // null or materia string
let _dashCollapsed = false;

// Fixed color per materia — used in day/week views when a task matches a materia
const MATERIA_COLORS = {
  'AYN':    '#47c8ff',  // celeste
  'AFM':    '#ffdd00',  // amarillo
  'CA':     '#4cd080',  // verde
  'FIBU':   '#b06cf0',  // violeta
  'BTP':    '#2255cc',  // azul francia
  'CH':     '#ff6b00',  // naranja fuerte
  'FIPA':   '#d4a8ff',  // lila claro
  'GMA':    '#b8d400',  // amarillo verdoso
  'DEMOL':  '#999999',  // gris
  'NSF':    '#26c6a6',  // azul verdoso
  'PLANTO': '#8d5e3f',  // marrón
  'MEB':    '#c09070',  // marrón claro
};

// Alternative names/aliases for each materia key (uppercase, accent-stripped)
const MATERIA_ALIASES = {
  'AYN':    ['AYN','ACUATIZACION','NATACION','ACUATIZACION Y NATACION'],
  'AFM':    ['AFM','ADIESTRAMIENTO FISICO MILITAR','ADIESTRAMIENTO FISICO'],
  'CA':     ['CA','COMBATE ANFIBIO'],
  'FIBU':   ['FIBU','FISICA DE BUCEO'],
  'BTP':    ['BTP','BUCEO TEORICO PRACTICO','BUCEO TEORICO', 'BUCEO'],
  'CH':     ['CH','CAMARA HIPERBARICA'],
  'FIPA':   ['FIPA','FISIOPATOLOGIA'],
  'GMA':    ['GMA', 'CARTOGRAFIA', 'GEOGRAFIA MILITAR APLICADA'],
  'DEMOL':  ['DEMOL','DEMOLICION','DEMOLICIONES'],
  'NSF':    ['NSF', 'NAVEGACION Y SEGURIDAD FLUVIAL', 'NAVEGACION'],
  'PLANTO': ['PLANTO','PLANEAMIENTO'],
  'MEB':    ['MEB','MATERIAL Y EQUIPO DE BUCEO','MATERIAL DE BUCEO']
};

let _pastMonthsHidden = true;

// ── MATERIA RESPONSABLES (auto-fill) ──────────────────────────────────────────
let materiaResponsables = {}; // { 'AYN': 'Juan', ... }

function loadMateriaResponsables() {
  try {
    const s = localStorage.getItem('planboard_materia_responsables');
    if (s) materiaResponsables = JSON.parse(s);
  } catch(e) {}
}

function saveMateriaResponsable(materia, responsable) {
  if (!responsable) return;
  materiaResponsables[materia] = responsable;
  try { localStorage.setItem('planboard_materia_responsables', JSON.stringify(materiaResponsables)); } catch(e) {}
}

function getMateriaForTaskName(name) {
  if (!name) return null;
  const norm = _normStr(name);
  for (const mat of Object.keys(MATERIA_ALIASES)) {
    const aliases = MATERIA_ALIASES[mat].map(_normStr);
    if (aliases.some(a => norm === a || norm.startsWith(a+' ') || norm.startsWith(a+'-') || norm.startsWith(a+':'))) {
      return mat;
    }
  }
  return null;
}

function isMonthPast(year, month) {
  const lastDay = new Date(year, month + 1, 0); lastDay.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  return lastDay < today;
}

function monthHasFilter(month) {
  if (!activeFilter) return false;
  const total = daysInMonth(YEAR, month);
  for (let d = 1; d <= total; d++) {
    if (dayHasFilter(dateKey(YEAR, month, d))) return true;
  }
  return false;
}

function applyPastMonthVisibility() {
  const blocks = document.querySelectorAll('.month-block.month-past');
  blocks.forEach(b => {
    const m = parseInt(b.id.replace('month-', ''));
    const hide = activeFilter ? !monthHasFilter(m) : _pastMonthsHidden;
    b.style.display = hide ? 'none' : '';
  });
  const bar = document.getElementById('past-months-bar');
  const btn = document.getElementById('past-months-btn');
  if (!bar || !btn) return;
  if (blocks.length > 0 && !activeFilter) {
    bar.style.display = 'flex';
    btn.textContent = _pastMonthsHidden
      ? `▶ Ver meses anteriores (${blocks.length})`
      : '▲ Ocultar meses anteriores';
  } else {
    bar.style.display = 'none';
  }
}

function togglePastMonths() {
  _pastMonthsHidden = !_pastMonthsHidden;
  applyPastMonthVisibility();
}

function _normStr(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim();
}

function loadMaterias() {
  try {
    const s = localStorage.getItem('planboard_materias');
    if (s) materias = JSON.parse(s);
  } catch(e) {}
}
function saveMaterias() {
  try { localStorage.setItem('planboard_materias', JSON.stringify(materias)); } catch(e) {}
}

function taskMatchesFilter(task) {
  if (!activeFilter) return false;
  const name = _normStr(task.name || '');
  const mat  = _normStr(activeFilter);
  const aliases = (MATERIA_ALIASES[activeFilter.toUpperCase()] || [mat]).map(_normStr);
  const terms = [...new Set([mat, ...aliases])];
  return terms.some(t => name === t || name.startsWith(t+' ') || name.startsWith(t+'-') || name.startsWith(t+':'));
}
function dayHasFilter(dk) {
  return (dayTasks[dk] || []).some(t => taskMatchesFilter(t));
}

function applyFilterHighlights() {
  document.querySelectorAll('.day-cell[data-cy]').forEach(cell => {
    const k = dateKey(+cell.dataset.cy, +cell.dataset.cm, +cell.dataset.cd);
    cell.classList.toggle('filter-match', !!activeFilter && dayHasFilter(k));
  });
}

function setMateriaFilter(materia) {
  activeFilter = materia;
  // Banner
  const banner = document.getElementById('filter-banner');
  const fbName = document.getElementById('fb-name');
  if (banner && fbName) {
    fbName.textContent = materia;
    banner.classList.add('visible');
  }
  applyFilterHighlights();
  applyPastMonthVisibility();
  renderFilterDashboard();
  // Re-render open modals to show highlights
  if (typeof dayModal !== 'undefined' && dayModal.open) renderDayModal();
  if (typeof weekModal !== 'undefined' && weekModal.open) renderWeekModal();
}

function clearFilter() {
  activeFilter = null;
  const banner = document.getElementById('filter-banner');
  if (banner) banner.classList.remove('visible');
  const dash = document.getElementById('filter-dashboard');
  if (dash) dash.classList.remove('visible');
  applyFilterHighlights();
  applyPastMonthVisibility();
  if (typeof dayModal !== 'undefined' && dayModal.open) renderDayModal();
  if (typeof weekModal !== 'undefined' && weekModal.open) renderWeekModal();
}

// ── FILTER MODAL ──────────────────────────────────────────────────────────────
function openFilterModal() {
  renderFilterModalChips();
  const bd = document.getElementById('filter-modal-backdrop');
  if (bd) bd.classList.add('open');
  // Show add-section only in edit mode
  const addSec = document.getElementById('fm-add-section');
  if (addSec) addSec.style.display = _editorMode ? 'flex' : 'none';
}
function closeFilterModal() {
  const bd = document.getElementById('filter-modal-backdrop');
  if (bd) bd.classList.remove('open');
}
function onFilterBackdropClick(e) {
  if (e.target === document.getElementById('filter-modal-backdrop')) closeFilterModal();
}
function renderFilterModalChips() {
  const container = document.getElementById('fm-chips');
  if (!container) return;
  container.innerHTML = '';
  materias.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'materia-chip' + (activeFilter === m ? ' active' : '');
    btn.textContent = m;
    btn.onclick = () => {
      if (activeFilter === m) {
        clearFilter();
      } else {
        setMateriaFilter(m);
      }
      closeFilterModal();
    };
    container.appendChild(btn);
  });
}
function addMateriaFromInput() {
  const input = document.getElementById('fm-add-input');
  if (!input) return;
  const name = input.value.trim().toUpperCase();
  if (!name) return;
  if (materias.map(m=>m.toUpperCase()).includes(name)) {
    showToast('Esa materia ya existe');
    return;
  }
  materias.push(name);
  saveMaterias();
  input.value = '';
  renderFilterModalChips();
  showToast('✓ Materia agregada: ' + name);
}
function addMateria(name) {
  const n = name.trim().toUpperCase();
  if (!n || materias.map(m=>m.toUpperCase()).includes(n)) return;
  materias.push(n);
  saveMaterias();
  renderFilterModalChips();
}

// ── FILTER DASHBOARD ──────────────────────────────────────────────────────────
const DAY_NAMES_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function renderFilterDashboard() {
  const dash = document.getElementById('filter-dashboard');
  const body = document.getElementById('fd-body');
  const footer = document.getElementById('fd-footer');
  const title = document.getElementById('fd-title');
  if (!dash || !body || !footer) return;

  if (!activeFilter) { dash.classList.remove('visible'); return; }

  title.textContent = '📊 ' + activeFilter;

  // Collect matching tasks across all dayTasks
  const rows = [];
  let totalMins = 0;
  Object.keys(dayTasks).sort().forEach(dk => {
    const matched = (dayTasks[dk] || []).filter(t => taskMatchesFilter(t));
    if (!matched.length) return;
    matched.forEach(t => {
      let mins = 0;
      const s = t.desde ? parseMilitary(t.desde) : null;
      const e = t.hasta ? parseMilitary(t.hasta) : null;
      if (s && e) {
        mins = (e.h * 60 + e.m) - (s.h * 60 + s.m);
        if (mins < 0) mins = 0;
      } else if (t.duration) {
        // parse "9h" or "1h 30min" or "1:30"
        const mH = t.duration.match(/(\d+)\s*h/i);
        const mM = t.duration.match(/(\d+)\s*m/i);
        if (mH) mins += parseInt(mH[1]) * 60;
        if (mM) mins += parseInt(mM[1]);
      }
      totalMins += mins;
      const parts = dk.split('-');
      const dt = new Date(+parts[0], +parts[1]-1, +parts[2]);
      rows.push({ dk, dt, task: t, mins });
    });
  });

  if (!rows.length) {
    body.innerHTML = '<div style="padding:16px;text-align:center;font-size:11px;color:var(--muted)">No se encontraron tareas con esta materia</div>';
    footer.innerHTML = '';
    dash.classList.add('visible');
    return;
  }

  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;
  const totalStr = totalH > 0 ? (totalM > 0 ? `${totalH}h ${totalM}min` : `${totalH}h`) : `${totalM}min`;

  const table = document.createElement('table');
  table.className = 'fd-table';
  table.innerHTML = `<thead><tr>
    <th>Fecha</th><th>Día</th><th>Tema / Desc</th><th>Horas</th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const dateStr = `${String(r.dt.getDate()).padStart(2,'0')}/${String(r.dt.getMonth()+1).padStart(2,'0')}`;
    const dayName = DAY_NAMES_SHORT[r.dt.getDay()];
    const topic = r.task.desc || r.task.name || '—';
    const horaStr = r.mins > 0
      ? (Math.floor(r.mins/60) > 0 ? `${Math.floor(r.mins/60)}h${r.mins%60>0?r.mins%60+'m':''}` : `${r.mins}m`)
      : (r.task.desde && r.task.hasta ? `${r.task.desde}–${r.task.hasta}` : '—');
    tr.innerHTML = `
      <td class="fd-date">${esc(dateStr)}</td>
      <td class="fd-day">${esc(dayName)}</td>
      <td class="fd-topic">${esc(topic)}</td>
      <td class="fd-hours">${esc(horaStr)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.innerHTML = '';
  body.appendChild(table);

  footer.innerHTML = `<span class="fd-total-label">Total horas:</span> <span style="color:var(--accent)">${esc(totalStr)}</span>`;

  _dashCollapsed = false;
  body.style.display = '';
  const toggleBtn = document.getElementById('fd-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = '▲';
  dash.classList.add('visible');
}

function toggleDashboard() {
  _dashCollapsed = !_dashCollapsed;
  const body = document.getElementById('fd-body');
  const footer = document.getElementById('fd-footer');
  const btn = document.getElementById('fd-toggle-btn');
  if (body) body.style.display = _dashCollapsed ? 'none' : '';
  if (footer) footer.style.display = _dashCollapsed ? 'none' : '';
  if (btn) btn.textContent = _dashCollapsed ? '▼' : '▲';
}

// ── SIDEBAR TOGGLE (DESKTOP) ─────────────────────────────────────────────────
let sidebarOpen = true;

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const layout = document.getElementById('main-layout');
  const btn    = document.getElementById('sidebar-toggle-btn');
  const icon   = btn.querySelector('.stb-icon');
  if (sidebarOpen) {
    layout.classList.remove('sidebar-collapsed');
    btn.style.left = 'calc(320px - 1px)';
    icon.style.transform = '';
    btn.title = 'Minimizar panel';
  } else {
    layout.classList.add('sidebar-collapsed');
    btn.style.left = '-1px';
    icon.style.transform = 'rotate(180deg)';
    btn.title = 'Expandir panel';
  }
}

// ── SIDEBAR MOBILE DRAWER ─────────────────────────────────────────────────────
function openMobileSidebar() {
  document.getElementById('main-sidebar').classList.add('mobile-open');
  const ov = document.getElementById('sidebar-overlay');
  ov.style.display = 'block';
  requestAnimationFrame(() => ov.classList.add('open'));
  document.getElementById('sidebar-fab').style.display = 'none';
}
function closeMobileSidebar() {
  document.getElementById('main-sidebar').classList.remove('mobile-open');
  const ov = document.getElementById('sidebar-overlay');
  ov.classList.remove('open');
  // Show FAB again only if mobile
  if (window.innerWidth <= 600) {
    document.getElementById('sidebar-fab').style.display = 'flex';
  }
}

// ── HAMBURGER MENU ────────────────────────────────────────────────────────────
function toggleHamburger() {
  const btn  = document.getElementById('hamburger-btn');
  const menu = document.getElementById('hamburger-menu');
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
}
function closeHamburger() {
  document.getElementById('hamburger-btn').classList.remove('open');
  document.getElementById('hamburger-menu').classList.remove('open');
}
// Close when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('hamburger-wrap');
  if (wrap && !wrap.contains(e.target)) closeHamburger();
});

// ── YEAR ──────────────────────────────────────────────────────────────────────
function changeYear(delta) {
  YEAR += delta;
  document.getElementById('year-badge').textContent = YEAR;
  document.getElementById('cal-title').textContent = `Calendario ${YEAR}`;
  renderCalendar();
  renderLegend();
}

// ── CARDS LIST TOGGLE ────────────────────────────────────────────────────────
let cardsListOpen = true;
function toggleCardsList() {
  cardsListOpen = !cardsListOpen;
  const list = document.getElementById('cards-list');
  const icon = document.getElementById('cards-list-icon');
  if (cardsListOpen) {
    list.classList.remove('collapsed');
    icon.style.transform = '';
  } else {
    list.classList.add('collapsed');
    icon.style.transform = 'rotate(-90deg)';
  }
}


// ── CALENDAR DRAG-TO-CREATE ───────────────────────────────────────────────────
function highlightCalDrag(sy, sm, sd, ey, em, ed) {
  // Clear previous highlights
  document.querySelectorAll('.day-cell.cal-selecting').forEach(el => el.classList.remove('cal-selecting'));
  const start = new Date(sy, sm, sd);
  const end   = new Date(ey, em, ed);
  // Walk each day cell and mark those in range
  document.querySelectorAll('.day-cell:not(.empty)').forEach(cell => {
    const cy = parseInt(cell.dataset.cy), cm = parseInt(cell.dataset.cm), cd = parseInt(cell.dataset.cd);
    if (isNaN(cy)) return;
    const dt = new Date(cy, cm, cd);
    if (dt >= start && dt <= end) cell.classList.add('cal-selecting');
  });
}

function finishCalDrag(endY, endM, endD) {
  if (!calDrag.active) return;
  calDrag.active = false;
  document.querySelectorAll('.day-cell.cal-selecting').forEach(el => el.classList.remove('cal-selecting'));

  const s = new Date(calDrag.startY, calDrag.startM, calDrag.startD);
  const e = new Date(endY, endM, endD);
  const [from, to] = s <= e ? [s, e] : [e, s];

  const days = Math.round((to - from) / 86400000) + 1;
  const sy = from.getFullYear(), sm = from.getMonth(), sd = from.getDate();

  // Pre-fill sidebar form and open it
  document.getElementById('input-days').value = days;
  document.getElementById('input-name').value = '';
  tempPhases = [];
  renderPhaseInputs();
  document.getElementById('btn-create-lbl').textContent = '+ Crear Tarjeta';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  document.getElementById('form-title').textContent = 'Nueva Tarjeta';
  editingCardId = null;

  // Expand sidebar form
  const h = document.getElementById('sidebar-header');
  h.classList.remove('collapsed'); h.classList.add('expanded');
  // Expand cards list too
  if (!cardsListOpen) toggleCardsList();

  // Store pending placement to apply after card is created
  pendingPlacement = { startY: sy, startM: sm, startD: sd, days };

  // Focus name input
  setTimeout(() => {
    document.getElementById('input-name').focus();
    showToast(`📅 ${days} día${days>1?'s':''} seleccionados — poné el nombre y creá la tarjeta`);
  }, 50);
}

let pendingPlacement = null;

document.addEventListener('mouseup', e => {
  if (!calDrag.active) return;
  // Find which cell the mouse is over
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el?.closest('.day-cell');
  if (cell && cell.dataset.cy) {
    finishCalDrag(parseInt(cell.dataset.cy), parseInt(cell.dataset.cm), parseInt(cell.dataset.cd));
  } else {
    // Dropped outside — just cancel
    calDrag.active = false;
    document.querySelectorAll('.day-cell.cal-selecting').forEach(el => el.classList.remove('cal-selecting'));
  }
});

document.addEventListener('mouseleave', () => {
  if (calDrag.active) {
    calDrag.active = false;
    document.querySelectorAll('.day-cell.cal-selecting').forEach(el => el.classList.remove('cal-selecting'));
  }
});


// ── COLOR ─────────────────────────────────────────────────────────────────────
function nextColor() {
  const used = cards.map(c => c.baseColor);
  for (const c of BASE_COLORS) if (!used.includes(c)) return c;
  return BASE_COLORS[cards.length % BASE_COLORS.length];
}

// Converts hex to HSL
function hexToHSL(hex) {
  let r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}
  }
  return [h*360,s*100,l*100];
}

function hslToRgb(h,s,l) {
  h/=360;s/=100;l/=100;
  if(s===0) { const v=Math.round(l*255); return `rgb(${v},${v},${v})`; }
  const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
  return `rgb(${Math.round(hue2rgb(p,q,h+1/3)*255)},${Math.round(hue2rgb(p,q,h)*255)},${Math.round(hue2rgb(p,q,h-1/3)*255)})`;
}

// Generates N clearly distinct tones: varies lightness AND saturation dramatically
function generateTones(hex, n) {
  if (n <= 1) return [hex];
  const [h,s,l] = hexToHSL(hex);
  // Spread lightness from 25% (dark) to 85% (light), and vary saturation
  const tones = [];
  for (let i=0; i<n; i++) {
    const t = i/(n-1); // 0 → 1
    const newL = 25 + t*60;          // 25% dark → 85% light
    const newS = Math.min(100, s * (1.3 - t*0.6)); // start more saturated, fade out
    const hShift = h + (i % 2 === 0 ? 0 : 8); // tiny hue shift on alternates
    tones.push(hslToRgb(hShift, newS, newL));
  }
  return tones;
}

function getTaskColor(task, fallback) {
  if (!task || !task.name) return fallback;
  const name = _normStr(task.name);
  for (const [mat, color] of Object.entries(MATERIA_COLORS)) {
    const aliases = (MATERIA_ALIASES[mat] || [mat]).map(_normStr);
    if (aliases.some(a => name === a || name.startsWith(a+' ') || name.startsWith(a+'-') || name.startsWith(a+':'))) {
      return color;
    }
  }
  return fallback;
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
const dateKey = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const addDays  = (y,m,d,n) => { const dt=new Date(y,m,d); dt.setDate(dt.getDate()+n); return dt; };
const fmtDate  = (y,m,d) => `${String(d).padStart(2,'0')}/${String(m+1).padStart(2,'0')}/${y}`;
const daysInMonth = (y,m) => new Date(y,m+1,0).getDate();
const firstDay = (y,m) => { let d=new Date(y,m,1).getDay(); return d===0?6:d-1; };
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── PHASE FORM ────────────────────────────────────────────────────────────────
function addPhaseRow(name='', days='') {
  tempPhases.push({name, days});
  renderPhaseInputs();
}

function removePhaseRow(i) {
  tempPhases.splice(i,1);
  renderPhaseInputs();
}

function renderPhaseInputs() {
  const c = document.getElementById('phase-inputs');
  c.innerHTML = '';
  tempPhases.forEach((ph,i) => {
    const row = document.createElement('div');
    row.className = 'phase-row';
    row.innerHTML = `
      <input type="text" placeholder="Fase ${i+1}" value="${esc(ph.name)}" oninput="tempPhases[${i}].name=this.value;updateTotal()">
      <input type="number" placeholder="días" min="1" value="${ph.days||''}" oninput="tempPhases[${i}].days=this.value;updateTotal()">
      <button class="phase-del" onclick="removePhaseRow(${i})">✕</button>`;
    c.appendChild(row);
  });
  updateTotal();
}

function updateTotal() {
  const total = parseInt(document.getElementById('input-days').value)||0;
  const sum = tempPhases.reduce((s,p)=>s+(parseInt(p.days)||0),0);
  const el = document.getElementById('phases-total');
  if (!tempPhases.length || !total) { el.textContent=''; return; }
  el.textContent = `${sum}/${total}d`;
  el.className = 'phases-total '+(sum>total?'over':sum===total?'exact':'');
}

document.getElementById('input-days').addEventListener('input', updateTotal);

// ── CARD CREATE / UPDATE ──────────────────────────────────────────────────────
function createCard() {
  const name = document.getElementById('input-name').value.trim();
  const days = parseInt(document.getElementById('input-days').value);
  if (!name) { flash('input-name'); return; }
  if (!days||days<1) { flash('input-days'); return; }

  const rawPh = tempPhases.filter(p=>p.name.trim()&&parseInt(p.days)>0);
  if (rawPh.length) {
    const sum = rawPh.reduce((s,p)=>s+parseInt(p.days),0);
    if (sum>days) { alert(`Las fases suman ${sum}d pero la tarjeta tiene ${days}d.`); return; }
  }

  const category = (document.getElementById('input-category').value || '').trim();

  if (editingCardId !== null) {
    // UPDATE existing card
    const card = cards.find(c=>c.id===editingCardId);
    if (card) {
      const tones = generateTones(card.baseColor, rawPh.length||1);
      card.name     = name;
      card.days     = days;
      card.category = category;
      card.phases = rawPh.map((p,i)=>({name:p.name.trim(), days:parseInt(p.days), color:tones[i]}));
      // Update placements that reference this card
      placements.forEach(p=>{ if(p.cardId===card.id){ p.name=name; p.days=days; const end=addDays(p.startY,p.startM,p.startD,days-1); p.endY=end.getFullYear();p.endM=end.getMonth();p.endD=end.getDate(); }});
    }
    cancelEdit();
    renderCards(); renderCalendar(); renderLegend();
    persist();
    return;
  }

  const baseColor = nextColor();
  const tones = generateTones(baseColor, rawPh.length||1);
  const phases = rawPh.map((p,i)=>({name:p.name.trim(), days:parseInt(p.days), color:tones[i]}));
  const newCard = {id:++idCounter, name, days, baseColor, phases, category};
  cards.push(newCard);

  // If we have a pending placement from cal-drag, apply it
  if (pendingPlacement && pendingPlacement.days === days) {
    const {startY, startM, startD} = pendingPlacement;
    const end = addDays(startY, startM, startD, days - 1);
    placements.push({id:++idCounter, cardId:newCard.id, name, days,
      startY, startM, startD, endY:end.getFullYear(), endM:end.getMonth(), endD:end.getDate()});
    pendingPlacement = null;
    renderCalendar(); renderLegend();
  }

  resetForm();
  renderCards();
  persist();
}

function resetForm() {
  document.getElementById('input-name').value='';
  document.getElementById('input-days').value='';
  document.getElementById('input-category').value='';
  tempPhases=[];
  renderPhaseInputs();
  document.getElementById('input-name').focus();
}

function toggleForm() {
  const h = document.getElementById('sidebar-header');
  h.classList.toggle('collapsed');
  h.classList.toggle('expanded');
}

function startEdit(id) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  editingCardId = id;
  document.getElementById('input-name').value     = card.name;
  document.getElementById('input-days').value     = card.days;
  document.getElementById('input-category').value = card.category || '';
  tempPhases = card.phases.map(p=>({name:p.name, days:p.days}));
  renderPhaseInputs();
  // Change button label and show cancel
  document.getElementById('btn-create-lbl').textContent = '✓ Guardar Cambios';
  document.getElementById('btn-cancel-edit').style.display = 'block';
  document.getElementById('form-title').textContent = 'Editando Tarjeta';
  // Ensure form is expanded
  const h = document.getElementById('sidebar-header');
  h.classList.remove('collapsed'); h.classList.add('expanded');
  document.querySelector('.sidebar-header').scrollTop = 0;
  document.getElementById('input-name').focus();
}

function cancelEdit() {
  editingCardId = null;
  pendingPlacement = null;
  resetForm();
  document.getElementById('btn-create-lbl').textContent = '+ Crear Tarjeta';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  document.getElementById('form-title').textContent = 'Nueva Tarjeta';
}


function flash(id) {
  const el=document.getElementById(id);
  el.style.borderColor='#ff6b6b'; el.focus();
  setTimeout(()=>el.style.borderColor='',800);
}

function changeColor(id, hex) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  card.baseColor = hex;
  // Regenerate phase tones with new base color
  if (card.phases.length > 0) {
    const tones = generateTones(hex, card.phases.length);
    card.phases.forEach((p,i) => p.color = tones[i]);
  }
  renderCards(); renderCalendar(); renderLegend(); persist();
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g); if(!m) return '#888888';
  return '#' + m.slice(0,3).map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
}

function deleteCard(id) {
  cards=cards.filter(c=>c.id!==id);
  placements=placements.filter(p=>p.cardId!==id);
  renderCards(); renderCalendar(); renderLegend(); persist();
}

function toggleHideCard(id) {
  const card = cards.find(c=>c.id===id); if(!card) return;
  card.hidden = !card.hidden;
  renderCards(); renderCalendar(); renderLegend(); persist();
  showToast(card.hidden ? '🙈 Tarjeta oculta en el calendario' : '👁 Tarjeta visible en el calendario');
}

// ── RENDER CARDS (grouped by category) ───────────────────────────────────────
let collapsedGroups = new Set(); // persists across re-renders

function buildCardEl(card) {
  const ph = card.phases;
  const totalCovered = ph.length ? ph.reduce((s,p)=>s+p.days,0) : card.days;
  let bar = ph.length
    ? ph.map(p=>`<div class="phase-preview-seg" style="width:${(p.days/totalCovered*100).toFixed(1)}%;background:${p.color}"></div>`).join('')
    : `<div class="phase-preview-seg" style="width:100%;background:${card.baseColor}"></div>`;
  let phList = ph.length
    ? `<div class="phase-list">${ph.map(p=>`<div class="phase-item"><div class="phase-swatch" style="background:${p.color}"></div>${esc(p.name)} · ${p.days}d</div>`).join('')}</div>`
    : '';
  const el = document.createElement('div');
  el.className = 'task-card'+(editingCardId===card.id?' editing':'')+(card.hidden?' card-hidden':'');
  el.dataset.id = card.id;
  el.style.setProperty('--card-color', card.baseColor);
  el.draggable = true;
  el.innerHTML = `
    <div class="card-name">${esc(card.name)}</div>
    <div class="card-meta">${card.days} día${card.days>1?'s':''}</div>
    <div class="phase-preview">${bar}</div>
    ${phList}
    <div class="card-actions">
      <label class="card-btn color-btn" title="Cambiar color" style="background:${card.baseColor};border-color:${card.baseColor}">
        <input type="color" value="${card.baseColor.startsWith('#') ? card.baseColor : rgbToHex(card.baseColor)}" style="opacity:0;position:absolute;width:0;height:0" onchange="changeColor(${card.id}, this.value)">
      </label>
      <button class="card-btn hide-btn" title="Ocultar/Mostrar en calendario" onclick="toggleHideCard(${card.id})">👁</button>
      <button class="card-btn" title="Editar" onclick="startEdit(${card.id})">✎</button>
      <button class="card-btn" onclick="deleteCard(${card.id})">✕</button>
    </div>`;
  el.addEventListener('dragstart', e=>onDragStart(e,card));
  el.addEventListener('dragend', onDragEnd);
  return el;
}

function renderCards() {
  const list = document.getElementById('cards-list');
  // Remove all previous card groups and cards
  list.querySelectorAll('.card-group, .task-card').forEach(e=>e.remove());

  const emptyMsg = document.getElementById('empty-msg');
  const loadBtn  = document.getElementById('empty-load-btn');
  if (cards.length) {
    emptyMsg.style.display = 'none';
    if (loadBtn) loadBtn.style.display = 'none';
  } else {
    emptyMsg.style.display = 'block';
    const icon = document.getElementById('empty-icon');
    const text = document.getElementById('empty-text');
    if (true) {
      if (loadBtn && loadBtn.style.display === 'none') {
        if (icon) icon.textContent = '📋';
        if (text) text.innerHTML = 'Creá tu primera tarjeta<br>y arrastrala al calendario';
      }
    } else {
      if (icon) icon.textContent = '⏳';
      if (text) text.textContent = 'Cargando datos...';
    }
  }
  const badge = document.getElementById('cards-count-badge');
  badge.textContent = cards.length ? cards.length : '';
  badge.style.display = cards.length ? 'inline' : 'none';

  // Update datalist for autocomplete
  const dl = document.getElementById('category-datalist');
  if (dl) {
    const cats = [...new Set(cards.map(c=>c.category).filter(Boolean))];
    dl.innerHTML = cats.map(c=>`<option value="${esc(c)}">`).join('');
  }

  // Group cards
  const groups = {}; // category → [card]
  const NO_CAT = ' '; // sentinel for uncategorised
  cards.forEach(card => {
    const key = card.category && card.category.trim() ? card.category.trim() : NO_CAT;
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  // Render named categories first (sorted), then uncategorised
  const sortedKeys = Object.keys(groups)
    .filter(k => k !== NO_CAT)
    .sort((a,b) => a.localeCompare(b, 'es'));
  if (groups[NO_CAT]) sortedKeys.push(NO_CAT);

  sortedKeys.forEach(key => {
    const groupCards = groups[key];
    const isNoCat = key === NO_CAT;
    const label = isNoCat ? 'Sin categoría' : key;

    if (sortedKeys.length === 1 && isNoCat) {
      // Only uncategorized cards and no named groups — render flat (legacy look)
      groupCards.forEach(card => list.appendChild(buildCardEl(card)));
      return;
    }

    // Build group element
    const group = document.createElement('div');
    group.className = 'card-group' + (collapsedGroups.has(key) ? ' collapsed' : '');
    group.dataset.groupKey = key;

    const hdr = document.createElement('div');
    hdr.className = 'card-group-header';
    hdr.innerHTML = `
      <span class="card-group-arrow">▾</span>
      <span class="card-group-name">${esc(label)}</span>
      <span class="card-group-count">${groupCards.length}</span>
      ${!isNoCat ? `<button class="card-group-del" title="Eliminar categoría (no borra tarjetas)" onclick="deleteCategory(event,'${esc(key)}')">✕</button>` : ''}`;
    hdr.addEventListener('click', e => {
      if (e.target.classList.contains('card-group-del')) return;
      collapsedGroups.has(key) ? collapsedGroups.delete(key) : collapsedGroups.add(key);
      group.classList.toggle('collapsed');
    });

    const body = document.createElement('div');
    body.className = 'card-group-body';
    groupCards.forEach(card => body.appendChild(buildCardEl(card)));

    // "Add card to this group" shortcut (editor only)
    if (!isNoCat) {
      const addBtn = document.createElement('button');
      addBtn.className = 'card-group-add';
      addBtn.textContent = '+ Tarjeta en esta categoría';
      addBtn.addEventListener('click', () => {
        document.getElementById('input-category').value = key;
        const h = document.getElementById('sidebar-header');
        h.classList.remove('collapsed'); h.classList.add('expanded');
        document.getElementById('input-name').focus();
        showToast(`Categoría "${key}" preseleccionada`);
      });
      body.appendChild(addBtn);
    }

    group.appendChild(hdr);
    group.appendChild(body);
    list.appendChild(group);
  });
}

function deleteCategory(e, key) {
  e.stopPropagation();
  if (!confirm(`¿Eliminar la categoría "${key}"? Las tarjetas quedan sin categoría.`)) return;
  cards.forEach(c => { if (c.category === key) c.category = ''; });
  collapsedGroups.delete(key);
  renderCards(); persist();
}


// ── CALENDAR ──────────────────────────────────────────────────────────────────
function renderCalendar() {
  const grid=document.getElementById('months-grid');
  grid.innerHTML='';

  // Build filled map — each key maps to an array of fills (supports overlap)
  const fmap={};
  placements.forEach(p=>{
    const card=cards.find(c=>c.id===p.cardId); if(!card) return;
    if (card.hidden) return; // skip hidden cards
    const ph=card.phases;

    // Build per-day color + phase info
    const dayInfo=[];
    if (ph.length) {
      ph.forEach((phase,pi)=>{
        for(let d=0;d<phase.days;d++) dayInfo.push({color:phase.color,phIdx:pi,phName:phase.name,phDays:phase.days,isBoundary:d===0&&pi>0});
      });
      // Extend remaining days with last phase color
      const last=dayInfo[dayInfo.length-1];
      while(dayInfo.length<p.days) dayInfo.push({...last,isBoundary:false});
    }

    const start=new Date(p.startY,p.startM,p.startD);
    for(let i=0;i<p.days;i++){
      const dt=new Date(start); dt.setDate(dt.getDate()+i);
      const k=dateKey(dt.getFullYear(),dt.getMonth(),dt.getDate());
      const info=dayInfo[i]||null;
      const entry={color:info?info.color:card.baseColor, placement:p, card, info, isStart:i===0, isEnd:i===p.days-1};
      if(!fmap[k]) fmap[k]=[];
      fmap[k].push(entry);
    }
  });
  window._lastFmap = fmap; // expose for day modal

  for(let m=0;m<12;m++){
    const block=document.createElement('div');
    block.className='month-block';
    block.id=`month-${m}`;
    if (isMonthPast(YEAR, m)) block.classList.add('month-past');
    const total=daysInMonth(YEAR,m), fd=firstDay(YEAR,m);
    block.innerHTML=`
      <div class="month-title">${MONTHS[m]} <span>${total} días</span></div>
      <div class="weekdays"><div class="weekday weekday-wn">S</div>${DAYS_LABEL.map(d=>`<div class="weekday">${d}</div>`).join('')}</div>
      <div class="days-grid" id="dg-${m}"></div>`;
    grid.appendChild(block);
    const dg=block.querySelector(`#dg-${m}`);

    // Week number helper (ISO week)
    const getWeekNum = (y,mo,dy) => {
      const d = new Date(Date.UTC(y,mo,dy));
      d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      return Math.ceil((((d-yearStart)/86400000)+1)/7);
    };

    // Inject week number at start of first row
    const wn0 = document.createElement('div');
    wn0.className = 'week-num';
    wn0.textContent = getWeekNum(YEAR, m, 1 - fd > 0 ? 1 - fd + (fd>0?1:0) : 1);
    // Actually compute week of the Monday that starts the first displayed row
    const firstDisplayedDate = new Date(YEAR, m, 1 - fd);
    wn0.textContent = getWeekNum(firstDisplayedDate.getFullYear(), firstDisplayedDate.getMonth(), firstDisplayedDate.getDate());
    wn0.dataset.weekMon = firstDisplayedDate.toISOString().slice(0,10);
    wn0.addEventListener('click', () => openWeekModal(firstDisplayedDate));
    dg.appendChild(wn0);

    // Empty cells for offset (fd = how many blank Mon-Sun slots before day 1)
    for(let i=0;i<fd;i++){const e=document.createElement('div');e.className='day-cell empty';dg.appendChild(e);}

    let currentRow = 0; // track which grid row we're on (0-based)

    for(let d=1;d<=total;d++){
      const colIndex = (fd + d - 1) % 7; // 0=Mon … 6=Sun

      // At start of a new row (after the first), inject week number
      if (colIndex === 0 && d > 1) {
        currentRow++;
        const wn = document.createElement('div');
        wn.className = 'week-num';
        wn.textContent = getWeekNum(YEAR, m, d);
        const monDate = new Date(YEAR, m, d);
        wn.dataset.weekMon = monDate.toISOString().slice(0,10);
        wn.addEventListener('click', () => openWeekModal(monDate));
        dg.appendChild(wn);
      }

      const k=dateKey(YEAR,m,d), fills=fmap[k];
      const today = new Date(); today.setHours(0,0,0,0);
      const cellDate = new Date(YEAR,m,d); cellDate.setHours(0,0,0,0);
      const cell=document.createElement('div');
      cell.className='day-cell';
      if (cellDate < today) cell.classList.add('day-past');
      if (cellDate.getTime() === today.getTime()) cell.classList.add('day-today');

      if(fills && fills.length){
        cell.classList.add('filled');
        const first=fills[0];
        if(fills.length===1){
          if(fills[0].isStart) cell.classList.add('range-start');
          if(fills[0].isEnd)   cell.classList.add('range-end');
        }
        // (with multiple fills, skip rounded corners — stripes look better without them)
        if(first.info?.isBoundary) cell.classList.add('phase-boundary');

        if(fills.length===1){
          // Single project — plain background as before
          cell.style.background = first.color;
        } else {
          // Multiple projects — horizontal stripes via linear-gradient
          const pct = 100 / fills.length;
          const stops = fills.map((f,i) =>
            `${f.color} ${(i*pct).toFixed(1)}% ${((i+1)*pct).toFixed(1)}%`
          ).join(', ');
          cell.style.background = `linear-gradient(to bottom, ${stops})`;
        }

        // Tooltip shows all overlapping projects
        cell.addEventListener('mouseenter', e => showTT(e, fills[0], fills));
        cell.addEventListener('mousemove',  e => moveTT(e));
        cell.addEventListener('mouseleave', hideTT);
        // Click opens day modal
        cell.addEventListener('click', () => { hideTT(); openDayModal(new Date(YEAR,m,d)); });
      }

      cell.addEventListener('dragover',e=>{e.preventDefault();if(!cell.classList.contains('empty'))cell.classList.add('drag-over');});
      cell.addEventListener('dragleave',()=>cell.classList.remove('drag-over'));
      cell.addEventListener('drop',e=>{cell.classList.remove('drag-over');onDrop(e,YEAR,m,d);});

      // Calendar drag-to-create (only on empty cells)
      if (!fills) {
        cell.addEventListener('mousedown', e => {
          if (e.button !== 0) return;
          e.preventDefault();
          calDrag.active = true;
          calDrag.startY = YEAR; calDrag.startM = m; calDrag.startD = d;
          highlightCalDrag(YEAR, m, d, YEAR, m, d);
        });
        cell.addEventListener('mouseenter', () => {
          if (!calDrag.active) return;
          const s = new Date(calDrag.startY, calDrag.startM, calDrag.startD);
          const e2 = new Date(YEAR, m, d);
          const [from, to] = s <= e2 ? [s, e2] : [e2, s];
          highlightCalDrag(from.getFullYear(), from.getMonth(), from.getDate(), to.getFullYear(), to.getMonth(), to.getDate());
        });
      }

      cell.innerHTML=`<span class="day-num" title="Ver día">${d}</span>`;
      cell.dataset.cy = YEAR; cell.dataset.cm = m; cell.dataset.cd = d;
      // Click on the day number opens the day modal
      cell.querySelector('.day-num').addEventListener('click', e => {
        e.stopPropagation();
        openDayModal(new Date(YEAR, m, d));
      });
      dg.appendChild(cell);
    }

    // ── FLOATING LABELS ──────────────────────────────────────────────────────
    // First pass: collect all label positions so we can detect overlaps on same row
    const labelMetas = [];
    placements.forEach(p => {
      const card = cards.find(c=>c.id===p.cardId); if(!card) return;

      const monthStart = new Date(YEAR, m, 1);
      const monthEnd   = new Date(YEAR, m, daysInMonth(YEAR,m));
      const pStart     = new Date(p.startY, p.startM, p.startD);
      const pEnd       = new Date(p.endY,   p.endM,   p.endD);
      if (pEnd < monthStart || pStart > monthEnd) return;

      const visStart = pStart < monthStart ? 1 : p.startD;
      const visEnd   = pEnd   > monthEnd   ? daysInMonth(YEAR,m) : p.endD;

      const COLS = 8;
      const DAY_COLS = 7;
      const dayCol  = n => ((fd + n - 1) % DAY_COLS) + 1;
      const dayRow  = n => Math.floor((fd + n - 1) / DAY_COLS);

      const startRow = dayRow(visStart), endRow = dayRow(visEnd);
      const midDay   = Math.round((visStart + visEnd) / 2);
      const midRow   = dayRow(midDay);

      let rangeColStart, rangeColEnd;
      if (startRow === endRow) {
        rangeColStart = dayCol(visStart); rangeColEnd = dayCol(visEnd);
      } else if (midRow === startRow) {
        rangeColStart = dayCol(visStart); rangeColEnd = DAY_COLS;
      } else if (midRow === endRow) {
        rangeColStart = 1; rangeColEnd = dayCol(visEnd);
      } else {
        rangeColStart = 1; rangeColEnd = DAY_COLS;
      }

      const cellW = 100 / COLS;
      const leftEdge  = cellW * rangeColStart;
      const rightEdge = cellW * rangeColEnd + cellW;
      const left      = (leftEdge + rightEdge) / 2;
      const spanCols  = rangeColEnd - rangeColStart + 1;
      const maxW      = cellW * spanCols * 0.85;

      const totalRows = Math.ceil((fd + daysInMonth(YEAR,m)) / DAY_COLS);
      const cellH     = 100 / totalRows;

      const initials = card.name.split(/\s+/).map(w => w[0]?.toUpperCase() || '').filter(Boolean).slice(0, 3).join('');

      labelMetas.push({ p, card, midRow, left, maxW, cellH, visStart, visEnd, initials });
    });

    // Second pass: for each midRow, group overlapping labels and assign vertical offsets
    // Two labels "overlap" on midRow if their horizontal spans intersect
    // Group by midRow first
    const rowGroups = {};
    labelMetas.forEach((meta, i) => {
      if (!rowGroups[meta.midRow]) rowGroups[meta.midRow] = [];
      rowGroups[meta.midRow].push(i);
    });

    // Within each row, find clusters of horizontally-overlapping labels
    Object.values(rowGroups).forEach(indices => {
      // Sort by visStart so stacking order is consistent
      indices.sort((a,b) => labelMetas[a].visStart - labelMetas[b].visStart);

      // Build overlap clusters using interval merging
      const metas = indices.map(i => labelMetas[i]);
      // Assign stack index within overlapping groups
      // Simple greedy: compare each pair, if spans overlap give them different slot indices
      const slots = new Array(metas.length).fill(0);
      const totalSlots = new Array(metas.length).fill(1);

      for (let i = 0; i < metas.length; i++) {
        for (let j = i + 1; j < metas.length; j++) {
          // Check if spans overlap
          if (metas[i].visStart <= metas[j].visEnd && metas[j].visStart <= metas[i].visEnd) {
            slots[j] = slots[i] + 1;
          }
        }
      }
      // Count max slots per group
      for (let i = 0; i < metas.length; i++) {
        for (let j = 0; j < metas.length; j++) {
          if (i !== j && metas[i].visStart <= metas[j].visEnd && metas[j].visStart <= metas[i].visEnd) {
            totalSlots[i] = Math.max(totalSlots[i], slots[i] + 1, slots[j] + 1);
          }
        }
      }

      metas.forEach((meta, idx) => {
        const n = totalSlots[idx];       // total stacked labels at this position
        const s = slots[idx];            // this label's slot (0-based)
        // Distribute vertically within the cell height
        // Base top is at 50% of cell + small offset; spread labels around that
        const baseTop = meta.cellH * meta.midRow + meta.cellH * 0.5;
        const spread  = meta.cellH * 0.38; // use 38% of cell height for spread
        const top = n === 1
          ? baseTop + spread * 0.12           // single: slightly below center
          : baseTop + spread * (s / (n - 1) - 0.5) * 1.1; // multiple: spread evenly

        const lbl = document.createElement('div');
        lbl.className = 'range-label';
        lbl.textContent = meta.card.name;
        lbl.style.cssText = `left:${meta.left}%;top:${top}%;transform:translate(-50%,-50%);max-width:${meta.maxW}%;`;
        dg.appendChild(lbl);
        requestAnimationFrame(() => {
          if (lbl.scrollWidth > lbl.offsetWidth + 2) {
            lbl.textContent = meta.initials;
            lbl.title = meta.card.name;
          }
        });
      });
    });
  }
  // Scroll al mes actual si estamos en el año correcto
  const todayM = new Date();
  if (YEAR === todayM.getFullYear()) {
    const currentBlock = document.getElementById(`month-${todayM.getMonth()}`);
    if (currentBlock) setTimeout(() => currentBlock.scrollIntoView({ behavior:'smooth', block:'center' }), 100);
  }
  applyFilterHighlights();
  applyPastMonthVisibility();
}

// ── DRAG ──────────────────────────────────────────────────────────────────────
function onDragStart(e,card){
  dragCard=card;
  e.dataTransfer.setData('text/plain',card.id);
  e.dataTransfer.effectAllowed='copy';
  const g=document.getElementById('drag-ghost');
  g.textContent=`${card.name} · ${card.days}d`;
  g.style.color=card.baseColor; g.style.display='block'; g.style.left='-9999px';
  e.dataTransfer.setDragImage(g,0,0);
  setTimeout(()=>e.target.classList.add('dragging'),0);
}
function onDragEnd(e){
  e.target.classList.remove('dragging');
  document.getElementById('drag-ghost').style.display='none';
  dragCard=null;
}
function onDrop(e,y,m,d){
  e.preventDefault(); if(!dragCard) return;
  placements=placements.filter(p=>p.cardId!==dragCard.id);
  const end=addDays(y,m,d,dragCard.days-1);
  placements.push({id:++idCounter,cardId:dragCard.id,name:dragCard.name,days:dragCard.days,
    startY:y,startM:m,startD:d,endY:end.getFullYear(),endM:end.getMonth(),endD:end.getDate()});
  renderCalendar(); renderLegend(); persist();
}
function removePlacement(id){placements=placements.filter(p=>p.id!==id);renderCalendar();renderLegend();persist();}

// ── TOOLTIP ───────────────────────────────────────────────────────────────────
function showTT(e, fill, allFills){
  const fills = allFills || [fill];
  const ph = document.getElementById('tt-phases');
  ph.innerHTML = '';

  if (fills.length === 1) {
    // Single project — original behaviour
    const {placement:p, card, info} = fills[0];
    document.getElementById('tt-name').textContent = p.name;
    document.getElementById('tt-name').style.color = card.baseColor;
    document.getElementById('tt-dates').textContent = `${fmtDate(p.startY,p.startM,p.startD)} → ${fmtDate(p.endY,p.endM,p.endD)} · ${p.days} días`;
    if(card.phases.length){
      card.phases.forEach((phase,i)=>{
        const active = info && info.phIdx === i;
        const row = document.createElement('div');
        row.className = 'tt-phase' + (active?' active':'');
        row.innerHTML = `<div class="tt-phase-dot" style="background:${phase.color}"></div>${esc(phase.name)} · ${phase.days}d${active?' ◀':''}`;
        ph.appendChild(row);
      });
    }
  } else {
    // Multiple overlapping projects
    document.getElementById('tt-name').textContent = `${fills.length} proyectos`;
    document.getElementById('tt-name').style.color = 'var(--text)';
    document.getElementById('tt-dates').textContent = 'Superposición';
    fills.forEach(f => {
      const {placement:p, card} = f;
      const row = document.createElement('div');
      row.className = 'tt-phase active';
      row.innerHTML = `<div class="tt-phase-dot" style="background:${card.baseColor};border-radius:50%"></div><strong style="color:${card.baseColor}">${esc(p.name)}</strong> · ${fmtDate(p.startY,p.startM,p.startD)}→${fmtDate(p.endY,p.endM,p.endD)}`;
      ph.appendChild(row);
    });
  }

  document.getElementById('tooltip').style.display = 'block';
  moveTT(e);
}
function moveTT(e){
  const tt=document.getElementById('tooltip');
  tt.style.left=Math.min(e.clientX+14,window.innerWidth-230)+'px';
  tt.style.top=(e.clientY-10)+'px';
}
function hideTT(){document.getElementById('tooltip').style.display='none';}

// ── LEGEND ────────────────────────────────────────────────────────────────────
function renderLegend(){
  const leg=document.getElementById('legend'), items=document.getElementById('legend-items');
  items.innerHTML='';
  if(!placements.length){leg.style.display='none';return;}
  leg.style.display='flex';
  const seen=new Set();
  placements.forEach(p=>{
    if(seen.has(p.cardId))return; seen.add(p.cardId);
    const card=cards.find(c=>c.id===p.cardId); if(!card)return;
    if(card.hidden) return;
    let col=card.phases.length
      ?`<div class="legend-phases">${card.phases.map(ph=>`<div class="legend-phase-seg" style="background:${ph.color}"></div>`).join('')}</div>`
      :`<div class="legend-dot" style="background:${card.baseColor}"></div>`;
    const item=document.createElement('div');
    item.className='legend-item';
    item.innerHTML=`${col}<span>${esc(p.name)}</span><span class="legend-remove" onclick="removePlacement(${p.id})">✕</span>`;
    items.appendChild(item);
  });
}

// ── CLEAR ─────────────────────────────────────────────────────────────────────
function clearAll(){
  if(!confirm('¿Borrar todos los proyectos del calendario?'))return;
  placements=[];renderCalendar();renderLegend();persist();
}

// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.getElementById('input-name').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('input-days').focus();});
document.getElementById('input-days').addEventListener('keydown',e=>{if(e.key==='Enter')createCard();});

// ── EXPORT ────────────────────────────────────────────────────────────────────
async function exportAs(format){
  const isPrint = format === 'print-pdf';
  const isJpg   = format === 'jpg';
  const overlay = document.getElementById('export-overlay');
  document.getElementById('export-msg').textContent =
    isJpg   ? 'Generando JPG...' :
    isPrint ? 'Generando PDF para imprimir...' : 'Generando PDF...';
  overlay.style.display = 'flex';

  // Meses activos
  const activeMonths = new Set();
  placements.forEach(p => {
    const start = new Date(p.startY, p.startM, p.startD);
    for (let i = 0; i < p.days; i++) {
      const dt = new Date(start); dt.setDate(dt.getDate() + i);
      if (dt.getFullYear() === YEAR) activeMonths.add(dt.getMonth());
    }
  });

  const EXPORT_W  = 1122; // A4 landscape @ 96dpi
  const bgColor   = isPrint ? '#ffffff' : '#0f0f11';
  const textColor = isPrint ? '#111111' : '#f0f0f0';
  const borderColor = isPrint ? '#d0d0d0' : '#2e2e38';

  let host = null;
  try {
    // ── Contenedor aislado fuera de la vista ──────────────────────────────
    host = document.createElement('div');
    host.style.cssText = `position:fixed;top:-99999px;left:0;width:${EXPORT_W}px;overflow:visible;background:${bgColor};`;
    document.body.appendChild(host);

    // Título
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `font-family:'Syne',sans-serif;font-weight:800;font-size:18px;color:${textColor};padding:12px 16px 8px;`;
    titleEl.textContent = `Calendario ${YEAR}`;
    host.appendChild(titleEl);

    // Clonar el grid
    const origGrid = document.getElementById('months-grid');
    const gridClone = origGrid.cloneNode(true);
    gridClone.style.cssText = `display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 16px 16px;width:100%;box-sizing:border-box;`;
    host.appendChild(gridClone);

    // Ocultar meses sin proyectos
    for (let m = 0; m < 12; m++) {
      if (!activeMonths.has(m)) {
        const b = gridClone.querySelector(`#month-${m}`);
        if (b) b.style.display = 'none';
      }
    }

    // Limpiar estilos incompatibles con html2canvas
    gridClone.querySelectorAll('.day-past').forEach(el => el.classList.remove('day-past'));
    gridClone.querySelectorAll('.day-cell.filled').forEach(el => {
      if (el.style.background && el.style.background.includes('gradient')) {
        const c = el.style.background.match(/#[0-9a-fA-F]{6}|rgb\([^)]+\)/)?.[0] || '#888888';
        el.style.background = c;
      }
    });
    gridClone.querySelectorAll('.range-label').forEach(el => { el.style.backdropFilter = 'none'; });

    // Colores para modo impresión
    if (isPrint) {
      gridClone.querySelectorAll('.month-block').forEach(b => { b.style.background='#f7f7f7'; b.style.border=`1px solid ${borderColor}`; });
      gridClone.querySelectorAll('.month-title,.weekday,.week-num,.day-num').forEach(el => el.style.color = textColor);
      gridClone.querySelectorAll('.day-cell.filled .day-num').forEach(el => el.style.color = 'rgba(0,0,0,0.85)');
      gridClone.querySelectorAll('.range-label').forEach(el => { el.style.color='rgba(0,0,0,0.85)'; el.style.background='rgba(255,255,255,0.9)'; });
      gridClone.querySelectorAll('.week-num').forEach(el => { el.style.color='#555'; el.style.opacity='1'; });
    }

    await new Promise(r => setTimeout(r, 300));

    // ── Capturar ──────────────────────────────────────────────────────────
    const canvas = await html2canvas(host, {
      backgroundColor: bgColor,
      scale: 1,
      useCORS: true,
      logging: false,
      allowTaint: true,
      width: EXPORT_W,
      height: host.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    document.body.removeChild(host);
    host = null;

    const pxW = canvas.width, pxH = canvas.height;

    if (isJpg) {
      const a = document.createElement('a');
      a.download = `planboard-${YEAR}.jpg`;
      a.href = canvas.toDataURL('image/jpeg', .93);
      a.click();
    } else {
      const { jsPDF } = window.jspdf;
      const fname  = isPrint ? `planboard-${YEAR}-print.pdf` : `planboard-${YEAR}.pdf`;
      const pageW  = 297, pageH = 210;
      const pxPerMm = pxW / pageW;

      // Corte entre fila 2 y 3 del grid (entre mes 6 y 7)
      let cutY = pxH;
      const visibleBlocks = Array.from(gridClone.querySelectorAll('.month-block'))
                              .filter(b => b.style.display !== 'none');
      if (visibleBlocks.length > 6) {
        const b6 = visibleBlocks[5], b7 = visibleBlocks[6];
        // offsetTop relativo a gridClone + altura del título
        const titleH = titleEl.offsetHeight || 42;
        cutY = Math.round((b6.offsetTop + b6.offsetHeight + b7.offsetTop) / 2) + titleH;
      }

      const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
      const addSlice = (y0, y1, pg) => {
        const h = y1 - y0;
        const sc = document.createElement('canvas');
        sc.width = pxW; sc.height = h;
        sc.getContext('2d').drawImage(canvas, 0, -y0);
        const imgHmm = pageW * (h / pxW);
        const yOff = Math.max(0, (pageH - imgHmm) / 2);
        if (pg > 0) pdf.addPage();
        pdf.addImage(sc.toDataURL('image/jpeg', .95), 'JPEG', 0, yOff, pageW, Math.min(imgHmm, pageH));
      };

      if (cutY >= pxH) { addSlice(0, pxH, 0); }
      else             { addSlice(0, cutY, 0); addSlice(cutY, pxH, 1); }

      pdf.save(fname);
    }

  } catch(err) {
    alert('Error al exportar: ' + err.message);
  } finally {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    overlay.style.display = 'none';
  }
}

// ── EXPORT WEEK ───────────────────────────────────────────────────────────────
async function exportWeek(format) {
  const isPrint = format === 'print';
  const wm = document.querySelector('.week-modal');
  if (!wm) return;

  const overlay = document.getElementById('export-overlay');
  document.getElementById('export-msg').textContent = isPrint ? 'Generando PDF...' : 'Generando JPG...';
  overlay.style.display = 'flex';

  const root = document.documentElement;
  const savedVars = {};
  if (isPrint) {
    const light = { '--bg':'#ffffff', '--surface':'#f7f7f7', '--surface2':'#ebebeb',
                    '--border':'#d0d0d0', '--text':'#111111', '--muted':'#777777' };
    Object.entries(light).forEach(([k,v]) => {
      savedVars[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    });
    document.querySelectorAll('.week-task-time').forEach(el => { el.dataset._origColor = el.style.color; el.style.color = '#111111'; });
  }

  const origPosition  = wm.style.position;
  const origHeight    = wm.style.height;
  const origMaxHeight = wm.style.maxHeight;
  const origOverflow  = wm.style.overflow;
  const body          = document.getElementById('wm-body');
  const origBodyOF    = body.style.overflowY;
  const origBodyH     = body.style.height;

  wm.style.position  = 'relative';
  wm.style.height    = 'auto';
  wm.style.maxHeight = 'none';
  wm.style.overflow  = 'visible';
  body.style.overflowY = 'visible';
  body.style.height    = 'auto';

  await new Promise(r => setTimeout(r, 200));

  try {
    const bgColor = isPrint ? '#ffffff' : '#1a1a1f';
    const canvas  = await html2canvas(wm, { backgroundColor: bgColor, scale: 2, useCORS: true, logging: false });
    if (!isPrint) {
      const a = document.createElement('a');
      a.download = `semana-${document.getElementById('wm-title').textContent.replace(/\s+/g,'-')}.jpg`;
      a.href = canvas.toDataURL('image/jpeg', 0.95);
      a.click();
    } else {
      const { jsPDF } = window.jspdf;
      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      const pxW = canvas.width, pxH = canvas.height;
      const pageW = 297, pageH = 210;
      const imgH  = pageW * (pxH / pxW);
      const pdf   = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
      pdf.addImage(imgData, 'JPEG', 0, Math.max(0,(pageH-imgH)/2), pageW, Math.min(imgH, pageH));
      const fname = `semana-${document.getElementById('wm-title').textContent.replace(/\s+/g,'-')}.pdf`;
      pdf.save(fname);
    }
  } catch(err) {
    alert('Error al exportar: ' + err.message);
  } finally {
    wm.style.position  = origPosition;
    wm.style.height    = origHeight;
    wm.style.maxHeight = origMaxHeight;
    wm.style.overflow  = origOverflow;
    body.style.overflowY = origBodyOF;
    body.style.height    = origBodyH;
    if (isPrint) {
      Object.entries(savedVars).forEach(([k,v]) => root.style.setProperty(k, v));
      document.querySelectorAll('.week-task-time').forEach(el => { el.style.color = el.dataset._origColor || ''; delete el.dataset._origColor; });
    }
    overlay.style.display = 'none';
  }
}

// ── EXPORT WEEK PES ───────────────────────────────────────────────────────────

function formatearHora(s) {
  if (!s || s.length < 4) return s || '—';
  return s.slice(0,2) + ':' + s.slice(2,4);
}

function formatearFechaPES(fecha) {
  const diasSemana = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const [y, m, d] = fecha.split("-");
  const f = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return diasSemana[f.getDay()] + " " + parseInt(d);
}

function obtenerSemanaLabel(dias) {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  if (!dias.length) return "";
  const [y1, m1, d1] = dias[0].fecha.split("-");
  const [,, d2] = dias[dias.length - 1].fecha.split("-");
  return `Del ${parseInt(d1)} al ${parseInt(d2)} de ${meses[parseInt(m1)-1]} de ${y1}`;
}

function exportWeekPES() {
  if (!weekModal.monday) return;

  const mon = weekModal.monday;
  const result = {};

  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon.getTime() + i * 86400000);
    const k  = dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const tasks = dayTasks[k];
    if (tasks && tasks.length > 0) {
      result[k] = [...tasks]
        .sort((a, b) => (a.desde || '').localeCompare(b.desde || ''))
        .map(t => ({
          id:          t.id,
          name:        t.name        || '',
          desde:       t.desde       || '',
          hasta:       t.hasta       || '',
          duration:    t.duration    || '',
          desc:        t.desc        || '',
          responsable: t.responsable || '',
          apoyos:      t.apoyos      || '',
        }));
    }
  }

  if (!Object.keys(result).length) { showToast('⚠ No hay tareas en esta semana'); return; }

  const weekTitle = document.getElementById('wm-title').textContent
    .replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');

  const blob = new Blob([JSON.stringify({ dayTasks: result }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `PES-${weekTitle}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✓ PES-' + weekTitle + '.json descargado');
}

// ── GOOGLE CALENDAR / ICS EXPORT ─────────────────────────────────────────────
function exportICS() {
  if (!placements.length) { showToast('⚠ No hay proyectos en el calendario'); return; }

  const pad = n => String(n).padStart(2,'0');

  // Format date as YYYYMMDD for ICS (all-day events)
  const icsDate = (y,m,d) => `${y}${pad(m+1)}${pad(d)}`;

  // Add 1 day to end date because ICS DTEND for all-day is exclusive
  const icsEndDate = (y,m,d,extraDays=1) => {
    const dt = new Date(y,m,d); dt.setDate(dt.getDate()+extraDays);
    return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}`;
  };

  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

  let uid = 1;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanBoard 2026//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PlanBoard 2026',
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
  ];

  placements.forEach(p => {
    const card = cards.find(c => c.id === p.cardId);
    if (!card) return;

    if (card.phases.length > 0) {
      // One event per phase
      let cursor = new Date(p.startY, p.startM, p.startD);
      card.phases.forEach((phase, i) => {
        const sy = cursor.getFullYear(), sm = cursor.getMonth(), sd = cursor.getDate();
        lines.push(
          'BEGIN:VEVENT',
          `UID:planboard-${p.id}-phase-${i}-${uid++}@planboard`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${icsDate(sy,sm,sd)}`,
          `DTEND;VALUE=DATE:${icsEndDate(sy,sm,sd,phase.days)}`,
          `SUMMARY:${esc(card.name)} — ${esc(phase.name)}`,
          `DESCRIPTION:Proyecto: ${esc(card.name)}\\nFase ${i+1}: ${esc(phase.name)}\\nDuración: ${phase.days} días`,
          'END:VEVENT'
        );
        cursor.setDate(cursor.getDate() + phase.days);
      });
    } else {
      // Single event for the whole card
      lines.push(
        'BEGIN:VEVENT',
        `UID:planboard-${p.id}-${uid++}@planboard`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(p.startY,p.startM,p.startD)}`,
        `DTEND;VALUE=DATE:${icsEndDate(p.endY,p.endM,p.endD)}`,
        `SUMMARY:${esc(card.name)}`,
        `DESCRIPTION:Duración: ${card.days} días`,
        'END:VEVENT'
      );
    }
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `planboard-${YEAR}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✓ Archivo .ics descargado — importalo en Google Calendar');
}

// ── DATA SOURCE — GitHub JSON ─────────────────────────────────────────────────
// Edit this URL to point to your raw JSON file on GitHub.
// Example: https://raw.githubusercontent.com/TU-USUARIO/TU-REPO/main/planboard-data.json
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/nms47/Planner/main/planboard-data.json';

// ── Status badge ──────────────────────────────────────────────────────────────
function setSyncStatus(status, detail) {
  const dot   = document.getElementById('sync-dot');
  const text  = document.getElementById('sync-text');
  const badge = document.getElementById('sync-status');
  if (!dot) return;
  const map = {
    loading:  { bg: '#fbbf24', label: 'Cargando...' },
    github:   { bg: '#4ade80', label: 'Datos desde GitHub' },
    local:    { bg: '#60a5fa', label: 'Datos locales' },
    empty:    { bg: '#888',    label: 'Sin datos' },
    error:    { bg: '#ff6b6b', label: detail || 'Error al cargar' },
  };
  const s = map[status] || map.empty;
  dot.style.background = s.bg;
  text.textContent     = s.label;
  if (badge) badge.classList.toggle('loading', status === 'loading');
}
setSyncStatus('loading');

// ── Apply a plain data object to the app state ────────────────────────────────
function applyData(data) {
  const rawCards = Array.isArray(data.cards) ? data.cards
    : (data.cards && typeof data.cards === 'object' ? Object.values(data.cards) : []);
  cards      = rawCards.map(c => sanitizeCard(c));
  placements = Array.isArray(data.placements) ? data.placements
    : (data.placements ? Object.values(data.placements) : []);
  idCounter  = parseInt(data.idCounter) || 0;

  const rawTasks = (data.dayTasks && typeof data.dayTasks === 'object') ? data.dayTasks : {};
  dayTasks = {};
  Object.keys(rawTasks).forEach(k => {
    const list = Array.isArray(rawTasks[k]) ? rawTasks[k]
      : (rawTasks[k] && typeof rawTasks[k] === 'object' ? Object.values(rawTasks[k]) : []);
    if (list.length > 0) dayTasks[k] = list.map(t => ({
      id: t.id || 0, name: t.name || '', desde: t.desde || '',
      hasta: t.hasta || '', duration: t.duration || '',
      desc: t.desc || '', responsable: t.responsable || '', apoyos: t.apoyos || '',
    }));
  });

  try { localStorage.setItem('planboard_cache', JSON.stringify({ cards, placements, idCounter, dayTasks, _ts: Date.now() })); } catch(e) {}
  renderCards(); renderCalendar(); renderLegend();
  if (typeof dayModal  !== 'undefined' && dayModal  && dayModal.open)  renderDayModal();
  if (typeof weekModal !== 'undefined' && weekModal && weekModal.open) renderWeekModal();
}

// ── Load from localStorage cache ──────────────────────────────────────────────
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

// ── Fetch JSON from GitHub and boot the app ───────────────────────────────────
(async function bootApp() {
  // Skip fetch if URL is still the placeholder
  const isPlaceholder = GITHUB_JSON_URL.includes('TU-USUARIO');

  if (!isPlaceholder) {
    try {
      const resp = await fetch(GITHUB_JSON_URL + '?_=' + Date.now(), { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      applyData(data);
      setSyncStatus('github');
      return;
    } catch(err) {
      console.warn('No se pudo cargar el JSON de GitHub:', err.message);
      // Fall through to local cache
    }
  }

  // Try local cache
  const hadCache = loadLocalCache();
  if (hadCache) {
    setSyncStatus('local');
    if (!isPlaceholder) showToast('⚠ Sin conexión a GitHub — mostrando caché local');
  } else {
    setSyncStatus('empty');
    renderCards(); renderCalendar(); renderLegend();
    try { showBannerEmpty(); } catch(e) {}
  }
})().catch(() => {
  // Safety net: si bootApp lanza cualquier error, igual renderizamos el calendario vacío
  setSyncStatus('empty');
  try { renderCards(); renderCalendar(); renderLegend(); } catch(e) {}
});

function saveSession() {
  // Saves to localStorage as working cache
  try { localStorage.setItem('planboard_cache', JSON.stringify({ cards, placements, idCounter, dayTasks, _ts: Date.now() })); } catch(e) {}
}

function loadSession() {
  return loadLocalCache();
}

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

function sanitizeCard(c) {
  // Normalize a card object — handles Firebase object-arrays and missing fields
  const phases = (() => {
    if (!c.phases) return [];
    if (Array.isArray(c.phases)) return c.phases.map(p => ({
      name: p.name || '',
      days: parseInt(p.days) || 1,
      color: p.color || c.baseColor || '#e8ff47'
    }));
    // Firebase may serialize arrays as objects {"0":{...},"1":{...}}
    const keys = Object.keys(c.phases).filter(k => !isNaN(k)).sort((a,b) => a-b);
    return keys.map(k => {
      const p = c.phases[k];
      return { name: p.name || '', days: parseInt(p.days) || 1, color: p.color || c.baseColor || '#e8ff47' };
    });
  })();
  return {
    id:        c.id        || 0,
    name:      c.name      || 'Sin nombre',
    days:      parseInt(c.days) || 1,
    baseColor: c.baseColor || '#e8ff47',
    phases,
    hidden:    c.hidden    || false,
    category:  c.category  || '',
  };
}

function importSession() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = e => {
    const file = e.target.files[0];
    document.body.removeChild(input);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = ev.target.result;
        if (!raw) throw new Error('El archivo está vacío');
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') throw new Error('Formato inválido');

        // Support both array and Firebase object-of-arrays for cards
        const rawCards = Array.isArray(data.cards)
          ? data.cards
          : (data.cards && typeof data.cards === 'object' ? Object.values(data.cards) : null);
        if (!rawCards) throw new Error('El archivo no contiene tarjetas válidas');

        cards      = rawCards.map(c => sanitizeCard(c));
        placements = Array.isArray(data.placements)
          ? data.placements
          : (data.placements ? Object.values(data.placements) : []);
        idCounter  = parseInt(data.idCounter) || 0;

        // Sanitize dayTasks: Firebase serializes inner arrays as numeric-keyed objects
        const rawTasks = (data.dayTasks && typeof data.dayTasks === 'object') ? data.dayTasks : {};
        dayTasks = {};
        Object.keys(rawTasks).forEach(k => {
          const list = Array.isArray(rawTasks[k])
            ? rawTasks[k]
            : (rawTasks[k] && typeof rawTasks[k] === 'object' ? Object.values(rawTasks[k]) : []);
          if (list.length > 0) dayTasks[k] = list.map(t => ({
            id: t.id || 0, name: t.name || '', desde: t.desde || '',
            hasta: t.hasta || '', duration: t.duration || '',
            desc: t.desc || '', responsable: t.responsable || '', apoyos: t.apoyos || '',
          }));
        });

        // Recalculate max idCounter so new items don't collide
        const allTaskIds = Object.values(dayTasks).flat().map(t => t.id || 0);
        const maxId = Math.max(0, ...cards.map(c=>c.id), ...placements.map(p=>p.id), ...allTaskIds);
        if (maxId > idCounter) idCounter = maxId;

        try { persist(); } catch(pe) { console.warn('persist error after import:', pe); }
        renderCards(); renderCalendar(); renderLegend();
        const taskCount = Object.values(dayTasks).reduce((s,a) => s + a.length, 0);
        setSyncStatus('local');
        showToast('Sesion importada — ' + cards.length + ' tarjeta' + (cards.length!==1?'s':'') + (taskCount ? ', ' + taskCount + ' tarea' + (taskCount!==1?'s':'') : ''));
      } catch(err) {
        console.error('Import error:', err);
        alert('No se pudo cargar el archivo: ' + err.message);
      }
    };
    reader.onerror = () => alert('No se pudo leer el archivo');
    reader.readAsText(file);
  };
  input.click();
}

function showToast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration || 2800);
}

function showBannerEmpty() {
  const el = document.getElementById('empty-msg');
  if (!el) return;
  el.style.display = 'block';
  document.getElementById('empty-icon').textContent = '📭';
  document.getElementById('empty-text').innerHTML =
    'Base de datos vacía<br>' +
    '<span style="font-size:10px;color:var(--muted);line-height:1.6">Cargá una sesión guardada (.json)<br>para sincronizar con todos</span>';
  const loadBtn = document.getElementById('empty-load-btn');
  if (loadBtn) loadBtn.style.display = 'inline-block';
}

function persist() {
  saveSession(); // saves to localStorage cache only
}

// ── EDITOR MODE ───────────────────────────────────────────────────────────────
let _editorMode = false;

function toggleEditorMode() {
  _editorMode = !_editorMode;
  document.body.classList.toggle('readonly', !_editorMode);
  if (_editorMode) {
    showToast('🔓 Modo editor activado');
    if (window.innerWidth > 600 && !sidebarOpen) toggleSidebar();
    else if (window.innerWidth > 600) {
      document.getElementById('main-sidebar').style.display = '';
    }
  } else {
    showToast('🔒 Modo lectura');
    if (window.innerWidth > 600 && sidebarOpen) toggleSidebar();
  }
}

// Start in read-only mode
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('readonly');
  if (typeof sidebarOpen !== 'undefined' && sidebarOpen) toggleSidebar();
  loadMaterias();
  loadMateriaResponsables();
  renderQuickChips();

  // Auto-fill responsable when task name matches a known materia
  document.getElementById('tf-name').addEventListener('input', () => {
    if (editingTaskId !== null) return;
    const mat = getMateriaForTaskName(document.getElementById('tf-name').value.trim());
    const respField = document.getElementById('tf-responsable');
    if (mat && materiaResponsables[mat] && !respField.value.trim()) {
      respField.value = materiaResponsables[mat];
    }
  });
});


// ── INIT ──────────────────────────────────────────────────────────────────────
// Render empty skeleton immediately; bootApp() (async) will populate with
// data from GitHub JSON or fall back to localStorage cache.
renderCards();
renderCalendar();
let weekModal = { open: false, monday: null };
let weekViewMode = 'list'; // 'list' | 'grid'

function toggleWeekView() {
  weekViewMode = weekViewMode === 'list' ? 'grid' : 'list';
  const btn = document.getElementById('wm-view-toggle');
  if (btn) btn.textContent = weekViewMode === 'grid' ? '☰ Lista' : '⊞ Grid';
  renderWeekModal();
}

function getMondayOfDate(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function openWeekModal(mondayDate) {
  weekModal.monday = getMondayOfDate(mondayDate);
  weekModal.open = true;
  renderWeekModal();
  document.getElementById('week-modal-backdrop').classList.add('open');
}

function closeWeekModal() {
  document.getElementById('week-modal-backdrop').classList.remove('open');
  weekModal.open = false;
}

function onWeekBackdropClick(e) {
  if (e.target === document.getElementById('week-modal-backdrop')) closeWeekModal();
}

function shiftWeek(delta) {
  weekModal.monday = new Date(weekModal.monday.getTime() + delta * 7 * 86400000);
  renderWeekModal();
}

function renderWeekModal() {
  const mon = weekModal.monday;
  const weekNum = (() => {
    const d = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - y) / 86400000) + 1) / 7);
  })();

  const filterBadge = activeFilter ? `<span class="filter-badge">🔍 ${esc(activeFilter)}</span>` : '';
  document.getElementById('wm-title').innerHTML =
    `Semana ${weekNum} — ${mon.getDate()} ${MONTHS[mon.getMonth()]} ${mon.getFullYear()}${filterBadge}`;

  const body = document.getElementById('wm-body');
  body.innerHTML = '';

  if (weekViewMode === 'grid') {
    renderWeekGridView(body, mon);
  } else {
    renderWeekListView(body, mon);
  }
}

function renderWeekListView(body, mon) {
  const today = new Date(); today.setHours(0,0,0,0);
  body.className = 'week-modal-body';

  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon.getTime() + i * 86400000);
    const y2 = dt.getFullYear(), m2 = dt.getMonth(), d2 = dt.getDate();
    const k = dateKey(y2, m2, d2);
    const tasks = (dayTasks[k] || []).slice().sort((a,b) => (a.desde||'0000').localeCompare(b.desde||'0000'));
    const isToday = dt.getTime() === today.getTime();

    const col = document.createElement('div');
    col.className = 'week-day-col';

    const hdr = document.createElement('div');
    hdr.className = 'week-day-header';
    hdr.innerHTML = `
      <div class="week-day-name">${DAY_NAMES[dt.getDay()]}</div>
      <div class="week-day-num${isToday ? ' today' : ''}">${d2}</div>`;
    hdr.addEventListener('click', () => { closeWeekModal(); openDayModal(dt); });
    col.appendChild(hdr);

    const taskArea = document.createElement('div');
    taskArea.className = 'week-day-tasks';

    if (!tasks.length) {
      taskArea.innerHTML = `<div class="week-day-empty">Sin tareas</div>`;
    } else {
      tasks.forEach((t, ti) => {
        const COLORS = ['#e8ff47','#47c8ff','#ffb347','#b8ff9f','#d1a3ff','#ff9dc6','#4dffd2','#ffd147'];
        const color = getTaskColor(t, COLORS[ti % COLORS.length]);
        const row = document.createElement('div');
        row.className = 'week-task-row' + (taskMatchesFilter(t) ? ' task-filtered' : '');
        row.style.borderLeft = `3px solid ${color}`;
        row.style.background = color + '0f';
        row.innerHTML = `
          <div class="week-task-time">${t.desde || ''}${t.hasta ? '–'+t.hasta : ''}</div>
          <div class="week-task-name">${esc(t.name)}</div>
          ${t.desc ? `<div class="week-task-desc">${esc(t.desc)}</div>` : ''}
          ${(t.responsable||t.apoyos) ? `<div class="week-task-people">${[t.responsable, t.apoyos].filter(Boolean).join(' · ')}</div>` : ''}`;
        taskArea.appendChild(row);
      });
    }

    col.appendChild(taskArea);
    body.appendChild(col);
  }
}

function renderWeekGridView(body, mon) {
  const today = new Date(); today.setHours(0,0,0,0);
  body.className = 'week-modal-body grid-view';
  const HOUR_H = 48; // px per hour
  const COLORS = ['#e8ff47','#47c8ff','#ffb347','#b8ff9f','#d1a3ff','#ff9dc6','#4dffd2','#ffd147'];

  // ── Header row ──────────────────────────────────────────────────────────
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;flex-shrink:0;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20;background:var(--surface2)';

  // Corner cell
  const corner = document.createElement('div');
  corner.style.cssText = `width:52px;flex-shrink:0;border-right:1px solid var(--border)`;
  headerRow.appendChild(corner);

  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon.getTime() + i * 86400000);
    const isToday = dt.getTime() === today.getTime();
    const th = document.createElement('div');
    th.className = 'wg-day-header';
    th.style.flex = '1';
    th.innerHTML = `<div class="wg-day-name">${DAY_NAMES[dt.getDay()]}</div>
      <div class="wg-day-num${isToday ? ' today' : ''}">${dt.getDate()}</div>`;
    th.addEventListener('click', () => { closeWeekModal(); openDayModal(dt); });
    headerRow.appendChild(th);
  }
  body.appendChild(headerRow);

  // ── Scrollable grid ──────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.className = 'wg-container';

  // Hours column
  const hoursCol = document.createElement('div');
  hoursCol.className = 'wg-hours-col';
  for (let h = 0; h < 24; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'wg-hour-label';
    lbl.textContent = String(h).padStart(2,'0') + ':00';
    hoursCol.appendChild(lbl);
  }
  // Extra label for 24:00
  const lbl24 = document.createElement('div');
  lbl24.className = 'wg-hour-label';
  lbl24.textContent = '24:00';
  hoursCol.appendChild(lbl24);
  container.appendChild(hoursCol);

  // Days area
  const daysArea = document.createElement('div');
  daysArea.className = 'wg-days-area';

  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon.getTime() + i * 86400000);
    const k = dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const tasks = (dayTasks[k] || []);

    const dayCol = document.createElement('div');
    dayCol.className = 'wg-day-col';

    const gridBody = document.createElement('div');
    gridBody.className = 'wg-grid-body';
    gridBody.style.height = (HOUR_H * 24) + 'px';

    // Hour lines
    for (let h = 0; h <= 24; h++) {
      const line = document.createElement('div');
      line.className = 'wg-hour-line';
      line.style.top = (h * HOUR_H) + 'px';
      gridBody.appendChild(line);
      // Half-hour line
      if (h < 24) {
        const half = document.createElement('div');
        half.className = 'wg-hour-line half';
        half.style.top = (h * HOUR_H + HOUR_H / 2) + 'px';
        gridBody.appendChild(half);
      }
    }

    // Current time line (only for today)
    const isToday = dt.getTime() === today.getTime();
    if (isToday) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const nowLine = document.createElement('div');
      nowLine.className = 'wg-now-line';
      nowLine.style.top = ((nowMins / 60) * HOUR_H) + 'px';
      gridBody.appendChild(nowLine);
    }

    // Events
    tasks.forEach((t, ti) => {
      const color = getTaskColor(t, COLORS[ti % COLORS.length]);
      const desde = militaryToMinutes(t.desde || '0000') ?? 0;
      const hasta = t.hasta ? (militaryToMinutes(t.hasta) ?? desde + 60) : desde + 60;
      const durationMins = Math.max(hasta - desde, 30); // min 30 min height

      const top = (desde / 60) * HOUR_H;
      const height = Math.max((durationMins / 60) * HOUR_H, 24);

      const ev = document.createElement('div');
      ev.className = 'wg-event' + (taskMatchesFilter(t) ? ' task-filtered' : '');
      ev.style.cssText = `top:${top}px;height:${height}px;background:${color}18;border-color:${color};color:var(--text)`;
      ev.innerHTML = `
        <div class="wg-event-time" style="color:${color}">${t.desde||''}${t.hasta?'–'+t.hasta:''}</div>
        <div class="wg-event-name">${esc(t.name)}</div>
        ${t.desc && height > 50 ? `<div class="wg-event-desc">${esc(t.desc)}</div>` : ''}
        ${(t.responsable||t.apoyos) && height > 36 ? `<div class="wg-event-people">👤 ${[t.responsable,t.apoyos].filter(Boolean).join(' · ')}</div>` : ''}`;
      ev.addEventListener('click', () => { closeWeekModal(); openDayModal(dt); });
      gridBody.appendChild(ev);
    });

    dayCol.appendChild(gridBody);
    daysArea.appendChild(dayCol);
  }

  container.appendChild(daysArea);
  body.appendChild(container);

  // Scroll to 7am on open
  setTimeout(() => { container.scrollTop = 7 * HOUR_H; }, 50);
}

document.addEventListener('keydown', e => {
  if (!weekModal.open) return;
  if (e.key === 'Escape') { closeWeekModal(); return; }
  if (e.key === 'ArrowLeft')  shiftWeek(-1);
  if (e.key === 'ArrowRight') shiftWeek(1);
});

// ── QUICK TASKS ───────────────────────────────────────────────────────────────
// Each entry is a button that inserts one or more tasks at once.
const QUICK_TASKS = [
  {
    label: 'DDD',
    tasks: [
      { name: 'Descanso',  desde: '',     hasta: '',     responsable: 'Diana', apoyos: '' },
      { name: 'Diana',     desde: '0600', hasta: '0630', responsable: 'Diana', apoyos: '' },
      { name: 'Desayuno',  desde: '0630', hasta: '0700', responsable: 'SS',    apoyos: '' },
    ]
  },
  {
    label: 'Almuerzo',
    tasks: [
      { name: 'Almuerzo',  desde: '1200', hasta: '1300', responsable: 'SS', apoyos: '' },
    ]
  },
  {
    label: 'Cena',
    tasks: [
      { name: 'Cena',      desde: '1900', hasta: '2100', responsable: 'SS', apoyos: '' },
    ]
  },
];

function renderQuickChips() {
  const container = document.getElementById('quick-chips');
  if (!container) return;
  container.innerHTML = '';
  QUICK_TASKS.forEach(qt => {
    const btn = document.createElement('button');
    btn.className = 'quick-chip';
    btn.textContent = '+ ' + qt.label;
    btn.type = 'button';
    btn.onclick = () => addQuickTask(qt);
    container.appendChild(btn);
  });
}

function addQuickTask(preset) {
  if (!dayModal.open) return;
  const k = dateKey(dayModal.y, dayModal.m, dayModal.d);
  if (!dayTasks[k]) dayTasks[k] = [];
  preset.tasks.forEach(t => {
    let duration = '';
    if (t.desde && t.hasta) {
      const mins = militaryToMinutes(t.hasta) - militaryToMinutes(t.desde);
      duration = minutesToDuration(mins) || '';
    }
    dayTasks[k].push({ id: ++idCounter, name: t.name, desde: t.desde,
      hasta: t.hasta, duration, desc: '', responsable: t.responsable, apoyos: t.apoyos || '' });
  });
  persist();
  renderDayTasks();
  const count = preset.tasks.length;
  showToast('✓ ' + preset.label + (count > 1 ? ' (' + count + ' actividades)' : '') + ' agregado');
}

// ── DAY MODAL ─────────────────────────────────────────────────────────────────
const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function openDayModal(date) {
  const now = date || new Date();
  dayModal.y = now.getFullYear();
  dayModal.m = now.getMonth();
  dayModal.d = now.getDate();
  dayModal.editMode = false;
  renderDayModal();
  document.getElementById('day-modal-backdrop').classList.add('open');
  dayModal.open = true;
}

function closeDayModal() {
  document.getElementById('day-modal-backdrop').classList.remove('open');
  dayModal.open = false;
  editingTaskId = null;
  document.querySelector('.task-form-add').textContent = '+ Agregar';
}

function onBackdropClick(e) {
  if (e.target === document.getElementById('day-modal-backdrop')) closeDayModal();
}

function shiftDay(delta) {
  editingTaskId = null;
  document.querySelector('.task-form-add').textContent = '+ Agregar';
  const dt = new Date(dayModal.y, dayModal.m, dayModal.d + delta);
  dayModal.y = dt.getFullYear();
  dayModal.m = dt.getMonth();
  dayModal.d = dt.getDate();
  renderDayModal();
  const el = document.getElementById('dm-tasks');
  const animClass = delta > 0 ? 'day-slide-left' : 'day-slide-right';
  el.classList.remove('day-slide-left', 'day-slide-right');
  void el.offsetWidth;
  el.classList.add(animClass);
  el.addEventListener('animationend', () => el.classList.remove(animClass), { once: true });
}

function toggleDayEditMode() {
  dayModal.editMode = !dayModal.editMode;
  const btn = document.getElementById('dm-edit-btn');
  btn.textContent = dayModal.editMode ? '👁 Solo lectura' : '✎ Editar';
  btn.classList.toggle('active', dayModal.editMode);
  document.getElementById('dm-form').style.display = dayModal.editMode ? 'flex' : 'none';
  if (dayModal.editMode) document.getElementById('tf-name').focus();
  renderDayTasks();
}

function renderDayModal() {
  const {y, m, d} = dayModal;
  const dt = new Date(y, m, d);

  // Header
  document.getElementById('dm-daynum').textContent = d;
  document.getElementById('dm-dayname').textContent = DAY_NAMES[dt.getDay()];
  document.getElementById('dm-monthyear').innerHTML = `${MONTHS[m]} ${y}${activeFilter ? `<span class="filter-badge">🔍 ${esc(activeFilter)}</span>` : ''}`;

  // Edit btn state
  const editBtn = document.getElementById('dm-edit-btn');
  editBtn.textContent = dayModal.editMode ? '👁 Solo lectura' : '✎ Editar';
  editBtn.classList.toggle('active', dayModal.editMode);
  document.getElementById('dm-form').style.display = dayModal.editMode ? 'flex' : 'none';

  // Projects active on this day
  const k = dateKey(y, m, d);
  const fills = (window._lastFmap || {})[k] || [];
  const projEl = document.getElementById('dm-projects');
  projEl.innerHTML = '';
  if (fills.length) {
    fills.forEach(f => {
      const chip = document.createElement('div');
      chip.className = 'day-proj-chip';
      chip.style.cssText = `color:${f.card.baseColor};border-color:${f.card.baseColor}22;background:${f.card.baseColor}15`;
      chip.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${f.card.baseColor};display:inline-block"></span>${esc(f.card.name)}`;
      projEl.appendChild(chip);
    });
    projEl.style.display = '';
  } else {
    projEl.style.display = 'none';
  }

  renderDayTasks();
  renderSideCards();
}

function renderDayTasks() {
  const {y, m, d, editMode} = dayModal;
  const k = dateKey(y, m, d);
  const tasks = dayTasks[k] || [];
  const container = document.getElementById('dm-tasks');
  container.innerHTML = '';

  if (!tasks.length) {
    container.innerHTML = `<div class="day-empty">${editMode ? 'Agregá la primera tarea del día 👆' : 'Sin tareas para este día'}</div>`;
    return;
  }

  const sorted = [...tasks].sort((a,b) => (a.desde||'0000').localeCompare(b.desde||'0000'));
  const COLORS = ['#e8ff47','#47c8ff','#ffb347','#b8ff9f','#d1a3ff','#ff9dc6','#4dffd2','#ffd147'];

  const table = document.createElement('table');
  table.className = 'day-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-hora">Hora</th>
        <th class="col-actividad">Actividad</th>
        <th class="col-resp">Responsable</th>
        <th class="col-apoyos">Apoyos</th>
        ${editMode ? '<th class="col-actions"></th>' : ''}
      </tr>
    </thead>
    <tbody id="day-table-body"></tbody>`;

  container.appendChild(table);
  const tbody = document.getElementById('day-table-body');

  sorted.forEach((task, i) => {
    const color = getTaskColor(task, COLORS[i % COLORS.length]);
    const isEditing = editingTaskId === task.id;
    const horaStr = task.desde
      ? (task.hasta ? `${task.desde}–${task.hasta}` : task.desde)
      : (task.time || '—');

    const tr = document.createElement('tr');
    if (isEditing) tr.classList.add('editing-row');
    if (taskMatchesFilter(task)) tr.classList.add('task-filtered');
    tr.style.background = color + '12'; // very subtle tint

    tr.innerHTML = `
      <td class="col-hora">
        <span style="display:inline-block;width:3px;height:100%;min-height:32px;background:${color};border-radius:2px;margin-right:7px;vertical-align:middle"></span>${horaStr}
        ${task.duration ? `<div style="font-size:9px;color:var(--muted);margin-top:2px;padding-left:10px">⏱ ${esc(task.duration)}</div>` : ''}
      </td>
      <td>
        <div class="dt-name">${esc(task.name)}</div>
        ${task.desc ? `<div class="dt-desc">${esc(task.desc)}</div>` : ''}
      </td>
      <td class="col-resp"><span class="dt-person">${esc(task.responsable || '—')}</span></td>
      <td class="col-apoyos"><span class="dt-person">${esc(task.apoyos || '—')}</span></td>
      ${editMode ? `
        <td>
          <div class="dt-actions">
            <button class="dt-btn" title="Editar" onclick="startEditDayTask('${k}',${task.id})">✎</button>
            <button class="dt-btn del" title="Eliminar" onclick="deleteDayTask('${k}',${task.id})">✕</button>
          </div>
        </td>` : ''}`;

    tbody.appendChild(tr);
  });
}



// renderSideCards → alias de renderCards (función correcta)
function renderSideCards() { renderCards(); }

function parseMilitary(s) {
  // Accept "0700" or "700" → returns {h, m} or null
  const clean = s.replace(/\D/g,'').padStart(4,'0');
  if (clean.length !== 4) return null;
  const h = parseInt(clean.slice(0,2)), m = parseInt(clean.slice(2,4));
  if (h > 23 || m > 59) return null;
  return {h, m};
}

function militaryToMinutes(s) {
  const p = parseMilitary(s); if (!p) return null;
  return p.h * 60 + p.m;
}

function minutesToDuration(mins) {
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

let editingTaskId = null; // id of task being edited, or null

function startEditDayTask(k, id) {
  const task = (dayTasks[k] || []).find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('tf-name').value        = task.name || '';
  document.getElementById('tf-desde').value       = task.desde || '';
  document.getElementById('tf-hasta').value       = task.hasta || '';
  document.getElementById('tf-desc').value        = task.desc || '';
  document.getElementById('tf-responsable').value = task.responsable || '';
  document.getElementById('tf-apoyos').value      = task.apoyos || '';
  // Update button label
  document.querySelector('.task-form-add').textContent = '✓ Guardar';
  // Ensure edit mode is on and form visible
  if (!dayModal.editMode) toggleDayEditMode();
  document.getElementById('tf-name').focus();
}


function addDayTask() {
  const name = document.getElementById('tf-name').value.trim();
  if (!name) { flash('tf-name'); return; }
  const desdeRaw = document.getElementById('tf-desde').value.trim();
  const hastaRaw = document.getElementById('tf-hasta').value.trim();

  // Validate military time if provided
  let desde = '', hasta = '', duration = '';
  if (desdeRaw) {
    const p = parseMilitary(desdeRaw);
    if (!p) { flash('tf-desde'); return; }
    desde = String(p.h).padStart(2,'0') + String(p.m).padStart(2,'0');
  }
  if (hastaRaw) {
    const p = parseMilitary(hastaRaw);
    if (!p) { flash('tf-hasta'); return; }
    hasta = String(p.h).padStart(2,'0') + String(p.m).padStart(2,'0');
  }
  if (desde && hasta) {
    const mins = militaryToMinutes(hasta) - militaryToMinutes(desde);
    duration = minutesToDuration(mins) || '';
  }

  const desc        = document.getElementById('tf-desc').value.trim();
  const responsable = document.getElementById('tf-responsable').value.trim();
  const apoyos      = document.getElementById('tf-apoyos').value.trim();
  const k = dateKey(dayModal.y, dayModal.m, dayModal.d);
  if (!dayTasks[k]) dayTasks[k] = [];

  if (editingTaskId !== null) {
    const task = dayTasks[k].find(t => t.id === editingTaskId);
    if (task) Object.assign(task, { name, desde, hasta, duration, desc, responsable, apoyos });
    editingTaskId = null;
    document.querySelector('.task-form-add').textContent = '+ Agregar';
  } else {
    dayTasks[k].push({ id: ++idCounter, name, desde, hasta, duration, desc, responsable, apoyos });
  }

  // Remember the responsable for this materia
  const _mat = getMateriaForTaskName(name);
  if (_mat && responsable) saveMateriaResponsable(_mat, responsable);

  ['tf-name','tf-desde','tf-hasta','tf-desc','tf-responsable','tf-apoyos'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('tf-name').focus();
  persist();
  renderDayTasks();
  renderSideCards();
}

function deleteDayTask(k, id) {
  if (!dayTasks[k]) return;
  dayTasks[k] = dayTasks[k].filter(t => t.id !== id);
  persist();
  renderDayTasks();
}

// Keyboard nav for day modal
document.addEventListener('keydown', e => {
  if (!dayModal.open) return;
  if (e.key === 'Escape') { closeDayModal(); return; }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Enter' && (e.target.id === 'tf-name' || e.target.id === 'tf-hasta')) { addDayTask(); return; }
    return;
  }
  if (e.key === 'ArrowLeft')  shiftDay(-1);
  if (e.key === 'ArrowRight') shiftDay(1);
});

// Swipe táctil para cambiar día en móvil
(function() {
  let startX = 0, startY = 0;
  const card = document.getElementById('day-card-main');
  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  card.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 60) {
      shiftDay(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
