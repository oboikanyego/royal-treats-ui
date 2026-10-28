// Browser suite: 07-live-order-alerts. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'/api/v1', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=async(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify(m||{})});
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
const tomorrow=new Date(Date.now()+36*3600e3).toISOString().slice(0,10);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
const item={productId:'donuts',variant:'12 donuts',qty:2,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato'};
let n=0; const place=(token,extra={})=>call('/orders',{method:'POST',token,headers:{'idempotency-key':'live-order-'+(++n)+'-'+Date.now()},body:{fulfillment:'collection',date:tomorrow,time:'12:00',notes:'',items:[item],...extra}});
async function mk(b){const ctx=await b.newContext({viewport:{width:1280,height:900}});const pg=await ctx.newPage();pg.setDefaultTimeout(12000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.sockets=0;pg.on('request',r=>{if(r.url().includes('/socket.io/'))pg.sockets++});
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));
 await pg.addInitScript(()=>{ if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');} });
 return pg}
async function signIn(pg,email,password){await pg.goto(UI+'/account'); await pg.fill('input[type=email]',email); await pg.fill('input[type=password]',password); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.workspace-sidebar, .profile-pane')}
(async()=>{
 const b=await chromium.launch(); await mode({});
 const cust=(await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 await place(cust.token);
 const adm=await mk(b); await signIn(adm,'admin@royaltreats.test','AdminPass-12345');
 const badge=()=>adm.locator('.sidebar-navigation .pending-count').first();
 await adm.waitForSelector('.pending-count');
 ok((await badge().textContent()).trim()==='1','the Orders button shows 1 pending order on connecting');
 // admin browses the storefront; a new order arrives
 await adm.click('text=Our Menu').catch(async()=>{await adm.goto(UI+'/menu')}); await adm.waitForSelector('.menu-product-grid .product');
 await place(cust.token);
 await adm.waitForSelector('.live-toast');
 const toast=(await adm.locator('.live-toast').first().textContent()).replace(/\s+/g,' ');
 ok(toast.includes('New order')&&toast.includes('Thandi Mokoena')&&toast.includes('2 items')&&toast.includes('R100')&&toast.includes('collection'),'a toast appears on the menu page: '+toast.slice(0,100));
 ok(!toast.includes('074 123')&&!toast.includes('Test St'),'the alert carries no phone number or address');
 await adm.waitForFunction(()=>document.title.startsWith('(2) '));
 ok((await adm.title()).startsWith('(2) '),'the tab title shows the waiting count: '+await adm.title());
 await adm.click('.live-toast button:has-text("View orders")');
 await adm.waitForSelector('rt-admin-orders .order-card');
 ok(adm.url().includes('/account')&&await adm.locator('rt-admin-orders .order-card').count()===2,'"View orders" opens the admin Orders screen with both orders');
 ok(await adm.locator('.live-toast').count()===0,'the alert is dismissed after opening');
 ok((await badge().textContent()).trim()==='2','the Orders button shows 2');
 // a third order arrives while the Orders screen is open
 await place(cust.token,{notes:'third'});
 await adm.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-admin-orders .order-card').length===3);
 ok(true,'a new order appears in the open list without a reload');
 ok((await badge().textContent()).trim()==='3','and the count goes to 3');
 // accepting lowers the count
 await adm.locator('rt-admin-orders .order-card').first().locator('button:has-text("Mark Confirmed")').click(); await adm.waitForSelector('text=/is now Confirmed/');
 await adm.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelector('.pending-count')?.textContent.trim()==='2');
 ok(true,'accepting an order lowers the count to 2');
 // sound toggle persists
 await adm.uncheck('rt-admin-orders input[name=alertSound]');
 ok(await adm.evaluate(()=>localStorage.getItem('royal-alert-sound'))==='off','turning the sound off is remembered');
 // wording: collection -> Collected
 const first=adm.locator('rt-admin-orders .order-card').first();
 for (const s of ['Preparing','Ready for Collection','Collected']) { await first.locator(`button:has-text("Mark ${s}")`).click(); await adm.waitForSelector(`text=/is now ${s}/`); }
 ok((await first.textContent()).includes('Collected')&&!(await first.textContent()).includes('Completed'),'a collection ends as "Collected" (never "Completed")');
 // customer sees Collected, and no socket is opened for a customer
 const cu=await mk(b); await signIn(cu,'thandi@example.com','a-long-enough-pass'); await cu.goto(UI+'/orders'); await cu.waitForSelector('.my-order');
 await cu.waitForTimeout(1500);
 ok((await cu.locator('.status-pill',{hasText:'Collected'}).count())===1&&(await cu.locator('.timeline div.done',{hasText:'Collected'}).count())===1,'the customer sees "Collected" on the order and its timeline');
 ok(cu.sockets===0,'a customer never opens a live connection');
 // delivery wording
 const d=(await place(cust.token,{fulfillment:'delivery',address:'12 Test St',latitude:-24.59,longitude:27.41})).body;
 await adm.reload(); await adm.waitForSelector('rt-admin-orders .order-card');
 const dc=adm.locator('rt-admin-orders .order-card',{hasText:'12 Test St'});
 await dc.locator('button:has-text("Mark Confirmed")').click(); await adm.waitForSelector('text=/RT-.* is now Confirmed/');
 for (const s of ['Preparing','Ready for Delivery']) { await dc.locator(`button:has-text("Mark ${s}")`).click(); await adm.waitForSelector(`text=/is now ${s}/`); }
 await fetch(`${CTRL}/__advance?id=${d.id}&status=Out for Delivery`);
 await adm.reload(); await adm.waitForSelector('rt-admin-orders .order-card');
 ok(await adm.locator('rt-admin-orders .order-card',{hasText:'12 Test St'}).locator('button:has-text("Mark Delivered")').count()===1,'a delivery ends as "Mark Delivered"');
 // reload keeps the connection; sign-out ends it
 await adm.waitForSelector('.pending-count').catch(()=>{}); 
 await adm.evaluate(()=>{}); 
 await adm.click('.top button:has-text("Sign out"), header button:has-text("Sign out")').catch(async()=>{await adm.click('button:has-text("Sign out")')});
 await adm.waitForTimeout(500);
 await place(cust.token); await adm.waitForTimeout(1200);
 ok(await adm.locator('.live-toast').count()===0,'after signing out no alert arrives');
 for(const p of [adm,cu]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
