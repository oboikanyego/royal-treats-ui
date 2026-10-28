// Browser suite: 02-sign-in-and-session. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', API=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
const mode=async(m)=>fetch(API+'/__mode',{method:'POST',body:JSON.stringify({delayMs:0,failNext:0,failAlways:false,bulk:false,expireTokens:false,limitAuth:false,...m})});
const reqLog=async()=>(await fetch(API+'/__log')).json();
const stub=fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'));
async function mk(b){const ctx=await b.newContext({viewport:{width:1280,height:900}});const pg=await ctx.newPage();pg.setDefaultTimeout(12000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:stub}));
 await pg.addInitScript(()=>{ if(!sessionStorage.getItem('__seen')){localStorage.setItem('royal-welcome-v1','yes');sessionStorage.setItem('__seen','1');} });
 return pg}
const token=pg=>pg.evaluate(()=>{try{return JSON.parse((localStorage.getItem('royal-api-session')||sessionStorage.getItem('royal-api-session'))).token}catch{return null}});
const headerName=async pg=>(await pg.locator('.nav-account').count())?(await pg.locator('.nav-account').innerText()).replace(/\s+/g,' ').trim():null;
async function register(pg,{name='Thandi Mokoena',email='thandi@example.com',phone='074 123 4567',password='a-long-enough-pass'}={}){
 await pg.goto(UI+'/account'); await pg.click('button:has-text("Register here")');
 await pg.fill('input[name=name]',name); await pg.fill('input[type=email]',email); await pg.fill('input[name=phone]',phone); await pg.fill('input[name=password]',password);
 await pg.check('input[name=consent]'); await pg.click('button.primary:has-text(\"Register\")'); }
