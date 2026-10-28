import { blockDefinition } from '../lib/registry';
import type { Block, BlockPatch } from '../types';
import { IconClose, IconCopy, IconTrash } from './icons';
import { Row, Toggle } from './ui/controls';

interface InspectorProps {
  open: boolean;
  block: Block | null;
  onClose: () => void;
  onUpdate: (patch: BlockPatch) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function Inspector({ open, block, onClose, onUpdate, onDuplicate, onRemove }: InspectorProps) {
  return (
    <aside className={`inspector${open && block ? ' open' : ''}`} aria-hidden={!open || !block}>
      <div className="inspector-inner">
        {block && (
          <>
            <div className="insp-header">
              <span className="insp-title">{blockDefinition(block.type)?.label ?? block.type}</span>
              <div className="insp-actions">
                <button className="insp-btn" title="Duplicate block" onClick={onDuplicate}>
                  <IconCopy size={13} />
                </button>
                <button className="insp-btn" title="Delete block" onClick={onRemove}>
                  <IconTrash size={13} />
                </button>
                <button className="insp-btn" title="Close inspector" onClick={onClose}>
                  <IconClose size={13} />
                </button>
              </div>
            </div>
            <div className="insp-body">
              <InspectorBody block={block} onUpdate={onUpdate} />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function InspectorBody({ block, onUpdate }: { block: Block; onUpdate: (p: BlockPatch) => void }) {
  const def = blockDefinition(block.type);
  const Body = def?.Inspector;
  return (
    <>
      {Body ? <Body block={block} onUpdate={onUpdate} /> : <div className="note-row">Edit this block on the page.</div>}
      {def?.images && (
        <Row label="Lazy load">
          <Toggle
            checked={block.lazyLoad !== false}
            label="Lazy load images"
            onChange={(lazyLoad) => onUpdate({ lazyLoad } as BlockPatch)}
          />
          <span className="row-hint">Turn off for images visible as soon as the page opens.</span>
        </Row>
      )}
    </>
  );
}
