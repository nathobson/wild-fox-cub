import {
  createElement,
  useEffect,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';

export type EditableTag = 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'p';

interface EditableTextProps {
  value: string;
  onChange: (text: string) => void;
  as?: EditableTag;
  className?: string;
  editable: boolean;
  multiline?: boolean;
  placeholder?: string;
  style?: CSSProperties;
}

// Loose createElement so a runtime tag name can be used without JSX union-type friction.
const create = createElement as (
  type: string,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
) => ReactElement;

/**
 * Plain-text contentEditable. React never manages its children — the DOM text
 * is synced through a ref, and only when the element is not focused, so the
 * caret never jumps while typing.
 */
export function EditableText({
  value,
  onChange,
  as = 'span',
  className,
  editable,
  multiline = false,
  placeholder,
  style,
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerText !== value) {
      el.innerText = value;
    }
    if (value === '' && document.activeElement !== el) {
      el.textContent = '';
    }
  }, [value, editable]);

  const read = (): string => {
    const el = ref.current;
    if (!el) return value;
    const text = el.innerText;
    return multiline ? text.replace(/\n{3,}/g, '\n\n') : text.replace(/\n+/g, ' ');
  };

  const handleInput = (_e: FormEvent<HTMLElement>) => {
    const text = read();
    if (text !== value) onChange(text);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handlePaste = (e: ReactClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, multiline ? text : text.replace(/\n+/g, ' '));
  };

  const handleBlur = () => {
    const el = ref.current;
    if (!el) return;
    const text = read();
    if (text !== value) onChange(text);
    if (text.trim() === '') el.textContent = '';
  };

  // Read-only (preview / live site): React owns the text so it can be server-rendered.
  // Distinct keys force a remount when toggling, so React never fights the DOM.
  if (!editable) {
    return create(
      as,
      { key: 'static', className: `et et-static${className ? ` ${className}` : ''}`, style },
      value,
    );
  }

  return create(as, {
    key: 'edit',
    ref: (el: unknown) => {
      ref.current = el as HTMLElement | null;
    },
    className: `et${className ? ` ${className}` : ''}`,
    contentEditable: editable,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-placeholder': editable ? placeholder : undefined,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    onBlur: handleBlur,
    style,
  });
}
