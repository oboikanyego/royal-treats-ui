// Browser suite: 21-idle-wake-up. A tab left alone refreshes itself when it comes back. Runs against the mock API (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307'), CTRL=(process.env.API_URL||'http://localhost:3000'), API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}return{status:r.status,body:j}}
const when=new Date(Date.now()+2*864e5).toISOString().slice(0,10);
// What a phone does when the screen locks / the tab is put away, and when it is opened again.
const away=(pg)=>pg.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange'));});
const back=(pg)=>pg.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange'));});
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 const mk=async()=>{const ctx=await b.newContext({viewport:{width:390,height:844}}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage(); pg.setDefaultTimeout(12000); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push(e.message)); await ctx.clock.install(); return {ctx,pg}};
 const admin=(await call('/auth/login',{method:'POST',body:{email:'admin@royaltreats.test',password:'AdminPass-12345'}})).body;
 const customer=(await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 const order=(await call('/orders',{method:'POST',token:customer.token,headers:{'idempotency-key':'wake-order-key-1'},body:{fulfillment:'collection',date:when,time:'12:00',items:[{productId:'donuts',variant:'12 donuts',qty:1,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato'}]}})).body;
 const settings=(await call('/settings')).body;
 const putSettings=(extra)=>call('/admin/settings',{method:'PUT',token:admin.token,body:{storeName:settings.storeName,address:settings.address,supportEmail:settings.supportEmail,open:settings.open,close:settings.close,latitude:settings.latitude??null,longitude:settings.longitude??null,...extra}});
 // ---- customer: My orders ----
 let {ctx,pg}=await mk();
 await pg.goto(UI+'/account'); await pg.fill('input[name=email]','thandi@example.com'); await pg.fill('input[name=password]','a-long-enough-pass'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.profile-pane');
 await pg.goto(UI+'/orders'); await pg.waitForSelector('.my-order');
 const pill=()=>pg.locator('.my-order .status-pill').first().innerText();
 const before=await pill();
 // the shop moves the order along while the tab is away
 await away(pg);
 await call('/orders/'+order.id+'/status',{method:'PATCH',token:admin.token,body:{status:'Confirmed'}});
 await ctx.clock.fastForward(20_000);
 let requests=0; pg.on('request',(r)=>{ if(/\/api\/v1\/(orders|settings|me)(\?|$)/.test(r.url())) requests++; });
 await back(pg); await pg.waitForTimeout(800);
 ok(requests===0&&(await pill())===before,'a short trip away (20 s) refreshes nothing');
 await away(pg);
 await ctx.clock.fastForward(90_000);
 await back(pg);
 await pg.waitForFunction((was)=>document.querySelector('.my-order .status-pill')?.textContent.trim()!==was,before.trim(),{timeout:5000});
 ok((await pill())!==before,'after 90 s away the order shows its new status at once ('+before.trim()+' → '+(await pill()).trim()+')');
 // ---- the menu / shop settings ----
 await pg.goto(UI+'/'); await pg.waitForSelector('footer');
 ok(await pg.locator('.pause-banner').count()===0,'no pause notice to begin with');
 await away(pg);
 await putSettings({ordersPaused:true,pauseMessage:'Back at 9 tomorrow'});
 await ctx.clock.fastForward(120_000);
 await back(pg); await pg.waitForSelector('.pause-banner',{timeout:5000});
 ok((await pg.locator('.pause-banner').innerText()).includes('Back at 9 tomorrow'),'a pause set while the tab slept shows when it wakes');
 await putSettings({ordersPaused:false,pauseMessage:''});
 // ---- the sign-in ended while away ----
 const mine=await pg.evaluate(()=>JSON.parse(localStorage.getItem('royal-api-session')||sessionStorage.getItem('royal-api-session')||'null')?.token);
 ok(!!mine,'the customer is signed in before the nap');
 await away(pg);
 await call('/auth/logout',{method:'POST',token:mine}); // the sign-in is ended on the server (another device, a password change)
 await ctx.clock.fastForward(90_000);
 await back(pg);
 await pg.waitForFunction(()=>!localStorage.getItem('royal-api-session')&&!sessionStorage.getItem('royal-api-session'),null,{timeout:5000});
 ok(true,'a sign-in that ended while the tab slept is noticed on waking');
 await pg.goto(UI+'/account'); await pg.waitForSelector('input[name=email]');
 ok(await pg.locator('.profile-pane').count()===0,'the next screen asks to sign in again');
 await ctx.close();
 // ---- admin: the badge and the live connection ----
 ({ctx,pg}=await mk());
 await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
 ok(await pg.locator('.appbar-tabs button:has-text("Overview") .tab-badge').count()===0,'no password request waiting to begin with');
 await away(pg);
 await call('/auth/password-requests',{method:'POST',body:{email:'thandi@example.com',newPassword:'brand-new-long-pass'}});
 await ctx.clock.fastForward(90_000);
 await back(pg);
 await pg.waitForSelector('.appbar-tabs button:has-text("Overview") .tab-badge',{timeout:5000});
 ok((await pg.locator('.appbar-tabs button:has-text("Overview") .tab-badge').innerText())==='1','a request made while the admin tab slept shows its badge on waking');
 for(const p of [pg]) if(p.errs.length) console.log('page errors',p.errs);
 await ctx.close(); await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
