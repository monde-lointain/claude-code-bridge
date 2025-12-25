import { McpBridgeError } from '../types/errors.js';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function handleError(error: unknown): ErrorResponse {
  // Note: Logger will be wired up later - for now just use console.error

  if (error instanceof McpBridgeError) {
    console.error(`[error] MCP Bridge Error: ${error.code} - ${error.message}`);
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    console.error(`[error] Unexpected error: ${error.message}`, error.stack);
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }

  console.error('[error] Unknown error type', error);
  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    },
  };
}
