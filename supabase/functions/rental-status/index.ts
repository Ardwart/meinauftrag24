// Public read-only status by opaque Stripe Checkout Session ID; never exposes contact details.
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origins=["https://www.meinauftrag24.ch","https://meinauftrag24.ch",Deno.env.get("RENTAL_PREVIEW_ORIGIN")].filter(Boolean);
function cors(req:Request){const o=req.headers.get("origin")||"";return {"access-control-allow-origin":origins.includes(o)?o:origins[0],"access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"};}
const out=(req:Request,data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json",...cors(req)}});
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return out(req,{error:"POST required"},405);
 const key=(Deno.env.get("STRIPE_RENTAL_SECRET_KEY") || Deno.env.get("STRIPE_LIVE_SECRET_KEY"))||"";
 if(!key.startsWith("sk_"))return out(req,{error:"Zahlungsstatus derzeit nicht verfügbar"},503);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return out(req,{error:"Invalid request"},400);}
 const id=body.sessionId;
 if(typeof id!=="string"||!/^cs_(test_)?[a-zA-Z0-9]{20,}$/.test(id))return out(req,{error:"Ungültige Buchungsnummer"},400);
 try{
  const stripe=new Stripe(key,{apiVersion:"2025-02-24.acacia"});
  const session=await stripe.checkout.sessions.retrieve(id);
  if(session.metadata?.kind!=="rental")return out(req,{error:"Buchung nicht gefunden"},404);
  const {data:b,error}=await db.from("rental_bookings")
    .select("id,vehicle_id,date_from,date_to,days,total_cents,commission_cents,status,paid_at")
    .eq("stripe_checkout_session_id",id).maybeSingle();
  if(error||!b)return out(req,{error:"Buchung nicht gefunden"},404);
  const {data:v}=await db.from("rental_vehicles").select("title").eq("id",b.vehicle_id).maybeSingle();
  return out(req,{status:b.status,paid:session.payment_status==="paid",vehicle:v?.title||"Mietfahrzeug",
     from:b.date_from,to:b.date_to,days:b.days,totalCHF:Number(b.total_cents)/100});
 }catch{return out(req,{error:"Buchungsstatus konnte nicht abgefragt werden"},503);}
});
