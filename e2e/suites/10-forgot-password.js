// Browser suite: 10-forgot-password. Forgotten passwords are requests an admin approves (no email). Runs against the mock API (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'/api/v1', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify({mailOff:false,...(m||{})})});
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
async function call(path,{method='GET',token,body}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
const login=(email,password)=>call('/auth/login',{method:'POST',body:{email,password}});
async function mk(b,w=1280,h=900){const ctx=await b.newContext({viewport:{width:w,height:h}});await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));await ctx.addInitScript(()=>{if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');}});const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));return pg}
const OLD='a-long-enough-pass', NEW='brand-new-long-pass';
(async()=>{
 const b=await chromium.launch(); await mode({mailOff:true});
 await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:OLD,acceptedTerms:true}});
 const adminTok=(await login('admin@royaltreats.test','AdminPass-12345')).body.token;
 // 1. the link shows even though the API cannot send email
 let pg=await mk(b); await pg.goto(UI+'/account'); await pg.waitForSelector('button:has-text("Forgot your password?")');
 ok(true,'"Forgot your password?" shows with email switched off');
 await pg.click('button:has-text("Forgot your password?")'); await pg.waitForSelector('button:has-text("Ask the shop to change it")');
 ok((await pg.locator('.auth-head h1').textContent()).includes('Forgot your password?'),'the screen is titled "Forgot your password?"');
 ok(await pg.locator('.password-toggle').count()===2,'both new-password boxes have Show/Hide');
 ok(await pg.locator('.shop-call').count()===0,'no phone line while the shop has not set a number');
 // 2. checks before anything is sent
 await pg.fill('input[name=email]','not-an-email'); await pg.click('button:has-text("Ask the shop to change it")'); await pg.waitForSelector('p.error');
 ok((await pg.locator('p.error').textContent()).includes('valid email'),'a bad address is refused');
 await pg.fill('input[name=email]','thandi@example.com'); await pg.fill('input[name=newPassword]','short'); await pg.fill('input[name=confirmPassword]','short'); await pg.click('button:has-text("Ask the shop to change it")');
 await pg.waitForSelector('p.error:has-text("12 to 128")'); ok(true,'a short password is explained');
 await pg.fill('input[name=newPassword]',NEW); await pg.fill('input[name=confirmPassword]','different-long-pass'); await pg.click('button:has-text("Ask the shop to change it")');
 await pg.waitForSelector('p.error:has-text("do not match")'); ok(true,'mismatching passwords are caught');
 ok((await call('/admin/password-requests',{token:adminTok})).body.items.length===0,'nothing was sent for any of those');
 // 3. an unknown address and a real one get the identical answer
 await pg.fill('input[name=email]','nobody@example.com'); await pg.fill('input[name=confirmPassword]',NEW); await pg.click('button:has-text("Ask the shop to change it")'); await pg.waitForSelector('.success-alert');
 const unknown=(await pg.locator('.success-alert').textContent()).replace(/\s+/g,' ').replace('nobody@example.com','X');
 ok((await call('/admin/password-requests',{token:adminTok})).body.items.length===0,'an unknown address creates no request');
 pg=await mk(b); await pg.goto(UI+'/account'); await pg.click('button:has-text("Forgot your password?")'); await pg.fill('input[name=email]','thandi@example.com'); await pg.fill('input[name=newPassword]',NEW); await pg.fill('input[name=confirmPassword]',NEW); await pg.click('button:has-text("Ask the shop to change it")'); await pg.waitForSelector('.success-alert');
 const known=(await pg.locator('.success-alert').textContent()).replace(/\s+/g,' ').replace('thandi@example.com','X');
 ok(known===unknown&&known.includes('Until then your old password still works'),'a real address gets the identical answer');
 ok((await login('thandi@example.com',OLD)).status===200&&(await login('thandi@example.com',NEW)).status===401,'nothing changed yet: the old password still works, the new one does not');
 // 4. the admin sees the request, never the password
 const list=(await call('/admin/password-requests',{token:adminTok})).body.items;
 ok(list.length===1&&list[0].email==='thandi@example.com'&&!JSON.stringify(list).includes(NEW),'the admin API lists the request without any password');
 pg=await mk(b); await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")');
 await pg.waitForSelector('.password-requests .pw-request');
 ok((await pg.locator('.sidebar-navigation button:has-text("Overview") .pending-count').innerText())==='1','the Overview menu shows a badge with the number of waiting requests');
 const card=(await pg.locator('.pw-request').textContent()).replace(/\s+/g,' ');
 ok(card.includes('Thandi Mokoena')&&card.includes('thandi@example.com')&&card.includes('074 123 4567')&&!card.includes(NEW),'the overview shows who is asking (name, email, phone) and never the password');
 // 5. decline leaves the password alone
 await pg.click('.pw-request button:has-text("Decline")'); await pg.waitForSelector('.password-requests .success-alert');
 ok((await pg.locator('.password-requests .success-alert').textContent()).includes('declined')&&(await pg.locator('.pw-request').count())===0,'declining removes the request');
 ok(await pg.locator('.sidebar-navigation button:has-text("Overview") .pending-count').count()===0,'the badge goes away when none are waiting');
 ok((await login('thandi@example.com',OLD)).status===200,'after declining the old password still works');
 // 6. approve needs a second tap, then the password changes everywhere
 const signedIn=(await login('thandi@example.com',OLD)).body;
 let pg2=await mk(b); await pg2.goto(UI+'/account'); await pg2.click('button:has-text("Forgot your password?")'); await pg2.fill('input[name=email]','thandi@example.com'); await pg2.fill('input[name=newPassword]',NEW); await pg2.fill('input[name=confirmPassword]',NEW); await pg2.click('button:has-text("Ask the shop to change it")'); await pg2.waitForSelector('.success-alert');
 await pg.reload(); await pg.waitForSelector('.pw-request');
 await pg.click('.pw-request button:has-text("Approve")'); await pg.waitForSelector('.pw-request button:has-text("Yes, change the password")');
 ok((await login('thandi@example.com',NEW)).status===401,'the first tap on Approve only asks "have you checked"');
 await pg.click('.pw-request button:has-text("Not yet")'); ok(await pg.locator('.pw-request button:has-text("Approve")').count()===1,'"Not yet" goes back');
 await pg.click('.pw-request button:has-text("Approve")'); await pg.click('.pw-request button:has-text("Yes, change the password")'); await pg.waitForSelector('.password-requests .success-alert');
 ok((await pg.locator('.password-requests .success-alert').textContent()).includes('can now sign in')&&(await pg.locator('.pw-request').count())===0,'approving says so and clears the request');
 ok((await login('thandi@example.com',NEW)).status===200&&(await login('thandi@example.com',OLD)).status===401,'the new password works and the old one does not');
 ok((await call('/me',{token:signedIn.token})).status===401,'an existing sign-in was ended by the approval');
 // 7. the customer signs in with it
 pg2=await mk(b); await pg2.goto(UI+'/account'); await pg2.fill('input[name=email]','thandi@example.com'); await pg2.fill('input[name=password]',NEW); await pg2.click('button.primary:has-text("Sign in")'); await pg2.waitForSelector('.profile-pane');
 ok(true,'signing in with the new password works in the app');
 // 8. staff accounts cannot be taken over this way
 const staff=await call('/auth/password-requests',{method:'POST',body:{email:'admin@royaltreats.test',newPassword:NEW}});
 ok(staff.status===202&&(await call('/admin/password-requests',{token:adminTok})).body.items.length===0,'a request for an admin account is accepted quietly and creates nothing');
 // 8b. the shop's phone number appears once the admin sets it (and is cleared again)
 const settingsNow=(await call('/settings')).body;
 const put=(extra)=>call('/admin/settings',{method:'PUT',token:adminTok,body:{storeName:settingsNow.storeName,address:settingsNow.address,supportEmail:settingsNow.supportEmail,open:settingsNow.open,close:settingsNow.close,latitude:settingsNow.latitude??null,longitude:settingsNow.longitude??null,...extra}});
 ok((await put({supportPhone:'call me'})).status===400,'the API refuses a shop phone that is not a number');
 ok((await put({supportPhone:'014 123 4567'})).status===200,'the admin can set the shop phone');
 let fp=await mk(b); await fp.goto(UI+'/account'); await fp.click('button:has-text("Forgot your password?")'); await fp.waitForSelector('.shop-call');
 ok((await fp.locator('.shop-call a').getAttribute('href'))==='tel:0141234567'&&(await fp.locator('.shop-call').textContent()).includes('014 123 4567'),'the form shows the shop number as a tap-to-call link');
 await fp.fill('input[name=email]','thandi@example.com'); await fp.fill('input[name=newPassword]',NEW); await fp.fill('input[name=confirmPassword]',NEW); await fp.click('button:has-text("Ask the shop to change it")'); await fp.waitForSelector('.success-alert');
 ok((await fp.locator('.success-alert a').getAttribute('href'))==='tel:0141234567','the thank-you message offers the number too');
 await put({supportPhone:''}); fp=await mk(b); await fp.goto(UI+'/account'); await fp.click('button:has-text("Forgot your password?")'); await fp.waitForSelector('input[name=newPassword]');
 ok(await fp.locator('.shop-call').count()===0,'clearing the number hides the line again');
 // admin Settings field
 await pg.click('.sidebar-navigation button:has-text("Settings")'); await pg.waitForSelector('input[name=supportPhone]');
 await pg.fill('input[name=supportPhone]','082 000 1111'); await pg.click('rt-admin-settings button.primary'); await pg.waitForSelector('rt-admin-settings .success-alert');
 ok((await call('/settings')).body.supportPhone==='082 000 1111','the admin Settings screen saves the shop phone');
 await pg.fill('input[name=supportPhone]','abc'); await pg.click('rt-admin-settings button.primary'); await pg.waitForSelector('rt-admin-settings .alert.error');
 ok((await call('/settings')).body.supportPhone==='082 000 1111','a bad number is refused and nothing changes');
 // 9. phone: the form and the admin card fit the screen
 const ph=await mk(b,390,844); await ph.goto(UI+'/account'); await ph.click('button:has-text("Forgot your password?")'); await ph.waitForSelector('input[name=newPassword]');
 ok(await ph.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'the form has no sideways scroll on a phone');
 // 9b. the badge shows on a phone tab and in the menu
 await call('/auth/password-requests',{method:'POST',body:{email:'thandi@example.com',newPassword:NEW}});
 const ap=await mk(b,390,844); await ap.goto(UI+'/account'); await ap.fill('input[name=email]','admin@royaltreats.test'); await ap.fill('input[name=password]','AdminPass-12345'); await ap.click('button.primary:has-text("Sign in")');
 await ap.waitForSelector('.appbar-tabs .tab-badge');
 ok((await ap.locator('.appbar-tabs button:has-text("Overview") .tab-badge').innerText())==='1','on a phone the Overview tab shows the badge');
 // 10. privacy text
 await pg.goto(UI+'/privacy'); await pg.waitForSelector('.legal-body h2'); const pr=await pg.locator('.legal-body').textContent();
 ok(pr.includes('ask us for a new one')&&pr.includes('nobody at the shop can read it'),'the privacy notice explains password requests');
 for(const p of [pg,pg2,ph]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
