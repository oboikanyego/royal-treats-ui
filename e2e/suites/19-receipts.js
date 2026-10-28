// Browser suite: 19-receipts. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307'), CTRL=(process.env.API_URL||'http://localhost:3000'), API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}return{status:r.status,body:j,text:t,headers:r.headers}}
const when=new Date(Date.now()+2*864e5).toISOString().slice(0,10);
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 const mk=async(w=1280,h=900)=>{const ctx=await b.newContext({viewport:{width:w,height:h}}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage(); pg.setDefaultTimeout(12000); return {ctx,pg}};
 const signIn=async(pg,email,password)=>{await pg.goto(UI+'/account'); await pg.fill('input[name=email]',email); await pg.fill('input[name=password]',password); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.workspace-sidebar, .profile-pane');};
 const admin=(await call('/auth/login',{method:'POST',body:{email:'admin@royaltreats.test',password:'AdminPass-12345'}})).body;
 const c=(await call('/auth/register',{method:'POST',body:{name:'Thandi <b>Mokoena</b>',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 const order=(await call('/orders',{method:'POST',token:c.token,headers:{'idempotency-key':'receipt-order-key-1'},body:{fulfillment:'collection',date:when,time:'12:00',notes:'Please write <i>Happy</i> Birthday',items:[{productId:'donuts',variant:'12 donuts',qty:2,sauce:'Chocolate',topping:'Oreo',recipient:'Lerato'}]}})).body;
 // ---- customer ----
 let {ctx,pg}=await mk();
 await signIn(pg,'thandi@example.com','a-long-enough-pass'); await pg.goto(UI+'/orders'); await pg.waitForSelector('.my-order');
 await pg.click('.my-order button:has-text("Print receipt")'); await pg.waitForSelector('.receipt-frame');
 const frame=pg.frameLocator('.receipt-frame');
 await frame.locator('h2').first().waitFor();
 const text=await frame.locator('body').innerText();
 ok(text.includes('Order RT-')&&text.includes('Royal Treats')&&text.includes('Mini Donuts')&&text.includes('R100'),'the receipt shows the shop, the order reference, the items and the total');
 ok(text.includes('Thandi <b>Mokoena</b>')&&text.includes('Please write <i>Happy</i> Birthday'),'customer text appears as text, not as markup');
 ok(await frame.locator('b, i').count()===0||!(await frame.locator('dd b').count()),'no markup was injected into the receipt');
 const sandbox=await pg.locator('.receipt-frame').getAttribute('sandbox');
 ok(sandbox.includes('allow-same-origin')&&!sandbox.includes('allow-scripts'),'the receipt frame cannot run scripts');
 ok((await pg.locator('.receipt-sheet header h2').innerText()).startsWith('Receipt RT-'),'the sheet is titled with the order reference');
 await pg.evaluate(()=>{const w=document.querySelector('.receipt-frame').contentWindow; w.__printed=0; w.print=()=>{w.__printed++}});
 await pg.click('.receipt-sheet .receipt-foot button:has-text("Print")');
 ok(await pg.evaluate(()=>document.querySelector('.receipt-frame').contentWindow.__printed)===1,'"Print or save as PDF" prints the receipt');
 await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
 if(await pg.locator('.receipt-sheet').count()) await pg.click('.receipt-sheet .receipt-foot button:has-text("Close")');
 await pg.waitForTimeout(200); ok(await pg.locator('.receipt-sheet').count()===0,'Close closes the sheet');
 await ctx.close();
 // ---- admin: print from an order, then edit the template ----
 ({ctx,pg}=await mk()); await signIn(pg,'admin@royaltreats.test','AdminPass-12345');
 await pg.click('.sidebar-navigation button:has-text("Orders")'); await pg.waitForSelector('.order-card');
 await pg.click('.order-card button:has-text("Print receipt")'); await pg.waitForSelector('.receipt-frame'); ok((await pg.frameLocator('.receipt-frame').locator('body').innerText()).includes('Order RT-'),'an admin can print any order from its card');
 await pg.click('.receipt-sheet .receipt-foot button:has-text("Close")');
 await pg.click('.sidebar-navigation button:has-text("Settings")'); await pg.waitForSelector('rt-admin-receipt textarea');
 ok((await pg.locator('.receipt-tag').innerText())==='Default','Settings shows the receipt template, marked Default');
 ok((await pg.locator('rt-admin-receipt textarea').inputValue()).includes('{{shop.name}}'),'it is the seeded Handlebars template');
 await pg.click('.receipt-values summary'); ok((await pg.locator('.receipt-values li').count())>=10&&(await pg.locator('.receipt-values').innerText()).includes('{{order.ref}}'),'the values you can use are listed');
 await pg.fill('rt-admin-receipt textarea','<h1>{{shop.name}}</h1><p>{{{customer.name}}}</p>'); await pg.click('rt-admin-receipt button:has-text("Save template")'); await pg.waitForSelector('rt-admin-receipt .alert.error');
 ok((await pg.locator('rt-admin-receipt .alert.error').innerText()).includes('raw output is not allowed'),'raw output is refused with the API\'s plain-language message');
 await pg.fill('rt-admin-receipt textarea','<p>{{#if x}}</p>'); await pg.click('rt-admin-receipt button:has-text("Save template")'); await pg.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelector('rt-admin-receipt .alert.error')?.textContent.includes('problem'));
 ok(true,'a template that does not compile is refused');
 await pg.fill('rt-admin-receipt textarea','<h1>Thanks, {{customer.name}}!</h1><p>{{order.ref}} · {{totals.total}}</p>');
 ok((await pg.locator('rt-admin-receipt').innerText()).includes('changes that are not saved'),'unsaved changes are flagged');
 await pg.click('rt-admin-receipt button:has-text("Preview")'); await pg.waitForSelector('.receipt-frame');
 ok((await pg.frameLocator('.receipt-frame').locator('body').innerText()).includes('Thanks, Thandi Mokoena!'),'Preview shows the template on a sample order');
 ok((await call('/admin/templates/receipt',{token:admin.token})).body.customised===false,'previewing saves nothing');
 await pg.click('.receipt-sheet .receipt-foot button:has-text("Close")');
 await pg.click('rt-admin-receipt button:has-text("Save template")'); await pg.waitForSelector('rt-admin-receipt .success-alert');
 ok((await pg.locator('.receipt-tag').innerText())==='Customised'&&(await call('/admin/templates/receipt',{token:admin.token})).body.customised===true,'saving marks it Customised on the API');
 const printed=(await call('/orders/'+order.id+'/receipt',{token:c.token}));
 ok(printed.status===200&&/text\/html/.test(printed.headers.get('content-type'))&&printed.text.includes('Thanks, Thandi &lt;b&gt;Mokoena&lt;/b&gt;!'),'the customer\'s receipt now uses the new template, with their name escaped');
 await pg.click('rt-admin-receipt button:has-text("Back to the default")'); await pg.click('rt-admin-receipt button:has-text("Yes, use the default")'); await pg.waitForSelector('rt-admin-receipt .success-alert');
 ok((await pg.locator('.receipt-tag').innerText())==='Default'&&(await pg.locator('rt-admin-receipt textarea').inputValue()).includes('{{shop.name}}'),'"Back to the default" restores the seeded template');
 await ctx.close();
 // ---- not found / phone ----
 ({ctx,pg}=await mk(390,844)); await signIn(pg,'thandi@example.com','a-long-enough-pass'); await pg.goto(UI+'/orders'); await pg.waitForSelector('.my-order'); await pg.tap?.call(pg,'.my-order button:has-text("Print receipt")').catch(()=>pg.click('.my-order button:has-text("Print receipt")')); await pg.waitForSelector('.receipt-sheet');
 const box=await pg.locator('.receipt-sheet').boundingBox(); ok(box.width>=389&&box.height>=843,'on a phone the receipt fills the screen');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth),'with no sideways scroll');
 await ctx.close(); await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
