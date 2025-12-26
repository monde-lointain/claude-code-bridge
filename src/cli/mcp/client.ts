import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { MCPClientOptions } from './types.js';

export class MCPClient {
  private client: Client;
  private serverProcess: ChildProcess | null = null;
  private connected = false;

  constructor(private options: MCPClientOptions = {}) {
    this.client = new Client(
      {
        name: 'ccb-cli',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(): Promise<void> {
    const serverPath = this.options.serverPath || this.findServerPath();

    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env },
    });

    if (!this.serverProcess.stdout || !this.serverProcess.stdin) {
      throw new Error('Failed to create server process stdio streams');
    }

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    await this.client.connect(transport);
    this.connected = true;
  }

  async callTool<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const result = await this.client.callTool({
      name,
      arguments: args,
    });

    const content = result.content as any[];
    if (content && content.length > 0) {
      const textContent = content.find((c: any) => c.type === 'text');
      if (textContent) {
        try {
          return JSON.parse(textContent.text) as T;
        } catch {
          return textContent.text as T;
        }
      }
    }

    return result as T;
  }

  async readResource(uri: string): Promise<string> {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const result = await this.client.readResource({ uri });

    const contents = result.contents as any[];
    if (contents && contents.length > 0) {
      const textContent = contents.find((c: any) => c.uri === uri);
      if (textContent && 'text' in textContent) {
        return textContent.text;
      }
    }

    return '';
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  private findServerPath(): string {
    const devPath = resolve(__dirname, '../../../dist/index.js');
    if (existsSync(devPath)) {
      return devPath;
    }

    try {
      return require.resolve('claude-code-bridge');
    } catch {
      throw new Error('Cannot find MCP server. Make sure claude-code-bridge is installed.');
    }
  }
}
