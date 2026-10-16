const {
  test, expect, openApp, newEstimate, addLine, rows, openQuickPick,
  currentEst, stored, openManage, closeManage,
} = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
});

test('line total is qty × unit price', async ({ page }) => {
  const row = await addLine(page, 'lumber', { desc: '2x4 8\'', qty: 12, price: 4.25 });
  await expect(row.locator('.irow-tot')).toHaveText('$51.00');
  const e = await currentEst(page);
  expect(e.lumber).toEqual([{ qty: 12, desc: '2x4 8\'', unitPrice: 4.25, autoPriced: false }]);
});

test('line total shows a dash until both qty and price are set', async ({ page }) => {
  const row = await addLine(page, 'hardware', { desc: 'H1' });
  await expect(row.locator('.irow-tot')).toHaveText('—');
  await row.locator('.iinp.price').fill('0.89');
  await expect(row.locator('.irow-tot')).toHaveText('$0.89'); // line totals keep cents
});

test('section subtotals sum their own rows only', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'a', qty: 10, price: 4.25 });   // 42.50
  await addLine(page, 'lumber', { desc: 'b', qty: 4, price: 18.75 });   // 75.00
  await addLine(page, 'hardware', { desc: 'c', qty: 20, price: 1.1 });  // 22.00
  await addLine(page, 'hardware', { desc: 'd', qty: 2, price: 3.45 });  // 6.90
  await expect(page.locator('#lumber-sub-lbl')).toHaveText('$118');      // 117.50
  await expect(page.locator('#hardware-sub-lbl')).toHaveText('$29');    // 28.90
  // vendor subtotal uses unrounded sums: 146.40, not 118 + 29
  await expect(page.locator('#vendor-disp')).toHaveText('$146');
});

test('subtotal label is hidden when the section totals zero', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'no price yet', qty: 3 });
  await expect(page.locator('#lumber-sub-lbl')).toHaveText('');
});

test('removing a row updates the totals', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'keep', qty: 2, price: 10 });
  await addLine(page, 'lumber', { desc: 'drop', qty: 1, price: 500 });
  await expect(page.locator('#vendor-disp')).toHaveText('$520');
  await rows(page, 'lumber').nth(1).locator('.del-btn').click();
  await expect(rows(page, 'lumber')).toHaveCount(1);
  await expect(page.locator('#vendor-disp')).toHaveText('$20');
  expect((await currentEst(page)).lumber.map(i => i.desc)).toEqual(['keep']);
});

test('quick pick adds a row with qty 1 and that description', async ({ page }) => {
  const panel = await openQuickPick(page, 'lumber');
  await panel.getByRole('button', { name: '8\' PT', exact: true }).first().click();
  const row = rows(page, 'lumber').first();
  await expect(row.locator('.iinp.desc')).toHaveValue('2x4 8\' PT');
  await expect(row.locator('.iinp.qty')).toHaveValue('1');
  await expect(row.locator('.iinp.price')).toHaveValue('');
  // the keyboard isn't opened, so the chips don't jump around
  await expect(row.locator('.iinp.price')).not.toBeFocused();
});

test('tapping the same quick pick again adds to that row\'s qty', async ({ page }) => {
  const panel = await openQuickPick(page, 'lumber');
  const chip = panel.getByRole('button', { name: '16\'', exact: true }).first();
  await chip.click();
  await chip.click();
  await chip.click();
  await expect(rows(page, 'lumber')).toHaveCount(1);
  await expect(rows(page, 'lumber').first().locator('.iinp.qty')).toHaveValue('3');
});

test('removing a row can be undone', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'a', qty: 1, price: 10 });
  await addLine(page, 'lumber', { desc: 'b', qty: 1, price: 20 });
  await rows(page, 'lumber').nth(0).locator('.del-btn').click();
  await expect(page.locator('#toast')).toContainText('Removed "a"');
  await page.locator('#toast-act').click();
  await expect(rows(page, 'lumber')).toHaveCount(2);
  expect((await currentEst(page)).lumber.map(i => i.desc)).toEqual(['a', 'b']);
  await expect(page.locator('#vendor-disp')).toHaveText('$30');
});

