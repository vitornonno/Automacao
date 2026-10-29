const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yelp-playwright-'));
  const extension = path.resolve(__dirname, '..');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'msedge', headless: false,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://biz.yelp.com/', { waitUntil: 'domcontentloaded' });
  console.log('Yelp opened:', page.url());
  console.log('Sign in in the open browser if requested; leave the window open.');
  await new Promise((resolve) => context.on('close', resolve));
})().catch((error) => { console.error(error); process.exitCode = 1; });
