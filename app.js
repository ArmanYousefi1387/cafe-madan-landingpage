(()=>{'use strict';
const $=(sel,scope=document)=>scope.querySelector(sel);
const $$=(sel,scope=document)=>[...scope.querySelectorAll(sel)];
const motionReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const story=$('.story'),storyStatus=$('#story-status'),track=$('#film-track-progress'),peek=$('.story-peek');
const chapters=$$('.film-chapter'), canvas=$('#story-canvas'), ctx=canvas.getContext('2d',{alpha:false});
const poster=$('#story-poster');
const FRAME_COUNT=100,FRAME_DURATION=18.5,FRAME_URL=i=>`./assets/scrollframes/frame-${String(i).padStart(3,'0')}.webp`;
let activeChapter=-1,raf=0,lastProgress=-1,displayed=-1;
const cached=new Map(),pending=new Map(), MAX_CACHED=16;
const clampNum=(n,min,max)=>Math.max(min,Math.min(max,n));
let filmH=window.innerHeight, filmW=window.innerWidth;
let frameCacheWarned=false;
function videoProgress(){
 const rect=story.getBoundingClientRect();const journey=Math.max(1,story.offsetHeight-filmH);
 return clampNum(-rect.top/journey,0,1);
}
function ensureCanvasSize(){
 const w=Math.max(1,Math.round(canvas.clientWidth)), h=Math.max(1,Math.round(canvas.clientHeight));
 const pr=Math.min(2,window.devicePixelRatio||1);
 const cw=Math.round(w*pr),ch=Math.round(h*pr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
}
function frameDraw(img){
 if(!img||!img.naturalWidth)return;
 ensureCanvasSize();
 const cw=canvas.width,ch=canvas.height,r=Math.max(cw/img.naturalWidth,ch/img.naturalHeight);
 const dw=img.naturalWidth*r,dh=img.naturalHeight*r;
 ctx.drawImage(img,(cw-dw)/2,(ch-dh)/2,dw,dh);
 poster.classList.add('poster-off');
}
function trimCache(around){
 if(cached.size<=MAX_CACHED)return;
 const keys=[...cached.keys()].sort((a,b)=>Math.abs(b-around)-Math.abs(a-around));
 while(cached.size>MAX_CACHED && keys.length){ const k=keys.shift();if(k===displayed)continue;cached.delete(k); }
}
function loadFrame(i, priority=false){
 if(i<0||i>=FRAME_COUNT || cached.has(i)||pending.has(i))return;
 const target=Math.round(Math.max(0,lastProgress)*(FRAME_COUNT-1));
 // Prioritise frames at the finger's CURRENT scroll position. Cancel stale decodes.
 if(priority && pending.size>=4){
  const farthest=[...pending.keys()].sort((x,y)=>Math.abs(y-target)-Math.abs(x-target))[0];
  if(farthest!==undefined && Math.abs(farthest-target)>2){
    const obsolete=pending.get(farthest);pending.delete(farthest);obsolete.src='';
  }
 }
 if(pending.size >= (priority?6:3))return;
 const img=new Image();img.decoding='async';pending.set(i,img);img.src=FRAME_URL(i);
 const onReady=()=>{if(pending.get(i)!==img)return;pending.delete(i);cached.set(i,img);trimCache(Math.round(lastProgress*(FRAME_COUNT-1)));requestPaint();};
 const onFail=()=>{if(pending.get(i)===img)pending.delete(i);};
 if(typeof img.decode==='function')img.decode().then(onReady).catch(onFail);
 else {img.onload=onReady;img.onerror=onFail; if(img.complete&&img.naturalWidth)onReady();}
}
function renderFrame(p){
 const exact=p*(FRAME_COUNT-1),first=Math.floor(exact),second=Math.min(FRAME_COUNT-1,first+1),mix=exact-first;
 loadFrame(first,true);loadFrame(second,true);
 const one=cached.get(first),two=cached.get(second);
 if(one || two){
  ensureCanvasSize();
  const draw=(img,opacity)=>{
    const cw=canvas.width,ch=canvas.height,r=Math.max(cw/img.naturalWidth,ch/img.naturalHeight);
    const dw=img.naturalWidth*r,dh=img.naturalHeight*r;
    ctx.globalAlpha=opacity;ctx.drawImage(img,(cw-dw)/2,(ch-dh)/2,dw,dh);
  };
  ctx.globalAlpha=1;
  if(one&&two){draw(one,1);draw(two,mix);}else draw(one||two,1);
  ctx.globalAlpha=1;
  displayed=first;poster.classList.add('poster-off');
 }else{
  // Reuse nearest previously decoded frame until current one is ready.
  let nearest=-1,distance=Infinity;
  for(const n of cached.keys()){const d=Math.abs(n-exact);if(d<distance){nearest=n;distance=d;}}
  if(nearest!==-1&&nearest!==displayed){frameDraw(cached.get(nearest));displayed=nearest;}
 }
 for(const d of [-1,2])loadFrame(first+d);
}
function paintStory(){
 raf=0;const p=videoProgress();
 lastProgress=p;
 track.style.transform=`scaleX(${p})`;
 let scene=p<.25?0:p<.51?1:p<.77?2:3;
 if(activeChapter!==scene){activeChapter=scene;chapters.forEach((node,i)=>node.classList.toggle('is-active',i===scene));}
 story.classList.toggle('is-light',scene===2);story.classList.toggle('is-last-scene',scene===3);story.classList.toggle('is-ended',p>=.99);
 // Final 9.5% of the narrative becomes a controlled, white-section reveal.
 // Smoothstep keeps the title drift and section peek continuous at both ends.
 const t=clampNum((p-.905)/.095,0,1);
 const exitProgress=t*t*(3-2*t);
 // Film and page share exactly the same white surface at the handoff.
 // A uniform (non-gradient) white sheet gently replaces the last filmed frames.
 const whiteT=clampNum((p-.845)/.155,0,1);
 const whiteout=whiteT*whiteT*(3-2*whiteT);
 story.style.setProperty('--whiteout',whiteout.toFixed(4));
 story.classList.toggle('is-white-ending',p>=.925);
 story.style.setProperty('--exit-progress',exitProgress.toFixed(4));
 story.style.setProperty('--chapter-rise',(exitProgress*(window.innerWidth<=350?48:64)).toFixed(2)+'px');
 story.style.setProperty('--chapter-opacity',(1-.08*exitProgress).toFixed(3));
 story.style.setProperty('--peek-rise',(exitProgress*peek.offsetHeight).toFixed(2)+'px');
 story.style.setProperty('--peek-opacity',Math.min(1,exitProgress*1.8).toFixed(3));
 story.style.setProperty('--bottom-rise',(exitProgress*12).toFixed(2)+'px');
 story.style.setProperty('--bottom-opacity',(1-exitProgress).toFixed(3));
 storyStatus.textContent=p>=.99?'پایان روایت · ادامه دعوت‌نامه':'فصل '+String(scene+1).padStart(2,'0')+' / 04';
 document.body.classList.toggle('in-film',story.getBoundingClientRect().bottom>filmH*.95);
 renderFrame(p);
}
function requestPaint(){if(!raf)raf=requestAnimationFrame(paintStory)}
window.addEventListener('scroll',requestPaint,{passive:true});
window.addEventListener('resize',()=>{filmH=window.innerHeight;filmW=window.innerWidth;displayed=-1;requestPaint();},{passive:true});
window.addEventListener('pageshow',()=>{filmH=window.innerHeight;requestPaint();});
// Always starts at frame zero without autoplay. Scrolling both ways controls the frame.
loadFrame(0,true);requestPaint();
const roles={
 investor:{label:'برای سرمایه‌گذاران',title:'فرصت را از هیجان جدا کنید.',desc:'پیش از ورود سرمایه، سؤال‌های درست را بشناسید.',tags:['سنجش ریسک','درک بازده واقعی','بررسی توجیه اقتصادی']},
 manager:{label:'برای مدیران',title:'عددها را پیش از تصمیم ببینید.',desc:'از هزینه‌های پنهان تا اثر هر انتخاب روی آینده پروژه.',tags:['شناخت هزینه‌های پنهان','تحلیل جریان نقدی','تصمیم‌سازی دقیق‌تر']},
 specialist:{label:'برای کارشناسان',title:'فقط گزارش ندهید؛ تحلیل کنید.',desc:'زبان فنی را به بینش اقتصادی قابل استفاده تبدیل کنید.',tags:['سواد مالی کاربردی','درک بودجه پروژه','نگاه اقتصادی به عملیات']},
 operator:{label:'برای بهره‌برداران',title:'سود، در جزئیات عملیات است.',desc:'رابطه میان استخراج، منابع و هزینه واقعی را شفاف‌تر ببینید.',tags:['هزینه واقعی عملیات','شناخت نقاط اتلاف','بهره‌وری بهتر منابع']},
 founder:{label:'برای کارآفرینان',title:'ایده خوب، باید عدد هم داشته باشد.',desc:'فرصت‌ها را قبل از شروع، با منطق اقتصاد بسنجید.',tags:['مدل مالی کسب‌وکار','سنجش ظرفیت رشد','درک ریسک ورود']}
};
const tabs=$$('.role-tab'),panel=$('#role-panel');let roleTimer=null, roleVersion=0;
function switchRole(tab,focus){
 const d=roles[tab.dataset.role];if(!d)return;
 tabs.forEach(t=>{let selected=t===tab;t.classList.toggle('is-active',selected);t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1});
 if(focus)tab.focus();panel.setAttribute('aria-labelledby',tab.id);
 clearTimeout(roleTimer);const version=++roleVersion;
 panel.classList.remove('is-entering');panel.classList.add('is-changing');
 roleTimer=setTimeout(()=>{
   if(version!==roleVersion)return;
   $('#role-label').textContent=d.label;$('#role-title').textContent=d.title;$('#role-desc').textContent=d.desc;
   const tags=$('#role-benefits');tags.replaceChildren();d.tags.forEach(s=>{let el=document.createElement('span');el.textContent=s;tags.append(el)});
   const index=tabs.indexOf(tab);$('#role-count').textContent=String(index+1).padStart(2,'0')+' / 05';$('#role-line-progress').style.width=((index+1)*20)+'%';
   panel.classList.remove('is-changing');void panel.offsetWidth;panel.classList.add('is-entering');
   setTimeout(()=>panel.classList.remove('is-entering'),540);
 },motionReduced?0:190);
}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>switchRole(tab,false));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;switchRole(tabs[index],true)})});

