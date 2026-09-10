// MeinAuftrag24 – strukturierte Auftrags-Checklisten
(() => {
 const CHECKLISTS={
  'Reinigung':['Küche reinigen','Backofen reinigen','Kühlschrank / Gefrierschrank','Bad / WC reinigen','Fenster innen','Fenster aussen','Storen / Rollläden','Schränke innen','Balkon / Terrasse','Keller','Garage / Parkplatz','Abgabegarantie','Reinigungsmaterial durch Anbieter','Entsorgung'],
  'Hauswartung':['Treppenhausreinigung','Eingangsbereich','Lift reinigen','Keller / Gemeinschaftsräume','Tiefgarage','Objektkontrolle','Leuchtmittel kontrollieren / wechseln','Kleinreparaturen','Garten- und Umgebungspflege','Winterdienst','Abfall / Container bereitstellen'],
  'Garten':['Rasen mähen','Hecken schneiden','Sträucher schneiden','Jäten / Unkraut entfernen','Laub entfernen','Pflanzen / Blumen pflegen','Bewässerung','Grüngut entsorgen','Baumarbeiten','Neubepflanzung'],
  'Umzug':['Möbel transportieren','Möbel demontieren','Möbel montieren','Umzugskartons','Einpackservice','Auspackservice','Klavier / schwere Gegenstände','Entsorgung / Räumung','Endreinigung','Möbellift erforderlich'],
  'Reparaturen':['Montagearbeiten','Türen / Schlösser','Sanitär / Wasser','WC / Spülung','Elektro-Kleinarbeiten','Silikonfugen','Malerarbeiten','Boden / Parkett','Gips / Wände','Material durch Anbieter','Entsorgung'],
  'Winterdienst':['Schnee räumen','Salz / Splitt streuen','Hauszugang','Gehwege','Parkplätze','Tiefgaragenzufahrt','Bereitschaft bei Schneefall','Streumittel durch Anbieter']
 };
 const norm=s=>(s||'').toLowerCase();
 function itemsFor(category){const c=norm(category);for(const [k,v] of Object.entries(CHECKLISTS))if(c.includes(norm(k)))return v;return ['Material durch Anbieter','Entsorgung','Besichtigung gewünscht','Weitere Arbeiten gemäss Beschreibung'];}
 function checklistBox(category,selected=[]){const set=new Set((selected||[]).map(String));return `<div class="jobChecklistBox"><strong>Was soll gemacht werden?</strong><div class="meta" style="margin:5px 0 10px">Bitte alles auswählen, was zur Offerte gehören soll.</div><div class="jobChecklistGrid">${itemsFor(category).map(x=>`<label class="jobCheck"><input type="checkbox" value="${esc(x)}" ${set.has(x)?'checked':''}><span>${esc(x)}</span></label>`).join('')}</div></div>`;}
 function selectedItems(){return [...document.querySelectorAll('#jobChecklistMount .jobCheck input:checked')].map(x=>x.value);}
 const style=document.createElement('style');style.textContent=`.jobChecklistBox{border:1px solid var(--line);background:#f8fbff;border-radius:16px;padding:16px;margin-top:4px}.jobChecklistGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.jobCheck{display:flex!important;align-items:flex-start;gap:9px!important;padding:9px 10px;background:#fff;border:1px solid var(--line);border-radius:11px;font-weight:650!important}.jobCheck input{width:18px;height:18px;flex:0 0 auto;margin:1px 0}.scopeChecklist{display:grid;gap:5px;margin:10px 0}.scopeChecklist span{font-size:13px;color:#344054}@media(max-width:700px){.jobChecklistGrid{grid-template-columns:1fr}}`;document.head.appendChild(style);
 function mount(){const cat=$('jobCategory');if(!cat)return;let m=$('jobChecklistMount');if(!m){m=document.createElement('div');m.id='jobChecklistMount';m.className='full';const desc=$('jobDescription');(desc?.closest('label')||desc)?.insertAdjacentElement('beforebegin',m);}m.innerHTML=checklistBox(cat.value);cat.addEventListener('change',()=>m.innerHTML=checklistBox(cat.value));}
 function scopeHtml(items){if(!items?.length)return'';return `<div class="scopeChecklist"><strong>Gewünschte Leistungen:</strong>${items.map(x=>`<span>✓ ${esc(x)}</span>`).join('')}</div>`;}
 window.jobChecklistScopeHtml=scopeHtml;
 // Capture the checklist in every new job insert without changing the existing form workflow.
 const oldFrom=sb.from.bind(sb);sb.from=function(table){const q=oldFrom(table);if(table==='jobs'){const oldInsert=q.insert.bind(q);q.insert=function(values,...rest){if(values&&$('newjob')?.classList.contains('active')){const patch=v=>({...v,checklist:selectedItems()});values=Array.isArray(values)?values.map(patch):patch(values);}return oldInsert(values,...rest);};}return q;};
 document.addEventListener('DOMContentLoaded',mount);if(document.readyState!=='loading')setTimeout(mount,0);
})();
