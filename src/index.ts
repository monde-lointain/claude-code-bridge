#!/usr/bin/env node

/**
 * Main Entry Point for Claude Code Bridge MCP Server
 */

import { configLoader } from './config/loader.js';
import { initLogger } from './services/logger.service.js';
import { createServer, startServer } from './server.js';

async function main(): Promise<void> {
  // Load configuration
  const config = configLoader.load();

  // Initialize logger
  const logger = initLogger(
    config.log_level,
    undefined, // No file logging for MCP server (use stderr)
    config.max_log_size_bytes
  );

  logger.info('Starting Claude Code Bridge MCP Server', {
    version: '0.1.0',
    allowed_roots: config.allowed_roots,
  });

  // Create and start server
  const server = await createServer(config);
  await startServer(server);

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.shutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
