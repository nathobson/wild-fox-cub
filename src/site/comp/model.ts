import type { Pic } from '../shared';

/*
 * A comp: an art-directed scrolling canvas, laid out by hand in the composer.
 *
 * A canvas is a stack of stories. Each story is a stretch of the canvas with its own
 * height, its own photograph (or the one before it, carried on) and its own text and
 * lines, placed relative to the top of the story. Resizing, reordering or removing
 * a story leaves the others as they are.
 *
 * Everything is measured in board units (u): 1u is 1% of the board's width, across
 * and down, so a story scales with the screen like a picture. The desktop board is
 * designed at 1440px wide (one screen ≈ 62.5u tall); the phone board at 390px (one
 * screen ≈ 216u).
 *
 * The live site renders pieces and lines exactly where they were placed. The scroll
 * engine (public/site.js) plays each story as a reading sequence scrubbed to the
 * scroll position (see `sequence`), and crossfades the photographs as each story
 * arrives.
 */

export type PieceStyle = 'hero' | 'display' | 'large' | 'medium' | 'body' | 'small' | 'label';
export type PieceTag = 'p' | 'h1' | 'h2';

/** Where a piece sits in its story. */
export interface Frame {
  x: number;
  y: number;
  /** Width; text wraps inside it. */
  w: number;
}

export interface Piece {
  id: string;
  story: string;
  /** Lines of text; each line is revealed on its own. */
  text: string;
  style: PieceStyle;
  tag: PieceTag;
  italic: boolean;
  /** Quieter colour, for asides. */
  soft: boolean;
  align: 'left' | 'center' | 'right';
  /** Desktop placement, from the top of the story. */
  d: Frame;
  /** Arrives this many screens later (or earlier, if negative) than its place in the reading order. */
  wait: number;
  show: 'both' | 'desktop' | 'phone';
  /** A picture instead of text: it's wiped in as the piece arrives. */
  image: Pic | null;
  /** A picture's height as a fraction of its width. */
  ratio: number;
  /** Brackets: two arcs of a circle around the piece, sweeping down into place as it arrives. */
  frame: 'none' | 'brackets';
  /** Each line steps in by this much (in em) from the one before; negative steps back out. */
  step: number;
}

/** A line end pinned to a piece: a point on its box (fractions) plus an offset in u. */
export interface Attach {
  piece: string;
  ax: number;
  ay: number;
  dx: number;
  dy: number;
}

/**
 * A point on a line, with the handles of the curve through it (offsets from the
 * point, in u). Unpinned points are measured from the top of the line's story.
 * Smooth points keep their two handles in line.
 */
export interface PathNode {
  x: number;
  y: number;
  ix: number;
  iy: number;
  ox: number;
  oy: number;
  smooth: boolean;
  at?: Attach | null;
}

export interface CompLine {
  id: string;
  story: string;
  nodes: PathNode[];
  dash: boolean;
  dots: 'none' | 'start' | 'end' | 'both';
  weight: 1 | 1.5 | 2;
}

/** A story's hand-placed phone layout. Without one, the phone flows the desktop story in order. */
export interface StoryPhone {
  height: number;
  pieces: Record<string, Frame>;
  lines: CompLine[];
}

export interface Story {
  id: string;
  name: string;
  /** Desktop height, in u. */
  height: number;
  /** The photograph behind this story; null carries on the one before. */
  image: Pic | null;
  /** How long the crossfade into this story's photo takes, in screens. It's complete when the story's top reaches the middle of the screen. */
  fade: number;
  /** Darkening over the photo, 0–1. */
  shade: number;
  /**
   * Screens of scrolling the story holds still for (pinned, roughly centred), so its
   * reading sequence can play through before it moves on.
   */
  hold: number;
  /**
   * A held story taller than the screen can move like a camera: the screen holds
   * still at each beat (a height in u from the story's top, shown at the top of the
   * screen) while what's there plays, then glides on to the next. Desktop only.
   */
  beats: number[];
  /** Arrives slowly and leaves quickly (0–1): it rises early and lingers, then lifts away. */
  drift: number;
  /** Its photo slowly zooms in and dims as the story leaves. */
  pull: boolean;
  /** Light: a paper page with dark text. */
  tone: 'dark' | 'light';
  /** How its photo arrives: a crossfade, or a crossfade that settles from slightly zoomed in. */
  enter: 'fade' | 'settle';
  /**
   * A hero: not a reading sequence. When it arrives, every letter floats gently out
   * from the middle of the hero into place at once, and its lines draw.
   */
  float: boolean;
  phone: StoryPhone | null;
}

