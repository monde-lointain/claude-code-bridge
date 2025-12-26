import { z } from 'zod';
export declare const StartTaskInputSchema: z.ZodObject<{
    prompt: z.ZodString;
    path: z.ZodString;
    timeout_seconds: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    prompt: string;
    timeout_seconds: number;
}, {
    path: string;
    prompt: string;
    timeout_seconds?: number | undefined;
}>;
export type StartTaskInput = z.infer<typeof StartTaskInputSchema>;
export interface StartTaskResult {
    task_id: string;
    status: string;
    path: string;
}
export declare const GetTaskStatusInputSchema: z.ZodObject<{
    task_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    task_id: string;
}, {
    task_id: string;
}>;
export type GetTaskStatusInput = z.infer<typeof GetTaskStatusInputSchema>;
export interface TaskStatusResult {
    task_id: string;
    status: 'pending' | 'starting' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';
    elapsed_seconds: number;
    exit_code: number | null;
    last_output?: string;
}
export declare const KillTaskInputSchema: z.ZodObject<{
    task_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    task_id: string;
}, {
    task_id: string;
}>;
export type KillTaskInput = z.infer<typeof KillTaskInputSchema>;
export interface TaskCompletedResult {
    task_id: string;
    elapsed_seconds: number;
    exit_code: number;
    files_modified?: number;
}
export interface TaskFailedResult {
    task_id: string;
    elapsed_seconds: number;
    exit_code: number;
    status: string;
}
export declare const ListFilesInputSchema: z.ZodObject<{
    path: z.ZodString;
    show_hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    show_hidden: boolean;
}, {
    path: string;
    show_hidden?: boolean | undefined;
}>;
export type ListFilesInput = z.infer<typeof ListFilesInputSchema>;
export interface FileEntry {
    name: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    mode?: number;
}
export interface FileListResult {
    path: string;
    entries: FileEntry[];
    total: number;
}
export declare const ReadFileInputSchema: z.ZodObject<{
    path: z.ZodString;
    start_line: z.ZodOptional<z.ZodNumber>;
    end_line: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    path: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
}, {
    path: string;
    start_line?: number | undefined;
    end_line?: number | undefined;
}>;
export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;
export interface FileContentResult {
    path: string;
    content: string;
    start_line: number;
    end_line: number;
    total_lines: number;
    is_binary: boolean;
}
export declare const GetDirectoryTreeInputSchema: z.ZodObject<{
    path: z.ZodString;
    max_depth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    max_depth: number;
}, {
    path: string;
    max_depth?: number | undefined;
}>;
export type GetDirectoryTreeInput = z.infer<typeof GetDirectoryTreeInputSchema>;
export interface TreeNode {
    name: string;
    type: 'file' | 'directory';
    children?: TreeNode[];
}
export interface FileTreeResult {
    path: string;
    tree: TreeNode;
}
export declare const GitStatusInputSchema: z.ZodObject<{
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
}, {
    path: string;
}>;
export type GitStatusInput = z.infer<typeof GitStatusInputSchema>;
export interface GitFileStatus {
    path: string;
    status: string;
}
export interface GitStatusResult {
    branch: string;
    ahead: number;
    behind: number;
    staged: GitFileStatus[];
    modified: GitFileStatus[];
    untracked: string[];
}
export declare const GitDiffInputSchema: z.ZodObject<{
    path: z.ZodString;
    staged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    stat_only: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    staged: boolean;
    stat_only: boolean;
}, {
    path: string;
    staged?: boolean | undefined;
    stat_only?: boolean | undefined;
}>;
export type GitDiffInput = z.infer<typeof GitDiffInputSchema>;
export interface GitDiffResult {
    diff: string;
    files_changed?: number;
    insertions?: number;
    deletions?: number;
}
export declare const SetDefaultProjectInputSchema: z.ZodObject<{
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
}, {
    path: string;
}>;
export type SetDefaultProjectInput = z.infer<typeof SetDefaultProjectInputSchema>;
export declare const InitProjectInputSchema: z.ZodObject<{
    path: z.ZodString;
    init_git: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    init_git: boolean;
}, {
    path: string;
    init_git?: boolean | undefined;
}>;
export type InitProjectInput = z.infer<typeof InitProjectInputSchema>;
//# sourceMappingURL=tool-types.d.ts.map