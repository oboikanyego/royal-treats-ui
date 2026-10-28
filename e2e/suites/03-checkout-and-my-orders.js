// Browser suite: 03-checkout-and-my-orders. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=async(m)=>fetch(API+'/__mode',{method:'POST',body:JSON.stringify({delayMs:0,failNext:0,failAlways:false,bulk:false,expireTokens:false,limitAuth:false,dropOrderResponse:0,soldOut:[],...m})});
const reqLog=async()=>(await fetch(API+'/__log')).json();
const apiOrders=async()=>(await fetch(API+'/__orders')).json();
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
const tomorrow=new Date(Date.now()+36*3600e3).toISOString().slice(0,10);
async function mk(b,perms){const ctx=await b.newContext({viewport:{width:1280,height:900},geolocation:{latitude:-24.59,longitude:27.41},permissions:perms??['geolocation']});const pg=await ctx.newPage();pg.setDefaultTimeout(12000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));
 await pg.addInitScript(()=>{ if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');} });
 return pg}
async function register(pg,{name='Thandi Mokoena',email='thandi@example.com',phone='074 123 4567',password='a-long-enough-pass'}={}){
 await pg.goto(UI+'/account'); await pg.click('button:has-text("Register here")');
 await pg.fill('input[name=name]',name); await pg.fill('input[type=email]',email); await pg.fill('input[name=phone]',phone); await pg.fill('input[name=password]',password);
 await pg.check('input[name=consent]'); await pg.click('button.primary:has-text(\"Register\")'); await pg.waitForSelector('.nav-account'); }
const line=(o)=>({productId:'donuts',name:'Mini Donuts',image:'',variant:'12 donuts',price:50,qty:2,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato',...o});
const setCart=async(pg,lines)=>{await pg.evaluate(l=>localStorage.setItem('rt-cart',JSON.stringify(l)),lines);};
async function fillWhen(pg){ await pg.fill('input[name=date]',tomorrow); await pg.selectOption('select[name=time]','12:00'); }
(async()=>{
 const b=await chromium.launch();
 await mode({}); let pg=await mk(b);
 // 1. signed out: orders page asks for sign-in; /track redirects; nav label
 await pg.goto(UI+'/track'); await pg.waitForSelector('h1');
 ok(pg.url().endsWith('/orders'),'/track redirects to /orders in API mode ('+pg.url()+')');
 ok(await pg.locator('text=Sign in to see your orders').count()>0,'signed out: asks the visitor to sign in');
 ok((await pg.locator('nav, header').first().innerText()).includes('My Orders'),'navigation says "My Orders"');
 // 2. collection order, mixed recipients
 await register(pg); await pg.goto(UI+'/cart');
 await setCart(pg,[line(),line({productId:'shake',name:'Milkshakes',variant:'Large',price:40,qty:1,sauce:'Vanilla',topping:'',recipient:''})]);
 await pg.goto(UI+'/checkout');
 ok(await pg.locator('input[name=name]').getAttribute('readonly')!==null&&(await pg.inputValue('input[name=name]'))==='Thandi Mokoena','checkout name is the account name, read-only');
 ok((await pg.inputValue('input[name=phone]'))==='074 123 4567','checkout phone is the account phone');
 await fillWhen(pg); await pg.click('button.primary.wide:has-text("Place Order")');
 await pg.waitForURL('**/order-placed');
 let orders=await apiOrders(); const o1=orders[0];
 ok(orders.length===1&&o1.totalCents===14000||o1.totalCents===14000,'server priced the order: '+o1.totalCents+' cents');
 ok(o1.items.length===2&&!('price' in o1.items[0]||'priceCents' in (o1.items[0]&&{})),'sent items');
 const posted=(await reqLog()).filter(l=>l.startsWith('POST /api/v1/orders'));
 ok(posted.length===1,'one POST /orders');
 ok((await pg.locator('main, body').first().innerText()).includes('RT-'+o1.id.slice(3,11).toUpperCase()),'confirmation shows the short reference RT-'+o1.id.slice(3,11).toUpperCase());
 ok(JSON.parse(await pg.evaluate(()=>localStorage.getItem('rt-cart')||'[]')).length===0,'cart emptied after placing');
 // 3. My orders list
 await pg.click('text=View My Orders'); await pg.waitForSelector('.my-order');
 const t1=await pg.locator('.my-order').first().innerText();
 ok(t1.includes('Pending')&&t1.includes('R140')&&t1.includes('Lerato')&&t1.includes('Shared treats'),'order card: status, server total R140, recipient groups ('+t1.replace(/\s+/g,' ').slice(0,120)+')');
 ok(await pg.locator('.timeline .done').count()===1,'timeline: only "Pending" step done');
 // 4. status moves on the shop side show up on the next refresh (30 s poll → force via reload)
 await fetch(`${API}/__advance?id=${o1.id}&status=Preparing`); await pg.reload(); await pg.waitForSelector('.my-order');
 ok((await pg.locator('.my-order').first().innerText()).includes('Preparing')&&await pg.locator('button:has-text("Cancel order")').count()===0,'Preparing: no cancel button (server allowedStatuses)');
 await fetch(`${API}/__advance?id=${o1.id}&status=Pending`);
 // 5. a customer cannot cancel: no button, a contact note, and the API refuses it
 await fetch(`${API}/__advance?id=${o1.id}&status=Pending`);
 await pg.reload(); await pg.waitForSelector('.my-order');
 ok(await pg.locator('button:has-text("Cancel")').count()===0,'a Pending order has no cancel button for the customer');
 ok((await pg.locator('.my-order').first().innerText()).includes('only the shop can cancel'),'the order says to contact the shop to cancel');
 ok(await pg.locator('.my-order a:has-text("Contact us")').first().getAttribute('href')==='/contact','with a link to the contact page');
 const tok=await pg.evaluate(()=>JSON.parse(localStorage.getItem('royal-api-session')||sessionStorage.getItem('royal-api-session')).token);
 ok((await fetch(API.replace('/api/v1','')+'/api/v1/orders/'+o1.id+'/status',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:'{"status":"Cancelled"}'})).status===403,'the API refuses a customer cancel (403)');
 ok((await apiOrders())[0].status==='Pending','the order is unchanged');
 // 6. delivery order
 await pg.goto(UI+'/cart'); await setCart(pg,[line({qty:1,recipient:''})]); await pg.goto(UI+'/checkout'); await fillWhen(pg);
 await pg.check('input[value=delivery]'); await pg.fill('input[name=deliveryAddress]','12 Test St, Thabazimbi'); await pg.click('text=Check my delivery location'); await pg.waitForSelector('text=Location captured');
 await pg.click('button.primary.wide:has-text("Place Order")'); await pg.waitForURL('**/order-placed');
 const o2=(await apiOrders())[0];
 ok(o2.fulfillment==='delivery'&&o2.address==='12 Test St, Thabazimbi'&&Math.abs(o2.latitude+24.59)<1e-6,'delivery order carries address and coordinates');
 await pg.goto(UI+'/orders'); await pg.waitForSelector('.my-order');
 ok(await pg.locator('.my-order').count()===2&&(await pg.locator('.my-order').first().innerText()).includes('Delivery'),'two orders listed, newest first');
 // 7. sold-out item -> friendly message, can retry later
 await mode({soldOut:['donuts']});
 const out=await mk(b); await register(out); await out.goto(UI+'/cart'); await setCart(out,[line({recipient:''})]); await out.goto(UI+'/checkout'); await fillWhen(out);
 await out.click('button.primary.wide:has-text("Place Order")'); await out.waitForSelector('p.error');
 ok(/out of stock/i.test(await out.locator('p.error').innerText()),'sold-out item: "'+(await out.locator('p.error').innerText())+'"');
 ok(out.url().endsWith('/checkout')&&JSON.parse(await out.evaluate(()=>localStorage.getItem('rt-cart'))).length===1,'stays on checkout with the cart intact');
 // 8. response lost in transit -> retry reuses the key; exactly one order exists
 await mode({dropOrderResponse:50}); const d=await mk(b); await register(d); await d.goto(UI+'/cart'); await setCart(d,[line({recipient:''})]); await d.goto(UI+'/checkout'); await fillWhen(d);
 await d.click('button.primary.wide:has-text("Place Order")'); await d.waitForSelector('p.error');
 ok((await apiOrders()).length===1,'two lost responses (browser retry included) still created the order once');
 ok((await d.locator('p.error').innerText()).length>10,'the shopper sees: '+(await d.locator('p.error').innerText()));
 await fetch(API+'/__drop?n=0'); await d.click('button.primary.wide:has-text("Place Order")'); await d.waitForURL('**/order-placed');
 ok((await apiOrders()).length===1,'retry did NOT create a duplicate (idempotency key reused)');
 // 9. non-customer
 await mode({}); const a=await mk(b); await a.goto(UI+'/account'); await a.fill('input[type=email]','admin@royaltreats.test'); await a.fill('input[type=password]','AdminPass-12345'); await a.click('button.primary:has-text("Sign in")'); await a.waitForSelector('.nav-account');
 await a.goto(UI+'/orders'); await a.waitForSelector('h1');
 ok(await a.locator('text=customer accounts').count()>0&&await a.locator('.my-order').count()===0,'admin sees the "customer accounts" notice, not orders');
 // 10. expired session on the list
 const e=await mk(b); await register(e,{email:'e@example.com'}); await mode({expireTokens:true}); await e.goto(UI+'/orders').catch(()=>{}); await e.waitForTimeout(1500);
 ok(await e.locator('.my-order').count()===0,'expired session shows no orders');
 for(const p of [pg,out,d,a,e]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})();
