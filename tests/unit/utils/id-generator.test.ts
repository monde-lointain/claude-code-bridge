import { describe, it, expect } from 'vitest';
import { generateTaskId } from '../../../src/utils/id-generator.js';

describe('ID Generator', () => {
  describe('generateTaskId', () => {
    it('should generate ID with task_ prefix', () => {
      const id = generateTaskId();
      expect(id.startsWith('task_')).toBe(true);
    });

    it('should generate 8 hex characters after prefix', () => {
      const id = generateTaskId();
      const suffix = id.slice(5); // Remove 'task_'
      expect(suffix).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTaskId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
