import {clearCookie,secureRequest,sameOrigin,json} from '../../lib/admin-auth.js';
export default async function handler(req,res){if(req.method!=='POST'||!sameOrigin(req))return json(res,403,{ok:false});res.setHeader('Set-Cookie',clearCookie(secureRequest(req)));return json(res,200,{ok:true})}
