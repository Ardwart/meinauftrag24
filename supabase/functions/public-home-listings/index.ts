// Public home feed for MeinAuftrag24.ch.
// Only intentionally public listing fields are returned. No customer IDs,
// addresses beyond town/postal code, contact data, descriptions or subscription records.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const publicDb=createClient(supabaseUrl,anonKey,{auth:{persistSession:false}});
const adminDb=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
const allowedOrigins=new Set([
  "https://meinauftrag24.ch","https://www.meinauftrag24.ch",
  "https://allrounder24.vercel.app"
]);
const cors=(request:Request)=>{
  const origin=request.headers.get("origin")||"";
  return {
    "access-control-allow-origin":allowedOrigins.has(origin)?origin:"https://www.meinauftrag24.ch",
    "access-control-allow-methods":"GET,POST,OPTIONS",
    "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
    "vary":"Origin"
  };
};
const respond=(request:Request,value:unknown,status=200)=>
  new Response(JSON.stringify(value),{status,headers:{
    ...cors(request),"content-type":"application/json; charset=utf-8","cache-control":"no-store"
  }});
Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")
    return new Response(null,{status:204,headers:cors(request)});
  if(!["GET","POST"].includes(request.method))
    return respond(request,{error:"Method not allowed"},405);
  try{
    const now=new Date();
    const today=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"
    }).format(now);

    // This query intentionally bypasses RLS, but releases only a small,
    // explicit set of fields for OPEN, NOT-EXPIRED customer requests.
    const [jobResponse,carResponse]=await Promise.all([
      adminDb.from("jobs")
        .select("id,title,category,city,postal_code,desired_date,budget,created_at")
        .eq("status","open").gt("expires_at",now.toISOString())
        .order("created_at",{ascending:false}).limit(60),
      // Visitor role keeps existing provider-subscription listing restrictions.
      publicDb.from("rental_vehicles")
        .select("id,title,make,model,vehicle_type,location,daily_rate,available_from,available_to,created_at")
        .eq("is_active",true)
        .or("available_to.is.null,available_to.gte."+today)
        .order("created_at",{ascending:false}).limit(60)
    ]);
    if(jobResponse.error||carResponse.error){
      console.error("Public home feed query",{
        jobs:jobResponse.error?.message||"ok",vehicles:carResponse.error?.message||"ok"
      });
      return respond(request,{error:"Anzeigen sind vorübergehend nicht verfügbar"},503);
    }
    const cars=carResponse.data||[];
    const ids=cars.map(car=>car.id);
    const firstPhotos:Record<string,string>={};
    if(ids.length){
      const {data:photos,error:photoError}=await adminDb.from("rental_vehicle_photos")
        .select("vehicle_id,image_url,sort_order").in("vehicle_id",ids)
        .order("sort_order",{ascending:true}).limit(250);
      if(photoError)console.error("Home photos error",photoError.message);
      for(const photo of photos||[]){
        if(!firstPhotos[photo.vehicle_id]&&typeof photo.image_url==="string"){
          try{
            const target=new URL(photo.image_url);
            if(target.protocol==="https:"&&target.hostname===new URL(supabaseUrl).hostname)
              firstPhotos[photo.vehicle_id]=photo.image_url;
          }catch{/* invalid photo URL */}
        }
      }
    }
    const vehicles=cars.map(v=>({
      id:v.id,title:v.title,make:v.make,model:v.model,vehicle_type:v.vehicle_type,
      location:v.location,daily_rate:v.daily_rate,
      available_from:v.available_from,available_to:v.available_to,
      photo_url:firstPhotos[v.id]||null
    }));
    const jobs=(jobResponse.data||[]).map(j=>({
      id:j.id,title:j.title,category:j.category,city:j.city,
      postal_code:j.postal_code,desired_date:j.desired_date,
      budget:j.budget,created_at:j.created_at
    }));
    return respond(request,{jobs,vehicles});
  }catch(error){
    console.error("Public home feed",error instanceof Error?error.message:"unexpected");
    return respond(request,{error:"Anzeigen sind vorübergehend nicht verfügbar"},503);
  }
});
