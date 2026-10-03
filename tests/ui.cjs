/* Run with Playwright installed; BROWSER_BIN optionally selects an existing Chromium. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../app/src/main/assets');

(async () => {
  const errors = [];
  const server = http.createServer((req,res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html');
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN || undefined,args:['--no-sandbox']});
    const page = await browser.newPage({viewport:{width:390,height:844},colorScheme:'light',timezoneId:'Europe/Stockholm'});
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:',error.message); });
    page.on('dialog', dialog => dialog.accept());
    await page.clock.install({time:new Date('2026-10-03T10:30:00Z')});
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForSelector('.lesson');
    assert.equal(await page.locator('#timeline .lesson').count(), 6);
    assert.match(await page.locator('.hero-time').innerText(), /08:30.*10:05/);
    assert.match(await page.locator('#timeline .break').innerText(), /Окно · 2 ч 35 мин/);

    await page.locator('[data-date="2026-10-10"]').click();
    assert.equal(await page.locator('#timeline .lesson').count(), 3);
    assert.match(await page.locator('#timeline .lesson').last().innerText(), /13:45.*15:20/s);
    await page.locator('[data-date="2026-10-11"]').click();
    assert.match(await page.locator('#timeline').innerText(), /На этот день данных нет/);
    await page.locator('[data-date="2026-10-13"]').click();
    assert.match(await page.locator('#timeline .lesson').first().innerText(), /16:10/);

    await page.locator('[data-tab="all"]').click();
    await page.locator('#search').fill('Г-407');
    assert.equal(await page.locator('#all-days .lesson').count(), 2);
    await page.locator('#search').fill('Несуществующий предмет');
    assert.match(await page.locator('#all-days').innerText(), /Ничего не найдено/);
    await page.locator('[data-tab="bells"]').click();
    assert.equal(await page.locator('.bell-row').count(), 14);
    assert.match(await page.locator('.bell-table').last().innerText(), /13:45–15:20/);

    await page.locator('[data-tab="day"]').click();
    await page.locator('[data-date="2026-10-05"]').click();
    await page.locator('#timeline .lesson').first().click();
    await page.locator('[name=note]').fill('<img src=x onerror="window.injected=true"> взять тетрадь');
    await page.locator('#lesson-form [type=submit]').click();
    assert.equal(await page.locator('#timeline img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.match(await page.locator('.lesson-note').innerText(), /<img/);

    await page.locator('#add-button').click();
    await page.locator('[name=subject]').fill('Конфликт времени');
    await page.locator('[name=slot]').selectOption('1');
    await page.locator('#lesson-form [type=submit]').click();
    assert.match(await page.locator('#form-error').innerText(), /уже есть занятие/);
    await page.locator('[name=date]').fill('2026-10-15');
    await page.locator('[name=subject]').fill('Новая пара');
    await page.locator('#lesson-form [type=submit]').click();
    assert.equal(await page.locator('#timeline .lesson').count(), 1);
    assert.match(await page.locator('#day-title').innerText(), /15 октября/);
    await page.locator('#timeline .lesson').click();
    await page.locator('#delete-lesson').click();
    assert.equal(await page.locator('#timeline .lesson').count(), 0);

    await page.locator('#settings-button').click();
    await page.locator('#theme-select').selectOption('dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#reminder-minutes').selectOption('30');
    await page.locator('#modal-close').click();
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#reminder-minutes').inputValue(), '30');
    await page.locator('#modal-close').click();
    await page.setViewportSize({width:320,height:568});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#add-button').click();
    await page.setViewportSize({width:320,height:350});
    const bounds = await page.locator('.modal').boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 351);
    await page.locator('#lesson-form [type=submit]').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => window.handleAndroidBack()), true);
    assert.equal(await page.locator('#modal-overlay').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('UI: dates, Saturday times, missing data, search, safe text, editing, conflicts, preferences, 320px layout and keyboard-sized modal passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
