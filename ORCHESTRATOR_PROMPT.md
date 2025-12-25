# Claude Code Bridge - Agent Swarm Orchestrator

You are the orchestrator for implementing the claude-code-bridge MCP server. Your role is to:

1. Read TODO.md to understand all tasks
2. Spawn sub-agents to complete tasks in parallel where possible
3. Track progress by updating TODO.md as tasks complete
4. Ensure all acceptance criteria are met before marking tasks complete
5. Run tests after each phase to catch issues early

## Rules

1. **Never skip tests** - Every code task must have passing tests before moving on
2. **Update TODO.md** - After completing each task, mark it [x] and add completion notes
3. **Respect dependencies** - Never start a task whose dependencies aren't complete
4. **Parallelize wisely** - Spawn up to 3 sub-agents for independent tasks
5. **Verify before proceeding** - Run `npm run typecheck` and `npm test` between phases

## Sub-Agent Spawn Format

When spawning a sub-agent, use this format:
```
@agent-google-engineer-clean-code Task P1-001: Project Initialization

Context: You are implementing the claude-code-bridge MCP server. 
Reference: SPECIFICATION.md (Section 17.1 for package.json, 17.2 for tsconfig.json)

Your task:
[Specific instructions for this task]

Acceptance Criteria:
[Copy from TODO.md]

When complete:
1. Verify all acceptance criteria are met
2. Run any relevant tests
3. Report completion status
```

## Execution Flow

### Phase 1: Foundation
1. Complete P1-001 (Project Initialization) - BLOCKING, must be first
2. After P1-001, spawn parallel agents for:
   - P1-002: Directory Structure
   - P1-003: Configuration Schema
   - P1-004: Core Utilities (can start once directory structure exists)

### Phase 2: Services
[Continue pattern...]

## Current Status

Read TODO.md and begin execution from the first incomplete task.
```

---

## Step 5: Launch the Orchestrator

Start Claude Code and provide this master prompt:
```
I want you to act as an orchestrator to implement the claude-code-bridge MCP server.

Read these files in order:
1. SPECIFICATION.md - The complete technical specification
2. TODO.md - The task breakdown
3. ORCHESTRATOR_PROMPT.md - Your execution instructions

Then begin implementation following these rules:

1. Start with Phase 1, Task P1-001 (Project Initialization)
2. After each task completion:
   - Update TODO.md to mark the task complete
   - Run `npm run typecheck` to verify no TypeScript errors
   - Run `npm test` if tests exist for that component
   - Commit changes with message: "Complete [TASK-ID]: [Task Name]"

3. When you encounter tasks that can be parallelized, tell me and I will help spawn additional agents. For now, execute sequentially.

4. If you hit a blocker or need clarification, stop and ask rather than guessing.

5. After completing each phase, provide a status report:
   - Tasks completed
   - Tests passing/failing
   - Any issues encountered
   - Ready to proceed to next phase? (Y/N)

Begin now with Phase 1.
```

---

## Step 6: Phase-by-Phase Execution Prompts

As Claude Code completes each phase, use these follow-up prompts:

### After Phase 1 (Foundation)
```
Phase 1 Status Check:

1. Run: `npm run typecheck` - Report results
2. Run: `npm test` - Report results (may be minimal at this stage)
3. Verify these files exist and are correct:
   - package.json (matches spec Section 17.1)
   - tsconfig.json (matches spec Section 17.2)
   - vitest.config.ts (matches spec Section 17.3)
   - src/config/schema.ts (Zod schema complete)
   - src/config/loader.ts (loads config correctly)
   - All utility files in src/utils/

4. Update TODO.md with completion status

If all checks pass, proceed to Phase 2: Services.
```

### After Phase 2 (Services)
```
Phase 2 Status Check:

1. Run: `npm test` - All service tests should pass
2. Verify these services are fully implemented:
   - LoggerService (with rotation)
   - FilesystemService (all methods)
   - GitService (all methods)
   - PtyManager (with mock for tests)
   - TaskManager (full lifecycle)

3. Run manual verification:
   - Create a test directory in /tmp
   - Test FilesystemService.listFiles()
   - Test GitService.getStatus() on this repo

4. Update TODO.md

If all checks pass, proceed to Phase 3: PTY & Tasks.
```

### After Phase 3 (PTY & Tasks)
```
Phase 3 Status Check:

1. Run: `npm test` - Focus on task-manager.test.ts and pty-manager.test.ts
2. Verify MockPty works correctly for all test scenarios
3. Test the expect-send auto-approval logic with mock prompts
4. Verify timeout enforcement works

