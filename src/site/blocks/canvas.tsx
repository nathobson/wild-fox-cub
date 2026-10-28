import { Fragment, lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { IconLayout } from '../../components/icons';
import { Row, Toggle } from '../../components/ui/controls';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import {
  emptyComp,
  flowLinks,
  flowPlacement,
  normalizeComp,
  pathData,
  piecesOf,
  readingOrder,
  type Comp,
  type CompLine,
  type Piece,
  type Story,
} from '../comp/model';
import { AnchorField, anchorId, Lines, Picture } from '../shared';

/**
 * The story canvas: a stack of art-directed stories, each with phrases and drawn
 * lines over a photograph, crossfading as you scroll. Laid out by hand in the
 * composer (src/site/comp/).
 */
export interface CanvasBlock extends Comp {
  id: string;
  type: 'canvas';
  anchor?: string;
  /** At the end, the photograph shrinks into a framed card on the light page. */
  frameOut: boolean;
}

const Composer = lazy(() => import('../comp/Composer'));



/** Asks the canvas block with this id to open its composer. */
export const openComposer = (blockId: string) => window.dispatchEvent(new CustomEvent('wf-compose', { detail: blockId }));

/** A piece's content: its text (or picture), wrapped in brackets if it has them. */
export function PieceText({ piece }: { piece: Piece }) {
  const content = piece.image ? (
    <div className="wf-piece-img">
      <Picture pic={piece.image} sizes={`${Math.round(piece.d.w)}vw`} />
    </div>
  ) : (
    <Lines as={piece.tag} className="wf-piece-text" value={piece.text} editable={false} onChange={() => {}} />
  );
  if (piece.frame !== 'brackets') return content;
  // Two arcs of one circle around the text, each measured clockwise from the top of the
  // circle (one mirrored, 311 units round); the page sweeps them down to its sides.
  return (
    <span className="wf-bracketed">
      {content}
      <svg className="wf-brackets" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx={50} cy={50} r={49.5} transform="rotate(-90 50 50)" />
        <circle cx={50} cy={50} r={49.5} transform="translate(100 0) scale(-1 1) rotate(-90 50 50)" />
      </svg>
    </span>
  );
}

export const pieceClass = (piece: Piece) =>
  `wf-piece st-${piece.style}${piece.italic ? ' it' : ''}${piece.soft ? ' soft' : ''} al-${piece.align}${piece.show !== 'both' ? ` only-${piece.show}` : ''}${piece.image ? ' is-img' : ''}${piece.frame === 'brackets' ? ' has-brackets' : ''}`;

function LinePath({ line }: { line: CompLine }) {
  return (
    <path
      data-line=""
      data-nodes={JSON.stringify(line.nodes)}
      data-dash={line.dash ? '' : undefined}
      data-dots={line.dots}
      data-weight={line.weight}
      d={pathData(line.nodes, line.nodes)}
    />
  );
}

/** A piece's position variables: desktop, hand-placed phone, and phone flow. */
export function pieceVars(piece: Piece, story: Story, flow: ReturnType<typeof flowPlacement>) {
  const m = story.phone?.pieces[piece.id];
  const f = flow.get(piece.id);
  return {
    '--x': piece.d.x,
    '--y': piece.d.y,
    '--w': piece.d.w,
    ...(piece.image ? { '--ratio': piece.ratio } : {}),
    ...(piece.step ? { '--step': piece.step } : {}),
    ...(m ? { '--mx': m.x, '--my': m.y, '--mw': m.w } : {}),
    ...(f ? { '--fx': f.indent, '--gap': f.gap } : {}),
  } as CSSProperties;
}

/** One story as the live site (and the editor canvas) renders it. */
function StoryMarkup({ comp, story }: { comp: Comp; story: Story }) {
  const pieces = piecesOf(comp, story.id);
  const flow = flowPlacement(pieces);
  const phone = story.phone;
  const cam = story.hold > 0 && story.beats.length > 0;
  const Cam = cam ? 'div' : Fragment;
  return (
    <div
      className={`wf-story ${phone ? 'has-phone' : 'phone-flow'}${cam ? ' has-cam' : ''}${story.tone === 'light' ? ' tone-light' : ''}${story.float ? ' float' : ''}`}
      style={
        {
          '--h': story.height,
          '--mh': phone?.height ?? 0,
          ...(story.hold ? { '--hold': story.hold } : {}),
        } as CSSProperties
      }
      data-story={story.id}
      data-tone={story.tone}
      data-beats={cam ? story.beats.join(',') : undefined}
      data-drift={story.drift || undefined}
    >
      <div className="wf-story-pin" data-pin-story>
        <Cam {...(cam ? { className: 'wf-story-cam', 'data-cam': '' } : {})}>
        <svg className="wf-comp-lines for-desk" data-layout="desk" viewBox={`0 0 100 ${story.height}`} preserveAspectRatio="none" aria-hidden="true">
          {comp.lines
            .filter((l) => l.story === story.id)
            .map((line) => (
              <LinePath key={line.id} line={line} />
            ))}
        </svg>
        <svg
          className="wf-comp-lines for-phone"
          data-layout="phone"
          viewBox={phone ? `0 0 100 ${phone.height}` : undefined}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {phone
            ? phone.lines.map((line) => <LinePath key={line.id} line={line} />)
            : flowLinks(comp, story.id).map(({ line, from, to }) => (
                <path
                  key={line.id}
                  data-line=""
                  data-from={from}
                  data-to={to}
                  data-dash={line.dash ? '' : undefined}
                  data-dots={line.dots}
                  data-weight={line.weight}
                />
              ))}
        </svg>
        {readingOrder(pieces).map((piece) => (
          <div
            key={piece.id}
            className={pieceClass(piece)}
            style={pieceVars(piece, story, flow)}
            data-piece={piece.id}
            data-wait={piece.wait || undefined}
          >
            <PieceText piece={piece} />
          </div>
        ))}
        </Cam>
      </div>
    </div>
  );
}

/** The canvas's stories as the live site renders them. */
export function CompMarkup({ comp }: { comp: Comp }) {
  return (
    <div className="wf-comp" data-comp>
      {comp.stories.map((story) => (
        <StoryMarkup key={story.id} comp={comp} story={story} />
      ))}
    </div>
  );
}

function CanvasView({ block: saved, editable, onUpdate }: BlockViewProps<CanvasBlock>) {
  const block = { ...saved, ...normalizeComp(saved) };
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (!editable) return;
    const open = (e: Event) => {
      if ((e as CustomEvent<string>).detail === block.id) setComposing(true);
    };
    window.addEventListener('wf-compose', open);
    return () => window.removeEventListener('wf-compose', open);
  }, [editable, block.id]);

  return (
    <section
      id={anchorId(block.anchor)}
      className={`wf-canvas tone-dark${block.frameOut ? ' frame-out' : ''}`}
      data-canvas
      data-scroll
      data-tone="dark"
      onDoubleClick={editable ? () => setComposing(true) : undefined}
    >
      <div className="wf-canvas-stage" aria-hidden="true">
        {block.stories
          .filter((story) => story.image || story.tone === 'light')
          .map((story, i) =>
            story.tone === 'light' ? (
              <div key={story.id} className="wf-layer paper" data-layer={i} data-story={story.id} data-fade={story.fade} data-enter={story.enter} />
            ) : (
              <div
                key={story.id}
                className={`wf-layer${story.pull ? ' pull' : ''}`}
                data-layer={i}
                data-story={story.id}
                data-fade={story.fade}
                data-enter={story.enter}
              >
                <Picture pic={story.image!} className="wf-layer-img" />
                <div className="wf-layer-shade" style={{ '--shade': story.shade } as CSSProperties} />
              </div>
            ),
          )}
      </div>

      <CompMarkup comp={block} />

      <div className="wf-canvas-end" data-canvas-end data-tone={block.frameOut ? 'light' : 'dark'} />

      {editable && (
        <button type="button" className="wf-compose-btn" onClick={() => setComposing(true)}>
          Open composer
        </button>
      )}
      {composing && (
        <Suspense fallback={null}>
          <Composer block={block} onUpdate={onUpdate} onClose={() => setComposing(false)} />
        </Suspense>
      )}
    </section>
  );
}

function CanvasInspector({ block, onUpdate }: BlockInspectorProps<CanvasBlock>) {
  return (
    <>
      <div className="note-row">
        Lay this canvas out by hand, story by story: place phrases, draw the lines between them and choose each story’s photograph.
      </div>
      <button className="wide-btn" onClick={() => openComposer(block.id)}>
        Open composer
      </button>
      <Row label="Frame at end">
        <Toggle checked={block.frameOut} label="Frame at end" onChange={(frameOut) => onUpdate({ frameOut })} />
      </Row>
      <AnchorField value={block.anchor} onChange={(anchor) => onUpdate({ anchor })} />
    </>
  );
}

export const canvasBlock = defineBlock<CanvasBlock>({
  type: 'canvas',
  label: 'Story canvas',
  description: 'Hand-composed stories: phrases and drawn lines over crossfading photographs',
  icon: IconLayout,
  images: true,
  create: () => ({ type: 'canvas', frameOut: true, ...emptyComp({ src: '/images/monstera.webp', alt: '' }) }),
  View: CanvasView,
  Inspector: CanvasInspector,
});