export interface Comp {
  stories: Story[];
  pieces: Piece[];
  lines: CompLine[];
}

export type BoardKind = 'desk' | 'phone';

export const BOARD = {
  desk: { width: 1440, screen: 62.5, columns: 12 },
  phone: { width: 390, screen: 216, columns: 6 },
} as const;

export const PIECE_STYLES: { value: PieceStyle; label: string }[] = [
  { value: 'hero', label: 'Hero' },
  { value: 'display', label: 'Display' },
  { value: 'large', label: 'Large' },
  { value: 'medium', label: 'Medium' },
  { value: 'body', label: 'Body' },
  { value: 'small', label: 'Small' },
  { value: 'label', label: 'Label' },
];

export const newId = () => crypto.randomUUID().slice(0, 8);

export const round = (n: number) => Math.round(n * 100) / 100;

export function node(x: number, y: number, at?: Attach | null): PathNode {
  return { x: round(x), y: round(y), ix: 0, iy: 0, ox: 0, oy: 0, smooth: true, at: at ?? null };
}

export function newPiece(story: string, patch: Partial<Piece> = {}): Piece {
  return {
    id: newId(),
    story,
    text: 'A short phrase.',
    style: 'body',
    tag: 'p',
    italic: false,
    soft: false,
    align: 'left',
    d: { x: 10, y: 10, w: 28 },
    wait: 0,
    show: 'both',
    image: null,
    ratio: 0.625,
    frame: 'none',
    step: 0,
    ...patch,
  };
}

export function newStory(patch: Partial<Story> = {}): Story {
  return {
    id: newId(),
    name: 'New story',
    height: BOARD.desk.screen,
    image: null,
    fade: 0.65,
    shade: 0.3,
    hold: 0,
    beats: [],
    drift: 0,
    pull: false,
    tone: 'dark',
    enter: 'fade',
    float: false,
    phone: null,
    ...patch,
  };
}

/** Pieces in reading order: top to bottom, then left to right. */
export function readingOrder(pieces: Piece[]) {
  return [...pieces].sort((a, b) => a.d.y - b.d.y || a.d.x - b.d.x);
}

export const piecesOf = (comp: Comp, story: string) => comp.pieces.filter((p) => p.story === story);
export const linesOf = (comp: Comp, story: string) => comp.lines.filter((l) => l.story === story);

/* --------------------------------------------------------------------------
   Phone flow: without a phone layout, a story's pieces stack in reading order,
   keeping a little of their desktop indent and some of the desktop spacing.
   -------------------------------------------------------------------------- */

/** Indent (u of the phone board) and space above (screens) for each piece of a story in the flow. */
export function flowPlacement(pieces: Piece[]) {
  const ordered = readingOrder(pieces).filter((p) => p.show !== 'desktop');
  const out = new Map<string, { indent: number; gap: number }>();
  ordered.forEach((piece, i) => {
    const prev = ordered[i - 1];
    const screens = (prev ? piece.d.y - prev.d.y : piece.d.y) / BOARD.desk.screen;
    const gap = i === 0 ? Math.min(0.6, screens * 0.8) : Math.max(0.08, Math.min(0.75, screens * 0.62));
    const indent = piece.style === 'display' || piece.style === 'large' ? 0 : Math.min(24, Math.max(0, (piece.d.x - 8) * 0.38));
    out.set(piece.id, { indent: round(indent), gap: round(gap) });
  });
  return out;
}

