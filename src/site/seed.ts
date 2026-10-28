import type { Site } from '../types';

/*
 * The first draft of the site. Images point at /images/… in public/ so the site
 * works before anything is uploaded; replace them from the editor (any image field
 * takes an upload from the media library).
 *
 * /images/concept/ holds placeholder photography borrowed for the concept stage
 * only. Replace every one before going live.
 */

const pic = (src: string, alt = '') => ({ src, alt });

/* The home page's stories (see src/site/comp/model.ts): positions in u (1% of the width), from the top of each story. */
type Style = 'hero' | 'display' | 'large' | 'medium' | 'body' | 'small' | 'label';
const P = (
  id: string,
  story: string,
  text: string,
  style: Style,
  x: number,
  y: number,
  w: number,
  o: {
    tag?: 'p' | 'h1' | 'h2';
    soft?: boolean;
    italic?: boolean;
    wait?: number;
    align?: 'left' | 'center' | 'right';
    brackets?: boolean;
    step?: number;
  } = {},
) => ({
  id,
  story,
  text,
  style,
  tag: o.tag ?? ('p' as const),
  italic: o.italic ?? false,
  soft: o.soft ?? false,
  align: o.align ?? ('left' as const),
  d: { x, y, w },
  wait: o.wait ?? 0,
  show: 'both' as const,
  image: null as { src: string; alt: string } | null,
  ratio: 0.625,
  frame: (o.brackets ? 'brackets' : 'none') as 'none' | 'brackets',
  step: o.step ?? 0,
});
/* A picture piece: `ratio` is its height over its width. */
const I = (id: string, story: string, src: string, alt: string, x: number, y: number, w: number, ratio = 0.625, o: { wait?: number } = {}) => ({
  ...P(id, story, '', 'body', x, y, w, o),
  image: pic(src, alt),
  ratio,
});
const pin = (piece: string, ax: number, ay: number, dx = 0, dy = 0) => ({ piece, ax, ay, dx, dy });
const N = (x: number, y: number, o: { ix?: number; iy?: number; ox?: number; oy?: number; at?: ReturnType<typeof pin> } = {}) => ({
  x,
  y,
  ix: o.ix ?? 0,
  iy: o.iy ?? 0,
  ox: o.ox ?? 0,
  oy: o.oy ?? 0,
  smooth: true,
  at: o.at ?? null,
});
const L = (id: string, story: string, nodes: ReturnType<typeof N>[], o: { dash?: boolean; dots?: 'none' | 'start' | 'end' | 'both' } = {}) => ({
  id,
  story,
  nodes,
  dash: o.dash ?? false,
  dots: o.dots ?? ('none' as const),
  weight: 1 as const,
});
const S = (
  id: string,
  name: string,
  height: number,
  image: { src: string; alt: string } | null,
  o: {
    fade?: number;
    shade?: number;
    hold?: number;
    beats?: number[];
    drift?: number;
    pull?: boolean;
    tone?: 'dark' | 'light';
    enter?: 'fade' | 'settle';
    float?: boolean;
  } = {},
) => ({
  id,
  name,
  height,
  image,
  fade: o.fade ?? 0.65,
  shade: o.shade ?? 0.3,
  hold: o.hold ?? 0,
  beats: o.beats ?? [],
  drift: o.drift ?? 0,
  pull: o.pull ?? false,
  tone: o.tone ?? ('dark' as const),
  enter: o.enter ?? ('fade' as const),
  float: o.float ?? false,
  phone: null,
});

const nextProject = (id: string, name: string, href: string, src: string) => ({
  id,
  type: 'closing' as const,
  eyebrow: 'Next project',
  heading: name,
  text: '',
  linkLabel: `View ${name}`,
  href,
  image: pic(src),
});


const G = (id: string, src: string, alt: string, size: 's' | 'm' | 'l', y: number, href: string) => ({
  id,
  image: pic(src, alt),
  size,
  y,
  caption: '',
  href,
});

