// Browser suite: 16-tap-current-tab. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage(); pg.setDefaultTimeout(10000);
 await pg.goto(UI+'/'); await pg.waitForTimeout(1200);
 await pg.evaluate(()=>window.scrollTo(0,1200)); await pg.waitForTimeout(300); const y0=await pg.evaluate(()=>window.scrollY); ok(y0>500,'the home page is scrolled down ('+y0+')');
 await pg.tap('.mobile-bottom-nav button:has-text("Home")'); await pg.waitForTimeout(1200); ok((await pg.evaluate(()=>window.scrollY))<5,'tapping Home while on Home scrolls back to the top');
 await pg.evaluate(()=>window.scrollTo(0,900)); await pg.tap('.top .logo'); await pg.waitForTimeout(1200); ok((await pg.evaluate(()=>window.scrollY))<5,'tapping the logo while on Home scrolls to the top');
 await pg.evaluate(()=>window.scrollTo(0,900)); await pg.tap('.mobile-menu-trigger'); await pg.tap('.drawer-links button:has-text("Home")'); await pg.waitForTimeout(1200); ok((await pg.evaluate(()=>window.scrollY))<5&&await pg.locator('.nav.drawer').count()===0,'the menu Home closes the menu and scrolls to the top');
 await pg.tap('.mobile-bottom-nav button:has-text("Menu")'); await pg.waitForTimeout(500); await pg.tap('.mobile-bottom-nav button:has-text("Home")'); await pg.waitForTimeout(600); ok(new URL(pg.url()).pathname==='/','from another page Home still navigates');
 // admin: tapping the screen you are on scrolls to top
 await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
 await pg.tap('.mobile-bottom-nav button:has-text("Orders")'); await pg.waitForTimeout(600); await pg.evaluate(()=>window.scrollTo(0,300)); await pg.tap('.mobile-bottom-nav button:has-text("Orders")'); await pg.waitForTimeout(1000); ok(new URL(pg.url()).searchParams.get('screen')==='orders','the admin Orders tab keeps the screen');
 await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
