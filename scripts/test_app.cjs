const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  const url=process.env.RGATU_TEST_URL||'http://127.0.0.1:4173';
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Europe/Moscow',locale:'ru-RU'});
  // Keep future CI runs anchored to the supplied October session.
  await context.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-10-05T12:45:00+03:00']));}static now(){return D.parse('2026-10-05T12:45:00+03:00');}};});
  const page=await context.newPage();
  async function screenClick(selector,screen){await page.click(selector);await page.waitForSelector({day:'.date-title',calendar:'.month-grid',search:'#subject-search',bells:'.bells-list',profile:'.about-card',teachers:'.teachers-page'}[screen]);}
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const out=path.resolve('build/screenshots');fs.mkdirSync(out,{recursive:true});
  async function fits(label){
    const issues=await page.evaluate(()=>{
      const issues=[];
      if(document.documentElement.scrollWidth>innerWidth+1)issues.push('page overflows');
      for(const el of document.querySelectorAll('h1,h2,h3,p,.group-code,.group-hint,.brand,.nav-link,.link-row,.kind,.date-title,.day,.month-day,.segments button,.schedule-tab,.unofficial-chip,.primary,.secondary,.subject-row,.live-summary,.live-place,.next-preview,.room-strong')){
        if(el.hidden||!el.getClientRects().length)continue;
        if(el.scrollWidth>el.clientWidth+2)issues.push(el.className+': '+el.textContent.slice(0,70));
        const style=getComputedStyle(el);
        if(style.textOverflow==='ellipsis'||style.webkitLineClamp!=='none'&&Number(style.webkitLineClamp)>0)issues.push('clamped '+el.textContent.slice(0,40));
      }
      return issues;
    });
    assert.deepEqual(issues,[],label);
  }
  await page.goto(url);await page.waitForSelector('#group-search');
  await page.click('[data-action="picker-focus"]');
  assert.notEqual(new URL(page.url()).hash,'#picker-form','hero action must not enter router hash');
  assert.equal(await page.locator('#group-search').evaluate(el=>document.activeElement===el),true,'hero action focuses group search');
  const firstHero=await page.locator('.picker-hero').boundingBox();assert.ok(firstHero&&Math.abs(firstHero.y)<=1,'first-run hero must start at viewport top');
  assert.ok(firstHero&&firstHero.width>=374,'first-run hero spans viewport');
  await page.evaluate(async()=>{if('serviceWorker' in navigator)await navigator.serviceWorker.ready;});await page.waitForLoadState('networkidle');
  await page.waitForSelector('#group-search');
  assert.match(await page.locator('.unofficial-card').innerText(),/неофициальное[\s\S]*студентом 1 курса/i);
  await page.fill('#group-search','ЗВС-26');await page.locator('.group-row').click();await page.click('#continue-group');await page.waitForSelector('.date-title');await page.waitForSelector('.date-title');
  const headerBox=await page.locator('.topbar').boundingBox();assert.ok(headerBox&&Math.abs(headerBox.y)<=1,'app header must start at viewport top');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rgatu.group')),'ЗВС-26');
  assert.equal(await page.locator('.nav-link').count(),3);assert.equal(await page.locator('a[href="#session"]').count(),0);
  assert.equal(await page.locator('.brand-logo').evaluate(el=>el.tagName),'IMG','main FZO mark stays separate from Bootstrap UI icons');
  const iconAudit=await page.evaluate(()=>({
    count:document.querySelectorAll('svg.ui-icon.bi').length,
    badView:[...document.querySelectorAll('svg.ui-icon')].filter(el=>el.getAttribute('viewBox')!=='0 0 16 16').length,
    old24:document.querySelectorAll('svg[viewBox="0 0 24 24"]').length,
    missingBi:[...document.querySelectorAll('svg.ui-icon')].filter(el=>![...el.classList].some(c=>c.startsWith('bi-'))).length
  }));
  assert.ok(iconAudit.count>=8,'Bootstrap Icons render across the app');
  assert.equal(iconAudit.badView,0,'all UI icons use Bootstrap 16x16 viewBox');
  assert.equal(iconAudit.old24,0,'legacy 24x24 custom icons are gone');
  assert.equal(iconAudit.missingBi,0,'all internal SVG icons identify their Bootstrap icon');
  const mobileChrome=await page.evaluate(()=>{
    const h=document.querySelector('.topbar').getBoundingClientRect();
    const n=document.querySelector('.bottom-nav').getBoundingClientRect();
    return {h:[h.x,h.y,h.width,h.height],n:[n.x,n.y,n.width,n.height]};
  });
  await page.evaluate(()=>{window.__rgatuHeader=document.querySelector('.topbar');window.__rgatuNav=document.querySelector('.bottom-nav');});
  for(const [selector,screen] of [['[data-action="teachers"]','teachers'],['a[href="#day"]','day'],['.date-title','calendar'],['a[href="#bells"]','bells'],['a[href="#profile"]','profile']]){
    await screenClick(selector,screen);
    const chrome=await page.evaluate(()=>{
      const h=document.querySelector('.topbar').getBoundingClientRect();
      const n=document.querySelector('.bottom-nav').getBoundingClientRect();
      return {h:[h.x,h.y,h.width,h.height],n:[n.x,n.y,n.width,n.height]};
    });
    for(let i=0;i<4;i++) assert.ok(Math.abs(chrome.h[i]-mobileChrome.h[i])<=1,'mobile header geometry is stable');
    for(let i=0;i<4;i++) assert.ok(Math.abs(chrome.n[i]-mobileChrome.n[i])<=1,'mobile navigation geometry is stable');
  }
  const persistentChrome=await page.evaluate(()=>document.querySelector('.topbar')===window.__rgatuHeader&&document.querySelector('.bottom-nav')===window.__rgatuNav);
  assert.equal(persistentChrome,true,'FZO header and navigation persist between app screens');
  await screenClick('a[href="#day"]','day');
  assert.equal(await page.locator('.schedule-tab').count(),2);
  assert.match(await page.locator('.schedule-switcher').innerText(),/По группе[\s\S]*По преподавателю/);
  assert.match(await page.locator('.lesson').nth(0).innerText(),/1\s*пара[\s\S]*08:30–10:05/);
  assert.match(await page.locator('.lesson').nth(1).innerText(),/2\s*пара[\s\S]*10:15–11:50/);
  assert.doesNotMatch(await page.locator('.lessons').innerText(),/1\s*[–-]\s*2\s*пары?/);
  await screenClick('[data-action="teachers"]','teachers');
  await page.fill('#teacher-search','Фоменко');
  await page.locator('[data-action="choose-teacher"]').filter({hasText:'Фоменко С.А.'}).click();
  assert.match(await page.locator('.teacher-summary').innerText(),/Фоменко С\.А\./);
  assert.ok(await page.locator('.teacher-day .lesson').count()>=2);
  assert.match(await page.locator('.teacher-day .together').first().innerText(),/Группы:/);
  assert.equal(await page.locator('.nav-link[href="#day"]').getAttribute('aria-current'),'page');
  await screenClick('[data-action="group-schedule"]','day');
  assert.match(await page.locator('.lesson').first().innerText(),/Экономика|Фоменко С\.А\.|1-212/);
  assert.match(await page.locator('.lesson').first().innerText(),/1 корпус[\s\S]*2 этаж/);
  assert.match(await page.locator('.live-summary').innerText(),/Культурология|3-215/);
  assert.match(await page.locator('.together').first().innerText(),/Вместе с ЗСС-26/);
  await page.click('[data-action="next-day"]');assert.match(await page.locator('.date-title').innerText(),/6 октября/);
  await page.click('[data-action="prev-day"]');assert.match(await page.locator('.date-title').innerText(),/5 октября/);
  await page.click('.week [data-value="2026-10-10"]');
  assert.match(await page.locator('.lesson').last().innerText(),/13:45–15:20/);
  await page.click('.week [data-value="2026-10-11"]');assert.match(await page.locator('.empty').innerText(),/Сегодня занятий нет|сессия/i);assert.ok(await page.locator('.empty .secondary').count()>0);
  await screenClick('.date-title','calendar');assert.equal(await page.locator('.month-day').count(),35);
  await page.click('[data-action="next-month"]');assert.match(await page.locator('.month-pager').innerText(),/ноябрь/i);
  await page.click('[data-action="prev-month"]');await screenClick('.month-grid [data-value="2026-10-14"]','day');
  assert.match(await page.locator('.date-title').innerText(),/14 октября/);
  await page.click('[data-action="today"]');assert.match(await page.locator('.date-title').innerText(),/5 октября/);
  await screenClick('[data-action="search"]','search');assert.equal(await page.locator('.lesson').count(),0);
  await page.fill('#subject-search','Фоменко');assert.ok(await page.locator('.lesson').count()>0);
  for(const teacher of await page.locator('.teacher').allTextContents())assert.match(teacher,/Фоменко/);
  await page.fill('#subject-search','ничегоненайти');assert.match(await page.locator('.empty').innerText(),/Ничего не нашлось/);
  await page.click('[data-action="reset-subject"]');assert.ok(await page.locator('.subject-row').count()>0);
  await page.click('.subject-row:first-child');assert.ok(await page.locator('.lesson').count()>0);
  await screenClick('a[href="#bells"]','bells');assert.equal(await page.locator('.bells-list li').count(),7);
  assert.match(await page.locator('.bells-list li').nth(2).innerText(),/12:40–14:15/);
  await page.click('[data-action="bell-kind"][data-value="weekend"]');assert.match(await page.locator('.bells-list li').nth(2).innerText(),/12:00–13:35/);
  await screenClick('a[href="#profile"]','profile');assert.match(await page.locator('.about-card').innerText(),/Смирнов Иван · @falseheat/);assert.match(await page.locator('.about-card').innerText(),/неофициальное/i);
  assert.equal(await page.locator('a[href="https://t.me/falseheat"]').count(),1);
  await screenClick('a[href="#day"]','day');
  const lightGeometry=await page.evaluate(()=>{
    const l=document.querySelector('.lesson').getBoundingClientRect();
    const c=document.querySelector('.day-controls').getBoundingClientRect();
    return {lesson:[l.width,l.height],controls:[c.width,c.height]};
  });
  await screenClick('a[href="#profile"]','profile');
  await page.click('[data-action="theme"][data-value="dark"]');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await screenClick('a[href="#day"]','day');
  const darkGeometry=await page.evaluate(()=>{
    const l=document.querySelector('.lesson').getBoundingClientRect();
    const c=document.querySelector('.day-controls').getBoundingClientRect();
    return {lesson:[l.width,l.height],controls:[c.width,c.height]};
  });
  for(const key of ['lesson','controls'])for(let i=0;i<2;i++)assert.ok(Math.abs(lightGeometry[key][i]-darkGeometry[key][i])<=1,'theme switch keeps geometry stable');
  await screenClick('a[href="#profile"]','profile');
  const contrastIssues=await page.evaluate(()=>{
    const rgb=value=>{const m=value.match(/\d+(?:\.\d+)?/g);return m?m.slice(0,3).map(Number):null;};
    const lum=c=>{const a=c.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*a[0]+.7152*a[1]+.0722*a[2];};
    const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const bg=el=>{for(let n=el;n;n=n.parentElement){const v=getComputedStyle(n).backgroundColor;if(v&&!/rgba\\(0, 0, 0, 0\\)|transparent/.test(v))return rgb(v);}return [11,16,32];};
    const selectors=['.lesson h3','.teacher','.live-copy strong','.live-place','.search','.schedule-tab[aria-selected="true"]','.group-row[aria-checked="true"]','.nav-link[aria-current="page"]','.unofficial-card p'];
    return selectors.flatMap(sel=>{const el=document.querySelector(sel);if(!el)return [];const fg=rgb(getComputedStyle(el).color),back=bg(el);if(!fg||!back)return [sel+': unknown color'];const r=ratio(fg,back);return r<4.5?[sel+': '+r.toFixed(2)]:[];});
  });
  assert.deepEqual(contrastIssues,[],'dark theme text contrast');
  await screenClick('a[href="#day"]','day');
  const fzoTokens=await page.evaluate(()=>({
    lessonRadius:getComputedStyle(document.querySelector('.lesson')).borderRadius
  }));
  assert.equal(fzoTokens.lessonRadius,'12px','FZO card radius');
  // Every screen stays within narrow, tablet and landscape widths, with 150% and 200% text.
  for(const size of [{width:320,height:740},{width:375,height:812},{width:812,height:375},{width:768,height:1024}]){
    await page.setViewportSize(size);
    for(const font of [16,24,32]){
      await page.addStyleTag({content:'html{font-size:'+font+'px!important}'});
      for(const screen of ['day','teachers','calendar','bells','profile','search']){
        if(screen==='teachers'){await screenClick('a[href="#day"]','day');await screenClick('[data-action="teachers"]','teachers');}
        else if(screen==='calendar'){await screenClick('a[href="#day"]','day');await screenClick('.date-title','calendar');}
        else if(screen==='search'){await screenClick('a[href="#day"]','day');await screenClick('[data-action="search"]','search');}
        else await screenClick('a[href="#'+screen+'"]',screen);
        await fits(screen+' '+size.width+' '+font);
      }
    }
  }
  await page.setViewportSize({width:812,height:812});await screenClick('a[href="#day"]','day');
  const tabletWidth=await page.evaluate(()=>({shell:document.querySelector('.shell').getBoundingClientRect().width,viewport:innerWidth,headerTop:document.querySelector('.topbar').getBoundingClientRect().top}));
  assert.ok(tabletWidth.shell>=tabletWidth.viewport-1,'tablet PWA must not render as a narrow phone column');
  assert.ok(Math.abs(tabletWidth.headerTop)<=1,'tablet header starts at top edge');
  // Desktop is a real wide application workspace, never a centered phone mockup.
  for(const size of [{width:1280,height:900},{width:1440,height:1000}]){
    await page.setViewportSize(size);await page.addStyleTag({content:'html{font-size:16px!important}'});
    await screenClick('a[href="#day"]','day');
    const desktopLayout=await page.evaluate(()=>{
      const header=document.querySelector('.topbar').getBoundingClientRect();
      const headerInner=document.querySelector('.topbar-inner').getBoundingClientRect();
      const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
      const main=document.querySelector('.page').getBoundingClientRect();
      const sidebar=document.querySelector('.day-sidebar').getBoundingClientRect();
      const dayMain=document.querySelector('.day-main').getBoundingClientRect();
      return {headerTop:header.top,headerLeft:header.left,headerRight:header.right,headerInnerWidth:headerInner.width,navLeft:nav.left,navRight:nav.right,navTop:nav.top,mainLeft:main.left,mainRight:main.right,mainWidth:main.width,sidebarRight:sidebar.right,dayMainLeft:dayMain.left,viewport:innerWidth};
    });
    assert.ok(Math.abs(desktopLayout.headerTop)<=1,'desktop header top');
    assert.ok(desktopLayout.headerLeft<=1&&desktopLayout.headerRight>=desktopLayout.viewport-1,'desktop header spans viewport');
    assert.ok(Math.abs(desktopLayout.headerInnerWidth-1160)<=2,'desktop FZO header container is 1160px');
    const workspaceLeft=Math.max(0,(desktopLayout.viewport-1160)/2);
    assert.ok(Math.abs(desktopLayout.navLeft-workspaceLeft)<=2&&Math.abs((desktopLayout.navRight-desktopLayout.navLeft)-264)<=2,'desktop navigation matches 264px FZO menu');
    assert.ok(Math.abs((desktopLayout.mainLeft-desktopLayout.navRight)-44)<=2&&desktopLayout.mainWidth>700,'desktop content keeps the 44px FZO column gap');
    assert.ok(desktopLayout.sidebarRight+20<desktopLayout.dayMainLeft,'desktop day view has separate controls and lesson columns');
    await fits('desktop day '+size.width);
    await screenClick('[data-action="teachers"]','teachers');await fits('desktop teachers '+size.width);
    await screenClick('a[href="#profile"]','profile');await fits('desktop profile '+size.width);
  }
  await page.setViewportSize({width:1280,height:900});await screenClick('a[href="#day"]','day');await page.screenshot({path:path.join(out,'desktop-day.png'),fullPage:false,animations:'disabled'});
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="group"]');await page.waitForSelector('.picker-hero');
  const changeHero=await page.locator('.picker-hero').boundingBox();assert.ok(changeHero&&Math.abs(changeHero.y)<=1,'group-change hero must start at viewport top');
  const heroContract=await page.evaluate(()=>{
    const hero=document.querySelector('.picker-hero');
    const inner=document.querySelector('.picker-hero-inner').getBoundingClientRect();
    const copy=document.querySelector('.picker-hero-copy').getBoundingClientRect();
    const card=document.querySelector('.hero-card').getBoundingClientRect();
    const hs=getComputedStyle(hero);
    const search=getComputedStyle(document.querySelector('.search'));
    return {top:hs.paddingTop,bottom:hs.paddingBottom,inner:inner.width,card:card.width,gap:card.left-copy.right,searchHeight:search.height};
  });
  assert.equal(heroContract.top,'40px','FZO hero top padding');
  assert.equal(heroContract.bottom,'52px','FZO hero bottom padding');
  assert.ok(Math.abs(heroContract.inner-1160)<=2,'FZO hero container 1160px');
  assert.ok(Math.abs(heroContract.card-400)<=2,'FZO hero side card 400px');
  assert.ok(Math.abs(heroContract.gap-56)<=2,'FZO hero grid gap 56px');
  assert.equal(heroContract.searchHeight,'48px','FZO search height');
  const beforePickerHash=new URL(page.url()).hash;
  await page.click('[data-action="picker-focus"]');
  assert.equal(new URL(page.url()).hash,beforePickerHash,'group-change hero action keeps group route');
  assert.equal(await page.locator('#group-search').evaluate(el=>document.activeElement===el),true,'group-change hero focuses search');
  await page.click('[data-action="cancel-group"]');await page.waitForSelector('.date-title');

  // Exercise actual source titles with the longest wraps, rather than a synthetic short fixture.
  const source=JSON.parse(fs.readFileSync('public/schedule.json'));
  const longest=source.lessons.slice().sort((a,b)=>b.subject.length-a.subject.length)[0];
  const g=source.groups.find(g=>g.lessons.includes(longest.id));
  await page.setViewportSize({width:320,height:740});await screenClick('a[href="#profile"]','profile');await page.click('[data-action="group"]');
  await page.fill('#group-search',g.id);await page.locator('.group-row').filter({hasText:g.id}).first().click();await page.click('#continue-group');await page.waitForSelector('.date-title');
  await fits('long-name group');await screenClick('[data-action="search"]','search');await page.fill('#subject-search',longest.subject);
  assert.ok(await page.locator('.lesson').count()>0);await fits('longest source subject at 200%');
  // Save reviewable phone screens at ordinary text size.
  await page.setViewportSize({width:375,height:812});await page.addStyleTag({content:'html{font-size:16px!important}'});
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="theme"][data-value="light"]');
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="group"]');await page.fill('#group-search','ЗВС-26');await page.locator('.group-row').click();await page.click('#continue-group');await page.waitForSelector('.date-title');
  await page.screenshot({path:path.join(out,'day.png'),fullPage:false,animations:'disabled'});await screenClick('[data-action="teachers"]','teachers');await page.screenshot({path:path.join(out,'teachers.png'),fullPage:false,animations:'disabled'});await screenClick('[data-action="group-schedule"]','day');await screenClick('.date-title','calendar');await page.screenshot({path:path.join(out,'calendar.png'),fullPage:false,animations:'disabled'});
  await page.reload();assert.match(await page.locator('.group-switch').innerText(),/ЗВС-26/);
  await context.setOffline(true);await page.reload();await page.waitForSelector('.group-switch');await screenClick('a[href="#day"]','day');assert.ok(await page.locator('.lesson').count()>0);
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="refresh"]');await page.waitForFunction(()=>document.getElementById('notice').textContent.length>0);assert.match(await page.locator('#notice').innerText(),/нет интернета|Не удалось обновить/);
  assert.doesNotMatch(await page.locator('body').innerText(),/PWA|API|Cloudflare|кэш|база данных|JavaScript/i);
  assert.deepEqual(errors,[]);
  console.log('PASS: Bootstrap Icons, top-edge hero/header, real desktop shell, separate lesson cards, group/teacher schedule tabs, next-class dashboard, room building/floor hints, free-day continuation, month selection, search, exact bells, shared groups, author/contact, persistence, offline and no clipping.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
