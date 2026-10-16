// End-to-end flows: set up a company, build an estimate, open Share, and check
// that the preview document and the copyable text agree with the editor.
const {
  test, expect, openApp, newEstimate, addLine, openQuickPick, rows,
  answerNextPrompt, openManage, closeManage, setMenuRate, addSubViaMenu,
  addCompanyViaMenu, docRow,
} = require('./helpers');

/** Read the editor's headline numbers so the share doc can be compared to them. */
async function editorNumbers(page) {
  const t = id => page.locator(id).textContent();
  return {
    vendor: await t('#vendor-disp'),
    clientMat: await t('#client-mat-total'),
    clientLab: await t('#s-lab'),
    grand: await t('#gt-amount'),
    margin: await t('#gt-margin'),
    expVendor: await t('#s-e-mat'),
    expSub: await t('#s-e-lab'),
    expMgmt: await t('#s-e-mgmt'),
    expenses: await t('#s-exp'),
    profit: await t('#s-profit'),
  };
}

async function openShare(page) {
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.locator('#share-modal')).toHaveClass(/on/);
}

async function showInternal(page) {
  await page.locator('#sk-internal').click();
  await expect(page.locator('#share-preview .doc-title .t')).toHaveText('INTERNAL');
}

/** The customer version must never show our costs, markup, profit or margin. */
async function expectCustomerDocClean(page, n) {
  const doc = page.locator('#share-preview');
  await expect(page.locator('#sk-client')).toHaveClass(/on/);
  await expect(doc.locator('.doc-title .t')).toHaveText('ESTIMATE');
  for (const word of ['our cost', 'Internal', 'Profit', 'MARGIN', 'Upcharge', 'Buffer', 'Vendor', 'Expenses', 'Status', '%'])
    await expect(doc).not.toContainText(word);
  // no unit prices or line totals in the item tables
  await expect(doc.locator('.doc-tbl thead th', { hasText: /Unit|Total/ })).toHaveCount(0);
  await expect(docRow(page, 'Materials (tax & delivery included)')).toHaveText(n.clientMat);
  await expect(page.locator('#share-preview .doc-total .amt')).toHaveText([n.grand]);
  const txt = await page.locator('#share-txt').inputValue();
  for (const word of ['stand to make', 'margin', 'Upcharge', 'Buffer', 'Vendor', 'Expenses', 'Managing'])
    expect(txt).not.toContain(word);
  expect(txt).toContain(`Materials (tax & delivery included): ${n.clientMat}`);
  expect(txt).toContain(`Total: ${n.grand}`);
}

async function expectDocMatchesEditor(page, n) {
  await expect(docRow(page, 'Vendor subtotal')).toHaveText(n.vendor);
  await expect(docRow(page, 'Client Materials Total')).toHaveText(n.clientMat);
  await expect(docRow(page, 'Client Labor Total')).toHaveText(n.clientLab);
  await expect(page.locator('#share-preview .doc-total .amt').first()).toHaveText(n.grand);
  await expect(page.locator('#share-preview .doc-total .amt').last()).toHaveText(n.margin);
  await expect(docRow(page, 'Vendor materials')).toHaveText(n.expVendor);
  if (n.expTaxDel) await expect(docRow(page, 'Tax & delivery paid')).toHaveText(n.expTaxDel);
  await expect(docRow(page, 'Sub labor')).toHaveText(n.expSub);
  await expect(docRow(page, 'Total Expenses')).toHaveText(n.expenses);
  await expect(docRow(page, 'Profit')).toHaveText(`${n.profit} (${n.margin})`);
}

