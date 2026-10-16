const { test, expect, openApp, newEstimate, addLine, seed } = require('./helpers');

test.describe('grand total, expenses, profit', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await newEstimate(page);
  });

  test('full breakdown in the summary card', async ({ page }) => {
    await addLine(page, 'lumber', { desc: 'a', qty: 10, price: 100 });   // vendor 1000
    await page.locator('#sub-daily').fill('400');
    await page.locator('#sub-days').fill('2');                          // sub 800, client 6000
    await page.locator('#cli-demo').fill('500');
    await page.locator('#mgmt-hours').fill('4');                        // mgmt 140
    // client materials = 1000 + 200 + 300 = 1500
    await expect(page.locator('#s-mat')).toHaveText('$1,500');
    await expect(page.locator('#s-lab')).toHaveText('$6,500');
    await expect(page.locator('#s-gt')).toHaveText('$8,000');
    await expect(page.locator('#gt-amount')).toHaveText('$8,000');
    // expenses = 1000 + 800 + 140
    await expect(page.locator('#s-e-mat')).toHaveText('$1,000');
    await expect(page.locator('#s-e-lab')).toHaveText('$800');
    await expect(page.locator('#s-e-mgmt')).toHaveText('$140');
    await expect(page.locator('#s-exp')).toHaveText('$1,940');
    await expect(page.locator('#s-profit')).toHaveText('$6,060');
    // 6060 / 8000 = 75.75%
    await expect(page.locator('#gt-margin')).toHaveText('75.8%');
    await expect(page.locator('#pbar-lbl')).toHaveText('75.8% profit margin');
  });

  test('upcharge and buffer are client-side only; tax and delivery we pay are costs; demo has no cost', async ({ page }) => {
    await addLine(page, 'lumber', { desc: 'a', qty: 1, price: 1000 });
    await page.locator('#tax-inc').uncheck();
    await page.locator('#del-inc').uncheck();
    await page.locator('#cli-demo').fill('250');
    // 1000 + 200 + 73 + 300 + 100 + 250
    await expect(page.locator('#gt-amount')).toHaveText('$1,923');
    // 1000 vendor + 73 tax + 100 delivery
    await expect(page.locator('#s-exp')).toHaveText('$1,173');
    await expect(page.locator('#s-e-taxdel')).toHaveText('$173');
  });

  test('margin shows a dash and empty bar label when grand total is 0', async ({ page }) => {
    await page.locator('#buf-val').fill('0');
    await expect(page.locator('#gt-amount')).toHaveText('$0');
    await expect(page.locator('#gt-margin')).toHaveText('—');
    await expect(page.locator('#pbar-lbl')).toHaveText('');
  });

  test('profit bar colour: green ≥ 40%, amber ≥ 25%, red below', async ({ page }) => {
    const fill = page.locator('#pbar-fill');
    await page.locator('#buf-val').fill('0');
    await page.locator('#cli-labor').fill('1000');
    await page.locator('#sub-cost').fill('600');   // 40%
    await expect(page.locator('#gt-margin')).toHaveText('40.0%');
    await expect(fill).toHaveCSS('background-color', 'rgb(22, 163, 74)');
    await page.locator('#sub-cost').fill('750');   // 25%
    await expect(page.locator('#gt-margin')).toHaveText('25.0%');
    await expect(fill).toHaveCSS('background-color', 'rgb(202, 138, 4)');
    await page.locator('#sub-cost').fill('760');   // 24%
    await expect(fill).toHaveCSS('background-color', 'rgb(220, 38, 38)');
    await expect(fill).toHaveAttribute('style', /width: 24%/);
  });

  test('a loss shows a negative margin and an empty bar', async ({ page }) => {
    await page.locator('#buf-val').fill('0');
    await page.locator('#cli-labor').fill('1000');
    await page.locator('#sub-cost').fill('1500');
    await expect(page.locator('#gt-margin')).toHaveText('-50.0%');
    await expect(page.locator('#pbar-fill')).toHaveAttribute('style', /width: 0%/);
  });

  test('negative profit is formatted as "-$500"', async ({ page }) => {
    await page.locator('#buf-val').fill('0');
    await page.locator('#cli-labor').fill('1000');
    await page.locator('#sub-cost').fill('1500');
    await expect(page.locator('#s-profit')).toHaveText('-$500');
  });
});

