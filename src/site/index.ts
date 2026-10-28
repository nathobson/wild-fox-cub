/*
 * The site layer: everything that makes this site look and behave the way it
 * does. The Fox Cub engine (editor, API, publishing) only talks to this file.
 *
 * Wild Fox Digital: a scrollytelling studio site. Blocks render complete,
 * readable HTML; the scroll engine in chrome.tsx and public/site.css add the motion.
 */
import { canvasBlock, type CanvasBlock } from './blocks/canvas';
import { closingBlock, type ClosingBlock } from './blocks/closing';
import { figuresBlock, type FiguresBlock } from './blocks/figures';
import { galleryBlock, type GalleryBlock } from './blocks/gallery';
import { projectHeroBlock, type ProjectHeroBlock } from './blocks/projectHero';
import { richTextBlock, type RichTextBlock } from './blocks/richText';
import { servicesBlock, type ServicesBlock } from './blocks/services';
import { showcaseBlock, type ShowcaseBlock } from './blocks/showcase';
import { stackBlock, type StackBlock } from './blocks/stack';
import { workBlock, type WorkBlock } from './blocks/work';

/** Every block this site offers, in block-picker order. */
export const BLOCKS = [
  canvasBlock,
  servicesBlock,
  workBlock,
  galleryBlock,
  closingBlock,
  projectHeroBlock,
  showcaseBlock,
  figuresBlock,
  stackBlock,
  richTextBlock,
];

export type Block =
  | CanvasBlock
  | ServicesBlock
  | WorkBlock
  | GalleryBlock
  | ClosingBlock
  | ProjectHeroBlock
  | ShowcaseBlock
  | FiguresBlock
  | StackBlock
  | RichTextBlock;

/** Block type for the first block of a newly created page. */
export const NEW_PAGE_BLOCK = 'projectHero';

export { NotFound, SiteFooter, SiteHeader, SITE_HEAD, SITE_SCRIPT } from './chrome';
export { seedSite } from './seed';
