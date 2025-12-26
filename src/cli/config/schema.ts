import { z } from 'zod';

export const CLIConfigSchema = z.object({
  default_project: z.string().optional(),
  output_format: z.enum(['human', 'json']).default('human'),
  color: z.boolean().default(true),
  follow_by_default: z.boolean().default(true),
  poll_interval_ms: z.number().default(5000),
  editor: z.string().optional(),
});

export type CLIConfig = z.infer<typeof CLIConfigSchema>;