test.describe('currency formatting & rounding', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await newEstimate(page);
    await page.locator('#buf-val').fill('0');
    await page.locator('#uc-val').fill('0');
  });

  const cases = [
    { price: '0.4', shown: '$0' },
    { price: '0.5', shown: '$1' },
    { price: '1234.5', shown: '$1,235' },
    { price: '999.49', shown: '$999' },
    { price: '1234567.89', shown: '$1,234,568' },
  ];
  for (const c of cases) {
    test(`$${c.price} displays as ${c.shown}`, async ({ page }) => {
      await addLine(page, 'lumber', { desc: 'x', qty: 1, price: c.price });
      await expect(page.locator('#vendor-disp')).toHaveText(c.shown);
      await expect(page.locator('#gt-amount')).toHaveText(c.shown);
    });
  }

  test('totals are computed on unrounded line values', async ({ page }) => {
    // three lines of 1 × $0.40 each show $0, but sum to $1.20 → $1
    for (let i = 0; i < 3; i++) await addLine(page, 'hardware', { desc: 'n' + i, qty: 1, price: 0.4 });
    await expect(page.locator('#hardware-tb .irow-tot').first()).toHaveText('$0.40');
    await expect(page.locator('#vendor-disp')).toHaveText('$1');
  });

  test('cents survive in storage even though display is whole dollars', async ({ page }) => {
    await addLine(page, 'lumber', { desc: 'x', qty: 3, price: 2.49 });
    await expect(page.locator('#lumber-sub-lbl')).toHaveText('$7');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('est-builder-v4')));
    expect(stored.ests[0].lumber[0].unitPrice).toBe(2.49);
  });
});

test.describe('estimate list', () => {
  test('list shows each estimate\'s grand total, name, company, PM and status', async ({ page }) => {
    await openApp(page);
    await newEstimate(page);
    await page.locator('#f-client').fill('Smith Deck');
    await page.locator('#f-pm').selectOption('Keri');
    await page.locator('#f-status').selectOption('sent');
    await addLine(page, 'lumber', { desc: 'a', qty: 10, price: 100 });
    await page.locator('#sub-days').fill('1');
    await page.locator('#cli-demo').fill('250');
    await expect(page.locator('#gt-amount')).toHaveText('$4,750');
    await page.getByRole('button', { name: 'Save & Back' }).click();
    const card = page.locator('.est-card').filter({ hasText: 'Smith Deck' });
    await expect(card.locator('.ec-total')).toHaveText('$4,750');
    await expect(card.locator('.ec-meta')).toHaveText('PM: Keri · sent');
  });

  test('list total matches the editor for $-mode upcharge, override, tax and delivery', async ({ page }) => {
    await seed(page, {
      ests: [{
        id: 'e1', client: 'Seeded', company: '', pm: '', pmOther: '', status: 'draft', address: '', notes: '',
        lumber: [{ qty: 3, desc: 'x', unitPrice: 2.49 }], hardware: [],
        pr: { auto: false, orv: 1500, taxInc: false, tax: 109, ucMode: '$', ucVal: 250, buf: 150, delInc: false, del: 85 },
        lb: { name: '', days: '', daily: 0, subCost: 0, cliLab: 4000, cliDemo: 125 },
        mgmtLabor: 0, mgmtHours: 0,
      }],
      cur: null,
    });
    // 1500 + 250 + 109 + 150 + 85 + 4000 + 125
    await expect(page.locator('.est-card .ec-total')).toHaveText('$6,219');
    await page.locator('.est-card').click();
    await expect(page.locator('#gt-amount')).toHaveText('$6,219');
  });

  test('an empty estimate shows a dash in the list', async ({ page }) => {
    await openApp(page);
    await newEstimate(page);
    await page.locator('#buf-val').fill('0');
    await page.getByRole('button', { name: 'Save & Back' }).click();
    await expect(page.locator('.est-card .ec-name')).toHaveText('Untitled Estimate');
    await expect(page.locator('.est-card .ec-total')).toHaveText('—');
  });
});
