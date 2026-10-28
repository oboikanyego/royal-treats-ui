// Browser suite: 15-phone-layout-scan. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'', API=CTRL+'/api/v1';
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const reg=await fetch(API+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true})});
 const b=await chromium.launch();
 const scan=async(pg,label)=>{ await pg.waitForTimeout(900); const r=await pg.evaluate(()=>{const w=document.documentElement.clientWidth; const bad=[]; document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width>0&&r.right>w+1&&getComputedStyle(e).position!=='fixed'){ let p=e.parentElement,clipped=false; while(p&&p!==document.body){const o=getComputedStyle(p).overflowX; if(o==='auto'||o==='hidden'||o==='scroll'){clipped=true;break} p=p.parentElement} if(!clipped) bad.push((e.tagName+'.'+String(e.className).split(' ')[0]).slice(0,40)+' r='+Math.round(r.right))}}); const small=[...(()=>{const q='input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea';const root=document.querySelector('app-portal')?.shadowRoot;return [...document.querySelectorAll(q),...(root?root.querySelectorAll(q):[])]})()].filter(e=>e.offsetParent&&parseFloat(getComputedStyle(e).fontSize)<16).length; return {sw:document.documentElement.scrollWidth,w,small,bad:bad.slice(0,4)}}); console.log((r.sw>r.w||r.small?'FAIL  ':'PASS  ')+label+' scrollWidth='+r.sw+' viewport='+r.w+(r.small?' SMALL-FIELDS='+r.small:'')+(r.bad.length?' :: '+r.bad.join(' | '):'')); };
 for(const width of [360,390]){
  const ctx=await b.newContext({viewport:{width,height:800},isMobile:true,hasTouch:true}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage();
  for(const path of ['/','/menu','/product/donuts','/cart','/checkout','/about','/contact','/orders','/account','/privacy','/terms']){ await pg.goto(UI+path); await scan(pg,width+' '+path); }
  await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
  for(const n of ['Overview','Orders','Products','Delivery','Settings']){ await pg.locator('.appbar-tabs button:has-text("'+n+'")').click(); await scan(pg,width+' admin '+n); }
  await ctx.close();
 }
 await b.close();
})().catch(e=>console.log('CRASH',e.message));
