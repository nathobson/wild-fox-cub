// Captures Crate UI screenshots for the project page. Run from inline-cf (for playwright).
import { chromium } from '/Users/nathobson/web/inline-cf/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const shot = async (path, name, wait = 3500) => {
  await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/crate-${name}.png` });
  console.log(name, await page.title());
};
await shot('/', 'home');
await shot('/moods', 'moods');
await shot('/reviews', 'reviews');
await shot('/radio', 'radio');
await shot('/stats', 'stats');
// First release page linked from home
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' }).catch(() => {});
const href = await page.locator('a[href^="/release/"]').first().getAttribute('href');
if (href) await shot(href, 'release');
await browser.close();
