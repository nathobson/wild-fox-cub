import { useSite } from '../store/SiteStore';
import { blockDefinitions } from '../lib/registry';

interface BlockPickerProps {
  index: number;
  onClose: () => void;
  onInserted: (blockId: string) => void;
}

export function BlockPicker({ index, onClose, onInserted }: BlockPickerProps) {
  const { activePage, addBlock } = useSite();

  const pick = (type: string) => {
    const id = addBlock(activePage.id, type, index);
    onInserted(id);
    onClose();
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div
        className="picker"
        role="dialog"
        aria-label="Add a block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-header">
          <h2 className="picker-title">Add a block</h2>
        </div>
        <div className="picker-grid">
          {blockDefinitions.map((meta) => {
            const Icon = meta.icon;
            return (
              <button className="pick-card" key={meta.type} onClick={() => pick(meta.type)}>
                <span className="pick-icon">
                  <Icon size={22} />
                </span>
                <span className="pick-name">{meta.label}</span>
                <span className="pick-desc">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
