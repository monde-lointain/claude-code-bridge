import { z } from 'zod';

export const StateSchema = z.object({
  last_task_id: z.string().optional(),
  last_task_time: z.string().datetime().optional(),
  last_task_status: z
    .enum(['pending', 'starting', 'running', 'completed', 'failed', 'timeout', 'killed'])
    .optional(),
});

export type State = z.infer<typeof StateSchema>;
