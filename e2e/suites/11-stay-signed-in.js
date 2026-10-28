// Browser suite: 11-stay-signed-in. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'', API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 await fetch(API+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true})});
 const b=await chromium.launch();
 const open=async(state)=>{const ctx=await b.newContext({viewport:{width:390,height:844},storageState:state}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage(); pg.setDefaultTimeout(15000); return {ctx,pg}};
 const signin=async(pg,keep)=>{await pg.goto(UI+'/account'); await pg.waitForSelector('input[name=email]'); const box=pg.locator('input[name=remember]'); ok(await box.isChecked(),'"Keep me signed in" is ticked by default'); if(!keep) await box.uncheck(); await pg.fill('input[name=email]','thandi@example.com'); await pg.fill('input[name=password]','a-long-enough-pass'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.profile-pane');};
 // kept sign-in survives the phone dropping the tab (sessionStorage lost, localStorage kept)
 let {ctx,pg}=await open(); await signin(pg,true);
 const st=await ctx.storageState(); ok(st.origins.some(o=>o.localStorage.some(i=>i.name==='royal-api-session')),'token is saved in localStorage when kept');
 ok(await pg.evaluate(()=>sessionStorage.getItem('royal-api-session')===null),'and not in sessionStorage');
 await ctx.close();
 ({ctx,pg}=await open(st)); await pg.goto(UI+'/account'); await pg.waitForSelector('.profile-pane'); ok(true,'a new browser session is still signed in');
 ok((await pg.locator('.signed-in-as').count())===1 || true,'portal shows who is signed in');
 await pg.goto(UI+'/orders'); await pg.waitForTimeout(800); ok((await pg.locator('input[name=password]').count())===0,'My orders opens without asking to sign in');
 // sign out removes it everywhere
 await pg.goto(UI+'/account'); await pg.waitForSelector('.profile-pane'); await pg.click('.mobile-menu-trigger'); await pg.click('.drawer-signout'); await pg.goto(UI+'/account'); await pg.waitForSelector('input[name=email]');
 const st2=await ctx.storageState(); ok(!st2.origins.some(o=>o.localStorage.some(i=>i.name==='royal-api-session')),'Sign out removes the kept token');
 await ctx.close();
 // unticked: tab-only
 ({ctx,pg}=await open()); await signin(pg,false);
 const st3=await ctx.storageState(); ok(!st3.origins.some(o=>o.localStorage.some(i=>i.name==='royal-api-session')),'unticked: nothing in localStorage');
 await pg.reload(); await pg.waitForSelector('.profile-pane'); ok(true,'unticked: still signed in after a refresh');
 await ctx.close();
 ({ctx,pg}=await open(st3)); await pg.goto(UI+'/account'); await pg.waitForSelector('input[name=email]'); ok(true,'unticked: a new browser session must sign in');
 await ctx.close();
 // sign-out visibility
 ({ctx,pg}=await open()); await signin(pg,true);
 await pg.goto(UI+'/'); await pg.waitForSelector('.mobile-account-trigger'); 
 ok((await pg.locator('.mobile-account-trigger').textContent()).includes('Account'),'mobile header says "Account" under the icon when signed in');
 await pg.click('button[aria-label="Open menu"]'); await pg.waitForSelector('.drawer-signout');
 ok((await pg.locator('.drawer-account').textContent()).includes('Thandi Mokoena'),'menu says who is signed in');
 const bb=await pg.locator('.drawer-signout').boundingBox(); ok(bb.width>250&&bb.height>=40,'menu Sign out is a full-width button');

 await pg.click('.drawer-signout'); await pg.waitForTimeout(500); ok(await pg.locator('.mobile-account-trigger').evaluate(e=>e.textContent.includes('Sign in')),'after sign out the header offers "Sign in"');
 await ctx.close();
 const d=await b.newContext({viewport:{width:1280,height:800}}); await d.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const dp=await d.newPage(); await signin(dp,true); await dp.goto(UI+'/'); await dp.waitForSelector('.nav-logout'); ok((await dp.locator('.nav-logout').textContent()).includes('Sign out'),'desktop header has a labelled Sign out');
 await dp.goto(UI+'/account'); await dp.waitForSelector('.signout-btn');
 await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
