import { z } from 'zod';
// Task Tool Types
export const StartTaskInputSchema = z.object({
    prompt: z.string(),
    path: z.string(),
    timeout_seconds: z.number().optional().default(3600),
});
export const GetTaskStatusInputSchema = z.object({
    task_id: z.string(),
});
export const KillTaskInputSchema = z.object({
    task_id: z.string(),
});
// Filesystem Tool Types
export const ListFilesInputSchema = z.object({
    path: z.string(),
    show_hidden: z.boolean().optional().default(false),
});
export const ReadFileInputSchema = z.object({
    path: z.string(),
    start_line: z.number().optional(),
    end_line: z.number().optional(),
});
export const GetDirectoryTreeInputSchema = z.object({
    path: z.string(),
    max_depth: z.number().optional().default(3),
});
// Git Tool Types
export const GitStatusInputSchema = z.object({
    path: z.string(),
});
export const GitDiffInputSchema = z.object({
    path: z.string(),
    staged: z.boolean().optional().default(false),
    stat_only: z.boolean().optional().default(false),
});
// Project Tool Types
export const SetDefaultProjectInputSchema = z.object({
    path: z.string(),
});
export const InitProjectInputSchema = z.object({
    path: z.string(),
    init_git: z.boolean().optional().default(false),
});
//# sourceMappingURL=tool-types.js.map