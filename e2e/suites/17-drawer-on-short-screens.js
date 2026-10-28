// Browser suite: the side menu keeps its parts' height on short screens.
const { chromium } = require('playwright');
const UI=(process.env.UI_URL||'http://localhost:4307')+'', CTRL=(process.env.API_URL||'http://localhost:3000')+'';
const ok=(c,m)=>console.log((c?'PASS':'FAIL')+'  '+m);
(async()=>{
 await fetch(CTRL+'/__mode',{method:'POST',body:'{}'});
 const b=await chromium.launch();
 for(const h of [853,800,700,560]){
  const ctx=await b.newContext({viewport:{width:390,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2}); await ctx.addInitScript(()=>localStorage.setItem('royal-welcome-v1','yes')); const pg=await ctx.newPage(); pg.setDefaultTimeout(10000);
  await pg.goto(UI+'/account'); await pg.fill('input[name=email]','admin@royaltreats.test'); await pg.fill('input[name=password]','AdminPass-12345'); await pg.click('button.primary:has-text("Sign in")'); await pg.waitForSelector('.appbar-tabs');
  await pg.tap('.mobile-menu-trigger'); await pg.waitForSelector('.nav.drawer'); await pg.waitForTimeout(500);
  const m=await pg.evaluate(()=>{const card=document.querySelector('.drawer-account').getBoundingClientRect(); const av=document.querySelector('.drawer-avatar').getBoundingClientRect(); const links=[...document.querySelectorAll('.drawer-links button')].map(e=>e.getBoundingClientRect().height); const d=document.querySelector('.nav.drawer'); return {card:Math.round(card.height),av:Math.round(av.height),minLink:Math.round(Math.min(...links)),scrolls:d.scrollHeight>d.clientHeight}});
  ok(m.card>=m.av,'viewport height '+h+': account card ('+m.card+'px) is at least as tall as its avatar ('+m.av+'px); smallest link '+m.minLink+'px; menu scrolls: '+m.scrolls);
  await ctx.close();
 }
 await b.close();
})();
