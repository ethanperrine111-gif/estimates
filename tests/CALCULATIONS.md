# QuickQuote — how the money math works

Written from reading `index.html` (functions `rc()`, `recalcLabor()`, `recalcMgmt()`,
`updItem()`, `onTaxChange()`, `onDelChange()`, `calcGrandTotal()`, `showShare()`,
`buildDocHTML()`). This is the behaviour the test suite locks down. Items marked
**⚠ suspected bug** are covered by `test.fixme` tests (see the README).

## Formatting

- `fmt(n)` → `'$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })`.
  Every displayed money value is **rounded to whole dollars** with thousands
  separators (`1234.5` → `$1,235`, `0.4` → `$0`). Math is done on unrounded
  values; only display is rounded.
- ⚠ suspected bug: negative values render as `$-500` instead of `-$500`.
- ⚠ suspected bug: unit prices on the customer document are also whole dollars
  (`$2.49` shows as `$2`, so `3 × $2 = $7` on the page).
- Profit margin shows one decimal (`84.4%`); `—` when the grand total is 0.
  The plain-text share uses `~84%` (no decimals).

## Line items (Lumber, Hardware)

- Line total = `qty × unitPrice`. Shown as `—` when either is 0/blank.
- New rows start at qty 1. Quick-pick chips add a row with that description.
- Qty input: `parseFloat(v) || 1` — blank or 0 becomes **1**.
  ⚠ suspected bug: the field can show `0` while the math uses 1.
- Section subtotal (card header) = Σ line totals; hidden when 0.
- **Price book**: entering a unit price stores it under the lower-cased, trimmed
  description. Adding a row with a known description (quick pick or typing it)
  autofills the unit price, but only if the row's price is still blank.
  Prices can be edited / removed in the menu.
  ⚠ suspected bug: autofill fires on every keystroke, so typing `2x4 8' PT`
  passes through `2x4 8'` and locks in the non-PT price.

## Materials pricing

- **Vendor subtotal** = lumber subtotal + hardware subtotal when *Auto* is
  checked, else the override amount.
- **Upcharge**: `%` mode (default 20) → `vendor × pct / 100`; `$` mode → flat.
  Switching mode keeps the number (20% → $20). A hint shows `20% of $X = $Y`.
- **Taxes**: *Included* (default) → 0. Unchecking autofills
  `round(vendor × 7.25%)` (Utah) into an editable amount; it is not
  re-computed when items change later.
- **Buffer**: flat, default $300.
- **Delivery**: *Included* (default) → 0. Unchecking fills $100 if blank.
- **Client materials total** = vendor + upcharge + tax + buffer + delivery.

## Labor

- Typing **Days** or **Daily Rate (sub)**, or picking a sub, recalculates:
  - Sub labor cost (our cost) = `days × sub daily rate`
  - Labor charge (client) = `days × client $/day` (menu rate, default $3,000)
  Both stay hand-editable afterwards.
- Picking a saved sub fills its daily rate. Editing the daily rate on an
  estimate writes it back to the saved sub record.
- Demo charge: flat, hand-entered, client-facing.
- ⚠ suspected bug: anything that triggers the recalculation (changing a menu
  rate, picking a sub) **overwrites hand-entered labor numbers**, and blanks
  them when Days is empty.
- ⚠ suspected bug: a sub's daily rate edited in the menu is silently reverted by
  the next keystroke on an open estimate still using the old rate.

## Other expenses

- **Managing labor & expenses** = `hours × managing $/hr` (menu rate, default
  $35) whenever Hours is non-zero. Clearing Hours leaves the amount alone, and
  the amount can be typed by hand.

## Totals

- **Grand total (client)** = client materials + labor charge + demo charge.
- **Expenses** = vendor subtotal + sub labor cost + managing labor.
- **Profit** = grand total − expenses. **Margin** = profit / grand total × 100.
  The progress bar is green ≥ 40%, amber ≥ 25%, red below.
- ⚠ suspected bug: when Taxes or Delivery are *not* included, they are charged to
  the client but not counted as expenses, so profit is overstated by that amount.
- The estimate list shows the same grand total per estimate (`calcGrandTotal`).
- The share preview / PDF document and the plain-text share recompute the same
  numbers independently (`buildDocHTML`, `showShare`).

## Menu rates

- Client labor $/day and managing labor $/hr live in `db.settings` (defaults
  3000 / 35), persist, and update the badges. Changing one while an estimate is
  open re-runs the labor and managing-labor recalculation.

## Persistence

- Everything (estimates, companies, subs, price book, rates) is one JSON blob in
  `localStorage['est-builder-v4']`, saved on every edit, so a reload restores it.
