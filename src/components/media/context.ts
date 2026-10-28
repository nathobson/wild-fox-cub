import { createContext } from 'react';
import type { MediaItem } from '../../lib/media';

/** The media library, so blocks can turn a mediaId into image files. */
export const MediaContext = createContext<ReadonlyMap<string, MediaItem>>(new Map());

/**
 * How images in the block being rendered load. Images are lazy unless the block is
 * marked otherwise (its "Lazy load images" switch); the first such block also gets
 * high fetch priority, since it's usually the largest thing above the fold.
 */
export const ImageLoadingContext = createContext<{ eager: boolean; highPriority: boolean }>({
  eager: false,
  highPriority: false,
});

/** Opens the editor's image picker. Absent when rendering the published site. */
export const MediaPickerContext = createContext<(() => Promise<MediaItem | null>) | null>(null);
