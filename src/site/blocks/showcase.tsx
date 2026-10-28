import type { CSSProperties } from 'react';
import { EditableText } from '../../components/editing/EditableText';
import { IconDesktop } from '../../components/icons';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { Label, Lines, newId, patchItem, PicField, Picture, TextRow, ToneField, type Pic, type Tone } from '../shared';

export interface Feature {
  id: string;
  title: string;
  text: string;
  image: Pic;
}

export interface ShowcaseBlock {
  id: string;
  type: 'showcase';
  tone: Tone;
  eyebrow: string;
  heading: string;
  features: Feature[];
}

/**
 * Key features, scrollytelling style: the screen stays pinned and changes as each
 * feature's few words arrive beside it.
 */
function ShowcaseView({ block, editable, onUpdate }: BlockViewProps<ShowcaseBlock>) {
  const count = block.features.length;
  const update = (id: string, patch: Partial<Feature>) => onUpdate({ features: patchItem(block.features, id, patch) });
  return (
    <section
      className={`wf-showcase wf-pinned tone-${block.tone}`}
      data-scroll
      data-pin
      data-steps={count}
      data-tone={block.tone}
      style={{ '--n': count } as CSSProperties}
    >
      <div className="wf-stage">
        <div className="wf-showcase-grid">
          <div className="wf-showcase-copy">
            <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
            <Lines className="wf-display wf-showcase-heading" value={block.heading} editable={editable} placeholder="Heading" onChange={(heading) => onUpdate({ heading })} />
            <ol className="wf-ticks" aria-hidden="true">
              {block.features.map((feature, i) => (
                <li key={feature.id} data-step={i} />
              ))}
            </ol>
            <ol className="wf-features">
              {block.features.map((feature, i) => (
                <li key={feature.id} className="wf-feature" data-step={i} data-only>
                  <EditableText as="h3" className="wf-serif wf-feature-title" value={feature.title} editable={editable} placeholder="Feature" onChange={(title) => update(feature.id, { title })} />
                  <EditableText as="p" className="wf-small" value={feature.text} editable={editable} multiline placeholder="A sentence or two" onChange={(text) => update(feature.id, { text })} />
                  <div className="wf-feature-shot">
                    <Picture pic={feature.image} sizes="92vw" />
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="wf-showcase-screen" aria-hidden="true">
            {block.features.map((feature, i) => (
              <figure key={feature.id} className="wf-screen" data-step={i} data-only>
                <Picture pic={feature.image} sizes="(min-width: 900px) 58vw, 92vw" />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseInspector({ block, onUpdate }: BlockInspectorProps<ShowcaseBlock>) {
  return (
    <>
      <ToneField value={block.tone} onChange={(tone) => onUpdate({ tone })} />
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <ItemList
        items={block.features}
        onChange={(features) => onUpdate({ features })}
        label={(feature) => feature.title || 'Feature'}
        thumb={(feature) => feature.image.src || null}
        editor={(feature, update) => (
          <>
            <TextRow label="Title" value={feature.title} onChange={(title) => update({ title })} />
            <TextRow label="Text" value={feature.text} onChange={(text) => update({ text })} />
            <PicField label="Screen" pic={feature.image} onChange={(image) => update({ image })} />
          </>
        )}
        create={() => ({ id: newId(), title: 'Feature', text: '', image: { src: '', alt: '' } })}
        addLabel="Add feature"
      />
    </>
  );
}

export const showcaseBlock = defineBlock<ShowcaseBlock>({
  type: 'showcase',
  label: 'Feature showcase',
  description: 'Pinned product screen that changes with each feature',
  icon: IconDesktop,
  images: true,
  create: () => ({
    type: 'showcase',
    tone: 'dark',
    eyebrow: 'Key features',
    heading: 'Inside\nthe product.',
    features: [{ id: newId(), title: 'Feature', text: '', image: { src: '', alt: '' } }],
  }),
  View: ShowcaseView,
  Inspector: ShowcaseInspector,
});
