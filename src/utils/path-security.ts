import * as path from 'node:path';
import * as os from 'node:os';
import { PathSecurityError } from '../types/errors.js';

export class PathSecurity {
  private allowedRoots: string[];

  constructor(allowedRoots: string[]) {
    // Normalize and expand paths
    this.allowedRoots = allowedRoots.map((root) => {
      const expanded = root.replace(/^~/, os.homedir());
      return path.resolve(expanded);
    });
  }

  /**
   * Validate that a path is within allowed roots.
   * Returns the normalized absolute path.
   * Throws PathSecurityError if path is outside allowed roots.
   */
  validate(inputPath: string): string {
    // Expand ~ and resolve to absolute path
    const expanded = inputPath.replace(/^~/, os.homedir());
    const absolute = path.resolve(expanded);

    // Check if path is within any allowed root
    const isAllowed = this.allowedRoots.some((root) => {
      return absolute === root || absolute.startsWith(root + path.sep);
    });

    if (!isAllowed) {
      throw new PathSecurityError(inputPath, this.allowedRoots);
    }

    return absolute;
  }

  /**
   * Get the list of allowed roots.
   */
  getAllowedRoots(): string[] {
    return [...this.allowedRoots];
  }
}
