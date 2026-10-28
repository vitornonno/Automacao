const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('Da Silva saved Yelp page: selecting move services updates the estimate', async () => {
  const extension = path.resolve(__dirname, '..');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    const page = await context.newPage();
    let html = fs.readFileSync(path.join(extension, '../docs/HTML DASILVA YELP.txt'), 'utf8');
    html = html.replace(/<aside id="cleaning-quote-assistant">[\s\S]*?<\/aside>/i, '');
    await page.route('**/*', async (route) => {
      if (route.request().isNavigationRequest() && route.request().url().startsWith('https://biz.yelp.com/leads_center/')) {
        await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      } else if (route.request().url().startsWith('chrome-extension://')) await route.continue();
      else await route.abort();
    });
    await page.goto('https://biz.yelp.com/leads_center/NKYK8RrTUSDhdbaI848bjg/leads/IPBAzLsETVKAZqIrayI1VQ');
    const panel = page.locator('#cleaning-quote-assistant');
    await expect(panel.locator('.result')).toContainText('Manual review required');
    const picker = panel.frameLocator('iframe.service-picker').locator('select');
    await picker.selectOption('move_in');
    await expect(panel.locator('.result')).toContainText('$560–$660');
    await panel.frameLocator('iframe.service-picker').locator('select').selectOption('move_out');
    await expect(panel.locator('.result')).toContainText('$625–$725');
  } finally { await context.close(); }
});
