#!/usr/bin/env node
// Takes an authenticated full-page screenshot of the CrumbleCo homepage.
// Reads benchmark-result.json for the target URL.
// Outputs: screenshot-<short-sha>.png

const { chromium } = require('playwright');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

async function main() {
  const resultFile = resolve('benchmark-result.json');
  let pageUrl = 'http://localhost:8080/cms/render/live/en/sites/crumbleco/home.html';

  if (existsSync(resultFile)) {
    const result = JSON.parse(readFileSync(resultFile, 'utf8'));
    if (result.page_url) pageUrl = result.page_url;
  }

  const commit = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
  const screenshotPath = resolve(`screenshot-${commit}.png`);

  console.log(`Screenshotting: ${pageUrl}`);

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:8080/cms/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', 'root');
    await page.fill('#password', 'root1234');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.keyboard.press('Enter'),
    ]);
    console.log('Logged in successfully');
  } catch (err) {
    console.warn('Login step skipped or failed:', err.message);
  }

  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();

  console.log(`Screenshot saved: ${screenshotPath}`);
  console.log(`SCREENSHOT_PATH=${screenshotPath}`);
  console.log(`SCREENSHOT_FILE=screenshot-${commit}.png`);
}

main().catch((err) => {
  console.error('Screenshot failed:', err);
  process.exit(1);
});
