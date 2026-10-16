const {
  test, expect, openApp, newEstimate, currentEst, stored, answerNextPrompt,
  openManage, closeManage, setMenuRate, addSubViaMenu,
} = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await newEstimate(page);
});

test.describe('labor from days', () => {
  test('sub cost = days × sub rate, client labor = days × $3,000', async ({ page }) => {
    await page.locator('#sub-daily').fill('400');
    await page.locator('#sub-days').fill('3');
    await expect(page.locator('#sub-cost')).toHaveValue('1200');
    await expect(page.locator('#cli-labor')).toHaveValue('9000');
    await expect(page.locator('#s-lab')).toHaveText('$9,000');
    await expect(page.locator('#s-e-lab')).toHaveText('$1,200');
    const e = await currentEst(page);
    expect(e.lb).toMatchObject({ days: '3', daily: 400, subCost: 1200, cliLab: 9000 });
  });

  test('half days', async ({ page }) => {
    await page.locator('#sub-days').fill('2.5');
    await page.locator('#sub-daily').fill('425');
    await expect(page.locator('#sub-cost')).toHaveValue('1062.5');
    await expect(page.locator('#cli-labor')).toHaveValue('7500');
    await expect(page.locator('#s-e-lab')).toHaveText('$1,063'); // 1062.50 rounds up
  });

  test('computed sub cost is rounded to cents', async ({ page }) => {
    await page.locator('#sub-days').fill('2.5');
    await page.locator('#sub-daily').fill('333.33');
    await expect(page.locator('#sub-cost')).toHaveValue(/^833\.3\d{0,2}$/); // 833.32/833.33/833.325 — any sane rounding
  });

  test('changing the sub rate recalculates sub cost but not the client charge', async ({ page }) => {
    await page.locator('#sub-days').fill('2');
    await page.locator('#sub-daily').fill('400');
    await expect(page.locator('#sub-cost')).toHaveValue('800');
    await page.locator('#sub-daily').fill('500');
    await expect(page.locator('#sub-cost')).toHaveValue('1000');
    await expect(page.locator('#cli-labor')).toHaveValue('6000');
  });

  test('clearing days clears both computed amounts', async ({ page }) => {
    await page.locator('#sub-daily').fill('400');
    await page.locator('#sub-days').fill('2');
    await page.locator('#sub-days').fill('');
    await expect(page.locator('#sub-cost')).toHaveValue('');
    await expect(page.locator('#cli-labor')).toHaveValue('');
    await expect(page.locator('#gt-amount')).toHaveText('$300');
  });

  test('computed amounts can be overridden by hand', async ({ page }) => {
    await page.locator('#sub-daily').fill('400');
    await page.locator('#sub-days').fill('2');
    await page.locator('#cli-labor').fill('5500');
    await page.locator('#sub-cost').fill('750');
    await expect(page.locator('#s-lab')).toHaveText('$5,500');
    await expect(page.locator('#s-e-lab')).toHaveText('$750');
  });

  test('demo charge adds to client labor only', async ({ page }) => {
    await page.locator('#sub-days').fill('1');
    await page.locator('#cli-demo').fill('250');
    await expect(page.locator('#s-lab')).toHaveText('$3,250');
    await expect(page.locator('#gt-amount')).toHaveText('$3,550'); // + $300 buffer
    await expect(page.locator('#s-exp')).toHaveText('$0');
  });
});

