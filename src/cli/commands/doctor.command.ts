import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { MCPClient } from '../mcp/client.js';

interface Check {
  name: string;
  check: () => Promise<CheckResult> | CheckResult;
}

interface CheckResult {
  passed: boolean;
  message: string;
  hint?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose environment issues')
    .action(async () => {
      console.log(chalk.bold('Environment Check'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log('');

      const checks: Check[] = [
        {
          name: 'Node.js version',
          check: checkNodeVersion,
        },
        {
          name: 'MCP server package',
          check: checkMCPServer,
        },
        {
          name: 'Claude Code CLI',
          check: checkClaudeCodeCLI,
        },
        {
          name: 'Server configuration',
          check: checkServerConfig,
        },
        {
          name: 'CLI configuration',
          check: checkCLIConfig,
        },
        {
          name: 'allowed_roots configured',
          check: checkAllowedRoots,
        },
        {
          name: 'MCP server connection',
          check: checkMCPConnection,
        },
      ];

      let failCount = 0;

      for (const { name, check } of checks) {
        try {
          const result = await check();
          if (result.passed) {
            console.log(chalk.green('✓') + ` ${name}: ${result.message}`);
          } else {
            console.log(chalk.red('✗') + ` ${name}: ${result.message}`);
            if (result.hint) {
              console.log(chalk.dim('  ' + result.hint));
            }
            failCount++;
          }
        } catch (error: any) {
          console.log(chalk.red('✗') + ` ${name}: ${error.message}`);
          failCount++;
        }
      }

      console.log('');
      if (failCount === 0) {
        console.log(chalk.green.bold('All checks passed! CCB is ready to use.'));
      } else {
        console.log(
          chalk.red.bold(
            `${failCount} issue(s) found. Please resolve before using CCB.`
          )
        );
        process.exitCode = 1;
      }
    });
}

function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 20) {
    return { passed: true, message: `${version} (required: >=20.0.0)` };
  }
  return {
    passed: false,
    message: `${version} (required: >=20.0.0)`,
    hint: 'Upgrade Node.js to version 20 or later.',
  };
}

function checkMCPServer(): CheckResult {
  try {
    const serverPath = require.resolve('claude-code-bridge');
    return { passed: true, message: serverPath };
  } catch {
    return {
      passed: false,
      message: 'Not found',
      hint: 'Run: npm install -g claude-code-bridge',
    };
  }
}

function checkClaudeCodeCLI(): CheckResult {
  try {
    const output = execSync('which claude', { encoding: 'utf-8' }).trim();
    return { passed: true, message: output };
  } catch {
    return {
      passed: false,
      message: 'Not found',
      hint: 'Run: npm install -g @anthropic-ai/claude-code',
    };
  }
}

function checkServerConfig(): CheckResult {
  const configPath = join(homedir(), '.config', 'mcp-claude-bridge', 'config.json');
  if (existsSync(configPath)) {
    return { passed: true, message: configPath };
  }
  return {
    passed: false,
    message: 'Not found',
    hint: `Create config at ${configPath}`,
  };
}

function checkCLIConfig(): CheckResult {
  const configPath = join(homedir(), '.config', 'ccb', 'config.json');
  if (existsSync(configPath)) {
    return { passed: true, message: configPath };
  }
  return { passed: true, message: 'Using defaults (no custom config)' };
}

function checkAllowedRoots(): CheckResult {
  const configPath = join(homedir(), '.config', 'mcp-claude-bridge', 'config.json');
  if (!existsSync(configPath)) {
    return {
      passed: false,
      message: 'Config not found',
      hint: 'Create server config first.',
    };
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config.allowed_roots && config.allowed_roots.length > 0) {
      return { passed: true, message: `${config.allowed_roots.length} paths` };
    }
    return {
      passed: false,
      message: 'Not configured',
      hint: 'Add project directories to allowed_roots in your config.',
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Invalid config: ${error.message}`,
    };
  }
}

async function checkMCPConnection(): Promise<CheckResult> {
  const client = new MCPClient();

  try {
    await client.connect();
    await client.disconnect();
    return { passed: true, message: 'Connection successful' };
  } catch (error: any) {
    return {
      passed: false,
      message: `Connection failed: ${error.message}`,
      hint: 'Check that the MCP server can be spawned correctly.',
    };
  }
}
