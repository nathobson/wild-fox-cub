import type { CSSProperties } from 'react';
import { EditableText } from '../../components/editing/EditableText';
import { IconList } from '../../components/icons';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { Label, Lines, newId, patchItem, Tags, TextRow, ToneField, type Tone } from '../shared';

export interface Layer {
  id: string;
  name: string;
  note: string;
  /** Comma-separated tools. */
  tools: string;
}

export interface StackBlock {
  id: string;
  type: 'stack';
  tone: Tone;
  eyebrow: string;
  heading: string;
  intro: string;
  layers: Layer[];
}

/** The technology, layer by layer, joined by a line that grows as you read down. */
function StackView({ block, editable, onUpdate }: BlockViewProps<StackBlock>) {
  const update = (id: string, patch: Partial<Layer>) => onUpdate({ layers: patchItem(block.layers, id, patch) });
  return (
    <section className={`wf-stack wf-section tone-${block.tone}`} data-scroll data-tone={block.tone}>
      <div className="wf-stack-head" data-reveal>
        <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
        <Lines className="wf-display wf-offset" value={block.heading} editable={editable} placeholder="Heading" onChange={(heading) => onUpdate({ heading })} />
        <EditableText as="p" className="wf-small" value={block.intro} editable={editable} multiline placeholder="Intro" onChange={(intro) => onUpdate({ intro })} />
      </div>
      <ol className="wf-layers">
        {block.layers.map((layer, i) => (
          <li key={layer.id} className="wf-layer-row" data-reveal style={{ '--i': i } as CSSProperties}>
            <span className="wf-node" aria-hidden="true" />
            <EditableText className="wf-layer-name" value={layer.name} editable={editable} placeholder="Layer" onChange={(name) => update(layer.id, { name })} />
            <div className="wf-layer-body">
              <EditableText as="p" className="wf-serif wf-layer-note" value={layer.note} editable={editable} multiline placeholder="What this layer does" onChange={(note) => update(layer.id, { note })} />
              <Tags value={layer.tools} editable={editable} onChange={(tools) => update(layer.id, { tools })} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StackInspector({ block, onUpdate }: BlockInspectorProps<StackBlock>) {
  return (
    <>
      <ToneField value={block.tone} onChange={(tone) => onUpdate({ tone })} />
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <ItemList
        items={block.layers}
        onChange={(layers) => onUpdate({ layers })}
        label={(layer) => layer.name || 'Layer'}
        editor={(layer, update) => (
          <>
            <TextRow label="Name" value={layer.name} onChange={(name) => update({ name })} />
            <TextRow label="Note" value={layer.note} onChange={(note) => update({ note })} />
            <TextRow label="Tools" value={layer.tools} placeholder="Comma-separated" onChange={(tools) => update({ tools })} />
          </>
        )}
        create={() => ({ id: newId(), name: 'Layer', note: '', tools: '' })}
        addLabel="Add layer"
      />
    </>
  );
}

export const stackBlock = defineBlock<StackBlock>({
  type: 'stack',
  label: 'Tech stack',
  description: 'The technology behind a project, layer by layer',
  icon: IconList,
  create: () => ({
    type: 'stack',
    tone: 'light',
    eyebrow: 'Under the canopy',
    heading: 'How it’s\nbuilt.',
    intro: '',
    layers: [{ id: newId(), name: 'Interface', note: '', tools: '' }],
  }),
  View: StackView,
  Inspector: StackInspector,
});
