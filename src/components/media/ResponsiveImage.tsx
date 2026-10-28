import { useContext, type CSSProperties } from 'react';
import { originalUrl, VARIANT_FORMATS, variantUrl } from '../../lib/media';
import { ImageLoadingContext, MediaContext } from './context';

interface ResponsiveImageProps {
  mediaId?: string | null;
  /** External URL when there is no mediaId. */
  src?: string;
  alt: string;
  /** The `sizes` attribute: how wide the image displays (see sizesFor). */
  sizes: string;
  /** Never visible when the page loads (e.g. later carousel slides): always lazy. */
  offscreen?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Uploaded images render as <picture> with AVIF and WebP sources plus a JPEG/PNG
 * fallback, each with a full srcset. Width and height prevent layout shift.
 *
 * The image's own width is exposed as --natural-width, so site CSS can stop small
 * images being stretched: max-width: min(100%, var(--natural-width)).
 */
export function ResponsiveImage({ mediaId, src, alt, sizes, offscreen = false, className, style }: ResponsiveImageProps) {
  const item = useContext(MediaContext).get(mediaId ?? '');
  const { eager, highPriority } = useContext(ImageLoadingContext);
  const loading = eager && !offscreen ? 'eager' : 'lazy';
  const fetchPriority = loading === 'eager' && highPriority ? 'high' : undefined;

  if (!item) {
    return src ? (
      <img className={className} style={style} src={src} alt={alt} loading={loading} decoding="async" draggable={false} />
    ) : null;
  }

  const common = {
    className,
    style: { '--natural-width': `${item.width}px`, ...style } as CSSProperties,
    alt: alt || item.alt,
    width: item.width,
    height: item.height,
    loading,
    fetchPriority,
    decoding: 'async',
    draggable: false,
  } as const;

  if (item.widths.length === 0) return <img {...common} src={originalUrl(item)} />;

  const srcSet = (ext: string) => item.widths.map((w) => `${variantUrl(item.id, w, ext)} ${w}w`).join(', ');
  // Default src for very old browsers: the size closest to 1200px.
  const fallbackWidth = item.widths.reduce((best, w) => (Math.abs(w - 1200) < Math.abs(best - 1200) ? w : best));

  return (
    <picture>
      {VARIANT_FORMATS.map((ext) => (
        <source key={ext} type={`image/${ext}`} srcSet={srcSet(ext)} sizes={sizes} />
      ))}
      <img {...common} src={variantUrl(item.id, fallbackWidth, item.fallback)} srcSet={srcSet(item.fallback)} sizes={sizes} />
    </picture>
  );
}
