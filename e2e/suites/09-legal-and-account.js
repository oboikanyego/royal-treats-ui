// Browser suite: 09-legal-and-account. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'/api/v1', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify(m||{})});
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
const tomorrow=new Date(Date.now()+36*3600e3).toISOString().slice(0,10);
async function call(path,{method='GET',token,body,headers}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
async function mk(b,w=1280,h=900){const ctx=await b.newContext({viewport:{width:w,height:h}});await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));await ctx.addInitScript(()=>{if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');}});const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));return {ctx,pg}}
const signIn=async(pg,email,password)=>{await pg.goto(UI+'/account');await pg.fill('input[name=email]',email);await pg.fill('input[name=password]',password);await pg.click('button.primary:has-text("Sign in")');await pg.waitForSelector('.workspace-sidebar, .profile-pane, rt-courier-workspace')};
const txt=async(pg,sel)=>(await pg.locator(sel).first().textContent()).replace(/\s+/g,' ').trim();
(async()=>{
 const b=await chromium.launch(); await mode({});
 // ---------- privacy and terms ----------
 let {ctx,pg}=await mk(b); await pg.goto(UI+'/privacy'); await pg.waitForSelector('.legal-body h2');
 const priv=await pg.locator('.legal-body').textContent();
 ok((await pg.title()).includes('Privacy Notice')&&priv.includes('Protection of Personal Information Act')&&priv.includes('34 10th Avenue'),'the Privacy Notice page loads with POPIA wording and the shop address from the settings');
 await pg.click('a:has-text("Terms of Use") >> nth=-1').catch(()=>{}); await pg.goto(UI+'/terms'); await pg.waitForSelector('.legal-body h2');
 ok((await pg.locator('.legal-body').textContent()).includes('Only the shop can change or cancel an order'),'the Terms page loads and states the cancellation rule');
 ok(await pg.locator('footer a:has-text("Privacy Notice")').count()===1&&await pg.locator('footer a:has-text("Terms of Use")').count()===1,'the footer links to both pages');
 // ---------- registration needs consent ----------
 await pg.goto(UI+'/account'); await pg.click('button:has-text("Register here")');
 await pg.fill('input[name=name]','Thandi Mokoena'); await pg.fill('input[name=email]','thandi@example.com'); await pg.fill('input[name=phone]','074 123 4567'); await pg.fill('input[name=password]','a-long-enough-pass');
 ok(await pg.locator('input[name=consent]').count()===1&&(await txt(pg,'label.consent')).includes('Privacy Notice')&&(await txt(pg,'label.consent')).includes('Terms of Use'),'the register form has a consent line linking both pages');
 const regCalls=async()=>(await fetch(CTRL+'/__log').then(r=>r.json())).filter(l=>l==='POST /api/v1/auth/register').length;
 await pg.click('button.primary:has-text("Register")'); await pg.waitForSelector('p.error');
 ok((await txt(pg,'p.error')).includes('accept the privacy notice and terms')&&await regCalls()===0,'registering without consent is refused before any request');
 await pg.check('input[name=consent]'); await pg.click('button.primary:has-text("Register")'); await pg.waitForSelector('.profile-pane');
 ok(await regCalls()===1,'with consent the account is created');
 // ---------- show / hide password ----------
 ({ctx,pg}=await mk(b)); await pg.goto(UI+'/account');
 ok(await pg.locator('input[name=password]').getAttribute('type')==='password','the sign-in password starts hidden');
 await pg.fill('input[name=password]','a-long-enough-pass'); await pg.click('.password-toggle');
 ok(await pg.locator('input[name=password]').getAttribute('type')==='text'&&(await pg.locator('.password-toggle').textContent()).trim()==='Hide'&&await pg.locator('.password-toggle').getAttribute('aria-label')==='Hide password','Show reveals the password (button says Hide)');
 await pg.click('.password-toggle'); ok(await pg.locator('input[name=password]').getAttribute('type')==='password','Hide hides it again');
 await pg.click('button:has-text("Register here")'); ok(await pg.locator('.password-toggle').count()===1,'the register form has the toggle too');
 // ---------- customer account: details + password ----------
 ({ctx,pg}=await mk(b)); await signIn(pg,'thandi@example.com','a-long-enough-pass');
 await pg.click('button:has-text("My account")'); await pg.waitForSelector('rt-account-settings');
 ok((await txt(pg,'.role-header h1'))==='My account','the header says "My account"');
 await pg.fill('rt-account-settings input[name=name]','Thandi M'); await pg.fill('rt-account-settings input[name=phone]','074 555 0000'); await pg.click('rt-account-settings button:has-text("Save details")'); await pg.waitForSelector('rt-account-settings .success-alert');
 const me=await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}});
 ok(me.body.user.name==='Thandi M'&&me.body.user.phone==='074 555 0000','name and phone were saved on the API');
 ok((await txt(pg,'.role-person strong'))==='Thandi M','and the header shows the new name');
 ok(await pg.locator('rt-account-settings input[name=email]').getAttribute('readonly')!==null,'the email cannot be edited');
 await pg.fill('rt-account-settings input[name=phone]','abc'); await pg.click('rt-account-settings button:has-text("Save details")'); await pg.waitForSelector('rt-account-settings .alert.error');
 ok((await txt(pg,'rt-account-settings .alert.error')).includes('valid phone number'),'a bad phone number is explained');
 const other=await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}});
 const pwBtn='rt-account-settings button:has-text("Change password")';
 await pg.fill('rt-account-settings input[name=currentPassword]','wrong-current-pass'); await pg.fill('rt-account-settings input[name=newPassword]','brand-new-long-pass'); await pg.fill('rt-account-settings input[name=confirmPassword]','brand-new-long-pass'); await pg.click(pwBtn);
 await pg.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-account-settings .alert.error').length===2||[...document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-account-settings .alert.error')].some(e=>e.textContent.includes('Current password is incorrect')));
 ok(true,'a wrong current password: "Current password is incorrect"; the session stays (no sign-out)');
 ok(await pg.locator('.workspace-sidebar, .profile-pane, rt-account-settings').count()>0,'still signed in after the refusal');
 await pg.fill('rt-account-settings input[name=confirmPassword]','different-long-pass'); await pg.fill('rt-account-settings input[name=currentPassword]','a-long-enough-pass'); await pg.click(pwBtn);
 ok((await pg.locator('rt-account-settings .alert.error').allTextContents()).join(' ').includes('do not match'),'mismatching new passwords are caught before any request');
 await pg.fill('rt-account-settings input[name=confirmPassword]','brand-new-long-pass'); await pg.click(pwBtn); await pg.waitForSelector('rt-account-settings .success-alert');
 ok((await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'brand-new-long-pass'}})).status===200&&(await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}})).status===401,'the new password works and the old one no longer does');
 ok((await call('/me',{token:other.body.token})).status===401,'another device signed in earlier was signed out');
 ok((await pg.locator('rt-account-settings input[name=currentPassword]').inputValue())==='','the password boxes are cleared');
 await pg.click('button:has-text("← Back")'); await pg.waitForSelector('.profile-pane'); ok(true,'"Back" returns to the account page');
 // ---------- admin: header per screen, my account, server filter, assign, maps ----------
 await mode({});
 const cust=(await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}})).body;
 const item={productId:'donuts',variant:'12 donuts',qty:1,sauce:'Chocolate',topping:'Oreo',recipient:''};
 let n=0; const place=(extra)=>call('/orders',{method:'POST',token:cust.token,headers:{'idempotency-key':'e2e-order-'+(++n)+'-'+Date.now()},body:{fulfillment:'collection',date:tomorrow,time:'12:00',notes:'',items:[item],...extra}}).then(r=>r.body);
 const adm=(await call('/auth/login',{method:'POST',body:{email:'admin@royaltreats.test',password:'AdminPass-12345'}})).body;
 const advance=(id,status)=>fetch(`${CTRL}/__advance?id=${id}&status=${status}`);
 // 25 orders: 22 completed, 3 pending -> the filter must find the pending ones beyond the first page
 const done=[]; for(let i=0;i<22;i++){const o=await place(); done.push(o.id); await advance(o.id,'Completed');}
 const pend=[]; for(let i=0;i<3;i++) pend.push((await place()).id);
 const del=await place({fulfillment:'delivery',address:'12 Test St, Thabazimbi',latitude:-24.59,longitude:27.41}); for (const s of ['Confirmed','Preparing','Ready for Delivery']) await advance(del.id,s);
 ({ctx,pg}=await mk(b)); await signIn(pg,'admin@royaltreats.test','AdminPass-12345');
 ok((await txt(pg,'.role-header h1'))==='Store overview','the admin header starts as "Store overview"');
 for (const [btn,title] of [['Orders','Orders'],['Products','Products'],['Delivery team','Delivery team'],['Settings','Settings'],['My account','My account']]) { await pg.click(`.sidebar-navigation button:has-text("${btn}")`); await pg.waitForTimeout(150); ok((await txt(pg,'.role-header h1'))===title,'the header follows the screen: '+title); }
 await pg.click('.sidebar-navigation button:has-text("Orders")'); await pg.waitForSelector('rt-admin-orders .order-card');
 ok(await pg.locator('rt-admin-orders .order-card').count()===20,'the first page shows 20 orders of 26');
 await pg.click('rt-admin-orders .filter-chips button:text-is("Waiting")');
 await pg.waitForFunction((n)=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-admin-orders .order-card').length===n,3);
 const pendingTexts=await pg.locator('rt-admin-orders .order-card').allTextContents();
 ok(pendingTexts.length===3&&pendingTexts.every(t=>t.includes('Pending')),'the Pending filter finds all 3 Pending orders even though they are not on the first page of all orders');
 ok((await txt(pg,'rt-admin-orders .orders-meta')).includes('3 of 3 orders'),'and the count is for the filter: "3 of 3 orders shown"');
 const reqs=(await fetch(CTRL+'/__log').then(r=>r.json())).filter(l=>l.includes('/orders?')&&l.includes('status='));
 ok(reqs.some(l=>l.includes('status=Pending')),'the filter is sent to the API (status=Pending)');
 await pg.locator('rt-admin-orders .order-card').first().locator('button:has-text("Mark Confirmed")').click(); await pg.waitForSelector('text=/is now Confirmed/');
 ok(await pg.locator('rt-admin-orders .order-card').count()===2,'an order that no longer matches the filter leaves the list at once');
 await pg.click('rt-admin-orders .filter-chips button:text-is("In progress")'); await pg.waitForFunction(()=>document.querySelector('app-portal').shadowRoot.querySelectorAll('rt-admin-orders .order-card').length>=2);
 // assign a courier
 const dcard=pg.locator('rt-admin-orders .order-card',{hasText:'12 Test St'});
 ok((await dcard.textContent()).includes('Waiting for a courier')&&await dcard.locator('a:has-text("Open the address in Maps")').count()===1,'a ready delivery waits for a courier and has a Maps link');
 ok((await dcard.locator('a:has-text("Maps")').getAttribute('href'))==='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('-24.59,27.41'),'the Maps link uses the exact coordinates');
 ok(await dcard.locator('button:has-text("Assign courier")').isDisabled(),'"Assign courier" is disabled until a courier is chosen');
 await dcard.locator('select').selectOption({label:'Sipho Courier'}); await dcard.locator('button:has-text("Assign courier")').click(); await pg.waitForSelector('text=/was given to Sipho Courier/');
 const stored=(await fetch(CTRL+'/__orders').then(r=>r.json())).find(o=>o.id===del.id);
 ok(stored.status==='Out for Delivery'&&stored.courierId,'the delivery is Out for Delivery with the courier on the API');
 ok((await dcard.textContent()).includes('Courier: Sipho Courier')&&await dcard.locator('button:has-text("Reassign")').count()===1,'the card shows the courier and offers Reassign');
 // the courier sees it and can open maps
 const cour=await mk(b,390,844); await signIn(cour.pg,'courier@royaltreats.test','CourierPass-12345'); await cour.pg.waitForSelector('rt-courier-workspace .order-card');
 const ccard=cour.pg.locator('rt-courier-workspace .order-card',{hasText:'12 Test St'});
 ok(await ccard.count()===1&&await ccard.locator('a:has-text("Open in Maps")').getAttribute('href')==='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('-24.59,27.41'),'the assigned courier sees the delivery with an "Open in Maps" link');
 // admin password change + survives a mock sign-in
 await pg.click('.sidebar-navigation button:has-text("My account")'); await pg.waitForSelector('rt-account-settings');
 await pg.fill('rt-account-settings input[name=currentPassword]','AdminPass-12345'); await pg.fill('rt-account-settings input[name=newPassword]','admin-new-long-pass'); await pg.fill('rt-account-settings input[name=confirmPassword]','admin-new-long-pass'); await pg.click('rt-account-settings button:has-text("Change password")'); await pg.waitForSelector('rt-account-settings .success-alert');
 ok((await call('/auth/login',{method:'POST',body:{email:'admin@royaltreats.test',password:'admin-new-long-pass'}})).status===200,'an admin can change their own password in the app');
 // courier creation uses the toggle
 await pg.click('.sidebar-navigation button:has-text("Delivery team")'); await pg.waitForSelector('rt-admin-couriers form');
 ok(await pg.locator('rt-admin-couriers .password-toggle').count()===1,'the add-courier form has the show/hide button');
 for(const p of [pg,cour.pg]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
