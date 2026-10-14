const { test, expect, openApp, newEstimate, addLine, currentEst } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
});

test('new estimate defaults: 20% upcharge, $300 buffer, tax & delivery included', async ({ page }) => {
  await expect(page.locator('#uc-val')).toHaveValue('20');
  await expect(page.locator('#uc-pct')).toHaveClass(/on/);
  await expect(page.locator('#buf-val')).toHaveValue('300');
  await expect(page.locator('#tax-inc')).toBeChecked();
  await expect(page.locator('#del-inc')).toBeChecked();
  await expect(page.locator('#auto-vendor')).toBeChecked();
  // with no items, client materials = just the buffer
  await expect(page.locator('#vendor-disp')).toHaveText('$0');
  await expect(page.locator('#client-mat-total')).toHaveText('$300');
  await expect(page.locator('#gt-amount')).toHaveText('$300');
});

test('client materials = vendor + 20% upcharge + buffer', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 10, price: 100 }); // 1000
  await expect(page.locator('#vendor-disp')).toHaveText('$1,000');
  await expect(page.locator('#uc-hint')).toHaveText('20% of $1,000 = $200');
  await expect(page.locator('#client-mat-total')).toHaveText('$1,500'); // 1000 + 200 + 300
});

test('upcharge percentage can be changed', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 1, price: 1234 });
  await page.locator('#uc-val').fill('15');
  // 1234 × 15% = 185.10
  await expect(page.locator('#uc-hint')).toHaveText('15% of $1,234 = $185');
  await expect(page.locator('#client-mat-total')).toHaveText('$1,719'); // 1719.10
});

test('$ upcharge mode adds a flat amount and keeps the number', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 1, price: 1000 });
  await page.locator('#uc-dollar').click();
  await expect(page.locator('#uc-dollar')).toHaveClass(/on/);
  await expect(page.locator('#uc-hint')).toBeHidden();
  // 20 now means $20
  await expect(page.locator('#client-mat-total')).toHaveText('$1,320');
  await page.locator('#uc-val').fill('450');
  await expect(page.locator('#client-mat-total')).toHaveText('$1,750');
  const e = await currentEst(page);
  expect(e.pr).toMatchObject({ ucMode: '$', ucVal: 450 });
});

test('zero upcharge and zero buffer give client materials = vendor', async ({ page }) => {
  await addLine(page, 'hardware', { desc: 'x', qty: 3, price: 33.33 });
  await page.locator('#uc-val').fill('0');
  await page.locator('#buf-val').fill('');
  await expect(page.locator('#client-mat-total')).toHaveText('$100'); // 99.99
});

test('unchecking Taxes autofills Utah 7.25% of vendor, rounded to the dollar', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 1, price: 624 });
  await page.locator('#tax-inc').uncheck();
  await expect(page.locator('#tax-auto-badge')).toBeVisible();
  // 624 × 0.0725 = 45.24 → 45
  await expect(page.locator('#tax-amt')).toHaveValue('45');
  // 624 + 124.80 + 45 + 300
  await expect(page.locator('#client-mat-total')).toHaveText('$1,094');
});

test('tax amount is editable, and re-checking Included removes it', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 1, price: 1000 });
  await page.locator('#tax-inc').uncheck();
  await expect(page.locator('#tax-amt')).toHaveValue('73'); // 72.5 → 73
  await page.locator('#tax-amt').fill('80');
  await expect(page.locator('#client-mat-total')).toHaveText('$1,580');
  await page.locator('#tax-inc').check();
  await expect(page.locator('#tax-amt')).toBeHidden();
  await expect(page.locator('#client-mat-total')).toHaveText('$1,500');
});

test('auto tax is a snapshot: adding items later does not change it', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 1, price: 1000 });
  await page.locator('#tax-inc').uncheck();
  await expect(page.locator('#tax-amt')).toHaveValue('73');
  await addLine(page, 'lumber', { desc: 'y', qty: 1, price: 1000 });
  await expect(page.locator('#tax-amt')).toHaveValue('73');
  // 2000 + 400 + 73 + 300
  await expect(page.locator('#client-mat-total')).toHaveText('$2,773');
});

test('unchecking Delivery adds the $100 default, which is editable', async ({ page }) => {
  await page.locator('#del-inc').uncheck();
  await expect(page.locator('#del-amt')).toHaveValue('100');
  await expect(page.locator('#client-mat-total')).toHaveText('$400');
  await page.locator('#del-amt').fill('175');
  await expect(page.locator('#client-mat-total')).toHaveText('$475');
  // re-check and un-check again: keeps the typed amount
  await page.locator('#del-inc').check();
  await expect(page.locator('#client-mat-total')).toHaveText('$300');
  await page.locator('#del-inc').uncheck();
  await expect(page.locator('#del-amt')).toHaveValue('175');
});

test('vendor override replaces the line-item subtotal everywhere', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'x', qty: 1, price: 1000 });
  await page.locator('#auto-vendor').uncheck();
  await expect(page.locator('#vendor-or-row')).toBeVisible();
  await page.locator('#vendor-or').fill('800');
  await expect(page.locator('#vendor-disp')).toHaveText('$800');
  await expect(page.locator('#uc-hint')).toHaveText('20% of $800 = $160');
  await expect(page.locator('#client-mat-total')).toHaveText('$1,260');
  // our expense uses the override too
  await expect(page.locator('#s-e-mat')).toHaveText('$800');
  // line items still show their own totals
  await expect(page.locator('#lumber-sub-lbl')).toHaveText('$1,000');
  // back to auto
  await page.locator('#auto-vendor').check();
  await expect(page.locator('#vendor-disp')).toHaveText('$1,000');
});

test('auto tax uses the override vendor amount when Auto is off', async ({ page }) => {
  await page.locator('#auto-vendor').uncheck();
  await page.locator('#vendor-or').fill('2000');
  await page.locator('#tax-inc').uncheck();
  await expect(page.locator('#tax-amt')).toHaveValue('145'); // 2000 × 7.25%
});
