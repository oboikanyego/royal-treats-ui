// Browser suite: 13-settings-and-navigation. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'', API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 await fetch(API+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true})});
 const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes'));
 let geo=[{lat:'-24.5912',lon:'27.4112',display_name:'Found'}], geoCalls=[];
 await ctx.route('**/nominatim.openstreetmap.org/**',r=>{geoCalls.push(r.request().url()); r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(geo)});});
 const puts=[]; await ctx.route('**/admin/settings',r=>{ if(r.request().method()==='PUT') puts.push(JSON.parse(r.request().postData())); r.continue(); });
 const pg=await ctx.newPage(); pg.setDefaultTimeout(15000);
 await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
 await pg.tap('.appbar-tabs button:has-text("Settings")'); await pg.waitForSelector('.settings-page');
 ok(await pg.locator('input[name=latitude],input[name=longitude]').count()===0,'no latitude or longitude fields');
 ok((await pg.locator('.settings-page').innerText()).toLowerCase().includes("device's location")===false,'no "use this device\'s location" button');
 ok(await pg.locator('.settings-card').count()===5,'five settings cards (pause, shop, hours, contact, delivery)');
 // unchanged address + existing coordinates -> no lookup
 await pg.fill('input[name=storeName]','Royal Treats Thabazimbi'); await pg.tap('.settings-save button'); await pg.waitForSelector('.success-alert');
 ok(geoCalls.length===0&&puts.length===1&&puts[0].latitude!==null,'saving without changing the address does not look it up again and keeps the point');
 // changed address -> lookup, coordinates sent
 await pg.fill('input[name=address]','12 Rietbok Street, Thabazimbi'); await pg.tap('.settings-save button'); await pg.waitForSelector('.success-alert:has-text("saved")');
 await pg.waitForTimeout(300);
 ok(geoCalls.length===1&&decodeURIComponent(geoCalls[0]).includes('12 Rietbok Street')&&geoCalls[0].includes('countrycodes=za'),'a new address is looked up (South Africa only)');
 ok(puts.length===2&&puts[1].latitude===-24.5912&&puts[1].longitude===27.4112&&puts[1].address==='12 Rietbok Street, Thabazimbi','the found point is saved with the address');
 ok(await pg.locator('.delivery-status.ok a').getAttribute('href').then(h=>h.includes('-24.5912')),'a map link shows where deliveries are measured from');
 // address not found -> blocked, nothing saved
 geo=[]; await pg.fill('input[name=address]','Nowhere at all'); await pg.tap('.settings-save button'); await pg.waitForSelector('.alert.error');
 ok((await pg.locator('.alert.error').innerText()).includes("couldn't find that address")&&puts.length===2,'an address that cannot be found is refused and nothing is saved');
 // overview no longer warns when located
 await pg.tap('.appbar-tabs button:has-text("Overview")'); await pg.waitForTimeout(500);
 ok((await pg.locator('app-portal').innerText().catch(()=>'')).includes('could not be found')===false,'overview shows no delivery warning when the shop is located');
 // storefront chrome
 const p2=await ctx.newPage(); await p2.goto(UI+'/menu'); await p2.waitForSelector('.mobile-bottom-nav');
 ok(await p2.locator('.mobile-bottom-nav button svg').count()>=4,'bottom bar uses drawn icons');
 const bar=await p2.locator('.mobile-bottom-nav').boundingBox(); ok(bar.x>=8&&bar.y+bar.height<=844-8&&bar.width<=390-16,'bottom bar floats inside the screen edges');
 const hs=await p2.locator('.mobile-bottom-nav button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height)); ok(hs.every(h=>h>=48),'bottom bar buttons are at least 48px tall');
 await p2.tap('.mobile-menu-trigger'); await p2.waitForSelector('.nav.drawer');
 ok(await p2.locator('.drawer-backdrop').isVisible(),'menu opens with a dimmed backdrop');
 ok((await p2.locator('.drawer-account').innerText()).includes('Royal Admin'),'drawer shows the signed-in person (this page shares the admin session)');
 await p2.tap('.drawer-links button:has-text("About Us")'); await p2.waitForTimeout(400); ok(await p2.locator('.nav.drawer').count()===0&&p2.url().endsWith('/about'),'a drawer link navigates and closes the drawer');
 await p2.tap('.mobile-menu-trigger'); await p2.waitForSelector('.drawer-backdrop'); await p2.mouse.click(370,400); await p2.waitForTimeout(300); ok(await p2.locator('.nav.drawer').count()===0,'tapping the backdrop closes the drawer');
 await p2.tap('.mobile-menu-trigger'); await p2.waitForSelector('.nav.drawer'); await p2.tap('.drawer-close'); await p2.waitForTimeout(300); ok(await p2.locator('.nav.drawer').count()===0,'the close button closes the drawer');
 ok(await p2.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth),'no sideways scroll');
 await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
