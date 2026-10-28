import { Hono } from 'hono';
import { api } from './api';
import { ensureSchema } from './db';
import { serveMedia } from './media';
import { robots, servePage, sitemap } from './render';
import { securityHeaders } from './security';

const app = new Hono<{ Bindings: Env }>();

app.use('*', securityHeaders);

app.use('*', async (c, next) => {
  await ensureSchema(c.env.DB);
  await next();
});

// API + Better Auth (/api/auth/*).
app.route('/api', api);

// Uploaded images and their generated sizes, straight from R2.
app.get('/media/:id/:file', (c) =>
  serveMedia(c.env, c.req.raw, `media/${c.req.param('id')}/${c.req.param('file')}`),
);

// The editor is a single-page app built to foxcub.html.
app.get('/foxcub', (c) => c.env.ASSETS.fetch(new URL('/foxcub', c.req.url)));
app.get('/foxcub/*', (c) => c.env.ASSETS.fetch(new URL('/foxcub', c.req.url)));

app.get('/robots.txt', (c) => robots(new URL(c.req.url)));
app.get('/sitemap.xml', (c) => sitemap(c.env.DB, new URL(c.req.url)));

// Everything else is the published site: pre-rendered HTML stored at publish time.
app.get('*', (c) => servePage(c.env.DB, new URL(c.req.url)));

export default app;