let lastFocus=null;
function openDialog(id){const d=document.getElementById(id);if(d.open)return;lastFocus=document.activeElement;d.showModal();document.body.classList.add('dialog-open');if(id==='register-dialog'){$('#form-message').textContent='';requestAnimationFrame(()=>$('#full-name').focus({preventScroll:true}))}}
function closeDialog(id){const d=document.getElementById(id);if(d.open)d.close()}
$$('[data-open-register]').forEach(b=>b.addEventListener('click',()=>openDialog('register-dialog')));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
$$('.modal').forEach(d=>{d.addEventListener('close',()=>{document.body.classList.remove('dialog-open');if(!roleChooser.hidden){roleChooser.hidden=true;roleTrigger.setAttribute('aria-expanded','false')}if(lastFocus?.focus)lastFocus.focus({preventScroll:true});});d.addEventListener('click',e=>{if(e.target===d)d.close()})});
// Mobile-first accessible role picker, backed by a real named hidden field.
const roleChooser=$('#role-chooser'),roleTrigger=$('#role-trigger'),roleHidden=$('#role');
const roleChoices=$$('.role-choice',roleChooser);
function rolePickerOpen(){roleChooser.hidden=false;roleTrigger.setAttribute('aria-expanded','true');
 const chosen=roleChoices.find(b=>b.dataset.value===roleHidden.value)||roleChoices[0];
 requestAnimationFrame(()=>chosen.focus({preventScroll:true}));}
