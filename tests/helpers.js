// Shared helpers for driving QuickQuote through its UI.
const { test, expect } = require('@playwright/test');

const STORE_KEY = 'est-builder-v4';

// Known-bug tests are written as `bug(...)`. They are skipped (test.fixme) in a
// normal run so CI stays green, but `RUN_FIXME=1 npm test` runs them for real —
// each one should FAIL until the bug it documents is fixed.
const bug = process.env.RUN_FIXME ? test : test.fixme;

/** Open the app with an empty store (each test gets a fresh browser context). */
async function openApp(page) {
  await page.goto('/');
  await expect(page.locator('#list-view')).toHaveClass(/on/);
}

/** Seed localStorage with a db object, then reload so the app boots from it. */
async function seed(page, db) {
  await page.goto('/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [STORE_KEY, db]);
  await page.reload();
}

/** Raw persisted state, straight from localStorage. */
async function stored(page) {
  return page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY);
}

/** The estimate currently open in the editor, as persisted. */
async function currentEst(page) {
  const db = await stored(page);
  return db.ests.find(e => e.id === db.cur);
}

async function newEstimate(page) {
  await page.getByRole('button', { name: '＋ New Estimate' }).click();
  await expect(page.locator('#edit-view')).toHaveClass(/on/);
}

/** Answer the next window.prompt() with `answer`. */
function answerNextPrompt(page, answer) {
  page.once('dialog', d => d.accept(answer));
}

const rows = (page, type) => page.locator(`#${type}-tb tr`);

/**
 * Add a line item via "＋ Add item" and fill it in like a user would.
 * `type` is 'lumber' or 'hardware'. Any of qty/desc/price may be omitted.
 */
async function addLine(page, type, { qty, desc, price } = {}) {
  const before = await rows(page, type).count();
  await page.locator(`#${type}-tb`).locator('xpath=ancestor::div[contains(@class,"card")]')
    .getByRole('button', { name: '＋ Add item' }).click();
  await expect(rows(page, type)).toHaveCount(before + 1);
  const row = rows(page, type).nth(before);
  if (desc !== undefined) await row.locator('input[type=text]').fill(desc);
  if (qty !== undefined) await row.locator('.iinp.qty').fill(String(qty));
  if (price !== undefined) await row.locator('.iinp.price').fill(String(price));
  return row;
}

async function openQuickPick(page, type) {
  const panel = page.locator(`#${type}-qp`);
  if (!(await panel.evaluate(el => el.classList.contains('open')))) {
    await page.locator(`#${type}-qt`).click();
  }
  return panel;
}

/** Open the top-bar menu → "Subs & Prices". */
async function openManage(page) {
  await page.locator('#menu-btn').click();
  await page.getByRole('button', { name: 'Subs & Prices' }).click();
  await expect(page.locator('#manage-modal')).toHaveClass(/on/);
}

async function closeManage(page) {
  await page.locator('#manage-modal .sm-close').click();
  await expect(page.locator('#manage-modal')).not.toHaveClass(/on/);
}

/** Change one of the menu rates. Rates commit on `change`, i.e. when the field loses focus. */
async function setMenuRate(page, which, value) {
  const id = which === 'clientDay' ? '#rate-clientday' : '#rate-mgmthr';
  const inp = page.locator(id);
  await inp.fill(String(value));
  await inp.blur();
}

/** Add a company through the menu. */
async function addCompanyViaMenu(page, name) {
  await page.locator('#new-company').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/** Add a sub through the menu. */
async function addSubViaMenu(page, name, daily) {
  await page.locator('#new-sub').fill(name);
  if (daily !== undefined) await page.locator('#new-sub-daily').fill(String(daily));
  await page.getByRole('button', { name: 'Add Sub' }).click();
}

/** The amount span of a row in the share/preview document, matched by its exact label. */
function docRow(page, label) {
  const re = label instanceof RegExp ? label : new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
  return page.locator('#share-preview .doc-row')
    .filter({ has: page.locator('span:first-child', { hasText: re }) })
    .locator('span').last();
}

module.exports = {
  test, expect, bug, STORE_KEY,
  openApp, seed, stored, currentEst, newEstimate, answerNextPrompt,
  rows, addLine, openQuickPick, openManage, closeManage, setMenuRate,
  addCompanyViaMenu, addSubViaMenu, docRow,
};
