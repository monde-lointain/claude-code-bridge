import { describe, it, expect } from 'vitest';
import { isBinaryFile, isBinaryExtension } from '../../../src/utils/binary-detector.js';

describe('Binary detector', () => {
  describe('isBinaryFile', () => {
    it('should detect binary content with null bytes', () => {
      const binaryBuffer = Buffer.from([0x48, 0x65, 0x6c, 0x00, 0x6f]); // "Hel\0o"
      expect(isBinaryFile(binaryBuffer)).toBe(true);
    });

    it('should pass text content', () => {
      const textBuffer = Buffer.from('Hello, world!', 'utf-8');
      expect(isBinaryFile(textBuffer)).toBe(false);
    });

    it('should pass UTF-8 content', () => {
      const utf8Buffer = Buffer.from('こんにちは世界', 'utf-8');
      expect(isBinaryFile(utf8Buffer)).toBe(false);
    });

    it('should check only first 8KB', () => {
      // Create buffer with null byte after 8KB
      const buffer = Buffer.alloc(10000, 0x61); // 'a' repeated
      buffer[9000] = 0; // null byte after 8KB
      expect(isBinaryFile(buffer)).toBe(false);
    });

    it('should detect null byte within first 8KB', () => {
      const buffer = Buffer.alloc(10000, 0x61);
      buffer[1000] = 0; // null byte within first 8KB
      expect(isBinaryFile(buffer)).toBe(true);
    });

    it('should handle empty buffer', () => {
      expect(isBinaryFile(Buffer.alloc(0))).toBe(false);
    });
  });

  describe('isBinaryExtension', () => {
    it('should detect image extensions', () => {
      expect(isBinaryExtension('photo.png')).toBe(true);
      expect(isBinaryExtension('image.jpg')).toBe(true);
      expect(isBinaryExtension('icon.gif')).toBe(true);
    });

    it('should detect archive extensions', () => {
      expect(isBinaryExtension('archive.zip')).toBe(true);
      expect(isBinaryExtension('file.tar.gz')).toBe(true);
    });

    it('should pass text file extensions', () => {
      expect(isBinaryExtension('file.txt')).toBe(false);
      expect(isBinaryExtension('code.ts')).toBe(false);
      expect(isBinaryExtension('readme.md')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isBinaryExtension('IMAGE.PNG')).toBe(true);
      expect(isBinaryExtension('File.PDF')).toBe(true);
    });
  });
});
