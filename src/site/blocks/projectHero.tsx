import type { CSSProperties } from 'react';
import { EditableText } from '../../components/editing/EditableText';
import { IconLayout } from '../../components/icons';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { Label, Lines, newId, patchItem, PicField, Picture, TextRow, type Pic } from '../shared';

export interface MetaItem {
  id: string;
  label: string;
  value: string;
}

export interface ProjectHeroBlock {
  id: string;
  type: 'projectHero';
  eyebrow: string;
  name: string;
  summary: string;
  /** The project's own colour, used sparingly across its page. */
  accent: string;
  meta: MetaItem[];
  /** Product screen, framed. */
  screen: Pic;
  /** Photograph behind the title. */
  backdrop: Pic;
}

/** Opens a project page: name, one line, the facts, and the product rising into frame. */
function ProjectHeroView({ block, editable, onUpdate }: BlockViewProps<ProjectHeroBlock>) {
  const update = (id: string, patch: Partial<MetaItem>) => onUpdate({ meta: patchItem(block.meta, id, patch) });
  return (
    <section
      className="wf-phero tone-dark"
      data-scroll
      data-tone="dark"
      data-accent={block.accent}
      style={{ '--accent': block.accent } as CSSProperties}
    >
      <div className="wf-phero-top">
        <div className="wf-bg" aria-hidden="true">
          <Picture pic={block.backdrop} className="wf-bg-img parallax" />
          <div className="wf-shade heavy" />
        </div>
        <div className="wf-phero-inner">
          <Label className="rise" value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
          <Lines as="h1" className="wf-display wf-phero-name" value={block.name} editable={editable} placeholder="Project" onChange={(name) => onUpdate({ name })} />
          <EditableText as="p" className="wf-phero-summary rise" value={block.summary} editable={editable} multiline placeholder="What it is, in one line" onChange={(summary) => onUpdate({ summary })} />
          <div className="wf-meta rise">
            {block.meta.map((item) => (
              <div key={item.id}>
                <EditableText className="label" value={item.label} editable={editable} placeholder="Label" onChange={(label) => update(item.id, { label })} />
                <EditableText as="p" value={item.value} editable={editable} placeholder="Value" onChange={(value) => update(item.id, { value })} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="wf-screen-wrap">
        <figure className="wf-screen">
          <Picture pic={block.screen} sizes="(min-width: 1200px) 1100px, 94vw" />
        </figure>
      </div>
    </section>
  );
}

function ProjectHeroInspector({ block, onUpdate }: BlockInspectorProps<ProjectHeroBlock>) {
  return (
    <>
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <TextRow label="Accent" value={block.accent} placeholder="#ff6a3d" onChange={(accent) => onUpdate({ accent })} />
      <ItemList
        items={block.meta}
        onChange={(meta) => onUpdate({ meta })}
        label={(item) => `${item.label}: ${item.value}`}
        editor={(item, update) => (
          <>
            <TextRow label="Label" value={item.label} onChange={(label) => update({ label })} />
            <TextRow label="Value" value={item.value} onChange={(value) => update({ value })} />
          </>
        )}
        create={() => ({ id: newId(), label: 'Label', value: 'Value' })}
        addLabel="Add fact"
      />
      <PicField label="Screen" pic={block.screen} onChange={(screen) => onUpdate({ screen })} />
      <PicField label="Backdrop" pic={block.backdrop} onChange={(backdrop) => onUpdate({ backdrop })} />
    </>
  );
}

export const projectHeroBlock = defineBlock<ProjectHeroBlock>({
  type: 'projectHero',
  label: 'Project hero',
  description: 'Project name, key facts and a framed product screen',
  icon: IconLayout,
  images: true,
  create: () => ({
    type: 'projectHero',
    eyebrow: 'Case study',
    name: 'Project',
    summary: '',
    accent: '#ff6a3d',
    meta: [
      { id: newId(), label: 'Type', value: 'Product' },
      { id: newId(), label: 'Stack', value: '' },
    ],
    screen: { src: '', alt: '' },
    backdrop: { src: '/images/concept/forest.webp', alt: '' },
  }),
  View: ProjectHeroView,
  Inspector: ProjectHeroInspector,
});