/*
 * The home page's story canvas and gallery: a hero, paper pages, settling photos,
 * chapter covers, a thread between stories, brackets, a camera story and picture
 * pieces for the work. (The home page adds "What we believe" at the end.)
 */
const top = (piece: string) => pin(piece, 0, 0, 0.5, -2.4);
const under = (piece: string) => pin(piece, 0, 1, 0.1, 2.4);
const storyCanvas = {
  id: 'lab-canvas',
  type: 'canvas' as const,
  lazyLoad: false,
  frameOut: false,
  stories: [
    S('lb-st-hero', 'Hero', 62.5, pic('/images/concept/moss.webp', 'Moss in close-up'), { fade: 0, shade: 0.28, drift: 0.35, float: true }),
    S('lb-st-intro', 'Who we are', 64, null, { tone: 'light', fade: 0.3, hold: 0.3 }),
    S('lb-st-cover1', 'Chapter one', 70, pic('/images/concept/forest.webp', 'A forest in mist'), { shade: 0.4, enter: 'settle', hold: 0.6 }),
    S('lb-st-quote', 'Where we start', 62.5, null, { hold: 0.45 }),
    S('lb-st-grow', 'How a project grows', 220, pic('/images/concept/moss-trunks.webp', 'Moss-covered trunks in a forest'), {
      shade: 0.45,
      hold: 2,
      beats: [56, 112],
      pull: true,
    }),
    S('lb-st-cover2', 'Chapter two', 66, pic('/images/concept/earth.webp', 'Dark soil from above'), { shade: 0.5, enter: 'settle', hold: 0.6 }),
    S('lb-st-crate', 'Crate', 64, null, { hold: 0.7 }),
    S('lb-st-inline', 'Inline CMS', 62, null, { hold: 0.7 }),
    S('lb-st-foxcub', 'Fox Cub', 64, null, { hold: 0.7 }),
  ],
  pieces: [
    P('lb-h1', 'lb-st-hero', 'Ideas,', 'hero', 10, 13, 40, { tag: 'h1' }),
    P('lb-h2', 'lb-st-hero', 'brought', 'hero', 58, 26.5, 38),
    P('lb-h3', 'lb-st-hero', 'to life.', 'hero', 51, 36, 42),
    P('lb-h-note', 'lb-st-hero', 'Discover\nhow we work ↓', 'small', 16, 52, 14),
    P(
      'lb-i1',
      'lb-st-intro',
      'We’re a small studio for ideas worth building.\nWe design and make digital products, start to finish.',
      'medium',
      12,
      17,
      76,
      { align: 'center' },
    ),
    P(
      'lb-i2',
      'lb-st-intro',
      'Good software has always been made this way.\nAll we do is listen closely, and keep it simple.',
      'medium',
      12,
      31,
      76,
      { align: 'center' },
    ),
    P('lb-n1', 'lb-st-cover1', 'I', 'hero', 47, 12, 6, { align: 'center' }),
    P('lb-n1-l', 'lb-st-cover1', 'From\nfirst\nsketch\nto scale', 'label', 37.5, 15.8, 10, { step: 0.9 }),
    P('lb-t1', 'lb-st-cover1', 'Approach', 'hero', 15, 24.5, 70, { tag: 'h2', align: 'center' }),
    P('lb-q-l', 'lb-st-quote', '1 / 3 · The approach', 'label', 38, 9, 24, { align: 'center' }),
    P(
      'lb-q',
      'lb-st-quote',
      'We start where every good product starts:\nwith a real problem, and a few people\nwho care about getting it right.',
      'medium',
      18,
      21,
      64,
      { align: 'center', brackets: true },
    ),
    P(
      'lb-q-b',
      'lb-st-quote',
      'No hand-offs between teams, no layers of account managers.\nThe people you meet are the people who design and build it.',
      'body',
      26,
      37,
      48,
      { soft: true, align: 'center' },
    ),
    P('lb-g0', 'lb-st-grow', 'How a project grows', 'label', 38, 6, 24, { align: 'center' }),
    P('lb-g1', 'lb-st-grow', 'Concept', 'display', 12, 22, 30),
    P('lb-g1n', 'lb-st-grow', 'A first sketch: a few screens,\nthe shape of the idea.', 'small', 12.4, 31.5, 22, { soft: true }),
    P('lb-g2', 'lb-st-grow', 'Prototype', 'display', 56, 76, 34),
    P('lb-g2n', 'lb-st-grow', 'Something real to click\nand put in front of people.', 'small', 56.4, 85.5, 22, { soft: true }),
    P('lb-g3', 'lb-st-grow', 'Version one', 'display', 12, 132, 42),
    P('lb-g3n', 'lb-st-grow', 'In people’s hands, with\nthe hard parts done properly.', 'small', 12.4, 141.5, 24, { soft: true }),
    P('lb-g4', 'lb-st-grow', 'Platform', 'display', 56, 184, 32),
    P('lb-g4n', 'lb-st-grow', 'Built to grow with you,\nfor as long as you need.', 'small', 56.4, 193.5, 24, { soft: true }),
    P('lb-n2', 'lb-st-cover2', 'II', 'hero', 45.5, 12, 9, { align: 'center' }),
    P('lb-n2-l', 'lb-st-cover2', 'What\nwe’ve\nmade\nlately', 'label', 36, 15.8, 10, { step: 0.9 }),
    P('lb-t2', 'lb-st-cover2', 'Work', 'hero', 15, 24.5, 70, { tag: 'h2', align: 'center' }),
    P('lb-c-no', 'lb-st-crate', '01 · Product · Music', 'label', 8, 7.5, 22, { soft: true }),
    P('lb-c-t', 'lb-st-crate', 'Crate', 'display', 8, 11, 30),
    P('lb-c-s', 'lb-st-crate', 'A music app built around what\ntrusted critics are recommending\nright now.', 'body', 8, 22.5, 24),
    I('lb-c-i1', 'lb-st-crate', '/images/work/crate-home.webp', 'Crate’s Discover screen', 42, 6, 50),
    I('lb-c-i2', 'lb-st-crate', '/images/work/crate-reviews.webp', 'Reviews in Crate', 26, 40, 24),
    I('lb-c-i3', 'lb-st-crate', '/images/work/crate-radio.webp', 'Crate radio', 58, 42, 22),
    P('lb-c-a1', 'lb-st-crate', 'Reviews ranked by how\nmany critics agree', 'small', 8, 45, 14, { soft: true }),
    P('lb-c-a2', 'lb-st-crate', 'Radio from the\nreviews you follow', 'small', 58, 57, 18, { soft: true }),
    P('lb-i-no', 'lb-st-inline', '02 · Platform · SaaS', 'label', 62, 7.5, 26, { soft: true }),
    P('lb-i-t', 'lb-st-inline', 'Inline CMS', 'display', 62, 11, 36),
    P('lb-i-s', 'lb-st-inline', 'A Cloudflare-native CMS where\ncontent is edited in place,\non the real site.', 'body', 62, 22.5, 26),
    I('lb-i-i1', 'lb-st-inline', '/images/work/inline-editor.webp', 'Editing a page in Inline CMS', 8, 6, 48),
    I('lb-i-i2', 'lb-st-inline', '/images/work/inline-public.webp', 'A published page', 32, 39, 12, 1.212),
    I('lb-i-i3', 'lb-st-inline', '/images/work/inline-choices.webp', 'Choices in the schema', 62, 40, 28, 0.418),
    P('lb-i-a1', 'lb-st-inline', 'Every edit happens\non the page itself', 'small', 8, 45, 16, { soft: true }),
    P('lb-i-a2', 'lb-st-inline', 'Choices, set up once\nin the schema', 'small', 62, 53.5, 18, { soft: true }),
    P('lb-f-no', 'lb-st-foxcub', '03 · Product · CMS', 'label', 8, 7.5, 22, { soft: true }),
    P('lb-f-t', 'lb-st-foxcub', 'Fox Cub', 'display', 8, 11, 30),
    P('lb-f-s', 'lb-st-foxcub', 'A small visual CMS\non a single Worker.', 'body', 8, 22.5, 22),
    P('lb-f-b', 'lb-st-foxcub', 'This site runs on it.', 'medium', 8, 42, 28, { align: 'center', brackets: true }),
    I('lb-f-i1', 'lb-st-foxcub', '/images/work/foxcub-editor.webp', 'Editing this site in Fox Cub', 40, 6, 52),
    I('lb-f-i2', 'lb-st-foxcub', '/images/work/foxcub-blocks.webp', 'Fox Cub’s blocks', 40, 42, 24),
    I('lb-f-i3', 'lb-st-foxcub', '/images/work/foxcub-inspector.webp', 'Fox Cub’s inspector', 68, 42, 24),
  ],
  lines: [
    // The hero's curve, from under the first words round into the last.
    L('lb-hl', 'lb-st-hero', [N(30, 24, { oy: 14, at: pin('lb-h1', 0, 1, 21, 1.6) }), N(49, 41, { ix: -13, at: pin('lb-h3', 0, 0.5, -1.9, 0) })]),
    // The thread: one straight line through the first chapter.
    L('lb-th1', 'lb-st-cover1', [N(50, 37, { at: pin('lb-t1', 0.5, 1, 0, 2.4) }), N(50, 77, { at: pin('lb-q-l', 0.5, 0, 0, -2) })]),
    L('lb-gl1', 'lb-st-grow', [N(50, 9.5, { oy: 8, at: pin('lb-g0', 0.5, 1, 0, 1.6) }), N(12.5, 19.6, { iy: -10, at: top('lb-g1') })], { dots: 'end' }),
    L('lb-gl2', 'lb-st-grow', [N(12.5, 38, { oy: 24, at: under('lb-g1n') }), N(56.5, 73.6, { iy: -22, at: top('lb-g2') })], { dots: 'end' }),
    L('lb-gl3', 'lb-st-grow', [N(56.5, 92, { oy: 24, at: under('lb-g2n') }), N(12.5, 129.6, { iy: -22, at: top('lb-g3') })], { dots: 'end' }),
    L('lb-gl4', 'lb-st-grow', [N(12.5, 148, { oy: 24, at: under('lb-g3n') }), N(56.5, 181.6, { iy: -22, at: top('lb-g4') })], { dots: 'end' }),
    L('lb-th3', 'lb-st-cover2', [N(50, 37, { at: pin('lb-t2', 0.5, 1, 0, 2.4) }), N(8.5, 72, { iy: -20, at: top('lb-c-no') })]),
    L('lb-cl1', 'lb-st-crate', [N(8.1, 32, { oy: 6, at: under('lb-c-s') }), N(8.5, 42.6, { iy: -6, at: top('lb-c-a1') })], { dash: true }),
    L('lb-cl2', 'lb-st-crate', [N(20, 47, { ox: 3, at: pin('lb-c-a1', 0, 0, 12.5, 1.2) }), N(25, 47.5, { ix: -2, at: pin('lb-c-i2', 0, 0.5, -1, 0) })], { dots: 'end' }),
    L('lb-il1', 'lb-st-inline', [N(24, 47, { ox: 3, at: pin('lb-i-a1', 0, 0, 15, 1.2) }), N(31, 46, { ix: -2, at: pin('lb-i-i2', 0, 0.5, -1, 0) })], { dots: 'end' }),
  ],
};

