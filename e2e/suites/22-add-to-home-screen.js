// Browser suite: 22-add-to-home-screen. After an order, a phone is asked once to add the shop to its Home Screen. Runs against the mock API (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
const tomorrow=new Date(Date.now()+36*3600e3).toISOString().slice(0,10);
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const line={productId:'donuts',name:'Mini Donuts',image:'',variant:'12 donuts',price:50,qty:1,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato'};
async function mk(b,opts,n){const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,...opts});await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));
 await ctx.addInitScript(()=>{localStorage.setItem('royal-welcome-v1','yes')});
 const pg=await ctx.newPage();pg.setDefaultTimeout(12000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));return {ctx,pg}}
async function register(pg,email){
 await pg.goto(UI+'/account'); await pg.click('button:has-text("Register here")');
 await pg.fill('input[name=name]','Thandi Mokoena'); await pg.fill('input[type=email]',email); await pg.fill('input[name=phone]','074 123 4567'); await pg.fill('input[name=password]','a-long-enough-pass');
 await pg.check('input[name=consent]'); await pg.click('button.primary:has-text("Register")'); await pg.waitForSelector('.profile-pane'); }
async function order(pg){
 await pg.goto(UI+'/cart'); await pg.evaluate(l=>localStorage.setItem('rt-cart',JSON.stringify([l])),line); await pg.goto(UI+'/checkout');
 await pg.fill('input[name=date]',tomorrow); await pg.selectOption('select[name=time]','12:00'); await pg.click('button.primary.wide:has-text("Place Order")'); await pg.waitForURL('**/order-placed'); await pg.waitForSelector('.ref'); }
(async()=>{
 await fetch(API+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 // ---- iPhone: instructions, once ----
 let {ctx,pg}=await mk(b,{userAgent:IPHONE});
 await register(pg,'ios@example.com'); await order(pg);
 await pg.waitForSelector('.home-screen-card');
 const text=(await pg.locator('.home-screen-card').innerText()).replace(/\s+/g,' ');
 ok(text.includes('Add Royal Treats to your Home Screen')&&text.includes('Share')&&text.includes('Add to Home Screen'),'an iPhone is shown the Share → Add to Home Screen steps');
 ok(await pg.locator('.home-screen-card button.primary').count()===0,'no install button on an iPhone (Apple does not allow one)');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'the card fits the phone with no sideways scroll');
 await pg.click('.home-screen-card button:has-text("Not now")'); ok(await pg.locator('.home-screen-card').count()===0,'"Not now" hides the card');
 await order(pg); await pg.waitForTimeout(400);
 ok(await pg.locator('.home-screen-card').count()===0,'a second order on the same phone does not ask again');
 await ctx.close();
 // ---- Android with Chrome's install prompt ----
 ({ctx,pg}=await mk(b,{userAgent:ANDROID}));
 await pg.addInitScript(()=>{ window.__promptCalls=0; window.addEventListener('DOMContentLoaded',()=>{ const e=new Event('beforeinstallprompt',{cancelable:true}); e.prompt=async()=>{window.__promptCalls++}; e.userChoice=Promise.resolve({outcome:'accepted'}); setTimeout(()=>window.dispatchEvent(e),100); }); });
 await register(pg,'android@example.com'); await order(pg);
 await pg.waitForSelector('.home-screen-card button.primary:has-text("Add to Home Screen")');
 ok(true,'Android Chrome gets a real "Add to Home Screen" button');
 await pg.click('.home-screen-card button.primary');
 await pg.waitForFunction(()=>window.__promptCalls===1); ok(true,'the button opens the browser\'s own install prompt');
 await pg.waitForFunction(()=>!document.querySelector('.home-screen-card')); ok(true,'the card goes away once the shop is added');
 await ctx.close();
 // ---- Android without the prompt event: manual steps ----
 ({ctx,pg}=await mk(b,{userAgent:ANDROID}));
 await register(pg,'android2@example.com'); await order(pg);
 await pg.waitForSelector('.home-screen-card');
 const steps=(await pg.locator('.home-screen-card').innerText()).replace(/\s+/g,' ');
 ok(steps.includes('Add to Home screen')&&steps.includes('menu')&&await pg.locator('.home-screen-card button.primary').count()===0,'without the browser prompt, Android is shown the menu steps');
 await ctx.close();
 // ---- already installed / computer: never asked ----
 ({ctx,pg}=await mk(b,{userAgent:IPHONE}));
 await pg.addInitScript(()=>{ const real=window.matchMedia.bind(window); window.matchMedia=(q)=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:real(q); });
 await register(pg,'installed@example.com'); await order(pg); await pg.waitForTimeout(400);
 ok(await pg.locator('.home-screen-card').count()===0,'someone already using the Home Screen shortcut is not asked');
 await ctx.close();
 ({ctx,pg}=await mk(b,{viewport:{width:1280,height:900},hasTouch:false}));
 await register(pg,'desktop@example.com'); await order(pg); await pg.waitForTimeout(400);
 ok(await pg.locator('.home-screen-card').count()===0,'a computer is not asked');
 await ctx.close(); await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
