// MeinAuftrag24 – guest vehicle bookings and separate owner payouts. No subscription changes.
(() => {
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=cents=>new Intl.NumberFormat("de-CH",{style:"currency",currency:"CHF"}).format(Number(cents||0)/100);
 function days(a,b){if(!a||!b)return 0;const parse=s=>{const z=s.split("-").map(Number);return Date.UTC(z[0],z[1]-1,z[2]);};return Math.round((parse(b)-parse(a))/86400000);}
 function modal(content){
   document.getElementById("rentalBookingOverlay")?.remove();
   const o=document.createElement("div");o.id="rentalBookingOverlay";o.className="modalBack";
   o.innerHTML='<div class="modal" style="max-width:610px;width:min(96vw,610px)">'+content+'</div>';
   document.body.appendChild(o);
   o.addEventListener("click",ev=>{if(ev.target===o)o.remove();});
   o.querySelectorAll("[data-rv-close]").forEach(b=>b.addEventListener("click",()=>o.remove()));
   return o;
 }
 async function book(vehicleId){
   const {data:v,error}=await sb.from("rental_vehicles").select("id,title,daily_rate,location,available_from,available_to,is_active").eq("id",vehicleId).eq("is_active",true).maybeSingle();
   if(error||!v){alert("Fahrzeug ist nicht mehr verfügbar.");return;}
   const initialFrom=document.getElementById("rentalFilterFrom")?.value||"";
   const initialTo=document.getElementById("rentalFilterTo")?.value||"";
   const box=modal('<div class="row"><h3>🚗 Fahrzeug sofort buchen</h3><button class="btn ghost small" type="button" data-rv-close>Schliessen</button></div>'+
    '<p><b>'+esc(v.title)+'</b> · '+esc(v.location)+' · '+money(Math.round(Number(v.daily_rate)*100))+' / Tag</p>'+
    '<div class="notice info">Ohne Anmeldung. Bezahle den gesamten Mietpreis sicher mit TWINT oder Kreditkarte. Die Buchung wird erst nach bestätigter Zahlung verbindlich.</div>'+
    '<form id="rentalGuestBookingForm" class="formGrid">'+
     '<label>Abholung (Datum)<input id="rgbFrom" type="date" value="'+esc(initialFrom)+'" required></label>'+
     '<label>Rückgabe (Datum)<input id="rgbTo" type="date" value="'+esc(initialTo)+'" required></label>'+
     '<label class="full">Vor- und Nachname<input id="rgbName" maxlength="120" autocomplete="name" required></label>'+
     '<label>E-Mail<input id="rgbEmail" type="email" maxlength="254" autocomplete="email" required></label>'+
     '<label>Telefon (optional)<input id="rgbPhone" type="tel" maxlength="50" autocomplete="tel"></label>'+
     '<div class="full" id="rgbTotal" style="font-weight:850"></div>'+
     '<div class="full"><button id="rgbPay" class="btn primary" type="submit">Mit TWINT oder Kreditkarte bezahlen</button></div>'+
     '<div class="full" id="rgbError" role="alert"></div>'+
    '</form>');
   const start=box.querySelector("#rgbFrom"),end=box.querySelector("#rgbTo");
   if(v.available_from)start.min=v.available_from;
   if(v.available_to)end.max=v.available_to;
   function recalc(){const n=days(start.value,end.value);box.querySelector("#rgbTotal").textContent=n>0?n+" Miettag(e) · Total "+money(Math.round(n*Number(v.daily_rate)*100)):"Bitte einen gültigen Zeitraum wählen (Rückgabe nach Abholung).";}
   start.addEventListener("change",recalc);end.addEventListener("change",recalc);recalc();
   box.querySelector("#rentalGuestBookingForm").onsubmit=async ev=>{
    ev.preventDefault();const n=days(start.value,end.value),msg=box.querySelector("#rgbError");
    if(n<1||n>90||v.available_from&&start.value<v.available_from||v.available_to&&end.value>v.available_to){
      msg.innerHTML='<div class="notice warn">Bitte gültige Mietdaten innerhalb der Verfügbarkeit auswählen.</div>';return;
    }
    const b=box.querySelector("#rgbPay");b.disabled=true;b.textContent="Zahlung wird vorbereitet …";msg.textContent="";
    try{
      const {data,error}=await sb.functions.invoke("rental-checkout",{body:{
        vehicleId:v.id,dateFrom:start.value,dateTo:end.value,
        customerName:box.querySelector("#rgbName").value.trim(),
        customerEmail:box.querySelector("#rgbEmail").value.trim(),
        customerPhone:box.querySelector("#rgbPhone").value.trim()
      }});
      if(error||data?.error)throw new Error(data?.error||error?.message||"Zahlungsdienst nicht verfügbar");
      const destination=new URL(data.url);
      if(destination.protocol!=="https:"||destination.hostname!=="checkout.stripe.com")throw new Error("Ungültige Zahlungsadresse");
      window.location.assign(destination.href);
    }catch(err){msg.innerHTML='<div class="notice warn">'+esc(err?.message||"Buchung konnte nicht gestartet werden")+'</div>';b.disabled=false;b.textContent="Mit TWINT oder Kreditkarte bezahlen";}
   };
 }
 async function profile(){
   const {data:{user}}=await sb.auth.getUser();
   if(!user)return null;
   const {data:p}=await sb.from("profiles").select("id,role").eq("id",user.id).maybeSingle();
   return p;
 }
 async function connectPayout(){
   const b=document.getElementById("rvPayoutBtn");if(b)b.disabled=true;
   try{
     const {data,error}=await sb.functions.invoke("rental-connect",{body:{action:"onboard"}});
     if(error||data?.error)throw new Error(data?.error||error?.message);
     if(data.ready){alert("Dein Auszahlungskonto ist freigeschaltet.");return;}
     if(!data.url)throw new Error("Kein Onboarding-Link verfügbar");
     const next=new URL(data.url);
     if(next.protocol!=="https:"||!next.hostname.endsWith(".stripe.com"))throw new Error("Ungültiger Stripe-Link");
     window.location.assign(next.href);
   }catch(err){alert("Auszahlungskonto: "+(err?.message||"Fehler"));}
   finally{if(b)b.disabled=false;}
 }
 async function ownerBookings(){
   const me=await profile();if(me?.role!=="provider")return;
   const {data, error}=await sb.from("rental_bookings").select("id,customer_name,customer_email,customer_phone,date_from,date_to,days,total_cents,commission_cents,status,paid_at,vehicle_id").eq("provider_id",me.id).order("created_at",{ascending:false}).limit(60);
   if(error){alert("Buchungen konnten nicht geladen werden: "+error.message);return;}
   const ids=[...new Set((data||[]).map(x=>x.vehicle_id))];
   const {data:cars}=ids.length?await sb.from("rental_vehicles").select("id,title").in("id",ids):{data:[]};
   const titles=Object.fromEntries((cars||[]).map(x=>[x.id,x.title]));
   modal('<div class="row"><h3>Bestätigte Fahrzeugbuchungen</h3><button class="btn ghost small" data-rv-close>Schliessen</button></div>'+
     (!data?.length?"<p>Noch keine Buchungen vorhanden.</p>":data.map(x=>
       '<div class="offerCard"><b>'+esc(titles[x.vehicle_id]||"Fahrzeug")+'</b> · '+esc(x.status)+
       '<div class="meta">📅 '+esc(x.date_from)+' bis '+esc(x.date_to)+' · '+x.days+' Tag(e)</div>'+
       '<div class="meta">Kunde: '+esc(x.customer_name)+' · '+esc(x.customer_email)+(x.customer_phone?' · '+esc(x.customer_phone):'')+'</div>'+
       '<div><b>Vermieteranteil: '+money(x.total_cents-x.commission_cents)+'</b> · Plattformprovision: '+money(x.commission_cents)+'</div></div>'
     ).join("")));
 }
 async function installOwnerButtons(){
   if(!document.getElementById("rentals"))return;
   const me=await profile();if(me?.role!=="provider")return;
   const head=document.querySelector("#rentals .sectionHead");if(!head)return;
   if(!document.getElementById("rvPayoutBtn")){const b=document.createElement("button");b.id="rvPayoutBtn";b.className="btn secondary";b.textContent="🏦 Auszahlungskonto";b.onclick=connectPayout;head.appendChild(b);}
   if(!document.getElementById("rvBookingsBtn")){const b=document.createElement("button");b.id="rvBookingsBtn";b.className="btn secondary";b.textContent="✓ Buchungen";b.onclick=ownerBookings;head.appendChild(b);}
 }
 async function showReturn(){
   const params=new URLSearchParams(location.search);
   if(params.get("rental_connect")==="return"){modal('<h3>🏦 Auszahlungskonto</h3><p>Bitte prüfe unter „Auszahlungskonto“, ob deine Stripe-Registrierung vollständig ist.</p><button class="btn primary" data-rv-close>OK</button>');}
   if(params.get("rental_booking")==="cancelled"){modal('<h3>Bezahlung abgebrochen</h3><p>Es wurde keine Buchung bestätigt. Du kannst erneut ein Fahrzeug auswählen.</p><button class="btn primary" data-rv-close>OK</button>');}
   if(params.get("rental_booking")==="success"){
     const sessionId=params.get("session_id")||"";
     const box=modal('<h3>🚗 Zahlungsstatus wird geprüft</h3><p id="rvReturnStatus">Deine Zahlung wird abgeglichen. Eine Buchung ist erst nach bestätigter Zahlung verbindlich.</p><button class="btn primary" data-rv-close>Schliessen</button>');
     const {data,error}=await sb.functions.invoke("rental-status",{body:{sessionId}});
     if(!box.isConnected)return;
     const confirmed=!error&&data?.status==="confirmed"&&data?.paid===true;
     box.querySelector("#rvReturnStatus").textContent=confirmed
       ?"Deine Buchung für "+data.vehicle+" von "+data.from+" bis "+data.to+" ist bestätigt. Gesamtpreis: CHF "+Number(data.totalCHF).toFixed(2)+"."
       :"Die Zahlung wird noch geprüft. Bitte nicht erneut buchen. Falls du bereits bezahlt hast, prüfe den Buchungsstatus später oder kontaktiere den Support.";
   }
 }
 function bind(){
   document.addEventListener("click",ev=>{
     const b=ev.target.closest?.("[data-rental-inquiry]");
     if(!b)return;
     ev.preventDefault();ev.stopImmediatePropagation();
     book(b.dataset.rentalInquiry);
   },true);
   const root=document.getElementById("rentalList");
   if(root){
     const change=()=>root.querySelectorAll("[data-rental-inquiry]").forEach(b=>{if(b.textContent!=="Jetzt buchen & bezahlen")b.textContent="Jetzt buchen & bezahlen";});
     new MutationObserver(change).observe(root,{childList:true,subtree:true});change();
   }
   document.getElementById("rentalsNav")?.addEventListener("click",installOwnerButtons);
   installOwnerButtons();
   showReturn();
   sb.auth.onAuthStateChange(()=>setTimeout(installOwnerButtons,150));
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(bind,200));
 else setTimeout(bind,200);
})();
