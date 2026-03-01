/* Surrey Referral Pathways — hybrid-loader.js
   Fully self-contained: data loading, index building, rendering,
   search, filters, navigation, USC panel. No external lookup needed.
   ------------------------------------------------------------------ */

const DATA_URL = "https://raw.githubusercontent.com/boxofbrokentoys-oss/surrey-referrals-data/refs/heads/main/master_normalised_v2.json";

let DATA = null, INDEX = [];

/* ─── tiny DOM helpers ─── */
const by   = q => document.querySelector(q);
const byId = id => document.getElementById(id);
const el   = (t, cls) => { const e = document.createElement(t); if (cls) e.className = cls; return e; };

/* ─── state ─── */
let state = {
  area:       '',       // '' = all
  age:        'all',    // 'all' | 'adult' | 'paeds'
  ageSlider:  0,
  activeTab:  'ur',     // 'ur' | 'usc'
  activeView: 'home',   // 'home' | 'category' | 'results'
  activeCat:  null,     // displayCategory string
  activeSub:  null,     // displaySpecialty string
};

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════════════════════════ */
async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
    buildIndex(DATA);
    render();
  } catch (err) {
    byId('category-grid').innerHTML = `
      <div class='empty-state' style='grid-column:1/-1'>
        <div class='big'>⚠️</div>
        <p>Could not load service data.<br>
        <small style='color:var(--ink-3)'>${err.message}</small></p>
      </div>`;
  }
}