function rolePickerClose(){roleChooser.hidden=true;roleTrigger.setAttribute('aria-expanded','false');roleTrigger.focus({preventScroll:true});}
roleTrigger.addEventListener('click',rolePickerOpen);
$('#role-chooser-close').addEventListener('click',rolePickerClose);
$('[data-dismiss-role]').addEventListener('click',rolePickerClose);
roleChoices.forEach((btn,i)=>{
 btn.addEventListener('click',()=>{roleHidden.value=btn.dataset.value;$('#role-trigger-text').textContent=btn.querySelector('b').textContent;
  roleTrigger.classList.add('has-value');roleChoices.forEach(b=>b.setAttribute('aria-selected',String(b===btn)));
  rolePickerClose();});
 btn.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();let idx=e.key==='Home'?0:e.key==='End'?roleChoices.length-1:(i+(e.key==='ArrowDown'?1:-1)+roleChoices.length)%roleChoices.length;roleChoices[idx].focus()});
});
roleChooser.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();rolePickerClose()}});
function digits(v){return String(v||'').replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776).replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632)}
function normalizePhone(v){let s=digits(v).replace(/[\s\-()]/g,'');if(s.startsWith('+98'))s='0'+s.slice(3);if(s.startsWith('0098'))s='0'+s.slice(4);if(/^9\d{9}$/.test(s))s='0'+s;return s}
const form=$('#register-form'),message=$('#form-message'),submit=$('#form-submit');
form.addEventListener('submit',async e=>{
 e.preventDefault();message.textContent='';const data=Object.fromEntries(new FormData(form).entries());
 const full_name=(data.full_name||'').trim().replace(/\s+/g,' '), phone=normalizePhone(data.phone), role=data.role,company=(data.company||'').trim();
 if(full_name.length<3||full_name.length>90){message.textContent='لطفاً نام و نام خانوادگی را کامل وارد کنید.';$('#full-name').focus();return}
 if(!/^09\d{9}$/.test(phone)){message.textContent='لطفاً شماره موبایل معتبر ایرانی وارد کنید.';$('#phone').focus();return}
 if(!['investor','manager','specialist','operator','founder','other'].includes(role)){message.textContent='لطفاً حوزه فعالیت را انتخاب کنید.';$('#role-trigger').focus();return}
 if(!$('#consent').checked){message.textContent='برای ثبت درخواست، موافقت خود را تأیید کنید.';$('#consent').focus();return}
 submit.disabled=true;const orig=submit.innerHTML;submit.textContent='در حال ثبت درخواست...';
 try{const response=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name,phone,role,company,consent:true,fax_number:data.fax_number||''})});const json=await response.json().catch(()=>({}));if(!response.ok||!json.ok)throw new Error(json.message||'ثبت درخواست انجام نشد.');form.hidden=true;$('#register-success').hidden=false;$('#register-success').focus({preventScroll:true});}
 catch(err){message.textContent=err.message||'خطا در ارتباط با سامانه ثبت‌نام. لطفاً دوباره تلاش کنید.'}
 finally{submit.disabled=false;submit.innerHTML=orig}
});
if('IntersectionObserver' in window){const images=$$('.mineral-large');const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.25});images.forEach(el=>io.observe(el))}
// Hide the floating mobile action as the main invitation comes into view.
if('IntersectionObserver' in window){
 const mobileCta=$('#sticky-cta'),mainCta=$('.closing .cta-main');
 const ctaObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)mobileCta.classList.toggle('is-near-primary',entry.isIntersecting);
 },{threshold:0,rootMargin:'0px 0px 12px 0px'});
 if(mobileCta&&mainCta)ctaObserver.observe(mainCta);
}
// Quiet editorial motion: only opacity/transform, no section-color boundaries.
if(!motionReduced && 'IntersectionObserver' in window){
 const parts=$$('.intro-title,.decision-art,.metric-list,.audience .eyebrow,.audience h2,.audience-sub,.role-tabs,.role-panel,.closing .eyebrow,.closing h2,.closing-inner>p,.ticket,.closing .cta-main');
 const observer=new IntersectionObserver((entries)=>{
  for(const entry of entries){
   if(entry.isIntersecting){entry.target.classList.add('is-inview');observer.unobserve(entry.target)}
  }
 },{threshold:.12,rootMargin:'0px 0px -28px 0px'});
 for(const part of parts){part.classList.add('reveal-on-scroll');observer.observe(part)}
}
window.__cmStatus=()=>({progress:videoProgress(),frame:displayed,loaded:cached.size,pending:pending.size,playing:false,role:$('#role-label').textContent});
})();
