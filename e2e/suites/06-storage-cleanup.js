// Browser suite: 06-storage-cleanup. Runs against the mock API and the local-config build (see e2e/README.md).
const { chromium } = require('playwright'); const fs=require('fs');
const UI=(process.env.UI_URL||'http://localhost:4307')+''; const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
(async()=>{const b=await chromium.launch(); const ctx=await b.newContext(); const pg=await ctx.newPage();
 await ctx.route('**/images.unsplash.com/**',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(require('path').join(__dirname,'..','assets','stub.png'))}));
 await pg.addInitScript(()=>{ if(!sessionStorage.getItem('__seeded')){ sessionStorage.setItem('__seeded','1');
   localStorage.setItem('royal-accounts-v2',JSON.stringify([{email:'old@x',password:'plaintext'}])); localStorage.setItem('royal-products-v2','[]'); localStorage.setItem('royal-deliveries-v2','[]'); localStorage.setItem('royal-settings-v2','{}'); localStorage.setItem('rt-orders','[]');
   localStorage.setItem('rt-cart','[]'); localStorage.setItem('royal-welcome-v1','yes'); sessionStorage.setItem('royal-demo-session','admin-demo'); } });
 await pg.goto(UI+'/menu'); await pg.waitForSelector('.menu-product-grid .product');
 const keys=await pg.evaluate(()=>({l:Object.keys(localStorage).sort(),s:Object.keys(sessionStorage).sort()}));
 ok(!keys.l.some(k=>/royal-(accounts|products|settings|deliveries)-v2|rt-orders/.test(k)),'old demo data is gone from localStorage ('+keys.l.join(', ')+')');
 ok(keys.l.includes('rt-cart')&&keys.l.includes('royal-welcome-v1'),'cart and welcome flags are kept');
 ok(!keys.s.includes('royal-demo-session'),'old demo session key is gone');
 await b.close();})();