test.describe('subs', () => {
  test('picking a saved sub fills its daily rate and recalculates', async ({ page }) => {
    await openManage(page);
    await addSubViaMenu(page, 'Bob Framing', 400);
    await addSubViaMenu(page, 'Ann Decks', 350);
    await closeManage(page);
    await page.locator('#sub-days').fill('2');
    await page.locator('#sub-sel').selectOption('Bob Framing');
    await expect(page.locator('#sub-daily')).toHaveValue('400');
    await expect(page.locator('#sub-cost')).toHaveValue('800');
    await page.locator('#sub-sel').selectOption('Ann Decks');
    await expect(page.locator('#sub-daily')).toHaveValue('350');
    await expect(page.locator('#sub-cost')).toHaveValue('700');
    expect((await currentEst(page)).lb.name).toBe('Ann Decks');
  });

  test('"+ Add new sub" prompts for a name and selects it', async ({ page }) => {
    answerNextPrompt(page, 'Carl Concrete');
    await page.locator('#sub-sel').selectOption('__add__');
    await expect(page.locator('#sub-sel')).toHaveValue('Carl Concrete');
    await page.locator('#sub-daily').fill('425');
    await page.locator('#sub-days').fill('1');
    await expect(page.locator('#sub-cost')).toHaveValue('425');
    // daily rate typed on the estimate is remembered on the sub
    expect((await stored(page)).subs).toEqual([{ name: 'Carl Concrete', daily: 425 }]);
  });

  test('a sub rate edited in the menu is not reverted by the open estimate', async ({ page }) => {
    await openManage(page);
    await addSubViaMenu(page, 'Bob Framing', 400);
    await closeManage(page);
    await page.locator('#sub-sel').selectOption('Bob Framing');
    await openManage(page);
    const rate = page.locator('#sub-list .mg-row').filter({ hasText: 'Bob Framing' }).locator('input');
    await rate.fill('450');
    await rate.blur();
    await closeManage(page);
    await page.locator('#f-client').fill('Smith deck');
    expect((await stored(page)).subs).toEqual([{ name: 'Bob Framing', daily: 450 }]);
  });
});

test.describe('managing labor from hours', () => {
  test('hours × $35/hr by default', async ({ page }) => {
    await expect(page.locator('#mgmt-rate-badge')).toHaveText('$35/hr');
    await page.locator('#mgmt-hours').fill('4');
    await expect(page.locator('#mgmt-labor')).toHaveValue('140');
    await expect(page.locator('#s-e-mgmt')).toHaveText('$140');
    await expect(page.locator('#s-exp')).toHaveText('$140');
    // it's our cost, not charged to the client
    await expect(page.locator('#gt-amount')).toHaveText('$300');
  });

  test('fractional hours', async ({ page }) => {
    await page.locator('#mgmt-hours').fill('2.5');
    await expect(page.locator('#mgmt-labor')).toHaveValue('87.5');
    await expect(page.locator('#s-e-mgmt')).toHaveText('$88');
  });

  test('amount can be typed by hand, and clearing hours keeps it', async ({ page }) => {
    await page.locator('#mgmt-hours').fill('4');
    await page.locator('#mgmt-labor').fill('200');
    await expect(page.locator('#s-e-mgmt')).toHaveText('$200');
    await page.locator('#mgmt-hours').fill('');
    await expect(page.locator('#mgmt-labor')).toHaveValue('200');
    const e = await currentEst(page);
    expect(e).toMatchObject({ mgmtLabor: 200, mgmtHours: 0 });
  });
});

