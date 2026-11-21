// Guest Checkout for rental vehicles. NEVER reuse existing subscription endpoints.
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origins=["https://www.meinauftrag24.ch","https://meinauftrag24.ch",Deno.env.get("RENTAL_PREVIEW_ORIGIN")].filter(Boolean);
function cors(req:Request){const o=req.headers.get("origin")||"";return {"access-control-allow-origin":origins.includes(o)?o:origins[0],"access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"};}
function result(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json",...cors(req)}});}
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
const secret=Deno.env.get("STRIPE_RENTAL_SECRET_KEY")||"";
const isDate=(d:unknown)=>typeof d==="string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isUuid=(s:unknown)=>typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return result(req,{error:"POST erforderlich"},405);
 // Fail closed until Stripe Connect and the new isolated webhook are configured and tested.
 if(Deno.env.get("RENTAL_PAYMENTS_ENABLED")!=="true"||!secret.startsWith("sk_"))
   return result(req,{error:"Onlinebuchung ist noch nicht freigeschaltet"},503);
 const origin=req.headers.get("origin");
 if(origin && !origins.includes(origin))return result(req,{error:"Ungültiger Ursprung"},403);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return result(req,{error:"Ungültige Daten"},400);}
 const {vehicleId,dateFrom,dateTo}=body;
 const customerName=String(body.customerName||"").trim();
 const customerEmail=String(body.customerEmail||"").trim().toLowerCase();
 const customerPhone=String(body.customerPhone||"").trim();
 if(!isUuid(vehicleId)||!isDate(dateFrom)||!isDate(dateTo)||
    customerName.length<2||customerName.length>120||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)||customerEmail.length>254||
    customerPhone.length>50)
    return result(req,{error:"Bitte Fahrzeug, Mietdaten und Kontaktdaten prüfen"},400);
 const stripe=new Stripe(secret,{apiVersion:"2025-02-24.acacia"});
 let bookingId:string|null=null;
 try{
  const {data:vehicle,error:vErr}=await db.from("rental_vehicles").select("id,provider_id,title").eq("id",vehicleId).eq("is_active",true).maybeSingle();
  if(vErr||!vehicle)return result(req,{error:"Fahrzeug nicht verfügbar"},404);
  const {data:payout,error:pErr}=await db.from("rental_payout_accounts").select("stripe_account_id,payouts_enabled").eq("provider_id",vehicle.provider_id).maybeSingle();
  if(pErr||!payout||!payout.payouts_enabled)return result(req,{error:"Vermieter hat sein Auszahlungskonto noch nicht freigeschaltet"},409);
  const account=await stripe.accounts.retrieve(payout.stripe_account_id);
  if(!account.payouts_enabled||account.capabilities?.transfers!=="active")
    return result(req,{error:"Auszahlungskonto ist noch nicht vollständig freigeschaltet"},409);
  const {data:reserved,error:reserveError}=await db.rpc("rental_reserve_booking",{
    p_vehicle_id:vehicleId,p_date_from:dateFrom,p_date_to:dateTo,
    p_customer_name:customerName,p_customer_email:customerEmail,p_customer_phone:customerPhone
  });
  if(reserveError||!reserved?.[0])return result(req,{error:reserveError?.message||"Fahrzeug nicht verfügbar"},409);
  const r=reserved[0];bookingId=r.booking_id;
  const amount=Number(r.total_cents);
  if(!Number.isSafeInteger(amount)||amount<=0)throw Error("Invalid rental amount");
  const session=await stripe.checkout.sessions.create({
    mode:"payment",
    payment_method_types:amount<=500000?["card","twint"]:["card"],
    customer_email:customerEmail,
    client_reference_id:bookingId,
    line_items:[{price_data:{currency:"chf",unit_amount:amount,product_data:{name:"Fahrzeugmiete: "+r.vehicle_title}},quantity:1}],
    payment_intent_data:{
      application_fee_amount:Number(r.commission_cents),
      transfer_data:{destination:payout.stripe_account_id},
      metadata:{rental_booking_id:bookingId,vehicle_id:String(vehicleId),kind:"rental"}
    },
    metadata:{rental_booking_id:bookingId,vehicle_id:String(vehicleId),kind:"rental"},
    success_url:"https://www.meinauftrag24.ch/?rental_booking=success&session_id={CHECKOUT_SESSION_ID}",
    cancel_url:"https://www.meinauftrag24.ch/?rental_booking=cancelled",
    expires_at:Math.floor(Date.now()/1000)+30*60
  },{idempotencyKey:"rental-checkout-"+bookingId});
  const {error:updateError}=await db.from("rental_bookings").update({stripe_checkout_session_id:session.id,updated_at:new Date().toISOString()}).eq("id",bookingId).eq("status","pending_payment");
  if(updateError){
    await stripe.checkout.sessions.expire(session.id).catch(()=>{});
    throw updateError;
  }
  if(!session.url)throw Error("Missing Stripe Checkout URL");
  return result(req,{url:session.url,bookingId});
 }catch(err){
  if(bookingId)await db.from("rental_bookings").update({status:"failed",updated_at:new Date().toISOString()}).eq("id",bookingId).eq("status","pending_payment");
  console.error("Rental Checkout:",err instanceof Error?err.message:"unknown");
  return result(req,{error:"Buchung konnte nicht gestartet werden. Bitte erneut versuchen."},502);
 }
});
