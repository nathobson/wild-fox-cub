import { useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronUp, IconTrash } from '../icons';

interface ItemListProps<T extends { id: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  /** One-line summary shown for each item. */
  label: (item: T, index: number) => ReactNode;
  /** Optional thumbnail URL for each item. */
  thumb?: (item: T) => string | null | undefined;
  /** Fields for one item, shown when it is expanded. */
  editor?: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  /** Creates a new item; may be async (e.g. picking an image). Omit to hide "Add". */
  create?: () => T | null | Promise<T | null>;
  addLabel?: string;
}

/** Inspector control for a list of items: reorder, remove, add, and edit in place. */
export function ItemList<T extends { id: string }>({
  items,
  onChange,
  label,
  thumb,
  editor,
  create,
  addLabel = 'Add item',
}: ItemListProps<T>) {
  const [open, setOpen] = useState<string | null>(null);

  const move = (index: number, delta: number) => {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    onChange(next);
  };

  const add = async () => {
    const item = await create?.();
    if (!item) return;
    onChange([...items, item]);
    if (editor) setOpen(item.id);
  };

  return (
    <div className="item-list">
      {items.map((item, index) => {
        const src = thumb?.(item);
        const expanded = open === item.id;
        return (
          <div className={`list-item${expanded ? ' open' : ''}`} key={item.id}>
            <div className="list-item-row">
              {src && <img className="img-thumb" src={src} alt="" />}
              <button
                className="list-item-label"
                onClick={() => editor && setOpen(expanded ? null : item.id)}
                disabled={!editor}
              >
                {label(item, index)}
              </button>
              <button className="insp-btn" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                <IconChevronUp size={12} />
              </button>
              <button
                className="insp-btn"
                title="Move down"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <IconChevronDown size={12} />
              </button>
              <button
                className="insp-btn"
                title="Remove"
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              >
                <IconTrash size={12} />
              </button>
            </div>
            {expanded && editor && (
              <div className="list-item-editor">
                {editor(item, (patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i))))}
              </div>
            )}
          </div>
        );
      })}
      {create && (
        <button className="wide-btn" onClick={add}>
          {addLabel}
        </button>
      )}
    </div>
  );
}
