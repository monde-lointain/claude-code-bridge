import * as fs from 'node:fs';
import * as path from 'node:path';
import ignoreFactory from 'ignore';
import type { Ignore } from 'ignore';

export class GitignoreParser {
  private ig: Ignore;
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.ig = ignoreFactory.default();

    // Add default ignores
    this.ig.add([
      'node_modules',
      '.git',
      '.DS_Store',
      '*.log',
      'dist',
      'build',
      'coverage',
    ]);

    // Load .gitignore if present
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        this.ig.add(content);
      } catch {
        // Ignore read errors
      }
    }
  }

  /**
   * Check if a path should be ignored.
   */
  isIgnored(fullPath: string): boolean {
    // Get relative path from root
    const relativePath = path.relative(this.rootPath, fullPath);
    if (!relativePath || relativePath.startsWith('..')) {
      return false;
    }

    return this.ig.ignores(relativePath);
  }
}