test('flow 1: company from dropdown, quick picks, sub by days, % upcharge → share', async ({ page }) => {
  await openApp(page);
  await openManage(page);
  await addSubViaMenu(page, 'Bob Framing', 400);
  await closeManage(page);

  await newEstimate(page);
  await page.locator('#f-client').fill('Henderson Deck');
  answerNextPrompt(page, 'Acme Builders');
  await page.locator('#f-companysel').selectOption('__add__');
  await expect(page.locator('#f-companysel')).toHaveValue('Acme Builders');
  await page.locator('#f-pm').selectOption('Jake');
  await page.locator('#f-address').fill('88 Canyon Rd, Orem, UT');

  // Lumber: 10 × 2x4 8' @ 4.25 + 4 × 4x4 8' @ 18.75 = 117.50
  const lp = await openQuickPick(page, 'lumber');
  await lp.getByRole('button', { name: '8\'', exact: true }).first().click();
  await rows(page, 'lumber').nth(0).locator('.iinp.qty').fill('10');
  await rows(page, 'lumber').nth(0).locator('.iinp.price').fill('4.25');
  await lp.getByRole('button', { name: '4x4 8\'', exact: true }).click();
  await rows(page, 'lumber').nth(1).locator('.iinp.qty').fill('4');
  await rows(page, 'lumber').nth(1).locator('.iinp.price').fill('18.75');
  // Hardware: 20 × H2.5 @ 1.10 + 2 × LUS28 @ 3.45 = 28.90
  await addLine(page, 'hardware', { desc: 'H2.5', qty: 20, price: 1.1 });
  await addLine(page, 'hardware', { desc: 'LUS28', qty: 2, price: 3.45 });

  // Labor: Bob, 2.5 days → our cost 1000, client 7500; demo 250
  await page.locator('#sub-sel').selectOption('Bob Framing');
  await page.locator('#sub-days').fill('2.5');
  await page.locator('#cli-demo').fill('250');
  // Managing labor: 4 h × $35 = 140
  await page.locator('#mgmt-hours').fill('4');

  // vendor 146.40 → +20% 29.28 → +300 buffer = 475.68
  // grand = 475.68 + 7750 = 8225.68; expenses = 146.40 + 1000 + 140 = 1286.40
  // profit = 6939.28; margin = 84.36%
  const n = await editorNumbers(page);
  expect(n).toEqual({
    vendor: '$146', clientMat: '$476', clientLab: '$7,750', grand: '$8,226', margin: '84.4%',
    expVendor: '$146', expSub: '$1,000', expMgmt: '$140', expenses: '$1,286', profit: '$6,939',
  });

  await openShare(page);
  const doc = page.locator('#share-preview');
  await expect(doc.locator('.doc-job')).toHaveText('Henderson Deck');
  await expect(doc.locator('.doc-meta')).toContainText('Acme Builders');
  await expect(doc.locator('.doc-meta')).toContainText('Jake');
  await expect(doc.locator('.doc-meta')).toContainText('88 Canyon Rd, Orem, UT');

  // customer version (the default)
  await expectCustomerDocClean(page, n);
  await expect(docRow(page, 'Labor')).toHaveText('$7,500');
  await expect(docRow(page, 'Demo')).toHaveText('$250');
  await expect(doc.locator('.doc-tbl').nth(0).locator('tbody tr').nth(0).locator('td')).toHaveText(['10', '2x4 8\'']);

  await showInternal(page);
  await expectDocMatchesEditor(page, n);

  // line item tables, with cents
  const lumberRows = doc.locator('.doc-tbl').nth(0).locator('tbody tr');
  await expect(lumberRows).toHaveCount(2);
  await expect(lumberRows.nth(0).locator('td')).toHaveText(['10', '2x4 8\'', '$4.25', '$42.50']);
  await expect(lumberRows.nth(1).locator('td')).toHaveText(['4', '4x4 8\'', '$18.75', '$75.00']);
  const hwRows = doc.locator('.doc-tbl').nth(1).locator('tbody tr');
  await expect(hwRows.nth(0).locator('td')).toHaveText(['20', 'H2.5', '$1.10', '$22.00']);
  await expect(hwRows.nth(1).locator('td')).toHaveText(['2', 'LUS28', '$3.45', '$6.90']);

  // materials / labor breakdown rows
  await expect(docRow(page, 'Taxes (included)')).toHaveText('$0');
  await expect(docRow(page, 'Upcharge (20%)')).toHaveText('$29');
  await expect(docRow(page, 'Buffer')).toHaveText('$300');
  await expect(docRow(page, 'Delivery (included)')).toHaveText('$0');
  await expect(docRow(page, 'Bob Framing — 2.5 days')).toHaveText('our cost $1,000');
  await expect(docRow(page, 'Labor charge')).toHaveText('$7,500');
  await expect(docRow(page, 'Demo charge')).toHaveText('$250');
  await expect(docRow(page, 'Managing labor & expenses')).toHaveText('$140');

  // plain-text share
  const txt = await page.locator('#share-txt').inputValue();
  expect(txt).toContain('Henderson Deck\nCompany: Acme Builders\nPM: Jake\nAddress: 88 Canyon Rd, Orem, UT');
  expect(txt).toContain('\t(10) 2x4 8\'  — $42.50');
  expect(txt).toContain('\tVendor subtotal: $146\n\tTaxes: included\n\tUpcharge: $29 (20%)\n\tBuffer: $300\n\tDelivery: included\n\tTotal: $476');
  expect(txt).toContain('\tBob Framing, 2.5 days, $1,000');
  expect(txt).toContain('\tWe charge: $7,750 ($250 for demo)');
  expect(txt).toContain('Grand total: $8,226');
  expect(txt).toContain('\tLabor: $1,000\n\tManaging labor & expenses: $140\n\tMaterials: $146\n\tTotal: $1,286');
  expect(txt).toContain('We stand to make: $6,939 (profit margin: ~84%)');

  // list view agrees after closing
  await page.locator('#share-modal .sm-close').click();
  await page.getByRole('button', { name: 'Save & Back' }).click();
  await expect(page.locator('.est-card').filter({ hasText: 'Henderson Deck' }).locator('.ec-total')).toHaveText('$8,226');
});

