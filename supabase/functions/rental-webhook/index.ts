// Isolated rental webhook. Configure a NEW Stripe endpoint/whsec; never edit subscription webhook.
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

async function notifyPaidBooking(bookingId:string){
 const {data:b,error}=await db.from("rental_bookings").select("*").eq("id",bookingId).maybeSingle();
 if(error)throw error;
 if(!b||b.status!=="confirmed"||b.notification_sent_at)return;
 const key=Deno.env.get("RESEND_API_KEY");
 if(!key)throw Error("RESEND_API_KEY not configured for paid bookings");
 const {data:account,error:accountError}=await db.auth.admin.getUserById(b.provider_id);
 if(accountError||!account?.user?.email)throw Error("Rental owner has no email");
 const {data:vehicle}=await db.from("rental_vehicles").select("title").eq("id",b.vehicle_id).maybeSingle();
 const title=vehicle?.title||"Mietfahrzeug";
 const dates=b.date_from+" bis "+b.date_to;
 async function send(to:string,subject:string,body:string,keySuffix:string){
  const r=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",
    "Idempotency-Key":"rental-"+bookingId+"-"+keySuffix},
   body:JSON.stringify({from:"MeinAuftrag24 Buchungen <support@meinauftrag24.ch>",to:[to],subject,text:body})
  });
  if(!r.ok)throw Error("Resend failed "+r.status);
 }
 await send(b.customer_email,"Deine Fahrzeugbuchung ist bestätigt",
  "Guten Tag "+b.customer_name+"\n\nDeine Zahlung wurde bestätigt.\n"+
  "Fahrzeug: "+title+"\nMietzeitraum: "+dates+"\nGesamtbetrag: CHF "+(b.total_cents/100).toFixed(2)+
  "\n\nDer Vermieter meldet sich bezüglich der Fahrzeugübergabe.\n\nMeinAuftrag24.ch","customer");
 await send(account.user.email,"Neue bezahlte Fahrzeugbuchung",
  "Eine Fahrzeugbuchung wurde vollständig bezahlt.\n"+
  "Fahrzeug: "+title+"\nMietzeitraum: "+dates+
  "\nKunde: "+b.customer_name+"\nE-Mail: "+b.customer_email+
  "\nTelefon: "+(b.customer_phone||"nicht angegeben")+
  "\nDein Mietanteil vor Zahlungsgebühren: CHF "+(b.owner_cents/100).toFixed(2)+
  "\nPlattformprovision 10 %: CHF "+(b.commission_cents/100).toFixed(2)+
  "\n\nBitte organisiere die Fahrzeugübergabe.\nMeinAuftrag24.ch","provider");
 const {error:markErr}=await db.from("rental_bookings").update({
  notification_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()
 }).eq("id",bookingId).eq("status","confirmed").is("notification_sent_at",null);
 if(markErr)throw markErr;
}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"POST required"},405);
 const secret=Deno.env.get("STRIPE_RENTAL_SECRET_KEY")||"";
 const webhookSecret=Deno.env.get("STRIPE_RENTAL_WEBHOOK_SECRET")||"";
 if(!secret.startsWith("sk_")||!webhookSecret.startsWith("whsec_"))return json({error:"Rental webhook not configured"},503);
 const sig=req.headers.get("stripe-signature")||"";
 if(!sig)return json({error:"Signature required"},400);
 const stripe=new Stripe(secret,{apiVersion:"2025-02-24.acacia"});
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(await req.text(),sig,webhookSecret);}
 catch{return json({error:"Invalid signature"},400);}
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded",
       "checkout.session.async_payment_failed","checkout.session.expired"].includes(event.type))
   return json({received:true,ignored:true});
 const session=event.data.object as Stripe.Checkout.Session;
 if(session.metadata?.kind!=="rental"||!session.metadata?.rental_booking_id)return json({received:true,ignored:true});
 try{
  const bookingId=session.metadata.rental_booking_id;
  const {data:b,error:readError}=await db.from("rental_bookings").select("*").eq("id",bookingId).maybeSingle();
  if(readError)throw readError;
  if(!b)return json({error:"Rental booking not found"},404);
  if(b.stripe_checkout_session_id && b.stripe_checkout_session_id!==session.id)
    return json({error:"Checkout session mismatch"},409);
  if(session.mode!=="payment"||session.currency!=="chf"||Number(session.amount_total)!==Number(b.total_cents))
    return json({error:"Checkout amount or currency mismatch"},409);
  if(event.type==="checkout.session.expired"||event.type==="checkout.session.async_payment_failed"){
    const next=event.type==="checkout.session.expired"?"expired":"failed";
    const {error:updateError}=await db.from("rental_bookings")
      .update({status:next,updated_at:new Date().toISOString()})
      .eq("id",bookingId).eq("status","pending_payment");
    if(updateError)throw updateError;
    return json({received:true,status:next});
  }
  // Checkout completion alone is not sufficient; paid is the only success state.
  if(session.payment_status!=="paid")return json({received:true,status:"unpaid"});
  const paymentIntent=typeof session.payment_intent==="string"
    ?session.payment_intent:session.payment_intent?.id;
  if(!paymentIntent)return json({error:"Missing payment intent"},409);
  if(b.status==="confirmed"){await notifyPaidBooking(bookingId);return json({received:true,status:"confirmed"});}
  if(b.status!=="pending_payment"){
    // A late-paid/invalidated hold must not cause a second confirmed rental.
    await stripe.refunds.create({
      payment_intent:paymentIntent,
      reverse_transfer:true,
      refund_application_fee:true,
      reason:"requested_by_customer"
    },{idempotencyKey:"rental-late-refund-"+bookingId});
    const {error:refErr}=await db.from("rental_bookings").update({
      status:"refunded",stripe_payment_intent_id:paymentIntent,updated_at:new Date().toISOString()
    }).eq("id",bookingId).neq("status","confirmed");
    if(refErr)throw refErr;
    return json({received:true,status:"refunded"});
  }
  const {data:confirmed,error:upErr}=await db.from("rental_bookings").update({
    status:"confirmed",stripe_checkout_session_id:session.id,
    stripe_payment_intent_id:paymentIntent,paid_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq("id",bookingId).eq("status","pending_payment").select("id,provider_id,customer_email").maybeSingle();
  if(upErr)throw upErr;
  await notifyPaidBooking(bookingId);
  return json({received:true,status:confirmed?"confirmed":"already_processed"});
 }catch(err){
  console.error("Rental webhook:",err instanceof Error?err.message:"unknown");
  return json({error:"Processing failed"},500);
 }
});
