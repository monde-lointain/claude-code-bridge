import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config/schema.js';
import type { FilesystemService } from '../services/filesystem.service.js';
import type {
  ListFilesInput,
  ListFilesOutput,
  ReadFileInput,
  ReadFileOutput,
  ReadFileRangeInput,
  ReadFileRangeOutput,
  GetFileTreeInput,
  GetFileTreeOutput,
} from '../types/tool.types.js';

// Zod input schemas
const ListFilesInputSchema = z.object({
  path: z.string(),
});

const ReadFileInputSchema = z.object({
  path: z.string(),
  header_lines: z.number().int().positive().optional(),
});

const ReadFileRangeInputSchema = z.object({
  path: z.string(),
  start_line: z.number().int().positive(),
  end_line: z.number().int().positive(),
});

const GetFileTreeInputSchema = z.object({
  path: z.string(),
  depth: z.number().int().positive().max(10).optional(),
});

// Tool definitions
export const filesystemTools: Tool[] = [
  {
    name: 'list_files',
    description:
      'List files and directories at a path. Respects .gitignore and filters hidden files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory path',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read entire file contents. Cannot read binary files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path',
        },
        header_lines: {
          type: 'number',
          description:
            'Optional: number of header lines to read (for preview mode)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file_range',
    description:
      'Read specific lines from a file. Useful for examining portions of large files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path',
        },
        start_line: {
          type: 'number',
          description: 'Starting line number (1-indexed)',
          minimum: 1,
        },
        end_line: {
          type: 'number',
          description: 'Ending line number (inclusive)',
          minimum: 1,
        },
      },
      required: ['path', 'start_line', 'end_line'],
    },
  },
  {
    name: 'file_tree',
    description:
      'Get directory tree structure. Shows nested files and folders in tree format.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Directory path',
        },
        depth: {
          type: 'number',
          description: 'Tree depth (default: from config)',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['path'],
    },
  },
];

// Handler function
export async function handleFilesystemTool(
  name: string,
  args: unknown,
  filesystemService: FilesystemService,
  config: Config
): Promise<
  ListFilesOutput | ReadFileOutput | ReadFileRangeOutput | GetFileTreeOutput
> {
  switch (name) {
    case 'list_files': {
      const input = ListFilesInputSchema.parse(args) as ListFilesInput;
      return await filesystemService.listFiles(input.path);
    }

    case 'read_file': {
      const input = ReadFileInputSchema.parse(args) as ReadFileInput;
      return await filesystemService.readFile(input.path);
    }

    case 'read_file_range': {
      const input = ReadFileRangeInputSchema.parse(
        args
      ) as ReadFileRangeInput;
      return await filesystemService.readFileRange(
        input.path,
        input.start_line,
        input.end_line
      );
    }

    case 'file_tree': {
      const input = GetFileTreeInputSchema.parse(args) as GetFileTreeInput;
      const depth = input.depth ?? config.default_tree_depth;
      const tree = await filesystemService.getFileTree(input.path, depth);
      return {
        path: input.path,
        tree,
      };
    }

    default:
      throw new Error(`Unknown filesystem tool: ${name}`);
  }
}
