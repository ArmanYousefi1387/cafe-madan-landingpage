import {authorized,sameOrigin,json} from '../../lib/admin-auth.js';
const STATUSES=new Set(['new','contacted','confirmed']);
export default async function handler(req,res){
 if(!authorized(req))return json(res,401,{ok:false,message:'برای مشاهده اطلاعات وارد پنل شوید.'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return json(res,503,{ok:false,message:'دیتابیس هنوز تنظیم نشده است.'});
 if(req.method==='PATCH'&&!sameOrigin(req))return json(res,403,{ok:false});
 if(!['GET','PATCH'].includes(req.method))return json(res,405,{ok:false});
 try{
   let url=new URL('/rest/v1/event_registrations',base);
   const headers={apikey:key,Authorization:'Bearer '+key};
   if(req.method==='GET'){
      const offset=Math.max(0,Math.min(100000,Number(req.query?.offset)||0)),limit=Math.max(1,Math.min(200,Number(req.query?.limit)||100));
      url.searchParams.set('select','id,full_name,phone,role,company,status,consent_at,created_at');url.searchParams.set('order','created_at.desc');url.searchParams.set('limit',String(limit));url.searchParams.set('offset',String(offset));
      const response=await fetch(url.href,{headers:{...headers,Prefer:'count=exact'},cache:'no-store'});if(!response.ok)return json(res,503,{ok:false,message:'خواندن داده‌ها ناموفق بود.'});
      const data=await response.json();const range=response.headers.get('content-range')||'';const count=Number(range.split('/')[1]);return json(res,200,{ok:true,items:data,total:Number.isFinite(count)?count:data.length,offset,limit});
   }
   const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const id=Number(body.id),status=String(body.status||'');
   if(!Number.isSafeInteger(id)||id<1||!STATUSES.has(status))return json(res,422,{ok:false,message:'داده معتبر نیست.'});
   url.searchParams.set('id','eq.'+id);
   const response=await fetch(url.href,{method:'PATCH',headers:{...headers,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status})});
   if(!response.ok)return json(res,503,{ok:false,message:'تغییر وضعیت ذخیره نشد.'});
   return json(res,200,{ok:true});
 }catch{return json(res,503,{ok:false,message:'ارتباط با سامانه برقرار نشد.'})}
}
