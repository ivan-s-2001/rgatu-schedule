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
 assert.equal(await page.locator('.author a[href="https://t.me/falseheat"]').getAttribute('href'),'https://t.me/falseheat');\n assert.equal(await page.locator('.author a[href="https://www.rsatu.ru/zaochnoe/"]').count(),1);
 assert.equal(await page.locator('.primary').getAttribute('download'),'RgatuLite-1.2.0.apk');
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
