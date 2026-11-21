// MeinAuftrag24 – aktuelle Aufträge und Mietfahrzeuge direkt auf der Startseite.
// Keine Zahlungs- oder Abonnementfunktion wird hier verändert.
(() => {
  "use strict";
  const esc=(x)=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const money=(x)=>new Intl.NumberFormat("de-CH",{style:"currency",currency:"CHF"}).format(Number(x)||0);
  const date=(v)=>{if(!v)return null;const d=new Date(v.length===10?v+"T12:00:00":v);return Number.isNaN(d.valueOf())?null:d.toLocaleDateString("de-CH");};
  const limitPreview=6;
  let jobs=[],vehicles=[],showAllJobs=false,showAllVehicles=false;
  let jobGrid=null,carGrid=null;

  function openRentals(){
    const link=document.getElementById("rentalsNav")||document.getElementById("rentalCategoryCard");
    if(link){
      link.click();
      document.getElementById("rentalResetBtn")?.click();
      return;
    }
    const section=document.getElementById("rentals");
    if(section && typeof show==="function")show("rentals");
    else alert("Die Fahrzeugübersicht ist gerade nicht verfügbar.");
  }
  function goJobs(){
    if(typeof show==="function")show("jobs");
    else document.querySelector('[data-go="jobs"]')?.click();
  }
  async function publishJob(){
    const {data:{user}}=await sb.auth.getUser();
    if(user){
      const {data:p}=await sb.from("profiles").select("role").eq("id",user.id).maybeSingle();
      if(p?.role==="customer"){show("newjob");return;}
    }
    show("register");
  }
  function jobHtml(j){
    const place=[j.postal_code,j.city].filter(Boolean).map(esc).join(" ");
    const when=j.desired_date?'<span>📅 '+esc(date(j.desired_date))+'</span>':'';
    const budget=Number(j.budget)>0?'<span>💰 '+esc(money(j.budget))+' Budget</span>':'';
    return '<article class="homeListingCard homeJobCard">'+
      '<span class="pill blue">'+esc(j.category||"Auftrag")+'</span>'+
      '<h3>'+esc(j.title||"Neuer Auftrag")+'</h3>'+
      '<div class="homeListingFacts"><span>📍 '+(place||"Schweiz")+'</span>'+when+budget+'</div>'+
      '<div class="homeListingFooter"><span class="meta">Neu: '+esc(date(j.created_at)||"")+'</span>'+
      '<button type="button" class="btn secondary small" data-home-job="'+esc(j.id)+'">Auftrag ansehen</button></div>'+
    '</article>';
  }
  function carHtml(v){
    const photo=(typeof v.photo_url==="string"&&v.photo_url.startsWith("https://"))?'<button type="button" class="homePublicPhotoButton" data-public-rental-photos="'+esc(v.id)+'" aria-label="Fotos ansehen: '+esc(v.title)+'"><img class="homeRentalPhoto" src="'+esc(v.photo_url)+'" alt="Foto: '+esc(v.title)+'" loading="lazy"></button>':'<div class="homeRentalPlaceholder">🚗</div>';
    const sub=[v.make,v.model].filter(Boolean).map(esc).join(" · ");
    return '<article class="homeListingCard homeVehicleCard">'+
      photo+
      '<div class="homeVehicleText"><span class="pill blue">'+esc(v.vehicle_type||"Mietfahrzeug")+'</span>'+
      '<h3>'+esc(v.title||"Mietfahrzeug")+'</h3>'+
      '<p class="meta">'+sub+'</p>'+
      '<div class="homeListingFacts"><span>📍 '+esc(v.location||"Schweiz")+'</span>'+
        (v.available_from?'<span>Ab '+esc(date(v.available_from))+'</span>':'')+
      '</div>'+
      '<div class="homeListingFooter"><strong>'+esc(money(v.daily_rate))+' <small>/ Tag</small></strong>'+
      '<div class="homePhotoActions"><button type="button" class="btn secondary small" data-public-rental-photos="'+esc(v.id)+'">📷 Fotos ansehen</button><button type="button" class="btn primary small" data-home-rental="'+esc(v.id)+'">Fahrzeug ansehen</button></div></div>'+
      '</div></article>';
  }
  function renderJobs(){
    const visible=showAllJobs?jobs:jobs.slice(0,limitPreview);
    const badge=document.getElementById("homeJobsCount");
    if(badge)badge.textContent=jobs.length+" offene Aufträge";
    jobGrid.innerHTML=visible.length?visible.map(jobHtml).join(""):
      '<div class="homeEmptyListing"><div class="homeEmptySymbol">🧰</div><h3>Zurzeit keine offenen Aufträge</h3><p>Neue Aufträge erscheinen hier automatisch, sobald sie veröffentlicht werden.</p><button type="button" class="btn primary small" id="homePostJob">Auftrag einstellen</button></div>';
    document.getElementById("homePostJob")?.addEventListener("click",publishJob);
    const expand=document.getElementById("homeExpandJobs");
    if(expand){expand.hidden=jobs.length<=limitPreview;expand.textContent=showAllJobs?"Weniger Aufträge anzeigen":"Alle "+jobs.length+" Aufträge anzeigen";expand.setAttribute("aria-expanded",String(showAllJobs));}
  }
  function renderCars(){
    const visible=showAllVehicles?vehicles:vehicles.slice(0,limitPreview);
    const badge=document.getElementById("homeCarsCount");
    if(badge)badge.textContent=vehicles.length+" verfügbare Inserate";
    carGrid.innerHTML=visible.length?visible.map(carHtml).join(""):
      '<div class="homeEmptyListing"><div class="homeEmptySymbol">🚗</div><h3>Derzeit keine Mietfahrzeuge verfügbar</h3><p>Neue Fahrzeugangebote erscheinen automatisch hier.</p></div>';
    const expand=document.getElementById("homeExpandCars");
    if(expand){expand.hidden=vehicles.length<=limitPreview;expand.textContent=showAllVehicles?"Weniger Fahrzeuge anzeigen":"Alle "+vehicles.length+" Fahrzeuge anzeigen";expand.setAttribute("aria-expanded",String(showAllVehicles));}
  }
  async function load(){
    jobGrid.innerHTML='<div class="homeEmptyListing">Aufträge werden geladen …</div>';
    carGrid.innerHTML='<div class="homeEmptyListing">Mietfahrzeuge werden geladen …</div>';
    const {data,error}=await sb.functions.invoke("public-home-listings",{body:{}});
    if(error||data?.error){
      console.error("Startseiten-Anzeigen konnten nicht geladen werden",error||data?.error);
      jobGrid.innerHTML='<div class="homeEmptyListing">Die Aufträge konnten gerade nicht geladen werden. Bitte später erneut versuchen.</div>';
      carGrid.innerHTML='<div class="homeEmptyListing">Die Mietfahrzeuge konnten gerade nicht geladen werden. Bitte später erneut versuchen.</div>';
      return;
    }
    jobs=Array.isArray(data?.jobs)?data.jobs:[];
    vehicles=Array.isArray(data?.vehicles)?data.vehicles:[];
    renderJobs();renderCars();
  }
  function mount(){
    const hero=document.querySelector("#home .hero");
    if(!hero||document.getElementById("homeLiveListings"))return;
    const section=document.createElement("div");
    section.className="section homeLiveListings";
    section.id="homeLiveListings";
    section.innerHTML=
      '<div class="wrap">'+
        '<div class="sectionHead homeListingHead"><div><h2>Neueste Aufträge</h2><p>Aktuelle Arbeiten aus der Schweiz – direkt entdecken, ohne erst zu suchen.</p></div>'+
        '<span class="pill blue" id="homeJobsCount">Aufträge laden …</span></div>'+
        '<div class="homeListingGrid" id="homeJobGrid" aria-live="polite"></div>'+
        '<div class="homeListingActions"><button type="button" class="btn secondary" id="homeExpandJobs" hidden>Alle Aufträge anzeigen</button>'+
        '<button type="button" class="btn primary" id="homePostJobTop">+ Kostenlos Auftrag einstellen</button></div>'+
        '<div class="sectionHead homeListingHead homeVehicleHead"><div><h2>Aktuelle Mietfahrzeuge</h2><p>Alle Fahrzeugtypen – Personenwagen, Lieferwagen und Transporter – auf einen Blick.</p></div>'+
        '<span class="pill blue" id="homeCarsCount">Fahrzeuge laden …</span></div>'+
        '<div class="homeListingGrid" id="homeVehicleGrid" aria-live="polite"></div>'+
        '<div class="homeListingActions"><button type="button" class="btn secondary" id="homeExpandCars" hidden>Alle Fahrzeuge anzeigen</button>'+
        '<button type="button" class="btn secondary" id="homeOpenRentals">Zur Fahrzeugübersicht</button></div>'+
      '</div>';
    hero.after(section);
    jobGrid=document.getElementById("homeJobGrid");
    carGrid=document.getElementById("homeVehicleGrid");
    document.getElementById("homePostJobTop").addEventListener("click",publishJob);
    document.getElementById("homeOpenRentals").addEventListener("click",openRentals);
    document.getElementById("homeExpandJobs").addEventListener("click",()=>{showAllJobs=!showAllJobs;renderJobs();});
    document.getElementById("homeExpandCars").addEventListener("click",()=>{showAllVehicles=!showAllVehicles;renderCars();});
    section.addEventListener("click",event=>{
      const button=event.target.closest?.("button");
      if(button?.dataset.homeJob){goJobs();}
      else if(button?.dataset.homeRental){openRentals();}
    });
    load();
  }
  const style=document.createElement("style");
  style.textContent=
    '.homeLiveListings{padding:40px 0 12px;background:var(--bg)}'+
    '.homeListingHead{align-items:center;flex-wrap:wrap;margin:0 0 18px}'+
    '.homeListingHead h2{font-size:30px}'+
    '.homeVehicleHead{margin-top:44px}'+
    '.homeListingGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}'+
    '.homeListingCard{background:#fff;border:1px solid var(--line);border-radius:19px;padding:20px;display:flex;flex-direction:column;gap:9px;box-shadow:0 6px 26px rgba(16,24,40,.04);min-width:0}'+
    '.homeListingCard h3{margin:3px 0 2px;font-size:19px;line-height:1.32;overflow-wrap:anywhere}'+
    '.homeListingFacts{display:flex;gap:7px 15px;flex-wrap:wrap;color:var(--muted);font-size:13px}'+
    '.homeListingFooter{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:auto;padding-top:12px}'+
    '.homeListingFooter small{font-size:12px;font-weight:400;color:var(--muted)}'+
    '.homeListingActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}'+
    '.homeEmptyListing{grid-column:1/-1;text-align:center;background:white;border:1px dashed #cbd5e1;border-radius:18px;padding:34px 20px;color:var(--muted)}'+
    '.homeEmptyListing h3{color:var(--text);margin:6px 0}.homeEmptyListing p{margin:6px 0 16px}'+
    '.homeEmptySymbol{font-size:32px}'+
    '.homeVehicleCard{overflow:hidden;padding:0;gap:0}'+
    '.homeVehicleCard .homeVehicleText{padding:17px 19px 19px;display:flex;flex-direction:column;gap:8px;flex:1}'+
    '.homeVehicleCard .homeVehicleText p{margin:0}'+
    '.homeRentalPhoto,.homeRentalPlaceholder{display:block;width:100%;height:192px;object-fit:cover;background:#edf2f8}'+
    '.homeRentalPlaceholder{display:grid;place-items:center;font-size:52px}'+
    '.homePublicPhotoButton{appearance:none;display:block;width:100%;padding:0;margin:0;border:0;border-radius:0;cursor:zoom-in;background:transparent}'+
    '.homePhotoActions{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}'+
    '@media(max-width:900px){.homeListingGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
    '@media(max-width:640px){.homeListingGrid{grid-template-columns:1fr}.homeListingHead h2{font-size:27px}.homeRentalPhoto,.homeRentalPlaceholder{height:200px}.homeListingCard{padding:17px}.homeVehicleCard{padding:0}.homeListingActions .btn{flex:1}}';
  document.head.appendChild(style);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);
  else mount();
})();
