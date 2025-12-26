/**
 * Tool Registry
 * Aggregates all tool definitions and routes tool calls to appropriate handlers
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { taskTools, handleTaskTool } from './task.tools.js';
import { filesystemTools, handleFilesystemTool } from './filesystem.tools.js';
import { projectTools, handleProjectTool } from './project.tools.js';
import { gitTools, handleGitTool, GitToolContext } from './git.tools.js';
import type { TaskManager } from '../services/task-manager.js';
import type { FilesystemService } from '../services/filesystem.service.js';
import type { GitService } from '../services/git.service.js';
import type { Config } from '../config/schema.js';

// Combined tool definitions
export const allTools: Tool[] = [
  ...taskTools,
  ...filesystemTools,
  ...projectTools,
  ...gitTools,
];

// Context interface for tool handlers
export interface ToolHandlerContext {
  taskManager: TaskManager;
  filesystemService: FilesystemService;
  gitService: GitService;
  config: Config;
}

// Route tool calls to appropriate handler
export async function handleToolCall(
  toolName: string,
  args: unknown,
  context: ToolHandlerContext
): Promise<unknown> {
  const { taskManager, filesystemService, gitService, config } = context;

  // Task tools
  if (taskTools.some((t) => t.name === toolName)) {
    return handleTaskTool(toolName, args, taskManager);
  }

  // Filesystem tools
  if (filesystemTools.some((t) => t.name === toolName)) {
    return handleFilesystemTool(toolName, args, filesystemService, config);
  }

  // Project tools
  if (projectTools.some((t) => t.name === toolName)) {
    return handleProjectTool(toolName, args, taskManager, filesystemService);
  }

  // Git tools
  if (gitTools.some((t) => t.name === toolName)) {
    const gitContext: GitToolContext = { gitService, taskManager };
    return handleGitTool(toolName, args as Record<string, unknown>, gitContext);
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
