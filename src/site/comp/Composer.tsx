import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaContext } from '../../components/media/context';
import { GlassInput, GlassTextarea, Row, Segmented, Slider, Toggle } from '../../components/ui/controls';
import type { MediaItem } from '../../lib/media';
import { canvasBlock, PieceText, pieceClass, pieceVars, type CanvasBlock } from '../blocks/canvas';
import { PicField, Picture, type Pic } from '../shared';
import {
  BOARD,
  cameraPlan,
  cameraRead,
  flowLinePath,
  flowLinks,
  flowPlacement,
  nearestOnBox,
  newId,
  newPiece,
  newStory,
  node,
  normalizeComp,
  pathData,
  PACE,
  PIECE_STYLES,
  piecesOf,
  pointOnSegment,
  readingOrder,
  resolveNode,
  round,
  sequence,
  splitSegment,
  storyPhotos,
  type Attach,
  type BoardKind,
  type Box,
  type Comp,
  type CompLine,
  type Frame,
  type PathNode,
  type Piece,
  type Pt,
  type Step,
  type Story,
} from './model';

/*
 * The composer: a full-screen art board for laying out a story canvas by hand.
 * The canvas is a stack of stories, each with its own height, photograph, text and
 * lines. What's placed here is exactly what the live site renders; the scroll
 * engine adds the motion (try Preview). Desktop and phone each get their own board.
 *
 * The board works in one space (u, from the top of the canvas); pieces and unpinned
 * line points are stored from the top of their story.
 */

type Draft = Comp & { frameOut: boolean };
type Tool = 'select' | 'text' | 'pen';
type Sel = { kind: 'pieces'; ids: string[] } | { kind: 'line'; id: string; node: number | null } | { kind: 'story'; id: string } | null;
type MBox = Box & { lh: number };

interface Props {
  block: CanvasBlock;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onClose: () => void;
}

const PAD_L = 150;
const PAD_R = 48;
const PAD_Y = 48;
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];

/* --------------------------------------------------------------------------
   Reading and writing one board's layout
   -------------------------------------------------------------------------- */

const storyOf = (c: Comp, id: string) => c.stories.find((s) => s.id === id);

/** Whether this story flows on this board (phone, not laid out by hand). */
const flows = (board: BoardKind, story: Story | undefined) => board === 'phone' && !story?.phone;

function frameOf(c: Comp, board: BoardKind, p: Piece): Frame {
  if (board === 'desk') return p.d;
  return storyOf(c, p.story)?.phone?.pieces[p.id] ?? { x: 6, y: 0, w: 88 };
}

function withPhone(c: Draft, storyId: string, fn: (phone: NonNullable<Story['phone']>) => Story['phone']): Draft {
  return { ...c, stories: c.stories.map((s) => (s.id === storyId && s.phone ? { ...s, phone: fn(s.phone) } : s)) };
}

/** Places pieces (frames from the top of the given story), moving them between stories on desktop. */
function withPlacements(c: Draft, board: BoardKind, moves: Record<string, { story: string; frame: Frame }>): Draft {
  if (board === 'phone') {
    let next = c;
    for (const [id, m] of Object.entries(moves)) next = withPhone(next, m.story, (ph) => ({ ...ph, pieces: { ...ph.pieces, [id]: m.frame } }));
    return next;
  }
  let next: Draft = {
    ...c,
    pieces: c.pieces.map((p) => (moves[p.id] ? { ...p, story: moves[p.id].story, d: moves[p.id].frame } : p)),
  };
  // A piece that changed story leaves the old story's phone layout and joins the end of the new one's.
  for (const p of c.pieces) {
    const m = moves[p.id];
    if (!m || m.story === p.story) continue;
    next = withPhone(next, p.story, (ph) => {
      const pieces = { ...ph.pieces };
      delete pieces[p.id];
      return { ...ph, pieces };
    });
    next = withPhone(next, m.story, (ph) => ({ ...ph, pieces: { ...ph.pieces, [p.id]: { x: 6, y: Math.max(0, ph.height - 50), w: 88 } } }));
  }
  return next;
}

/** The lines that can be edited on a board. */
const editLines = (c: Comp, board: BoardKind) => (board === 'desk' ? c.lines : c.stories.flatMap((s) => s.phone?.lines ?? []));

function withLines(c: Draft, board: BoardKind, lines: CompLine[]): Draft {
  if (board === 'desk') return { ...c, lines };
  return { ...c, stories: c.stories.map((s) => (s.phone ? { ...s, phone: { ...s.phone, lines: lines.filter((l) => l.story === s.id) } } : s)) };
}