function buildIndex(data) {
  INDEX.length = 0;
  for (const [topic, sub_dict] of Object.entries(data)) {
    for (const [cond, svcs] of Object.entries(sub_dict)) {
      if (!Array.isArray(svcs)) continue;
      for (const s of svcs) {
        INDEX.push({ ...s, _topic: topic, _cond: cond });
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   FILTERING HELPERS
══════════════════════════════════════════════════════════════ */
function matchesArea(rec) {
  if (!state.area) return true;
  const r = (rec.region || '').trim();
  return r === state.area || r === '';
}

function matchesAge(rec) {
  if (state.age === 'all' && state.ageSlider === 0) return true;
  const mn = rec.ageMin ?? 0;
  const mx = rec.ageMax ?? 999;

  if (state.ageSlider > 0) {
    const a = state.ageSlider;
    return mn <= a && mx >= a;
  }
  if (state.age === 'adult') return mx >= 18;
  if (state.age === 'paeds') return mn < 18;
  return true;
}

function matchesUsc(rec) {
  return rec.usc === true;
}

/* ══════════════════════════════════════════════════════════════
   DERIVED CATEGORY DATA (from new displayCategory fields)
══════════════════════════════════════════════════════════════ */

/* Emoji + colour map for display categories */
const CAT_META = {
  'Allergy & Immunology':       { emoji: '🤧', color: '#0B7A6E' },
  'Breast Surgery':             { emoji: '🎗️', color: '#C0396E' },
  'Cardiology':                 { emoji: '❤️', color: '#C0182E' },
  'Dentistry & Oral Surgery':   { emoji: '🦷', color: '#0B6FA4' },
  'Dermatology':                { emoji: '🩺', color: '#B45309' },
  'Diagnostic Services':        { emoji: '🔬', color: '#5B21B6' },
  'Dietetics & Nutrition':      { emoji: '🥗', color: '#0A7048' },
  'ENT & Audiology':            { emoji: '👂', color: '#0B4F6C' },
  'Endocrinology & Metabolic':  { emoji: '⚗️', color: '#B45309' },
  'Gastroenterology':           { emoji: '🫁', color: '#2D6A4F' },
  'GI & Liver':                 { emoji: '🫁', color: '#2D6A4F' },
  'General Medicine':           { emoji: '🏥', color: '#4A5568' },
  'General Surgery':            { emoji: '🔪', color: '#6B3A2A' },
  'Genetics':                   { emoji: '🧬', color: '#5B21B6' },
  'Geriatrics & Elderly Care':  { emoji: '🌿', color: '#374151' },
  'Gynaecology & Obstetrics':   { emoji: '🌸', color: '#BE185D' },
  'Haematology':                { emoji: '🩸', color: '#991B1B' },
  'Infectious Diseases':        { emoji: '🦠', color: '#065F46' },
  'Mental Health':              { emoji: '🧠', color: '#4C1D95' },
  'MSK & Orthopaedics':         { emoji: '🦴', color: '#1D4ED8' },
  'Nephrology':                 { emoji: '💧', color: '#0369A1' },
  'Neurology':                  { emoji: '⚡', color: '#6D28D9' },
  'Ophthalmology':              { emoji: '👁️', color: '#0B4F6C' },
  'Paediatrics':                { emoji: '👶', color: '#047857' },
  'Pain Management':            { emoji: '💊', color: '#92400E' },
  'Physiotherapy':              { emoji: '🏃', color: '#065F46' },
  'Plastics & Burns':           { emoji: '🩹', color: '#B45309' },
  'Renal & Urology':            { emoji: '💧', color: '#1E40AF' },
  'Respiratory':                { emoji: '🫀', color: '#0B6FA4' },
  'Rheumatology':               { emoji: '🦿', color: '#7C3AED' },
  'Speech & Language Therapy':  { emoji: '💬', color: '#0B4F6C' },
  'Urology':                    { emoji: '🫘', color: '#1D4ED8' },
  'Vascular Surgery':           { emoji: '🩻', color: '#B91C1C' },
};

function getCatMeta(cat) {
  return CAT_META[cat] || { emoji: '🏥', color: '#4A5568' };
}

/* Returns ordered unique displayCategory values that have ≥1 non-USC record */
function getCategories() {
  const cats = new Map(); // cat → count
  for (const rec of INDEX) {
    if (matchesArea(rec) && matchesAge(rec) && !matchesUsc(rec)) {
      const c = rec.displayCategory || rec._topic;
      cats.set(c, (cats.get(c) || 0) + 1);
    }
  }
  return [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/* Returns specialties within a category */
function getSpecialties(cat) {
  const specs = new Map();
  for (const rec of INDEX) {
    if ((rec.displayCategory || rec._topic) !== cat) continue;
    if (!matchesArea(rec) || !matchesAge(rec)) continue;
    if (matchesUsc(rec)) continue;
    const sp = rec.displaySpecialty || rec._cond;
    specs.set(sp, (specs.get(sp) || 0) + 1);
  }
  return [...specs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/* Returns records for a given category + optional specialty */
function getRecords(cat, spec) {
  return INDEX.filter(rec => {
    const dc = rec.displayCategory || rec._topic;
    const ds = rec.displaySpecialty || rec._cond;
    if (dc !== cat) return false;
    if (spec && ds !== spec) return false;
    if (!matchesArea(rec) || !matchesAge(rec)) return false;
    if (matchesUsc(rec)) return false;
    return true;
  });
}

/* ══════════════════════════════════════════════════════════════
   CARD BUILDERS
══════════════════════════════════════════════════════════════ */
function ersPathwayRow(s) {
  /* Use new v2 fields: ersSpecialty + clinicTypes */
  const specLabel = (s.ersSpecialty || '').trim() || 'Not Otherwise Specified';
  const types     = Array.isArray(s.clinicTypes) && s.clinicTypes.length
                    ? s.clinicTypes
                    : ['Not Otherwise Specified'];
  const pillHtml  = types.map(p => `<span class='chip'>${p}</span>`).join('');
  return `
    <div class='ers-pathway-block'>
      <div class='ers-pathway-label'>eRS Pathway — ${specLabel}</div>
      <div class='badge-row' style='margin-bottom:0'>${pillHtml}</div>
    </div>`;
}

function badgeRow(s) {
  const parts = [];
  if (s.rasType) parts.push(`<span class='badge badge-blue'>${s.rasType}</span>`);
  if (s.method && /email/i.test(s.method)) parts.push(`<span class='badge badge-blue'>Email</span>`);
  if (s.usc)     parts.push(`<span class='badge badge-red'>USC / 2WW</span>`);
  if (s.bookable) parts.push(`<span class='badge badge-green'>Bookable</span>`);
  return parts.join('');
}

function ageString(s) {
  const mn = s.ageMin, mx = s.ageMax;
  if (mn != null && mx != null) return `${mn}–${mx}`;
  if (mn != null) return `${mn}+`;
  if (mx != null) return `0–${mx}`;
  return 'All ages';
}

function buildServiceCard(s) {
  const d = el('div', 'service-card');
  const details = [];
  if (s.sites && s.sites.length)
    details.push(`<div class='svc-detail-row'><span class='svc-detail-label'>Sites</span><span>${s.sites.join(', ')}</span></div>`);
  if (s.email && s.email !== 'nan')
    details.push(`<div class='svc-detail-row'><span class='svc-detail-label'>Email</span><span><a href='mailto:${s.email}'>${s.email}</a></span></div>`);
  if (s.phone && s.phone !== 'nan')
    details.push(`<div class='svc-detail-row'><span class='svc-detail-label'>Phone</span><span>${s.phone}</span></div>`);
  const badges = badgeRow(s);
  d.innerHTML = `
    <div class='svc-main'>
      <div class='svc-title'>${s.serviceName || '—'}</div>
      <div class='svc-sub'>${[s.provider, s.region || null].filter(Boolean).join(' · ')}</div>
      ${ersPathwayRow(s)}
      ${badges ? `<div class='badge-row'>${badges}</div>` : ''}
      <div class='svc-details'>${details.join('')}</div>
      ${s.notes ? `<div class='svc-notes'>📋 ${s.notes}</div>` : ''}
    </div>
    <div class='svc-meta-col'><span class='age-badge'>${ageString(s)}</span></div>`;
  return d;
}

/* Groups records by provider, renders into a container */
function renderServiceList(records, container) {
  container.innerHTML = '';
  if (!records.length) {
    container.innerHTML = `<div class='empty-state'><div class='big'>🔍</div><p>No services match the current filters.</p></div>`;
    return;
  }
  /* Group by provider */
  const byProvider = new Map();
  for (const rec of records) {
    const p = rec.provider || 'Other';
    if (!byProvider.has(p)) byProvider.set(p, []);
    byProvider.get(p).push(rec);
  }
  for (const [prov, recs] of [...byProvider.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sec = el('div', 'provider-section');
    sec.innerHTML = `
      <div class='provider-header'>
        <span class='provider-icon'>🏥</span>
        <span class='provider-name'>${prov}</span>
        <span class='provider-count'>${recs.length} service${recs.length !== 1 ? 's' : ''}</span>
      </div>`;
    for (const rec of recs) sec.appendChild(buildServiceCard(rec));
    container.appendChild(sec);
  }
}

/* ══════════════════════════════════════════════════════════════
   VIEW RENDERING
══════════════════════════════════════════════════════════════ */

function showView(name) {
  ['home-view', 'category-view', 'results-view'].forEach(id => {
    const v = byId(id);
    if (v) { v.classList.toggle('active', id === `${name}-view`); v.style.display = id === `${name}-view` ? '' : 'none'; }
  });
  state.activeView = name;
}

function renderHome() {
  showView('home');
  const grid = byId('category-grid');
  grid.innerHTML = '';
  const cats = getCategories();
  if (!cats.length) {
    grid.innerHTML = `<div class='empty-state' style='grid-column:1/-1'><div class='big'>🔍</div><p>No services match the current filters.</p></div>`;
    return;
  }
  for (const [cat, count] of cats) {
    const meta = getCatMeta(cat);
    const card = el('div', 'category-card');
    card.style.setProperty('--cat-color', meta.color);
    card.innerHTML = `
      <span class='cat-emoji'>${meta.emoji}</span>
      <div>
        <div class='cat-title'>${cat}</div>
        <div class='cat-sub'>${count} service${count !== 1 ? 's' : ''}</div>
      </div>`;
    card.addEventListener('click', () => openCategory(cat));
    grid.appendChild(card);
  }
}

function openCategory(cat) {
  state.activeCat = cat;
  state.activeSub = null;
  byId('cat-view-title').textContent = cat;
  const meta = getCatMeta(cat);

  const subspecGrid = byId('subspec-grid');
  subspecGrid.innerHTML = '';

  const specs = getSpecialties(cat);
  for (const [spec, count] of specs) {
    const card = el('div', 'subspec-card');
    card.dataset.spec = spec;
    card.innerHTML = `<span>${spec}</span><span class='subspec-arrow'>›</span>`;
    card.addEventListener('click', () => openResults(cat, spec));
    subspecGrid.appendChild(card);
  }
  showView('category');
}

function openResults(cat, spec) {
  state.activeSub = spec;
  /* highlight active subspec card */
  document.querySelectorAll('.subspec-card').forEach(c => c.classList.toggle('active', c.dataset.spec === spec));

  const titleEl = byId('results-title');
  const meta = getCatMeta(cat);
  titleEl.innerHTML = `<span class='title-emoji'>${meta.emoji}</span>${spec}`;

  const records = getRecords(cat, spec);
  byId('results-count').textContent = `${records.length} service${records.length !== 1 ? 's' : ''}`;

  renderServiceList(records, byId('results-body'));
  showView('results');
}

/* ══════════════════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════════════════ */
function runSearch(query, resultsEl, isUsc) {
  resultsEl.innerHTML = '';
  const q = query.trim().toLowerCase();
  if (q.length < 2) return;

  const hits = INDEX.filter(rec => {
    if (isUsc && !matchesUsc(rec)) return false;
    if (!isUsc && matchesUsc(rec)) return false;
    const haystack = [
      rec.serviceName, rec.provider, rec.displayCategory, rec.displaySpecialty,
      rec.displaySubtype, rec.ersSpecialty, rec.region,
      ...(rec.sites || []), ...(rec.clinicTypes || []),
      rec.criteria, rec.notes
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  }).slice(0, 12);

  for (const rec of hits) {
    const div = el('div', 'search-hit');
    const cat = rec.displayCategory || rec._topic;
    const spec = rec.displaySpecialty || rec._cond;
    div.innerHTML = `
      <div class='search-hit-title'>${rec.serviceName || '—'}</div>
      <div class='search-hit-path'>${cat} › ${spec}${rec.displaySubtype ? ' › ' + rec.displaySubtype : ''} · ${rec.provider || ''}</div>`;
    div.addEventListener('click', () => {
      resultsEl.innerHTML = '';
      if (!isUsc) {
        state.activeCat = cat;
        openCategory(cat);
        openResults(cat, spec);
        by('#global-search').value = '';
      }
    });
    resultsEl.appendChild(div);
  }
}

/* ══════════════════════════════════════════════════════════════
   USC PANEL
══════════════════════════════════════════════════════════════ */
function renderUsc() {
  const uscArea = state.area;
  const grid    = byId('usc-grid');
  const body    = byId('usc-results');
  grid.innerHTML = '';
  body.innerHTML = '';

  const uscRecs = INDEX.filter(r => matchesUsc(r) && (uscArea === '' || (r.region || '') === uscArea || (r.region || '') === ''));
  if (!uscRecs.length) {
    grid.innerHTML = `<div class='empty-state' style='grid-column:1/-1'><div class='big'>🔍</div><p>No USC pathways match the current filters.</p></div>`;
    return;
  }
  const cats = new Map();
  for (const r of uscRecs) {
    const c = r.displayCategory || r._topic;
    if (!cats.has(c)) cats.set(c, []);
    cats.get(c).push(r);
  }
  for (const [cat, recs] of [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const meta = getCatMeta(cat);
    const card = el('div', 'category-card');
    card.style.setProperty('--cat-color', meta.color);
    card.innerHTML = `
      <span class='cat-emoji'>${meta.emoji}</span>
      <div>
        <div class='cat-title'>${cat}</div>
        <div class='cat-sub'>${recs.length} pathway${recs.length !== 1 ? 's' : ''}</div>
      </div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('#usc-grid .category-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      renderServiceList(recs, body);
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    grid.appendChild(card);
  }
}

/* ══════════════════════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════════════════════ */
function switchTab(tab) {
  state.activeTab = tab;
  ['ur', 'usc'].forEach(t => {
    byId(`tab-${t}`).setAttribute('aria-selected', t === tab ? 'true' : 'false');
    const panel = byId(`panel-${t}`);
    panel.classList.toggle('active', t === tab);
    panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'usc') renderUsc();
}

/* ══════════════════════════════════════════════════════════════
   MAIN RENDER — called whenever filters change
══════════════════════════════════════════════════════════════ */
function render() {
  if (!DATA) return;
  if (state.activeTab === 'usc') { renderUsc(); return; }

  if (state.activeView === 'home' || !state.activeCat) {
    renderHome();
  } else if (state.activeView === 'category') {
    openCategory(state.activeCat);
  } else if (state.activeView === 'results') {
    openResults(state.activeCat, state.activeSub);
  }
}

/* ══════════════════════════════════════════════════════════════
   EVENT WIRING
══════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {

  /* ── panel init (CSS drives display; ensure correct initial state) ── */
  byId('panel-usc').style.display = 'none';
  byId('category-view').style.display = 'none';
  byId('results-view').style.display = 'none';

  /* ── tabs ── */
  byId('tab-ur').addEventListener('click',  () => switchTab('ur'));
  byId('tab-usc').addEventListener('click', () => switchTab('usc'));

  /* ── area filter chips (both panels share same area state) ── */
  document.querySelectorAll('[data-area]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('#ur-region, #usc-region');
      const allBtns = row
        ? row.querySelectorAll('[data-area]')
        : document.querySelectorAll('[data-area]');
      allBtns.forEach(b => b.classList.toggle('active', b === btn));
      /* also sync sibling panel's chips */
      document.querySelectorAll(`[data-area='${btn.dataset.area}']`).forEach(b => {
        const sibRow = b.closest('#ur-region, #usc-region');
        if (sibRow) b.classList.add('active');
      });
      state.area = btn.dataset.area;
      render();
    });
  });

  /* ── age quick-filter chips ── */
  document.querySelectorAll('.age-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.age-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.age = btn.dataset.age;
      state.ageSlider = 0;
      byId('age-slider').value = 0;
      byId('age-slider-value').textContent = '0+';
      render();
    });
  });

  /* ── age slider ── */
  byId('age-slider').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    byId('age-slider-value').textContent = v === 0 ? '0+' : `${v}+`;
    state.ageSlider = v;
    if (v > 0) {
      document.querySelectorAll('.age-chip').forEach(b => b.classList.remove('active'));
      state.age = 'all';
    }
    render();
  });

  /* ── global search ── */
  const searchInput  = byId('global-search');
  const searchResult = byId('search-results');
  searchInput.addEventListener('input', () => runSearch(searchInput.value, searchResult, false));
  searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') { searchInput.value = ''; searchResult.innerHTML = ''; } });
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchResult.contains(e.target)) searchResult.innerHTML = '';
  });

  /* ── USC search ── */
  const uscInput  = byId('usc-search');
  const uscResult = byId('usc-search-results');
  uscInput.addEventListener('input', () => runSearch(uscInput.value, uscResult, true));
  uscInput.addEventListener('keydown', e => { if (e.key === 'Escape') { uscInput.value = ''; uscResult.innerHTML = ''; } });
  document.addEventListener('click', e => {
    if (!uscInput.contains(e.target) && !uscResult.contains(e.target)) uscResult.innerHTML = '';
  });

  /* ── back buttons ── */
  byId('back-to-home').addEventListener('click', () => {
    state.activeCat = null;
    state.activeSub = null;
    renderHome();
  });
  byId('back-to-cat').addEventListener('click', () => {
    openCategory(state.activeCat);
  });

  /* ── load data ── */
  await loadData();
});
