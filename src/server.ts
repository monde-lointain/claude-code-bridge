/**
 * MCP Server Setup and Configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Config } from './config/schema.js';
import { TaskManager } from './services/task-manager.js';
import { FilesystemService } from './services/filesystem.service.js';
import { GitService } from './services/git.service.js';
import { allTools, handleToolCall, ToolHandlerContext } from './tools/index.js';
import { registerResources, handleResourceRead, ResourceContext } from './resources/index.js';
import { getLogger } from './services/logger.service.js';

export interface McpBridgeServer {
  server: Server;
  taskManager: TaskManager;
  filesystemService: FilesystemService;
  gitService: GitService;
  shutdown: () => Promise<void>;
}

export async function createServer(config: Config): Promise<McpBridgeServer> {
  const logger = getLogger();

  // Initialize services
  const taskManager = new TaskManager(config);
  const filesystemService = new FilesystemService(config);
  const gitService = new GitService(config);

  // Create MCP server
  const server = new Server(
    {
      name: 'claude-code-bridge',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Tool call: ${name}`, { args });

    const context: ToolHandlerContext = {
      taskManager,
      filesystemService,
      gitService,
      config,
    };

    try {
      const result = await handleToolCall(name, args ?? {}, context);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool error: ${name}`, { error: errorMessage });
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  });

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: registerResources(),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug(`Resource read: ${uri}`);

    const resourceContext: ResourceContext = {
      taskManager,
      config,
    };

    try {
      const content = await handleResourceRead(uri, resourceContext);
      return {
        contents: [{ uri, text: content, mimeType: 'application/json' }],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Resource error: ${uri}`, { error: errorMessage });
      throw error;
    }
  });

  // Shutdown handler
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await taskManager.shutdown();
    await server.close();
  };

  return {
    server,
    taskManager,
    filesystemService,
    gitService,
    shutdown,
  };
}

export async function startServer(bridge: McpBridgeServer): Promise<void> {
  const logger = getLogger();
  const transport = new StdioServerTransport();

  await bridge.server.connect(transport);
  logger.info('MCP server connected via stdio');
}
