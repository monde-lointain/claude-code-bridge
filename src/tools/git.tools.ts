/**
 * Git Tools
 * Provides git observation tools for repository status and changes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { GitService } from '../services/git.service.js';
import type { TaskManager } from '../services/task-manager.js';
import type {
  GitStatusInput,
  GitStatusOutput,
  GitDiffStatInput,
  GitDiffStatOutput,
  GitDiffInput,
  GitDiffOutput,
} from '../types/tool.types.js';

// Input validation schemas
const GitStatusInputSchema = z.object({
  path: z.string().optional(),
});

const GitDiffStatInputSchema = z.object({
  path: z.string().optional(),
  cached: z.boolean().optional().default(false),
});

const GitDiffInputSchema = z.object({
  path: z.string().optional(),
  cached: z.boolean().optional().default(false),
});

// Tool definitions
export const gitTools: Tool[] = [
  {
    name: 'git_status',
    description: 'Get repository status including branch, staged files, modified files, and untracked files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repository path (defaults to active project)',
        },
      },
    },
  },
  {
    name: 'git_diff_stat',
    description: 'Get compact diff statistics showing files changed and lines added/removed.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repository path (defaults to active project)',
        },
        cached: {
          type: 'boolean',
          description: 'Show staged changes only (default: false)',
        },
      },
    },
  },
  {
    name: 'git_diff',
    description: 'Get full diff output. Large diffs are truncated to 50KB.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Repository path (defaults to active project)',
        },
        cached: {
          type: 'boolean',
          description: 'Show staged changes only (default: false)',
        },
      },
    },
  },
];

// Handler function
export interface GitToolContext {
  gitService: GitService;
  taskManager: TaskManager;
}

export async function handleGitTool(
  name: string,
  args: Record<string, unknown>,
  context: GitToolContext
): Promise<GitStatusOutput | GitDiffStatOutput | GitDiffOutput> {
  const { gitService, taskManager } = context;

  // Helper to resolve path using active project as fallback
  const resolvePath = (inputPath?: string): string => {
    if (inputPath) return inputPath;
    const activeProject = taskManager.getActiveProject();
    if (activeProject) return activeProject;
    throw new Error('No path specified and no active project set. Use set_active_project first.');
  };

  switch (name) {
    case 'git_status': {
      const validated = GitStatusInputSchema.parse(args) as GitStatusInput;
      const path = resolvePath(validated.path);
      return gitService.getStatus(path);
    }

    case 'git_diff_stat': {
      const validated = GitDiffStatInputSchema.parse(args) as GitDiffStatInput;
      const path = resolvePath(validated.path);
      const cached = validated.cached ?? false;
      return gitService.getDiffStat(path, cached);
    }

    case 'git_diff': {
      const validated = GitDiffInputSchema.parse(args) as GitDiffInput;
      const path = resolvePath(validated.path);
      const cached = validated.cached ?? false;
      return gitService.getDiff(path, cached);
    }

    default:
      throw new Error(`Unknown git tool: ${name}`);
  }
}
