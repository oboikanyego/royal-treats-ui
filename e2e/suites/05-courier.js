// Browser suite: 05-courier. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'/api/v1', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=async(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify({delayMs:0,failNext:0,failAlways:false,bulk:false,expireTokens:false,limitAuth:false,dropOrderResponse:0,soldOut:[],imagesOff:false,raceOnAccept:false,...m})});
const flag=(q)=>fetch(CTRL+'/__flag?'+q);
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
const tomorrow=new Date(Date.now()+36*3600e3).toISOString().slice(0,10);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
const orders=async()=>(await fetch(CTRL+'/__orders')).json();
async function seed(){
 const c=(await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 const item={productId:'donuts',variant:'12 donuts',qty:2,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato'};
 const mkDel=async(key,time,address,notes)=>{const o=(await call('/orders',{method:'POST',token:c.token,headers:{'idempotency-key':key},body:{fulfillment:'delivery',date:tomorrow,time,notes,address,latitude:-24.59,longitude:27.41,items:[item]}})).body; await fetch(`${CTRL}/__advance?id=${o.id}&status=Ready for Delivery`); return o};
 const a=await mkDel('delivery-order-a','15:00','12 Test St, Thabazimbi','Gate code 1234');
 const b=await mkDel('delivery-order-b','10:30','99 Other Rd, Thabazimbi','');
 return {a,b}}
async function mk(b){const ctx=await b.newContext({viewport:{width:1280,height:900}});const pg=await ctx.newPage();pg.setDefaultTimeout(12000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));
 await pg.addInitScript(()=>{ if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');} });
 return pg}
async function signIn(pg,email='courier@royaltreats.test',password='CourierPass-12345'){await pg.goto(UI+'/account'); await pg.fill('input[type=email]',email); await pg.fill('input[type=password]',password); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('rt-courier-workspace')}
const txt=async(pg,sel)=>(await pg.locator(sel).first().textContent()).replace(/\s+/g,' ').trim();
(async()=>{
 const b=await chromium.launch(); await mode({}); const {a,b:bb}=await seed(); let pg=await mk(b);
 await signIn(pg);
 ok(await pg.locator('text=being connected').count()===0&&await pg.locator('.workspace-sidebar').count()===0,'courier gets the delivery workspace (no placeholder, no admin sidebar)');
 await pg.waitForSelector('rt-courier-workspace .order-card');
 const jobs=pg.locator('rt-courier-workspace .order-card');
 ok(await jobs.count()===2,'two available jobs listed');
 const first=(await jobs.first().textContent()).replace(/\s+/g,' ');
 ok(first.includes(bb.id.slice(3,11).toUpperCase())&&first.includes('10:30')&&first.includes('0.0 km'),'soonest job first (10:30), with short ref and distance ('+first.slice(0,70)+')');
 const all=(await pg.locator('rt-courier-workspace').textContent());
 ok(!all.includes('Thandi')&&!all.includes('074 123')&&!all.includes('Test St'),'before accepting, no customer name, phone or address is shown');
 ok(all.includes('appear once you accept'),'the page explains details appear after accepting');
 // race: someone else takes it
 await flag('raceOnAccept=1'); await jobs.first().locator('button:has-text("Accept delivery")').click(); await pg.waitForSelector('rt-courier-workspace .alert.error');
 ok((await txt(pg,'rt-courier-workspace .alert.error')).includes('Another courier has already taken'),'lost race: "Another courier has already taken that delivery"');
 await pg.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-courier-workspace .order-card').length===1);
 ok(true,'the list refreshed (the taken job is gone)');
 await flag('raceOnAccept=0');
 // accept the remaining job
 await pg.locator('rt-courier-workspace .order-card button:has-text("Accept delivery")').first().click(); await pg.waitForSelector('rt-courier-workspace .success-alert');
 const mine=pg.locator('rt-courier-workspace .order-card',{hasText:'Thandi'});
 const m=(await mine.first().textContent()).replace(/\s+/g,' ');
 ok(m.includes('Thandi Mokoena')&&m.includes('074 123 4567')&&m.includes('12 Test St')&&m.includes('Gate code 1234')&&m.includes('Lerato')&&m.includes('Cash on Delivery: R100'),'after accepting: customer, phone, address, notes, items and the cash to collect');
 ok((await mine.first().locator('a[href^="tel:"]').getAttribute('href'))==='tel:074 123 4567','the phone number is a call link');
 ok((await orders()).find(o=>o.id===a.id).status==='Out for Delivery','the API says Out for Delivery');
 ok(await pg.locator('rt-courier-workspace .order-card button:has-text("Accept delivery")').count()===0,'no jobs left to accept');
 // complete with confirmation
 await mine.first().locator('button:has-text("Mark delivered")').click(); ok((await mine.first().textContent()).includes('received this order'),'marking delivered asks first');
 await mine.first().locator('button:has-text("Not yet")').click(); ok((await orders()).find(o=>o.id===a.id).status==='Out for Delivery','"Not yet" changes nothing');
 await mine.first().locator('button:has-text("Mark delivered")').click(); await mine.first().locator('button:has-text("Yes, delivered")').click(); await pg.waitForSelector('text=/marked as delivered/');
 ok((await orders()).find(o=>o.id===a.id).status==='Completed','Completed on the API');
 ok(await pg.locator('rt-courier-workspace h3:has-text("Delivered")').count()===1&&await pg.locator('rt-courier-workspace button:has-text("Mark delivered")').count()===0,'the delivery moved to "Delivered" with no more actions');
 // reload keeps history for this courier
 await pg.reload(); await pg.waitForSelector('rt-courier-workspace h3:has-text("Delivered")'); ok(true,'after a reload the delivered job is still listed (from GET /orders)');
 // another courier does not see it
 const c2=(await call('/auth/login',{method:'POST',body:{email:'courier@royaltreats.test',password:'CourierPass-12345'}})).body;
 ok((await call('/courier/jobs',{token:c2.token})).body.total===0,'no open jobs remain on the API');
 // customer/admin cannot use the courier screens
 const cust=(await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}})).body;
 ok((await call('/courier/jobs',{token:cust.token})).status===403,'the API refuses courier calls from a customer');
 for(const p of [pg]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
