import type { CSSProperties } from 'react';
import { EditableText } from '../../components/editing/EditableText';
import { IconGrid } from '../../components/icons';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { AnchorField, anchorId, Label, Lines, newId, patchItem, PicField, Picture, Tags, TextRow, ToneField, type Pic, type Tone } from '../shared';

export interface Service {
  id: string;
  title: string;
  text: string;
  /** Comma-separated. */
  tags: string;
}

export interface ServicesBlock {
  id: string;
  type: 'services';
  anchor?: string;
  tone: Tone;
  eyebrow: string;
  heading: string;
  intro: string;
  image: Pic;
  items: Service[];
}

/** An offset two-line headline, a small photograph, then the list of what we build. */
function ServicesView({ block, editable, onUpdate }: BlockViewProps<ServicesBlock>) {
  const update = (id: string, patch: Partial<Service>) => onUpdate({ items: patchItem(block.items, id, patch) });
  const hasImage = Boolean(block.image.mediaId || block.image.src);
  return (
    <section id={anchorId(block.anchor)} className={`wf-services wf-section tone-${block.tone}`} data-scroll data-tone={block.tone}>
      <div className="wf-services-top">
        <div className="wf-services-head" data-reveal>
          <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
          <Lines className="wf-display wf-offset" value={block.heading} editable={editable} placeholder="Heading" onChange={(heading) => onUpdate({ heading })} />
        </div>
        <div className="wf-services-aside" data-reveal>
          {hasImage && (
            <div className="wf-tile">
              <Picture pic={block.image} sizes="(min-width: 900px) 30vw, 80vw" className="parallax-sm" />
            </div>
          )}
          <EditableText as="p" className="wf-small" value={block.intro} editable={editable} multiline placeholder="A short intro" onChange={(intro) => onUpdate({ intro })} />
        </div>
      </div>
      <ol className="wf-services-list">
        {block.items.map((item, i) => (
          <li key={item.id} className="wf-service" data-reveal style={{ '--i': i } as CSSProperties}>
            <EditableText as="h3" className="wf-serif wf-service-title" value={item.title} editable={editable} placeholder="Title" onChange={(title) => update(item.id, { title })} />
            <EditableText as="p" className="wf-small" value={item.text} editable={editable} multiline placeholder="What it is" onChange={(text) => update(item.id, { text })} />
            <Tags value={item.tags} editable={editable} onChange={(tags) => update(item.id, { tags })} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ServicesInspector({ block, onUpdate }: BlockInspectorProps<ServicesBlock>) {
  return (
    <>
      <ToneField value={block.tone} onChange={(tone) => onUpdate({ tone })} />
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <ItemList
        items={block.items}
        onChange={(items) => onUpdate({ items })}
        label={(item) => item.title || 'Item'}
        editor={(item, update) => (
          <>
            <TextRow label="Title" value={item.title} onChange={(title) => update({ title })} />
            <TextRow label="Text" value={item.text} onChange={(text) => update({ text })} />
            <TextRow label="Tags" value={item.tags} placeholder="Comma-separated" onChange={(tags) => update({ tags })} />
          </>
        )}
        create={() => ({ id: newId(), title: 'Something we build', text: '', tags: '' })}
      />
      <PicField pic={block.image} onChange={(image) => onUpdate({ image })} />
      <AnchorField value={block.anchor} onChange={(anchor) => onUpdate({ anchor })} />
    </>
  );
}

export const servicesBlock = defineBlock<ServicesBlock>({
  type: 'services',
  label: 'Services',
  description: 'Offset headline, small photograph and a numbered list',
  icon: IconGrid,
  images: true,
  create: () => ({
    type: 'services',
    tone: 'light',
    eyebrow: 'What we build',
    heading: 'Built for\nwherever people find you.',
    intro: '',
    image: { src: '/images/fern.webp', alt: '' },
    items: [{ id: newId(), title: 'Marketing sites', text: '', tags: '' }],
  }),
  View: ServicesView,
  Inspector: ServicesInspector,
});