(async()=>{
 const b=await chromium.launch();
 // 1. client-side checks come first; then a real registration
 await mode({}); let pg=await mk(b);
 await pg.goto(UI+'/account');
 ok(await pg.locator('text=Admin demo').count()===0,'demo admin credentials are not shown in API mode');
 await pg.click('button:has-text("Register here")');
 ok((await pg.locator('label:has-text("Password")').first().innerText()).includes('at least 12 characters'),'register form asks for 12 characters');
 await register(pg,{password:'x'.repeat(11)}); await pg.waitForSelector('text=/12 to 128 characters/');
 ok(!(await reqLog()).some(l=>l.includes('/auth/register')),'an 11-character password is refused before any request is made');
 await pg.fill('input[name=password]','a-long-enough-pass'); await pg.check('input[name=consent]'); await pg.click('button.primary:has-text(\"Register\")');
 await pg.waitForSelector('.nav-account');
 ok((await headerName(pg)).includes('Thandi Mokoena')&&(await headerName(pg)).includes('Customer'),'registered and signed in: header shows the name and role ('+await headerName(pg)+')');
 const tok=await token(pg); ok(!!tok&&tok.length===43,'token is saved on the device ('+(tok||'').length+' chars)');
 const inLocal=await pg.evaluate(t=>JSON.stringify(localStorage).includes(t),tok); ok(inLocal,'with "Keep me signed in" (default) the token is in localStorage');
 ok(await pg.locator('text=Your Royal account').count()>0&&await pg.locator('text=/up to 2 MB/').count()>0,'customer profile shows, with the API photo limit (2 MB)');
 ok(await pg.locator('h3:text-is("Your orders")').count()===0,'local demo orders list is hidden in API mode');
 ok((await reqLog()).some(l=>l==='POST /api/v1/auth/register'),'registration request was sent');
 // 2. reload keeps the session (restored with GET /me)
 await mode({}); // reset log only (users are reset too, so re-register for this step)
 pg=await mk(b); await register(pg); await pg.waitForSelector('.nav-account');
 const before=await token(pg); await pg.reload(); await pg.waitForSelector('.nav-account');
 ok((await headerName(pg)).includes('Thandi')&&(await token(pg))===before,'after a reload the session is restored from sessionStorage');
 ok((await reqLog()).some(l=>l==='GET /api/v1/me [auth]'),'restore asked the API who the token belongs to (GET /me with the bearer token)');
 ok(await pg.locator('text=Your Royal account').count()>0,'the account page shows straight away after restore (no stuck sign-in form)');
 const productsCall=(await reqLog()).filter(l=>l.includes('/products')); ok(productsCall.every(l=>true),'catalogue requests still work while signed in');
 // 3. sign out
 await pg.click('.nav-logout'); await pg.waitForSelector('.nav-signin');
 ok((await token(pg))===null,'sign out removes the token from sessionStorage');
 await pg.waitForTimeout(300); ok((await reqLog()).some(l=>l==='POST /api/v1/auth/logout [auth]'),'sign out revoked the token on the server');
 await pg.reload(); await pg.waitForSelector('.nav-signin'); ok(!(await reqLog()).slice(-3).some(l=>l.includes('/me')),'a reload after sign-out does not call /me');
 await pg.goto(UI+'/account'); await pg.waitForSelector('form button.primary:has-text("Sign in")'); ok(true,'sign-in form is shown after signing out');
 // 4. login errors and success
 await pg.fill('input[type=email]','thandi@example.com'); await pg.fill('input[type=password]','wrong-password-123'); await pg.click('form button.primary:has-text("Sign in")');
 await pg.waitForSelector('text=Incorrect email or password.'); ok(true,'wrong password: "Incorrect email or password."');
 await mode({limitAuth:true}); await pg.fill('input[type=password]','wrong-password-123'); await pg.click('form button.primary:has-text("Sign in")');
 await pg.waitForSelector('text=/Too many attempts/'); ok(true,'rate limit (plain-text 429): friendly "Too many attempts" message');
 // 5. duplicate email
 await mode({}); pg=await mk(b); await register(pg); await pg.waitForSelector('.nav-account'); await pg.click('.nav-logout');
 await register(pg); await pg.waitForSelector('text=That email is already registered.'); ok(true,'duplicate email: "That email is already registered."');
 await pg.fill('input[type=email]','other@example.com'); await pg.check('input[name=consent]'); await pg.click('button.primary:has-text(\"Register\")'); await pg.waitForSelector('.nav-account'); ok(true,'a different email registers fine');
 // 6. login works with the registered account (fresh tab)
 pg=await mk(b); await pg.goto(UI+'/account'); await pg.fill('input[type=email]','thandi@example.com'); await pg.fill('input[type=password]','a-long-enough-pass'); await pg.click('form button.primary:has-text("Sign in")');
 await pg.waitForSelector('.nav-account'); ok((await headerName(pg)).includes('Thandi'),'sign in with the right password works');
 // 7. profile photo
 const file=()=>pg.locator('input[type=file]').first();
 await file().setInputFiles({name:'me.gif',mimeType:'image/gif',buffer:Buffer.from('GIF89a')}); await pg.waitForSelector('text=/JPG, PNG or WebP/');
 ok(!(await reqLog()).some(l=>l.startsWith('PUT /api/v1/me/photo')),'a GIF is refused before upload');
 await file().setInputFiles({name:'big.png',mimeType:'image/png',buffer:Buffer.alloc(2*1024*1024+10)}); await pg.waitForSelector('text=/under 2 MB/');
 ok(!(await reqLog()).some(l=>l.startsWith('PUT /api/v1/me/photo')),'a 2 MB+ file is refused before upload');
 await file().setInputFiles({name:'me.png',mimeType:'image/png',buffer:stub}); await pg.waitForSelector('text=Profile picture updated.');
 ok((await reqLog()).some(l=>l==='PUT /api/v1/me/photo [auth]'),'photo uploaded as multipart (the mock rejects anything without a "photo" field)');
 await pg.waitForSelector('.profile-avatar img'); ok((await pg.locator('.profile-avatar img').first().getAttribute('src')).startsWith('blob:'),'avatar is shown from the fetched picture (blob URL)');
 ok((await headerName(pg)).includes('Thandi'),'still signed in after upload');
 // 8. expired token
 await pg.goto(UI+'/account'); await pg.waitForSelector('.profile-avatar');
 const live=await token(pg); await mode({expireTokens:true}); await pg.evaluate(t=>localStorage.setItem('royal-api-session',JSON.stringify({token:t,expiresAt:new Date(Date.now()+36e5).toISOString()})),live);
 await pg.reload(); await pg.waitForSelector('text=Your session ended. Please sign in again.'); ok((await token(pg))===null,'a rejected token ends the session, clears sessionStorage and explains why');
 await pg.waitForSelector('form button.primary:has-text("Sign in")'); ok(true,'the sign-in form is back, on the same page');
 // 9. admin / courier land on the placeholder, not on local demo data
 await mode({}); pg=await mk(b); await pg.goto(UI+'/account'); await pg.fill('input[type=email]','admin@royaltreats.test'); await pg.fill('input[type=password]','AdminPass-12345'); await pg.click('form button.primary:has-text("Sign in")');
 await pg.waitForSelector('.workspace-sidebar'); ok(await pg.locator('rt-admin-overview').count()===1&&!(await pg.locator('.sidebar-identity').textContent()).includes('Demo'),'API admin gets the API-backed workspace (no demo data, no "Demo" label)');
 await pg.click('.nav-logout'); await pg.goto(UI+'/account'); await pg.fill('input[type=email]','courier@royaltreats.test'); await pg.fill('input[type=password]','CourierPass-12345'); await pg.click('form button.primary:has-text("Sign in")');
 await pg.waitForSelector('rt-courier-workspace'); ok(await pg.locator('text=being connected').count()===0,'API courier gets the delivery workspace');
 ok(pg.errs.length===0,'no page errors ('+pg.errs.join('|')+')');
 // 10. checkout notice does not flash while restoring
 await mode({delayMs:1500}); pg=await mk(b); await mode({delayMs:0}); 
 await b.close();
})();