const workGallery = {
  id: 'lab-gallery',
  type: 'gallery' as const,
  tone: 'light' as const,
  eyebrow: 'In the making',
  heading: 'Every screen,\nby hand.',
  intro: 'A closer look at the products, as they grew. Each one opens its story.',
  items: [
    G('lg-1', '/images/work/crate-home.webp', 'Crate’s Discover screen', 'm', 0, '/work/crate'),
    G('lg-2', '/images/work/inline-public.webp', 'A page published from Inline CMS', 'l', 0, '/work/inline-cms'),
    G('lg-3', '/images/work/foxcub-editor.webp', 'Editing this site in Fox Cub', 'm', 0.05, '/work/fox-cub'),
    G('lg-4', '/images/work/inline-repeater.webp', 'A repeater in Inline CMS', 's', 0, '/work/inline-cms'),
    G('lg-5', '/images/work/crate-moods.webp', 'Moods in Crate', 'l', 0, '/work/crate'),
    G('lg-6', '/images/work/foxcub-media.webp', 'Fox Cub’s media library', 's', 0, '/work/fox-cub'),
    G('lg-7', '/images/work/inline-editor.webp', 'Editing in Inline CMS', 'm', 0, '/work/inline-cms'),
    G('lg-8', '/images/work/crate-stats.webp', 'Listening stats in Crate', 's', 0, '/work/crate'),
    G('lg-9', '/images/work/foxcub-blocks.webp', 'Fox Cub’s blocks', 'l', 0, '/work/fox-cub'),
    G('lg-10', '/images/work/crate-release.webp', 'A release in Crate', 'm', 0, '/work/crate'),
    G('lg-11', '/images/work/inline-data.webp', 'Data in Inline CMS', 's', 0, '/work/inline-cms'),
    G('lg-12', '/images/work/crate-radio.webp', 'Crate radio', 'm', 0, '/work/crate'),
  ],
};


