import { Hono } from 'hono';
import { seedSite } from '../src/site';
import type { Site } from '../src/types';
import { createUser, getAuth, hashPassword, MIN_PASSWORD_LENGTH, type Auth } from './auth';
import { getDocument } from './db';
import { deleteMedia, listMedia, updateMediaAlt, uploadMedia, UploadError } from './media';
import { renderSite } from './render';

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

type App = { Bindings: Env; Variables: { auth: Auth; user: SessionUser } };

export const api = new Hono<App>();

const now = () => new Date().toISOString();
const isEmail = (v: unknown): v is string => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Cross-site request forgery guard. Browsers send Origin on every POST/PUT/PATCH/
 * DELETE, so a write that comes from another site (including other Workers on the
 * same workers.dev subdomain) is refused. Requests without Origin aren't from a
 * browser page (e.g. the importer script) and still need a valid session. The
 * contact form is public by design; Better Auth checks origins itself.
 */
api.use('*', async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && c.req.path !== '/api/contact') {
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin) {
      return c.json({ error: 'Cross-site requests are not allowed.' }, 403);
    }
  }
  await next();
});

api.use('*', async (c, next) => {
  c.set('auth', await getAuth(c.env, c.req.raw));
  await next();
});

api.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

/* ------------------------------------------------------------------ */
/* Public routes                                                       */
/* ------------------------------------------------------------------ */

api.on(['GET', 'POST'], '/auth/*', (c) => c.get('auth').handler(c.req.raw));

const countUsers = async (db: D1Database) =>
  (await db.prepare('SELECT COUNT(*) AS n FROM "user"').first<{ n: number }>())!.n;

api.get('/setup', async (c) => c.json({ needsSetup: (await countUsers(c.env.DB)) === 0 }));

/** First-run only: creates the first admin and signs them in. */
api.post('/setup', async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.json({ error: 'Setup is already complete.' }, 403);
  const body = await c.req.json<Record<string, unknown>>();
  const error = validateNewUser(body);
  if (error) return c.json({ error }, 400);
  const auth = c.get('auth');
  await createUser(auth, { name: str(body.name, 100), email: body.email as string, password: body.password as string });
  return auth.api.signInEmail({
    body: { email: (body.email as string).trim().toLowerCase(), password: body.password as string },
    headers: c.req.raw.headers,
    asResponse: true,
  });
});

/** How many contact messages the inbox keeps; older ones are dropped. */
const MAX_SUBMISSIONS = 1000;

/** Only ever redirect back to a page on this site (`/\evil.com` resolves elsewhere). */
function sameSitePath(value: string, requestUrl: string) {
  const here = new URL(requestUrl).origin;
  try {
    const target = new URL(value, here);
    return target.origin === here ? `${target.pathname}${target.search}${target.hash}` : '/';
  } catch {
    return '/';
  }
}

/** Contact block submissions from the live site (plain HTML form post, or JSON). */
api.post('/contact', async (c) => {
  // Per-IP limit, so a script can't flood the inbox.
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  if (c.env.CONTACT_LIMITER && !(await c.env.CONTACT_LIMITER.limit({ key: ip })).success) {
    return c.json({ error: 'Too many messages. Try again in a minute.' }, 429);
  }

  const isForm = !(c.req.header('content-type') ?? '').includes('application/json');
  const body: Record<string, unknown> = isForm
    ? Object.fromEntries((await c.req.formData().catch(() => new FormData())).entries())
    : await c.req.json<Record<string, unknown>>().catch(() => ({}));

  const redirectTo = sameSitePath(str(body.return, 300) || '/', c.req.url);
  const done = (status: 200 | 400) => (isForm ? c.redirect(redirectTo, 303) : c.json({ ok: status === 200 }, status));

  // Honeypot filled in: quietly pretend it worked.
  if (str(body.website, 200)) return done(200);

  const name = str(body.name, 200);
  const email = str(body.email, 320);
  const message = str(body.message, 5000);
  if ((!name && !email && !message) || (email && !isEmail(email))) {
    return isForm ? c.redirect(redirectTo.split('#')[0], 303) : done(400);
  }
  await c.env.DB.prepare(
    'INSERT INTO submissions (id, page, name, email, message, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), str(body.page, 200) || '/', name, email, message, now())
    .run();
  await c.env.DB.prepare(
    'DELETE FROM submissions WHERE id NOT IN (SELECT id FROM submissions ORDER BY createdAt DESC LIMIT ?)',
  )
    .bind(MAX_SUBMISSIONS)
    .run();
  return done(200);
});

/* ------------------------------------------------------------------ */
/* Everything below requires a signed-in admin                         */
/* ------------------------------------------------------------------ */

api.use('*', async (c, next) => {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Not signed in.' }, 401);
  c.set('user', { id: session.user.id, name: session.user.name, email: session.user.email });
  await next();
});

/* ---- Site content ------------------------------------------------- */

async function siteState(db: D1Database) {
  let draft = await getDocument(db, 'draft');
  if (!draft) {
    // First visit: start from the demo content.
    await db
      .prepare('INSERT OR IGNORE INTO documents (id, data, revision, updatedAt) VALUES (?, ?, 1, ?)')
      .bind('draft', JSON.stringify(seedSite), now())
      .run();
    draft = (await getDocument(db, 'draft'))!;
  }
  const published = await getDocument(db, 'published');
  return {
    site: JSON.parse(draft.data) as Site,
    revision: draft.revision,
    publishedAt: published?.updatedAt ?? null,
    hasChanges: !published || published.data !== draft.data,
  };
}

api.get('/site', async (c) => c.json(await siteState(c.env.DB)));

api.put('/site', async (c) => {
  const { site, revision } = await c.req.json<{ site: Site; revision: number }>();
  const problem = validateSite(site);
  if (problem) return c.json({ error: problem }, 400);
  // Optimistic concurrency: only save on top of the revision the editor loaded.
  const result = await c.env.DB.prepare(
    `UPDATE documents SET data = ?, revision = revision + 1, updatedAt = ?, updatedBy = ?
     WHERE id = 'draft' AND revision = ?`,
  )
    .bind(JSON.stringify(site), now(), c.get('user').id, revision)
    .run();
  if (result.meta.changes === 0) {
    return c.json({ error: 'This site was changed by someone else. Reload to get the latest version.' }, 409);
  }
  const published = await getDocument(c.env.DB, 'published');
  return c.json({
    revision: revision + 1,
    hasChanges: !published || published.data !== JSON.stringify(site),
  });
});

api.post('/publish', async (c) => {
  const result = await c.env.DB.prepare(
    `INSERT INTO documents (id, data, revision, updatedAt, updatedBy)
     SELECT 'published', data, revision, ?, ? FROM documents WHERE id = 'draft'
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, revision = excluded.revision,
       updatedAt = excluded.updatedAt, updatedBy = excluded.updatedBy`,
  )
    .bind(now(), c.get('user').id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'Nothing to publish.' }, 400);
  const state = await siteState(c.env.DB);
  await renderSite(c.env.DB, state.site, new URL(c.req.url).origin);
  return c.json(state);
});

