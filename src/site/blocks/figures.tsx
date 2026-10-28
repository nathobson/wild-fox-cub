import type { CSSProperties } from 'react';
import { EditableText } from '../../components/editing/EditableText';
import { IconSliders } from '../../components/icons';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { Label, newId, patchItem, TextRow, ToneField, type Tone } from '../shared';

export interface Figure {
  id: string;
  value: string;
  label: string;
}

export interface FiguresBlock {
  id: string;
  type: 'figures';
  tone: Tone;
  eyebrow: string;
  figures: Figure[];
}

/** A few numbers that say a lot, set large in the serif. */
function FiguresView({ block, editable, onUpdate }: BlockViewProps<FiguresBlock>) {
  const update = (id: string, patch: Partial<Figure>) => onUpdate({ figures: patchItem(block.figures, id, patch) });
  return (
    <section className={`wf-figures wf-section tone-${block.tone}`} data-scroll data-tone={block.tone}>
      <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <div className="wf-figures-row">
        {block.figures.map((figure, i) => (
          <div key={figure.id} className="wf-figure" data-reveal style={{ '--i': i } as CSSProperties}>
            <EditableText as="p" className="wf-display wf-figure-value" value={figure.value} editable={editable} placeholder="1" onChange={(value) => update(figure.id, { value })} />
            <EditableText as="p" className="wf-small" value={figure.label} editable={editable} multiline placeholder="What it counts" onChange={(label) => update(figure.id, { label })} />
          </div>
        ))}
      </div>
    </section>
  );
}

function FiguresInspector({ block, onUpdate }: BlockInspectorProps<FiguresBlock>) {
  return (
    <>
      <ToneField value={block.tone} onChange={(tone) => onUpdate({ tone })} />
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <ItemList
        items={block.figures}
        onChange={(figures) => onUpdate({ figures })}
        label={(figure) => `${figure.value} ${figure.label}`}
        editor={(figure, update) => (
          <>
            <TextRow label="Value" value={figure.value} onChange={(value) => update({ value })} />
            <TextRow label="Label" value={figure.label} onChange={(label) => update({ label })} />
          </>
        )}
        create={() => ({ id: newId(), value: '1', label: 'thing' })}
        addLabel="Add figure"
      />
    </>
  );
}

export const figuresBlock = defineBlock<FiguresBlock>({
  type: 'figures',
  label: 'Figures',
  description: 'A row of large numbers with short labels',
  icon: IconSliders,
  create: () => ({
    type: 'figures',
    tone: 'light',
    eyebrow: 'In numbers',
    figures: [
      { id: newId(), value: '1', label: 'thing that matters' },
      { id: newId(), value: '2', label: 'more things' },
    ],
  }),
  View: FiguresView,
  Inspector: FiguresInspector,
});