function withStory(c: Draft, id: string, patch: Partial<Story>): Draft {
  return { ...c, stories: c.stories.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** Column edges of a board, in u (as the site's 12-column grid). */
function columnEdges(board: BoardKind) {
  const spec = BOARD[board];
  const g = Math.min(Math.max((20 / spec.width) * 100, 4.4), (64 / spec.width) * 100);
  const n = spec.columns;
  const c = (100 - 2 * g - (n - 1) * g) / n;
  const edges: { start: number; end: number }[] = [];
  for (let i = 0; i < n; i++) edges.push({ start: g + i * (c + g), end: g + i * (c + g) + c });
  return edges;
}

/** Shift: keep a line straight, or at 45°, from the point before. */
function constrain(p: Pt, from: Pt): Pt {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  if (Math.abs(dx) > Math.abs(dy) * 2) return { x: p.x, y: from.y };
  if (Math.abs(dy) > Math.abs(dx) * 2) return { x: from.x, y: p.y };
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: from.x + Math.sign(dx) * m, y: from.y + Math.sign(dy) * m };
}

/** Unpins line ends from removed pieces, leaving them where they were. */
function unpin(lines: CompLine[], ids: string[], pos: (line: CompLine, n: PathNode) => Pt) {
  return lines.map((l) => ({
    ...l,
    nodes: l.nodes.map((n) => {
      if (!n.at || !ids.includes(n.at.piece)) return n;
      const p = pos(l, n);
      return { ...n, x: round(p.x), y: round(p.y), at: null };
    }),
  }));
}

/* --------------------------------------------------------------------------
   Drags
   -------------------------------------------------------------------------- */

type Drag =
  | { type: 'pieces'; start: Pt; from: Record<string, { story: string; frame: Frame; top: number }>; base: Draft; moved: boolean }
  | { type: 'resize'; id: string; side: 'l' | 'r'; start: Pt; frame: Frame; story: string; base: Draft }
  | { type: 'node'; line: string; i: number; base: Draft; moved: boolean }
  | { type: 'handle'; line: string; i: number; side: 'i' | 'o'; base: Draft }
  | { type: 'pull'; line: string; i: number; base: Draft; pen: boolean }
  | { type: 'line'; line: string; start: Pt; nodes: PathNode[]; base: Draft; moved: boolean }
  | { type: 'marquee'; start: Pt; add: string[] }
  | { type: 'story-end'; id: string; start: Pt; height: number; base: Draft }
  | { type: 'hold'; id: string; start: Pt; hold: number; base: Draft }
  | { type: 'fade'; id: string; start: Pt; fade: number; base: Draft };

interface Guides {
  x: number[];
  y: number[];
}

export default function Composer({ block, onUpdate, onClose }: Props) {
  const media = useContext(MediaContext);
  const [draft, setDraft] = useState<Draft>(() => ({ ...normalizeComp(block), frameOut: block.frameOut }));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const history = useRef<{ past: Draft[]; future: Draft[] }>({ past: [], future: [] });
  const [, bump] = useState(0);

  const [board, setBoard] = useState<BoardKind>('desk');
  const [tool, setTool] = useState<Tool>('select');
  const [sel, setSel] = useState<Sel>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pen, setPen] = useState<string | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [snapPiece, setSnapPiece] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [show, setShow] = useState({ grid: false, screens: true, photos: true, order: true });
  const [preview, setPreview] = useState<{ kind: BoardKind; from: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [stageWidth, setStageWidth] = useState(1000);

  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const compRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const spec = BOARD[board];
  const W = spec.width;
  const k = W / 100;
  const fit = Math.min(1, (stageWidth - PAD_L - PAD_R) / W);
  const z = zoom === 'fit' ? fit : zoom;

  /* ---- Measuring stories and pieces, so lines can follow them ---- */

  const [boxes, setBoxes] = useState<Map<string, MBox>>(new Map());
  const [flowHeights, setFlowHeights] = useState<Map<string, number>>(new Map());
  const measureKey = useRef('');
  // Runs after every render (text, styles and positions all change sizes); it only
  // sets state when a measurement actually changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const comp = compRef.current;
    if (!comp) return;
    const next = new Map<string, MBox>();
    const heights = new Map<string, number>();
    comp.querySelectorAll<HTMLElement>('[data-story]').forEach((st) => {
      const pin = st.querySelector<HTMLElement>('.wf-story-pin') ?? st;
      heights.set(st.dataset.story!, round(pin.offsetHeight / k));
      st.querySelectorAll<HTMLElement>('[data-piece]').forEach((el) => {
        const first = el.querySelector<HTMLElement>('.line, .cmp-editing');
        next.set(el.dataset.piece!, {
          x: el.offsetLeft / k,
          y: (st.offsetTop + el.offsetTop) / k,
          w: el.offsetWidth / k,
          h: el.offsetHeight / k,
          lh: (first?.offsetHeight ?? 20) / k,
        });
      });
    });
    const key = board + JSON.stringify([...next].map(([id, b]) => [id, round(b.x), round(b.y), round(b.w), round(b.h)])) + JSON.stringify([...heights]);
    if (key !== measureKey.current) {
      measureKey.current = key;
      setBoxes(next);
      setFlowHeights(heights);
    }
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => setStageWidth(stage.clientWidth));
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // Fonts can load after the first measure.
  useEffect(() => {
    document.fonts?.ready.then(() => {
      measureKey.current = '';
      bump((n) => n + 1);
    });
  }, []);

  /* ---- Story geometry on this board ---- */

  /** A story's own height on this board, and with its hold. */
  const contentOn = (s: Story) => (board === 'desk' ? s.height : s.phone ? s.phone.height : (flowHeights.get(s.id) ?? spec.screen));
  const heightOn = (s: Story) => contentOn(s) + s.hold * spec.screen;
  const tops = useMemo(() => {
    const out = new Map<string, number>();
    let y = 0;
    for (const s of draft.stories) {
      out.set(s.id, y);
      y += heightOn(s);
    }
    out.set('', y);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, board, flowHeights]);
  const topOf = (id: string) => tops.get(id) ?? 0;
  const boardHeight = Math.max(tops.get('') ?? 0, 40);
  const storyAt = (y: number) => draft.stories.find((s) => y < topOf(s.id) + heightOn(s)) ?? draft.stories[draft.stories.length - 1];

  /* ---- History and saving ---- */

  /** Pinned line ends also keep their current position, so pages read well without JavaScript. */
  const bake = (c: Draft): Draft => {
    const lines = editLines(c, board).map((l) => ({
      ...l,
      nodes: l.nodes.map((n) => {
        if (!n.at || !boxes.has(n.at.piece)) return n;
        const p = resolveNode(n, boxes);
        return { ...n, x: round(p.x), y: round(p.y - topOf(l.story)) };
      }),
    }));
    return withLines(c, board, lines);
  };

  const save = (next: Draft) => {
    const { frameOut, ...comp } = bake(next);
    onUpdate({ ...comp, frameOut });
  };

  /** Records `base` in the undo history and saves `next`. */
  const commit = (next: Draft, base: Draft = draftRef.current) => {
    history.current.past.push(base);
    if (history.current.past.length > 200) history.current.past.shift();
    history.current.future = [];
    setDraft(next);
    save(next);
    bump((n) => n + 1);
  };

  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(draftRef.current);
    setDraft(prev);
    save(prev);
    bump((n) => n + 1);
  };

  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(draftRef.current);
    setDraft(next);
    save(next);
    bump((n) => n + 1);
  };

  /* ---- Derived geometry ---- */

  const lines = editLines(draft, board);
  const ptsOf = (line: CompLine) => line.nodes.map((n) => resolveNode(n, boxes, topOf(line.story)));
  const visible = (p: Piece) => (board === 'desk' ? p.show !== 'phone' : p.show !== 'desktop');
  const movable = (p: Piece) => !flows(board, storyOf(draft, p.story));
  const selectedIds = sel?.kind === 'pieces' ? sel.ids : [];
  const selLine = sel?.kind === 'line' ? lines.find((l) => l.id === sel.id) : undefined;
  const selStory = sel?.kind === 'story' ? storyOf(draft, sel.id) : undefined;

  /** Pointer position on the board, in u. */
  const toU = (e: { clientX: number; clientY: number }): Pt => {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.width) * 100 };
  };
  const thr = (px: number) => px / (z * k);

  /** A piece close enough to pin a line end to, unless Cmd/Ctrl is held. */
  const findAttach = (p: Pt, free: boolean): { at: Attach; pt: Pt } | null => {
    if (free) return null;
    let best: { at: Attach; pt: Pt; dist: number } | null = null;
    for (const piece of draft.pieces) {
      if (!visible(piece)) continue;
      const box = boxes.get(piece.id);
      if (!box) continue;
      const n = nearestOnBox(p, box);
      if (n.dist < thr(28) && (!best || n.dist < best.dist)) {
        best = { at: { piece: piece.id, ax: n.ax, ay: n.ay, dx: round(p.x - n.at.x), dy: round(p.y - n.at.y) }, pt: p, dist: n.dist };
      }
    }
    return best;
  };

  /** Snaps a point to other line points (lining up verticals and horizontals). */
  const snapPoint = (p: Pt, skip: { line: string; i: number } | null, free: boolean): Pt => {
    if (free) return p;
    const t = thr(6);
    let x = p.x;
    let y = p.y;
    const gx: number[] = [];
    const gy: number[] = [];
    for (const line of lines) {
      ptsOf(line).forEach((q, i) => {
        if (skip && skip.line === line.id && skip.i === i) return;
        if (Math.abs(q.x - p.x) < t && gx.length === 0) {
          x = q.x;
          gx.push(q.x);
        }
        if (Math.abs(q.y - p.y) < t && gy.length === 0) {
          y = q.y;
          gy.push(q.y);
        }
      });
    }
    setGuides({ x: gx, y: gy });
    return { x, y };
  };

  /** Stores a point on the board as a node of a line (unpinned points are kept from the top of the line's story). */
  const local = (line: CompLine | { story: string }, p: Pt) => ({ x: round(p.x), y: round(p.y - topOf(line.story)) });

  /* ---- Editing operations ---- */

  const updatePieces = (ids: string[], patch: Partial<Piece>) =>
    commit({ ...draft, pieces: draft.pieces.map((p) => (ids.includes(p.id) ? { ...p, ...patch } : p)) });

  const updateLine = (id: string, patch: Partial<CompLine>) =>
    commit(
      withLines(
        draft,
        board,
        lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      ),
    );

  /** Adds a piece to its story: where it's placed on this board, and at the end of the other. */
  const addPiece = (c: Draft, piece: Piece, frame: Frame): Draft => {
    const story = storyOf(c, piece.story)!;
    let next: Draft = {
      ...c,
      pieces: [...c.pieces, board === 'desk' ? { ...piece, d: frame } : { ...piece, d: { x: 10, y: Math.max(0, story.height - 30), w: 30 } }],
    };
    next = withPhone(next, story.id, (ph) => ({
      ...ph,
      pieces: { ...ph.pieces, [piece.id]: board === 'phone' ? frame : { x: 6, y: Math.max(0, ph.height - 50), w: 88 } },
    }));
    return next;
  };

  /** Removes pieces everywhere, unpinning any line ends that followed them. */
  const withoutPieces = (c: Draft, ids: string[]): Draft => {
    const pos = (l: CompLine, n: PathNode) => {
      const p = resolveNode(n, boxes, topOf(l.story));
      return { x: p.x, y: p.y - topOf(l.story) };
    };
    return {
      ...c,
      pieces: c.pieces.filter((p) => !ids.includes(p.id)),
      lines: board === 'desk' ? unpin(c.lines, ids, pos) : unpin(c.lines, ids, (_l, n) => ({ x: n.x, y: n.y })),
      stories: c.stories.map((s) => {
        if (!s.phone) return s;
        const pieces = { ...s.phone.pieces };
        ids.forEach((id) => delete pieces[id]);
        const phoneLines = board === 'phone' ? unpin(s.phone.lines, ids, pos) : unpin(s.phone.lines, ids, (_l, n) => ({ x: n.x, y: n.y }));
        return { ...s, phone: { ...s.phone, pieces, lines: phoneLines } };
      }),
    };
  };

  const deletePieces = (ids: string[]) => {
    commit(withoutPieces(draft, ids));
    setSel(null);
  };

  const duplicatePieces = (ids: string[], c: Draft = draft, offset = 2): { next: Draft; ids: string[] } => {
    let next = c;
    const fresh: string[] = [];
    for (const id of ids) {
      const piece = c.pieces.find((p) => p.id === id);
      if (!piece) continue;
      const copy = { ...piece, id: newId() };
      const f = frameOf(c, board, piece);
      next = addPiece(next, copy, { ...f, x: round(f.x + offset), y: round(f.y + offset) });
      fresh.push(copy.id);
    }
    return { next, ids: fresh };
  };

  /* ---- Stories ---- */

  const addStory = (after?: string) => {
    const i = after ? draft.stories.findIndex((s) => s.id === after) : draft.stories.length - 1;
    const story = newStory({ name: `Story ${draft.stories.length + 1}` });
    const stories = [...draft.stories];
    stories.splice(i + 1, 0, story);
    commit({ ...draft, stories });
    setSel({ kind: 'story', id: story.id });
  };

  const deleteStory = (id: string) => {
    if (draft.stories.length < 2) return;
    const ids = draft.pieces.filter((p) => p.story === id).map((p) => p.id);
    const next = withoutPieces(draft, ids);
    commit({ ...next, stories: next.stories.filter((s) => s.id !== id), lines: next.lines.filter((l) => l.story !== id) });
    setSel(null);
  };

  const duplicateStory = (id: string) => {
    const story = storyOf(draft, id);
    if (!story) return;
    const map = new Map<string, string>();
    const copyId = newId();
    const pieces = draft.pieces
      .filter((p) => p.story === id)
      .map((p) => {
        const nid = newId();
        map.set(p.id, nid);
        return { ...p, id: nid, story: copyId };
      });
    const remap = (l: CompLine): CompLine => ({
      ...l,
      id: newId(),
      story: copyId,
      nodes: l.nodes.map((n) => (n.at && map.has(n.at.piece) ? { ...n, at: { ...n.at, piece: map.get(n.at.piece)! } } : n)),
    });
    const copy: Story = {
      ...story,
      id: copyId,
      name: `${story.name} copy`,
      phone: story.phone
        ? {
            ...story.phone,
            pieces: Object.fromEntries(Object.entries(story.phone.pieces).map(([pid, f]) => [map.get(pid) ?? pid, f])),
            lines: story.phone.lines.map(remap),
          }
        : null,
    };
    const stories = [...draft.stories];
    stories.splice(stories.indexOf(story) + 1, 0, copy);
    commit({ ...draft, stories, pieces: [...draft.pieces, ...pieces], lines: [...draft.lines, ...draft.lines.filter((l) => l.story === id).map(remap)] });
    setSel({ kind: 'story', id: copyId });
  };

  const moveStory = (id: string, to: number) => {
    const stories = draft.stories.filter((s) => s.id !== id);
    const story = storyOf(draft, id);
    if (!story) return;
    stories.splice(Math.max(0, Math.min(stories.length, to)), 0, story);
    commit({ ...draft, stories });
  };

  const scrollToStory = (id: string) => {
    const stage = stageRef.current;
    if (stage) stage.scrollTo({ top: PAD_Y + topOf(id) * k * z - 24, behavior: 'smooth' });
  };

  /** Freezes a story's phone flow into a layout that can be placed by hand. */
  const customisePhone = (id: string) => {
    const story = storyOf(draft, id);
    if (!story || board !== 'phone') return;
    const top = topOf(id);
    const pieces: Record<string, Frame> = {};
    for (const p of piecesOf(draft, id)) {
      const b = boxes.get(p.id);
      if (b) pieces[p.id] = { x: round(b.x), y: round(b.y - top), w: round(b.w) };
    }
    const px = 1 / k;
    const phoneLines: CompLine[] = flowLinks(draft, id).flatMap(({ line, from, to }) => {
      const a = boxes.get(from);
      const b = boxes.get(to);
      if (!a || !b) return [];
      const sx = a.x + px;
      const sy = a.y + a.h + 12 * px;
      const start: PathNode = { ...node(sx, sy - top, { piece: from, ax: 0, ay: 1, dx: round(px), dy: round(12 * px) }), smooth: false };
      let end: PathNode;
      if (b.x - sx > 40 * px) {
        const ex = b.x - 14 * px;
        const ey = b.y + b.lh * 0.55;
        start.oy = round((ey - sy) * 0.9);
        end = { ...node(ex, ey - top, { piece: to, ax: 0, ay: 0, dx: round(-14 * px), dy: round(b.lh * 0.55) }), ix: round(-(ex - sx) * 0.9), smooth: false };
      } else {
        const ey = b.y - 14 * px;
        const mid = (ey - sy) / 2;
        start.oy = round(mid);
        end = { ...node(b.x + px, ey - top, { piece: to, ax: 0, ay: 0, dx: round(px), dy: round(-14 * px) }), iy: round(-mid), smooth: false };
      }
      return [{ ...line, id: newId(), nodes: [start, end] }];
    });
    commit(withStory(draft, id, { phone: { pieces, lines: phoneLines, height: round(flowHeights.get(id) ?? spec.screen) } }));
  };

  /* ---- Selection-wide operations ---- */

  const deleteSelection = () => {
    if (!sel) return;
    if (sel.kind === 'pieces') deletePieces(sel.ids);
    if (sel.kind === 'story') deleteStory(sel.id);
    if (sel.kind === 'line') {
      const line = lines.find((l) => l.id === sel.id);
      if (!line) return;
      if (sel.node !== null && line.nodes.length > 2) {
        updateLine(line.id, { nodes: line.nodes.filter((_, i) => i !== sel.node) });
        setSel({ ...sel, node: null });
      } else {
        commit(
          withLines(
            draft,
            board,
            lines.filter((l) => l.id !== sel.id),
          ),
        );
        setSel(null);
      }
    }
  };

  const nudge = (dx: number, dy: number) => {
    if (sel?.kind === 'pieces') {
      const moves: Record<string, { story: string; frame: Frame }> = {};
      for (const id of sel.ids) {
        const p = draft.pieces.find((q) => q.id === id);
        if (!p || !movable(p)) continue;
        const f = frameOf(draft, board, p);
        moves[id] = { story: p.story, frame: { ...f, x: round(f.x + dx), y: round(Math.max(0, f.y + dy)) } };
      }
      commit(withPlacements(draft, board, moves));
    }
    if (sel?.kind === 'line') {
      const line = lines.find((l) => l.id === sel.id);
      if (!line) return;
      const move = (n: PathNode, i: number) =>
        sel.node === null || sel.node === i
          ? n.at
            ? { ...n, at: { ...n.at, dx: round(n.at.dx + dx), dy: round(n.at.dy + dy) } }
            : { ...n, x: round(n.x + dx), y: round(n.y + dy) }
          : n;
      updateLine(line.id, { nodes: line.nodes.map(move) });
    }
  };

  const finishPen = () => {
    if (!pen) return;
    const current = editLines(draftRef.current, board);
    const line = current.find((l) => l.id === pen);
    if (line && line.nodes.length < 2) {
      setDraft(
        withLines(
          draftRef.current,
          board,
          current.filter((l) => l.id !== pen),
        ),
      );
      history.current.past.pop();
      setSel(null);
    } else if (line) {
      save(draftRef.current);
      setSel({ kind: 'line', id: pen, node: null });
    }
    setPen(null);
    setHover(null);
    setSnapPiece(null);
    setTool('select');
  };

  /* ---- Keyboard ---- */

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') return; // the editor saves
    if (typing) {
      if (e.key === 'Escape') {
        target.blur();
        e.stopPropagation();
      }
      return;
    }
    let handled = true;
    const step = e.shiftKey ? 10 / k : 1 / k;
    if (mod && e.key.toLowerCase() === 'z') (e.shiftKey ? redo : undo)();
    else if (mod && e.key.toLowerCase() === 'y') redo();
    else if (mod && e.key.toLowerCase() === 'd' && sel?.kind === 'pieces') {
      const { next, ids } = duplicatePieces(sel.ids);
      commit(next);
      setSel({ kind: 'pieces', ids });
    } else if (mod && e.key.toLowerCase() === 'd' && sel?.kind === 'story') duplicateStory(sel.id);
    else if (mod && e.key.toLowerCase() === 'a') setSel({ kind: 'pieces', ids: draft.pieces.filter(visible).map((p) => p.id) });
    else if (mod && (e.key === '=' || e.key === '+')) setZoom(ZOOMS.find((v) => v > z + 0.01) ?? z);
    else if (mod && e.key === '-') setZoom([...ZOOMS].reverse().find((v) => v < z - 0.01) ?? z);
    else if (mod && e.key === '0') setZoom('fit');
    else if (mod) handled = false;
    else if (e.key === 'Escape') {
      if (pen) finishPen();
      else if (preview) setPreview(null);
      else if (sel) setSel(null);
      else setTool('select');
    } else if (e.key === 'Enter') {
      if (pen) finishPen();
      else if (sel?.kind === 'pieces' && sel.ids.length === 1) setEditing(sel.ids[0]);
    } else if (e.key === 'Backspace' || e.key === 'Delete') deleteSelection();
    else if (e.key === 'ArrowLeft') nudge(-step, 0);
    else if (e.key === 'ArrowRight') nudge(step, 0);
    else if (e.key === 'ArrowUp') nudge(0, -step);
    else if (e.key === 'ArrowDown') nudge(0, step);
    else if (e.key === 'v') setTool('select');
    else if (e.key === 't') setTool('text');
    else if (e.key === 'p' || e.key === 'l') setTool('pen');
    else if (e.key === 'g') setShow((s) => ({ ...s, grid: !s.grid }));
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    if (tool !== 'pen' && pen) finishPen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  useEffect(() => {
    setSel((s) => (s?.kind === 'story' ? s : null));
    setEditing(null);
    setPen(null);
    measureKey.current = '';
  }, [board]);

  /* ---- Pointer handling ---- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) {
      if (!(e.target as HTMLElement).closest('.cmp-editing')) setEditing(null);
      return;
    }
    if (e.button !== 0) return;
    const target = (e.target as Element).closest<HTMLElement | SVGElement>('[data-h]');
    const h = target?.dataset.h;
    const id = target?.dataset.id ?? '';
    const p = toU(e);
    const free = e.metaKey || e.ctrlKey;

    if (h === 'story-label') {
      setSel({ kind: 'story', id });
      return;
    }
    if (h === 'hold') {
      dragRef.current = { type: 'hold', id, start: p, hold: storyOf(draft, id)!.hold, base: draft };
      setSel({ kind: 'story', id });
      return capture(e);
    }
    if (h === 'story-end') {
      const story = storyOf(draft, id)!;
      dragRef.current = { type: 'story-end', id, start: p, height: board === 'desk' ? story.height : (story.phone?.height ?? 0), base: draft };
      setSel({ kind: 'story', id });
      return capture(e);
    }
    if (h === 'fade') {
      dragRef.current = { type: 'fade', id, start: p, fade: storyOf(draft, id)!.fade, base: draft };
      setSel({ kind: 'story', id });
      return capture(e);
    }

    if (tool === 'text') {
      const story = storyAt(p.y);
      if (flows(board, story)) return;
      const piece = newPiece(story.id, { text: 'New text' });
      const frame = { x: round(p.x), y: round(p.y - topOf(story.id)), w: board === 'desk' ? 24 : 70 };
      commit(addPiece(draft, piece, frame));
      setSel({ kind: 'pieces', ids: [piece.id] });
      setEditing(piece.id);
      setTool('select');
      return;
    }

    if (tool === 'pen') {
      const story = storyAt(p.y);
      if (flows(board, story) && !pen) return;
      const attach = findAttach(p, free);
      setSnapPiece(attach?.at.piece ?? null);
      const current = pen ? lines.find((l) => l.id === pen) : undefined;
      if (current) {
        const pts = ptsOf(current);
        const last = pts[pts.length - 1];
        // Clicking the last point again finishes the line.
        if (Math.hypot(p.x - last.x, p.y - last.y) < thr(8)) return finishPen();
        const pinned = attach && !e.shiftKey;
        const q = pinned ? attach.pt : e.shiftKey ? constrain(p, last) : snapPoint(p, null, free);
        const l = local(current, q);
        const n = node(l.x, l.y, pinned ? attach.at : null);
        setDraft(
          withLines(
            draft,
            board,
            lines.map((x) => (x.id === current.id ? { ...x, nodes: [...x.nodes, n] } : x)),
          ),
        );
        dragRef.current = { type: 'pull', line: current.id, i: current.nodes.length, base: draft, pen: true };
      } else {
        const q = attach ? attach.pt : p;
        const l = local({ story: story.id }, q);
        const line: CompLine = { id: newId(), story: story.id, nodes: [node(l.x, l.y, attach?.at)], dash: false, dots: 'none', weight: 1 };
        const next = withLines(draft, board, [...lines, line]);
        commit(next);
        setPen(line.id);
        setSel({ kind: 'line', id: line.id, node: null });
        dragRef.current = { type: 'pull', line: line.id, i: 0, base: next, pen: true };
      }
      return capture(e);
    }

    // Select tool.
    if (h === 'resize-l' || h === 'resize-r') {
      const piece = draft.pieces.find((q) => q.id === id)!;
      dragRef.current = {
        type: 'resize',
        id,
        side: h === 'resize-l' ? 'l' : 'r',
        start: p,
        frame: frameOf(draft, board, piece),
        story: piece.story,
        base: draft,
      };
    } else if (h === 'piece') {
      let ids = selectedIds.includes(id) ? selectedIds : [id];
      if (e.shiftKey) ids = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
      let c = draft;
      if (e.altKey) {
        const dup = duplicatePieces(
          ids.filter((pid) => movable(draft.pieces.find((q) => q.id === pid)!)),
          draft,
          0,
        );
        c = dup.next;
        ids = dup.ids;
        setDraft(c);
      }
      setSel({ kind: 'pieces', ids });
      const from: Record<string, { story: string; frame: Frame; top: number }> = {};
      for (const pid of ids) {
        const piece = c.pieces.find((q) => q.id === pid);
        if (piece && movable(piece)) from[pid] = { story: piece.story, frame: frameOf(c, board, piece), top: topOf(piece.story) };
      }
      if (Object.keys(from).length) dragRef.current = { type: 'pieces', start: p, from, base: draft, moved: e.altKey };
    } else if (h === 'node') {
      const lineId = target!.dataset.line!;
      const i = Number(target!.dataset.i);
      setSel({ kind: 'line', id: lineId, node: i });
      dragRef.current = e.altKey ? { type: 'pull', line: lineId, i, base: draft, pen: false } : { type: 'node', line: lineId, i, base: draft, moved: false };
    } else if (h === 'handle') {
      dragRef.current = { type: 'handle', line: target!.dataset.line!, i: Number(target!.dataset.i), side: target!.dataset.side as 'i' | 'o', base: draft };
    } else if (h === 'line') {
      setSel({ kind: 'line', id, node: null });
      const line = lines.find((l) => l.id === id);
      if (line) dragRef.current = { type: 'line', line: id, start: p, nodes: line.nodes, base: draft, moved: false };
    } else {
      if (!e.shiftKey) setSel(null);
      dragRef.current = { type: 'marquee', start: p, add: e.shiftKey ? selectedIds : [] };
    }
    capture(e);
  };

  const capture = (e: React.PointerEvent) => {
    const move = (ev: PointerEvent) => onDragMove(ev);
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onDragEnd(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  };

  const onDragMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const c = draftRef.current;
    const p = toU(e);
    const free = e.metaKey || e.ctrlKey;
    const ls = editLines(c, board);
    const setLine = (id: string, nodes: PathNode[]) =>
      setDraft(
        withLines(
          c,
          board,
          ls.map((l) => (l.id === id ? { ...l, nodes } : l)),
        ),
      );

    if (d.type === 'pieces') {
      let dx = p.x - d.start.x;
      let dy = p.y - d.start.y;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (!d.moved && Math.hypot(dx, dy) < thr(3)) return;
      d.moved = true;
      // Snap the group's first piece to columns, the other pieces and screen lines.
      const ids = Object.keys(d.from);
      const first = d.from[ids[0]];
      const box0 = boxes.get(ids[0]);
      const t = thr(6);
      const gx: number[] = [];
      const gy: number[] = [];
      if (!free && first && box0) {
        const xs: number[] = [50];
        columnEdges(board).forEach((col) => xs.push(col.start, col.end));
        const ys: number[] = [];
        for (const piece of c.pieces) {
          if (ids.includes(piece.id) || !visible(piece)) continue;
          const b = boxes.get(piece.id);
          if (!b) continue;
          xs.push(b.x, b.x + b.w);
          ys.push(b.y, b.y + b.h);
        }
        for (const s of c.stories) {
          const top = topOf(s.id);
          for (let n = 0; n * spec.screen < heightOn(s); n++) ys.push(top + n * spec.screen);
        }
        const nx = first.frame.x + dx;
        const ny = first.top + first.frame.y + dy;
        let best: { delta: number; line: number } | null = null;
        for (const v of [nx, nx + first.frame.w, nx + first.frame.w / 2])
          for (const x of xs) if (Math.abs(v - x) < t && (!best || Math.abs(v - x) < Math.abs(best.delta))) best = { delta: x - v, line: x };
        if (best && !e.shiftKey) {
          dx += best.delta;
          gx.push(best.line);
        }
        let bestY: { delta: number; line: number } | null = null;
        for (const v of [ny, ny + box0.h])
          for (const y of ys) if (Math.abs(v - y) < t && (!bestY || Math.abs(v - y) < Math.abs(bestY.delta))) bestY = { delta: y - v, line: y };
        if (bestY && !e.shiftKey) {
          dy += bestY.delta;
          gy.push(bestY.line);
        }
      }
      setGuides({ x: gx, y: gy });
      const moves: Record<string, { story: string; frame: Frame }> = {};
      for (const id of ids) {
        const f = d.from[id];
        const y = Math.max(0, f.top + f.frame.y + dy);
        // On desktop a piece belongs to the story its top edge is in.
        const story = board === 'desk' ? storyAt(y).id : f.story;
        moves[id] = { story, frame: { ...f.frame, x: round(f.frame.x + dx), y: round(Math.max(0, y - topOf(story))) } };
      }
      setDraft(withPlacements(c, board, moves));
    }

    if (d.type === 'resize') {
      const dx = p.x - d.start.x;
      const f = d.frame;
      const frame =
        d.side === 'r' ? { ...f, w: round(Math.max(3, f.w + dx)) } : { ...f, x: round(Math.min(f.x + f.w - 3, f.x + dx)), w: round(Math.max(3, f.w - dx)) };
      setDraft(withPlacements(c, board, { [d.id]: { story: d.story, frame } }));
    }

    if (d.type === 'node') {
      d.moved = true;
      const line = ls.find((l) => l.id === d.line);
      if (!line) return;
      const pts = ptsOf(line);
      const ref = pts[d.i - 1] ?? pts[d.i + 1];
      const attach = e.shiftKey ? null : findAttach(p, free);
      const q = e.shiftKey && ref ? constrain(p, ref) : attach ? p : snapPoint(p, { line: d.line, i: d.i }, free);
      setSnapPiece(attach?.at.piece ?? null);
      const l = local(line, q);
      setLine(
        d.line,
        line.nodes.map((n, i) => (i === d.i ? { ...n, ...l, at: attach?.at ?? null } : n)),
      );
    }

    if (d.type === 'handle' || d.type === 'pull') {
      const line = ls.find((l) => l.id === d.line);
      if (!line) return;
      const pt = ptsOf(line)[d.i];
      let v = { x: p.x - pt.x, y: p.y - pt.y };
      if (e.shiftKey) {
        const q = constrain(p, pt);
        v = { x: q.x - pt.x, y: q.y - pt.y };
      }
      if (d.type === 'pull' && Math.hypot(v.x, v.y) < thr(3)) return;
      const nodes = line.nodes.map((n, i) => {
        if (i !== d.i) return n;
        if (d.type === 'pull') return { ...n, ox: round(v.x), oy: round(v.y), ix: round(-v.x), iy: round(-v.y), smooth: true };
        const mine = d.side === 'o' ? { ox: round(v.x), oy: round(v.y) } : { ix: round(v.x), iy: round(v.y) };
        if (!n.smooth || e.altKey) return { ...n, ...mine, smooth: e.altKey ? false : n.smooth };
        // Smooth: the other handle turns to stay in line, keeping its length.
        const other = d.side === 'o' ? Math.hypot(n.ix, n.iy) : Math.hypot(n.ox, n.oy);
        const len = Math.hypot(v.x, v.y) || 1;
        const o = { x: round((-v.x / len) * other), y: round((-v.y / len) * other) };
        return { ...n, ...mine, ...(d.side === 'o' ? { ix: o.x, iy: o.y } : { ox: o.x, oy: o.y }) };
      });
      setLine(d.line, nodes);
    }

    if (d.type === 'line') {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) < thr(3)) return;
      d.moved = true;
      setLine(
        d.line,
        d.nodes.map((n) => (n.at ? n : { ...n, x: round(n.x + dx), y: round(n.y + dy) })),
      );
    }

    if (d.type === 'marquee') {
      setMarquee({ a: d.start, b: p });
      const x0 = Math.min(d.start.x, p.x);
      const x1 = Math.max(d.start.x, p.x);
      const y0 = Math.min(d.start.y, p.y);
      const y1 = Math.max(d.start.y, p.y);
      const hit = c.pieces.filter((piece) => {
        const b = boxes.get(piece.id);
        return b && visible(piece) && b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0;
      });
      const ids = [...new Set([...d.add, ...hit.map((h) => h.id)])];
      setSel(ids.length ? { kind: 'pieces', ids } : null);
    }

    if (d.type === 'hold') setDraft(withStory(c, d.id, { hold: round(Math.max(0, Math.min(4, d.hold + (p.y - d.start.y) / spec.screen)) * 20) / 20 }));

    if (d.type === 'story-end') {
      const h = round(Math.max(10, d.height + p.y - d.start.y));
      if (board === 'desk') setDraft(withStory(c, d.id, { height: h }));
      else setDraft(withPhone(c, d.id, (ph) => ({ ...ph, height: h })));
    }

    if (d.type === 'fade') setDraft(withStory(c, d.id, { fade: round(Math.max(0, Math.min(2, d.fade - (p.y - d.start.y) / spec.screen))) }));
  };

  const onDragEnd = (e: PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setGuides({ x: [], y: [] });
    setMarquee(null);
    if (!d) return;
    if (d.type !== 'pull' || !d.pen) setSnapPiece(null);
    if (d.type === 'marquee') return;
    if ((d.type === 'pieces' || d.type === 'line' || d.type === 'node') && !d.moved) {
      // A click on one of several selected pieces, without moving: select only it.
      if (d.type === 'pieces' && !e.shiftKey && Object.keys(d.from).length > 1) {
        const t = (e.target as Element).closest<HTMLElement>('[data-h="piece"]');
        if (t?.dataset.id) setSel({ kind: 'pieces', ids: [t.dataset.id] });
      }
      return;
    }
    if (d.type === 'pull' && d.pen) return; // saved when the line is finished
    commit(draftRef.current, d.base);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'pen') {
      // The double click added a point on top of the last one: drop it and finish.
      const line = pen ? lines.find((l) => l.id === pen) : undefined;
      if (line && line.nodes.length > 2) {
        const [a, b] = line.nodes.slice(-2);
        if (Math.hypot(a.x - b.x, a.y - b.y) < thr(6)) {
          const next = withLines(
            draft,
            board,
            lines.map((l) => (l.id === pen ? { ...l, nodes: l.nodes.slice(0, -1) } : l)),
          );
          setDraft(next);
          draftRef.current = next;
        }
      }
      finishPen();
      return;
    }
    const target = (e.target as Element).closest<HTMLElement | SVGElement>('[data-h]');
    const h = target?.dataset.h;
    if (h === 'piece') setEditing(target!.dataset.id!);
    if (h === 'node') {
      const line = lines.find((l) => l.id === target!.dataset.line);
      const i = Number(target!.dataset.i);
      if (!line) return;
      const pts = ptsOf(line);
      const n = line.nodes[i];
      let patch: Partial<PathNode>;
      if (n.ox || n.oy || n.ix || n.iy) patch = { ox: 0, oy: 0, ix: 0, iy: 0, smooth: false };
      else {
        // Corner → smooth: handles along the line through its neighbours.
        const a = pts[i - 1] ?? pts[i];
        const b = pts[i + 1] ?? pts[i];
        const v = { x: (b.x - a.x) / 4, y: (b.y - a.y) / 4 };
        patch = { ox: round(v.x), oy: round(v.y), ix: round(-v.x), iy: round(-v.y), smooth: true };
      }
      updateLine(line.id, { nodes: line.nodes.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
    }
    if (h === 'line') {
      const line = lines.find((l) => l.id === target!.dataset.id);
      if (!line) return;
      const p = toU(e);
      const pts = ptsOf(line);
      let best = { seg: 1, t: 0.5, dist: Infinity };
      for (let s = 1; s < line.nodes.length; s++) {
        for (let j = 1; j < 40; j++) {
          const q = pointOnSegment(line.nodes[s - 1], pts[s - 1], line.nodes[s], pts[s], j / 40);
          const dist = Math.hypot(q.x - p.x, q.y - p.y);
          if (dist < best.dist) best = { seg: s, t: j / 40, dist };
        }
      }
      const s = best.seg;
      const split = splitSegment(line.nodes[s - 1], pts[s - 1], line.nodes[s], pts[s], best.t);
      const mid = { ...split.mid, ...local(line, split.mid) };
      updateLine(line.id, { nodes: [...line.nodes.slice(0, s - 1), split.a, mid, split.b, ...line.nodes.slice(s + 1)] });
      setSel({ kind: 'line', id: line.id, node: s });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool !== 'pen' || dragRef.current) return;
    const p = toU(e);
    const attach = findAttach(p, e.metaKey || e.ctrlKey);
    setSnapPiece(attach?.at.piece ?? null);
    const current = pen ? lines.find((l) => l.id === pen) : undefined;
    if (current && e.shiftKey) {
      const pts = ptsOf(current);
      setHover(constrain(p, pts[pts.length - 1]));
    } else setHover(p);
  };

  /* ---- Rendering ---- */

  const boardPx = boardHeight * k;
  const boardStyle = { width: W, height: boardPx, transform: `scale(${z})`, '--screen': `${spec.screen * k}px`, '--z': z } as CSSProperties;
  const strokeFor = (l: CompLine) => ({ strokeWidth: l.weight, strokeDasharray: l.dash ? '3 7' : undefined });
  const photos = storyPhotos(draft.stories);

  const renderLines = () => {
    const out: ReactNode[] = [];
    // Phone stories that flow get their lines drawn automatically.
    if (board === 'phone') {
      for (const s of draft.stories) {
        if (s.phone) continue;
        for (const { line, from, to } of flowLinks(draft, s.id)) {
          const a = boxes.get(from);
          const b = boxes.get(to);
          if (!a || !b) continue;
          const px = (bx: MBox) => ({ x: bx.x * k, y: bx.y * k, w: bx.w * k, h: bx.h * k });
          out.push(<path key={line.id} className="cmp-line auto" d={flowLinePath(px(a), px(b), b.lh * k)} style={strokeFor(line)} />);
        }
      }
    }
    for (const line of lines) {
      const pts = ptsOf(line);
      const d = pathData(line.nodes, pts, k);
      const last = pts[pts.length - 1];
      out.push(
        <g key={line.id} className={selLine?.id === line.id ? 'cmp-line-sel' : undefined}>
          <path className="cmp-line" d={d} style={strokeFor(line)} />
          {(line.dots === 'start' || line.dots === 'both') && pts[0] && (
            <circle className="cmp-dot" cx={pts[0].x * k} cy={pts[0].y * k} r={line.weight + 1.6} />
          )}
          {(line.dots === 'end' || line.dots === 'both') && pts.length > 1 && (
            <circle className="cmp-dot" cx={last.x * k} cy={last.y * k} r={line.weight + 1.6} />
          )}
          <path className="cmp-hit" d={d} data-h="line" data-id={line.id} style={{ strokeWidth: 14 / z }} />
        </g>,
      );
    }
    return out;
  };

  const renderHandles = () => {
    if (!selLine) return null;
    const pts = ptsOf(selLine);
    const s = 1 / z;
    return selLine.nodes.map((n, i) => {
      const p = { x: pts[i].x * k, y: pts[i].y * k };
      const active = sel?.kind === 'line' && sel.node === i;
      const handles = (['i', 'o'] as const).flatMap((side) => {
        const hx = side === 'o' ? n.ox : n.ix;
        const hy = side === 'o' ? n.oy : n.iy;
        if ((!hx && !hy) || (side === 'i' && i === 0) || (side === 'o' && i === selLine.nodes.length - 1)) return [];
        const q = { x: p.x + hx * k, y: p.y + hy * k };
        return [
          <g key={side}>
            <line className="cmp-stem" x1={p.x} y1={p.y} x2={q.x} y2={q.y} style={{ strokeWidth: s }} />
            <circle
              className="cmp-handle"
              cx={q.x}
              cy={q.y}
              r={4.5 * s}
              style={{ strokeWidth: s }}
              data-h="handle"
              data-line={selLine.id}
              data-i={i}
              data-side={side}
            />
          </g>,
        ];
      });
      return (
        <g key={i}>
          {handles}
          <rect
            className={`cmp-node${active ? ' active' : ''}${n.at ? ' pinned' : ''}`}
            x={p.x - 5 * s}
            y={p.y - 5 * s}
            width={10 * s}
            height={10 * s}
            rx={n.smooth ? 5 * s : 1.5 * s}
            style={{ strokeWidth: 1.4 * s }}
            data-h="node"
            data-line={selLine.id}
            data-i={i}
          />
        </g>
      );
    });
  };

  const penLine = pen ? lines.find((l) => l.id === pen) : undefined;
  const penPreview = () => {
    if (!penLine || !hover || dragRef.current) return null;
    const pts = ptsOf(penLine);
    const last = pts[pts.length - 1];
    const n = penLine.nodes[penLine.nodes.length - 1];
    return (
      <path
        className="cmp-pen-preview"
        d={`M${last.x * k} ${last.y * k} C${(last.x + n.ox) * k} ${(last.y + n.oy) * k} ${hover.x * k} ${hover.y * k} ${hover.x * k} ${hover.y * k}`}
        style={{ strokeWidth: 1 / z }}
      />
    );
  };

  /** Story edges across the board, each with a handle to change the story's height. */
  const renderStoryEdges = () =>
    draft.stories.map((s) => {
      const end = (topOf(s.id) + contentOn(s)) * k;
      const bottom = (topOf(s.id) + heightOn(s)) * k;
      const fixed = flows(board, s);
      const screens = round(contentOn(s) / spec.screen);
      const sel_ = selStory?.id === s.id;
      return (
        <g key={s.id} className={`cmp-edge${sel_ ? ' sel' : ''}`}>
          {s.hold > 0 && (
            <g className="cmp-hold">
              <rect x={0} y={end} width={W} height={bottom - end} />
              <g transform={`translate(${W / 2} ${(end + bottom) / 2}) scale(${1 / z})`}>
                <text x={0} y={4} textAnchor="middle">
                  Holds for {s.hold} {s.hold === 1 ? 'screen' : 'screens'} while it plays
                </text>
              </g>
              <g transform={`translate(${W / 2} ${bottom}) scale(${1 / z})`} data-h="hold" data-id={s.id} className="cmp-edge-pill">
                <rect x={-34} y={-10} width={68} height={20} rx={10} />
                <text x={0} y={4} textAnchor="middle">
                  ⇕ Hold
                </text>
              </g>
            </g>
          )}
          {board === 'desk' &&
            s.hold > 0 &&
            s.beats.map((b, i) => (
              <g key={i} className="cmp-beat">
                <line x1={0} x2={W} y1={(topOf(s.id) + b) * k} y2={(topOf(s.id) + b) * k} style={{ strokeWidth: 1 / z }} />
                <g transform={`translate(${12 / z} ${(topOf(s.id) + b) * k}) scale(${1 / z})`}>
                  <text x={0} y={-6}>
                    Beat {i + 1}
                  </text>
                </g>
              </g>
            ))}
          <line x1={0} x2={W} y1={bottom} y2={bottom} style={{ strokeWidth: 1 / z }} />
          {s.hold > 0 && <line className="cmp-edge-content" x1={0} x2={W} y1={end} y2={end} style={{ strokeWidth: 1 / z }} />}
          {!fixed && (
            <g transform={`translate(${W / 2} ${end}) scale(${1 / z})`} data-h="story-end" data-id={s.id} className="cmp-edge-pill">
              <rect x={-70} y={-11} width={140} height={22} rx={11} />
              <text x={0} y={4} textAnchor="middle">
                ⇕ {s.name} · {screens} {screens === 1 ? 'screen' : 'screens'}
              </text>
            </g>
          )}
        </g>
      );
    });

  /** How many screens of hold a story needs for its sequence to finish while it's on screen. */
  const holdNeeded = (s: Story) => {
    // Lines running on into another story finish on the way there, so they don't count.
    const steps = (order.find((o) => o.story === s.id)?.steps ?? []).filter(
      (st) => st.kind === 'piece' || !st.to || draft.pieces.find((p) => p.id === st.to)?.story === s.id,
    );
    if (!steps.length) return 0;
    // A camera story shares its hold between its stops however long it is.
    if (board === 'desk' && cameraPlan(s.height, s.hold, s.beats, spec.screen)) return s.hold;
    const last = Math.max(...steps.map((st) => (st.start ?? st.natural) + st.span));
    const S = spec.screen;
    // It pins with its pieces in the middle of the screen (or the last of them in view), as on the live site.
    const top = topOf(s.id);
    const bs = piecesOf(draft, s.id).flatMap((p) => boxes.get(p.id) ?? []);
    const ct = bs.length ? Math.min(...bs.map((b) => b.y)) - top : 0;
    const cb = bs.length ? Math.max(...bs.map((b) => b.y + b.h)) - top : contentOn(s);
    const pinTop = cb - ct <= S * 0.9 ? S / 2 - (ct + cb) / 2 : S * 0.95 - cb;
    const pinStart = top + 0.74 * S - pinTop;
    return Math.ceil((Math.max(0, last - pinStart) / S) * 20) / 20;
  };

  /** Each story's reading sequence, as the live site plays it (in u, from the top of the canvas). */
  const order = useMemo(() => {
    const out: { story: string; steps: Step[] }[] = [];
    const dueOf = (id?: string) => {
      const b = id ? boxes.get(id) : undefined;
      return b ? b.y - PACE.lead * spec.screen + PACE.piece * PACE.tempo * spec.screen : undefined;
    };
    for (const s of draft.stories) {
      const steps: Step[] = [];
      // A camera story's screen stops and starts, so the reading line reaches each height later.
      const top = topOf(s.id);
      const plan = board === 'desk' ? cameraPlan(s.height, s.hold, s.beats, spec.screen) : null;
      const reach = (y: number) => (plan ? top + cameraRead(plan, y - top) : y);
      for (const p of piecesOf(draft, s.id)) {
        const b = boxes.get(p.id);
        if (b && visible(p))
          steps.push({
            id: p.id,
            kind: 'piece',
            natural: reach(b.y - PACE.lead * spec.screen) + p.wait * spec.screen,
            x: b.x,
            box: b,
            span: PACE.reveal * PACE.tempo * spec.screen * (p.style === 'hero' ? PACE.hero : 1),
            hero: p.style === 'hero',
          });
      }
      for (const l of lines.filter((x) => x.story === s.id)) {
        const pts = ptsOf(l);
        let span = 0;
        let prev = pts[0];
        for (let i = 1; i < l.nodes.length; i++)
          for (let j = 1; j <= 16; j++) {
            const q = pointOnSegment(l.nodes[i - 1], pts[i - 1], l.nodes[i], pts[i], j / 16);
            span += Math.abs(q.y - prev.y) + Math.abs(q.x - prev.x) * 0.5;
            prev = q;
          }
        const to = l.nodes[l.nodes.length - 1]?.at?.piece;
        const toBox = to ? boxes.get(to) : undefined;
        const inStory = to && draft.pieces.find((p) => p.id === to)?.story === s.id;
        steps.push({
          id: l.id,
          kind: 'line',
          natural: reach(pts[0].y),
          x: pts[0].x,
          span: Math.max(span * PACE.tempo, 0.1),
          from: l.nodes[0]?.at?.piece,
          to: l.nodes[l.nodes.length - 1]?.at?.piece,
          due: plan && inStory && toBox ? reach(toBox.y - PACE.lead * spec.screen) + PACE.piece * PACE.tempo * spec.screen : dueOf(to),
          cross: Boolean(to) && !inStory,
        });
      }
      // Phone stories that flow: their automatic lines join pinned text.
      if (flows(board, s))
        for (const { line, from, to } of flowLinks(draft, s.id)) {
          const a = boxes.get(from);
          if (a) steps.push({ id: line.id, kind: 'line', natural: a.y + a.h, x: a.x, span: PACE.piece * PACE.tempo * spec.screen, from, to });
        }
      out.push({ story: s.id, steps: sequence(steps, spec.screen) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, board, boxes, tops]);

  /** Numbered badges: the order things arrive in, story by story. */
  const renderOrder = () => {
    const s = 1 / z;
    return order.flatMap(({ steps }) =>
      steps.map((step, i) => {
        let p: Pt | undefined;
        if (step.kind === 'piece') {
          const b = boxes.get(step.id);
          if (b) p = { x: b.x, y: b.y };
        } else {
          const l = lines.find((x) => x.id === step.id);
          if (l) p = ptsOf(l)[0];
          else {
            const a = step.from ? boxes.get(step.from) : undefined;
            if (a) p = { x: a.x, y: a.y + a.h };
          }
        }
        if (!p) return null;
        return (
          <g key={step.id} transform={`translate(${p.x * k} ${p.y * k}) scale(${s})`} className={`cmp-order ${step.kind}`}>
            <circle cx={step.kind === 'piece' ? -14 : 0} cy={step.kind === 'piece' ? -2 : 0} r={9} />
            <text x={step.kind === 'piece' ? -14 : 0} y={step.kind === 'piece' ? 1.5 : 3.5} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        );
      }),
    );
  };

  const singleSel = selectedIds.length === 1 ? draft.pieces.find((p) => p.id === selectedIds[0]) : undefined;

  const content = (
    <div
      className="cmp"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <link rel="stylesheet" href="/compose.css" />
      <header className="cmp-bar">
        <div className="cmp-bar-group">
          <button className="cmp-btn primary" onClick={onClose}>
            Done
          </button>
          <span className="cmp-title">Composer</span>
        </div>
        <div className="cmp-bar-group">
          <Seg
            value={board}
            onChange={setBoard}
            options={[
              { value: 'desk', label: 'Desktop' },
              { value: 'phone', label: 'Phone' },
            ]}
          />
          <span className="cmp-sep" />
          <Seg
            value={tool}
            onChange={setTool}
            options={[
              { value: 'select', label: <IconSelect />, title: 'Select and move (V)' },
              { value: 'text', label: <IconText />, title: 'Add text (T)' },
              { value: 'pen', label: <IconPen />, title: 'Draw a line (P)' },
            ]}
          />
          <span className="cmp-sep" />
          <button className="cmp-btn icon" title="Undo (⌘Z)" disabled={!history.current.past.length} onClick={undo}>
            <IconUndo />
          </button>
          <button className="cmp-btn icon" title="Redo (⇧⌘Z)" disabled={!history.current.future.length} onClick={redo}>
            <IconUndo flip />
          </button>
        </div>
        <div className="cmp-bar-group">
          <Check label="Grid" checked={show.grid} onChange={(grid) => setShow({ ...show, grid })} />
          <Check label="Screens" checked={show.screens} onChange={(screens) => setShow({ ...show, screens })} />
          <Check label="Photos" checked={show.photos} onChange={(photos) => setShow({ ...show, photos })} />
          <Check label="Order" checked={show.order} onChange={(order) => setShow({ ...show, order })} />
          <span className="cmp-sep" />
          <button className="cmp-btn icon" title="Zoom out (⌘−)" onClick={() => setZoom([...ZOOMS].reverse().find((v) => v < z - 0.01) ?? z)}>
            −
          </button>
          <button className="cmp-btn zoom" title="Fit (⌘0)" onClick={() => setZoom('fit')}>
            {Math.round(z * 100)}%
          </button>
          <button className="cmp-btn icon" title="Zoom in (⌘+)" onClick={() => setZoom(ZOOMS.find((v) => v > z + 0.01) ?? z)}>
            +
          </button>
          <span className="cmp-sep" />
          <button className="cmp-btn" onClick={() => setPreview({ kind: board, from: null })}>
            Preview
          </button>
        </div>
      </header>

      <div className="cmp-body">
        <aside className="cmp-side">
          <StoryTree
            draft={draft}
            board={board}
            sel={sel}
            collapsed={collapsed}
            photos={photos}
            onToggle={(id) =>
              setCollapsed((c) => {
                const n = new Set(c);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onSelectStory={(id) => {
              setSel({ kind: 'story', id });
              scrollToStory(id);
            }}
            onSelectPiece={(id, add) =>
              setSel({ kind: 'pieces', ids: add ? (selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]) : [id] })
            }
            onSelectLine={(id) => setSel({ kind: 'line', id, node: null })}
            onMove={moveStory}
            onAdd={() => addStory(selStory?.id)}
          />
        </aside>

        <div className={`cmp-stage tool-${tool}`} ref={stageRef}>
          <div className="cmp-paper" style={{ width: W * z + PAD_L + PAD_R, height: boardPx * z + PAD_Y * 2 + 60 }}>
            <Gutter
              draft={draft}
              tops={tops}
              heightOf={(s) => heightOn(s)}
              board={board}
              z={z}
              k={k}
              screens={show.screens}
              selected={selStory?.id}
              onPointerDown={onPointerDown}
            />
            <div className="cmp-board-wrap" style={{ left: PAD_L, top: PAD_Y, width: W * z, height: boardPx * z }}>
              <div
                ref={boardRef}
                className="cmp-board site-root tone-dark"
                style={boardStyle}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerLeave={() => tool === 'pen' && setHover(null)}
                onDoubleClick={onDoubleClick}
              >
                <Bands draft={draft} tops={tops} k={k} screen={spec.screen} dim={!show.photos} />
                {show.screens && <Screens draft={draft} tops={tops} heightOf={(s) => heightOn(s)} screen={spec.screen} k={k} />}
                {show.grid && <Grid board={board} k={k} />}

                <svg className="cmp-lines" width={W} height={boardPx}>
                  {renderLines()}
                </svg>

                <div ref={compRef} className="wf-comp">
                  {draft.stories.map((s) => {
                    const flowing = flows(board, s);
                    const pieces = readingOrder(piecesOf(draft, s.id));
                    const flow = flowPlacement(pieces);
                    return (
                      <div
                        key={s.id}
                        className={`wf-story ${flowing ? 'phone-flow' : 'has-phone'}${selStory?.id === s.id ? ' cmp-story-sel' : ''}${s.tone === 'light' ? ' tone-light' : ''}`}
                        style={
                          {
                            '--h': s.height,
                            '--mh': s.phone?.height ?? 0,
                            paddingBottom: s.hold * spec.screen * k,
                          } as CSSProperties
                        }
                        data-story={s.id}
                      >
                        <div className="wf-story-pin">
                          {pieces.map((piece) => {
                            const f = frameOf(draft, board, piece);
                            const isSel = selectedIds.includes(piece.id);
                            const style = { ...pieceVars(piece, s, flow), '--mx': f.x, '--my': f.y, '--mw': f.w } as CSSProperties;
                            return (
                              <div
                                key={piece.id}
                                className={`${pieceClass(piece)} cmp-piece${isSel ? ' sel' : ''}${snapPiece === piece.id ? ' snap' : ''}${visible(piece) ? '' : ' offboard'}${flowing ? ' fixed' : ''}`}
                                style={style}
                                data-piece={piece.id}
                                data-h="piece"
                                data-id={piece.id}
                              >
                                {editing === piece.id ? (
                                  <EditText
                                    piece={piece}
                                    onDone={(text) => {
                                      setEditing(null);
                                      if (!text.trim()) deletePieces([piece.id]);
                                      else if (text !== piece.text) updatePieces([piece.id], { text });
                                    }}
                                  />
                                ) : (
                                  <PieceText piece={piece} />
                                )}
                                {isSel && selectedIds.length === 1 && !flowing && editing !== piece.id && (
                                  <>
                                    <span className="cmp-resize l" data-h="resize-l" data-id={piece.id} />
                                    <span className="cmp-resize r" data-h="resize-r" data-id={piece.id} />
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <svg className="cmp-overlay" width={W} height={boardPx}>
                  {renderStoryEdges()}
                  {guides.x.map((x, i) => (
                    <line key={`x${i}`} className="cmp-guide" x1={x * k} x2={x * k} y1={0} y2={boardPx} style={{ strokeWidth: 1 / z }} />
                  ))}
                  {guides.y.map((y, i) => (
                    <line key={`y${i}`} className="cmp-guide" y1={y * k} y2={y * k} x1={0} x2={W} style={{ strokeWidth: 1 / z }} />
                  ))}
                  {penPreview()}
                  {show.order && renderOrder()}
                  {renderHandles()}
                  {marquee && (
                    <rect
                      className="cmp-marquee"
                      x={Math.min(marquee.a.x, marquee.b.x) * k}
                      y={Math.min(marquee.a.y, marquee.b.y) * k}
                      width={Math.abs(marquee.a.x - marquee.b.x) * k}
                      height={Math.abs(marquee.a.y - marquee.b.y) * k}
                      style={{ strokeWidth: 1 / z }}
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>

        <aside className="cmp-props">
          {singleSel && (
            <PieceProps
              piece={singleSel}
              frame={frameOf(draft, board, singleSel)}
              fixed={!movable(singleSel)}
              onChange={(patch) => updatePieces([singleSel.id], patch)}
              onFrame={(frame) => commit(withPlacements(draft, board, { [singleSel.id]: { story: singleSel.story, frame } }))}
              onDuplicate={() => {
                const { next, ids } = duplicatePieces([singleSel.id]);
                commit(next);
                setSel({ kind: 'pieces', ids });
              }}
              onDelete={() => deletePieces([singleSel.id])}
            />
          )}
          {selectedIds.length > 1 && (
            <MultiProps
              count={selectedIds.length}
              onStyle={(style) => updatePieces(selectedIds, { style })}
              onAlign={(edge) => {
                const fs = selectedIds.flatMap((id) => {
                  const piece = draft.pieces.find((p) => p.id === id)!;
                  return movable(piece) ? [{ id, story: piece.story, f: frameOf(draft, board, piece), b: boxes.get(id), top: topOf(piece.story) }] : [];
                });
                if (!fs.length) return;
                const moves: Record<string, { story: string; frame: Frame }> = {};
                if (edge === 'left') {
                  const x = Math.min(...fs.map((q) => q.f.x));
                  fs.forEach((q) => (moves[q.id] = { story: q.story, frame: { ...q.f, x } }));
                } else if (edge === 'top') {
                  const y = Math.min(...fs.map((q) => q.top + q.f.y));
                  fs.forEach((q) => (moves[q.id] = { story: q.story, frame: { ...q.f, y: round(y - q.top) } }));
                } else {
                  // Even vertical spacing between the first and last.
                  const sorted = [...fs].sort((a, b) => a.top + a.f.y - (b.top + b.f.y));
                  const first = sorted[0];
                  const last = sorted[sorted.length - 1];
                  const total = sorted.reduce((s, q) => s + (q.b?.h ?? 0), 0);
                  const gap = (last.top + last.f.y + (last.b?.h ?? 0) - (first.top + first.f.y) - total) / Math.max(1, sorted.length - 1);
                  let y = first.top + first.f.y;
                  sorted.forEach((q) => {
                    moves[q.id] = { story: q.story, frame: { ...q.f, y: round(y - q.top) } };
                    y += (q.b?.h ?? 0) + gap;
                  });
                }
                commit(withPlacements(draft, board, moves));
              }}
              onDelete={() => deletePieces(selectedIds)}
            />
          )}
          {selLine && (
            <LineProps
              line={selLine}
              nodeIndex={sel?.kind === 'line' ? sel.node : null}
              pieces={draft.pieces}
              onChange={(patch) => updateLine(selLine.id, patch)}
              onDelete={() => {
                commit(
                  withLines(
                    draft,
                    board,
                    lines.filter((l) => l.id !== selLine.id),
                  ),
                );
                setSel(null);
              }}
            />
          )}
          {selStory && (
            <StoryProps
              story={selStory}
              board={board}
              index={draft.stories.indexOf(selStory)}
              count={draft.stories.length}
              inherited={photos[draft.stories.indexOf(selStory) - 1] ?? null}
              onChange={(patch) => commit(withStory(draft, selStory.id, patch))}
              onPhoneHeight={(height) => commit(withPhone(draft, selStory.id, (ph) => ({ ...ph, height })))}
              onCustomise={() => customisePhone(selStory.id)}
              onResetPhone={() => commit(withStory(draft, selStory.id, { phone: null }))}
              onMove={(to) => moveStory(selStory.id, to)}
              onDuplicate={() => duplicateStory(selStory.id)}
              onDelete={() => deleteStory(selStory.id)}
              onPreview={() => setPreview({ kind: board, from: selStory.id })}
              needed={holdNeeded(selStory)}
            />
          )}
          {!sel && <CanvasProps frameOut={draft.frameOut} onFrameOut={(frameOut) => commit({ ...draft, frameOut })} onAddStory={() => addStory()} />}
        </aside>
      </div>

      {preview && (
        <Preview
          draft={draft}
          block={block}
          media={media}
          kind={preview.kind}
          from={preview.from}
          onKind={(kind) => setPreview({ ...preview, kind })}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

/* --------------------------------------------------------------------------
   Board layers
   -------------------------------------------------------------------------- */

/** Each story's photograph, from where it starts fading in down to the end of the canvas. */
function Bands({ draft, tops, k, screen, dim }: { draft: Draft; tops: ReadonlyMap<string, number>; k: number; screen: number; dim: boolean }) {
  let first = true;
  return (
    <div className={`cmp-bands${dim ? ' dim' : ''}`}>
      {draft.stories.map((s) => {
        if (!s.image && s.tone !== 'light') return null;
        const top = tops.get(s.id) ?? 0;
        const fade = first ? 0 : s.fade * screen;
        const start = first ? 0 : Math.max(0, top - fade);
        first = false;
        const fadePx = Math.max(1, (top - start) * k);
        const mask = `linear-gradient(transparent, #000 ${fadePx}px)`;
        return (
          <div key={s.id} className={`cmp-band${s.tone === 'light' ? ' paper' : ''}`} style={{ top: start * k, WebkitMaskImage: mask, maskImage: mask }}>
            {s.tone === 'light' ? null : (
              <>
                <Picture pic={s.image!} className="cmp-band-img" sizes="1440px" />
                <div className="wf-layer-shade" style={{ '--shade': s.shade } as CSSProperties} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Screens({
  draft,
  tops,
  heightOf,
  screen,
  k,
}: {
  draft: Draft;
  tops: ReadonlyMap<string, number>;
  heightOf: (s: Story) => number;
  screen: number;
  k: number;
}) {
  const marks: ReactNode[] = [];
  for (const s of draft.stories) {
    const top = tops.get(s.id) ?? 0;
    for (let n = 1; n * screen < heightOf(s) - 2; n++) marks.push(<div key={`${s.id}${n}`} className="cmp-screen" style={{ top: (top + n * screen) * k }} />);
  }
  return <div className="cmp-screens">{marks}</div>;
}

function Grid({ board, k }: { board: BoardKind; k: number }) {
  return (
    <div className="cmp-grid">
      {columnEdges(board).map((c, i) => (
        <div key={i} style={{ left: c.start * k, width: (c.end - c.start) * k }} />
      ))}
    </div>
  );
}

/** Beside the board: each story's name and photo, and how long its photo takes to fade in. */
function Gutter({
  draft,
  tops,
  heightOf,
  board,
  z,
  k,
  screens,
  selected,
  onPointerDown,
}: {
  draft: Draft;
  tops: ReadonlyMap<string, number>;
  heightOf: (s: Story) => number;
  board: BoardKind;
  z: number;
  k: number;
  screens: boolean;
  selected?: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const spec = BOARD[board];
  const y = (u: number) => PAD_Y + u * k * z;
  return (
    <div className="cmp-gutter" onPointerDown={onPointerDown}>
      {draft.stories.map((s, i) => {
        const top = tops.get(s.id) ?? 0;
        const ticks: ReactNode[] = [];
        if (screens)
          for (let n = 1; n * spec.screen < heightOf(s) - 2; n++) ticks.push(<span key={n} className="cmp-tick" style={{ top: y(top + n * spec.screen) }} />);
        return (
          <div key={s.id} className={`cmp-story-mark${selected === s.id ? ' sel' : ''}`}>
            {s.image && i > 0 && (
              <span
                className="cmp-fade"
                style={{ top: y(top - s.fade * spec.screen), height: s.fade * spec.screen * k * z }}
                data-h="fade"
                data-id={s.id}
                title="Drag to change how long the photo takes to fade in"
              />
            )}
            <button className="cmp-story-label" style={{ top: y(top) }} data-h="story-label" data-id={s.id}>
              {s.image ? <Picture pic={s.image} className="cmp-story-thumb" sizes="40px" /> : <span className="cmp-story-thumb none" />}
              <span>{s.name}</span>
            </button>
            {ticks}
          </div>
        );
      })}
    </div>
  );
}

/** In-place text editing. */
function EditText({ piece, onDone }: { piece: Piece; onDone: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.setAttribute('contenteditable', 'plaintext-only');
    el.innerText = piece.text;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      className="wf-piece-text cmp-editing"
      onBlur={() => onDone(ref.current!.innerText.replace(/\n{3,}/g, '\n\n').replace(/\n$/, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          ref.current!.blur();
        }
      }}
    />
  );
}

/* --------------------------------------------------------------------------
   Side panels
   -------------------------------------------------------------------------- */

function lineLabel(line: CompLine, pieces: Piece[]) {
  const name = (id?: string) =>
    pieces
      .find((p) => p.id === id)
      ?.text.split('\n')[0]
      .slice(0, 16);
  const a = name(line.nodes[0]?.at?.piece);
  const b = name(line.nodes[line.nodes.length - 1]?.at?.piece);
  if (a && b) return `${a} → ${b}`;
  if (a) return `From ${a}`;
  if (b) return `To ${b}`;
  return 'Line';
}

/** Stories, each with its text and lines; drag a story to reorder. */
function StoryTree({
  draft,
  board,
  sel,
  collapsed,
  photos,
  onToggle,
  onSelectStory,
  onSelectPiece,
  onSelectLine,
  onMove,
  onAdd,
}: {
  draft: Draft;
  board: BoardKind;
  sel: Sel;
  collapsed: Set<string>;
  photos: (Pic | null)[];
  onToggle: (id: string) => void;
  onSelectStory: (id: string) => void;
  onSelectPiece: (id: string, add: boolean) => void;
  onSelectLine: (id: string) => void;
  onMove: (id: string, to: number) => void;
  onAdd: () => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <section className="cmp-tree">
      <header>
        <span>Stories</span>
        <button className="cmp-add" title="Add a story" onClick={onAdd}>
          +
        </button>
      </header>
      <ol>
        {draft.stories.map((s, i) => {
          const open = !collapsed.has(s.id);
          const pieces = readingOrder(piecesOf(draft, s.id));
          const storyLines = board === 'desk' ? draft.lines.filter((l) => l.story === s.id) : (s.phone?.lines ?? []);
          const photo = photos[i];
          return (
            <li
              key={s.id}
              className={`${dragging === s.id ? 'dragging' : ''}${over === i ? ' over' : ''}`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) onMove(dragging, i);
                setDragging(null);
                setOver(null);
              }}
            >
              <div
                className={`cmp-tree-story${sel?.kind === 'story' && sel.id === s.id ? ' active' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setDragging(s.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
              >
                <button className={`cmp-chevron${open ? ' open' : ''}`} onClick={() => onToggle(s.id)} aria-label={open ? 'Collapse' : 'Expand'}>
                  ›
                </button>
                <button className="cmp-tree-name" onClick={() => onSelectStory(s.id)}>
                  {photo ? (
                    <Picture pic={photo} className={`cmp-layer-thumb${s.image ? '' : ' carried'}`} sizes="40px" />
                  ) : (
                    <span className="cmp-layer-thumb none" />
                  )}
                  <span className="cmp-layer-label">{s.name}</span>
                </button>
              </div>
              {open && (
                <ul>
                  {pieces.map((p) => (
                    <li key={p.id}>
                      <button
                        className={sel?.kind === 'pieces' && sel.ids.includes(p.id) ? 'active' : undefined}
                        onClick={(e) => onSelectPiece(p.id, e.shiftKey)}
                      >
                        <span className="cmp-kind">T</span>
                        <span className="cmp-layer-label">{p.text.split('\n')[0] || 'Empty'}</span>
                      </button>
                    </li>
                  ))}
                  {storyLines.map((l) => (
                    <li key={l.id}>
                      <button className={sel?.kind === 'line' && sel.id === l.id ? 'active' : undefined} onClick={() => onSelectLine(l.id)}>
                        <span className="cmp-kind">⌇</span>
                        <span className="cmp-layer-label">{lineLabel(l, draft.pieces)}</span>
                      </button>
                    </li>
                  ))}
                  {pieces.length === 0 && storyLines.length === 0 && <li className="cmp-empty">Empty — add text with T</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cmp-panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="cmp-num">
      <span>{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (Number.isFinite(n)) onChange(round(n));
          else setText(String(value));
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function PieceProps({
  piece,
  frame,
  fixed,
  onChange,
  onFrame,
  onDuplicate,
  onDelete,
}: {
  piece: Piece;
  frame: Frame;
  fixed: boolean;
  onChange: (patch: Partial<Piece>) => void;
  onFrame: (frame: Frame) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Panel title={piece.image ? 'Picture' : 'Text'}>
      <Row label="Kind">
        <Segmented
          value={piece.image ? 'picture' : 'text'}
          onChange={(kind) => onChange({ image: kind === 'picture' ? (piece.image ?? { src: '', alt: '' }) : null })}
          options={[
            { value: 'text' as const, label: 'Text' },
            { value: 'picture' as const, label: 'Picture' },
          ]}
        />
      </Row>
      {piece.image ? (
        <>
          <PicField pic={piece.image} onChange={(image) => onChange({ image })} />
          <Row label="Shape">
            <Slider
              value={piece.ratio}
              min={0.3}
              max={1.6}
              step={0.025}
              onChange={(ratio) => onChange({ ratio })}
              format={(v) => (v < 0.95 ? 'Landscape' : v > 1.05 ? 'Portrait' : 'Square') + ` (${Math.round(100 / v) / 100}:1)`}
            />
          </Row>
        </>
      ) : (
        <Row label="Words">
          <GlassTextarea value={piece.text} rows={4} onChange={(text) => onChange({ text })} placeholder="Each line rises on its own" />
        </Row>
      )}
      <Row label="Brackets">
        <Toggle checked={piece.frame === 'brackets'} label="Brackets" onChange={(on) => onChange({ frame: on ? 'brackets' : 'none' })} />
      </Row>
      {!piece.image && (
        <>
          <Row label="Step lines">
            <Slider
              value={piece.step}
              min={-3}
              max={3}
              step={0.1}
              onChange={(step) => onChange({ step })}
              format={(v) => (v ? `${Math.abs(v)}em ${v > 0 ? 'in' : 'out'} each` : 'None')}
            />
          </Row>
        </>
      )}
      <Row label="Style">
        <Segmented value={piece.style} onChange={(style) => onChange({ style })} options={PIECE_STYLES} />
      </Row>
      <Row label="Align">
        <Segmented
          value={piece.align}
          onChange={(align) => onChange({ align })}
          options={[
            { value: 'left' as const, label: 'Left' },
            { value: 'center' as const, label: 'Centre' },
            { value: 'right' as const, label: 'Right' },
          ]}
        />
      </Row>
      <Row label="Italic">
        <Toggle checked={piece.italic} label="Italic" onChange={(italic) => onChange({ italic })} />
      </Row>
      <Row label="Quieter">
        <Toggle checked={piece.soft} label="Quieter colour" onChange={(soft) => onChange({ soft })} />
      </Row>
      {fixed ? (
        <p className="cmp-hint">This story flows on the phone; lay it out by hand (select the story) to place it.</p>
      ) : (
        <div className="cmp-nums">
          <Num label="X" value={frame.x} onChange={(x) => onFrame({ ...frame, x })} />
          <Num label="Y" value={frame.y} onChange={(y) => onFrame({ ...frame, y })} />
          <Num label="W" value={frame.w} onChange={(w) => onFrame({ ...frame, w: Math.max(3, w) })} />
        </div>
      )}
      <Row label="Arrives">
        <Slider
          value={piece.wait}
          min={-0.5}
          max={1}
          step={0.05}
          onChange={(wait) => onChange({ wait })}
          format={(v) => (v === 0 ? 'In order' : `${Math.abs(v)} screens ${v > 0 ? 'later' : 'sooner'}`)}
        />
      </Row>
      <Row label="Show on">
        <Segmented
          value={piece.show}
          onChange={(show) => onChange({ show })}
          options={[
            { value: 'both' as const, label: 'Both' },
            { value: 'desktop' as const, label: 'Desktop' },
            { value: 'phone' as const, label: 'Phone' },
          ]}
        />
      </Row>
      <Row label="Tag">
        <Segmented
          value={piece.tag}
          onChange={(tag) => onChange({ tag })}
          options={[
            { value: 'p' as const, label: 'Text' },
            { value: 'h1' as const, label: 'Title' },
            { value: 'h2' as const, label: 'Heading' },
          ]}
        />
      </Row>
      <div className="cmp-actions">
        <button className="wide-btn" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="wide-btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
      <p className="cmp-hint">
        Y is measured from the top of the story. Drag a piece into another story to move it there. Double-click to edit in place; Alt-drag copies; Shift keeps
        it straight; ⌘ turns snapping off.
      </p>
    </Panel>
  );
}

function MultiProps({
  count,
  onStyle,
  onAlign,
  onDelete,
}: {
  count: number;
  onStyle: (style: Piece['style']) => void;
  onAlign: (edge: 'left' | 'top' | 'space') => void;
  onDelete: () => void;
}) {
  return (
    <Panel title={`${count} pieces`}>
      <Row label="Style">
        <Segmented value={'' as Piece['style']} onChange={onStyle} options={PIECE_STYLES} />
      </Row>
      <div className="cmp-actions">
        <button className="wide-btn" onClick={() => onAlign('left')}>
          Align left edges
        </button>
        <button className="wide-btn" onClick={() => onAlign('top')}>
          Align tops
        </button>
        <button className="wide-btn" onClick={() => onAlign('space')}>
          Space evenly
        </button>
        <button className="wide-btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </Panel>
  );
}

function LineProps({
  line,
  nodeIndex,
  pieces,
  onChange,
  onDelete,
}: {
  line: CompLine;
  nodeIndex: number | null;
  pieces: Piece[];
  onChange: (patch: Partial<CompLine>) => void;
  onDelete: () => void;
}) {
  const n = nodeIndex !== null ? line.nodes[nodeIndex] : undefined;
  const setNode = (patch: Partial<PathNode>) => onChange({ nodes: line.nodes.map((m, i) => (i === nodeIndex ? { ...m, ...patch } : m)) });
  return (
    <Panel title="Line">
      <Row label="Dashed">
        <Toggle checked={line.dash} label="Dashed" onChange={(dash) => onChange({ dash })} />
      </Row>
      <Row label="Weight">
        <Segmented
          value={line.weight}
          onChange={(weight) => onChange({ weight })}
          options={[
            { value: 1 as const, label: 'Fine' },
            { value: 1.5 as const, label: 'Light' },
            { value: 2 as const, label: 'Bold' },
          ]}
        />
      </Row>
      <Row label="Dots">
        <Segmented
          value={line.dots}
          onChange={(dots) => onChange({ dots })}
          options={[
            { value: 'none' as const, label: 'None' },
            { value: 'start' as const, label: 'Start' },
            { value: 'end' as const, label: 'End' },
            { value: 'both' as const, label: 'Both' },
          ]}
        />
      </Row>
      <div className="cmp-actions">
        <button
          className="wide-btn"
          onClick={() => onChange({ nodes: [...line.nodes].reverse().map((m) => ({ ...m, ix: m.ox, iy: m.oy, ox: m.ix, oy: m.iy })) })}
        >
          Reverse direction
        </button>
        <button className="wide-btn danger" onClick={onDelete}>
          Delete line
        </button>
      </div>
      {n && (
        <div className="cmp-sub">
          <h4>Point {nodeIndex! + 1}</h4>
          <Row label="Curve">
            <Segmented
              value={n.smooth ? 'smooth' : 'corner'}
              onChange={(v) => setNode({ smooth: v === 'smooth' })}
              options={[
                { value: 'smooth', label: 'Smooth' },
                { value: 'corner', label: 'Corner' },
              ]}
            />
          </Row>
          {n.at && (
            <>
              <p className="cmp-hint">Pinned to “{pieces.find((p) => p.id === n.at!.piece)?.text.split('\n')[0]}”: it follows the text if it moves.</p>
              <button className="wide-btn" onClick={() => setNode({ at: null })}>
                Unpin
              </button>
            </>
          )}
          <button className="wide-btn" onClick={() => setNode({ ix: 0, iy: 0, ox: 0, oy: 0 })}>
            Straighten
          </button>
        </div>
      )}
      <p className="cmp-hint">
        Lines draw from their first point to their last as the reader scrolls, and may run on into the next story. A line follows on from the text it starts at;
        text it runs into waits for it. Double-click the line to add a point; double-click a point to round or sharpen it; Alt-drag a point to pull out new
        handles.
      </p>
    </Panel>
  );
}

function StoryProps({
  story,
  board,
  index,
  count,
  inherited,
  onChange,
  onPhoneHeight,
  onCustomise,
  onResetPhone,
  onMove,
  onDuplicate,
  onDelete,
  onPreview,
  needed,
}: {
  story: Story;
  board: BoardKind;
  index: number;
  count: number;
  inherited: Pic | null;
  onChange: (patch: Partial<Story>) => void;
  onPhoneHeight: (h: number) => void;
  onCustomise: () => void;
  onResetPhone: () => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreview: () => void;
  needed: number;
}) {
  const desk = BOARD.desk.screen;
  const phone = BOARD.phone.screen;
  return (
    <Panel title="Story">
      <Row label="Name">
        <GlassInput value={story.name} onChange={(name) => onChange({ name })} placeholder="What this story is about" />
      </Row>
      {board === 'desk' ? (
        <Row label="Height">
          <Slider
            value={round(story.height / desk)}
            min={0.25}
            max={6}
            step={0.05}
            onChange={(s) => onChange({ height: round(s * desk) })}
            format={(v) => `${v} screens`}
          />
        </Row>
      ) : (
        story.phone && (
          <Row label="Phone height">
            <Slider
              value={round(story.phone.height / phone)}
              min={0.25}
              max={8}
              step={0.05}
              onChange={(s) => onPhoneHeight(round(s * phone))}
              format={(v) => `${v} screens`}
            />
          </Row>
        )
      )}
      <div className="cmp-sub">
        <h4>Hold</h4>
        <Row label="Hold for">
          <Slider value={story.hold} min={0} max={4} step={0.05} onChange={(hold) => onChange({ hold })} format={(v) => (v ? `${v} screens` : 'No hold')} />
        </Row>
        <p className="cmp-hint">
          {needed <= story.hold
            ? needed === 0
              ? 'Its sequence plays through while it’s on screen.'
              : `Its sequence finishes while it’s held${story.hold - needed >= 0.3 ? ` (it only needs ${needed} screens)` : ''}.`
            : `Its sequence is still playing as it leaves the screen. Hold it for about ${needed} screens to let it finish.`}
        </p>
        {needed !== story.hold && needed > 0 && (
          <button className="wide-btn" onClick={() => onChange({ hold: needed })}>
            Hold for {needed} screens
          </button>
        )}
        <p className="cmp-hint">
          While held, the story stays still in the middle of the screen and its text and lines keep arriving as you scroll; then it moves on.
        </p>
      </div>
      {board === 'desk' && (
        <div className="cmp-sub">
          <h4>Camera</h4>
          {story.beats.map((beat, i) => (
            <Row key={i} label={`Beat ${i + 1}`}>
              <Slider
                value={round(beat / desk)}
                min={0.05}
                max={Math.max(0.1, round((story.height - desk) / desk))}
                step={0.05}
                onChange={(v) => onChange({ beats: story.beats.map((b, j) => (j === i ? round(v * desk) : b)) })}
                format={(v) => `${v} screens down`}
              />
              <button className="cmp-x" title="Remove beat" onClick={() => onChange({ beats: story.beats.filter((_, j) => j !== i) })}>
                ×
              </button>
            </Row>
          ))}
          <button
            className="wide-btn"
            onClick={() => {
              const last = story.beats.length ? Math.max(...story.beats) : 0;
              onChange({ beats: [...story.beats, round(Math.min(story.height - desk * 1.1, last + desk * 0.8))], hold: story.hold || 1 });
            }}
            disabled={story.height < desk * 1.3}
          >
            Add a beat
          </button>
          <p className="cmp-hint">
            {story.height < desk * 1.3
              ? 'For a story taller than the screen: make it at least 1.3 screens tall to add beats.'
              : story.beats.length
                ? 'The screen holds still at the top, at each beat and at the end, sharing the hold between them, then glides on. The dashed marks on the board show where each stop’s screen starts.'
                : 'Beats turn a tall held story into a camera: the screen stops at each beat while what’s there plays, then glides on to the next.'}
          </p>
        </div>
      )}
      <div className="cmp-sub">
        <h4>Background</h4>
        <Row label="Tone">
          <Segmented
            value={story.tone}
            onChange={(tone) => onChange({ tone })}
            options={[
              { value: 'dark' as const, label: 'Photo' },
              { value: 'light' as const, label: 'Paper' },
            ]}
          />
        </Row>
        {index > 0 && (
          <Row label="Arrives">
            <Segmented
              value={story.enter}
              onChange={(enter) => onChange({ enter })}
              options={[
                { value: 'fade' as const, label: 'Crossfade' },
                { value: 'settle' as const, label: 'Settle' },
              ]}
            />
          </Row>
        )}
        <p className="cmp-hint">
          {story.tone === 'light' ? 'A paper page with dark text.' : 'Its photo, or the one before it carried on.'}{' '}
          {story.enter === 'settle' ? 'Its photo eases from slightly zoomed in to rest as it fades in.' : ''}
        </p>
      </div>
      <div className="cmp-sub">
        <h4>Movement</h4>
        <Row label="Drift">
          <Slider value={story.drift} min={0} max={1} step={0.05} onChange={(drift) => onChange({ drift })} format={(v) => (v ? `${Math.round(v * 100)}%` : 'None')} />
        </Row>
        <p className="cmp-hint">Arrives early and lingers in the middle of the screen, then lifts away quickly.</p>
        <Row label="Hero">
          <Toggle checked={story.float} label="Hero" onChange={(float) => onChange({ float })} />
        </Row>
        <p className="cmp-hint">
          Not a reading sequence: when it arrives, every letter floats gently out from the middle into place at once, and its lines draw. For an opening.
        </p>
      </div>
      <div className="cmp-sub">
        <h4>Photograph</h4>
        <Row label="Own photo">
          <Toggle checked={Boolean(story.image)} label="Own photo" onChange={(on) => onChange({ image: on ? (inherited ?? { src: '', alt: '' }) : null })} />
        </Row>
        {story.image ? (
          <>
            <PicField pic={story.image} onChange={(image) => onChange({ image })} />
            <Row label="Shade">
              <Slider value={story.shade} min={0} max={0.9} step={0.05} onChange={(shade) => onChange({ shade })} format={(v) => `${Math.round(v * 100)}%`} />
            </Row>
            {index > 0 && (
              <Row label="Fade in">
                <Slider value={story.fade} min={0} max={2} step={0.05} onChange={(fade) => onChange({ fade })} format={(v) => `${v} screens`} />
              </Row>
            )}
            <Row label="Pull back">
              <Toggle checked={story.pull} label="Zooms in and dims as the story leaves" onChange={(pull) => onChange({ pull })} />
            </Row>
          </>
        ) : (
          <p className="cmp-hint">{index === 0 ? 'The first story needs a photo.' : 'Carries on the photo from the story before.'}</p>
        )}
      </div>
      <div className="cmp-sub">
        <h4>Phone</h4>
        {story.phone ? (
          <>
            <p className="cmp-hint">Laid out by hand on the phone.</p>
            <button className="wide-btn" onClick={onResetPhone}>
              Go back to the automatic layout
            </button>
          </>
        ) : (
          <>
            <p className="cmp-hint">Flows the desktop layout in reading order; lines between pinned text are drawn automatically.</p>
            {board === 'phone' ? (
              <button className="wide-btn" onClick={onCustomise}>
                Lay out by hand
              </button>
            ) : (
              <p className="cmp-hint">Switch to Phone to lay it out by hand.</p>
            )}
          </>
        )}
      </div>
      <div className="cmp-actions">
        <button className="wide-btn" onClick={onPreview}>
          Preview from here
        </button>
        <div className="cmp-pair">
          <button className="wide-btn" disabled={index === 0} onClick={() => onMove(index - 1)}>
            Move up
          </button>
          <button className="wide-btn" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            Move down
          </button>
        </div>
        <button className="wide-btn" onClick={onDuplicate}>
          Duplicate story
        </button>
        <button className="wide-btn danger" disabled={count < 2} onClick={onDelete}>
          Delete story
        </button>
      </div>
      <p className="cmp-hint">Drag the handle on the story’s bottom edge to change its height; everything below moves with it.</p>
    </Panel>
  );
}

function CanvasProps({ frameOut, onFrameOut, onAddStory }: { frameOut: boolean; onFrameOut: (v: boolean) => void; onAddStory: () => void }) {
  return (
    <Panel title="Canvas">
      <Row label="Frame at end">
        <Toggle checked={frameOut} label="Frame at end" onChange={onFrameOut} />
      </Row>
      <div className="cmp-actions">
        <button className="wide-btn" onClick={onAddStory}>
          Add a story
        </button>
      </div>
      <p className="cmp-hint">Select a story from the list or its name beside the board to change its height, photo and phone layout.</p>
      <p className="cmp-hint">
        The numbers (Order) show the reading sequence: within each story, text (blue) and lines (white) arrive one at a time in that order, scrubbed to the
        scroll. It follows the layout: top to bottom, left to right along a row, a line between the texts it joins, and a caption (text just under other text)
        straight after it. Move a piece of text a little lower to bring it later, or use its Arrives setting.
      </p>
      <div className="cmp-sub">
        <h4>Shortcuts</h4>
        <dl className="cmp-keys">
          <dt>V T P</dt>
          <dd>Select, text, line</dd>
          <dt>Enter</dt>
          <dd>Edit text / finish line</dd>
          <dt>Arrows</dt>
          <dd>Nudge (Shift ×10)</dd>
          <dt>⌘D</dt>
          <dd>Duplicate</dd>
          <dt>⌘Z</dt>
          <dd>Undo (⇧ to redo)</dd>
          <dt>G</dt>
          <dd>Grid</dd>
          <dt>⌘ held</dt>
          <dd>No snapping or pinning</dd>
        </dl>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Preview: the real markup and the real scroll engine, in a frame
   -------------------------------------------------------------------------- */

function Preview({
  draft,
  block,
  media,
  kind,
  from,
  onKind,
  onClose,
}: {
  draft: Draft;
  block: CanvasBlock;
  media: ReadonlyMap<string, MediaItem>;
  kind: BoardKind;
  from: string | null;
  onKind: (k: BoardKind) => void;
  onClose: () => void;
}) {
  const doc = useMemo(() => {
    const View = canvasBlock.View;
    const body = renderToStaticMarkup(
      <MediaContext.Provider value={media}>
        <div className="site-root">
          <main>
            <View block={{ ...block, ...draft }} editable={false} onUpdate={() => {}} />
            <section className="tone-light" data-tone="light" style={{ height: '100vh' }} />
          </main>
        </div>
      </MediaContext.Provider>,
    );
    // Photos load straight away, so starting partway down doesn't show an empty stage.
    const eager = body.replace(/loading="lazy"/g, 'loading="eager"');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="/site.css" /><script src="/vendor/lenis.min.js" defer></script><script src="/site.js" defer></script></head><body>${eager}</body></html>`;
  }, [draft, block, media]);

  // Starting from a story: scroll so its top sits in the middle of the screen, where its photo is fully in.
  const onLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    if (!from) return;
    const win = e.currentTarget.contentWindow as (Window & { lenis?: { scrollTo: (y: number, o: object) => void } }) | null;
    setTimeout(() => {
      const el = win?.document.querySelector(`.wf-story[data-story="${from}"]`);
      if (!win || !el) return;
      const y = el.getBoundingClientRect().top + win.scrollY - win.innerHeight * 0.5 + 2;
      if (win.lenis) win.lenis.scrollTo(y, { immediate: true });
      else win.scrollTo(0, y);
    }, 60);
  };

  return (
    <div className="cmp-preview">
      <header className="cmp-bar">
        <div className="cmp-bar-group">
          <button className="cmp-btn primary" onClick={onClose}>
            Back to the board
          </button>
        </div>
        <div className="cmp-bar-group">
          <Seg
            value={kind}
            onChange={onKind}
            options={[
              { value: 'desk', label: 'Desktop' },
              { value: 'phone', label: 'Phone' },
            ]}
          />
        </div>
        <div className="cmp-bar-group">
          <span className="cmp-title">{from ? `From “${draft.stories.find((s) => s.id === from)?.name}”` : 'Scroll to play it through'}</span>
        </div>
      </header>
      <div className="cmp-preview-stage">
        <iframe key={kind} className={`cmp-preview-frame ${kind}`} title="Preview" srcDoc={doc} onLoad={onLoad} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Small controls and icons
   -------------------------------------------------------------------------- */

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="cmp-seg">
      {options.map((o) => (
        <button key={o.value} title={o.title} className={o.value === value ? 'active' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`cmp-check${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      {label}
    </button>
  );
}

const icon = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function IconSelect() {
  return (
    <svg {...icon}>
      <path d="M3.5 2.5l9 4.6-4 1.1-1.6 4.1z" />
    </svg>
  );
}

function IconText() {
  return (
    <svg {...icon}>
      <path d="M3 3.5h10M8 3.5v9.5M6 13h4" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg {...icon}>
      <path d="M2.5 13.5c3-9 6-9 11-11" />
      <circle cx="2.5" cy="13.5" r="1.2" />
      <circle cx="13.5" cy="2.5" r="1.2" />
    </svg>
  );
}

function IconUndo({ flip }: { flip?: boolean }) {
  return (
    <svg {...icon} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M5.5 4L2.5 7l3 3M3 7h6.5a4 4 0 010 8H8" />
    </svg>
  );
}
