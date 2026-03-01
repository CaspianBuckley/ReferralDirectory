/* Surrey Referral Pathways — hybrid-loader.js (multi clinic-type pills) */
const DATA_URL = "https://raw.githubusercontent.com/CaspianBuckley-oss/ReferralDirectory/refs/heads/main/master_normalised.json";
const ERS_MULTI_LOOKUP_URL = 'ers_multi_lookup.json';

let DATA=null, INDEX=[], ERS_MULTI={};

const by=q=>document.querySelector(q);
const el=(t,cls)=>{const e=document.createElement(t); if(cls) e.className=cls; return e;};

async function loadData(){
  const [dRes, ersRes] = await Promise.all([
    fetch(DATA_URL),
    fetch(ERS_MULTI_LOOKUP_URL)
  ]);
  DATA = await dRes.json();
  ERS_MULTI = ersRes.ok? await ersRes.json():{};
  buildIndex(DATA);
}

function buildIndex(data){
  INDEX.length=0;
  for(const [spec, conds] of Object.entries(data)){
    for(const [cond, svcs] of Object.entries(conds)){
      for(const s of svcs){
        const rec={...s, _spec:spec, _cond:cond};
        const key = `${(s.serviceName||'').trim()}|${(s.provider||'').trim()}`;
        const ers = ERS_MULTI[key];
        if(ers){
          rec._ersClinicTypes = ers.clinicTypes||[]; // array of displays
          rec._ersSpecialty = ers.specialty||'';     // specialty (from codes)
        }
        INDEX.push(rec);
      }
    }
  }
}

function ersPathwayRow(s){
  const specLabel = (s._ersSpecialty && s._ersSpecialty.trim()) || (s._spec && s._spec.trim()) || 'Not Otherwise Specified';
  const pills = (s._ersClinicTypes && s._ersClinicTypes.length)? s._ersClinicTypes : ['Not Otherwise Specified'];
  const pillHtml = pills.map(p=>`<span class='chip'>${p}</span>`).join('');
  return `
    <div class='ers-pathway-block'>
      <div class='ers-pathway-label'>eRS Pathway — ${specLabel}</div>
      <div class='badge-row' style='margin-bottom:0'>${pillHtml}</div>
    </div>
  `;
}

function badgeRow(s){
  const row=[]; if(s.rasType) row.push(`<span class='badge badge-blue'>${s.rasType}</span>`);
  if(s.method && /email/i.test(s.method)) row.push(`<span class='badge badge-blue'>Email</span>`);
  if(s.usc) row.push(`<span class='badge badge-red'>USC / 2WW</span>`);
  if(s.bookable) row.push(`<span class='badge badge-green'>Bookable</span>`);
  return row.join('');
}

function buildServiceCard(s){
  const d=el('div','service-card');
  const ageStr=(s.ageMin!=null?`≥${s.ageMin}`:'')+(s.ageMax!=null?`–${s.ageMax}`:(s.ageMin!=null?'+':'All ages'));
  const ageSex=[ageStr,s.sex].filter(Boolean).join(' • ');
  const details=[];
  if(s.sites && s.sites.length) details.push(`<div class='svc-detail-row'><span class='svc-detail-label'>Sites</span><span>${s.sites.join(', ')}</span></div>`);
  if(s.email) details.push(`<div class='svc-detail-row'><span class='svc-detail-label'>Email</span><span>${s.email}</span></div>`);
  if(s.phone) details.push(`<div class='svc-detail-row'><span class='svc-detail-label'>Phone</span><span>${s.phone}</span></div>`);
  d.innerHTML = `
    <div class='svc-main'>
      <div class='svc-title'>${s.serviceName||'—'}</div>
      <div class='svc-sub'>${[s.provider, s.region].filter(Boolean).join(' • ')}</div>
      ${ersPathwayRow(s)}
      ${badgeRow(s)?`<div class='badge-row'>${badgeRow(s)}</div>`:''}
      <div class='svc-details'>${details.join('')}</div>
      ${s.notes?`<div class='svc-notes'>📋 ${s.notes}</div>`:''}
    </div>
    <div class='svc-meta-col'><span class='age-badge'>${ageSex||'All ages'}</span></div>
  `;
  return d;
}

// Minimal render wiring (home/category/results retained in your index.html)
window.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  // If you already have your tile rendering code, call it here; else no-op
});
