// MeinAuftrag24 – strukturierte Auftrags-Checklisten
(() => {
 const CHECKLISTS={
  'Reinigung':['Küche reinigen','Backofen reinigen','Kühlschrank / Gefrierschrank','Bad / WC reinigen','Fenster innen','Fenster aussen','Storen / Rollläden','Schränke innen','Balkon / Terrasse','Keller','Garage / Parkplatz','Abgabegarantie','Reinigungsmaterial durch Anbieter','Entsorgung'],
  'Hauswartung':['Treppenhausreinigung','Eingangsbereich','Lift reinigen','Keller / Gemeinschaftsräume','Tiefgarage','Objektkontrolle','Leuchtmittel kontrollieren / wechseln','Kleinreparaturen','Garten- und Umgebungspflege','Winterdienst','Abfall / Container bereitstellen'],
  'Garten':['Rasen mähen','Hecken schneiden','Sträucher schneiden','Jäten / Unkraut entfernen','Laub entfernen','Pflanzen / Blumen pflegen','Bewässerung','Grüngut entsorgen','Baumarbeiten','Neubepflanzung'],
  'Umzug':['Möbel transportieren','Möbel demontieren','Möbel montieren','Umzugskartons','Einpackservice','Auspackservice','Klavier / schwere Gegenstände','Entsorgung / Räumung','Endreinigung','Möbellift erforderlich'],
  'Reparaturen':['Montagearbeiten','Türen / Schlösser','Sanitär / Wasser','WC / Spülung','Elektro-Kleinarbeiten','Silikonfugen','Malerarbeiten','Boden / Parkett','Gips / Wände','Material durch Anbieter','Entsorgung'],
  'Winterdienst':['Schnee räumen','Salz / Splitt streuen','Hauszugang','Gehwege','Parkplätze','Tiefgaragenzufahrt','Bereitschaft bei Schneefall','Streumittel durch Anbieter'],
  'Renovation':['Komplette Wohnungsrenovation','Malerarbeiten Wände / Decken','Boden / Parkett','Plattenarbeiten','Gips / Trockenbau','Küche renovieren / montieren','Bad / WC renovieren','Türen / Zargen','Sanitär / Wasser','Elektroarbeiten','Silikonfugen','Abbrucharbeiten','Material durch Anbieter','Entsorgung'],
  'Transport':['Möbeltransport','Kleintransport','Lieferung / Abholung','Warentransport','Fahrzeugtransport','Räumung / Entsorgung','Tragehilfe benötigt','Demontage / Montage','Schwere Gegenstände','Transporter mit Fahrer','Mehrere Fahrten','Besichtigung gewünscht']
 };
 const norm=s=>(s||'').toLowerCase();
 function ensureCategories(){
  const cat=$('jobCategory');if(!cat)return;
  [['Renovation','🏠🔨 Renovation'],['Transport','🚐 Transport']].forEach(([value,label])=>{
   if(![...cat.options].some(o=>o.value===value||o.textContent.trim()===value)){
    const opt=document.createElement('option');opt.value=value;opt.textContent=label;
    const other=[...cat.options].find(o=>norm(o.value)==='sonstiges'||norm(o.textContent).includes('sonstiges'));
    other?cat.insertBefore(opt,other):cat.appendChild(opt);
   }
  });
 }
 function ensureHomeCategories(){
  const grid=document.querySelector('#home .categories');if(!grid)return;
  const additions=[
   ['Renovation','🏠🔨','Renovation','Umbau, Maler, Böden & Ausbau'],
   ['Transport','🚐','Transport','Lieferung, Klein- & Fahrzeugtransport']
  ];
  additions.forEach(([key,ico,title,text])=>{
   if(grid.querySelector(`[data-m24-category="${key}"]`))return;
   const el=document.createElement('div');el.className='category';el.dataset.m24Category=key;
   el.innerHTML=`<div class="ico">${ico}</div><b>${title}</b><span>${text}</span>`;
   grid.appendChild(el);
  });
 }
 function ensurePricingBenefits(){
  const plans=[...document.querySelectorAll('#pricing .plan')];
  const basic=plans.find(x=>x.querySelector('h3')?.textContent.trim()==='Basic');
  const pro=plans.find(x=>x.querySelector('h3')?.textContent.trim()==='Pro');
  const add=(plan,text)=>{const ul=plan?.querySelector('ul');if(!ul||[...ul.children].some(li=>li.textContent.trim()===text))return;const li=document.createElement('li');li.textContent=text;ul.appendChild(li);};
  add(basic,'Profilfoto');add(basic,'Bis 8 Referenzbilder');
  add(pro,'Profilfoto');add(pro,'Bis 30 Referenzbilder');
 }
 function itemsFor(category){const c=norm(category);for(const [k,v] of Object.entries(CHECKLISTS))if(c.includes(norm(k)))return v;return ['Material durch Anbieter','Entsorgung','Besichtigung gewünscht','Weitere Arbeiten gemäss Beschreibung'];}
 function checklistBox(category,selected=[]){const set=new Set((selected||[]).map(String));return `<div class="jobChecklistBox"><strong>Was soll gemacht werden?</strong><div class="meta" style="margin:5px 0 10px">Bitte alles auswählen, was zur Offerte gehören soll.</div><div class="jobChecklistGrid">${itemsFor(category).map(x=>`<label class="jobCheck"><input type="checkbox" value="${esc(x)}" ${set.has(x)?'checked':''}><span>${esc(x)}</span></label>`).join('')}</div></div>`;}
 function selectedItems(){return [...document.querySelectorAll('#jobChecklistMount .jobCheck input:checked')].map(x=>x.value);}
 const style=document.createElement('style');style.textContent=`.jobChecklistBox{border:1px solid var(--line);background:#f8fbff;border-radius:16px;padding:16px;margin-top:4px}.jobChecklistGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.jobCheck{display:flex!important;align-items:flex-start;gap:9px!important;padding:9px 10px;background:#fff;border:1px solid var(--line);border-radius:11px;font-weight:650!important}.jobCheck input{width:18px;height:18px;flex:0 0 auto;margin:1px 0}.scopeChecklist{display:grid;gap:5px;margin:12px 0;padding:12px 14px;border-radius:13px;background:#f8fbff;border:1px solid #dbe7ff}.scopeChecklist span{font-size:13px;color:#344054}@media(max-width:700px){.jobChecklistGrid{grid-template-columns:1fr}}`;document.head.appendChild(style);
 function mount(){ensureCategories();ensureHomeCategories();ensurePricingBenefits();const cat=$('jobCategory');if(!cat)return;let m=$('jobChecklistMount');if(!m){m=document.createElement('div');m.id='jobChecklistMount';m.className='full';const desc=$('jobDescription');(desc?.closest('label')||desc)?.insertAdjacentElement('beforebegin',m);}m.innerHTML=checklistBox(cat.value);if(!cat.dataset.checklistBound){cat.addEventListener('change',()=>m.innerHTML=checklistBox(cat.value));cat.dataset.checklistBound='1';}}
 function scopeHtml(items){if(!items?.length)return'';return `<div class="scopeChecklist"><strong>Gewünschte Leistungen:</strong>${items.map(x=>`<span>✓ ${esc(x)}</span>`).join('')}</div>`;}
 window.jobChecklistScopeHtml=scopeHtml;
 const oldFrom=sb.from.bind(sb);sb.from=function(table){const q=oldFrom(table);if(table==='jobs'){const oldInsert=q.insert.bind(q);q.insert=function(values,...rest){if(values&&$('newjob')?.classList.contains('active')){const patch=v=>({...v,checklist:selectedItems()});values=Array.isArray(values)?values.map(patch):patch(values);}return oldInsert(values,...rest);};}return q;};

 // Checklisten auch bei sichtbaren Aufträgen anzeigen.
 const baseRenderJobs=window.renderJobs;
 if(typeof baseRenderJobs==='function')window.renderJobs=async function(){
  await baseRenderJobs();
  const list=$('jobsList');if(!list||!session)return;
  const {data}=await sb.from('jobs').select('id,checklist').eq('status','open').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});
  const cards=[...list.querySelectorAll(':scope > article.item')];
  (data||[]).forEach((j,i)=>{const card=cards[i];if(!card||card.querySelector('.scopeChecklist')||!j.checklist?.length)return;const desc=card.querySelector('.desc');desc?.insertAdjacentHTML('afterend',scopeHtml(j.checklist));});
 };

 // Bei eigenen Kunden-Aufträgen den vereinbarten Umfang ebenfalls zeigen.
 const baseRenderMy=window.renderMy;
 if(typeof baseRenderMy==='function')window.renderMy=async function(){
  await baseRenderMy();
  if(profile?.role!=='customer'||!session)return;
  const {data}=await sb.from('jobs').select('id,title,checklist').eq('customer_id',session.user.id).order('created_at',{ascending:false});
  const cards=[...document.querySelectorAll('#myContent > article.item')];
  (data||[]).forEach((j,i)=>{const card=cards[i];if(!card||card.querySelector('.scopeChecklist')||!j.checklist?.length)return;const head=card.querySelector('.itemHead');head?.insertAdjacentHTML('afterend',scopeHtml(j.checklist));});
 };

 document.addEventListener('DOMContentLoaded',mount);if(document.readyState!=='loading')setTimeout(mount,0);
})();
