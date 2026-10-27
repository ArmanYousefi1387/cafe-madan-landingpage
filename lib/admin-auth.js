import {createHmac,timingSafeEqual} from 'node:crypto';
const COOKIE='cm_admin_session';
function eq(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)}
function signature(value){const secret=process.env.ADMIN_SESSION_SECRET||'';if(secret.length<32)return null;return createHmac('sha256',secret).update(value).digest('base64url')}
export function enabled(){return Boolean(process.env.ADMIN_PASSWORD&&process.env.ADMIN_SESSION_SECRET?.length>=32)}
export function matchPassword(given){return enabled()&&eq(given,process.env.ADMIN_PASSWORD)}
export function createSession(){const expiration=String(Date.now()+8*60*60*1000);return expiration+'.'+signature(expiration)}
export function cookieValue(req){const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return cookie?.slice((COOKIE+'=').length)||''}
export function authorized(req){if(!enabled())return false;const value=cookieValue(req);const parts=value.split('.');if(parts.length!==2||!/^\d{13}$/.test(parts[0]))return false;if(Number(parts[0])<Date.now())return false;const s=signature(parts[0]);return !!s&&eq(s,parts[1])}
export function sessionCookie(token,secure=true){return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=28800${secure?'; Secure':''}`}
export function clearCookie(secure=true){return `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`}
export function secureRequest(req){return req.headers['x-forwarded-proto']!=='http'}
export function sameOrigin(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===(req.headers['x-forwarded-host']||req.headers.host)}catch{return false}}
export function json(res,status,data){res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data)}