export const seedSite: Site = {
  name: 'Wild Fox Digital',
  settings: {
    titleTemplate: '{title} — {site}',
    navigation: [
      { id: 'nav-work', label: 'Work', url: '/#work' },
      { id: 'nav-approach', label: 'Approach', url: '/#approach' },
      { id: 'nav-contact', label: 'Contact', url: '/#contact' },
    ],
    footerText: '',
    links: [{ id: 'link-email', label: 'hello@wildfox.digital', url: 'mailto:hello@wildfox.digital' }],
    redirects: [],
  },
  pages: [
    {
      id: 'page-home',
      slug: '/',
      title: 'Home',
      icon: 'home',
      seo: {
        title: 'Wild Fox Digital — Ideas, brought to life',
        description: 'A small product studio. We design and build products, platforms and apps, from first concept to enterprise scale.',
      },
      blocks: [
        // The stories (the hero on the monstera), ending with what we believe, framed out onto the light page.
        {
          ...storyCanvas,
          id: 'home-canvas',
          anchor: 'approach',
          frameOut: true,
          stories: [
            { ...storyCanvas.stories[0], image: pic('/images/monstera.webp', 'Monstera leaves after rain') },
            ...storyCanvas.stories.slice(1),
            S('st-believe', 'What we believe', 143, pic('/images/concept/moss.webp', 'Moss in close-up'), { shade: 0.36 }),
          ],
          pieces: [
            ...storyCanvas.pieces,
            P('pc-believe', 'st-believe', 'We believe in', 'medium', 12, 21, 16, { italic: true }),
            P('pc-beliefs', 'st-believe', 'small teams,\nhonest software,\ncraft over noise\nand growing with care.', 'body', 30, 21.4, 24),
            P('pc-details', 'st-believe', 'Small details,\ncarefully grown.', 'display', 26, 75, 62),
          ],
          lines: [
            ...storyCanvas.lines,
            L('ln-10', 'st-believe', [N(30.1, 35, { at: pin('pc-beliefs', 0, 1, 0.1, 2.6) }), N(30.1, 72.6, { at: pin('pc-details', 0, 0, 4.1, -2.4) })], {
              dots: 'end',
            }),
          ],
        },
        { ...workGallery, id: 'home-gallery', anchor: 'work' },
        {
          id: 'home-closing',
          type: 'closing',
          anchor: 'contact',
          eyebrow: 'Start a conversation',
          heading: 'Got an idea?\nLet’s bring it to life.',
          text: 'Early sketch or growing platform, tell us where you are. We’ll meet you there.',
          linkLabel: 'hello@wildfox.digital',
          href: 'mailto:hello@wildfox.digital',
          layout: 'split',
          frameIn: true,
          image: pic('/images/fox.webp', 'A red fox sitting at the edge of a forest'),
        },
      ],
    },
    {
      id: 'page-crate',
      slug: '/work/crate',
      title: 'Crate',
      icon: 'doc',
      seo: { description: 'Crate: a music app built around what trusted critics are recommending right now.' },
      blocks: [
        {
          id: 'crate-hero',
          type: 'projectHero',
          eyebrow: 'Case study',
          name: 'Crate',
          summary: 'Records the critics are excited about, in one place.',
          accent: '#ff6a3d',
          meta: [
            { id: 'cm-1', label: 'Type', value: 'Product' },
            { id: 'cm-2', label: 'Platform', value: 'Web app, Mac' },
            { id: 'cm-3', label: 'Stack', value: 'Next.js, SQLite' },
            { id: 'cm-4', label: 'Plays on', value: 'Browser, Spotify, Sonos' },
          ],
          screen: pic('/images/work/crate-home.webp', 'Crate’s Discover screen'),
          backdrop: pic('/images/concept/earth.webp'),
          lazyLoad: false,
        },
        {
          id: 'crate-showcase',
          type: 'showcase',
          tone: 'dark',
          eyebrow: 'Inside Crate',
          heading: 'Less scrolling,\nmore listening.',
          features: [
            {
              id: 'cf-1',
              title: 'Discover',
              text: 'A front page assembled from the critics: Pitchfork, The Quietus, Bandcamp Daily, NTS and more.',
              image: pic('/images/work/crate-home.webp', 'Discover'),
            },
            {
              id: 'cf-2',
              title: 'Critics’ Feed',
              text: 'Every review from every source, in one quiet timeline.',
              image: pic('/images/work/crate-reviews.webp', 'Critics’ Feed'),
            },
            {
              id: 'cf-3',
              title: 'Moods',
              text: 'Four sliders, from morning calm to late-night electronic.',
              image: pic('/images/work/crate-moods.webp', 'Moods'),
            },
            {
              id: 'cf-4',
              title: 'Radio',
              text: 'Live shows, and every track from this week’s picks, ready to play.',
              image: pic('/images/work/crate-radio.webp', 'Radio'),
            },
            {
              id: 'cf-5',
              title: 'Records',
              text: 'The artwork sets the palette. Reviews sit beside the tracklist.',
              image: pic('/images/work/crate-release.webp', 'A release page'),
            },
          ],
        },
        {
          id: 'crate-figures',
          type: 'figures',
          tone: 'dark',
          eyebrow: '',
          figures: [
            { id: 'cn-1', value: '11', label: 'critical sources, read every hour' },
            { id: 'cn-2', value: '15 min', label: 'between syncs while it runs' },
            { id: 'cn-3', value: '3', label: 'places to play: browser, Spotify, Sonos' },
          ],
        },
        {
          id: 'crate-stack',
          type: 'stack',
          tone: 'dark',
          eyebrow: 'Under the canopy',
          heading: 'How it’s\nbuilt.',
          intro: 'A local-first app: everything runs on one Mac, and phones on the network can drive it.',
          layers: [
            { id: 'cl-1', name: 'Interface', note: 'An app-like shell with artwork-driven colour.', tools: 'Next.js 16, React 19, Tailwind 4, Zustand' },
            { id: 'cl-2', name: 'Data', note: 'One SQLite file, with palettes pulled from every cover.', tools: 'SQLite, node-vibrant, Deezer metadata' },
            { id: 'cl-3', name: 'Sources', note: 'Feeds read hourly, matched to the catalogue by UPC and ISRC.', tools: 'RSS, scheduled sync, launchd' },
            { id: 'cl-4', name: 'Playback', note: 'Full tracks where you can, previews where you can’t.', tools: 'Spotify Web Playback SDK, Sonos, Previews' },
          ],
        },
        nextProject('crate-next', 'Inline CMS', '/work/inline-cms', '/images/ocean.webp'),
      ],
    },
    {
      id: 'page-inline',
      slug: '/work/inline-cms',
      title: 'Inline CMS',
      icon: 'doc',
      seo: { description: 'Inline CMS: a Cloudflare-native CMS where content is edited in place, on the real site.' },
      blocks: [
        {
          id: 'inline-hero',
          type: 'projectHero',
          eyebrow: 'Case study',
          name: 'Inline CMS',
          summary: 'Edit content in place, on the real site. Not in a form beside a preview.',
          accent: '#86e29b',
          meta: [
            { id: 'im-1', label: 'Type', value: 'Platform, SaaS' },
            { id: 'im-2', label: 'Runs on', value: 'Cloudflare Workers' },
            { id: 'im-3', label: 'Stack', value: 'TanStack Start, D1, R2' },
            { id: 'im-4', label: 'Footprint', value: 'About $5 a month' },
          ],
          screen: pic('/images/work/inline-editor.webp', 'Editing a page in Inline CMS'),
          backdrop: pic('/images/ocean.webp'),
          lazyLoad: false,
        },
        {
          id: 'inline-showcase',
          type: 'showcase',
          tone: 'dark',
          eyebrow: 'Inside Inline',
          heading: 'The page is\nthe editor.',
          features: [
            {
              id: 'if-1',
              title: 'Visual editing',
              text: 'Press Edit on any page. Change it where it lives, and see exactly what visitors will.',
              image: pic('/images/work/inline-editor.webp', 'Editing in place'),
            },
            {
              id: 'if-2',
              title: 'Structured fields',
              text: 'Choices, toggles and selects that read like the design, not like a database.',
              image: pic('/images/work/inline-data.webp', 'Fields'),
            },
            {
              id: 'if-3',
              title: 'Repeaters',
              text: 'Reorder, duplicate and drill into lists without losing your place.',
              image: pic('/images/work/inline-repeater.webp', 'A repeater field'),
            },
            {
              id: 'if-4',
              title: 'Real output',
              text: 'Every field lands in clean, typed content for the public site.',
              image: pic('/images/work/inline-public.webp', 'The public output'),
            },
          ],
        },
        {
          id: 'inline-figures',
          type: 'figures',
          tone: 'dark',
          eyebrow: '',
          figures: [
            { id: 'in-1', value: '1', label: 'Worker serves the site, the editor and every API' },
            { id: 'in-2', value: '~$5', label: 'a month to run' },
            { id: 'in-3', value: '1', label: 'command from clone to live site' },
          ],
        },
        {
          id: 'inline-stack',
          type: 'stack',
          tone: 'dark',
          eyebrow: 'Under the canopy',
          heading: 'How it’s\nbuilt.',
          intro: 'Cloudflare from top to bottom, with a typed contract between content and code.',
          layers: [
            { id: 'il-1', name: 'Edge', note: 'One Worker, close to every visitor.', tools: 'Cloudflare Workers, D1, KV, R2, Images' },
            { id: 'il-2', name: 'Site', note: 'A real app that content flows into, not a template.', tools: 'TanStack Start, React, Nitro' },
            { id: 'il-3', name: 'Content', note: 'Schemas generate the contracts both sides share.', tools: 'Typed blocks, Drizzle, OpenAPI' },
            { id: 'il-4', name: 'Tooling', note: 'Provisioning, deploys and AI access from the terminal.', tools: 'CLI, MCP server, Playwright' },
          ],
        },
        nextProject('inline-next', 'Fox Cub', '/work/fox-cub', '/images/fox.webp'),
      ],
    },
    {
      id: 'page-foxcub',
      slug: '/work/fox-cub',
      title: 'Fox Cub',
      icon: 'doc',
      seo: { description: 'Fox Cub: a small, inline-editing CMS on a single Cloudflare Worker. This site runs on it.' },
      blocks: [
        {
          id: 'fox-hero',
          type: 'projectHero',
          eyebrow: 'Case study',
          name: 'Fox Cub',
          summary: 'A small, inline-editing CMS on one Cloudflare Worker. The site you’re reading runs on it.',
          accent: '#ff7a1a',
          meta: [
            { id: 'fm-1', label: 'Type', value: 'Product, CMS' },
            { id: 'fm-2', label: 'Runs on', value: 'One Worker and D1' },
            { id: 'fm-3', label: 'Pages', value: 'Static HTML' },
            { id: 'fm-4', label: 'Visitor JS', value: 'A few kilobytes' },
          ],
          screen: pic('/images/work/foxcub-editor.webp', 'Editing this site in Fox Cub'),
          backdrop: pic('/images/concept/forest.webp'),
          lazyLoad: false,
        },
        {
          id: 'fox-showcase',
          type: 'showcase',
          tone: 'dark',
          eyebrow: 'Inside Fox Cub',
          heading: 'Small,\nbut mighty.',
          features: [
            {
              id: 'ff-1',
              title: 'Edit in place',
              text: 'Click any words to change them. Drag blocks to reorder. Press publish.',
              image: pic('/images/work/foxcub-inspector.webp', 'Editing a block, with its settings beside it'),
            },
            {
              id: 'ff-2',
              title: 'Blocks as modules',
              text: 'Each block is one file: how it edits, how it renders, nothing else.',
              image: pic('/images/work/foxcub-blocks.webp', 'Adding a block'),
            },
            {
              id: 'ff-3',
              title: 'Images, handled',
              text: 'Upload once. Get AVIF, WebP and JPEG at five sizes, served forever.',
              image: pic('/images/work/foxcub-media.webp', 'The media library'),
            },
            {
              id: 'ff-4',
              title: 'Settings that matter',
              text: 'Navigation, SEO, social cards and redirects, without a plugin in sight.',
              image: pic('/images/work/foxcub-settings.webp', 'Site settings'),
            },
          ],
        },
        {
          id: 'fox-figures',
          type: 'figures',
          tone: 'dark',
          eyebrow: '',
          figures: [
            { id: 'fn-1', value: '1', label: 'database read per page view' },
            { id: 'fn-2', value: '0', label: 'React or hydration for visitors' },
            { id: 'fn-3', value: '15', label: 'image variants made per upload, once' },
          ],
        },
        {
          id: 'fox-stack',
          type: 'stack',
          tone: 'dark',
          eyebrow: 'Under the canopy',
          heading: 'How it’s\nbuilt.',
          intro: 'Rendered to static HTML when you publish, so every visit is one fast read.',
          layers: [
            { id: 'fl-1', name: 'Worker', note: 'Routes, API, auth and publishing in one small app.', tools: 'Cloudflare Workers, Hono, Better Auth' },
            { id: 'fl-2', name: 'Storage', note: 'The whole site is one JSON document.', tools: 'D1, R2, Images binding' },
            { id: 'fl-3', name: 'Editor', note: 'A React canvas that renders the real site.', tools: 'React 19, Vite' },
            { id: 'fl-4', name: 'Output', note: 'Static pages with strict security headers.', tools: 'Static HTML, CSP, Responsive images' },
          ],
        },
        nextProject('fox-next', 'Crate', '/work/crate', '/images/concept/earth.webp'),
      ],
    },
  ],
};