/** A story's desktop lines joining two pieces, which the phone flow draws its own way. */
export function flowLinks(comp: Comp, story: string) {
  const shown = new Set(comp.pieces.filter((p) => p.show !== 'desktop').map((p) => p.id));
  return linesOf(comp, story).flatMap((line) => {
    const from = line.nodes[0]?.at?.piece;
    const to = line.nodes[line.nodes.length - 1]?.at?.piece;
    return from && to && from !== to && shown.has(from) && shown.has(to) ? [{ line, from, to }] : [];
  });
}

/* --------------------------------------------------------------------------
   Geometry (shared by the composer; public/site.js does the same in px)
   -------------------------------------------------------------------------- */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Where a node sits, given the boxes of the pieces (same space) and the top of its line's story. */
export function resolveNode(n: PathNode, boxes: ReadonlyMap<string, Box>, top = 0): Pt {
  const box = n.at ? boxes.get(n.at.piece) : undefined;
  if (!box || !n.at) return { x: n.x, y: n.y + top };
  return { x: box.x + n.at.ax * box.w + n.at.dx, y: box.y + n.at.ay * box.h + n.at.dy };
}

/** SVG path data for nodes at the given positions, scaled by k (u → px). */
export function pathData(nodes: PathNode[], pts: Pt[], k = 1) {
  if (nodes.length === 0) return '';
  const f = (n: number) => round(n * k);
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    const pa = pts[i - 1];
    const pb = pts[i];
    d += ` C${f(pa.x + a.ox)} ${f(pa.y + a.oy)} ${f(pb.x + b.ix)} ${f(pb.y + b.iy)} ${f(pb.x)} ${f(pb.y)}`;
  }
  return d;
}

/** The nearest point on a box's edge, as fractions of the box. */
export function nearestOnBox(p: Pt, box: Box) {
  const cx = Math.min(Math.max(p.x, box.x), box.x + box.w);
  const cy = Math.min(Math.max(p.y, box.y), box.y + box.h);
  const inside = p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
  let ax = box.w ? (cx - box.x) / box.w : 0;
  let ay = box.h ? (cy - box.y) / box.h : 0;
  if (inside) {
    // Inside: snap to the closest edge.
    const d = [p.x - box.x, box.x + box.w - p.x, p.y - box.y, box.y + box.h - p.y];
    const m = Math.min(...d);
    if (m === d[0]) ax = 0;
    else if (m === d[1]) ax = 1;
    else if (m === d[2]) ay = 0;
    else ay = 1;
  }
  const at = { x: box.x + ax * box.w, y: box.y + ay * box.h };
  return { ax: round(ax), ay: round(ay), at, dist: Math.hypot(p.x - cx, p.y - cy) };
}

