import { resolve, isAbsolute } from 'path';

export function ensureAbsolute(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