test('entering a unit price saves it to the price book (case/space-insensitive key)', async ({ page }) => {
  await addLine(page, 'hardware', { desc: '  LUS28 ', price: 3.45 });
  expect((await stored(page)).prices).toEqual({ lus28: 3.45 });
});

test('quick pick autofills a price learned earlier', async ({ page }) => {
  await addLine(page, 'hardware', { desc: 'H2.5', qty: 1, price: 1.1 });
  await rows(page, 'hardware').nth(0).locator('.del-btn').click();
  const panel = await openQuickPick(page, 'hardware');
  await panel.getByRole('button', { name: 'H2.5', exact: true }).click();
  const row = rows(page, 'hardware').nth(0);
  await expect(row.locator('.iinp.price')).toHaveValue('1.1');
  await row.locator('.iinp.qty').fill('20');
  await expect(row.locator('.irow-tot')).toHaveText('$22.00');
  await expect(page.locator('#hardware-sub-lbl')).toHaveText('$22');
});

test('typing a known description autofills its price', async ({ page }) => {
  await addLine(page, 'lumber', { desc: '3/4 Plywood', price: 52 });
  const row = await addLine(page, 'lumber', { desc: '3/4 plywood' });
  await expect(row.locator('.iinp.price')).toHaveValue('52');
  await expect(row.locator('.irow-tot')).toHaveText('$52.00');
});

test('autofill never overwrites a price already on the row', async ({ page }) => {
  await addLine(page, 'lumber', { desc: 'OSB', price: 20 });
  const row = await addLine(page, 'lumber', { price: 25 });
  await row.locator('.iinp.desc').fill('osb');
  await expect(row.locator('.iinp.price')).toHaveValue('25');
});

test('price book entries can be edited and removed in the menu', async ({ page }) => {
  await addLine(page, 'hardware', { desc: 'A35', price: 1 });
  await addLine(page, 'hardware', { desc: 'H1', price: 0.75 });
  await openManage(page);
  const list = page.locator('#price-list');
  await expect(list.locator('.mg-row .nm')).toHaveText(['a35', 'h1']);
  const a35 = list.locator('.mg-row').filter({ hasText: 'a35' }).locator('input');
  await a35.fill('1.25');
  await a35.blur();
  await list.locator('.mg-row').filter({ hasText: 'h1' }).locator('.mg-x').click();
  expect((await stored(page)).prices).toEqual({ a35: 1.25 });
  await closeManage(page);
  const row = await addLine(page, 'hardware', { desc: 'a35' });
  await expect(row.locator('.iinp.price')).toHaveValue('1.25');
});

test('a qty of 0 is priced as 0', async ({ page }) => {
  const row = await addLine(page, 'lumber', { desc: 'not needed', price: 100 });
  await row.locator('.iinp.qty').fill('0');
  await expect(row.locator('.iinp.qty')).toHaveValue('0');
  await expect(page.locator('#vendor-disp')).toHaveText('$0');
});

test('price autofill follows the description as it is typed', async ({ page }) => {
  // The price book knows "2x4 8'" at $4 and "2x4 8' PT" at $6. Typing the PT
  // name passes through "2x4 8'" on the way; the auto-filled $4 must give way to $6.
  await addLine(page, 'lumber', { desc: '2x4 8\'', price: 4 });
  await addLine(page, 'lumber', { desc: '2x4 8\' PT', price: 6 });
  const row = await addLine(page, 'lumber');
  await row.locator('.iinp.desc').pressSequentially('2x4 8\' PT');
  await expect(row.locator('.iinp.price')).toHaveValue('6');
  // and a description with no saved price clears an auto-filled one
  await row.locator('.iinp.desc').fill('2x4 8\' PT custom');
  await expect(row.locator('.iinp.price')).toHaveValue('');
});
