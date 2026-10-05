const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:375,height:812},locale:'ru-RU'});
 await page.goto(process.env.RGATU_DOWNLOAD_URL||'file://'+path.resolve('docs/index.html'));
 assert.equal(await page.locator('.unofficial').innerText(),'Неофициальный студенческий проект');
 assert.match(await page.locator('.author').innerText(),/Смирнов Иван · @falseheat/);
 assert.equal(await page.locator('.author a[href="https://t.me/falseheat"]').getAttribute('href'),'https://t.me/falseheat');
 assert.equal(await page.locator('.author a[href="https://www.rsatu.ru/zaochnoe/"]').count(),1);
 assert.equal(await page.locator('.primary').getAttribute('download'),'RgatuLite-1.3.2.apk');
 await page.setViewportSize({width:1280,height:900});
 const fzo=await page.evaluate(()=>{
   const header=document.querySelector('.header-inner').getBoundingClientRect();
   const hero=document.querySelector('.hero');
   const inner=document.querySelector('.hero-inner').getBoundingClientRect();
   const copy=document.querySelector('.hero-copy').getBoundingClientRect();
   const preview=document.querySelector('.hero-preview').getBoundingClientRect();
   const hs=getComputedStyle(hero);
   return {header:header.width,inner:inner.width,preview:preview.width,gap:preview.left-copy.right,top:hs.paddingTop,bottom:hs.paddingBottom};
 });
 assert.ok(Math.abs(fzo.header-1160)<=2,'FZO Pages header container');
 assert.ok(Math.abs(fzo.inner-1160)<=2,'FZO Pages hero container');
 assert.ok(Math.abs(fzo.preview-400)<=2,'FZO Pages hero card');
 assert.ok(Math.abs(fzo.gap-56)<=2,'FZO Pages hero gap');
 assert.equal(fzo.top,'40px');assert.equal(fzo.bottom,'52px');
 await page.setViewportSize({width:375,height:812});
 fs.mkdirSync('build/screenshots',{recursive:true});
 await page.screenshot({path:'build/screenshots/download-page.png',fullPage:false,animations:'disabled'});
 const checked=[];
 for(const width of [320,375,768,940]){
  await page.setViewportSize({width,height:812});
  for(const size of [16,24,32]){
   await page.addStyleTag({content:'html{font-size:'+size+'px!important}'});
   for(const detail of await page.locator('details').all())await detail.evaluate(el=>el.open=true);
   const result=await page.evaluate(()=>{
    const problems=[];
    if(document.documentElement.scrollWidth>innerWidth+1)problems.push('page overflow');
    for(const el of document.querySelectorAll('p,h1,h2,a,li,summary,.badge')){
     if(!el.getClientRects().length)continue;
     if(el.scrollWidth>el.clientWidth+2)problems.push(el.textContent.slice(0,70));
    }
    return {problems,noticeSize:parseFloat(getComputedStyle(document.querySelector('.unofficial')).fontSize)};
   });
   assert.deepEqual(result.problems,[],width+'px '+size+'px');
   assert.ok(result.noticeSize>=20,'prominent notice');
   checked.push(width+'px/'+Math.round(size/16*100)+'%');
  }
 }
 console.log('PASS: prominent notice, author, Telegram, current Android download, expanded instructions and no clipped text at '+checked.join(', '));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
