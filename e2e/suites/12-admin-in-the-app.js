// Browser suite: 12-admin-in-the-app. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 const mk=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:w<700,hasTouch:w<700}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); return ctx.newPage();};
 let pg=await mk(390,844);
 await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
 ok(await pg.locator('.top').isVisible()&&await pg.locator('.mobile-bottom-nav').isVisible(),'the shop header and bottom bar stay in the admin');
 const logo=await pg.locator('.top .logo').isVisible(); ok(logo,'the shop logo is still there');
 ok(await pg.evaluate(()=>{const e=document.querySelector('app-portal').shadowRoot.querySelector('.admin-subnav'); const bg=getComputedStyle(e).backgroundColor; const m=bg.match(/\d+/g).map(Number); return m[0]>230&&m[1]>230&&m[2]>230}),'the admin strip is light, like the shop (no dark bar)');
 ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('app-portal').shadowRoot.querySelector('.admin-subnav')).position==='sticky'),'the section strip is sticky under the shop header');
 const tabs=pg.locator('.appbar-tabs button'); ok(await tabs.count()===5,'five section pills');
 ok((await tabs.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height))).every(h=>h>=44),'every pill is at least 44px tall');
 const title=async()=>(await pg.locator('app-portal').evaluate(e=>e.shadowRoot.querySelector('.role-header h1').textContent)).trim();
 ok(await title()==='Store overview','the page has a plain title like the shop pages');
 for(const [n,t,q] of [['Orders','Orders','orders'],['Products','Products','products'],['Delivery team','Delivery team','couriers'],['Settings','Settings','settings'],['Overview','Store overview',null]]){ await pg.tap('.appbar-tabs button:has-text("'+n+'")'); await pg.waitForTimeout(300); ok(await title()===t&&(await pg.locator('.appbar-tabs button.active').innerText()).includes(n),'tapping '+n+' opens '+t); ok((new URL(pg.url()).searchParams.get('screen'))===q,'the address follows ('+(q?'?screen='+q:'no screen')+')'); }
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth),'no sideways scroll');
 // the shop's menu has the admin sections too
 await pg.tap('.mobile-menu-trigger'); await pg.waitForSelector('.drawer-admin');
 ok((await pg.locator('.drawer-admin').innerText()).includes('Delivery team'),'the shop menu lists the admin sections');
 await pg.tap('.drawer-admin button:has-text("Products")'); await pg.waitForTimeout(400);
 ok(await title()==='Products'&&await pg.locator('.nav.drawer').count()===0,'a menu entry opens that admin screen and closes the menu');
 await pg.tap('.mobile-bottom-nav button:has-text("Orders")'); await pg.waitForTimeout(400);
 ok(await title()==='Orders'&&(await pg.locator('.mobile-bottom-nav button.current').innerText()).includes('Orders'),'the bottom bar Orders tab opens the admin orders and highlights');
 await pg.tap('.mobile-bottom-nav button:has-text("Workspace")'); await pg.waitForTimeout(400);
 ok(await title()==='Store overview'&&(await pg.locator('.mobile-bottom-nav button.current').innerText()).includes('Workspace'),'Workspace goes back to the overview');
 await pg.goto(UI+'/account?screen=settings'); await pg.waitForSelector('.settings-page'); ok(true,'a link straight to ?screen=settings opens Settings');
 await pg.tap('.mobile-menu-trigger'); await pg.tap('.drawer-signout'); await pg.waitForTimeout(500);
 await pg.goto(UI+'/account'); await pg.waitForSelector('input[name=email]'); ok(true,'Sign out in the shop menu signs the admin out');
 pg=await mk(1280,800); await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.workspace-sidebar');
 ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('app-portal').shadowRoot.querySelector('.admin-subnav')).display==='none'),'desktop keeps the sidebar and hides the phone strip');
 await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