/** Splits the curve from a to b at t, returning the new middle node (at absolute position) and updated neighbours. */
export function splitSegment(a: PathNode, pa: Pt, b: PathNode, pb: Pt, t: number) {
  const lerp = (p: Pt, q: Pt, s: number) => ({ x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s });
  const p1 = { x: pa.x + a.ox, y: pa.y + a.oy };
  const p2 = { x: pb.x + b.ix, y: pb.y + b.iy };
  const q0 = lerp(pa, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, pb, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const s = lerp(r0, r1, t);
  const mid: PathNode = { ...node(s.x, s.y), ix: round(r0.x - s.x), iy: round(r0.y - s.y), ox: round(r1.x - s.x), oy: round(r1.y - s.y) };
  return {
    a: { ...a, ox: round(q0.x - pa.x), oy: round(q0.y - pa.y) },
    mid,
    b: { ...b, ix: round(q2.x - pb.x), iy: round(q2.y - pb.y) },
  };
}

/** A point on the cubic from a to b. */
export function pointOnSegment(a: PathNode, pa: Pt, b: PathNode, pb: Pt, t: number): Pt {
  const u = 1 - t;
  const c = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const xs = [pa.x, pa.x + a.ox, pb.x + b.ix, pb.x];
  const ys = [pa.y, pa.y + a.oy, pb.y + b.iy, pb.y];
  return { x: c[0] * xs[0] + c[1] * xs[1] + c[2] * xs[2] + c[3] * xs[3], y: c[0] * ys[0] + c[1] * ys[1] + c[2] * ys[2] + c[3] * ys[3] };
}

/**
 * The phone flow's own line between two pieces (boxes in px, first text line height
 * lh): down from under the first, then across to the second (as public/site.js).
 */
export function flowLinePath(a: Box, b: Box, lh: number) {
  const sx = a.x + 1;
  const sy = a.y + a.h + 12;
  const bx = b.x;
  const by = b.y;
  if (bx - sx > 40) {
    const ex = bx - 14;
    const ey = by + lh * 0.55;
    return `M${sx} ${sy} C${sx} ${sy + (ey - sy) * 0.9} ${sx + (ex - sx) * 0.1} ${ey} ${ex} ${ey}`;
  }
  const ex = bx + 1;
  const ey = by - 14;
  const mid = (sy + ey) / 2;
  return Math.abs(sx - ex) < 4 ? `M${sx} ${sy} L${ex} ${ey}` : `M${sx} ${sy} C${sx} ${mid} ${ex} ${mid} ${ex} ${ey}`;
}

/** The photograph showing during each story: its own, or the last one before it. */
export function storyPhotos(stories: Story[]) {
  let current: Pic | null = null;
  return stories.map((s) => (current = s.image ?? current));
}

/* --------------------------------------------------------------------------
   Reading sequence: within a story, pieces and lines arrive one at a time, in
   reading order, scrubbed to the scroll position. public/site.js does the same
   in px; the composer uses this to show the order.
   -------------------------------------------------------------------------- */

export interface Step {
  id: string;
  kind: 'piece' | 'line';
  /** Where the reading position is when it would naturally start (it has reached the reader). */
  natural: number;
  x: number;
  /** How much scrolling it takes to arrive. */
  span: number;
  /** Pieces: where the piece sits (for spotting captions). */
  box?: Box;
  /** Pieces: hero-sized words (smaller text level with them waits for them). */
  hero?: boolean;
  /** Lines: runs on into another story. */
  cross?: boolean;
  /** Lines: the pieces their ends are pinned to. */
  from?: string;
  to?: string;
  /** Lines: where the text they run into would naturally arrive; they draw faster if they must, to be there by then. */
  due?: number;
  /** Set by sequence(): where it starts. */
  start?: number;
}

/** Where the reader is: this far down the screen. */
export const READ = 0.74;

/**
 * A camera story's plan (as cameraPlan in public/site.js), in any unit as long as
 * it's the same throughout: the story's content height, its screen and its hold.
 * Reading positions (`r`) count from where the story's top passes the reading line.
 *
 * The screen holds still at each stop (the top, each beat, the end), sharing the
 * hold between them; between stops it glides on (eased), over as much scrolling as
 * it moves. While it's still, the reading line sweeps down what's on screen, so
 * what's there plays in turn.
 */
export function cameraPlan(height: number, hold: number, beats: number[], screen: number) {
  const end = height - screen;
  if (!beats.length || hold <= 0 || end < screen * 0.05) return null;
  const stops = [0];
  for (const b of [...beats].sort((x, y) => x - y)) if (b > stops[stops.length - 1] + screen * 0.1 && b < end - screen * 0.1) stops.push(b);
  stops.push(end);
  const still = (hold * screen) / stops.length;
  const r0 = READ * screen;
  const segs: { r0: number; r1: number; c0: number; c1: number }[] = [];
  const q: [number, number][] = [[r0, r0]];
  let r = r0;
  let sweep = 0;
  stops.forEach((stop, i) => {
    const next = stops[i + 1];
    sweep = next === undefined ? screen * 0.95 : Math.min(screen * 0.95, next - stop + r0);
    q.push([r, stop + r0], [r + still, stop + sweep]);
    segs.push({ r0: r, r1: r + still, c0: stop, c1: stop });
    r += still;
    if (next === undefined) return;
    segs.push({ r0: r, r1: r + next - stop, c0: stop, c1: next });
    r += next - stop;
  });
  // Released, it scrolls on; the reading line catches up with where it had swept to.
  q.push([r + sweep - r0, end + sweep]);
  return { stops, segs, q, released: r, hold: hold * screen };
}

type CameraPlan = NonNullable<ReturnType<typeof cameraPlan>>;

/** The reading position at which the reading line reaches this height in a camera story. */
export function cameraRead(plan: CameraPlan, y: number) {
  const q = plan.q;
  if (y <= q[0][1]) return y;
  for (let i = 1; i < q.length; i++) {
    const [ra, ya] = q[i - 1];
    const [rb, yb] = q[i];
    if (y <= yb) return yb > ya ? ra + ((rb - ra) * (y - ya)) / (yb - ya) : rb;
  }
  return y + plan.hold;
}

/** How far a camera story's content has moved up its screen at this reading position. */
export function cameraAt(plan: CameraPlan, r: number) {
  for (const s of plan.segs) {
    if (r > s.r1) continue;
    if (r <= s.r0) return s.c0;
    const t = (r - s.r0) / (s.r1 - s.r0);
    return s.c0 + (s.c1 - s.c0) * (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);
  }
  return plan.stops[plan.stops.length - 1];
}

/** How the reading sequence is paced, in screens. */
export const PACE = {
  /** A piece starts arriving when its top is this far above the reading line... */
  lead: 0.14,
  /** ...and the next one follows about this much scrolling later... */
  piece: 0.1,
  /** ...while each one takes this much scrolling to rise in full (eased in and out). */
  reveal: 0.4,
  /** ...and hero-sized words take this many times longer, zooming up into place. */
  hero: 1.5,
  /** Steps overlap the one before by this much of its span. */
  overlap: 0.3,
  /** Nothing waits more than this past its natural start. */
  cap: 0.45,
  /** Steps this close count as level (a row), read left to right. */
  row: 0.04,
  /** A piece this close under another (and overlapping it) is its caption, and arrives straight after it. */
  caption: 0.1,
  /** Stretches every arrival (and the gaps between them) by the same amount. */
  tempo: 1.6,
};

/**
 * Orders a story's steps: by height, then left to right along a row; a line comes
 * after the piece it starts from and before the piece it runs into; a caption (a
 * piece just under another) straight after its piece, so a row of titles with
 * notes under them reads title, note, title, note. Each step then
 * starts once the one before has (mostly) arrived, but never before it has reached
 * the reader, nor too long after; text a line runs into waits for the line to finish.
 * `screen` is one screen in the steps' units.
 */
export function sequence(steps: Step[], screen: number) {
  const row = PACE.row * screen;
  // Smaller text set beside hero-sized words (level with them) arrives as they finish arriving.
  const heroes = steps.filter((s) => s.hero && s.box);
  for (const s of steps)
    if (s.kind === 'piece' && !s.hero && s.box)
      for (const h of heroes) if (s.box.y < h.box!.y + h.box!.h && s.box.y + s.box.h > h.box!.y) s.natural = Math.max(s.natural, h.natural + h.span * 0.8);
  const captions = findCaptions(steps, screen);
  const order = steps.filter((s) => !captions.has(s)).sort((a, b) => (Math.abs(a.natural - b.natural) < row ? a.x - b.x : a.natural - b.natural));
  const move = (item: Step, to: number) => {
    order.splice(order.indexOf(item), 1);
    order.splice(to, 0, item);
  };
  // A line follows straight on from the piece it starts at.
  for (const line of order.filter((s) => s.kind === 'line')) {
    const from = order.find((s) => s.kind === 'piece' && s.id === line.from);
    if (!from) continue;
    line.natural = Math.min(line.natural, from.natural);
    move(line, order.indexOf(from) + (order.indexOf(from) > order.indexOf(line) ? 0 : 1));
  }
  for (const line of order.filter((s) => s.kind === 'line')) {
    const to = order.find((s) => s.kind === 'piece' && s.id === line.to);
    if (to && order.indexOf(to) < order.indexOf(line)) move(to, order.indexOf(line));
  }
  // Captions go straight after their piece (and after any caption already there), top first.
  const tail = new Map<Step, Step>();
  for (const [caption, parent] of [...captions].sort((a, b) => a[0].box!.y - b[0].box!.y)) {
    const anchor = tail.get(parent) ?? parent;
    order.splice(order.indexOf(anchor) + 1, 0, caption);
    caption.natural = Math.min(caption.natural, parent.natural);
    tail.set(parent, caption);
  }
  // Each step holds the next back by about one piece's worth (a line holds back the text it runs into until it arrives).
  let after = -Infinity;
  const lineEnds = new Map<string, number>();
  for (const step of order) {
    const start = Math.min(Math.max(step.natural, after), step.natural + PACE.cap * PACE.tempo * screen);
    if (step.kind === 'line' && step.due !== undefined) step.span = Math.max(Math.min(step.span, step.due - start), step.span * 0.35);
    step.start = Math.max(start, (step.kind === 'piece' && lineEnds.get(step.id)) || -Infinity);
    const hold = step.kind === 'line' ? Math.min(step.span, PACE.piece * PACE.tempo * screen) : PACE.piece * PACE.tempo * screen;
    // (A line running on into another story doesn't hold back the rest of its own.)
    if (!(step.kind === 'line' && step.cross)) after = step.start + hold * (1 - PACE.overlap);
    if (step.kind === 'line' && step.to) lineEnds.set(step.to, Math.max(lineEnds.get(step.to) ?? -Infinity, step.start + step.span * 0.96));
  }
  return order;
}

/** Pieces sitting just under another piece and overlapping it, mapped to that piece. */
function findCaptions(steps: Step[], screen: number) {
  const pieces = steps.filter((s) => s.kind === 'piece' && s.box);
  const out = new Map<Step, Step>();
  for (const b of pieces) {
    // (Hero-sized words are never a caption.)
    if (b.hero) continue;
    let best: Step | undefined;
    let bestGap = Infinity;
    for (const a of pieces) {
      if (a === b) continue;
      const A = a.box!;
      const B = b.box!;
      const gap = B.y - (A.y + A.h);
      const overlap = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      if (gap > -0.01 * screen && gap < PACE.caption * screen && overlap > 0.3 * Math.min(A.w, B.w) && gap < bestGap) {
        best = a;
        bestGap = gap;
      }
    }
    if (best) out.set(b, best);
  }
  return out;
}

export const emptyComp = (image: Pic): Comp => {
  const story = newStory({ name: 'Opening', height: 125, image, fade: 0 });
  return {
    stories: [story],
    pieces: [newPiece(story.id, { text: 'Ideas,\nbrought to life.', style: 'display', tag: 'h1', d: { x: 4.4, y: 34, w: 60 } })],
    lines: [],
  };
};

/** A comp with every field present; comps saved before stories become one story. */
const normalizePiece = (p: Piece): Piece => ({
  ...p,
  wait: p.wait ?? 0,
  image: p.image ?? null,
  ratio: p.ratio ?? 0.625,
  frame: p.frame ?? 'none',
  step: p.step ?? 0,
});

export function normalizeComp(c: Partial<Comp> & { bands?: { image: Pic; shade: number }[]; height?: number }): Comp {
  if (c.stories?.length)
    return {
      stories: c.stories.map((s) => ({
        ...s,
        hold: s.hold ?? 0,
        beats: s.beats ?? [],
        drift: s.drift ?? 0,
        pull: s.pull ?? false,
        tone: s.tone ?? 'dark',
        enter: s.enter === 'fade' || !s.enter ? 'fade' : 'settle',
        float: s.float ?? false,
      })),
      pieces: (c.pieces ?? []).map(normalizePiece),
      lines: c.lines ?? [],
    };
  const story = newStory({
    name: 'Story',
    height: c.height ?? 250,
    image: c.bands?.[0]?.image ?? { src: '', alt: '' },
    fade: 0,
    shade: c.bands?.[0]?.shade ?? 0.3,
  });
  return {
    stories: [story],
    pieces: (c.pieces ?? []).map((p) => ({ ...normalizePiece(p), story: story.id })),
    lines: (c.lines ?? []).map((l) => ({ ...l, story: story.id })),
  };
}
