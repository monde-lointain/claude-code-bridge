import { z } from 'zod';

export const ConfigSchema = z.object({
  // Required: List of allowed root directories
  allowed_roots: z
    .array(z.string())
    .min(1, 'At least one allowed_root is required'),

  // Optional: Default timeout for tasks in seconds
  default_timeout_seconds: z
    .number()
    .int()
    .positive()
    .default(3600), // 60 minutes

  // Optional: Maximum log file size before rotation (bytes)
  max_log_size_bytes: z
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024), // 10MB

  // Optional: Number of tasks to keep in history
  task_history_size: z
    .number()
    .int()
    .positive()
    .default(20),

  // Optional: Default file tree depth
  default_tree_depth: z
    .number()
    .int()
    .positive()
    .max(10)
    .default(2),

  // Optional: Maximum diff output size (bytes)
  max_diff_size_bytes: z
    .number()
    .int()
    .positive()
    .default(50 * 1024), // 50KB

  // Optional: Default number of lines for file header reads
  default_header_lines: z
    .number()
    .int()
    .positive()
    .default(50),

  // Optional: Shell to use for PTY
  shell: z
    .string()
    .default('/bin/bash'),

  // Optional: Claude Code command
  claude_command: z
    .string()
    .default('claude'),

  // Optional: Patterns to auto-approve (expect-send)
  auto_approve_patterns: z
    .array(z.string())
    .default([
      'Do you want to proceed\\?',
      '\\[y/N\\]',
      '\\[Y/n\\]',
      'Continue\\?',
      'Approve\\?',
    ]),

  // Optional: Log level
  log_level: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;