test.describe('rates in the menu', () => {
  test('menu shows the defaults', async ({ page }) => {
    await openManage(page);
    await expect(page.locator('#rate-clientday')).toHaveValue('3000');
    await expect(page.locator('#rate-mgmthr')).toHaveValue('35');
  });

  test('changing client $/day recalculates the open estimate and the badge', async ({ page }) => {
    await page.locator('#sub-days').fill('2');
    await expect(page.locator('#cli-labor')).toHaveValue('6000');
    await openManage(page);
    await setMenuRate(page, 'clientDay', 3200);
    await closeManage(page);
    await expect(page.locator('#cli-rate-badge')).toHaveText('$3,200/day');
    await expect(page.locator('#cli-labor')).toHaveValue('6400');
    await expect(page.locator('#s-lab')).toHaveText('$6,400');
  });

  test('changing managing $/hr recalculates the open estimate and the badge', async ({ page }) => {
    await page.locator('#mgmt-hours').fill('3');
    await openManage(page);
    await setMenuRate(page, 'mgmtHr', 40);
    await closeManage(page);
    await expect(page.locator('#mgmt-rate-badge')).toHaveText('$40/hr');
    await expect(page.locator('#mgmt-labor')).toHaveValue('120');
  });

  test('new rates apply to estimates created afterwards', async ({ page }) => {
    await page.getByRole('button', { name: 'Save & Back' }).click();
    await openManage(page);
    await setMenuRate(page, 'clientDay', 2800);
    await setMenuRate(page, 'mgmtHr', 50);
    await closeManage(page);
    expect((await stored(page)).settings).toEqual({ clientDayRate: 2800, mgmtHourRate: 50 });
    await newEstimate(page);
    await page.locator('#sub-days').fill('1.5');
    await page.locator('#mgmt-hours').fill('2');
    await expect(page.locator('#cli-labor')).toHaveValue('4200');
    await expect(page.locator('#mgmt-labor')).toHaveValue('100');
  });

  test('changing a menu rate keeps hand-entered labor numbers', async ({ page }) => {
    await page.locator('#cli-labor').fill('4500');
    await page.locator('#sub-cost').fill('1200');
    await openManage(page);
    await setMenuRate(page, 'mgmtHr', 40);
    await closeManage(page);
    await expect(page.locator('#cli-labor')).toHaveValue('4500');
    await expect(page.locator('#sub-cost')).toHaveValue('1200');
  });

  test('picking a sub keeps hand-entered labor numbers when Days is blank', async ({ page }) => {
    await openManage(page);
    await addSubViaMenu(page, 'Bob Framing', 400);
    await closeManage(page);
    await page.locator('#cli-labor').fill('4500');
    await page.locator('#sub-sel').selectOption('Bob Framing');
    await expect(page.locator('#cli-labor')).toHaveValue('4500');
  });
});

test.describe('hand-typed amounts', () => {
  test('typing the sub\'s daily rate keeps hand-typed amounts', async ({ page }) => {
    await page.locator('#sub-cost').fill('2400');
    await page.locator('#cli-labor').fill('5000');
    await page.locator('#sub-daily').fill('400');
    await expect(page.locator('#sub-cost')).toHaveValue('2400');
    await expect(page.locator('#cli-labor')).toHaveValue('5000');
    await expect(page.locator('#gt-amount')).toHaveText('$5,300');
  });

  test('changing days keeps a typed labor charge, and the badge says it was typed', async ({ page }) => {
    await page.locator('#sub-days').fill('2');
    await page.locator('#cli-labor').fill('4500');
    await expect(page.locator('#cli-rate-badge')).toHaveText('typed');
    await page.locator('#sub-days').fill('3');
    await expect(page.locator('#cli-labor')).toHaveValue('4500');
    // clearing the field hands it back to auto-calc
    await page.locator('#cli-labor').fill('');
    await page.locator('#sub-days').fill('2');
    await expect(page.locator('#cli-labor')).toHaveValue('6000');
    await expect(page.locator('#cli-rate-badge')).toHaveText('$3,000/day');
  });

  test('typed amounts stay typed after a reload', async ({ page }) => {
    await page.locator('#sub-days').fill('2');
    await page.locator('#cli-labor').fill('4500');
    await page.reload();
    await page.locator('.est-card').click();
    await page.locator('#sub-days').fill('4');
    await expect(page.locator('#cli-labor')).toHaveValue('4500');
  });

  test('a changed menu rate leaves estimates with no days alone', async ({ page }) => {
    await page.locator('#mgmt-labor').fill('250');
    await openManage(page);
    await setMenuRate(page, 'mgmtHr', 50);
    await setMenuRate(page, 'clientDay', 3500);
    await closeManage(page);
    await expect(page.locator('#mgmt-labor')).toHaveValue('250');
  });
});
