const {
  test, expect, openApp, newEstimate, addLine, rows, stored, currentEst, seed, answerNextPrompt,
  openManage, closeManage, setMenuRate, addSubViaMenu, addCompanyViaMenu,
} = require('./helpers');

test('a fully filled estimate survives a reload', async ({ page }) => {
  await openApp(page);
  await openManage(page);
  await addCompanyViaMenu(page, 'Acme Builders');
  await addSubViaMenu(page, 'Bob Framing', 400);
  await closeManage(page);

  await newEstimate(page);
  await page.locator('#f-client').fill('Smith Deck');
  await page.locator('#f-companysel').selectOption('Acme Builders');
  await page.locator('#f-pm').selectOption('__other__');
  await page.locator('#f-pm-other').fill('Pat');
  await page.locator('#f-status').selectOption('approved');
  await page.locator('#f-address').fill('12 Main St, Provo, UT');
  await page.locator('#f-notes').fill('Back deck, 12x16');
  await addLine(page, 'lumber', { desc: '2x6 12\'', qty: 24, price: 9.87 });
  await addLine(page, 'hardware', { desc: 'LUS26', qty: 30, price: 1.45 });
  await page.locator('#uc-dollar').click();
  await page.locator('#uc-val').fill('125');
  await page.locator('#buf-val').fill('200');
  await page.locator('#tax-inc').uncheck();
  await page.locator('#tax-amt').fill('20');
  await page.locator('#del-inc').uncheck();
  await page.locator('#sub-sel').selectOption('Bob Framing');
  await page.locator('#sub-days').fill('1.5');
  await page.locator('#cli-demo').fill('300');
  await page.locator('#mgmt-hours').fill('3');

  const totals = ['#gt-amount', '#gt-margin', '#s-mat', '#s-lab', '#s-exp', '#s-profit'];
  const before = {};
  for (const t of totals) before[t] = await page.locator(t).textContent();
  // 236.88 + 43.50 = 280.38 vendor; + 125 + 20 + 200 + 100 = 725.38; + 4500 + 300
  expect(before['#gt-amount']).toBe('$5,525');

  await page.reload();
  await expect(page.locator('#list-view')).toHaveClass(/on/);
  const card = page.locator('.est-card');
  await expect(card.locator('.ec-name')).toHaveText('Smith Deck');
  await expect(card.locator('.ec-total')).toHaveText('$5,525');
  await expect(card.locator('.ec-meta')).toHaveText('Acme Builders · PM: Pat · approved');
  await card.click();

  await expect(page.locator('#hdr-title')).toHaveText('Smith Deck');
  await expect(page.locator('#f-companysel')).toHaveValue('Acme Builders');
  await expect(page.locator('#f-pm')).toHaveValue('__other__');
  await expect(page.locator('#f-pm-other')).toHaveValue('Pat');
  await expect(page.locator('#f-status')).toHaveValue('approved');
  await expect(page.locator('#f-address')).toHaveValue('12 Main St, Provo, UT');
  await expect(page.locator('#f-notes')).toHaveValue('Back deck, 12x16');
  await expect(rows(page, 'lumber')).toHaveCount(1);
  await expect(rows(page, 'lumber').first().locator('.iinp.price')).toHaveValue('9.87');
  await expect(rows(page, 'hardware').first().locator('.iinp.qty')).toHaveValue('30');
  await expect(page.locator('#uc-dollar')).toHaveClass(/on/);
  await expect(page.locator('#uc-val')).toHaveValue('125');
  await expect(page.locator('#buf-val')).toHaveValue('200');
  await expect(page.locator('#tax-inc')).not.toBeChecked();
  await expect(page.locator('#tax-amt')).toHaveValue('20');
  await expect(page.locator('#del-inc')).not.toBeChecked();
  await expect(page.locator('#del-amt')).toHaveValue('100');
  await expect(page.locator('#sub-sel')).toHaveValue('Bob Framing');
  await expect(page.locator('#sub-days')).toHaveValue('1.5');
  await expect(page.locator('#sub-daily')).toHaveValue('400');
  await expect(page.locator('#sub-cost')).toHaveValue('600');
  await expect(page.locator('#cli-labor')).toHaveValue('4500');
  await expect(page.locator('#cli-demo')).toHaveValue('300');
  await expect(page.locator('#mgmt-hours')).toHaveValue('3');
  await expect(page.locator('#mgmt-labor')).toHaveValue('105');
  for (const t of totals) await expect(page.locator(t)).toHaveText(before[t]);
});

