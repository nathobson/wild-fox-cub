import { BLOCKS, type Block } from '../site';
import type { BlockDefinition } from './blocks';

const byType = new Map<string, BlockDefinition<Block>>(
  BLOCKS.map((def) => [def.type, def as unknown as BlockDefinition<Block>]),
);

/** The definition for a block type, or undefined for types this site no longer has. */
export function blockDefinition(type: string): BlockDefinition<Block> | undefined {
  return byType.get(type);
}

/** All block types, in block-picker order. */
export const blockDefinitions = [...byType.values()];

/** A new block of `type` with fresh ids. */
export function createBlock(type: string): Block {
  const def = byType.get(type);
  if (!def) throw new Error(`Unknown block type "${type}"`);
  return { ...def.create(), id: crypto.randomUUID() } as Block;
}

/** Deep copy with fresh ids for the block and every item in its lists. */
export function cloneBlock(block: Block): Block {
  const reId = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reId);
    if (value && typeof value === 'object') {
      const copy: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(value)) copy[key] = reId(v);
      if (typeof copy.id === 'string') copy.id = crypto.randomUUID();
      return copy;
    }
    return value;
  };
  return reId(block) as Block;
}
