import type { CSSProperties } from 'react';
import { EditableText, type EditableTag } from '../components/editing/EditableText';
import { ResponsiveImage } from '../components/media/ResponsiveImage';
import { MediaField } from '../components/ui/MediaField';
import { GlassInput, Row, Segmented } from '../components/ui/controls';

/*
 * Pieces shared by Wild Fox blocks: images that can be an upload or a plain URL,
 * line-by-line headings, and the light/dark tone every section has.
 *
 * Motion is progressive: blocks render complete, readable markup. The site script
 * (chrome.tsx) adds scroll progress (--p, --pin) and reveal classes on the live
 * site only, and site.css hides things before they reveal only when it runs.
 */

/** An image: an upload from the media library, or a URL (e.g. /images/fern.webp). */
export interface Pic {
  mediaId?: string | null;
  src: string;
  alt: string;
}

export type Tone = 'dark' | 'light';

export const newId = () => crypto.randomUUID();

export function Picture({ pic, sizes = '100vw', className, style }: { pic: Pic; sizes?: string; className?: string; style?: CSSProperties }) {
  return <ResponsiveImage mediaId={pic.mediaId} src={pic.src} alt={pic.alt} sizes={sizes} className={className} style={style} />;
}

/** Inspector control for a Pic: choose an upload, or type a URL, plus alt text. */
export function PicField({ label = 'Image', pic, onChange }: { label?: string; pic: Pic; onChange: (pic: Pic) => void }) {
  return (
    <>
      <Row label={label}>
        <MediaField
          mediaId={pic.mediaId}
          onChange={(item) => onChange({ ...pic, mediaId: item.id, alt: pic.alt || item.alt })}
          onClear={() => onChange({ ...pic, mediaId: null })}
        />
      </Row>
      {!pic.mediaId && (
        <Row label="Image URL">
          <GlassInput value={pic.src} placeholder="/images/… or https://…" onChange={(src) => onChange({ ...pic, src })} />
        </Row>
      )}
      <Row label="Alt text">
        <GlassInput value={pic.alt} placeholder="Describe the image" onChange={(alt) => onChange({ ...pic, alt })} />
      </Row>
    </>
  );
}

export function ToneField({ value, onChange }: { value: Tone; onChange: (tone: Tone) => void }) {
  return (
    <Row label="Tone">
      <Segmented
        value={value}
        onChange={onChange}
        options={[
          { value: 'dark' as const, label: 'Dark' },
          { value: 'light' as const, label: 'Light' },
        ]}
      />
    </Row>
  );
}

export function AnchorField({ value, onChange }: { value?: string; onChange: (anchor: string) => void }) {
  return (
    <Row label="Anchor">
      <GlassInput value={value ?? ''} placeholder="e.g. work, for /#work links" onChange={onChange} />
    </Row>
  );
}

/** `id` attribute from an anchor field ("#Work " → "work"). */
export const anchorId = (anchor?: string) => anchor?.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-') || undefined;

interface LinesProps {
  as?: EditableTag;
  className?: string;
  value: string;
  editable: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

/**
 * Text written line by line (Enter starts a new line). On the live site each line
 * is a mask (`.line`) and each word inside it (`.w`, numbered by --i) rises out of
 * it when the line reaches the reading line. In the editor it's one editable field.
 */
export function Lines({ as = 'h2', className, value, editable, placeholder, onChange }: LinesProps) {
  if (editable) {
    return <EditableText as={as} className={className} value={value} editable multiline placeholder={placeholder} onChange={onChange} />;
  }
  if (!value) return null;
  const Tag = as as 'h2';
  let word = 0;
  return (
    <Tag className={className}>
      {value.split('\n').map((line, i) => (
        <span className="line" key={i} style={{ '--l': i } as CSSProperties}>
          {line.split(/(\s+)/).map((part, j) =>
            /^\s+$/.test(part) || !part ? (
              part
            ) : (
              <span className="w" key={j} style={{ '--i': word++ } as CSSProperties}>
                {part}
              </span>
            ),
          )}
        </span>
      ))}
    </Tag>
  );
}

/** A small sentence-case label. */
export function Label({ value, editable, onChange, className = '' }: { value: string; editable: boolean; onChange: (v: string) => void; className?: string }) {
  if (!editable && !value) return null;
  return <EditableText as="p" className={`label ${className}`} value={value} editable={editable} placeholder="Label" onChange={onChange} />;
}

/** Plain text field for list items edited in the inspector. */
export function TextRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Row label={label}>
      <GlassInput value={value} placeholder={placeholder} onChange={onChange} />
    </Row>
  );
}

/** Updates one item of a list field by id. */
export const patchItem = <T extends { id: string }>(items: T[], id: string, patch: Partial<T>) =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

export function Arrow() {
  return (
    <svg className="arrow" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
      <path d="M0 5h16M12 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** Comma-separated tags: one field in the editor, a quiet "a · b · c" line on the live site. */
export function Tags({ value, editable, onChange }: { value: string; editable: boolean; onChange: (v: string) => void }) {
  if (editable) return <EditableText as="p" className="wf-tags" value={value} editable placeholder="Tag, tag, tag" onChange={onChange} />;
  const tags = value.split(',').map((t) => t.trim()).filter(Boolean);
  if (tags.length === 0) return null;
  return <p className="wf-tags">{tags.join('  ·  ')}</p>;
}
