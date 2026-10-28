// Local development only: signs in (creating a dev admin on first run) and publishes
// the draft, so the live pages can be viewed without clicking through the editor.
//
//   node scripts/dev-publish.mjs [http://localhost:5180] [--add-seed-pages]
//
// --add-seed-pages adds any page in src/site/seed.ts that the draft doesn't have yet
// (by id), leaving every existing page as it is. --seed-page=/work/crate (say) replaces that one
// page with its seed version (losing any edits to it).
//
// The dev admin's credentials are kept in .dev.admin (gitignored).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const origin = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:5180';
const addSeedPages = args.includes('--add-seed-pages');
const reseed = args.filter((a) => a.startsWith('--seed-page=')).map((a) => a.slice('--seed-page='.length));
const file = new URL('../.dev.admin', import.meta.url);

let creds;
if (existsSync(file)) {
  creds = JSON.parse(readFileSync(file, 'utf8'));
} else {
  creds = { name: 'Dev Admin', email: 'dev@wildfox.test', password: randomBytes(18).toString('base64url') };
  writeFileSync(file, JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
}

const headers = { 'content-type': 'application/json', origin };
let cookie = '';
const call = async (method, path, body) => {
  const res = await fetch(origin + path, { method, headers: { ...headers, cookie }, body: body && JSON.stringify(body) });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json().catch(() => null);
};

const { needsSetup } = await call('GET', '/api/setup');
if (needsSetup) await call('POST', '/api/setup', creds);
else await call('POST', '/api/auth/sign-in/email', { email: creds.email, password: creds.password });

const state = await call('GET', '/api/site');
if (addSeedPages || reseed.length) {
  const { seedSite } = await import('../src/site/seed.ts');
  const fresh = seedSite.pages.filter((p) => reseed.includes(p.slug));
  const kept = state.site.pages.filter((p) => !fresh.some((f) => f.id === p.id));
  const have = new Set(kept.map((p) => p.id));
  const added = addSeedPages ? seedSite.pages.filter((p) => !have.has(p.id) && !fresh.includes(p)) : [];
  const pages = state.site.pages.map((p) => fresh.find((f) => f.id === p.id) ?? p);
  for (const f of fresh) if (!pages.includes(f)) pages.push(f);
  pages.push(...added);
  if (fresh.length || added.length) {
    await call('PUT', '/api/site', { site: { ...state.site, pages }, revision: state.revision });
    console.log(`From the seed: ${[...fresh, ...added].map((p) => p.slug).join(', ')}`);
  }
}
await call('POST', '/api/publish').catch((e) => {
  if (!String(e).includes('Nothing to publish')) throw e;
});
console.log(`Published. Live site: ${origin}/  Editor: ${origin}/foxcub`);
