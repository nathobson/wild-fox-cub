import { Fragment, useState } from 'react';
import { useSite } from '../store/SiteStore';
import { blockDefinition } from '../lib/registry';
import { SiteFooter, SiteHeader } from '../site';
import { navItems, type Block, type BlockPatch, type ChromeProps, type Device, type EditorMode } from '../types';
import { BlockGap, BlockWrapper } from './editing/BlockWrapper';

interface CanvasProps {
  mode: EditorMode;
  device: Device;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onOpenPicker: (index: number) => void;
}

export function Canvas({ mode, device, selectedBlockId, onSelectBlock, onOpenPicker }: CanvasProps) {
  const { site, activePage, setActivePage, renameSite, updateBlock, removeBlock, duplicateBlock, moveBlock } =
    useSite();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const editable = mode === 'edit';
  const blocks = activePage.blocks;

  const chrome: ChromeProps = {
    site,
    nav: navItems(site),
    page: activePage,
    editor: {
      editable,
      onRename: renameSite,
      // Navigation links switch pages in Preview; in Edit mode they stay put.
      onNavigate: (pageId) => {
        if (!editable) setActivePage(pageId);
      },
    },
  };

  const renderBlock = (block: Block, isEditable: boolean) => {
    const update = (patch: BlockPatch) => updateBlock(activePage.id, block.id, patch);
    const noop = (_patch: BlockPatch) => {};
    const def = blockDefinition(block.type);
    if (!def) return <div className="canvas-empty">Unknown block type “{block.type}”.</div>;
    return <def.View block={block} editable={isEditable} onUpdate={isEditable ? update : noop} />;
  };

  const clearDrag = () => {
    setDraggingId(null);
    setDropIndex(null);
  };

  const handleDrop = (index: number) => {
    if (draggingId) moveBlock(activePage.id, draggingId, index);
    clearDrag();
  };

  const gap = (index: number) => (
    <BlockGap
      key={`gap-${index}`}
      index={index}
      active={dropIndex === index}
      onAdd={onOpenPicker}
      onDragOverGap={setDropIndex}
      onDragLeaveGap={(i) => setDropIndex((d) => (d === i ? null : d))}
      onDropOnGap={handleDrop}
    />
  );

  return (
    <div
      className="canvas-scroll"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectBlock(null);
      }}
    >
      <div className={`canvas-doc ${device} mode-${mode}`}>
        <div className="site-root">
        <SiteHeader {...chrome} />
        <main>
        {blocks.map((block, i) =>
          editable ? (
            <Fragment key={block.id}>
              {gap(i)}
              <BlockWrapper
                blockId={block.id}
                label={blockDefinition(block.type)?.label ?? block.type}
                index={i}
                total={blocks.length}
                selected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onMove={(toIndex) => moveBlock(activePage.id, block.id, toIndex)}
                onDuplicate={() => {
                  const id = duplicateBlock(activePage.id, block.id);
                  if (id) onSelectBlock(id);
                }}
                onRemove={() => removeBlock(activePage.id, block.id)}
                onDragChange={(id) => {
                  setDraggingId(id);
                  if (!id) setDropIndex(null);
                }}
              >
                {renderBlock(block, true)}
              </BlockWrapper>
            </Fragment>
          ) : (
            <Fragment key={block.id}>{renderBlock(block, false)}</Fragment>
          ),
        )}
        {editable && gap(blocks.length)}
        {editable && blocks.length === 0 && (
          <div className="canvas-empty">
            <p>This page has no blocks yet.</p>
            <button className="wide-btn" onClick={() => onOpenPicker(0)}>
              Add your first block
            </button>
          </div>
        )}
        </main>
        <SiteFooter {...chrome} />
        </div>
      </div>
    </div>
  );
}
