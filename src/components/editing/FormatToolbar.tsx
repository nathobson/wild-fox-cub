import { IconLink, IconList } from '../icons';

export type FormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'h2'
  | 'h3'
  | 'list'
  | 'link'
  | 'clear';

interface FormatToolbarProps {
  rect: DOMRect;
  onCommand: (command: FormatCommand) => void;
}

/** Floating glass format bar, fixed-positioned above the selection, clamped to the viewport. */
export function FormatToolbar({ rect, onCommand }: FormatToolbarProps) {
  const halfWidth = 168;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, halfWidth + 8),
    window.innerWidth - halfWidth - 8,
  );
  const above = rect.top > 120;
  const top = above ? rect.top - 10 : rect.bottom + 10;

  return (
    <div
      className={`fmt-toolbar ${above ? 'above' : 'below'}`}
      style={{ left, top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="fmt-btn fmt-b" title="Bold" onClick={() => onCommand('bold')}>B</button>
      <button className="fmt-btn fmt-i" title="Italic" onClick={() => onCommand('italic')}>I</button>
      <button className="fmt-btn fmt-u" title="Underline" onClick={() => onCommand('underline')}>U</button>
      <button className="fmt-btn fmt-s" title="Strikethrough" onClick={() => onCommand('strikeThrough')}>S</button>
      <span className="fmt-sep" />
      <button className="fmt-btn fmt-h" title="Heading 2" onClick={() => onCommand('h2')}>H2</button>
      <button className="fmt-btn fmt-h" title="Heading 3" onClick={() => onCommand('h3')}>H3</button>
      <button className="fmt-btn" title="Bullet list" onClick={() => onCommand('list')}>
        <IconList size={15} />
      </button>
      <span className="fmt-sep" />
      <button className="fmt-btn" title="Link" onClick={() => onCommand('link')}>
        <IconLink size={15} />
      </button>
      <button className="fmt-btn fmt-clear" title="Clear formatting" onClick={() => onCommand('clear')}>
        Tx
      </button>
    </div>
  );
}
