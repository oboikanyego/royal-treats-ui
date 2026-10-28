// Browser suite: 14-pause-and-hours. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'', API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const call=async(p,{method='GET',token,body,headers={}}={})=>{const r=await fetch(API+p,{method,headers:{'content-type':'application/json',...headers,...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const t=await r.text();return {status:r.status,body:t?JSON.parse(t):null}};
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const cust=(await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 const b=await chromium.launch();
 const mk=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:w<700,hasTouch:w<700}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); await ctx.route('**/nominatim.openstreetmap.org/**',r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify([{lat:'-24.59',lon:'27.41',display_name:'x'}])})); const pg=await ctx.newPage(); pg.setDefaultTimeout(15000); return {ctx,pg}};
 // admin: weekly hours + pause
 let {ctx,pg}=await mk(390,844);
 await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
 await pg.tap('.appbar-tabs button:has-text("Settings")'); await pg.waitForSelector('.settings-page');
 ok(await pg.locator('.week-day').count()===7,'the hours card lists all seven days');
 ok((await pg.locator('.week-day').first().innerText()).includes('Monday'),'Monday comes first');
 // close Sunday (last row), make Saturday short
 await pg.locator('.week-day').nth(6).locator('.week-switch').tap(); await pg.waitForTimeout(200);
 ok((await pg.locator('.week-day').nth(6).innerText()).includes('Closed'),'a day switched off shows Closed');
 await pg.fill('input[name=to6]','14:00');
 await pg.tap('.settings-save button'); await pg.waitForSelector('.success-alert');
 let st=(await call('/settings')).body; ok(Array.isArray(st.weeklyHours)&&st.weeklyHours.length===7&&st.weeklyHours[0].closed===true&&st.weeklyHours[6].close==='14:00','weekly hours saved on the API (Sunday first)');
 // pause
 await pg.locator('.pause-switch').tap(); await pg.fill('input[name=pauseMessage]','Back on Monday'); await pg.tap('.settings-save button'); await pg.waitForSelector('.success-alert');
 st=(await call('/settings')).body; ok(st.ordersPaused===true&&st.pauseMessage==='Back on Monday','pause and message saved');
 await pg.tap('.appbar-tabs button:has-text("Overview")'); await pg.waitForTimeout(500);
 const ov=await pg.locator('app-portal').evaluate(e=>e.shadowRoot.textContent); ok(ov.includes('paused')&&ov.includes('Sun closed'),'overview shows paused and the weekly summary');
 await ctx.close();
 // customer: banner + blocked checkout
 ({ctx,pg}=await mk(390,844));
 await pg.goto(UI+'/'); await pg.waitForSelector('.pause-banner');
 ok((await pg.locator('.pause-banner').innerText()).includes('Back on Monday'),'customers see the pause banner with the shop message');
 await pg.evaluate(t=>{localStorage.setItem('royal-api-session',JSON.stringify({token:t.token,expiresAt:t.expiresAt}))},cust);
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.pause-banner');
 // add to cart via API-less path: go to checkout directly with a cart in storage is complex; use the product page
 await pg.evaluate(()=>localStorage.setItem('rt-cart',JSON.stringify([{productId:'donuts',name:'Mini Donuts',image:'',variant:'12 donuts',price:50,qty:1,sauce:'Chocolate',topping:'Oreo',recipient:''}])));
 await pg.goto(UI+'/checkout'); await pg.waitForSelector('.pause-note');
 ok(await pg.locator('button.primary.wide').last().isDisabled(),'the place order button is disabled while paused');
 ok((await pg.locator('.pause-note').innerText()).includes('Back on Monday'),'checkout explains why');
 // API refuses too
 const tomorrow=new Date(Date.now()+2*864e5).toISOString().slice(0,10);
 const r=await call('/orders',{method:'POST',token:cust.token,headers:{'idempotency-key':'paused-order-key-1'},body:{fulfillment:'collection',date:tomorrow,time:'12:00',notes:'',items:[{productId:'donuts',variant:'12 donuts',qty:1,sauce:'Chocolate',topping:'Oreo',recipient:''}]}});
 ok(r.status===409&&r.body.error.includes('Back on Monday'),'the API refuses an order while paused');
 // unpause + closed day / hours by weekday in checkout
 await call('/admin/settings',{method:'PUT',token:(await call('/auth/login',{method:'POST',body:{email:'admin@royaltreats.test',password:'AdminPass-12345'}})).body.token,body:{storeName:'Royal Treats',address:'34 10th Avenue, Thabazimbi',supportEmail:'',open:'10:00',close:'23:00',latitude:-24.59,longitude:27.41,ordersPaused:false,pauseMessage:'',weeklyHours:Array.from({length:7},(_,i)=>({closed:i===0,open:'09:00',close:i===6?'14:00':'17:00'}))}});
 await pg.reload(); await pg.waitForSelector('select[name=time]');
 ok(await pg.locator('.pause-banner').count()===0,'the banner is gone after reopening');
 const days=[...Array(14)].map((_,i)=>new Date(Date.now()+(i+1)*864e5)).map(d=>({iso:d.toISOString().slice(0,10),dow:d.getUTCDay()}));
 const sun=days.find(d=>d.dow===0), sat=days.find(d=>d.dow===6), mon=days.find(d=>d.dow===1);
 await pg.fill('input[name=date]',sun.iso); await pg.waitForTimeout(300);
 ok((await pg.locator('.helper[role=status]').innerText()).includes('closed on that day')&&await pg.locator('select[name=time] option').count()===1,'a closed day says so and offers no times');
 await pg.fill('input[name=date]',sat.iso); await pg.waitForTimeout(300);
 const satTimes=await pg.locator('select[name=time] option').allTextContents(); ok(satTimes.includes('14:00')&&!satTimes.includes('14:30')&&satTimes.includes('09:00')&&!satTimes.includes('08:30'),'Saturday offers 09:00 to 14:00 only');
 await pg.fill('input[name=date]',mon.iso); await pg.waitForTimeout(300);
 const monTimes=await pg.locator('select[name=time] option').allTextContents(); ok(monTimes.includes('17:00')&&!monTimes.includes('17:30'),'Monday offers 09:00 to 17:00');
 ok((await pg.locator('.helper[role=status]').innerText()).includes('09:00–17:00'),'the page states that day\'s hours');
 await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