/** Throws away unpublished edits by copying the live site back into the draft. */
api.post('/discard', async (c) => {
  const published = await getDocument(c.env.DB, 'published');
  if (!published) return c.json({ error: 'Nothing has been published yet.' }, 400);
  await c.env.DB.prepare(
    `UPDATE documents SET data = ?, revision = revision + 1, updatedAt = ?, updatedBy = ? WHERE id = 'draft'`,
  )
    .bind(published.data, now(), c.get('user').id)
    .run();
  return c.json(await siteState(c.env.DB));
});

/* ---- Users -------------------------------------------------------- */

api.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, email, createdAt FROM "user" ORDER BY createdAt',
  ).all();
  return c.json({ users: results, currentUserId: c.get('user').id });
});

api.post('/users', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const error = validateNewUser(body);
  if (error) return c.json({ error }, 400);
  try {
    const user = await createUser(c.get('auth'), {
      name: str(body.name, 100),
      email: body.email as string,
      password: body.password as string,
    });
    return c.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 409);
  }
});

api.patch('/users/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; password?: string }>();
  const ctx = await c.get('auth').$context;
  if (!(await ctx.internalAdapter.findUserById(id))) return c.json({ error: 'User not found.' }, 404);

  if (typeof body.name === 'string' && body.name.trim()) {
    await ctx.internalAdapter.updateUser(id, { name: str(body.name, 100) });
  }
  if (typeof body.password === 'string') {
    if (body.password.length < MIN_PASSWORD_LENGTH) {
      return c.json({ error: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
    }
    await ctx.internalAdapter.updatePassword(id, await hashPassword(body.password));
    // Someone else's password was reset: sign them out everywhere.
    if (id !== c.get('user').id) await ctx.internalAdapter.deleteUserSessions(id);
  }
  return c.json({ ok: true });
});

api.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) return c.json({ error: 'You cannot delete your own account.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM session WHERE userId = ?').bind(id),
    c.env.DB.prepare('DELETE FROM account WHERE userId = ?').bind(id),
    c.env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

/* ---- Media -------------------------------------------------------- */

api.get('/media', async (c) => c.json({ media: await listMedia(c.env.DB) }));

api.post('/media', async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return c.json({ error: 'Choose an image to upload.' }, 400);
  try {
    return c.json({ item: await uploadMedia(c.env, file, c.get('user').id) });
  } catch (err) {
    if (err instanceof UploadError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

api.patch('/media/:id', async (c) => {
  const { alt } = await c.req.json<{ alt?: string }>();
  await updateMediaAlt(c.env.DB, c.req.param('id'), str(alt, 500));
  return c.json({ ok: true });
});

api.delete('/media/:id', async (c) => {
  const problem = await deleteMedia(c.env, c.req.param('id'));
  return problem ? c.json({ error: problem }, 409) : c.json({ ok: true });
});

/* ---- Inbox -------------------------------------------------------- */

api.get('/submissions', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, page, name, email, message, createdAt FROM submissions ORDER BY createdAt DESC LIMIT 500',
  ).all();
  return c.json({ submissions: results });
});

api.delete('/submissions/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validateNewUser(body: Record<string, unknown>): string | null {
  if (!isEmail(body.email)) return 'Enter a valid email address.';
  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

const RESERVED = /^\/(foxcub|api|assets)(\/|$)/;

function validateSite(site: Site): string | null {
  if (!site || typeof site.name !== 'string' || !Array.isArray(site.pages)) return 'Invalid site.';
  if (site.pages.length === 0) return 'A site needs at least one page.';
  const slugs = new Set<string>();
  for (const page of site.pages) {
    if (typeof page.slug !== 'string' || !/^\/[a-z0-9\-/]*$/.test(page.slug)) return `Invalid URL "${page.slug}".`;
    if (RESERVED.test(page.slug)) return `The URL "${page.slug}" is reserved.`;
    if (slugs.has(page.slug)) return `Two pages share the URL "${page.slug}".`;
    if (!Array.isArray(page.blocks)) return 'Invalid page.';
    slugs.add(page.slug);
  }
  return null;
}
