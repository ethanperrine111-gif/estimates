# QuickQuote

Single-file estimate builder PWA. The whole app is `index.html` (inline CSS/JS,
data in `localStorage`); open it in a browser or serve the folder statically.

## Running tests

The test suite uses [Playwright Test](https://playwright.dev) and drives the real
app through its UI at an iPhone-sized viewport in Chromium.

```sh
npm install
npx playwright install chromium   # first time only (skip if Chromium is already provided)
npm test
```

`npm test` starts a tiny static server (`tests/server.js`, port 4173) automatically.
Useful variants:

```sh
npx playwright test tests/e2e.spec.js     # one file
npx playwright test -g "upcharge"         # by test name
npx playwright test --headed              # watch it run
```

What the tests cover, and how each calculation is meant to work, is written up in
[`tests/CALCULATIONS.md`](tests/CALCULATIONS.md). To document a suspected bug
without breaking CI, write the test with `bug(` instead of `test(` (it's skipped
unless `RUN_FIXME=1`), and switch it to `test(` once fixed.

CI (`.github/workflows/tests.yml`) runs the suite on every push and pull request.

## Deploying

`.github/workflows/deploy.yml` publishes the app to GitHub Pages on every push to
`master`, after the tests pass. It stamps `sw.js` with the commit so installed
phones show "Update available — tap to reload".

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The app is then at `https://ethanperrine111-gif.github.io/estimates/`. Open it in
Safari, then **Share → Add to Home Screen**. Data saved in Safari and in the
Home Screen app are separate, so always use the Home Screen icon.

## Your data

Estimates, companies, subs and prices live only on the phone (`localStorage`).
Use **☰ → Export backup** regularly (the list screen reminds you after 7 days) and
keep the file in iCloud Drive/Files. **☰ → Import backup** restores it on any
phone. Deleting the Home Screen icon deletes its data.
