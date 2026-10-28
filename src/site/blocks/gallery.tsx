import type { CSSProperties } from 'react';
import { EditableText } from '../../components/editing/EditableText';
import { IconLayout } from '../../components/icons';
import { Row, Segmented, Slider } from '../../components/ui/controls';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { AnchorField, anchorId, Label, Lines, newId, patchItem, PicField, Picture, TextRow, ToneField, type Pic, type Tone } from '../shared';

export interface GalleryItem {
  id: string;
  image: Pic;
  /** Its height; it keeps its own shape. */
  size: 's' | 'm' | 'l';
  /** Nudged up (negative) or down from the wave it rides, -0.5 – 0.5. */
  y: number;
  caption: string;
  href: string;
}

export interface GalleryBlock {
  id: string;
  type: 'gallery';
  anchor?: string;
  tone: Tone;
  eyebrow: string;
  heading: string;
  intro: string;
  items: GalleryItem[];
}

/**
 * A drifting gallery: the section pins and a chain of pictures, edge to edge at their
 * own shapes, slides across the screen as you scroll, riding a wave down through the
 * middle of the screen and up again. (The scroll engine sizes the section to the
 * chain's length and sets each picture's place on the wave.)
 */
function GalleryView({ block, editable, onUpdate }: BlockViewProps<GalleryBlock>) {
  const update = (id: string, patch: Partial<GalleryItem>) => onUpdate({ items: patchItem(block.items, id, patch) });
  return (
    <section
      id={anchorId(block.anchor)}
      className={`wf-gallery wf-section tone-${block.tone}`}
      data-scroll
      data-pin
      data-tone={block.tone}
    >
      <div className="wf-gallery-pin">
        <div className="wf-gallery-track" data-track>
          <header className="wf-gallery-head">
            <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
            <Lines className="wf-display" value={block.heading} editable={editable} placeholder="Heading" onChange={(heading) => onUpdate({ heading })} />
            <EditableText as="p" className="wf-small" value={block.intro} editable={editable} multiline placeholder="Intro" onChange={(intro) => onUpdate({ intro })} />
          </header>
          {block.items.map((item) => {
            const Frame = editable || !item.href ? 'div' : 'a';
            return (
              <figure key={item.id} className={`wf-gallery-item s-${item.size}`} style={{ '--y': item.y } as CSSProperties} data-hx>
                <Frame className="wf-gallery-frame" {...(Frame === 'a' ? { href: item.href } : {})}>
                  <Picture pic={item.image} sizes="(min-width: 900px) 36vw, 70vw" />
                </Frame>
                {(editable || item.caption) && (
                  <figcaption>
                    <EditableText
                      as="p"
                      className="wf-small"
                      value={item.caption}
                      editable={editable}
                      placeholder="Caption"
                      onChange={(caption) => update(item.id, { caption })}
                    />
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GalleryInspector({ block, onUpdate }: BlockInspectorProps<GalleryBlock>) {
  return (
    <>
      <ToneField value={block.tone} onChange={(tone) => onUpdate({ tone })} />
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <ItemList
        items={block.items}
        onChange={(items) => onUpdate({ items })}
        label={(item) => item.caption || 'Picture'}
        thumb={(item) => item.image.src || null}
        editor={(item, update) => (
          <>
            <PicField pic={item.image} onChange={(image) => update({ image })} />
            <Row label="Size">
              <Segmented
                value={item.size}
                onChange={(size) => update({ size })}
                options={[
                  { value: 's' as const, label: 'Small' },
                  { value: 'm' as const, label: 'Medium' },
                  { value: 'l' as const, label: 'Large' },
                ]}
              />
            </Row>
            <Row label="Nudge">
              <Slider
                value={item.y}
                min={-0.5}
                max={0.5}
                step={0.05}
                onChange={(y) => update({ y })}
                format={(v) => (v ? `${Math.abs(Math.round(v * 100))}% ${v < 0 ? 'up' : 'down'}` : 'On the wave')}
              />
            </Row>
            <TextRow label="Caption" value={item.caption} onChange={(caption) => update({ caption })} />
            <TextRow label="Link" value={item.href} placeholder="/work/…" onChange={(href) => update({ href })} />
          </>
        )}
        create={() => ({ id: newId(), image: { src: '', alt: '' }, size: 'm' as const, y: 0, caption: '', href: '' })}
        addLabel="Add picture"
      />
      <AnchorField value={block.anchor} onChange={(anchor) => onUpdate({ anchor })} />
    </>
  );
}

export const galleryBlock = defineBlock<GalleryBlock>({
  type: 'gallery',
  label: 'Drifting gallery',
  description: 'Scattered pictures that slide across the screen as you scroll',
  icon: IconLayout,
  images: true,
  create: () => ({ type: 'gallery', tone: 'light', eyebrow: '', heading: 'In the making.', intro: '', items: [] }),
  View: GalleryView,
  Inspector: GalleryInspector,
});
