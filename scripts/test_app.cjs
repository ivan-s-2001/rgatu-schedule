const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const appVersion=JSON.parse(fs.readFileSync('version.json','utf8')).version;

(async()=>{
  const url=process.env.RGATU_TEST_URL||'http://127.0.0.1:4173';
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Europe/Moscow',locale:'ru-RU'});
  // Keep future CI runs anchored to the supplied October session.
  await context.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-10-05T12:45:00+03:00']));}static now(){return D.parse('2026-10-05T12:45:00+03:00');}};});
  const page=await context.newPage();
  async function screenClick(selector,screen){await page.click(selector);await page.waitForSelector({day:'.date-title',search:'#subject-search',bells:'.bells-list',profile:'.about-card',teachers:'.teachers-page'}[screen]);}
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const out=path.resolve('build/screenshots');fs.mkdirSync(out,{recursive:true});
  async function fits(label){
    const issues=await page.evaluate(()=>{
      const issues=[];
      if(document.documentElement.scrollWidth>innerWidth+1){
        const offenders=[...document.querySelectorAll('body *')].map(el=>{
          const r=el.getBoundingClientRect();
          return {el,over:Math.max(0,r.right-innerWidth)+Math.max(0,-r.left),left:r.left,right:r.right,width:r.width};
        }).filter(x=>x.over>1).sort((a,b)=>b.over-a.over).slice(0,5);
        issues.push('page overflows '+document.documentElement.scrollWidth+'/'+innerWidth+' :: '+offenders.map(x=>x.el.className+':'+Math.round(x.left)+'..'+Math.round(x.right)+' w'+Math.round(x.width)).join(' | '));
      }
      for(const el of document.querySelectorAll('h1,h2,h3,p,.group-code,.group-hint,.brand,.nav-link,.link-row,.kind,.date-title,.day,.month-day,.segments button,.schedule-tab,.unofficial-chip,.primary,.secondary,.subject-row,.live-summary,.live-place,.next-preview,.room-strong,.subgroup-note')){
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
  const firstHero=await page.locator('.picker-hero').boundingBox();assert.ok(firstHero&&Math.abs(firstHero.y)<=1,'first-run hero must start at viewport top');
  assert.ok(firstHero&&firstHero.width>=374,'first-run hero spans viewport');
  await page.screenshot({path:path.join(out,'picker-mobile.png'),fullPage:false,animations:'disabled'});
  await page.click('[data-action="picker-focus"]');
  assert.notEqual(new URL(page.url()).hash,'#picker-form','hero action must not enter router hash');
  assert.equal(await page.locator('#group-search').evaluate(el=>document.activeElement===el),true,'hero action focuses group search');
  await page.evaluate(async()=>{if('serviceWorker' in navigator)await navigator.serviceWorker.ready;});await page.waitForLoadState('networkidle');
  await page.waitForSelector('#group-search');
  assert.match(await page.locator('.unofficial-card').innerText(),/неофициальное[\s\S]*студентом 1 курса/i);
  assert.equal(await page.locator('.group-row').filter({hasText:/-(1|2)\\s/}).count(),0,'technical subgroup rows are hidden from group picker');
  await page.locator('.group-row').first().click();
  const pickerConfirm=await page.evaluate(()=>{
    const el=document.querySelector('.picker-action');
    window.scrollTo(0,Math.max(0,document.documentElement.scrollHeight/2));
    const r=el.getBoundingClientRect();
    return {position:getComputedStyle(el).position,top:r.top,bottom:r.bottom,height:innerHeight};
  });
  assert.equal(pickerConfirm.position,'fixed','group picker confirmation is fixed to viewport bottom on mobile');
  assert.ok(Math.abs(pickerConfirm.bottom-pickerConfirm.height)<=2,'group picker confirmation stays pinned to viewport bottom');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.fill('#group-search','ЗВС-26');await page.locator('.group-row').click();await page.click('#continue-group');await page.waitForSelector('.date-title');await page.waitForSelector('.date-title');
  const headerBox=await page.locator('.topbar').boundingBox();assert.ok(headerBox&&Math.abs(headerBox.y)<=1,'app header must start at viewport top');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rgatu.group')),'ЗВС-26');
  assert.equal(await page.locator('.nav-link').count(),3);assert.match(await page.locator('.brand-mobile-note').innerText(),/неофициальное/i);assert.equal(await page.locator('a[href="#session"]').count(),0);
  const markupAudit=await page.evaluate(()=>{
    const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
    const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
    const nestedInteractive=[...document.querySelectorAll('button button,button a,a button,a a')].map(el=>el.outerHTML.slice(0,120));
    return {duplicates:[...new Set(duplicates)],nestedInteractive};
  });
  assert.deepEqual(markupAudit.duplicates,[],'rendered screen has no duplicate HTML ids');
  assert.deepEqual(markupAudit.nestedInteractive,[],'interactive controls are not nested');
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
    const nav=document.querySelector('.bottom-nav');
    const n=nav.getBoundingClientRect();
    const active=document.querySelector('.nav-link[aria-current="page"]');
    return {h:[h.x,h.y,h.width,h.height],n:[n.x,n.y,n.width,n.height],navBg:getComputedStyle(nav).backgroundColor,activeBg:getComputedStyle(active).backgroundColor};
  });
  assert.equal(mobileChrome.navBg,'rgb(255, 255, 255)','light PWA bottom navigation is a light app surface');
  assert.equal(mobileChrome.activeBg,'rgb(246, 250, 250)','active PWA navigation uses FZO accent surface');
  await page.evaluate(()=>{window.__rgatuHeader=document.querySelector('.topbar');window.__rgatuNav=document.querySelector('.bottom-nav');});
  for(const [selector,screen] of [['[data-action="teachers"]','teachers'],['a[href="#day"]','day'],['a[href="#bells"]','bells'],['a[href="#profile"]','profile']]){
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
  assert.ok(await page.locator('.lesson-break').count()>=4,'break and transition blocks connect lessons');
  assert.match(await page.locator('.lesson-break').nth(0).innerText(),/Перерыв[\s\S]*10 минут[\s\S]*10:05–10:15[\s\S]*Аудитория не меняется/);
  assert.match(await page.locator('.lesson-break').nth(1).innerText(),/Окно[\s\S]*2 ч 35 мин[\s\S]*11:50–14:25[\s\S]*1 корпус[\s\S]*3 корпус[\s\S]*аудитория 3-215/);
  assert.match(await page.locator('.lesson-break').nth(2).innerText(),/Перерыв[\s\S]*10 минут[\s\S]*3 корпус[\s\S]*3-215[\s\S]*3-322[\s\S]*3 этаж/);
  const breakVisual=await page.locator('.lesson-break').nth(0).evaluate(el=>({border:getComputedStyle(el).borderStyle,background:getComputedStyle(el).backgroundColor}));
  assert.equal(breakVisual.border,'none','break block has no card border');
  assert.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(breakVisual.background),'break block is a transparent connector');
  assert.equal(await page.locator('.live-summary .live-status').count(),1,'focus card has status and countdown row');
  assert.equal(await page.locator('.live-summary .live-countdown').count(),1,'focus card exposes countdown');
  assert.equal(await page.locator('.live-summary .live-meta').count(),1,'focus card exposes exact time and context');
  await screenClick('[data-action="teachers"]','teachers');
  await page.fill('#teacher-search','Фоменко');
  await page.locator('[data-action="choose-teacher"]').filter({hasText:'Фоменко С.А.'}).click();
  assert.match(await page.locator('.teacher-summary').innerText(),/Фоменко С\.А\./);
  assert.ok(await page.locator('.teacher-day .lesson').count()>=2);
  assert.match(await page.locator('.teacher-day .together').first().innerText(),/Группы:/);
  assert.equal(await page.locator('.nav-link[href="#day"]').getAttribute('aria-current'),'page');
  await screenClick('[data-action="group-schedule"]','day');
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="group"]');await page.fill('#group-search','ЗКС-26');
  assert.equal(await page.locator('.group-row').count(),1,'ZKS base group is a single choice');
  assert.doesNotMatch(await page.locator('.group-row').innerText(),/подгруппа/i);
  await page.locator('.group-row').click();await page.click('#continue-group');await page.waitForSelector('.date-title');
  assert.equal(await page.locator('.subgroup-note').count(),0,'whole-group lessons do not show subgroup labels');
  await page.click('.week [data-value="2026-10-08"]');
  assert.match(await page.locator('.subgroup-note').first().innerText(),/1 подгруппа/);
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="group"]');await page.fill('#group-search','ЗВС-26');await page.locator('.group-row').click();await page.click('#continue-group');await page.waitForSelector('.date-title');
  assert.match(await page.locator('.lesson').first().innerText(),/Экономика|Фоменко С\.А\.|1-212/);
  assert.match(await page.locator('.lesson').first().innerText(),/1 корпус[\s\S]*2 этаж/);
  assert.match(await page.locator('.live-summary').innerText(),/Культурология|3-215/);
  assert.match(await page.locator('.together').first().innerText(),/Вместе с ЗСС-26/);
  assert.equal(await page.locator('.context-action').count(),0,'ordinary schedule day has no sticky CTA');
  await page.click('[data-action="next-day"]');assert.match(await page.locator('.date-title').innerText(),/6 октября/);
  await page.click('[data-action="prev-day"]');assert.match(await page.locator('.date-title').innerText(),/5 октября/);
  await page.click('.week [data-value="2026-10-10"]');
  assert.match(await page.locator('.lesson').last().innerText(),/13:45–15:20/);
  await page.click('.week [data-value="2026-10-11"]');assert.match(await page.locator('.empty').innerText(),/Сегодня занятий нет|сессия/i);
  assert.equal(await page.locator('.empty button').count(),0,'empty-state card itself contains no floating CTA');
  assert.equal(await page.locator('.context-action .primary').count(),1,'empty day exposes one contextual next-step action');
  const contextualAction=await page.evaluate(()=>{
    const action=document.querySelector('.context-action').getBoundingClientRect();
    const style=getComputedStyle(document.querySelector('.context-action'));
    return {position:style.position,top:action.top,bottom:action.bottom};
  });
  assert.equal(contextualAction.position,'static','contextual next-step action stays in normal content flow');
  assert.ok(contextualAction.bottom>contextualAction.top,'contextual next-step action has normal in-flow geometry');
  assert.equal(await page.locator('[data-action="calendar"]').count(),0,'calendar action is removed from schedule');
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
  const selectedDayState=await page.evaluate(()=>{
    const rgb=value=>{const m=value.match(/\d+(?:\.\d+)?/g);return m?m.slice(0,3).map(Number):null;};
    const lum=c=>{const a=c.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*a[0]+.7152*a[1]+.0722*a[2];};
    const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const day=document.querySelector('.day[aria-current="date"]');
    const number=day?.querySelector('.day-number');
    const dot=day?.querySelector('.day-dot:not(.no-lessons)');
    if(!day||!number||!dot)return null;
    const rect=dot.getBoundingClientRect();
    return {contrast:ratio(rgb(getComputedStyle(number).color),rgb(getComputedStyle(day).backgroundColor)),width:rect.width,height:rect.height,borderTop:getComputedStyle(dot).borderTopWidth};
  });
  assert.ok(selectedDayState&&selectedDayState.contrast>=4.5,'selected day stays legible in dark theme');
  assert.ok(selectedDayState.width<=6&&selectedDayState.height<=6&&Math.abs(selectedDayState.width-selectedDayState.height)<=1&&selectedDayState.borderTop==='0px','selected day lesson marker stays a compact dot');
  const fzoTokens=await page.evaluate(()=>({
    lessonRadius:getComputedStyle(document.querySelector('.lesson')).borderRadius
  }));
  assert.equal(fzoTokens.lessonRadius,'12px','FZO card radius');
  // Every screen stays within narrow, tablet and landscape widths, with 150% and 200% text.
  for(const size of [{width:320,height:740},{width:375,height:812},{width:812,height:375},{width:768,height:1024}]){
    await page.setViewportSize(size);
    for(const font of [16,24,32]){
      await page.addStyleTag({content:'html{font-size:'+font+'px!important}'});
      for(const screen of ['day','teachers','bells','profile','search']){
        if(screen==='teachers'){await screenClick('a[href="#day"]','day');await screenClick('[data-action="teachers"]','teachers');}
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
    await page.click('[data-action="group"]');
    await page.waitForSelector('.picker-action');
    const desktopAction=await page.evaluate(()=>{
      const action=document.querySelector('.picker-action').getBoundingClientRect();
      const button=document.querySelector('.picker-action .primary').getBoundingClientRect();
      const form=document.querySelector('.picker-form').getBoundingClientRect();
      return {left:action.left,right:action.right,width:action.width,height:action.height,bottom:action.bottom,buttonWidth:button.width,buttonHeight:button.height,formLeft:form.left,formRight:form.right,viewport:innerWidth,viewportHeight:innerHeight};
    });
    assert.ok(desktopAction.left>=desktopAction.formLeft-2,'desktop group picker confirmation follows content area');
    assert.ok(desktopAction.right<=desktopAction.formRight+2,'desktop group picker confirmation stays inside content area');
    assert.ok(desktopAction.width<=322&&desktopAction.buttonWidth<=322,'desktop group picker confirmation is content-width');
    assert.ok(desktopAction.height<=48&&desktopAction.buttonHeight<=48,'desktop group picker confirmation is content-height');
    assert.ok(desktopAction.viewportHeight-desktopAction.bottom>=10&&desktopAction.viewportHeight-desktopAction.bottom<=16,'desktop group picker confirmation keeps compact bottom offset');
    await page.click('[data-action="cancel-group"]');
    await fits('desktop day '+size.width);
    await screenClick('[data-action="teachers"]','teachers');await fits('desktop teachers '+size.width);
    await screenClick('a[href="#profile"]','profile');await fits('desktop profile '+size.width);
  }
  await page.setViewportSize({width:1280,height:900});
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="theme"][data-value="light"]');await screenClick('a[href="#day"]','day');
  const archiveDesktop=await page.evaluate(()=>{
    const shell=document.querySelector('.shell'),nav=document.querySelector('.bottom-nav'),link=document.querySelector('.nav-link[aria-current="page"]'),pageEl=document.querySelector('.page');
    const ns=getComputedStyle(nav),ls=getComputedStyle(link),ps=getComputedStyle(pageEl),ss=getComputedStyle(shell,'::before');
    return {navBg:ns.backgroundColor,linkPad:ls.padding,linkRadius:ls.borderRadius,linkSize:ls.fontSize,pageBg:ps.backgroundColor,sidebarBackdropBg:ss.backgroundColor,sidebarBackdropW:parseFloat(ss.width),sidebarBackdropH:parseFloat(ss.height),navRight:nav.getBoundingClientRect().right};
  });
  assert.equal(archiveDesktop.navBg,'rgb(238, 241, 244)','archive sidebar #eef1f4');
  assert.equal(archiveDesktop.linkPad,'9px 14px','archive sidebar link padding');
  assert.equal(archiveDesktop.linkRadius,'0px','archive sidebar links are square');
  assert.equal(archiveDesktop.linkSize,'14.5px','archive sidebar link typography');
  assert.equal(archiveDesktop.pageBg,'rgb(255, 255, 255)','archive content canvas is white');
  assert.equal(archiveDesktop.sidebarBackdropBg,'rgb(238, 241, 244)','archive sidebar backdrop uses #eef1f4');
  assert.ok(archiveDesktop.sidebarBackdropW>=archiveDesktop.navRight-1,'archive sidebar backdrop reaches through the whole left column');
  assert.ok(archiveDesktop.sidebarBackdropH>700,'archive sidebar backdrop extends through the desktop workspace');
  await page.screenshot({path:path.join(out,'desktop-day-light.png'),fullPage:false,animations:'disabled'});
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="theme"][data-value="dark"]');await screenClick('a[href="#day"]','day');
  await page.screenshot({path:path.join(out,'desktop-day-dark.png'),fullPage:false,animations:'disabled'});
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="theme"][data-value="light"]');await screenClick('a[href="#day"]','day');
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="group"]');await page.waitForSelector('.picker-hero');
  const changeHero=await page.locator('.picker-hero').boundingBox();assert.ok(changeHero&&Math.abs(changeHero.y)<=1,'group-change hero must start at viewport top');
  await page.screenshot({path:path.join(out,'picker-desktop.png'),fullPage:false,animations:'disabled'});
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
  await page.screenshot({path:path.join(out,'day.png'),fullPage:false,animations:'disabled'});await page.screenshot({path:path.join(out,'breaks.png'),fullPage:true,animations:'disabled'});await screenClick('[data-action="teachers"]','teachers');await page.screenshot({path:path.join(out,'teachers.png'),fullPage:false,animations:'disabled'});await screenClick('[data-action="group-schedule"]','day');
  await page.reload();assert.match(await page.locator('.group-switch').innerText(),/ЗВС-26/);
  await context.setOffline(true);await page.reload();await page.waitForSelector('.group-switch');await screenClick('a[href="#day"]','day');assert.ok(await page.locator('.lesson').count()>0);
  await screenClick('a[href="#profile"]','profile');await page.click('[data-action="refresh"]');await page.waitForFunction(()=>document.getElementById('notice').textContent.length>0);assert.match(await page.locator('#notice').innerText(),/нет интернета|Не удалось обновить/);
  assert.doesNotMatch(await page.locator('body').innerText(),/PWA|API|Cloudflare|кэш|база данных|JavaScript/i);
  const androidSource=fs.readFileSync('android/src/ru/rgatu/pairs/MainActivity.java','utf8');
  assert.match(androidSource,/setDecorFitsSystemWindows\(false\)/,'Android enables explicit edge-to-edge inset handling');
  assert.match(androidSource,/Type\.systemBars\(\)[\s\S]*Type\.displayCutout\(\)/,'Android reserves status bar, cutout and navigation system bars');
  assert.match(androidSource,/setPadding\(bars\.left,bars\.top,bars\.right,bars\.bottom\)/,'Android applies system insets to WebView container');
  const androidContext=await browser.newContext({viewport:{width:360,height:800},timezoneId:'Europe/Moscow',locale:'ru-RU',userAgent:`Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 RgatuLiteAndroid/${appVersion}`});
  await androidContext.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-10-05T12:45:00+03:00']));}static now(){return D.parse('2026-10-05T12:45:00+03:00');}};});
  const androidPage=await androidContext.newPage();
  await androidPage.goto(url);await androidPage.waitForSelector('#group-search');
  assert.equal(await androidPage.locator('html').evaluate(el=>el.classList.contains('android-app')),true,'Android gets dedicated mobile UI mode');
  await androidPage.fill('#group-search','ЗВС-26');await androidPage.locator('.group-row').click();await androidPage.click('#continue-group');await androidPage.waitForSelector('.lesson');
  const androidUi=await androidPage.evaluate(()=>{
    const header=document.querySelector('.topbar').getBoundingClientRect();
    const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
    const lesson=document.querySelector('.lesson').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-innerWidth,headerH:header.height,navH:nav.height,lessonW:lesson.width,viewport:innerWidth};
  });
  assert.ok(androidUi.overflow<=1,'Android has no horizontal overflow');
  assert.ok(androidUi.headerH>=62&&androidUi.headerH<=68,'Android compact app bar');
  assert.ok(androidUi.navH>=62&&androidUi.navH<=76,'Android bottom nav touch height');
  assert.ok(androidUi.lessonW>=androidUi.viewport-36,'Android lesson card uses mobile width');
  await androidPage.screenshot({path:path.join(out,'android-day-light.png'),fullPage:false,animations:'disabled'});
  await androidPage.click('a[href="#profile"]');await androidPage.waitForSelector('.profile-page');
  await androidPage.click('[data-action="theme"][data-value="dark"]');await androidPage.click('a[href="#day"]');await androidPage.waitForSelector('.lesson');
  await androidPage.screenshot({path:path.join(out,'android-day-dark.png'),fullPage:false,animations:'disabled'});
  await androidContext.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: original day schedule flow, inline breaks/windows, no calendar screen, logical actions only, Android safe insets, PWA and Android layouts, separate lesson cards, teacher mode, archive-style desktop, dark theme, offline and no clipping.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
