# QuickQuote — how the money math works

All estimate math lives in one function, `calc(e)` in `index.html`. The editor
(`rc()`), the estimate list, the plain-text share and both documents read from it,
so they can't drift apart. This is the behaviour the test suite locks down.

## Formatting

- `fmt(n)`: whole dollars with thousands separators (`1234.5` → `$1,235`), used
  for totals. `fmt2(n)`: cents (`$2.49`), used for unit prices and line totals.
  Negatives render as `-$500`. Math is done on unrounded values.
- Profit margin shows one decimal (`84.4%`); `—` when the grand total is 0.
  The plain-text share uses `~84%` (no decimals).
- Typed numbers ignore `$`, `,` and spaces and are never negative (`num()`).

## Line items (Lumber, Hardware)

- Line total = `qty × unitPrice`, shown with cents; `—` when either is 0/blank.
- New rows start at qty 1. A qty of 0 (or blank) counts as 0.
- Quick-pick chips add a row with that description; tapping the same chip again
  adds 1 to that row's qty. The keyboard isn't opened.
- Removing a row shows "Removed … · Undo" for a few seconds.
- Section subtotal (card header) = Σ line totals; hidden when 0.
- **Price book**: typing a unit price stores it under the lower-cased, trimmed
  description. Typing a known description fills in its price if the row's price
  is blank or was filled in automatically, so typing `2x4 8' PT` moves from the
  `2x4 8'` price to the PT price. A price typed by hand is never replaced.

## Materials pricing

- **Vendor subtotal** = lumber subtotal + hardware subtotal when *Auto* is
  checked, else the override amount. Unticking *Auto* starts the override at the
  current subtotal.
- **Upcharge**: `%` mode (default 20) → `vendor × pct / 100`; `$` mode → flat.
  Switching mode keeps the number (20% → $20). A hint shows `20% of $X = $Y`.
- **Taxes**: *Included* (default) means the vendor price already has tax → 0.
  Unticked (e.g. a Home Depot price), tax is `round(vendor × 7.25%)` (Utah) and
  follows the vendor subtotal as items change. Typing an amount fixes it (the
  "Utah 7.25%" badge disappears); clearing the field goes back to automatic.
- **Buffer**: flat, default $300.
- **Delivery**: *Included* (default) → 0. Unchecking fills $100 if blank.
- **Client materials total** = vendor + upcharge + tax + buffer + delivery.

## Labor

- Sub labor cost (our cost) = `days × sub daily rate`, rounded to cents.
  Recalculated when Days or the daily rate changes, or a sub is picked.
- Labor charge (client) = `days × client $/day` (menu rate, default $3,000).
  Recalculated when Days changes, or the menu rate changes (if Days is set).
- An amount typed by hand is never overwritten; its badge reads "typed".
  Clearing the field hands it back to auto-calc.
- Picking a saved sub fills its daily rate. The saved rate only changes in the
  menu, except for a sub just created from the estimate ("+ Add new sub"), which
  learns the rate typed there.
- Demo charge: flat, hand-entered, client-facing.

## Other expenses

- **Managing labor & expenses** = `hours × managing $/hr` (menu rate, default
  $35). Same "typed by hand" rule as labor. Clearing Hours clears an automatic
  amount and keeps a typed one.

## Totals

- **Grand total (client)** = client materials + labor charge + demo charge.
- **Expenses** = vendor subtotal + tax and delivery we pay (when not included)
  + sub labor cost + managing labor.
- **Profit** = grand total − expenses. **Margin** = profit / grand total × 100.
  The progress bar is green ≥ 40%, amber ≥ 25%, red below.

## Share

- **Customer** (default): job info, line items as qty + description only,
  "Materials (tax & delivery included)", Labor, Demo, Total. No unit prices,
  upcharge, buffer, costs, profit, margin or status. Job notes only if "Include
  job notes" is ticked.
- **Internal**: everything, including unit prices, markup, our costs, profit
  and margin.
- Both list priced rows with no description as "(no description)" and skip
  rows with qty 0 or nothing filled in. The date is when the estimate was created.

## Menu rates

- Client labor $/day and managing labor $/hr live in `db.settings` (defaults
  3000 / 35), persist, and update the badges. Changing one only recalculates the
  amount that depends on it, and never a typed amount.

## Persistence

- Everything (estimates, companies, subs, price book, rates) is one JSON blob in
  `localStorage['est-builder-v4']`, saved on every edit. If a save fails, a red
  banner says so. Removing a company or sub from the list keeps the name on
  estimates that already use it.
- Estimates saved before this version keep their numbers: a stored tax amount
  stays as typed, and labor amounts that don't match days × rate count as typed.
