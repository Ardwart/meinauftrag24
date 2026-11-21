// MeinAuftrag24.ch – öffentliche Fahrzeugbilder-Galerie
// Funktioniert ohne Registrierung. Bilder verwalten bleibt beim Vermieter.
(() => {
  "use strict";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isUuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  let viewer=null;
  let activeImages=[];
  let activeIndex=0;
  function close(){
    viewer?.remove();
    viewer=null;activeImages=[];
    document.removeEventListener("keydown",keyHandler);
  }
  function keyHandler(ev){
    if(!viewer)return;
    if(ev.key==="Escape")close();
    if(ev.key==="ArrowRight"){ev.preventDefault();change(1);}
    if(ev.key==="ArrowLeft"){ev.preventDefault();change(-1);}
  }
  function render(){
    if(!viewer)return;
    const item=activeImages[activeIndex];
    const img=viewer.querySelector("#publicRentalGalleryImage");
    img.src=item.image_url;
    img.alt="Fahrzeugfoto "+(activeIndex+1);
    viewer.querySelector("#publicRentalGalleryCounter").textContent=(activeIndex+1)+" / "+activeImages.length;
    viewer.querySelector("#publicRentalGalleryPrev").disabled=activeImages.length===1;
    viewer.querySelector("#publicRentalGalleryNext").disabled=activeImages.length===1;
  }
  function change(direction){
    if(!activeImages.length)return;
    activeIndex=(activeIndex+direction+activeImages.length)%activeImages.length;
    render();
  }
  async function open(vehicleId,requestedIndex=0){
    if(!isUuid(vehicleId))return;
    close();
    viewer=document.createElement("div");
    viewer.className="publicRentalGalleryBackdrop";
    viewer.setAttribute("role","dialog");
    viewer.setAttribute("aria-modal","true");
    viewer.setAttribute("aria-label","Fahrzeugfotos");
    viewer.innerHTML=
      '<div class="publicRentalGalleryPanel">'+
      '<div class="publicRentalGalleryTop"><strong>📷 Fahrzeugfotos</strong><button type="button" id="publicRentalGalleryClose" class="btn ghost small" aria-label="Galerie schliessen">✕ Schliessen</button></div>'+
      '<div id="publicRentalGalleryLoading" class="publicRentalGalleryLoading">Fotos werden geladen …</div>'+
      '<div id="publicRentalGalleryContent" class="publicRentalGalleryContent" hidden>'+
      '<img id="publicRentalGalleryImage" alt="Fahrzeugfoto" />'+
      '<div class="publicRentalGalleryControls">'+
      '<button type="button" id="publicRentalGalleryPrev" class="btn secondary" aria-label="Vorheriges Foto">‹ Zurück</button>'+
      '<span id="publicRentalGalleryCounter"></span>'+
      '<button type="button" id="publicRentalGalleryNext" class="btn secondary" aria-label="Nächstes Foto">Weiter ›</button>'+
      '</div></div></div>';
    document.body.appendChild(viewer);
    document.addEventListener("keydown",keyHandler);
    viewer.addEventListener("click",ev=>{if(ev.target===viewer)close();});
    viewer.querySelector("#publicRentalGalleryClose").onclick=close;
    viewer.querySelector("#publicRentalGalleryPrev").onclick=()=>change(-1);
    viewer.querySelector("#publicRentalGalleryNext").onclick=()=>change(1);
    try{
      const {data:vehicle,error:vehicleError}=await sb.from("rental_vehicles").select("id,title,is_active").eq("id",vehicleId).eq("is_active",true).maybeSingle();
      if(vehicleError||!vehicle)throw new Error("Dieses Inserat ist nicht öffentlich verfügbar.");
      const {data,error}=await sb.from("rental_vehicle_photos")
        .select("image_url,sort_order").eq("vehicle_id",vehicleId).order("sort_order",{ascending:true}).limit(10);
      if(error)throw new Error("Die Fotos konnten nicht geladen werden.");
      const hostname=new URL("https://ucdcpjnkdfcahlpsbcjy.supabase.co").hostname;
      activeImages=(data||[]).filter(p=>{
        if(typeof p.image_url!=="string")return false;
        try{const u=new URL(p.image_url);return u.protocol==="https:"&&u.hostname===hostname&&u.pathname.startsWith("/storage/v1/object/public/rental-vehicles/");}
        catch{return false;}
      });
      if(!viewer?.isConnected)return;
      if(!activeImages.length)throw new Error("Für dieses Fahrzeug sind noch keine öffentlichen Fotos vorhanden.");
      viewer.querySelector(".publicRentalGalleryTop strong").textContent="📷 "+vehicle.title;
      activeIndex=Math.max(0,Math.min(activeImages.length-1,Number(requestedIndex)||0));
      viewer.querySelector("#publicRentalGalleryLoading").hidden=true;
      viewer.querySelector("#publicRentalGalleryContent").hidden=false;
      render();
    }catch(e){
      if(viewer?.isConnected)viewer.querySelector("#publicRentalGalleryLoading").textContent=e.message||"Fotos können nicht angezeigt werden.";
    }
  }
  window.openRentalPhotos=open;
  document.addEventListener("click",ev=>{
    const button=ev.target.closest?.("[data-public-rental-photos]");
    if(!button)return;
    ev.preventDefault();
    open(button.dataset.publicRentalPhotos,button.dataset.photoIndex||"0");
  });
  const css=document.createElement("style");
  css.textContent=
    '.publicRentalGalleryBackdrop{position:fixed;inset:0;background:rgba(10,19,36,.89);z-index:3000;display:grid;place-items:center;padding:18px}'+
    '.publicRentalGalleryPanel{width:min(850px,100%);background:#fff;padding:16px;border-radius:20px;box-shadow:0 18px 60px rgba(0,0,0,.3)}'+
    '.publicRentalGalleryTop{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px}'+
    '.publicRentalGalleryTop strong{font-size:17px;overflow-wrap:anywhere}'+
    '.publicRentalGalleryContent{text-align:center}'+
    '#publicRentalGalleryImage{width:100%;max-height:min(68vh,650px);object-fit:contain;background:#f1f5f9;border-radius:12px;display:block}'+
    '.publicRentalGalleryControls{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}'+
    '.publicRentalGalleryLoading{padding:60px 20px;text-align:center;color:#667085}'+
    '.publicRentalGalleryBackdrop [hidden]{display:none!important}'+
    '.rvPhotos img[data-public-rental-photos]{cursor:zoom-in}'+
    '@media(max-width:600px){.publicRentalGalleryPanel{padding:10px}.publicRentalGalleryControls .btn{font-size:13px;padding:9px}}';
  document.head.appendChild(css);
})();