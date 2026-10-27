import {matchPassword,createSession,sessionCookie,secureRequest,sameOrigin,json,enabled} from '../../lib/admin-auth.js';
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{ok:false,message:'روش نامعتبر'})}
 if(!sameOrigin(req))return json(res,403,{ok:false,message:'مبدأ نامعتبر'});
 if(!enabled())return json(res,503,{ok:false,message:'پنل مدیریت هنوز تنظیم نشده است.'});
 const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
 if(typeof body.password!=='string'||body.password.length>200||!matchPassword(body.password))return json(res,401,{ok:false,message:'رمز ورود نادرست است.'});
 res.setHeader('Set-Cookie',sessionCookie(createSession(),secureRequest(req)));
 return json(res,200,{ok:true});
}
