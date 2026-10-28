import { EditableText } from '../../components/editing/EditableText';
import { IconMegaphone } from '../../components/icons';
import { Row, Segmented, Toggle } from '../../components/ui/controls';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { AnchorField, anchorId, Arrow, Label, Lines, PicField, Picture, TextRow, type Pic } from '../shared';

export interface ClosingBlock {
  id: string;
  type: 'closing';
  anchor?: string;
  eyebrow: string;
  heading: string;
  text: string;
  linkLabel: string;
  href: string;
  /** full: text over the photograph. split: the photograph fills the right half. */
  layout?: 'full' | 'split';
  /** Opens from a framed card on the light page, growing to fill the screen as you scroll. */
  frameIn?: boolean;
  image: Pic;
}

/** The last word: a photograph, a line, and one way to get in touch (or to the next project). */
function ClosingView({ block, editable, onUpdate }: BlockViewProps<ClosingBlock>) {
  return (
    <section
      id={anchorId(block.anchor)}
      className={`wf-closing wf-pinned tone-dark layout-${block.layout ?? 'full'}${block.frameIn ? ' from-light' : ''}`}
      data-scroll
      data-pin
      data-tone="dark"
    >
      <div className="wf-stage">
        <div className="wf-closing-stage">
          <div className="wf-bg" aria-hidden="true">
            <Picture pic={block.image} className="wf-bg-img" />
            <div className="wf-shade" />
          </div>
          <div className="wf-closing-inner">
            <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
            <Lines
              className="wf-display wf-offset"
              value={block.heading}
              editable={editable}
              placeholder="Heading"
              onChange={(heading) => onUpdate({ heading })}
            />
            <EditableText
              as="p"
              className="wf-small"
              value={block.text}
              editable={editable}
              multiline
              placeholder="A short invitation"
              onChange={(text) => onUpdate({ text })}
            />
            {editable ? (
              <span className="wf-button">
                <EditableText value={block.linkLabel} editable placeholder="Link text" onChange={(linkLabel) => onUpdate({ linkLabel })} />
                <Arrow />
              </span>
            ) : (
              block.href && (
                <a className="wf-button" href={block.href}>
                  {block.linkLabel} <Arrow />
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingInspector({ block, onUpdate }: BlockInspectorProps<ClosingBlock>) {
  return (
    <>
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <TextRow label="Link text" value={block.linkLabel} onChange={(linkLabel) => onUpdate({ linkLabel })} />
      <TextRow label="Link" value={block.href} placeholder="mailto:… or /work/…" onChange={(href) => onUpdate({ href })} />
      <Row label="Layout">
        <Segmented
          value={block.layout ?? 'full'}
          onChange={(layout) => onUpdate({ layout })}
          options={[
            { value: 'full' as const, label: 'Full' },
            { value: 'split' as const, label: 'Split' },
          ]}
        />
      </Row>
      <Row label="Open from card">
        <Toggle checked={Boolean(block.frameIn)} label="Open from card" onChange={(frameIn) => onUpdate({ frameIn })} />
      </Row>
      <PicField pic={block.image} onChange={(image) => onUpdate({ image })} />
      <AnchorField value={block.anchor} onChange={(anchor) => onUpdate({ anchor })} />
    </>
  );
}

export const closingBlock = defineBlock<ClosingBlock>({
  type: 'closing',
  label: 'Closing',
  description: 'Photograph, headline and one link, to end a page',
  icon: IconMegaphone,
  images: true,
  create: () => ({
    type: 'closing',
    eyebrow: 'Start a conversation',
    heading: 'Got an idea?\nLet’s bring it to life.',
    text: '',
    linkLabel: 'Say hello',
    href: 'mailto:hello@wildfox.digital',
    layout: 'split',
    image: { src: '/images/fox.webp', alt: '' },
  }),
  View: ClosingView,
  Inspector: ClosingInspector,
});
