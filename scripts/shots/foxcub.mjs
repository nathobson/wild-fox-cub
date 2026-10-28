// Captures Fox Cub editor screenshots (of this site) for the Fox Cub case study.
// Local development only: signs in with the dev admin in .dev.admin.
//   node scripts/shots/foxcub.mjs <origin> <out-dir>
import { readFileSync } from 'node:fs';
import { chromium } from '/Users/nathobson/web/inline-cf/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';

const [origin, out] = process.argv.slice(2);
const creds = JSON.parse(readFileSync(new URL('../../.dev.admin', import.meta.url), 'utf8'));
const res = await fetch(origin + '/api/auth/sign-in/email', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin },
  body: JSON.stringify({ email: creds.email, password: creds.password }),
});
const cookies = res.headers.getSetCookie().map((c) => {
  const [pair] = c.split(';');
  const i = pair.indexOf('=');
  return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin };
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await context.addCookies(cookies);
const page = await context.newPage();
const shot = (name) => page.screenshot({ path: `${out}/foxcub-${name}.png` });

await page.goto(origin + '/foxcub', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('editor');

// Select the story canvas to show the inspector.
await page.locator('.wf-canvas').first().click({ position: { x: 300, y: 120 } }).catch(() => {});
await page.waitForTimeout(800);
await shot('inspector');

await page.locator('[title="Add block"]').nth(1).click().catch(() => {});
await page.waitForTimeout(900);
await shot('blocks');
await page.keyboard.press('Escape');

await page.getByText('Media', { exact: true }).click();
await page.waitForTimeout(1200);
await shot('media');
await page.keyboard.press('Escape');

await page.getByText('Settings', { exact: true }).click();
await page.waitForTimeout(1200);
await shot('settings');

await browser.close();
console.log('done');
