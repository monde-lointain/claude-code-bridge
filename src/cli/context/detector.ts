import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { PROJECT_MARKERS } from './markers.js';

export interface ProjectContext {
  root: string;
  marker: string;
  source: 'flag' | 'auto' | 'config' | 'cwd';
}

export function detectProjectContext(
  flagPath?: string,
  configDefault?: string
): ProjectContext {
  if (flagPath) {
    return {
      root: resolve(flagPath),
      marker: 'explicit',
      source: 'flag',
    };
  }

  const cwd = process.cwd();
  let dir = cwd;

  while (true) {
    for (const marker of PROJECT_MARKERS) {
      const markerPath = join(dir, marker);
      if (existsSync(markerPath)) {
        return {
          root: dir,
          marker,
          source: 'auto',
        };
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (configDefault && existsSync(configDefault)) {
    return {
      root: resolve(configDefault),
      marker: 'config',
      source: 'config',
    };
  }

  return {
    root: cwd,
    marker: 'none',
    source: 'cwd',
  };
}