test('menu rates, companies, subs and price book survive a reload', async ({ page }) => {
  await openApp(page);
  await openManage(page);
  await setMenuRate(page, 'clientDay', 3100);
  await setMenuRate(page, 'mgmtHr', 45);
  await addCompanyViaMenu(page, 'Zeta Homes');
  await addSubViaMenu(page, 'Ann Decks', 350);
  await closeManage(page);
  await newEstimate(page);
  await addLine(page, 'hardware', { desc: 'A35', price: 1.15 });

  await page.reload();
  await openManage(page);
  await expect(page.locator('#rate-clientday')).toHaveValue('3100');
  await expect(page.locator('#rate-mgmthr')).toHaveValue('45');
  await expect(page.locator('#company-list .nm')).toHaveText(['Zeta Homes']);
  await expect(page.locator('#sub-list .nm')).toHaveText(['Ann Decks']);
  await expect(page.locator('#sub-list input')).toHaveValue('350');
  await expect(page.locator('#price-list .nm')).toHaveText(['a35']);
  await closeManage(page);

  await page.locator('.est-card').click();
  await expect(page.locator('#cli-rate-badge')).toHaveText('$3,100/day');
  await expect(page.locator('#mgmt-rate-badge')).toHaveText('$45/hr');
});

test('deleting an estimate removes it after confirming', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await page.locator('#f-client').fill('Doomed');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#list-view')).toHaveClass(/on/);
  await expect(page.locator('.est-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.empty-msg')).toHaveText('No estimates yet');
  expect((await stored(page)).ests).toEqual([]);
});

test('cancelling delete keeps the estimate', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await page.locator('#f-client').fill('Keeper');
  page.once('dialog', d => d.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#edit-view')).toHaveClass(/on/);
  expect((await stored(page)).ests.map(e => e.client)).toEqual(['Keeper']);
});

test('"+ Add new company" in the dropdown prompts, saves and selects it', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  answerNextPrompt(page, '  Beta Remodel  ');
  await page.locator('#f-companysel').selectOption('__add__');
  await expect(page.locator('#f-companysel')).toHaveValue('Beta Remodel');
  const db = await stored(page);
  expect(db.companies).toEqual(['Beta Remodel']);
  expect(db.ests[0].company).toBe('Beta Remodel');
});

test('removing a company or sub from the list keeps it on estimates that use it', async ({ page }) => {
  await openApp(page);
  await openManage(page);
  await addCompanyViaMenu(page, 'Acme Builders');
  await addSubViaMenu(page, 'Bob Framing', 400);
  await closeManage(page);
  await newEstimate(page);
  await page.locator('#f-companysel').selectOption('Acme Builders');
  await page.locator('#sub-sel').selectOption('Bob Framing');
  await openManage(page);
  page.on('dialog', d => d.accept());
  await page.locator('#company-list .mg-x').click();
  await page.locator('#sub-list .mg-x').click();
  await closeManage(page);
  await page.locator('#f-notes').fill('touch the estimate');
  const e = await currentEst(page);
  expect(e.company).toBe('Acme Builders');
  expect(e.lb.name).toBe('Bob Framing');
  await expect(page.locator('#f-companysel option:checked')).toHaveText('Acme Builders (removed)');
  expect((await stored(page)).companies).toEqual([]);
});

test('estimates saved by the old version keep their numbers', async ({ page }) => {
  // Old tax was a one-time snapshot and labor had no "typed" flag.
  await seed(page, { ests: [{
    id: 'old1', client: 'Old Job', status: 'sent', lumber: [{ qty: 2, desc: 'a', unitPrice: 1000 }], hardware: [],
    pr: { auto: true, orv: 0, taxInc: false, tax: 73, ucMode: '%', ucVal: 20, buf: 300, delInc: true, del: 0 },
    lb: { name: '', days: '', daily: 0, subCost: 2400, cliLab: 5000, cliDemo: 0 }, mgmtLabor: 0, mgmtHours: 0,
  }], cur: null });
  // 2000 + 400 + 73 + 300 + 5000
  await expect(page.locator('.est-card .ec-total')).toHaveText('$7,773');
  await page.locator('.est-card').click();
  await expect(page.locator('#tax-amt')).toHaveValue('73');
  await page.locator('#sub-daily').fill('400');
  await expect(page.locator('#sub-cost')).toHaveValue('2400');
  await expect(page.locator('#cli-labor')).toHaveValue('5000');
  await expect(page.locator('#gt-amount')).toHaveText('$7,773');
});

test('the list nags for a backup until one is made', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#backup-nag')).toBeHidden();
  await newEstimate(page);
  await page.getByRole('button', { name: 'Save & Back' }).click();
  await expect(page.locator('#backup-nag')).toBeVisible();
  await expect(page.locator('#backup-nag')).toContainText('never been backed up');
  const download = page.waitForEvent('download');
  await page.locator('#backup-nag button').click();
  await download;
  await expect(page.locator('#backup-nag')).toBeHidden();
});

test('a failed save shows a warning instead of failing silently', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await page.locator('#f-client').fill('x');
  await expect(page.locator('#save-warn')).toBeVisible();
});
