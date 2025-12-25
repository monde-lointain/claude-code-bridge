import { randomBytes } from 'node:crypto';

/**
 * Generate a unique task ID.
 * Format: task_<8 random hex chars>
 */
export function generateTaskId(): string {
  const random = randomBytes(4).toString('hex');
  return `task_${random}`;
}
