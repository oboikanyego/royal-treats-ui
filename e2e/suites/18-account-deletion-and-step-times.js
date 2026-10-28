// Browser suite: 18-account-deletion-and-step-times. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307'), CTRL=(process.env.API_URL||'http://localhost:3000'), API=CTRL+'/api/v1';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
const when=new Date(Date.now()+2*864e5).toISOString().slice(0,10);
const place=(token,key,recipient='Lerato')=>call('/orders',{method:'POST',token,headers:{'idempotency-key':key},body:{fulfillment:'collection',date:when,time:'12:00',notes:'Please write Happy Birthday',items:[{productId:'donuts',variant:'12 donuts',qty:1,sauce:'Chocolate',topping:'Oreo',recipient}]}});
const advance=(id,status)=>fetch(CTRL+'/__advance?id='+id+'&status='+encodeURIComponent(status));
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 const mk=async(w=1280,h=900)=>{const ctx=await b.newContext({viewport:{width:w,height:h}}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage(); pg.setDefaultTimeout(12000); return {ctx,pg}};
 const signIn=async(pg,email,password)=>{await pg.goto(UI+'/account'); await pg.fill('input[name=email]',email); await pg.fill('input[name=password]',password); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.workspace-sidebar, .profile-pane');};
 const reg=(email)=>call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email,phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}}).then(r=>r.body);
 const admin=(await call('/auth/login',{method:'POST',body:{email:'admin@royaltreats.test',password:'AdminPass-12345'}})).body;
 const c=await reg('thandi@example.com');
 let {ctx,pg}=await mk();
 // ---- step times on My orders ----
 const o1=(await place(c.token,'steps-order-key-1')).body;
 for(const s of ['Confirmed','Preparing','Ready for Collection']) await advance(o1.id,s);
 const o2=(await place(c.token,'steps-order-key-2')).body; await advance(o2.id,'Cancelled');
 await signIn(pg,'thandi@example.com','a-long-enough-pass'); await pg.goto(UI+'/orders'); await pg.waitForSelector('.my-order');
 const cards=await pg.locator('.my-order').allInnerTexts();
 const active=cards.find(t=>t.includes('Ready for Collection')&&!t.includes('cancelled'));
 ok(!!active&&(active.match(/\d{1,2} [A-Z][a-z]{2}, \d\d:\d\d/g)||[]).length>=4,'each step an order has reached shows the time it happened');
 const steps=await pg.locator('.my-order:has-text("Ready for Collection") .timeline > div').allInnerTexts();
 ok(steps.length>=4&&steps.filter((t)=>/\d\d:\d\d/.test(t)).length>=4,'the times sit inside the timeline, one per reached step');
 const cancelled=cards.find(t=>t.includes('This order was cancelled'));
 ok(!!cancelled&&/Cancelled \d{1,2} [A-Z][a-z]{2}, \d\d:\d\d/.test(cancelled),'a cancelled order says when it was cancelled');
 ok(((await call('/orders?limit=50',{token:c.token})).body.items.find((o)=>o.id===o1.id).history||[]).every((h)=>!('actorId' in h)&&h.at),'the customer is not sent who moved the order along');
 // ---- delete my account ----
 await pg.goto(UI+'/account'); await pg.waitForSelector('.profile-pane'); await pg.click('.role-user button:has-text("My account")'); await pg.waitForSelector('rt-account-settings');
 ok(await pg.locator('.delete-panel').count()===1,'a customer sees "Delete my account"');
 ok((await pg.locator('.delete-panel').innerText()).includes('We keep those orders'),'it says what is deleted and what is kept');
 ok(await pg.locator('.delete-panel input').count()===0,'no password box until they ask to delete');
 await pg.click('.delete-panel button:has-text("Delete my account")'); await pg.waitForSelector('.delete-panel input');
 await pg.fill('.delete-panel input','a-wrong-password-1'); await pg.click('.delete-panel button.danger'); await pg.waitForSelector('.delete-panel .alert.error');
 ok((await pg.locator('.delete-panel .alert.error').innerText()).includes('That password is not right'),'a wrong password is refused with a clear message');
 await pg.fill('.delete-panel input','a-long-enough-pass'); await pg.click('.delete-panel button.danger'); await pg.waitForSelector('.delete-panel .alert.error:has-text("orders in progress")');
 ok(true,'an order still in progress blocks deleting, and says why');
 ok((await call('/me',{token:c.token})).status===200,'the account is still there');
 await pg.click('.delete-panel button:has-text("Keep my account")'); await pg.waitForTimeout(200);
 ok(await pg.locator('.delete-panel input').count()===0,'"Keep my account" closes the confirmation');
 await advance(o1.id,'Completed');
 await pg.click('.delete-panel button:has-text("Delete my account")'); await pg.fill('.delete-panel input','a-long-enough-pass'); await pg.click('.delete-panel button.danger');
 await pg.waitForSelector('.flash-banner'); await pg.waitForTimeout(300);
 ok((await pg.locator('.flash-banner').innerText()).includes('Your account was deleted'),'after deleting, a message confirms it');
 ok(new URL(pg.url()).pathname==='/','and the customer is back on the home page');
 ok(await pg.evaluate(()=>!localStorage.getItem('royal-api-session')&&!sessionStorage.getItem('royal-api-session')),'the sign-in is gone from the browser');
 ok((await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}})).status===401,'the old email and password no longer sign in');
 ok((await call('/me',{token:c.token})).status===401,'the old token no longer works');
 const kept=(await call('/orders?limit=50',{token:admin.token})).body.items.find((o)=>o.id===o1.id);
 ok(kept&&kept.customer==='Deleted customer'&&kept.phone===''&&kept.notes===''&&kept.items[0].recipient===''&&kept.totalCents>0&&kept.items[0].name==='Mini Donuts','the kept order has no personal details but still shows what was sold and for how much');
 await pg.click('.flash-banner button'); await pg.waitForTimeout(200); ok(await pg.locator('.flash-banner').count()===0,'the message can be dismissed');
 await ctx.close();
 // ---- staff accounts do not get the section ----
 ({ctx,pg}=await mk()); await signIn(pg,'admin@royaltreats.test','AdminPass-12345'); await pg.click('.sidebar-navigation button:has-text("My account")'); await pg.waitForSelector('rt-account-settings');
 ok(await pg.locator('.delete-panel').count()===0,'an admin is not offered "Delete my account"');
 ok((await call('/me/delete',{method:'POST',token:admin.token,body:{password:'AdminPass-12345'}})).status===403,'and the API refuses it for staff');
 await ctx.close(); await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' | '));process.exit(1)});
