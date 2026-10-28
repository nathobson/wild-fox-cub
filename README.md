# Wild Fox Digital

The Wild Fox Digital website: a single-page scrollytelling studio site with project
case studies, built on **Fox Cub CMS** (one Cloudflare Worker + D1). Everything below
the "Fox Cub CMS" heading is the engine's own documentation.

## The site layer

- `src/site/blocks/` — one module per block:
  - Home: `canvas` (the story canvas, laid out by hand in the composer: see below),
    `services`, `work`, `closing` (a framed photograph that opens to fill the screen).
  - Project pages: `projectHero`, `showcase` (pinned screen, features scrubbed through),
    `figures`, `stack`, plus `closing` as the "next project" link.
- `src/site/comp/` — the story canvas's data model (`model.ts`) and the composer
  (`Composer.tsx`, styled by `public/compose.css`).
- `src/site/chrome.tsx` — header, footer and the fox mark.
- `public/site.js` — the scroll engine: everything is scrubbed to scroll position and
  smoothed by Lenis (`public/vendor/lenis.min.js`, self-hosted so the CSP stays
  `script-src 'self'`). Builds publish it as `/assets/site-<hash>.js`, like site.css.
- `src/site/seed.ts` — the first draft of every page. It only seeds an empty database.
- `public/site.css` — design and motion. Motion applies only on the live site, with
  JavaScript, when the visitor hasn't asked for reduced motion; otherwise every block
  is a complete, static layout (that's also what the editor shows).
- `public/fonts/` — Instrument Serif and Geist (self-hosted for the CSP).

### The composer

Story canvases are art-directed by hand. Select the canvas block and choose **Open
composer** (or double-click it). The composer is a full-screen board, one per screen
size.

A canvas is a stack of **stories**: stretches with their own name, height, photograph,
text and lines. Text and unpinned line points are placed from the top of their story,
so resizing, reordering or deleting a story leaves the others alone.

- **Stories**: listed on the left (drag to reorder; expand to see their text and lines)
  and named beside the board. Drag the handle on a story's bottom edge to change its
  height. Select a story to rename it, choose its photo (or carry on the one before),
  set its shade and how many screens its photo takes to fade in, move, duplicate or
  delete it, or **Preview from here**.
- **Text** (T): click to place, drag to move (into another story, too), drag the side
  handles to set the width, double-click to edit. Styles: display, large, medium
  (Instrument Serif), body, small. Pieces snap to the 12-column grid, to each other and
  to screen marks; ⌘ turns snapping off; Alt-drag copies.
- **Lines** (P): click to add points, drag while clicking to curve, Enter to finish.
  An end dropped near some text is *pinned* (blue) and follows it, even into another
  story. Double-click a line to add a point, a point to round or sharpen it; Shift
  keeps segments straight.
- **Preview** plays the canvas with the real markup, CSS and `public/site.js`.

Everything is measured in board units (1% of the width), so a story scales with the
screen like a picture. The faint marks beside the board are screen heights, as a ruler.
On the live site each story plays as a **reading sequence**, scrubbed to the scroll
position (not triggered when things enter the screen): its text and lines arrive one
at a time, top to bottom and left to right along a row, each line straight after the
text it starts from and before the text it runs into. A piece sitting just under
another (a caption) arrives straight after it, so a row of titles with notes reads
title, note, title, note. As a piece arrives (easing in and out, over `PACE.reveal`
screens, while the next follows `PACE.piece` behind), its letters rise out of their
line's mask and fade in one by one, as savor.it's do; lines draw on the same curve. It
all follows the scroll directly (Lenis does the smoothing) and runs backwards when you
scroll up. **Order** in the composer
numbers the sequence; move a piece lower to bring it later, or use its **Arrives**
setting. The pacing lives in `PACE` (src/site/comp/model.ts and public/site.js); `PACE.tempo`
stretches every arrival, and the gaps between them, by the same factor. A
story's photo has fully faded in when the story's top reaches the middle of the screen.

A story can **hold**: for that many screens of scrolling it stays pinned on screen
(with its pieces centred, not its whole box; or with the last of them in view if
they're taller than the screen) while its sequence
carries on playing, then it moves on. The composer shows the hold as a blue band under
the story (drag its handle to change it), and the story's panel says whether its
sequence finishes while it's on screen, with a one-click suggested hold. Lines that
run on into the next story don't count: they start once the hold has released (when
both ends scroll together) and draw fast enough to reach their text as it arrives.

A held story taller than the screen can have **beats** (Camera, in the story's panel):
it becomes a camera. The screen holds still at the top, at each beat and at the end,
sharing the hold between them, and glides on (eased) between them; while it's still,
what's on screen plays in turn. Each stop then shifts to centre the pieces it shows
(the last stays at the story's end). Beats show as dashed marks on the board. Desktop only;
on the phone it's an ordinary held story.

A story can also **drift** (arrive early and linger, then lift away quickly), and its
photo can **pull back** (zoom in and dim as the story leaves). A story's background
can be **paper** instead of a photo (with dark text), and its photo can **settle**:
easing from slightly zoomed in to rest as it crossfades in.
A story can be a **hero**: not a reading sequence at all. When it arrives, every letter
floats gently out from the middle of the hero into place at once (fading in and coming
into focus, the middle ones a little ahead), and its lines draw, over about three
seconds. Hero-sized words elsewhere zoom up into place and fade in, whole.

Pieces come in a type scale from **Hero** (a few huge words) to **Label** (small
spaced capitals). A piece can be a **picture** instead of text (wiped up into its
frame as it arrives; set its shape in its panel), can **step** its lines in one after
another, and can have **brackets**: two arcs of one circle around it that sweep down
into place.

The home page is built this way: a hero, paper pages, settling photos, chapter covers, a
thread line between stories, a camera story, brackets and picture pieces for the work,
ending with "What we believe" framed out onto the light page, then the **drifting
gallery** block: a pinned chain of pictures, edge to edge at their own shapes, that
slides across as you scroll, riding a wave.

### Images

Seeded content points at files in `public/images/`. Any image field can be switched
to an upload from the media library (which adds AVIF/WebP responsive sizes).

> **`public/images/concept/` is placeholder photography borrowed from savor.it for the
> concept stage only. Replace every one of those images before publishing anywhere.**
> They are used by the home page's story canvas (rings, moss, forest) and the project
> pages' backdrops.

`public/images/work/` holds product screenshots. `scripts/shots/` has the Playwright
scripts used to capture them (Crate from its local app; Fox Cub from this site's editor).

### Local development

```bash
pnpm dev
```

```bash
node scripts/dev-publish.mjs http://localhost:5180
```

The second command creates a local dev admin on first run (credentials saved to the
gitignored `.dev.admin`) and publishes the draft, so the live pages render. To start
again from `seed.ts`, stop the dev server and delete `.wrangler/state`. To add pages
from `seed.ts` that the draft doesn't have yet without touching the rest, add
`--add-seed-pages`; `--seed-page=/work/crate` (say) replaces that one page with its seed version.

Contact details are placeholders: `hello@wildfox.digital` appears in the home page's
closing block and in Settings → Footer links.

---

# Fox Cub CMS (engine)

A small, inline-editing CMS that runs entirely on **one Cloudflare Worker** with a
**D1** database. Edit pages visually at `/foxcub`, press **Publish**, and the site is
live on the same Worker.

- **Editor** at `/foxcub`: click text to edit it, drag blocks to reorder, + to add blocks.
- **Live site** at every other path, served as **static HTML rendered at publish time** and
  stored in D1. Visitors get no React and no hydration. The contact form is a plain HTML
  form, and the only script is a ~1 KB carousel helper on pages that have a carousel.
- **Auth** with [Better Auth](https://www.better-auth.com): email and password, and one
  role, admin. Public sign-up is off. Admins add other admins under **Users**.
- **Drafts and publishing**: edits autosave as a draft. Visitors see only what you publish.
- **Media**: upload images once and get AVIF, WebP and JPEG at several sizes. Pages use
  `<picture>` with `srcset`/`sizes`, so each visitor downloads only what their screen needs.
- **Inbox**: messages sent through Contact blocks on the live site.

## Deploy to Cloudflare

```bash
pnpm install
```

```bash
pnpm run deploy
```

That's it. On first deploy, Wrangler creates the D1 database and the R2 bucket for you. The Worker creates
its tables on the first request. Then open `https://<your-worker>.workers.dev/foxcub` and
create the first admin account.

> **Claim it straight away.** Until the first admin exists, whoever opens `/foxcub`
> first can create it.

Before the first deploy, make sure **R2 is enabled** on your Cloudflare account
(Dashboard → R2, a one-time click). Image processing uses the
[Cloudflare Images](https://developers.cloudflare.com/images/transform-images/bindings/)
binding. Each upload uses up to 15 transformations (5 sizes × 3 formats), and only once.
Visitors never trigger one. Check current pricing; the free monthly allowance covers
hundreds of uploads.

Optional but recommended: set your own auth secret. Without one, the Worker generates a
secret on first run and stores it in D1.

```bash
npx wrangler secret put BETTER_AUTH_SECRET
```

Use a long random value, e.g. from `openssl rand -base64 32`. Changing the secret signs
everyone out.

To use your own domain, add a [custom domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
to the `wild-fox-digital` Worker in the Cloudflare dashboard.

## Security

What Fox Cub does for you:

- **Sign-in**: email and password only, PBKDF2-hashed, `HttpOnly` + `SameSite=Lax`
  session cookies, and a limit of 3 attempts per 10 seconds per IP address.
- **Writes need a session and must come from this site**: `/api` refuses POST, PUT,
  PATCH and DELETE requests whose `Origin` is another site.
- **Headers**: a Content-Security-Policy on every page (the editor runs no inline
  scripts; published pages only their own, allowed by hash), plus framing protection,
  `nosniff`, `Referrer-Policy` and HSTS. Static files get theirs from `public/_headers`.
- **Rich text is sanitised when you publish**: only formatting tags and `http(s)`,
  `mailto` and `tel` links survive.
- **The editor and API are `noindex`** (`X-Robots-Tag` and a robots meta tag).
- **Contact form**: 5 messages a minute per IP (the `CONTACT_LIMITER` binding in
  `wrangler.jsonc`), a spam trap field, and only the latest 1,000 messages are kept.

### Set the auth secret (do this once per site)

Sessions are signed with a secret. Without one, Fox Cub generates it and stores it in
D1, next to the content. Set it as a Worker secret instead, so a database export alone
can't be used to forge a sign-in:

1. Generate a random secret:

   ```bash
   openssl rand -base64 32
   ```

2. From this project's folder, save it as a secret on the `wild-fox-digital` Worker and paste the
   value when asked. It takes effect straight away (Wrangler deploys a new version):

   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET
   ```

3. Everyone is signed out once, because existing sessions were signed with the old
   secret. Sign in again at `/foxcub`.
4. Remove the old generated secret from the database:

   ```bash
   npx wrangler d1 execute wild-fox-digital --remote --command "DELETE FROM settings WHERE key = 'auth_secret'"
   ```

5. Check it's there (values are never shown): `npx wrangler secret list`.

Keep a copy in your password manager. If it's ever lost or leaked, repeat these steps
with a new value: the only effect is that everyone signs in again. Never put it in
`wrangler.jsonc`. For local dev it's optional: put `BETTER_AUTH_SECRET=…` in a
`.dev.vars` file (gitignored).

## Develop locally

```bash
pnpm dev
```

Open http://localhost:5173/foxcub. Local D1 and R2 data lives in `.wrangler/`. Images are
processed locally with `sharp`, so uploads work offline. Delete that
folder to start again from a fresh, empty database.

## How it fits together

```
worker/            Cloudflare Worker (Hono)
  index.ts         Routes: /api/*, /foxcub, and everything else → live site
  api.ts           Site content, publish, users, inbox, contact form
  auth.ts          Better Auth config (D1, email + password, PBKDF2 hashing)
  render.tsx       Renders published pages to static HTML; serves the stored copies
  media.ts         Image upload → R2 + responsive sizes; serves /media/*
  db.ts            Applies migrations/ on first request; document helpers
migrations/        SQL schema (also usable with `wrangler d1 migrations`)
src/               Admin editor (React SPA, entry foxcub.html)
  site/            The site layer: blocks, header/footer, head tags (see below)
  lib/blocks.ts    The contract every block implements
  components/      Editor UI and the published-page renderer
public/site.css    Styles for the published site (also used by the editor canvas)
```

**Content model.** The whole site is one JSON document in D1. There are two rows:
`draft`, which the editor autosaves, and `published`, which visitors see. **Publish**
copies draft to published. **Discard unpublished changes** copies it back. If two
people edit at once, the second save is rejected and that editor is asked to reload,
so nobody silently overwrites someone else's work.

**Publishing.** Publish renders every page, plus a 404 page, to complete HTML and
stores it in the `rendered_pages` table. Each request is a single D1 read. After you
deploy new code, the first visit re-renders the pages once from the published content,
so markup changes apply without republishing.

**Images.** Uploads are stored in R2 under `media/<content-hash>/`: the original plus
`480/800/1200/1600/2400` (capped at the original's width) in `.avif`, `.webp` and `.jpg`
(`.png` when the original is a PNG, to keep transparency). GIFs keep only the original,
so animation survives. SVG uploads are refused, because served from your domain they
could run scripts. Files are served with a one-year immutable cache, since a given name
never changes. `<ResponsiveImage>` renders the `<picture>` in both the editor and the
published HTML. An image can't be deleted while the draft or live site still uses it.

**Interactive blocks.** Published pages work without JavaScript. A block that needs
behaviour defines a `Static` version whose HTML works on its own, plus a small vanilla
`script` that is inlined only on pages using that block (see
`src/site/blocks/carousel.tsx`).

**SEO and settings.** Each page has an SEO title, a description and a "show in
navigation" toggle (in Page settings). **Settings** holds the site name, page title
template, share image, footer text and links, and redirects. Published pages get a
canonical URL, Open Graph/Twitter tags and JSON-LD, plus `/robots.txt` and
`/sitemap.xml`.

**Schema changes.** Add a new file to `migrations/` and register it in `worker/db.ts`.
Write every statement so it is safe to run more than once (`IF NOT EXISTS` and similar).

## Building a site on Fox Cub

Everything specific to one site lives in **`src/site/`** and **`public/site.css`**. The
rest is the engine: editor, API, auth, media, publishing.

- **`src/site/index.ts`** exports the block registry (`BLOCKS`, in block-picker order),
  the `Block` union type, the header, footer and not-found page, extra `<head>` markup
  and an optional site-wide script.
- **Each block is one module** in `src/site/blocks/` that calls `defineBlock()` from
  `src/lib/blocks.ts`:
  - `View`: the editor canvas and preview, with inline editing.
  - `Inspector` (optional): its settings panel.
  - `Static` (optional): its published HTML, which must work without JavaScript.
  - `script` (optional): inlined only on pages that use the block.
  - `create()`: default content for a new block.
- **Shared controls** for inspectors: `components/ui/controls` (inputs, toggles,
  segmented, sliders, fields), `ItemList` (reorderable lists), `MediaField` (image
  picker), and `ResponsiveImage` for `<picture>` output.

To start a new site, copy this project, replace `src/site/` and `public/site.css`, and
deploy. [`../sophieannaward-foxcub`](../sophieannaward-foxcub) is a complete example
migrated from another CMS.