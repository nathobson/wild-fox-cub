import type { ComponentType } from 'react';
import type { Page } from '../types';

/*
 * The contract between the Fox Cub engine and a site's blocks.
 *
 * Every block type is one module in src/site/blocks/ that calls defineBlock().
 * The engine never knows about specific blocks: the editor canvas, inspector,
 * block picker and published renderer all go through these definitions.
 */

export interface BlockBase {
  id: string;
  type: string;
  /** For blocks with images: false loads them straight away (for above the fold). Default true. */
  lazyLoad?: boolean;
}

/** The editor canvas (editable) and the editor's Preview mode (read-only). */
export interface BlockViewProps<T> {
  block: T;
  editable: boolean;
  onUpdate: (patch: Partial<T>) => void;
}

/** Settings shown in the inspector panel when the block is selected. */
export interface BlockInspectorProps<T> {
  block: T;
  onUpdate: (patch: Partial<T>) => void;
}

/** Rendering for the published site, to static HTML at publish time. */
export interface BlockStaticProps<T> {
  block: T;
  page: Page;
  /** Position on the page; 0 is the first block (above the fold). */
  index: number;
}

export interface BlockDefinition<T extends BlockBase = BlockBase> {
  type: T['type'];
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Default content for a newly added block (the engine adds the id). */
  create: () => Omit<T, 'id'>;
  View: ComponentType<BlockViewProps<T>>;
  Inspector?: ComponentType<BlockInspectorProps<T>>;
  /** Published HTML. Defaults to View with editable=false. Must work without JS. */
  Static?: ComponentType<BlockStaticProps<T>>;
  /** Shows images: the inspector adds a "Lazy load images" switch. */
  images?: boolean;
  /** Vanilla JS inlined once on published pages that contain this block. */
  script?: string;
}

/** Identity helper that gives each block module full type inference. */
export function defineBlock<T extends BlockBase>(definition: BlockDefinition<T>): BlockDefinition<T> {
  return definition;
}