Update TODO.md and proceed to Phase 4: MCP Integration.
```

### After Phase 4 (MCP Integration)
```
Phase 4 Status Check:

1. Run: `npm test` - All tests should pass
2. Run: `npm run build` - Should compile without errors
3. Test MCP server manually:
```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```
4. Verify all 14 tools are registered
5. Verify all 3 resources are registered

Update TODO.md and proceed to Phase 5: Polish.
```

### After Phase 5 (Polish)
```
Phase 5 Final Verification:

1. Run full test suite: `npm test`
2. Run coverage: `npm run test:coverage` - Target >80%
3. Run linter: `npm run lint` - No errors
4. Build: `npm run build` - Clean compile
5. Test end-to-end (manual):
   - Start server
   - Call set_active_project
   - Call list_files
   - Call git_status
   - Start a simple task (if Claude Code is available)

6. Verify README.md is complete and accurate
7. Final TODO.md update - all tasks should be [x]

Report final status.
```

---

## Step 7: Handling Parallel Agents (Advanced)

If you want true parallelization, you can open multiple Claude Code sessions. Here's how:

### Terminal 1 - Orchestrator
```
You are the ORCHESTRATOR. Your job is to:
1. Track overall progress in TODO.md
2. Assign tasks to other agents (I'll relay messages)
3. Integrate completed work
4. Run tests and verify

Current status: [Read TODO.md]
Next parallelizable tasks: [List them]
```

### Terminal 2 - Agent A
```
You are AGENT-A working on claude-code-bridge.

Your assigned tasks:
- P2-001: Logger Service
- P2-002: Logger Service Tests

Reference: SPECIFICATION.md Section 12

Work in: src/services/logger.service.ts and tests/unit/services/logger.service.test.ts

When complete, say "AGENT-A COMPLETE: [task IDs]"
```

### Terminal 3 - Agent B
```
You are AGENT-B working on claude-code-bridge.

Your assigned tasks:
- P2-003: Filesystem Service
- P2-004: Filesystem Service Tests

Reference: SPECIFICATION.md Section 10

Work in: src/services/filesystem.service.ts and tests/unit/services/filesystem.service.test.ts

When complete, say "AGENT-B COMPLETE: [task IDs]"
```

Then relay completion messages to the orchestrator to update TODO.md and handle any merge conflicts.

---

## Step 8: Troubleshooting Prompts

### If Tests Fail
```
Tests are failing. Please:

1. Read the test output carefully
2. Identify which specific test(s) failed
3. Read the corresponding source file
4. Read the test file to understand expectations
5. Fix the issue in the source (not the test, unless the test is wrong)
6. Re-run the specific test: `npm test -- --grep "[test name]"`
7. Once passing, run full suite: `npm test`

Do not proceed until tests pass.
```

### If TypeScript Errors
```
TypeScript compilation failing. Please:

1. Run `npm run typecheck` and capture all errors
2. For each error:
   - Read the error message
   - Navigate to the file and line
   - Fix the type issue
3. Re-run typecheck
4. Do not proceed until clean

Common issues:
- Missing imports
- Incorrect return types
- Null/undefined handling
- Generic type parameters
```

### If Stuck on Implementation
```
You seem stuck on [specific task]. Let's break it down:

1. What specific part is unclear?
2. Re-read SPECIFICATION.md section [X] for this component
3. Look at similar implementations in the codebase for patterns
4. If still unclear, implement a minimal version first, then iterate

Show me what you have so far and where you're stuck.
```

---

## Step 9: Final Validation Prompt

Once all tasks are complete:
```
Final validation checklist for claude-code-bridge v0.1.0:

## Code Quality
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm run build` compiles successfully
- [ ] All files match the specification structure

## Tests
- [ ] `npm test` - ALL tests pass
- [ ] `npm run test:coverage` - Coverage >80%
- [ ] Unit tests exist for all services
- [ ] Integration tests exist for tools and resources

## Functionality
- [ ] MCP server starts without errors
- [ ] All 14 tools are registered and callable
- [ ] All 3 resources are readable
- [ ] Path security blocks unauthorized access
- [ ] Task timeout works correctly

## Documentation
- [ ] README.md is complete and accurate
- [ ] All tool descriptions are clear
- [ ] Configuration options documented
- [ ] Usage examples provided

## Git
- [ ] All changes committed
- [ ] Commit history is clean
- [ ] No sensitive data committed

Run each check and report results. If any fail, fix them before declaring complete.
