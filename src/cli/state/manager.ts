import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { State, StateSchema } from './schema.js';

export class StateManager {
  private projectRoot: string | null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || null;
  }

  getStatePath(): string {
    if (this.projectRoot) {
      return join(this.projectRoot, '.ccb', 'state.json');
    }
    return join(homedir(), '.local', 'state', 'ccb', 'global.json');
  }

  load(): State {
    const path = this.getStatePath();

    if (!existsSync(path)) {
      return {};
    }

    try {
      const content = readFileSync(path, 'utf-8');
      return StateSchema.parse(JSON.parse(content));
    } catch {
      return {};
    }
  }

  save(state: Partial<State>): void {
    const path = this.getStatePath();
    const existing = this.load();
    const merged = { ...existing, ...state };

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(merged, null, 2));
  }

  setLastTask(taskId: string, status: State['last_task_status']): void {
    this.save({
      last_task_id: taskId,
      last_task_time: new Date().toISOString(),
      last_task_status: status,
    });
  }

  getLastTaskId(): string | undefined {
    return this.load().last_task_id;
  }
}
