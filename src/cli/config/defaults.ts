import { CLIConfig } from './schema.js';

export const DEFAULT_CLI_CONFIG: CLIConfig = {
  output_format: 'human',
  color: true,
  follow_by_default: true,
  poll_interval_ms: 5000,
};
