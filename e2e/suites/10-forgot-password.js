// Browser suite: 10-forgot-password. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'/api/v1', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=(m)=>fetch(CTRL+'/__mode',{method:'POST',body:JSON.stringify({mailOff:false,...(m||{})})});
const flag=(q)=>fetch(CTRL+'/__flag?'+q);
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
async function call(path,{method='GET',token,body}={}){const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null}}
const last=()=>fetch(CTRL+'/__lastreset').then(r=>r.json());
async function mk(b){const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));await ctx.addInitScript(()=>{if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');}});const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));return pg}
(async()=>{
 const b=await chromium.launch(); await mode({}); await flag('mailOff=0');
 await call('/auth/register',{method:'POST',body:{name:'Thandi Mokoena',email:'thandi@example.com',phone:'074 123 4567',password:'a-long-enough-pass',acceptedTerms:true}});
 // 1. the link only shows when the API can send email
 await flag('mailOff=1'); let pg=await mk(b); await pg.goto(UI+'/account'); await pg.waitForSelector('input[name=email]'); await pg.waitForTimeout(500);
 ok(await pg.locator('button:has-text("Forgot your password?")').count()===0,'no "Forgot your password?" while the API cannot send email');
 await flag('mailOff=0'); pg=await mk(b); await pg.goto(UI+'/account'); await pg.waitForSelector('button:has-text("Forgot your password?")');
 ok(true,'"Forgot your password?" shows when the API can send email');
 // 2. the forgot form
 await pg.click('button:has-text("Forgot your password?")'); await pg.waitForSelector('button:has-text("Send me a reset link")');
 ok((await pg.locator('.auth-head h1').textContent()).includes('Forgot your password?'),'the screen is titled "Forgot your password?"');
 await pg.fill('input[name=email]','not-an-email'); await pg.click('button:has-text("Send me a reset link")'); await pg.waitForSelector('p.error');
 ok((await pg.locator('p.error').textContent()).includes('valid email')&&(await last())===null,'a bad address is refused before any request');
 await pg.fill('input[name=email]','nobody@example.com'); await pg.click('button:has-text("Send me a reset link")'); await pg.waitForSelector('.success-alert');
 const unknownText=(await pg.locator('.success-alert').textContent()).replace(/\s+/g,' ');
 ok(unknownText.includes('If there is an account for nobody@example.com')&&(await last())===null,'an unknown address gets the same friendly answer and no email is sent');
 await pg.click('button:has-text("Back to sign in")'); await pg.click('button:has-text("Forgot your password?")'); await pg.fill('input[name=email]','thandi@example.com'); await pg.click('button:has-text("Send me a reset link")'); await pg.waitForSelector('.success-alert');
 ok((await pg.locator('.success-alert').textContent()).replace(/\s+/g,' ').includes('If there is an account for thandi@example.com')&&(await last())?.email==='thandi@example.com','a real address gets the identical answer, and the API made a link');
 // 3. the reset page
 const { token } = await last();
 pg=await mk(b); await pg.goto(UI+'/reset-password'); await pg.waitForSelector('.reset-panel');
 ok((await pg.locator('.reset-panel').textContent()).includes('needs the link from your reset email'),'without a token the page explains where it must be opened from');
 pg=await mk(b); await pg.goto(UI+'/reset-password?token='+token); await pg.waitForSelector('input[name=newPassword]');
 await pg.waitForFunction(()=>!location.search.includes('token')); ok(true,'the one-time token is removed from the address bar');
 ok(await pg.locator('.password-toggle').count()===2,'both password boxes have Show/Hide');
 await pg.fill('input[name=newPassword]','short'); await pg.fill('input[name=confirmPassword]','short'); await pg.click('button:has-text("Change password")'); await pg.waitForSelector('p.error');
 ok((await pg.locator('p.error').textContent()).includes('12 to 128'),'a short password is explained');
 await pg.fill('input[name=newPassword]','brand-new-long-pass'); await pg.fill('input[name=confirmPassword]','different-long-pass'); await pg.click('button:has-text("Change password")');
 await pg.waitForFunction(()=>document.querySelector('p.error')?.textContent.includes('do not match')); ok(true,'mismatching passwords are caught');
 const signedIn=(await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}})).body;
 await pg.fill('input[name=confirmPassword]','brand-new-long-pass'); await pg.click('button:has-text("Change password")'); await pg.waitForSelector('.success-text');
 ok((await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'brand-new-long-pass'}})).status===200&&(await call('/auth/login',{method:'POST',body:{email:'thandi@example.com',password:'a-long-enough-pass'}})).status===401,'the new password works and the old one does not');
 ok((await call('/me',{token:signedIn.token})).status===401,'an existing sign-in was ended by the reset');
 await pg.click('button:has-text("Sign in")'); await pg.waitForSelector('input[name=email]'); ok(pg.url().endsWith('/account'),'"Sign in" leads to the sign-in page');
 // 4. the same link cannot be used again
 pg=await mk(b); await pg.goto(UI+'/reset-password?token='+token); await pg.waitForSelector('input[name=newPassword]');
 await pg.fill('input[name=newPassword]','yet-another-long-pass'); await pg.fill('input[name=confirmPassword]','yet-another-long-pass'); await pg.click('button:has-text("Change password")'); await pg.waitForSelector('p.error');
 ok((await pg.locator('p.error').textContent()).includes('invalid or has expired'),'a used link says it is invalid or expired and how to get a new one');
 // 5. sign in with the new password through the UI
 pg=await mk(b); await pg.goto(UI+'/account'); await pg.fill('input[name=email]','thandi@example.com'); await pg.fill('input[name=password]','brand-new-long-pass'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.profile-pane');
 ok(true,'signing in with the new password works in the app');
 // 6. privacy text mentions email
 await pg.goto(UI+'/privacy'); await pg.waitForSelector('.legal-body h2'); const pr=await pg.locator('.legal-body').textContent();
 ok(pr.includes('reset your password')&&pr.includes('email service that delivers our messages'),'the privacy notice mentions the emails and the email service');
 for(const p of [pg]) if(p.errs.length) console.log('page errors',p.errs);
 await b.close();
})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
