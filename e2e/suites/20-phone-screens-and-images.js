// Browser suite: 20-phone-screens-and-images. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const UI=(process.env.UI_URL||'http://localhost:4307'), CTRL=(process.env.API_URL||'http://localhost:3000'), API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const stub=fs.readFileSync(path.join(__dirname,'..','assets','stub.png'));
async function call(p,{method='GET',token,body,headers}={}){const r=await fetch(API+p,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}});
 const b=await chromium.launch(); const seen=[];
 const mk=async(w=390,h=844)=>{const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:w<700,hasTouch:w<700}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); await ctx.route('**/images.unsplash.com/**',r=>{seen.push(r.request().url()); r.fulfill({contentType:'image/png',body:stub});}); const pg=await ctx.newPage(); pg.setDefaultTimeout(12000); return {ctx,pg}};
 const signIn=async(pg,email,password,ready)=>{await pg.goto(UI+'/account'); await pg.fill('input[name=email]',email); await pg.fill('input[name=password]',password); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector(ready);};
 const light=(pg,sel)=>pg.evaluate((s)=>{const e=document.querySelector('app-portal').shadowRoot.querySelector(s); const m=getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number); return m.length===4&&m[3]===0||(m[0]>230&&m[1]>200&&m[2]>200)},sel);
 // ---- courier ----
 let {ctx,pg}=await mk();
 await signIn(pg,'courier@royaltreats.test','CourierPass-12345','.role-subnav');
 ok(await pg.locator('.role-subnav .appbar-tabs button').allInnerTexts().then(t=>t.map(x=>x.trim()).join('|'))==='Deliveries|My account','a courier gets two light pills: Deliveries and My account');
 ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('app-portal').shadowRoot.querySelector('.portal-top')).display==='none'),'the second "Royal Treats" bar is gone (the shop header is the only one)');
 ok(await light(pg,'.role-header'),'the page title is on a light background, not a dark card');
 ok((await pg.locator('.role-header h1').innerText()).includes('Delivery workspace'),'with a plain title');
 await pg.tap('.role-subnav button:has-text("My account")'); await pg.waitForSelector('rt-account-settings'); ok((await pg.locator('.role-header h1').innerText()).includes('My account'),'My account opens from the pill');
 await pg.tap('.role-subnav button:has-text("Deliveries")'); await pg.waitForSelector('rt-courier-workspace'); ok(true,'and Deliveries brings the jobs back');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth),'no sideways scroll');
 await ctx.close();
 // ---- customer ----
 ({ctx,pg}=await mk()); await signIn(pg,'thandi@example.com','a-long-enough-pass','.role-subnav');
 ok((await pg.locator('.role-subnav .appbar-tabs button').allInnerTexts()).map(x=>x.trim()).join('|')==='My profile|My account','a customer gets My profile and My account');
 ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('app-portal').shadowRoot.querySelector('.portal-top')).display==='none'),'and no second brand bar');
 await ctx.close();
 // ---- admin: products and delivery team ----
 ({ctx,pg}=await mk()); await signIn(pg,'admin@royaltreats.test','AdminPass-12345','.appbar-tabs');
 await pg.tap('.appbar-tabs button:has-text("Products")'); await pg.waitForSelector('.product-line');
 const add=await pg.locator('.add-product').boundingBox(); ok(add.width>340&&add.height>=48,'"+ Add product" is a full-width button on a phone');
 ok(await pg.locator('.products-head h2').isHidden(),'the page title is not repeated by a second heading');
 const heights=await pg.locator('.pline-actions button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height)); ok(heights.length>=8&&heights.every(h=>h>=44),'every product action is a thumb-sized button ('+heights.length+' buttons)');
 ok((await pg.locator('.stock-pill').first().innerText())==='In stock'&&await pg.locator('.stock-pill.out').count()===1,'stock shows as a pill, red when out of stock');
 await pg.tap('.appbar-tabs button:has-text("Delivery team")'); await pg.waitForSelector('rt-admin-couriers form');
 ok(!(await pg.locator('rt-admin-couriers form').innerText()).includes('>'),'the Delivery team form has no stray ">" before its button');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth),'no sideways scroll');
 await ctx.close();
 // ---- images are asked for at phone size ----
 ({ctx,pg}=await mk()); seen.length=0;
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product img'); await pg.waitForTimeout(800);
 const widths=seen.map(u=>+new URL(u).searchParams.get('w')).filter(Boolean);
 ok(seen.length>0&&widths.length===seen.length&&widths.every(w=>w<=640),'every picture on the menu is requested resized (at most 640 px wide): '+[...new Set(widths)].join(', '));
 const img=pg.locator('.menu-product-grid .product img').first();
 ok((await img.getAttribute('loading'))==='lazy'&&(await img.getAttribute('srcset')||'').includes('320w')&&(await img.getAttribute('sizes')||'').includes('46vw'),'menu pictures are lazy and offer several sizes to the browser');
 await pg.locator('.menu-product-grid .product').first().click(); await pg.waitForSelector('.feature-img');
 const hero=pg.locator('.feature-img'); ok(!(await hero.getAttribute('loading'))&&(await hero.getAttribute('src')).includes('w=800'),'the product picture at the top of a page is not lazy, and is at most 800 px');
 await ctx.close(); await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
