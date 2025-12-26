/**
 * Resource Registration and Routing
 */

import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { Config } from '../config/schema.js';
import { TaskManager } from '../services/task-manager.js';

export interface ResourceContext {
  taskManager: TaskManager;
  config: Config;
}

export function registerResources(): Resource[] {
  return [
    {
      uri: 'logs://{task_id}',
      name: 'Task Logs',
      description: 'Full log output for a completed or running task',
      mimeType: 'text/plain',
    },
    {
      uri: 'tasks://active',
      name: 'Active Tasks',
      description: 'List of currently running tasks',
      mimeType: 'application/json',
    },
    {
      uri: 'config://current',
      name: 'Current Configuration',
      description: 'Server configuration (read-only)',
      mimeType: 'application/json',
    },
  ];
}

export async function handleResourceRead(
  uri: string,
  context: ResourceContext
): Promise<string> {
  const { taskManager, config } = context;

  // Parse URI
  if (uri.startsWith('logs://')) {
    const taskId = uri.slice('logs://'.length);
    return handleLogsResource(taskId, taskManager);
  }

  if (uri === 'tasks://active') {
    return handleTasksResource(taskManager);
  }

  if (uri === 'config://current') {
    return handleConfigResource(config);
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

async function handleLogsResource(taskId: string, taskManager: TaskManager): Promise<string> {
  const task = taskManager.getTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const fs = await import('fs');

  try {
    const content = await fs.promises.readFile(task.logFile, 'utf-8');
    // Strip ANSI codes
    const { stripAnsi } = await import('../utils/ansi.js');
    return stripAnsi(content);
  } catch (error) {
    return `[Log file not available: ${task.logFile}]`;
  }
}

async function handleTasksResource(taskManager: TaskManager): Promise<string> {
  const activeTasks = taskManager.getActiveTasks();
  return JSON.stringify({ tasks: activeTasks }, null, 2);
}

async function handleConfigResource(config: Config): Promise<string> {
  // Return sanitized config (exclude any sensitive fields if present)
  const safeConfig = {
    allowed_roots: config.allowed_roots,
    default_timeout_seconds: config.default_timeout_seconds,
    max_log_size_bytes: config.max_log_size_bytes,
    task_history_size: config.task_history_size,
    default_tree_depth: config.default_tree_depth,
    max_diff_size_bytes: config.max_diff_size_bytes,
  };
  return JSON.stringify(safeConfig, null, 2);
}