test('flow 2: menu rates + company, $ upcharge, tax & delivery charged → share', async ({ page }) => {
  await openApp(page);
  await openManage(page);
  await setMenuRate(page, 'clientDay', 3200);
  await setMenuRate(page, 'mgmtHr', 40);
  await addCompanyViaMenu(page, 'Zeta Homes');
  await addSubViaMenu(page, 'Ann Decks', 350);
  await closeManage(page);

  await newEstimate(page);
  await page.locator('#f-client').fill('Garcia Pergola');
  await page.locator('#f-companysel').selectOption('Zeta Homes');
  await expect(page.locator('#cli-rate-badge')).toHaveText('$3,200/day');

  const lp = await openQuickPick(page, 'lumber');
  await lp.getByRole('button', { name: '3/4 Ply', exact: true }).click();
  const row = rows(page, 'lumber').first();
  await row.locator('.iinp.qty').fill('12');
  await row.locator('.iinp.price').fill('52');                  // 624
  await page.locator('#uc-dollar').click();
  await page.locator('#uc-val').fill('150');
  await page.locator('#tax-inc').uncheck();                      // 624 × 7.25% = 45.24 → 45
  await page.locator('#del-inc').uncheck();                      // 100
  await page.locator('#sub-sel').selectOption('Ann Decks');
  await page.locator('#sub-days').fill('1');                     // 350 / 3200
  await page.locator('#mgmt-hours').fill('2');                   // 80

  // client materials = 624 + 150 + 45 + 300 + 100 = 1219; grand = 4419
  // expenses = 624 + 45 tax + 100 delivery (we pay them) + 350 + 80 = 1199
  // profit = 3220; margin = 72.87%
  const n = await editorNumbers(page);
  expect(n).toEqual({
    vendor: '$624', clientMat: '$1,219', clientLab: '$3,200', grand: '$4,419', margin: '72.9%',
    expVendor: '$624', expSub: '$350', expMgmt: '$80', expenses: '$1,199', profit: '$3,220',
  });
  n.expTaxDel = '$145';
  await expect(page.locator('#s-e-taxdel')).toHaveText('$145');

  await openShare(page);
  await expectCustomerDocClean(page, n);
  await showInternal(page);
  await expectDocMatchesEditor(page, n);
  await expect(docRow(page, 'Taxes')).toHaveText('$45');
  await expect(docRow(page, 'Upcharge')).toHaveText('$150');
  await expect(docRow(page, 'Delivery')).toHaveText('$100');
  await expect(docRow(page, 'Ann Decks — 1 day')).toHaveText('our cost $350');
  await expect(page.locator('#share-preview .doc-row', { hasText: 'Demo charge' })).toHaveCount(0);

  const txt = await page.locator('#share-txt').inputValue();
  expect(txt).toContain('\tTaxes: $45 (Utah 7.25%)\n\tUpcharge: $150\n\tBuffer: $300\n\tDelivery: $100\n\tTotal: $1,219');
  expect(txt).toContain('\tWe charge: $3,200\n');
  expect(txt).toContain('Grand total: $4,419');
  expect(txt).toContain('\tMaterials: $624\n\tTax & delivery paid: $145\n\tTotal: $1,199');
  expect(txt).toContain('We stand to make: $3,220 (profit margin: ~73%)');

  // editing after closing Share is reflected the next time it opens
  await page.locator('#share-modal .sm-close').click();
  await page.locator('#cli-demo').fill('500');
  await openShare(page);
  await expect(page.locator('#share-preview .doc-total .amt').first()).toHaveText('$4,919');
  await expect(docRow(page, 'Demo')).toHaveText('$500');
  await showInternal(page);
  await expect(docRow(page, 'Demo charge')).toHaveText('$500');
});

test('share document lists priced items even without a description, and skips empty rows', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await addLine(page, 'lumber', { desc: 'Real item', qty: 2, price: 10 });
  await addLine(page, 'lumber', { qty: 1, price: 99 }); // no description, still priced
  await addLine(page, 'lumber');                         // blank row: left out
  await openShare(page);
  const trs = page.locator('#share-preview .doc-tbl tbody tr');
  await expect(trs).toHaveCount(2);
  await expect(trs.nth(1).locator('td')).toHaveText(['1', '(no description)']);
  await showInternal(page);
  await expect(docRow(page, 'Vendor subtotal')).toHaveText('$119');
});

test('customer document only includes job notes when asked', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await page.locator('#f-notes').fill('Customer wants it cheap');
  await openShare(page);
  await expect(page.locator('#share-preview')).not.toContainText('Customer wants it cheap');
  expect(await page.locator('#share-txt').inputValue()).not.toContain('Customer wants it cheap');
  await page.locator('#share-notes').check();
  await expect(page.locator('#share-preview')).toContainText('Customer wants it cheap');
  expect(await page.locator('#share-txt').inputValue()).toContain('Customer wants it cheap');
});

test('qty 0 rows are left off the share document', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await addLine(page, 'lumber', { desc: 'keep', qty: 2, price: 10 });
  const r = await addLine(page, 'lumber', { desc: 'skip', price: 10 });
  await r.locator('.iinp.qty').fill('0');
  await openShare(page);
  await expect(page.locator('#share-preview .doc-tbl tbody tr')).toHaveCount(1);
});

test('internal document shows unit prices with cents', async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
  await addLine(page, 'lumber', { desc: '2x4 8\'', qty: 3, price: 2.49 });
  await openShare(page);
  await showInternal(page);
  await expect(page.locator('#share-preview .doc-tbl tbody tr td').nth(2)).toHaveText('$2.49');
});
