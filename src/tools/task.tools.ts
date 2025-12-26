import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TaskManager, generateHint } from '../services/task-manager.js';
import {
  StartTaskInput,
  StartTaskOutput,
  GetTaskStatusInput,
  GetTaskStatusOutput,
  KillTaskInput,
  KillTaskOutput,
} from '../types/task.types.js';

// Zod validation schemas
const startTaskSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  path: z.string().min(1, 'Path is required'),
  timeout_seconds: z.number().int().min(60).max(14400).optional(),
  permission_mode: z.enum(['auto', 'cautious']).optional(),
});

const getTaskStatusSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
});

const killTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
});

// Tool definitions
export const taskTools: Tool[] = [
  {
    name: 'start_task',
    description: 'Start a Claude Code task asynchronously',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Claude Code',
        },
        path: {
          type: 'string',
          description: 'Project directory path (must be within allowed_roots)',
        },
        timeout_seconds: {
          type: 'integer',
          description: 'Task timeout in seconds (default: 3600)',
          minimum: 60,
          maximum: 14400,
        },
        permission_mode: {
          type: 'string',
          enum: ['auto', 'cautious'],
          description: 'How to handle approval prompts (default: auto)',
        },
      },
      required: ['prompt', 'path'],
    },
  },
  {
    name: 'get_task_status',
    description: 'Get the current status of a task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID returned by start_task',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'kill_task',
    description: 'Terminate a running task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to terminate',
        },
      },
      required: ['task_id'],
    },
  },
];

// Tool handler
export async function handleTaskTool(
  toolName: string,
  args: unknown,
  taskManager: TaskManager
): Promise<StartTaskOutput | GetTaskStatusOutput | KillTaskOutput> {
  switch (toolName) {
    case 'start_task':
      return handleStartTask(args, taskManager);
    case 'get_task_status':
      return handleGetTaskStatus(args, taskManager);
    case 'kill_task':
      return handleKillTask(args, taskManager);
    default:
      throw new Error(`Unknown task tool: ${toolName}`);
  }
}

async function handleStartTask(
  args: unknown,
  taskManager: TaskManager
): Promise<StartTaskOutput> {
  const input = startTaskSchema.parse(args) as StartTaskInput;

  const task = await taskManager.startTask(input);

  return {
    task_id: task.id,
    status: task.status,
    message:
      'Task started. Claude Code is processing your request. Use get_task_status to check progress.',
  };
}

async function handleGetTaskStatus(
  args: unknown,
  taskManager: TaskManager
): Promise<GetTaskStatusOutput> {
  const input = getTaskStatusSchema.parse(args) as GetTaskStatusInput;

  const task = taskManager.getTask(input.task_id);
  if (!task) {
    throw new Error(`Task not found: ${input.task_id}`);
  }

  const summary = taskManager.getTaskStatus(input.task_id);
  if (!summary) {
    throw new Error(`Task status unavailable: ${input.task_id}`);
  }

  const hint = generateHint(task);

  return {
    task_id: task.id,
    status: task.status,
    elapsed_seconds: summary.elapsedSeconds,
    exit_code: task.exitCode,
    last_output: summary.lastOutput,
    hint,
  };
}

async function handleKillTask(
  args: unknown,
  taskManager: TaskManager
): Promise<KillTaskOutput> {
  const input = killTaskSchema.parse(args) as KillTaskInput;

  const task = taskManager.getTask(input.task_id);
  if (!task) {
    return {
      task_id: input.task_id,
      status: 'error',
      message: `Task not found: ${input.task_id}`,
    };
  }

  if (task.status !== 'running' && task.status !== 'starting') {
    return {
      task_id: input.task_id,
      status: task.status,
      message: `Task is not running (current status: ${task.status})`,
    };
  }

  const killed = await taskManager.killTask(input.task_id);

  if (killed) {
    return {
      task_id: input.task_id,
      status: 'killed',
      message: 'Task terminated successfully.',
    };
  } else {
    return {
      task_id: input.task_id,
      status: task.status,
      message: 'Failed to terminate task.',
    };
  }
}
