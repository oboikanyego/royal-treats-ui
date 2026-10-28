// Browser suite: 08-loading-feedback. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify(m||{})});
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
async function mk(b,{mobile=true}={}){const ctx=await b.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:900}});
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub})); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes'));
 const pg=await ctx.newPage(); pg.setDefaultTimeout(30000); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push(e.message)); return {ctx,pg}}
(async()=>{
 const b=await chromium.launch();
 // 1. while the menu data is slow, a loading bar shows
 await mode({delayMs:1500}); let {ctx,pg}=await mk(b); await pg.goto(UI+'/menu',{waitUntil:'commit'});
 await pg.waitForSelector('.busy-bar'); ok(true,'a loading bar appears while the API is slow');
 await pg.waitForSelector('.menu-product-grid .product'); await pg.waitForFunction(()=>!document.querySelector('.busy-bar')); ok(true,'and it disappears when the menu has loaded');
 await ctx.close();
 // 2. quick work never flashes the bar
 await mode({delayMs:0}); ({ctx,pg}=await mk(b)); await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product'); await pg.waitForTimeout(1500);
 let seen=0; await pg.exposeFunction('__seen',()=>seen++); await pg.evaluate(()=>{new MutationObserver(()=>{if(document.querySelector('.busy-bar'))window.__seen()}).observe(document.body,{childList:true,subtree:true})});
 await pg.click('.menu-product-grid .product'); await pg.waitForSelector('.variants'); await pg.waitForTimeout(600);
 ok(seen===0,'a quick product open does not flash the bar');
 // 3. preloading: after the menu is up the product page code is already downloaded
 await ctx.close(); ({ctx,pg}=await mk(b)); const scripts=[]; pg.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url())});
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product'); await pg.waitForTimeout(2500);
 const before=scripts.length; await pg.click('.menu-product-grid .product'); await pg.waitForSelector('.variants'); await pg.waitForTimeout(300);
 ok(scripts.length===before,'tapping a product downloads no new code (it was preloaded): '+before+' scripts before, '+scripts.length+' after');
 await ctx.close();
 // 4. a slow download: the card shows it is opening, the bar shows, and extra taps are ignored
 ({ctx,pg}=await mk(b)); let slow=false; await ctx.route('**/chunk-*.js',async r=>{ if(slow) await new Promise(x=>setTimeout(x,2500)); r.continue(); });
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product'); slow=true; await pg.evaluate(()=>{}); 
 // load a route that is not preloaded to force a real download: the cart
 const hist=await pg.evaluate(()=>history.length);
 await pg.click('.menu-product-grid .product'); // may be preloaded; so instead use a card whose code is delayed
 await pg.waitForTimeout(100); await ctx.close();
 // 4b. force slowness by delaying every chunk from the very start so nothing is preloaded yet
 ({ctx,pg}=await mk(b)); await ctx.route('**/chunk-*.js',async r=>{ await new Promise(x=>setTimeout(x,2500)); r.continue(); });
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product');
 const h0=await pg.evaluate(()=>history.length);
 const card=pg.locator('.menu-product-grid .product').first();
 await card.click(); await pg.waitForSelector('.product.opening',{timeout:3000}); ok(true,'the tapped card shows it is opening');
 await pg.waitForSelector('.busy-bar',{timeout:3000}); ok(true,'the loading bar shows during the slow page change');
 await card.click({force:true}).catch(()=>{}); await card.click({force:true}).catch(()=>{});
 await pg.waitForSelector('.variants',{timeout:30000}); await pg.waitForTimeout(300);
 const h1=await pg.evaluate(()=>history.length);
 ok(h1===h0+1&&pg.url().includes('/menu/'),'three taps opened the product once (one history entry added)');
 ok(await pg.locator('.busy-bar').count()===0,'the bar is gone once the page is open');
 await ctx.close();
 // 5. hover effects do not apply on touch devices but still do with a mouse
 ({ctx,pg}=await mk(b,{mobile:true})); await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product');
 ok(await pg.evaluate(()=>matchMedia('(hover: hover)').matches)===false,'a touch device reports no hover');
 const t=await pg.evaluate(()=>{const el=document.querySelector('.menu-product-grid .product'); const rule=[...document.styleSheets].flatMap(s=>{try{return[...s.cssRules]}catch{return[]}}).filter(r=>r.cssText.includes('.product:hover')); return {inMedia:rule.every(r=>r.constructor.name==='CSSMediaRule'), count:rule.length}});
 ok(t.count>0&&t.inMedia,'the card hover effect sits inside (hover: hover)');
 await ctx.close(); ({ctx,pg}=await mk(b,{mobile:false})); await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product');
 await pg.hover('.menu-product-grid .product'); await pg.waitForTimeout(400);
 ok((await pg.evaluate(()=>getComputedStyle(document.querySelector('.menu-product-grid .product')).transform))!=='none','with a mouse the card still lifts on hover');
 for(const p of [pg]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
