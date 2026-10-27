const ROLES=new Set(['investor','manager','specialist','operator','founder','other']);
function digits(v){return String(v||'').replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776).replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632)}
function phone(v){let s=digits(v).replace(/[\s\-()]/g,'');if(s.startsWith('+98'))s='0'+s.slice(3);if(s.startsWith('0098'))s='0'+s.slice(4);if(/^9\d{9}$/.test(s))s='0'+s;return s}
function send(res,status,message){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json({ok:status>=200&&status<300,message})}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,'روش درخواست معتبر نیست.')}
 try{const host=req.headers['x-forwarded-host']||req.headers.host;if(req.headers.origin&&new URL(req.headers.origin).host!==host)return send(res,403,'مبدأ درخواست معتبر نیست.')}catch{return send(res,403,'مبدأ درخواست معتبر نیست.')}
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(res,415,'نوع درخواست معتبر نیست.');
 let data=req.body;try{if(typeof data==='string')data=JSON.parse(data)}catch{return send(res,400,'اطلاعات معتبر نیست.');}
 if(!data||typeof data!=='object'||Array.isArray(data))return send(res,400,'اطلاعات معتبر نیست.');
 if(String(data.fax_number||'').trim())return send(res,400,'درخواست معتبر نیست.');
 const full_name=String(data.full_name||'').trim().replace(/\s+/g,' ');
 const normalizedPhone=phone(data.phone),role=String(data.role||''),company=String(data.company||'').trim().replace(/\s+/g,' ');
 if(full_name.length<3||full_name.length>90)return send(res,422,'لطفاً نام و نام خانوادگی را کامل وارد کنید.');
 if(!/^09\d{9}$/.test(normalizedPhone))return send(res,422,'لطفاً شماره موبایل معتبر ایرانی وارد کنید.');
 if(!ROLES.has(role))return send(res,422,'لطفاً حوزه فعالیت را انتخاب کنید.');
 if(data.consent!==true)return send(res,422,'برای ثبت درخواست، موافقت خود را تأیید کنید.');
 if(company.length>90)return send(res,422,'نام مجموعه بیش از حد طولانی است.');
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return send(res,503,'سامانه ثبت‌نام هنوز به دیتابیس متصل نشده است.');
 let url;try{url=new URL('/rest/v1/event_registrations',base)}catch{return send(res,503,'تنظیمات ثبت‌نام تکمیل نیست.');}
 try{
  const upstream=await fetch(url.href,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({full_name,phone:normalizedPhone,role,company:company||null,consent_at:new Date().toISOString()})});
  if(upstream.ok)return send(res,201,'درخواست شما ثبت شد. همکاران کافه معدن با شما تماس می‌گیرند.');
  const err=await upstream.json().catch(()=>({}));if(err.code==='23505')return send(res,409,'این شماره موبایل قبلاً برای همایش ثبت شده است.');
  return send(res,503,'ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.');
 }catch{return send(res,503,'خطا در ارتباط با سامانه ثبت‌نام. لطفاً دوباره تلاش کنید.');}
}
