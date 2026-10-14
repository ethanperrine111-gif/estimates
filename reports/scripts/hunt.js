// Bug-hunt driver for QuickQuote. Usage: node hunt.js
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const URL = 'http://localhost:8765/index.html';
const SS = '/home/user/estimates/reports/screenshots/';
const out = {};
const consoleErrors = [];
const log = (k, v) => { out[k] = v; console.log(k, '=>', JSON.stringify(v)); };

async function fresh(browser, vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({
    viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push('[pageerror] ' + e.message));
  page.on('dialog', d => { page._dialogs = (page._dialogs || []).concat(d.message()); d.accept(page._promptAnswer || ''); });
  await page.goto(URL);
  return { ctx, page };
}
const shot = (page, name, opts = {}) => page.screenshot({ path: SS + name + '.png', ...opts });
const txt = (page, sel) => page.locator(sel).first().textContent();
const val = (page, sel) => page.inputValue(sel);
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('est-builder-v4')));

(async () => {
  const browser = await chromium.launch();

  /* 01 first launch */
  {
    const { ctx, page } = await fresh(browser);
    await shot(page, '01-first-launch-390');
    await page.click('text=New Estimate');
    log('newEmpty.gt', await txt(page, '#gt-amount'));
    log('newEmpty.margin', await txt(page, '#gt-margin'));
    await shot(page, '01b-new-estimate-empty-total');
    await page.click('#back-btn');
    log('list.emptyEstTotal', await txt(page, '.ec-total'));
    log('list.emptyEstName', await txt(page, '.ec-name'));
    await shot(page, '01c-list-untitled-300');
    // list padding-bottom calc check
    log('css.listPadBottom', await page.evaluate(() => getComputedStyle(document.getElementById('list-view')).paddingBottom));
    await ctx.close();
  }

  /* 02 qty 0 counted as 1 */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.click('text=Add item >> nth=0');
    await page.fill('#lumber-tb tr:nth-child(1) input[type=text]', 'Test board');
    await page.fill('#lumber-price-0', '100');
    await page.fill('#lumber-tb tr:nth-child(1) input.qty', '0');
    log('qty0.field', await val(page, '#lumber-tb tr:nth-child(1) input.qty'));
    log('qty0.rowTotal', await txt(page, '#lumber-tot-0'));
    log('qty0.vendor', await txt(page, '#vendor-disp'));
    log('qty0.stored', (await store(page)).ests[0].lumber[0].qty);
    await page.locator('#lumber-tb').scrollIntoViewIfNeeded();
    await shot(page, '02-qty-zero-counts-as-one');
    // negative qty / price
    await page.fill('#lumber-tb tr:nth-child(1) input.qty', '-5');
    log('qtyNeg.vendor', await txt(page, '#vendor-disp'));
    log('qtyNeg.gt', await txt(page, '#gt-amount'));
    await shot(page, '02b-negative-qty-accepted');
    await ctx.close();
  }

  /* 03 price autofill on prefix: "2x4 8'" saved, then typing "2x4 8' PT" */
  {
    const { ctx, page } = await fresh(browser);
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('est-builder-v4') || '{}');
      d.prices = { "2x4 8'": 4.5, "2x4 8' pt": 7.25, 'h1': 0.85 };
      localStorage.setItem('est-builder-v4', JSON.stringify(d));
    });
    await page.reload();
    await page.click('text=New Estimate');
    await page.click('text=Add item >> nth=0');
    await page.locator('#lumber-tb tr:nth-child(1) input[type=text]').pressSequentially("2x4 8' PT", { delay: 20 });
    log('prefix.price', await val(page, '#lumber-price-0'));
    log('prefix.stored', (await store(page)).ests[0].lumber[0]);
    await page.locator('#lumber-tb').scrollIntoViewIfNeeded();
    await shot(page, '03-prefix-autofill-wrong-price');
    // price book learning on keystrokes: type 12.5 for a new desc
    await page.click('text=Add item >> nth=0');
    await page.locator('#lumber-tb tr:nth-child(2) input[type=text]').pressSequentially('2x6 10', { delay: 10 });
    await page.locator('#lumber-price-1').pressSequentially('12.5', { delay: 10 });
    // then fix desc to the right thing
    const d2 = page.locator('#lumber-tb tr:nth-child(2) input[type=text]');
    await d2.press('End'); await d2.pressSequentially("'", { delay: 10 });
    log('learn.prices', (await store(page)).prices);
    await ctx.close();
  }

  /* 04 stale tax when unticking "Included" before items are complete */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.click('text=Add item >> nth=0');
    await page.fill('#lumber-tb tr:nth-child(1) input[type=text]', 'Beam');
    await page.fill('#lumber-price-0', '1000');
    await page.uncheck('#tax-inc');
    log('tax.afterUntick', await val(page, '#tax-amt'));
    await page.fill('#lumber-tb tr:nth-child(1) input.qty', '10');
    log('tax.after10x', await val(page, '#tax-amt'));
    log('tax.vendor', await txt(page, '#vendor-disp'));
    await page.locator('#tax-amt').scrollIntoViewIfNeeded();
    await shot(page, '04-stale-tax');
    // expenses exclude tax + delivery
    await page.uncheck('#del-inc');
    log('exp.total', await txt(page, '#s-exp'));
    log('exp.profit', await txt(page, '#s-profit'));
    log('exp.clientMat', await txt(page, '#client-mat-total'));
    await page.locator('#s-exp').scrollIntoViewIfNeeded();
    await shot(page, '04b-expenses-exclude-tax-delivery');
    await ctx.close();
  }

  /* 05 labor manual entry wiped by auto-calc */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.fill('#cli-labor', '5000');
    await page.fill('#sub-cost', '2400');
    log('labor.before', { cli: await val(page, '#cli-labor'), sub: await val(page, '#sub-cost') });
    await page.fill('#sub-daily', '400'); // user enters sub's daily rate, no days yet
    log('labor.afterDaily', { cli: await val(page, '#cli-labor'), sub: await val(page, '#sub-cost') });
    await page.locator('#cli-labor').scrollIntoViewIfNeeded();
    await shot(page, '05-manual-labor-wiped');
    // with days: manual client labor override replaced
    await page.fill('#sub-days', '2');
    await page.fill('#cli-labor', '4500');
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    await page.fill('#rate-mgmthr', '40'); await page.locator('#rate-mgmthr').dispatchEvent('change');
    await page.click('#manage-modal .sm-close');
    log('labor.afterRateEdit', { cli: await val(page, '#cli-labor') });
    await ctx.close();
  }

  /* 06 sub master daily rate clobbered by sv() */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    await page.fill('#new-sub', 'Bob Framing'); await page.fill('#new-sub-daily', '400'); await page.click('text=Add Sub');
    await page.click('#manage-modal .sm-close');
    await page.click('text=New Estimate');
    await page.selectOption('#sub-sel', 'Bob Framing');
    log('sub.dailyFilled', await val(page, '#sub-daily'));
    // Owner raises Bob's master rate to 450
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    const r = page.locator('#sub-list input.sub-rate'); await r.fill('450'); await r.dispatchEvent('change');
    log('sub.masterAfterEdit', (await store(page)).subs[0].daily);
    await page.click('#manage-modal .sm-close');
    await page.fill('#f-client', 'Smith deck'); // any edit
    log('sub.masterAfterTyping', (await store(page)).subs[0].daily);
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    await shot(page, '06-sub-rate-reverted');
    await page.click('#manage-modal .sm-close');
    // deleting the sub wipes it from the estimate
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    await page.click('#sub-list .mg-x');
    await page.fill('#new-company', 'Acme Builders'); await page.click('#manage-body .mg-add .mg-addbtn');
    await page.click('#manage-modal .sm-close');
    await page.selectOption('#f-companysel', 'Acme Builders');
    await page.fill('#f-notes', 'x');
    log('sub.estNameAfterSubDelete', (await store(page)).ests[0].lb.name);
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    await page.click('#company-list .mg-x');
    await page.click('#manage-modal .sm-close');
    await page.fill('#f-notes', 'xy');
    log('company.estAfterCompanyDelete', (await store(page)).ests[0].company);
    await ctx.close();
  }

  /* 07 share / PDF leaks internal numbers; rounding; hidden rows */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.fill('#f-client', 'Johnson Pergola');
    await page.fill('#f-address', '123 Main St\nProvo, UT');
    await page.click('text=Add item >> nth=1');
    await page.fill('#hardware-tb tr:nth-child(1) input[type=text]', 'Joist hanger nails');
    await page.fill('#hardware-price-0', '0.35');
    await page.fill('#hardware-tb tr:nth-child(1) input.qty', '3');
    await page.click('text=Add item >> nth=1');
    await page.fill('#hardware-price-1', '250'); // no description
    await page.fill('#sub-days', '2'); await page.fill('#sub-daily', '400');
    await page.fill('#mgmt-hours', '3');
    await page.click('#share-btn');
    await page.waitForTimeout(200);
    const prev = page.locator('#share-preview');
    log('doc.hasInternal', (await prev.textContent()).includes('Internal'));
    log('doc.unitNails', await page.locator('#share-preview .doc-tbl td').nth(2).textContent());
    log('doc.lineTotal', await page.locator('#share-preview .doc-tbl td').nth(3).textContent());
    log('doc.hardwareRows', await page.locator('#share-preview .doc-tbl tbody tr').count());
    log('doc.vendorSub', await page.locator('#share-preview .doc-row').first().textContent());
    await shot(page, '07-share-modal');
    await prev.evaluate(el => el.scrollTop = el.scrollHeight);
    await shot(page, '07b-share-internal-profit-visible');
    log('share.text', await page.inputValue('#share-txt'));
    log('share.navigatorShareUsed', (await page.content()).includes('navigator.share'));
    // close button size
    log('tap.smClose', await page.locator('#share-modal .sm-close').boundingBox());
    // print to PDF
    await page.click('text=Save as PDF').catch(() => {});
    await page.emulateMedia({ media: 'print' });
    await shot(page, '07c-print-media', { fullPage: true });
    log('print.title', await page.title());
    await page.emulateMedia({ media: 'screen' });
    await ctx.close();
  }

  /* 08 order materials mailto */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.fill('#f-client', 'Order test');
    await page.selectOption('#f-pm', 'Keri');
    await page.click('text=Add item >> nth=0');
    await page.fill('#lumber-tb tr:nth-child(1) input[type=text]', "2x4 8'");
    await page.fill('#lumber-tb tr:nth-child(1) input.qty', '0');
    let mailto = null;
    await page.route('**/*', r => r.continue());
    page.on('framenavigated', f => { if (f.url().startsWith('mailto')) mailto = f.url(); });
    const href = await page.evaluate(() => {
      let captured = null;
      const orig = Object.getOwnPropertyDescriptor(window.location.__proto__ || Location.prototype, 'href');
      try { orderMaterials.toString(); } catch (e) {}
      return null;
    });
    // capture by patching location via a proxy function body
    const body = await page.evaluate(() => {
      const src = orderMaterials.toString().replace('window.location.href =', 'return ');
      return (new Function('getEst', 'db', 'alert', 'return (' + src + ')()'))(getEst, db, alert);
    });
    log('mailto', decodeURIComponent(body));
    await ctx.close();
  }

  /* 09 iOS number input with comma / invalid -> value "" */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    // emulate WebKit: user-typed "3,000" in type=number yields .value === "" (sanitised)
    await page.evaluate(() => { const i = document.getElementById('cli-labor'); i.value = '3,000'; i.dispatchEvent(new Event('input')); });
    log('comma.value', await val(page, '#cli-labor'));
    log('comma.stored', (await store(page)).ests[0].lb.cliLab);
    log('inputmode.count', await page.evaluate(() => document.querySelectorAll('[inputmode]').length));
    log('numberInputs', await page.evaluate(() => document.querySelectorAll('input[type=number]').length));
    await ctx.close();
  }

  /* 10 layout: 375x667 line items, long names, huge numbers, overflow */
  for (const vp of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
    const tag = vp.width;
    const { ctx, page } = await fresh(browser, vp);
    await page.click('text=New Estimate');
    await page.fill('#f-client', 'Henderson-Blackwood Residence Full Second Story Addition & Deck');
    await page.click('#lumber-qt');
    for (const c of ["8'", "10'", "12'"]) await page.click(`#lumber-qp .chip:text-is("${c}") >> nth=0`);
    await page.fill('#lumber-tb tr:nth-child(1) input[type=text]', 'Pressure treated 2x12x20 Douglas Fir #2 or better kiln dried');
    await page.fill('#lumber-price-0', '1234.56');
    await page.fill('#lumber-tb tr:nth-child(1) input.qty', '1000');
    await page.locator('#lumber-tb').scrollIntoViewIfNeeded();
    await shot(page, `10-line-items-${tag}`);
    log(`layout.${tag}.tableScroll`, await page.evaluate(() => { const w = document.querySelector('#lumber-tb').closest('div'); return { client: w.clientWidth, scroll: w.scrollWidth }; }));
    log(`layout.${tag}.descWidth`, await page.locator('#lumber-tb tr:nth-child(1) input[type=text]').evaluate(e => e.getBoundingClientRect().width));
    log(`layout.${tag}.docScroll`, await page.evaluate(() => ({ w: document.documentElement.scrollWidth, vw: innerWidth })));
    await page.fill('#cli-labor', '987654321');
    await page.locator('.gt-banner').scrollIntoViewIfNeeded();
    await shot(page, `10b-huge-total-${tag}`);
    log(`layout.${tag}.gtBanner`, await page.evaluate(() => { const b = document.querySelector('.gt-banner'); return { client: b.clientWidth, scroll: b.scrollWidth }; }));
    log(`layout.${tag}.docScrollAfterHuge`, await page.evaluate(() => ({ w: document.documentElement.scrollWidth, vw: innerWidth })));
    // header with long title
    await page.evaluate(() => scrollTo(0, 0));
    await shot(page, `10c-header-long-title-${tag}`, { clip: { x: 0, y: 0, width: vp.width, height: 70 } });
    // list view long name + unbroken company
    await page.click('#menu-btn'); await page.click('text=Subs & Prices');
    await page.fill('#new-company', 'SuperLongCompanyNameWithNoSpacesConstructionLLC_Utah');
    await page.click('#manage-body .mg-add .mg-addbtn');
    await page.click('#manage-modal .sm-close');
    await page.selectOption('#f-companysel', 'SuperLongCompanyNameWithNoSpacesConstructionLLC_Utah');
    await page.selectOption('#f-pm', 'Jason');
    await page.click('#back-btn');
    await shot(page, `10d-list-long-${tag}`);
    log(`layout.${tag}.listScroll`, await page.evaluate(() => ({ w: document.documentElement.scrollWidth, vw: innerWidth })));
    await page.click('.est-card');
    await page.click('#share-btn');
    await shot(page, `10e-share-${tag}`);
    log(`layout.${tag}.previewScroll`, await page.evaluate(() => { const p = document.querySelector('#share-preview'); return { client: p.clientWidth, scroll: p.scrollWidth }; }));
    await ctx.close();
  }

  /* 11 many line items + quick pick focus/scroll behaviour */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.click('#lumber-qt');
    const chip = page.locator('#lumber-qp .chip').nth(4);
    await chip.scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => scrollY);
    const cb0 = await chip.boundingBox();
    await chip.tap();
    const y1 = await page.evaluate(() => scrollY);
    log('quick.focusAfterChip', await page.evaluate(() => document.activeElement.className + ' ' + document.activeElement.id));
    log('quick.chipY', { before: cb0.y, after: (await chip.boundingBox()).y, scrollBefore: y0, scrollAfter: y1 });
    await chip.tap();
    log('quick.dupRows', await page.locator('#lumber-tb tr').count());
    for (let i = 0; i < 40; i++) await page.locator('#lumber-qp .chip').nth(i % 12).click();
    log('many.rows', await page.locator('#lumber-tb tr').count());
    await shot(page, '11-many-items', { fullPage: true });
    // tap targets
    const sizes = await page.evaluate(() => {
      const m = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
      return { del: m('#lumber-tb .del-btn'), lookup: m('#lumber-tb .lkp-btn'), chip: m('#lumber-qp .chip'), checkbox: m('#tax-inc'), qty: m('#lumber-tb .iinp.qty'), menu: m('#menu-btn'), back: m('#back-btn'), share: m('#share-btn'), ucToggle: m('#uc-dollar') };
    });
    log('tap.sizes', sizes);
    await page.locator('#lumber-tb tr:nth-child(1)').scrollIntoViewIfNeeded();
    await shot(page, '11b-tiny-row-buttons', { clip: await page.locator('#lumber-tb tr:nth-child(1)').boundingBox().then(b => ({ x: 0, y: b.y - 40, width: 390, height: b.height + 80 })) });
    // delete has no undo
    await page.locator('#lumber-tb .del-btn').first().click();
    log('del.dialogs', page._dialogs || []);
    // reload persistence
    const before = await page.locator('#lumber-tb tr').count();
    await page.reload();
    await page.click('.est-card');
    log('reload.rows', { before, after: await page.locator('#lumber-tb tr').count() });
    await ctx.close();
  }

  /* 12 font sizes of inputs (<16px zooms on iOS without max-scale) */
  {
    const { ctx, page } = await fresh(browser);
    await page.click('text=New Estimate');
    await page.click('text=Add item >> nth=0');
    log('fonts', await page.evaluate(() => {
      const r = {}; document.querySelectorAll('input,select,textarea').forEach(e => { const f = getComputedStyle(e).fontSize; r[f] = (r[f] || 0) + 1; }); return r;
    }));
    log('viewport', await page.evaluate(() => document.querySelector('meta[name=viewport]').content));
    // contrast samples
    log('colors', await page.evaluate(() => {
      const g = s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor]; };
      return { badge: g('.auto-badge'), newBtn: [getComputedStyle(document.querySelector('.new-est-btn')).color, getComputedStyle(document.querySelector('.new-est-btn')).backgroundColor], order: g('.order-btn'), placeholderDash: '#e2e8f0' };
    }));
    // status emoji on list?
    await page.selectOption('#f-status', 'approved');
    await page.click('#back-btn');
    log('list.meta', await page.locator('.ec-meta').innerHTML());
    await shot(page, '12-list-status-no-emoji');
    // vendor override zeroes total
    await page.click('.est-card');
    await page.fill('#lumber-tb tr:nth-child(1) input[type=text]', 'x'); await page.fill('#lumber-price-0', '500');
    const gtA = await txt(page, '#gt-amount');
    await page.uncheck('#auto-vendor');
    log('override', { before: gtA, after: await txt(page, '#gt-amount'), field: await val(page, '#vendor-or') });
    await page.locator('#vendor-or').scrollIntoViewIfNeeded();
    await shot(page, '12b-override-zeroes-vendor');
    // managing hours cleared keeps stale amount
    await page.fill('#mgmt-hours', '4');
    await page.fill('#mgmt-hours', '');
    log('mgmt.afterClear', { hours: await val(page, '#mgmt-hours'), amount: await val(page, '#mgmt-labor') });
    // PM other with blank
    await page.selectOption('#f-pm', '__other__');
    await page.click('#back-btn'); await page.click('.est-card');
    log('pmOther.afterReopen', await val(page, '#f-pm'));
    // empty sub/company add via prompt
    await ctx.close();
  }

  /* 13 keyboard + fixed bottom bar: simulate visual viewport shrink */
  {
    const { ctx, page } = await fresh(browser, { width: 390, height: 844 });
    await page.click('text=New Estimate');
    await page.setViewportSize({ width: 390, height: 844 - 336 }); // approx keyboard height
    await page.locator('#sub-days').scrollIntoViewIfNeeded();
    await page.focus('#mgmt-hours');
    await shot(page, '13-keyboard-bottom-bar');
    log('kb.overlap', await page.evaluate(() => {
      const bar = document.getElementById('bot-bar').getBoundingClientRect(); const f = document.activeElement.getBoundingClientRect();
      return { barTop: Math.round(bar.top), barH: Math.round(bar.height), fieldBottom: Math.round(f.bottom), vh: innerHeight };
    }));
    await ctx.close();
  }

  log('consoleErrors', consoleErrors);
  require('fs').writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
