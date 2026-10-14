const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://localhost:8765/index.html');
  await p.click('text=New Estimate');
  await p.fill('#sub-cost', '2400'); await p.fill('#cli-labor', '5000');
  await p.locator('#sub-days').evaluate(e => e.scrollIntoView({ block: 'start' }));
  await p.evaluate(() => scrollBy(0, -120));
  await p.screenshot({ path: '/home/user/estimates/reports/screenshots/05a-labor-before.png' });
  await p.fill('#sub-daily', '400');
  await p.screenshot({ path: '/home/user/estimates/reports/screenshots/05-manual-labor-wiped.png' });
  await b.close();
})();
