// Standalone Edge Function: new rental Connect flow; existing subscription flows untouched.
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const allowed = ["https://www.meinauftrag24.ch", "https://meinauftrag24.ch", Deno.env.get("RENTAL_PREVIEW_ORIGIN")].filter(Boolean);
function cors(req: Request) { const o=req.headers.get("origin")||""; return {"access-control-allow-origin":allowed.includes(o)?o:allowed[0], "access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","vary":"Origin"}; }
function out(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json",...cors(req)}});}
const url = Deno.env.get("SUPABASE_URL") || "";
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const key=(Deno.env.get("STRIPE_RENTAL_SECRET_KEY") || Deno.env.get("STRIPE_LIVE_SECRET_KEY")) || "";
const base="https://www.meinauftrag24.ch/";
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return out(req,{error:"POST erforderlich"},405);
 if(!key.startsWith("sk_"))return out(req,{error:"Zahlungsanbieter noch nicht eingerichtet"},503);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))return out(req,{error:"Bitte als Vermieter anmelden"},401);
 const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:auth}}});
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return out(req,{error:"Anmeldung ungültig"},401);
 const {data:profile,error:profileError}=await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profileError||profile?.role!=="provider")return out(req,{error:"Nur Vermieter können ein Auszahlungskonto verbinden"},403);
 let action="status";
 try {action=(await req.json()).action||"status";}catch{}
 if(!["status","onboard"].includes(action))return out(req,{error:"Ungültige Aktion"},400);
 const stripe=new Stripe(key,{apiVersion:"2025-02-24.acacia"});
 try{
  let {data:record,error:readErr}=await admin.from("rental_payout_accounts").select("*").eq("provider_id",user.id).maybeSingle();
  if(readErr)throw readErr;
  let account:Stripe.Account|null=null;
  if(record) account=await stripe.accounts.retrieve(record.stripe_account_id);
  if(!record&&action==="onboard"){
    account=await stripe.accounts.create({type:"express",country:"CH",email:user.email||undefined,capabilities:{transfers:{requested:true}}},{idempotencyKey:"rental-owner-"+user.id});
    const {error:writeErr}=await admin.from("rental_payout_accounts").insert({provider_id:user.id,stripe_account_id:account.id}).select().single();
    if(writeErr)throw writeErr;
    record={stripe_account_id:account.id};
  }
  if(account){
    const flags={charges_enabled:account.charges_enabled,payouts_enabled:account.payouts_enabled,details_submitted:account.details_submitted,updated_at:new Date().toISOString()};
    const {error:updateErr}=await admin.from("rental_payout_accounts").update(flags).eq("provider_id",user.id);
    if(updateErr)throw updateErr;
    const ready=Boolean(account.payouts_enabled && account.capabilities?.transfers==="active");
    if(action==="status")return out(req,{connected:true,ready,detailsSubmitted:account.details_submitted});
    if(ready)return out(req,{connected:true,ready:true});
    const link=await stripe.accountLinks.create({account:account.id,type:"account_onboarding",return_url:base+"?rental_connect=return",refresh_url:base+"?rental_connect=refresh"});
    return out(req,{connected:true,ready:false,url:link.url});
  }
  return out(req,{connected:false,ready:false});
 }catch(err){console.error("Rental Connect:",err instanceof Error?err.message:"unknown");return out(req,{error:"Auszahlungskonto konnte nicht eingerichtet werden"},500);}
});
