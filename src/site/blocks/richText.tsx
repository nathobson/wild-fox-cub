import { IconDoc } from '../../components/icons';
import { EditableHtml } from '../../components/editing/EditableHtml';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';

export interface RichTextBlock {
  id: string;
  type: 'richText';
  html: string;
}


function RichTextView({ block, editable, onUpdate }: BlockViewProps<RichTextBlock>) {
  return (
    <section className="site-section site-richtext">
      <div className="prose">
        <EditableHtml
          className="richtext-body"
          value={block.html}
          editable={editable}
          onChange={(html) => onUpdate({ html })}
        />
      </div>
    </section>
  );
}

/**
 * Strips inline formatting (bold/italic/spans/styles) from stored HTML while
 * keeping structure (headings, paragraphs, lists, links). Used by the
 * inspector's "Clear formatting" button.
 */
function clearRichTextFormatting(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('[style],[class],[align],[color],[face],[size]').forEach((el) => {
    el.removeAttribute('style');
    el.removeAttribute('class');
    el.removeAttribute('align');
    el.removeAttribute('color');
    el.removeAttribute('face');
    el.removeAttribute('size');
  });
  const inlineSelector = 'b,strong,i,em,u,s,strike,span,font,mark,sub,sup';
  let found = true;
  while (found) {
    found = false;
    for (const el of Array.from(doc.body.querySelectorAll(inlineSelector))) {
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      found = true;
    }
  }
  return doc.body.innerHTML;
}

function RichTextInspector({ block, onUpdate }: BlockInspectorProps<RichTextBlock>) {
  return (
    <>
      <div className="note-row">
        Use the floating toolbar while selecting text to make it bold, italic, a heading, a list
        or a link.
      </div>
      <button
        className="wide-btn"
        onClick={() => onUpdate({ html: clearRichTextFormatting(block.html) })}
      >
        Clear formatting
      </button>
    </>
  );
}

export const richTextBlock = defineBlock<RichTextBlock>({
  type: 'richText',
  label: 'Rich Text',
  description: 'Free-form article text with inline formatting',
  icon: IconDoc,
  create: () => ({
    type: 'richText',
    html: '<h2>Start writing</h2><p>Select any text to format it — make it <strong>bold</strong>, <em>italic</em>, a heading, a list, or a link.</p>',
  }),
  View: RichTextView,
  Inspector: RichTextInspector,
});
