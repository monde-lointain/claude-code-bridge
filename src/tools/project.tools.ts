import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TaskManager } from '../services/task-manager.js';
import { FilesystemService } from '../services/filesystem.service.js';
import type {
  SetActiveProjectInput,
  SetActiveProjectOutput,
  CreateDirectoryInput,
  CreateDirectoryOutput,
  WriteFileInput,
  WriteFileOutput,
  InitGitRepoInput,
  InitGitRepoOutput,
} from '../types/tool.types.js';

// Input validation schemas
const SetActiveProjectInputSchema = z.object({
  path: z.string().describe('Project directory path'),
});

const GetActiveProjectInputSchema = z.object({});

const CreateDirectoryInputSchema = z.object({
  path: z.string().describe('Directory path to create'),
});

const WriteFileInputSchema = z.object({
  path: z.string().describe('File path to write'),
  content: z.string().describe('Content to write'),
});

const InitGitRepoInputSchema = z.object({
  path: z.string().describe('Directory to initialize as git repo'),
});

// Tool definitions
export const projectTools: Tool[] = [
  {
    name: 'set_active_project',
    description: 'Set the default working directory for subsequent operations',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Project directory path',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_active_project',
    description: 'Get the current active project directory',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to create',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path to write',
        },
        content: {
          type: 'string',
          description: 'Content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'init_git_repo',
    description: 'Initialize a git repository',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory to initialize as git repo',
        },
      },
      required: ['path'],
    },
  },
];

// Tool handler
export async function handleProjectTool(
  toolName: string,
  args: unknown,
  taskManager: TaskManager,
  filesystemService: FilesystemService
): Promise<unknown> {
  switch (toolName) {
    case 'set_active_project': {
      const input = SetActiveProjectInputSchema.parse(args) as SetActiveProjectInput;
      const validPath = filesystemService.validatePath(input.path);
      taskManager.setActiveProject(validPath);
      const output: SetActiveProjectOutput = {
        message: 'Active project set. Subsequent operations will use this path by default.',
        path: validPath,
      };
      return output;
    }

    case 'get_active_project': {
      GetActiveProjectInputSchema.parse(args);
      const activePath = taskManager.getActiveProject();
      return {
        path: activePath,
        message: activePath
          ? `Active project: ${activePath}`
          : 'No active project set. Use set_active_project first.',
      };
    }

    case 'create_directory': {
      const input = CreateDirectoryInputSchema.parse(args) as CreateDirectoryInput;
      await filesystemService.createDirectory(input.path);
      const output: CreateDirectoryOutput = {
        message: 'Directory created successfully.',
        path: input.path,
      };
      return output;
    }

    case 'write_file': {
      const input = WriteFileInputSchema.parse(args) as WriteFileInput;
      const size = await filesystemService.writeFile(input.path, input.content);
      const output: WriteFileOutput = {
        message: 'File written successfully.',
        path: input.path,
        size,
      };
      return output;
    }

    case 'init_git_repo': {
      const input = InitGitRepoInputSchema.parse(args) as InitGitRepoInput;
      const initialized = await filesystemService.initGitRepo(input.path);
      const output: InitGitRepoOutput = {
        message: initialized
          ? 'Git repository initialized.'
          : 'Git repository already exists.',
        path: input.path,
      };
      return output;
    }

    default:
      throw new Error(`Unknown project tool: ${toolName}`);
  }
}
