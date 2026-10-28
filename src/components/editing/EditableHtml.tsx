import { useEffect, useRef, useState } from 'react';
import { FormatToolbar, type FormatCommand } from './FormatToolbar';

/** The same rule the published site enforces: no javascript:, data: etc. links. */
const isSafeLink = (url: string) => {
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase())?.[1];
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme);
};

interface EditableHtmlProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  editable: boolean;
}

/**
 * Rich-text contentEditable that stores innerHTML. Same ref-guard pattern as
 * EditableText so React never clobbers the focused DOM. While focused, a
 * floating format toolbar tracks the current selection.
 */
export function EditableHtml({ value, onChange, className, editable }: EditableHtmlProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [selRect, setSelRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value, editable]);

  // Track the selection only while this field is focused.
  useEffect(() => {
    if (!focused || !editable) return;
    const onSelectionChange = () => {
      const el = ref.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelRect(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) {
        setSelRect(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelRect(null);
        return;
      }
      setSelRect(rect);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [focused, editable]);

  const commit = () => {
    const el = ref.current;
    if (el && el.innerHTML !== value) onChange(el.innerHTML);
  };

  const runCommand = (command: FormatCommand) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    switch (command) {
      case 'h2':
        document.execCommand('formatBlock', false, 'h2');
        break;
      case 'h3':
        document.execCommand('formatBlock', false, 'h3');
        break;
      case 'list':
        document.execCommand('insertUnorderedList');
        break;
      case 'link': {
        const url = window.prompt('Link URL', 'https://')?.trim();
        if (url && !isSafeLink(url)) window.alert('Links can be web addresses, email (mailto:) or phone (tel:) links.');
        else if (url) document.execCommand('createLink', false, url);
        break;
      }
      case 'clear':
        document.execCommand('removeFormat');
        document.execCommand('unlink');
        break;
      default:
        document.execCommand(command);
    }
    commit();
  };

  // Read-only (preview / live site): React owns the markup so it can be server-rendered.
  if (!editable) {
    return (
      <div
        key="static"
        className={`eh${className ? ` ${className}` : ''}`}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <>
      <div
        key="edit"
        ref={ref}
        className={`eh${className ? ` ${className}` : ''}`}
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={commit}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          commit();
          setFocused(false);
          setSelRect(null);
        }}
      />
      {editable && focused && selRect && <FormatToolbar rect={selRect} onCommand={runCommand} />}
    </>
  );
}
