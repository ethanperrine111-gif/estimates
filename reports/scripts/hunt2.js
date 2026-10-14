const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'http://localhost:8765/index.html';
const SS = '/home/user/estimates/reports/screenshots/';
const log = (k, v) => console.log(k, '=>', JSON.stringify(v));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.type() + ':' + d.message()); d.accept(); });
  page.on('pageerror', e => log('pageerror', e.message));
  await page.goto(URL);
  await page.click('text=New Estimate');
  // 1. delete button off-screen
  await page.click('text=Add item >> nth=0');
  await page.fill('#lumber-tb tr:nth-child(1) input[type=text]', "2x4 8'");
  await page.fill('#lumber-price-0', '4.5');
  await page.locator('#lumber-tb').scrollIntoViewIfNeeded();
  log('delBtn.box', await page.locator('#lumber-tb .del-btn').boundingBox());
  log('lkpBtn.box', await page.locator('#lumber-tb .lkp-btn').boundingBox());
  log('totCell.box', await page.locator('#lumber-tot-0').boundingBox());
  const card = await page.locator('#lumber-tb').evaluate(e => { const r = e.closest('.card').getBoundingClientRect(); return { left: r.left, right: r.right }; });
  log('card', card);
  const tb = await page.locator('#lumber-tb').boundingBox();
  await page.screenshot({ path: SS + '14-delete-button-offscreen.png', clip: { x: 0, y: tb.y - 80, width: 390, height: 260 } });
  await page.locator('#lumber-tb').evaluate(e => e.closest('div').scrollLeft = 999);
  await page.screenshot({ path: SS + '14b-after-sideways-scroll.png', clip: { x: 0, y: tb.y - 80, width: 390, height: 260 } });

  // 2. XSS probe
  await page.fill('#f-client', '<img src=x onerror=alert("xss")>');
  await page.fill('#f-notes', '<b>bold</b>');
  await page.click('#share-btn'); await page.click('#share-modal .sm-close');
  await page.click('#back-btn');
  log('xss.dialogs', dialogs);

  // 3. Upcharge mode switch keeps number
  await page.click('.est-card');
  await page.fill('#lumber-tb tr:nth-child(1) input.qty', '100');
  const gt1 = await page.textContent('#gt-amount');
  await page.click('#uc-dollar');
  log('ucSwitch', { before: gt1, after: await page.textContent('#gt-amount'), val: await page.inputValue('#uc-val') });

  // 4. Background scroll while modal open
  await page.click('#share-btn');
  const y0 = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  log('modalBgScroll', { y0, y1: await page.evaluate(() => scrollY), bodyOverflow: await page.evaluate(() => getComputedStyle(document.body).overflow) });
  await page.click('#share-modal .sm-close');

  // 5. Company duplicates by case
  await page.click('#menu-btn'); await page.click('text=Subs & Prices');
  for (const n of ['Acme', 'acme', 'ACME ']) { await page.fill('#new-company', n); await page.click('#manage-body .mg-add .mg-addbtn'); }
  log('companies', await page.evaluate(() => db.companies));
  // Enter key in add company
  await page.fill('#new-company', 'Enter Co'); await page.press('#new-company', 'Enter');
  log('enterAdds', await page.evaluate(() => db.companies.includes('Enter Co')));
  // sub-rate field width with 4-digit rate
  await page.fill('#new-sub', 'Big Crew'); await page.fill('#new-sub-daily', '12500.50'); await page.click('text=Add Sub');
  log('subRate.box', await page.locator('#sub-list input.sub-rate').evaluate(e => ({ w: e.clientWidth, sw: e.scrollWidth })));
  await page.screenshot({ path: SS + '15-lists-modal.png' });
  // menu has only one item
  await page.click('#manage-modal .sm-close');
  await page.click('#menu-btn');
  log('menuItems', await page.locator('#topmenu .tm-item').allTextContents());
  await page.screenshot({ path: SS + '16-top-menu.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
  await page.click('#menu-btn');

  // 6. tax manual edit keeps "Utah 7.25%" badge; negative buffer
  await page.uncheck('#tax-inc'); await page.fill('#tax-amt', '5');
  log('taxBadge', await page.locator('#tax-auto-badge').isVisible());
  await page.fill('#buf-val', '-300');
  log('negBuffer.gt', await page.textContent('#gt-amount'));
  // 7. Date on doc is "today", not created date; no estimate number
  log('estFields', await page.evaluate(() => Object.keys(db.ests[0])));

  // 8. data export/backup capability
  log('hasExport', await page.evaluate(() => /export|backup|download/i.test(document.body.innerText)));
  // 9. storage quota failure silent
  log('dbSaveSrc', await page.evaluate(() => dbSave.toString()));
  // 10. Service worker / offline
  log('sw', await page.evaluate(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null));
  await browser.close();
})();
