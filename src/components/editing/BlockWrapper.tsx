import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconGrip,
  IconPlus,
  IconSliders,
  IconTrash,
} from '../icons';

/* ------------------------------------------------------------------ */
/* BlockWrapper — selection ring, hover outline, chip, toolbar, DnD    */
/* ------------------------------------------------------------------ */

interface BlockWrapperProps {
  blockId: string;
  label: string;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  /** Move to a gap index (0..total). */
  onMove: (gapIndex: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragChange: (blockId: string | null) => void;
  children: ReactNode;
}

export function BlockWrapper({
  blockId,
  label,
  index,
  total,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onDragChange,
  children,
}: BlockWrapperProps) {
  const [handleHeld, setHandleHeld] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  // If the grip is pressed but no drag starts, release it on any mouseup.
  useEffect(() => {
    if (!handleHeld) return;
    const release = () => setHandleHeld(false);
    window.addEventListener('mouseup', release);
    return () => window.removeEventListener('mouseup', release);
  }, [handleHeld]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', blockId);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
    onDragChange(blockId);
  };

  const handleDragEnd = () => {
    setDragging(false);
    setHandleHeld(false);
    onDragChange(null);
  };

  const handleDelete = () => {
    if (confirming) {
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
      onRemove();
      return;
    }
    setConfirming(true);
    confirmTimer.current = window.setTimeout(() => setConfirming(false), 3000);
  };

  return (
    <div
      className={`block-wrap${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      draggable={handleHeld}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onSelect}
    >
      <div className="block-chip">{label}</div>
      <div className="block-tools" onClick={(e) => e.stopPropagation()}>
        <button
          className="tool-btn grip"
          title="Drag to reorder"
          onMouseDown={() => setHandleHeld(true)}
        >
          <IconGrip size={13} />
        </button>
        <button
          className="tool-btn"
          title="Move up"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <IconChevronUp size={13} />
        </button>
        <button
          className="tool-btn"
          title="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(index + 2)}
        >
          <IconChevronDown size={13} />
        </button>
        <button className="tool-btn" title="Duplicate" onClick={onDuplicate}>
          <IconCopy size={13} />
        </button>
        <button className="tool-btn" title="Settings" onClick={onSelect}>
          <IconSliders size={13} />
        </button>
        <button
          className={`tool-btn danger${confirming ? ' confirm' : ''}`}
          title={confirming ? 'Click again to delete' : 'Delete block'}
          onClick={handleDelete}
        >
          {confirming ? <span className="confirm-label">Confirm?</span> : <IconTrash size={13} />}
        </button>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BlockGap — "+" insert button + drag-over insertion line             */
/* ------------------------------------------------------------------ */

interface BlockGapProps {
  index: number;
  active: boolean;
  onAdd: (index: number) => void;
  onDragOverGap: (index: number) => void;
  onDragLeaveGap: (index: number) => void;
  onDropOnGap: (index: number) => void;
}

export function BlockGap({
  index,
  active,
  onAdd,
  onDragOverGap,
  onDragLeaveGap,
  onDropOnGap,
}: BlockGapProps) {
  return (
    <div
      className={`block-gap${active ? ' drop' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverGap(index);
      }}
      onDragLeave={() => onDragLeaveGap(index)}
      onDrop={(e) => {
        e.preventDefault();
        onDropOnGap(index);
      }}
    >
      <button className="gap-add" title="Add block" onClick={() => onAdd(index)}>
        <IconPlus size={13} />
      </button>
      <div className="gap-line" />
    </div>
  );
}
