// Browser suite: 01-catalogue. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=async(m)=>fetch(API+'/__mode',{method:'POST',body:JSON.stringify({delayMs:0,failNext:0,failAlways:false,bulk:false,...m})});
const reqLog=async()=>(await fetch(API+'/__log')).json();
async function mk(b){const ctx=await b.newContext({viewport:{width:1280,height:900}});const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:require('fs').readFileSync(require('path').join(__dirname,'..','assets','stub.png'))}));
  await pg.addInitScript(()=>{localStorage.setItem('royal-welcome-v1','yes')}); return pg}
(async()=>{
 const b=await chromium.launch();
 // A. normal load
 await mode({}); let pg=await mk(b);
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product');
 ok((await pg.locator('.menu-product-grid .product').count())===6,'menu shows the 6 API products (4 seeded + 2 extra)');
 const names=await pg.locator('.menu-product-grid .product b').allInnerTexts(); ok(names.includes('Cake Slice')&&names.includes('Mini Donuts'),'names come from the API ('+names.join(', ')+')');
 const log=await reqLog(); ok(log.some(l=>l==='GET /api/v1/products?page=1&limit=100')&&log.some(l=>l==='GET /api/v1/settings'),'requests: '+log.join(' | '));
 ok((await pg.locator('.product:has-text("Cake Slice") strong').innerText()).trim()==='R25.50','fractional price shows as R25.50 (cents -> rand -> pipe)');
 ok((await pg.locator('.product:has-text("Mini Donuts") strong').innerText()).trim()==='R25','whole price shows as R25');
 ok(await pg.locator('.product:has-text("Retired Treat") .stock-tag').count()===1 && await pg.locator('.product:has-text("Retired Treat")').isDisabled(),'unavailable product is "Sold out" and disabled');
 ok(await pg.locator('.api-banner').count()===0,'no banner on a fast load');
 // options from API sauces/toppings
 await pg.goto(UI+'/menu/slush'); await pg.waitForSelector('h1');
 ok((await pg.locator('h3:text-is("Choose flavour")').count())===1 && (await pg.locator('.variants button.selected').allInnerTexts()).join('|').includes('Lemon Lime'),'slushie: "Choose flavour", first API flavour (Lemon Lime) preselected');
 await pg.goto(UI+'/menu/donuts'); await pg.waitForSelector('h1');
 ok((await pg.locator('h3:text-is("Choose sauce")').count())===1 && (await pg.locator('.variants button').allInnerTexts()).includes('Milky White'),'donuts: "Choose sauce" with API sauces');
 await pg.goto(UI+'/menu/sundae'); await pg.waitForSelector('h1');
 ok((await pg.locator('h3:text-is("Choose topping")').count())===1 && (await pg.locator('h3').filter({hasText:/Choose (flavour|sauce)/}).count())===0,'sundae: toppings only, no flavour step');
 // settings from API on contact page
 await pg.goto(UI+'/contact'); await pg.waitForSelector('.support-compose');
 const contact=await pg.locator('.support-page').innerText(); ok(contact.includes('hello@royaltreats.test')&&contact.includes('09:00')&&contact.includes('21:00'),'contact page shows API support email and hours');
 // F. cart with a fractional price
 await pg.goto(UI+'/menu/cake'); await pg.waitForSelector('h1'); await pg.click('button:has-text("Add to Cart")'); await pg.waitForURL('**/cart');
 const cart=await pg.evaluate(()=>JSON.parse(localStorage.getItem('rt-cart')));
 ok(cart[0].productId==='cake'&&cart[0].price===25.5&&cart[0].sauce==='Caramel','cart line: productId cake, R25.50, API sauce Caramel');
 ok((await pg.locator('.checkout-summary .total').last().innerText()).includes('R25.50'),'cart total shows R25.50');
 ok(pg.errs.length===0,'no page errors in normal flow ('+pg.errs.join('|')+')');
 // A2. pagination across API pages
 await mode({bulk:true}); pg=await mk(b); await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product');
 ok((await pg.locator('.menu-result-heading strong').innerText()).startsWith('136'),'136 products loaded across two API pages ('+await pg.locator('.menu-result-heading strong').innerText()+')');
 const l2=(await reqLog()).filter(l=>l.includes('/products')); ok(l2.length===2&&l2[1].includes('page=2'),'followed pagination: '+l2.join(' | '));
 // B. cold start
 await mode({delayMs:6500}); pg=await mk(b); await pg.goto(UI+'/menu');
 await pg.waitForSelector('.api-banner:has-text("Waking up the server")'); ok(true,'cold start: "Waking up the server" banner appears');
 ok((await pg.locator('.menu-empty h3').innerText()).includes('Loading the menu'),'menu says "Loading the menu…" instead of "No treats found"');
 await pg.waitForSelector('.menu-product-grid .product'); ok((await pg.locator('.api-banner').count())===0,'banner disappears once loaded');
 // B2. deep link to a product while the API is still waking up
 await mode({delayMs:6500}); pg=await mk(b); await pg.goto(UI+'/menu/donuts'); await pg.waitForSelector('app-root h1:has-text("Mini Donuts")',{timeout:25000});
 ok(pg.url().endsWith('/menu/donuts'),'deep link /menu/donuts during a cold start waits for the catalogue instead of bouncing to /menu');
 // B3. unknown id once the catalogue has loaded
 await mode({}); pg=await mk(b); await pg.goto(UI+'/menu/no-such-product'); await pg.waitForURL('**/menu'); ok(true,'unknown product id still redirects to /menu');
 // C. transient failures are retried
 await mode({failNext:2}); pg=await mk(b); await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product',{timeout:20000});
 ok((await reqLog()).length>=4 && await pg.locator('.api-banner-error').count()===0,'two 503s are retried transparently ('+(await reqLog()).length+' requests, no error banner)');
 // D. hard failure then recovery
 await mode({failAlways:true}); pg=await mk(b); await pg.goto(UI+'/menu'); await pg.waitForSelector('.api-banner-error',{timeout:30000});
 ok((await pg.locator('.menu-empty h3').innerText()).includes('The menu is unavailable'),'persistent failure: error banner + "The menu is unavailable"');
 await mode({}); await pg.click('.api-banner-error button:has-text("Try again")'); await pg.waitForSelector('.menu-product-grid .product');
 ok((await pg.locator('.api-banner-error').count())===0,'"Try again" recovers once the API is back');
 await b.close();
})();
