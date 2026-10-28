// Browser suite: 04-admin-workspace. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'/api/v1', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=async(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify({delayMs:0,failNext:0,failAlways:false,bulk:false,expireTokens:false,limitAuth:false,dropOrderResponse:0,soldOut:[],imagesOff:false,...m})});
const flag=(q)=>fetch(CTRL+'/__flag?'+q);
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
const tomorrow=new Date(Date.now()+36*3600e3).toISOString().slice(0,10);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
const products=async()=>(await call('/products?limit=100')).body.items;
async function seedOrders(){
 const c=(await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 const place=(key,extra,items)=>call('/orders',{method:'POST',token:c.token,headers:{'idempotency-key':key},body:{fulfillment:'collection',date:tomorrow,time:'12:00',notes:'',items,...extra}});
 const item={productId:'donuts',variant:'12 donuts',qty:2,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato'};
 const a=await place('collect-order-1',{notes:'Please write Happy Birthday'},[item]);
 const b=await place('deliver-order-2',{fulfillment:'delivery',address:'12 Test St',latitude:-24.59,longitude:27.41},[{...item,recipient:''}]);
 return {a:a.body,b:b.body}}
async function mk(b){const ctx=await b.newContext({viewport:{width:1280,height:900},geolocation:{latitude:-24.59,longitude:27.41},permissions:['geolocation']});await ctx.route('**/nominatim.openstreetmap.org/**',r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify([{lat:'-24.6',lon:'27.41',display_name:'Found'}])}));const pg=await ctx.newPage();pg.setDefaultTimeout(12000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub})); await ctx.route('**/res.cloudinary.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));
 await pg.addInitScript(()=>{ if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');} });
 return pg}
async function signIn(pg,email='admin@royaltreats.test',password='AdminPass-12345'){await pg.goto(UI+'/account'); await pg.fill('input[type=email]',email); await pg.fill('input[type=password]',password); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.workspace-sidebar, .pane')}
const nav=async(pg,t)=>{await pg.click(`.sidebar-navigation button:has-text("${t}")`)};
const txt=async(pg,sel)=>(await pg.locator(sel).first().textContent()).replace(/\s+/g,' ').trim();
let LASTPG;
(async()=>{
 const b=await chromium.launch(); await mode({}); const {a,b:del}=await seedOrders(); let pg=await mk(b); LASTPG=pg;
 // 1. overview
 await signIn(pg);
 ok(await pg.locator('.workspace-sidebar').count()>0&&(await txt(pg,'.sidebar-identity')).includes('Administrator')&&!(await txt(pg,'.sidebar-identity')).includes('Demo'),'admin workspace opens with the sidebar, no "Demo" label');
 await pg.waitForSelector('rt-admin-overview .portal-stats b');
 const stats=await pg.locator('rt-admin-overview .portal-stats b').allTextContents();
 ok(stats[0].trim()==='2'&&stats[1].trim()==='2','overview: 2 orders, 2 waiting to confirm ('+stats.join('|')+')');
 ok((await pg.locator('rt-admin-overview').textContent()).includes('Orders by status'),'overview lists orders by status');
 // 2. orders
 await nav(pg,'Orders'); await pg.waitForSelector('rt-admin-orders .order-card');
 ok(await pg.locator('rt-admin-orders .order-card').count()===2,'orders screen lists both orders');
 const card=pg.locator('rt-admin-orders .order-card',{hasText:'Happy Birthday'});
 const t=(await card.textContent()).replace(/\s+/g,' ');
 ok(t.includes('Thandi Mokoena')&&t.includes('074 123 4567')&&t.includes('Lerato')&&t.includes('R100'),'order card: customer, phone, recipient, server total');
 ok(await card.locator('button:has-text("Mark Confirmed")').count()===1&&await card.locator('button:has-text("Cancel order")').count()===1,'Pending offers exactly "Mark Confirmed" and "Cancel order"');
 await card.locator('button:has-text("Mark Confirmed")').click(); await pg.waitForSelector('text=/is now Confirmed/');
 ok((await fetch(CTRL+'/__orders').then(r=>r.json())).find(o=>o.id===a.id).status==='Confirmed','the API now says Confirmed');
 await card.locator('button:has-text("Mark Preparing")').click(); await pg.waitForSelector('text=/is now Preparing/');
 await card.locator('button:has-text("Mark Ready for Collection")').click(); await pg.waitForSelector('text=/is now Ready for Collection/');
 ok(await card.locator('button:has-text("Mark Collected")').count()===1,'collection order walks Confirmed → Preparing → Ready for Collection → Collected');
 await card.locator('button:has-text("Mark Collected")').click(); await pg.waitForSelector('text=/is now Collected/');
 ok(await card.locator('.actions button').count()===0,'a completed order has no actions');
 // delivery order: Ready for Delivery then waits for a courier
 const dcard=pg.locator('rt-admin-orders .order-card',{hasText:'12 Test St'});
 for (const s of ['Confirmed','Preparing','Ready for Delivery']) { await dcard.locator(`button:has-text("Mark ${s}")`).click(); await pg.waitForSelector(`text=/is now ${s}/`); }
 ok((await dcard.textContent()).includes('Waiting for a courier')&&await dcard.locator('button:has-text("Mark")').count()===0,'Ready for Delivery: no admin button, "Waiting for a courier"');
 // cancel with confirmation
 await dcard.locator('button:has-text("Cancel order")').click(); ok((await dcard.textContent()).includes('This cannot be undone'),'cancel asks first');
 await dcard.locator('button:has-text("Keep order")').click(); ok((await fetch(CTRL+'/__orders').then(r=>r.json())).find(o=>o.id===del.id).status==='Ready for Delivery','keeping changes nothing');
 await dcard.locator('button:has-text("Cancel order")').click(); await dcard.locator('button:has-text("Yes, cancel it")').click(); await pg.waitForSelector('text=/is now Cancelled/');
 ok((await fetch(CTRL+'/__orders').then(r=>r.json())).find(o=>o.id===del.id).status==='Cancelled','cancelled on the API');
 await pg.click('rt-admin-orders .filter-chips button:text-is("Done")'); await pg.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-admin-orders .order-card').length===1); ok(await pg.locator('rt-admin-orders .order-card').count()===1,'filter "Completed" shows one order');
 await pg.click('rt-admin-orders .filter-chips button:text-is("Cancelled")'); await pg.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-admin-orders .order-card').length===1); ok(await pg.locator('rt-admin-orders .order-card').count()===1,'filter "Cancelled" shows one order');
 // 3. products
 await nav(pg,'Products'); await pg.waitForSelector('rt-admin-products .product-line');
 ok(await pg.locator('rt-admin-products .product-line').count()>=5,'catalogue lists API products');
 const cake=pg.locator('rt-admin-products .product-line',{hasText:'Cake Slice'});
 await cake.locator('button:has-text("Edit")').click(); await pg.waitForSelector('.product-editor');
 ok(await pg.locator('.product-editor input[name=image][type=text], .product-editor [name=image]:not([type=file])').count()===0,'the editor has no image-URL field');
 ok(await pg.locator('.product-editor input[type=file]').count()===1,'the editor offers a file upload only');
 ok(await pg.locator('.product-editor textarea[name=flavours]').inputValue().then(v=>v==='Caramel'),'sauces are editable ("Caramel")');
 await pg.fill('.product-editor input[name=name]','Cake Slice Deluxe');
 await pg.fill('.product-editor .variant-row:nth-of-type(1) input[type=number]','27.5');
 await pg.fill('.product-editor textarea[name=flavours]','Caramel\nChocolate');
 await pg.setInputFiles('.product-editor input[type=file]',{name:'cake.png',mimeType:'image/png',buffer:stub});
 await pg.waitForFunction(()=>document.querySelector('app-portal')?.shadowRoot?.querySelector('.media-preview img')?.src?.includes('res.cloudinary.com'));
 ok(true,'uploaded picture is previewed from the image store URL');
 await pg.click('.product-editor button[type=submit]'); await pg.waitForSelector('text=/was saved/');
 let saved=(await products()).find(p=>p.id==='cake');
 ok(saved.name==='Cake Slice Deluxe'&&saved.variants[0].priceCents===2750&&saved.sauces.join()==='Caramel,Chocolate'&&saved.image.startsWith('https://res.cloudinary.com/demo/image/upload/'),'saved to the API: name, price in cents (2750), sauces, uploaded image URL');
 ok(await pg.locator('rt-admin-products .product-line',{hasText:'Cake Slice Deluxe'}).count()===1,'the list shows the saved product');
 // editing a seeded product without touching its photo is accepted
 await pg.locator('rt-admin-products .product-line',{hasText:'Mini Donuts'}).locator('button:has-text("Edit")').click(); await pg.fill('.product-editor textarea[name=description]','Edited description');
 await pg.click('.product-editor button[type=submit]'); await pg.waitForSelector('text=/Mini Donuts was saved/');
 ok((await products()).find(p=>p.id==='donuts').image.includes('unsplash'),'a legacy photo stays as it was when only other fields change');
 // validation before any request
 const before=(await fetch(CTRL+'/__log').then(r=>r.json())).filter(l=>l.startsWith('PUT /api/v1/admin/products')).length;
 await pg.locator('rt-admin-products .product-line',{hasText:'Mini Donuts'}).locator('button:has-text("Edit")').click(); await pg.click('.product-editor button:has-text("+ Add size")');
 await pg.fill('.product-editor .variant-row >> nth=-1 >> input:not([type=number])','6 donuts'); await pg.fill('.product-editor .variant-row >> nth=-1 >> input[type=number]','10'); await pg.click('.product-editor button[type=submit]');
 await pg.waitForSelector('.product-editor .error'); ok((await txt(pg,'.product-editor p.error')).includes('listed twice'),'duplicate size names are caught before saving');
 ok((await fetch(CTRL+'/__log').then(r=>r.json())).filter(l=>l.startsWith('PUT /api/v1/admin/products')).length===before,'no request was sent for the invalid product');
 await pg.keyboard.press('Escape');
 // sold out / restock
 await cake.locator('button:has-text("Mark sold out")').click(); await pg.click('.confirm-dialog button:has-text("Confirm change")'); await pg.waitForSelector('text=/is now out of stock/');
 ok((await products()).find(p=>p.id==='cake').available===false,'marked sold out on the API');
 ok(await pg.locator('rt-admin-products .product-line',{hasText:'Cake Slice Deluxe'}).locator('button:has-text("Restock")').count()===1,'button now says Restock');
 // add product with failed upload then success
 await flag('imagesOff=1'); await pg.click('button:has-text("+ Add product")'); await pg.fill('.product-editor input[name=name]','Rainbow Float'); await pg.selectOption('.product-editor select[name=category]','Milkshakes');
 await pg.fill('.product-editor .variant-row:nth-of-type(1) input:not([type=number])','Regular'); await pg.fill('.product-editor .variant-row:nth-of-type(1) input[type=number]','45');
 await pg.setInputFiles('.product-editor input[type=file]',{name:'f.png',mimeType:'image/png',buffer:stub}); await pg.waitForSelector('.product-editor p.error');
 ok((await txt(pg,'.product-editor p.error')).includes('not set up'),'upload failure: "Picture uploads are not set up on the server yet."');
 await pg.setInputFiles('.product-editor input[type=file]',{name:'f.gif',mimeType:'image/gif',buffer:stub}); ok((await txt(pg,'.product-editor p.error')).includes('JPG, PNG or WebP'),'wrong file type is refused before upload');
 await flag('imagesOff=0'); await pg.setInputFiles('.product-editor input[type=file]',{name:'f.png',mimeType:'image/png',buffer:stub});
 await pg.waitForFunction(()=>document.querySelector('app-portal')?.shadowRoot?.querySelector('.media-preview img')?.src?.includes('res.cloudinary.com'));
 await pg.click('.product-editor button[type=submit]'); await pg.waitForSelector('text=/Rainbow Float was added/');
 const added=(await products()).find(p=>p.name==='Rainbow Float'); ok(!!added&&added.deliverable===false&&added.variants[0].priceCents===4500&&added.image.includes('cloudinary'),'new product created with uploaded image, price 4500 cents, not deliverable');
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product'); ok(await pg.locator('.menu-product-grid .product',{hasText:'Rainbow Float'}).count()===1,'the storefront menu shows the new product');
 // 4. couriers
 await pg.goto(UI+'/account'); await pg.waitForSelector('.workspace-sidebar'); await nav(pg,'Delivery team'); await pg.waitForSelector('rt-admin-couriers .order-card');
 ok((await txt(pg,'rt-admin-couriers')).includes('Sipho Courier'),'delivery team lists existing couriers');
 await pg.fill('rt-admin-couriers input[name=name]','Lindiwe Dlamini'); await pg.fill('rt-admin-couriers input[name=email]','lindiwe@royaltreats.test'); await pg.fill('rt-admin-couriers input[name=phone]','074 555 0000'); await pg.fill('rt-admin-couriers input[name=password]','short');
 await pg.click('rt-admin-couriers button:has-text("Add delivery person")'); await pg.waitForSelector('rt-admin-couriers .alert.error');
 ok((await txt(pg,'rt-admin-couriers .alert.error')).includes('12 to 128'),'short courier password is refused client-side');
 await pg.fill('rt-admin-couriers input[name=password]','a-long-enough-pass'); await pg.click('rt-admin-couriers button:has-text("Add delivery person")'); await pg.waitForSelector('rt-admin-couriers .success-alert');
 ok((await call('/auth/login',{method:'POST',body:{email:'lindiwe@royaltreats.test',password:'a-long-enough-pass'}})).status===200,'the new courier can sign in');
 await pg.fill('rt-admin-couriers input[name=name]','Dup Dlamini'); await pg.fill('rt-admin-couriers input[name=email]','lindiwe@royaltreats.test'); await pg.fill('rt-admin-couriers input[name=phone]','074 555 0001'); await pg.fill('rt-admin-couriers input[name=password]','a-long-enough-pass');
 await pg.click('rt-admin-couriers button:has-text("Add delivery person")'); await pg.waitForSelector('rt-admin-couriers .alert.error:has-text("already registered")'); ok(true,'duplicate email: "That email is already registered."');
 const lin=pg.locator('rt-admin-couriers .order-card',{hasText:'Lindiwe'}); await lin.locator('button:has-text("Deactivate")').click(); ok((await lin.textContent()).includes('signed out'),'deactivate asks first'); await lin.locator('button:has-text("Yes, deactivate")').click(); await pg.waitForSelector('text=/was deactivated/');
 ok((await call('/auth/login',{method:'POST',body:{email:'lindiwe@royaltreats.test',password:'a-long-enough-pass'}})).status===401,'a deactivated courier can no longer sign in');
 await lin.locator('button:has-text("Reactivate")').click(); await pg.waitForSelector('text=/can sign in again/');
 // 5. settings
 await nav(pg,'Settings'); await pg.waitForSelector('rt-admin-settings form');
 ok((await pg.inputValue('rt-admin-settings input[name=storeName]'))==='Royal Treats','settings form is filled from the API');
 await pg.fill('rt-admin-settings input[name=to1]','21:00'); await pg.fill('rt-admin-settings input[name=from1]','21:00'); await pg.click('rt-admin-settings button.primary'); await pg.waitForSelector('rt-admin-settings .alert.error');
 ok((await txt(pg,'rt-admin-settings .alert.error')).includes('must differ'),'same opening and closing time is refused');
 await pg.fill('rt-admin-settings input[name=from1]','08:00'); await pg.fill('rt-admin-settings input[name=address]','1 New Road, Thabazimbi'); await pg.fill('rt-admin-settings input[name=supportEmail]','help@royaltreats.test');
 await pg.click('rt-admin-settings button.primary'); await pg.waitForSelector('rt-admin-settings .success-alert');
 const st=(await call('/settings')).body; ok(st.open==='08:00'&&st.address==='1 New Road, Thabazimbi'&&st.supportEmail==='help@royaltreats.test'&&st.latitude===-24.6&&st.radiusKm===5,'settings saved on the API');
 await pg.goto(UI+'/contact'); await pg.waitForFunction(()=>document.body.textContent.includes('1 New Road')); ok((await pg.locator('footer small').textContent()).includes('1 New Road')&&(await pg.locator('a:has-text("View location")').getAttribute('href')).includes(encodeURIComponent('1 New Road, Thabazimbi')),'the contact page, footer and map link use the new address');
 // 6. a customer never sees admin tools; a failed save keeps the editor open
 await mode({}); const cu=await mk(b); await cu.goto(UI+'/account'); await cu.click('button:has-text("Register here")'); await cu.fill('input[name=name]','Plain Customer'); await cu.fill('input[type=email]','plain@example.com'); await cu.fill('input[name=phone]','074 123 4567'); await cu.fill('input[name=password]','a-long-enough-pass'); await cu.check('input[name=consent]'); await cu.click('button.primary:has-text(\"Register\")'); await cu.waitForSelector('.profile-pane');
 ok(await cu.locator('rt-admin-overview, rt-admin-orders, .workspace-sidebar').count()===0,'customer sees no admin workspace');
 const tok=await cu.evaluate(()=>JSON.parse(localStorage.getItem('royal-api-session')).token);
 ok((await call('/admin/dashboard',{token:tok})).status===403,'the API refuses admin calls from a customer token');
 for(const p of [pg,cu]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(async e=>{try{await LASTPG.screenshot({path:(process.env.E2E_OUT||require('os').tmpdir())+'/crash-admin-workspace.png'})}catch{};console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
