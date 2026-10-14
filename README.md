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
RUN_FIXME=1 npx playwright test -g BUG    # run the known-bug tests (they should fail)
```

What the tests cover, and how each calculation is meant to work, is written up in
[`tests/CALCULATIONS.md`](tests/CALCULATIONS.md). Tests named `BUG: …` document
suspected bugs; they're marked `test.fixme` so CI stays green. When you fix one,
change its `bug(` to `test(` so it guards against regressions.

CI (`.github/workflows/tests.yml`) runs the suite on every push and pull request.
