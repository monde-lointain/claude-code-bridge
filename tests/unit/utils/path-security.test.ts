import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import { PathSecurity } from '../../../src/utils/path-security.js';
import { PathSecurityError } from '../../../src/types/errors.js';

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof os>('node:os');
  return {
    ...actual,
    homedir: vi.fn(() => '/home/testuser'),
  };
});

describe('PathSecurity', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/testuser');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should expand ~ in allowed roots', () => {
      const security = new PathSecurity(['~/projects']);
      expect(security.getAllowedRoots()).toEqual(['/home/testuser/projects']);
    });

    it('should resolve relative paths', () => {
      const security = new PathSecurity(['/tmp/../tmp/test']);
      expect(security.getAllowedRoots()).toEqual(['/tmp/test']);
    });
  });

  describe('validate', () => {
    it('should allow exact root match', () => {
      const security = new PathSecurity(['/tmp/allowed']);
      expect(security.validate('/tmp/allowed')).toBe('/tmp/allowed');
    });

    it('should allow subdirectory of root', () => {
      const security = new PathSecurity(['/tmp/allowed']);
      expect(security.validate('/tmp/allowed/subdir/file.txt')).toBe('/tmp/allowed/subdir/file.txt');
    });

    it('should expand ~ in input path', () => {
      const security = new PathSecurity(['/home/testuser/projects']);
      expect(security.validate('~/projects/myapp')).toBe('/home/testuser/projects/myapp');
    });

    it('should throw PathSecurityError for path outside allowed roots', () => {
      const security = new PathSecurity(['/tmp/allowed']);
      expect(() => security.validate('/etc/passwd')).toThrow(PathSecurityError);
    });

    it('should prevent path traversal attacks', () => {
      const security = new PathSecurity(['/tmp/allowed']);
      // Trying to escape via ../
      expect(() => security.validate('/tmp/allowed/../../../etc/passwd')).toThrow(PathSecurityError);
    });

    it('should prevent prefix attacks', () => {
      const security = new PathSecurity(['/tmp/allowed']);
      // /tmp/allowed-evil is NOT within /tmp/allowed
      expect(() => security.validate('/tmp/allowed-evil/file.txt')).toThrow(PathSecurityError);
    });

    it('should work with multiple allowed roots', () => {
      const security = new PathSecurity(['/tmp/root1', '/tmp/root2']);
      expect(security.validate('/tmp/root1/file.txt')).toBe('/tmp/root1/file.txt');
      expect(security.validate('/tmp/root2/file.txt')).toBe('/tmp/root2/file.txt');
      expect(() => security.validate('/tmp/root3/file.txt')).toThrow(PathSecurityError);
    });
  });
});
