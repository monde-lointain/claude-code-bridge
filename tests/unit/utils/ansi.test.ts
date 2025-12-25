import { describe, it, expect } from 'vitest';
import { stripAnsi, hasAnsi } from '../../../src/utils/ansi.js';

describe('ANSI utilities', () => {
  describe('stripAnsi', () => {
    it('should remove color codes', () => {
      const colored = '\u001b[31mred text\u001b[0m';
      expect(stripAnsi(colored)).toBe('red text');
    });

    it('should remove bold/underline codes', () => {
      const styled = '\u001b[1mbold\u001b[0m \u001b[4munderline\u001b[0m';
      expect(stripAnsi(styled)).toBe('bold underline');
    });

    it('should remove cursor movement codes', () => {
      const withCursor = '\u001b[2A\u001b[3Ctext';
      expect(stripAnsi(withCursor)).toBe('text');
    });

    it('should handle text without ANSI codes', () => {
      const plain = 'plain text';
      expect(stripAnsi(plain)).toBe('plain text');
    });

    it('should handle mixed content', () => {
      const mixed = 'start \u001b[32mgreen\u001b[0m middle \u001b[34mblue\u001b[0m end';
      expect(stripAnsi(mixed)).toBe('start green middle blue end');
    });

    it('should handle empty string', () => {
      expect(stripAnsi('')).toBe('');
    });
  });

  describe('hasAnsi', () => {
    it('should detect ANSI codes', () => {
      expect(hasAnsi('\u001b[31mred\u001b[0m')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(hasAnsi('plain text')).toBe(false);
    });
  });
});
